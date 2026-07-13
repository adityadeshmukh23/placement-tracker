import Dexie, { type Table } from "dexie";
import type {
  LedgerRow,
  MonthlyCollected,
  MonthlySummary,
  Payment,
  PaymentStatus,
  Shop,
  ShopLedger,
  ShopWithStatus,
  Tenant,
} from "./types";

export class BhadeBookDB extends Dexie {
  shops!: Table<Shop, number>;
  tenants!: Table<Tenant, number>;
  payments!: Table<Payment, number>;

  constructor() {
    super("bhadebook");
    this.version(1).stores({
      // Only indexed fields are listed; other fields are stored but not indexed.
      shops: "++id, name, area, createdAt",
      tenants: "++id, shopId, type, createdAt",
      payments: "++id, shopId, tenantId, dueMonth, datePaid, createdAt",
    });
  }
}

export const db = new BhadeBookDB();

/** Returns the current month formatted as "YYYY-MM". */
export function currentMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Sum of amounts for payments that have actually been paid. */
function collectedFrom(payments: Payment[]): number {
  return payments
    .filter((p) => p.datePaid != null)
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * A tenant counts as active unless it has been explicitly deactivated.
 * (Booleans aren't valid IndexedDB index keys, so `active` is filtered in
 * memory rather than via a Dexie index.)
 */
function isActive(tenant: Tenant): boolean {
  return tenant.active !== false;
}

/**
 * Adds a tenant to a shop while enforcing a single active tenant per shop:
 * any existing active tenant on the same shop is deactivated first, then the
 * new tenant is inserted as the active one.
 */
export async function addTenant(
  tenant: Omit<Tenant, "id" | "active">
): Promise<number> {
  return db.transaction("rw", db.tenants, async () => {
    await db.tenants
      .where("shopId")
      .equals(tenant.shopId)
      .filter(isActive)
      .modify({ active: false });

    return db.tenants.add({ ...tenant, active: true });
  });
}

function statusFor(monthlyRent: number, collected: number): PaymentStatus {
  if (collected <= 0) return "unpaid";
  if (collected >= monthlyRent) return "paid";
  return "partial";
}

/**
 * Returns every shop joined with its active tenant (or null when vacant) and
 * its payment status for the given month (defaults to the current month).
 */
export async function getShopsWithCurrentStatus(
  month: string = currentMonth()
): Promise<ShopWithStatus[]> {
  const [shops, tenants, monthPayments] = await Promise.all([
    db.shops.toArray(),
    db.tenants.filter(isActive).toArray(),
    db.payments.where("dueMonth").equals(month).toArray(),
  ]);

  const tenantByShop = new Map<number, Tenant>();
  for (const tenant of tenants) {
    tenantByShop.set(tenant.shopId, tenant);
  }

  const paymentsByShop = new Map<number, Payment[]>();
  for (const payment of monthPayments) {
    const list = paymentsByShop.get(payment.shopId) ?? [];
    list.push(payment);
    paymentsByShop.set(payment.shopId, list);
  }

  return shops.map((shop) => {
    const shopPayments = paymentsByShop.get(shop.id!) ?? [];
    const collected = collectedFrom(shopPayments);
    return {
      ...shop,
      tenant: tenantByShop.get(shop.id!) ?? null,
      payments: shopPayments,
      collected,
      status: statusFor(shop.monthlyRent, collected),
    };
  });
}

/**
 * Aggregates rent due, collected and pending for a given month, counting only
 * shops that currently have an active tenant. Vacant shops are excluded from
 * every total (surface vacancy separately via getVacantShopCount).
 */
export async function getMonthlySummary(
  month: string = currentMonth()
): Promise<MonthlySummary> {
  const [shops, tenants, monthPayments] = await Promise.all([
    db.shops.toArray(),
    db.tenants.filter(isActive).toArray(),
    db.payments.where("dueMonth").equals(month).toArray(),
  ]);

  const occupiedShopIds = new Set(tenants.map((t) => t.shopId));

  const totalDue = shops
    .filter((s) => occupiedShopIds.has(s.id!))
    .reduce((sum, s) => sum + s.monthlyRent, 0);

  const totalCollected = collectedFrom(
    monthPayments.filter((p) => occupiedShopIds.has(p.shopId))
  );

  return {
    month,
    totalDue,
    totalCollected,
    totalPending: totalDue - totalCollected,
  };
}

/** Number of shops that currently have no active tenant. */
export async function getVacantShopCount(): Promise<number> {
  const [shops, tenants] = await Promise.all([
    db.shops.toArray(),
    db.tenants.filter(isActive).toArray(),
  ]);
  const occupiedShopIds = new Set(tenants.map((t) => t.shopId));
  return shops.filter((s) => !occupiedShopIds.has(s.id!)).length;
}

/**
 * The amount to pre-fill when recording a new payment for a shop: the most
 * recently paid amount if one exists (covers shops that consistently pay a
 * negotiated amount different from the nominal rent), otherwise the shop's
 * monthly rent.
 */
export async function getUsualAmount(shopId: number): Promise<number> {
  const shop = await db.shops.get(shopId);
  if (!shop) return 0;

  const payments = await db.payments.where("shopId").equals(shopId).toArray();
  const paid = payments.filter((p) => p.datePaid != null);
  if (paid.length === 0) return shop.monthlyRent;

  paid.sort((a, b) => b.datePaid!.getTime() - a.datePaid!.getTime());
  return paid[0].amount;
}

/** Records a payment. `dueMonth` defaults to the current month. */
export async function recordPayment(
  payment: Omit<Payment, "id" | "createdAt" | "dueMonth"> & {
    dueMonth?: string;
  }
): Promise<number> {
  return db.payments.add({
    ...payment,
    dueMonth: payment.dueMonth ?? currentMonth(),
    createdAt: new Date(),
  });
}

/** Every "YYYY-MM" month from `startMonth` to `endMonth`, inclusive. */
function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNum] = startMonth.split("-").map(Number);
  const [endYear, endMonthNum] = endMonth.split("-").map(Number);

  const months: string[] = [];
  let year = startYear;
  let month = startMonthNum;
  while (year < endYear || (year === endYear && month <= endMonthNum)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthOfRow(row: LedgerRow): string {
  return row.kind === "payment" ? row.payment.dueMonth : row.month;
}

/**
 * Builds the full payment ledger for a shop: every payment ever recorded for
 * it, newest first, plus a synthetic "missed" row for any month since
 * `activeSince` with no payment on record at all. Months before `activeSince`
 * (i.e. before the current tenant moved in) are never marked missed.
 */
export async function getShopLedger(
  shopId: number,
  activeSince: Date
): Promise<ShopLedger> {
  const payments = await db.payments.where("shopId").equals(shopId).toArray();

  const startMonth = currentMonth(activeSince);
  const endMonth = currentMonth();
  const monthsWithPayment = new Set(payments.map((p) => p.dueMonth));

  const paymentRows: LedgerRow[] = payments.map((payment) => ({
    kind: "payment",
    payment,
  }));
  const missedRows: LedgerRow[] = monthsBetween(startMonth, endMonth)
    .filter((month) => !monthsWithPayment.has(month))
    .map((month) => ({ kind: "missed", month }));

  const rows = [...paymentRows, ...missedRows].sort((a, b) => {
    const monthCompare = monthOfRow(b).localeCompare(monthOfRow(a));
    if (monthCompare !== 0) return monthCompare;
    const dateA = a.kind === "payment" ? a.payment.datePaid?.getTime() ?? 0 : 0;
    const dateB = b.kind === "payment" ? b.payment.datePaid?.getTime() ?? 0 : 0;
    return dateB - dateA;
  });

  const years = Array.from(
    new Set(rows.map((row) => monthOfRow(row).slice(0, 4)))
  ).sort((a, b) => b.localeCompare(a));

  return { rows, years };
}

/**
 * Total amount collected across all shops for each of the 12 months of
 * `year`, in calendar order (January first).
 */
export async function getYearlyCollectionSummary(
  year: string
): Promise<MonthlyCollected[]> {
  const payments = await db.payments
    .where("dueMonth")
    .between(`${year}-01`, `${year}-12`, true, true)
    .toArray();

  const collectedByMonth = new Map<string, number>();
  for (const payment of payments) {
    if (payment.datePaid == null) continue;
    const month = payment.dueMonth;
    collectedByMonth.set(month, (collectedByMonth.get(month) ?? 0) + payment.amount);
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month, collected: collectedByMonth.get(month) ?? 0 };
  });
}

/**
 * Every year that has at least one payment on record, newest first, always
 * including the current year even if it has no payments yet.
 */
export async function getAvailableYears(): Promise<string[]> {
  const payments = await db.payments.toArray();
  const years = new Set(payments.map((p) => p.dueMonth.slice(0, 4)));
  years.add(currentMonth().slice(0, 4));
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
