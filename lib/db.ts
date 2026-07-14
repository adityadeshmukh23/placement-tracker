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
  SyncFields,
  Tenant,
  TenantType,
} from "./types";

export class RentalBookDB extends Dexie {
  shops!: Table<Shop, string>;
  tenants!: Table<Tenant, string>;
  payments!: Table<Payment, string>;

  constructor() {
    // Storage name intentionally left as "bhadebook" (the app's former name) so
    // existing local data isn't orphaned under a new IndexedDB database name.
    super("bhadebook");

    // v1: the original single-device schema (auto-increment integer keys).
    this.version(1).stores({
      shops: "++id, name, area, createdAt",
      tenants: "++id, shopId, type, createdAt",
      payments: "++id, shopId, tenantId, dueMonth, datePaid, createdAt",
    });

    // v2: drop the old stores. Cloud sync requires globally-unique string
    // (UUID) primary keys, which is an incompatible primary-key change, so the
    // integer-keyed stores are deleted and recreated. Any pre-sync local data
    // is discarded (a fresh start was chosen deliberately).
    this.version(2).stores({
      shops: null,
      tenants: null,
      payments: null,
    });

    // v3: the sync-ready schema. `id` is a client-generated UUID; `updatedAt`
    // drives last-write-wins; only indexed fields are listed.
    this.version(3).stores({
      shops: "id, area, updatedAt",
      tenants: "id, shopId, updatedAt",
      payments: "id, shopId, tenantId, dueMonth, updatedAt",
    });
  }
}

export const db = new RentalBookDB();

/** Returns the current month formatted as "YYYY-MM". */
export function currentMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// --- Sync-field helpers ------------------------------------------------------

/** A globally-unique id, stable across devices (unlike an auto-increment key). */
function newId(): string {
  return crypto.randomUUID();
}

/**
 * The sync scaffolding for a brand-new record: a fresh UUID, timestamps, no
 * tombstone, and `dirty: true` so the next sync pushes it to the server.
 */
function freshRecord(now: Date = new Date()): SyncFields {
  return { id: newId(), createdAt: now, updatedAt: now, deletedAt: null, dirty: true };
}

/**
 * The fields to merge into an existing record on any local change so it is
 * re-pushed and wins later last-write-wins comparisons.
 */
function touch(now: Date = new Date()): Pick<SyncFields, "updatedAt" | "dirty"> {
  return { updatedAt: now, dirty: true };
}

/** True for records that have not been tombstoned (soft-deleted). */
function notDeleted(record: { deletedAt: Date | null }): boolean {
  return record.deletedAt == null;
}

/** Fired after any local write so the sync provider can push promptly. */
export const LOCAL_CHANGE_EVENT = "bhadebook:localchange";

function notifyLocalChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }
}

// --- Reads / writes ----------------------------------------------------------

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

/** A live, active tenant: neither deactivated nor tombstoned. */
function isLiveActive(tenant: Tenant): boolean {
  return isActive(tenant) && notDeleted(tenant);
}

/** Adds a shop. */
export async function addShop(
  shop: Omit<Shop, keyof SyncFields>
): Promise<string> {
  const record = { ...shop, ...freshRecord() };
  await db.shops.add(record);
  notifyLocalChange();
  return record.id;
}

/**
 * Adds a tenant to a shop while enforcing a single active tenant per shop:
 * any existing active tenant on the same shop is deactivated first, then the
 * new tenant is inserted as the active one.
 */
export async function addTenant(
  tenant: Omit<Tenant, keyof SyncFields | "active">
): Promise<string> {
  const id = await db.transaction("rw", db.tenants, async () => {
    const now = new Date();
    await db.tenants
      .where("shopId")
      .equals(tenant.shopId)
      .filter(isLiveActive)
      .modify({ active: false, ...touch(now) });

    const record = { ...tenant, active: true, ...freshRecord(now) };
    await db.tenants.add(record);
    return record.id;
  });
  notifyLocalChange();
  return id;
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
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(isLiveActive).toArray(),
    db.payments.where("dueMonth").equals(month).filter(notDeleted).toArray(),
  ]);

  const tenantByShop = new Map<string, Tenant>();
  for (const tenant of tenants) {
    tenantByShop.set(tenant.shopId, tenant);
  }

  const paymentsByShop = new Map<string, Payment[]>();
  for (const payment of monthPayments) {
    const list = paymentsByShop.get(payment.shopId) ?? [];
    list.push(payment);
    paymentsByShop.set(payment.shopId, list);
  }

  return shops.map((shop) => {
    const shopPayments = paymentsByShop.get(shop.id) ?? [];
    const collected = collectedFrom(shopPayments);
    return {
      ...shop,
      tenant: tenantByShop.get(shop.id) ?? null,
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
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(isLiveActive).toArray(),
    db.payments.where("dueMonth").equals(month).filter(notDeleted).toArray(),
  ]);

  const occupiedShopIds = new Set(tenants.map((t) => t.shopId));

  const totalDue = shops
    .filter((s) => occupiedShopIds.has(s.id))
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
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(isLiveActive).toArray(),
  ]);
  const occupiedShopIds = new Set(tenants.map((t) => t.shopId));
  return shops.filter((s) => !occupiedShopIds.has(s.id)).length;
}

/**
 * The amount to pre-fill when recording a new payment for a shop: the most
 * recently paid amount if one exists (covers shops that consistently pay a
 * negotiated amount different from the nominal rent), otherwise the shop's
 * monthly rent.
 */
export async function getUsualAmount(shopId: string): Promise<number> {
  const shop = await db.shops.get(shopId);
  if (!shop) return 0;

  const payments = await db.payments
    .where("shopId")
    .equals(shopId)
    .filter(notDeleted)
    .toArray();
  const paid = payments.filter((p) => p.datePaid != null);
  if (paid.length === 0) return shop.monthlyRent;

  paid.sort((a, b) => b.datePaid!.getTime() - a.datePaid!.getTime());
  return paid[0].amount;
}

/**
 * Whether a shop is already fully paid for `month` (defaults to the current
 * month), checked fresh against Dexie rather than trusting a possibly-stale
 * in-memory `ShopWithStatus` — used to guard against recording a duplicate
 * payment from a stale render (e.g. a quick double-tap, or another device's
 * sync landing between renders).
 */
export async function isShopFullyPaid(
  shopId: string,
  month: string = currentMonth()
): Promise<boolean> {
  const shop = await db.shops.get(shopId);
  if (!shop || !notDeleted(shop)) return false;

  const monthPayments = await db.payments
    .where("shopId")
    .equals(shopId)
    .filter((p) => p.dueMonth === month && notDeleted(p))
    .toArray();

  return collectedFrom(monthPayments) >= shop.monthlyRent;
}

/** Records a payment. `dueMonth` defaults to the current month. */
export async function recordPayment(
  payment: Omit<Payment, keyof SyncFields | "dueMonth"> & {
    dueMonth?: string;
  }
): Promise<string> {
  const record = {
    ...payment,
    dueMonth: payment.dueMonth ?? currentMonth(),
    ...freshRecord(),
  };
  await db.payments.add(record);
  notifyLocalChange();
  return record.id;
}

/**
 * Updates a shop's monthly rent (e.g. an annual increase). This changes what
 * "paid in full" means for every month evaluated against this shop going
 * forward — and, since rent isn't snapshotted per-payment, for past months
 * too, whenever their status is recomputed (Dashboard, Reports).
 */
export async function updateMonthlyRent(
  shopId: string,
  monthlyRent: number
): Promise<void> {
  await db.shops.update(shopId, { monthlyRent, ...touch() });
  notifyLocalChange();
}

/**
 * Deletes a shop along with all of its tenants and payments. Deletes are soft
 * (tombstoned via `deletedAt`) so they can propagate to other devices; reads
 * exclude tombstoned rows, so the shop disappears from the UI immediately.
 */
export async function deleteShop(shopId: string): Promise<void> {
  await db.transaction("rw", db.shops, db.tenants, db.payments, async () => {
    const now = new Date();
    const tombstone = { deletedAt: now, ...touch(now) };
    await db.payments.where("shopId").equals(shopId).modify(tombstone);
    await db.tenants.where("shopId").equals(shopId).modify(tombstone);
    await db.shops.update(shopId, tombstone);
  });
  notifyLocalChange();
}

/**
 * Ends a tenancy: the tenant is deactivated (not deleted) so the shop's
 * payment history stays intact, and the shop becomes vacant again.
 */
export async function removeTenant(tenantId: string): Promise<void> {
  await db.tenants.update(tenantId, { active: false, ...touch() });
  notifyLocalChange();
}

/** Soft-deletes (tombstones) a single payment record. */
export async function deletePayment(paymentId: string): Promise<void> {
  const now = new Date();
  await db.payments.update(paymentId, { deletedAt: now, ...touch(now) });
  notifyLocalChange();
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
  shopId: string,
  activeSince: Date
): Promise<ShopLedger> {
  const payments = await db.payments
    .where("shopId")
    .equals(shopId)
    .filter(notDeleted)
    .toArray();

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
 * Total amount collected for each of the 12 months of `year`, in calendar
 * order (January first). When `tenantType` is given, only payments made by a
 * tenant of that type are counted — attributed by whoever actually made the
 * payment (its own `tenantId`), not the shop's current occupant, so a tenant
 * turnover doesn't retroactively reclassify earlier months.
 */
export async function getYearlyCollectionSummary(
  year: string,
  tenantType?: TenantType
): Promise<MonthlyCollected[]> {
  const [payments, tenants] = await Promise.all([
    db.payments
      .where("dueMonth")
      .between(`${year}-01`, `${year}-12`, true, true)
      .filter(notDeleted)
      .toArray(),
    tenantType ? db.tenants.filter(notDeleted).toArray() : Promise.resolve([]),
  ]);

  const typeByTenantId = tenantType
    ? new Map(tenants.map((tn) => [tn.id, tn.type]))
    : null;

  const collectedByMonth = new Map<string, number>();
  for (const payment of payments) {
    if (payment.datePaid == null) continue;
    if (typeByTenantId && typeByTenantId.get(payment.tenantId) !== tenantType) {
      continue;
    }
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
  const payments = await db.payments.filter(notDeleted).toArray();
  const years = new Set(payments.map((p) => p.dueMonth.slice(0, 4)));
  years.add(currentMonth().slice(0, 4));
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
