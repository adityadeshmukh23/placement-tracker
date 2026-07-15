export type TenantType = "regular" | "family";

export type PaymentMode = "cash" | "upi" | "cheque" | "other";

/**
 * Fields carried by every syncable record. `id` is a client-generated UUID
 * (stable across devices, unlike an auto-increment integer). `updatedAt`
 * drives last-write-wins conflict resolution; `deletedAt` is a tombstone
 * (soft delete) so deletions can propagate; `dirty` is local-only bookkeeping
 * marking a row as needing to be pushed (never sent to the server).
 */
export interface SyncFields {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  dirty: boolean;
}

/** A rentable unit. Grouped in the UI by `area`. */
export interface Shop extends SyncFields {
  name: string;
  /** Locality used for grouping shops together, e.g. "MG Road". */
  area: string;
  address?: string;
  monthlyRent: number;
}

/** A person/family renting a shop. */
export interface Tenant extends SyncFields {
  shopId: string;
  name: string;
  phone?: string;
  type: TenantType;
  /** Only one tenant per shop may be active at a time. Defaults to true. */
  active: boolean;
}

/** A rent payment record for a given month. `datePaid` is null while unpaid. */
export interface Payment extends SyncFields {
  shopId: string;
  tenantId: string;
  amount: number;
  /** Month the payment is due for, in "YYYY-MM" format, e.g. "2026-07". */
  dueMonth: string;
  datePaid: Date | null;
  paymentMode: PaymentMode;
  notes?: string;
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

export type TransactionDirection = "out" | "in";

export type TransactionCategory =
  | "medical"
  | "insurance"
  | "family"
  | "donation"
  | "personal"
  | "other";

/**
 * A miscellaneous personal record (a donation, a medical expense, etc.) —
 * fully independent of the Shop/Tenant/Payment rent system. Never counted in
 * any rent total, Dashboard figure, or Report.
 */
export interface OtherTransaction extends SyncFields {
  amount: number;
  direction: TransactionDirection;
  category: TransactionCategory;
  /** Free text, used only when `category` is `"other"`. */
  categoryOther?: string;
  description?: string;
  /** The date the transaction actually happened (not when it was logged). */
  date: Date;
  /** Name of whoever logged it, captured once at creation from this device. */
  loggedBy: string;
  /** Optional photo, stored as a client-side downscaled data URL. */
  photo?: string;
}

/** Composable filter for `getOtherTransactions` — keyword/category/date-range,
 * kept in the data layer (not baked into any UI component) so it can also
 * back a future natural-language "ask the app" query feature. */
export interface OtherTransactionFilter {
  keyword?: string;
  category?: TransactionCategory;
  /** Inclusive "YYYY-MM-DD" bounds. */
  startDate?: string;
  endDate?: string;
}

// --- Insights ----------------------------------------------------------

export interface YoyComparison {
  thisYearToDate: number;
  lastYearSamePeriod: number;
  /** Null when last year has no collections to compare against. */
  percentChange: number | null;
}

export interface TenantReliability {
  tenantId: string;
  tenantName: string;
  shopName: string;
  tenantType: TenantType;
  monthsTracked: number;
  monthsPaidOnTime: number;
  reliabilityRate: number;
}

export interface TenantAttention {
  tenantId: string;
  tenantName: string;
  shopName: string;
  tenantType: TenantType;
  monthsInArrears: number;
  totalArrears: number;
}

export interface AreaIncome {
  area: string;
  collected: number;
}

export interface MonthProgress {
  expected: number;
  collected: number;
  remaining: number;
}

export interface VacantShopNote {
  shopName: string;
  monthsVacant: number;
}

export type HeadlineKind =
  | "bestMonth"
  | "aheadOfLastMonth"
  | "behindLastMonth"
  | "onPaceLastMonth"
  | "monthProgress"
  | "noData";

export interface HeadlineInsight {
  tone: "green" | "amber";
  kind: HeadlineKind;
  /** Rupee amount, present for aheadOfLastMonth/behindLastMonth. */
  amount?: number;
  /** Whole-number percent, present for monthProgress. */
  percent?: number;
}
