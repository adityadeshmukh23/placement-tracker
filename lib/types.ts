export type TenantType = "regular" | "family";

export type PaymentMode = "cash" | "upi" | "cheque" | "other";

/** A rentable unit. Grouped in the UI by `area`. */
export interface Shop {
  id?: number;
  name: string;
  /** Locality used for grouping shops together, e.g. "MG Road". */
  area: string;
  address?: string;
  monthlyRent: number;
  createdAt: Date;
}

/** A person/family renting a shop. */
export interface Tenant {
  id?: number;
  shopId: number;
  name: string;
  phone?: string;
  type: TenantType;
  /** Only one tenant per shop may be active at a time. Defaults to true. */
  active: boolean;
  createdAt: Date;
}

/** A rent payment record for a given month. `datePaid` is null while unpaid. */
export interface Payment {
  id?: number;
  shopId: number;
  tenantId: number;
  amount: number;
  /** Month the payment is due for, in "YYYY-MM" format, e.g. "2026-07". */
  dueMonth: string;
  datePaid: Date | null;
  paymentMode: PaymentMode;
  notes?: string;
  createdAt: Date;
}

export type PaymentStatus = "paid" | "partial" | "unpaid";

/** A shop enriched with its active tenant and this-month payment status. */
export interface ShopWithStatus extends Shop {
  /** The shop's single active tenant, or null when vacant. */
  tenant: Tenant | null;
  /** Payments recorded for the queried month. */
  payments: Payment[];
  /** Sum of amounts for payments that have been paid (datePaid set). */
  collected: number;
  status: PaymentStatus;
}

export interface MonthlySummary {
  month: string;
  totalDue: number;
  totalCollected: number;
  totalPending: number;
}

/** One row in a shop's payment ledger: either a real payment or a synthetic
 * "missed" placeholder for a month with no payment on record. */
export type LedgerRow =
  | { kind: "payment"; payment: Payment }
  | { kind: "missed"; month: string };

export interface ShopLedger {
  /** Newest first. */
  rows: LedgerRow[];
  /** Years present in `rows`, newest first. */
  years: string[];
}

/** Total amount collected (across all shops) for one calendar month. */
export interface MonthlyCollected {
  /** "YYYY-MM" */
  month: string;
  collected: number;
}
