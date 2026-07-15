import type { Table, UpdateSpec } from "dexie";
import { db } from "./db";
import { pullAllTables } from "./pullCursor";
import { getSession, isSyncConfigured, supabase } from "./supabase";
import type {
  FamilyDocument,
  OtherTransaction,
  Payment,
  Shop,
  SyncFields,
  Tenant,
} from "./types";

/**
 * The sync engine sits on top of Dexie, which remains the local source of truth
 * for all reads. On each run it PUSHES locally-changed ("dirty") rows to
 * Supabase, then PULLS rows the server has seen change since our last cursor,
 * merging by last-write-wins on `updatedAt`. Deletions travel as tombstones
 * (`deletedAt` set), so they propagate like any other change.
 *
 * It is deliberately simple: no realtime, no per-field merge. That is enough
 * for a two-person household sharing one dataset.
 */

const CURSOR_KEY = "bhadebook:last-pulled-at";
const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Bumped whenever a change to the pull logic could have left a device's cursor
 * ahead of rows it should have pulled. On the first sync after an upgrade, the
 * cursor is reset to EPOCH once so the whole dataset is re-pulled and any gaps
 * are healed. Version 2 fixes a bug where the cursor was advanced between tables
 * within one cycle, permanently skipping rows in tables pulled after `shops`.
 */
const SYNC_LOGIC_VERSION = "2";
const LOGIC_VERSION_KEY = "bhadebook:sync-logic-version";

export type SyncStatus =
  | "disabled" // sync not configured
  | "offline"
  | "unauthenticated"
  | "busy"
  | "ok"
  | "error";

export interface SyncResult {
  status: SyncStatus;
}

/** Fired after a pull writes at least one change into Dexie, so screens can refetch. */
export const SYNCED_EVENT = "bhadebook:synced";

function getCursor(): string {
  if (typeof localStorage === "undefined") return EPOCH;
  return localStorage.getItem(CURSOR_KEY) ?? EPOCH;
}

function setCursor(iso: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(CURSOR_KEY, iso);
}

/**
 * One-time-per-device recovery: if the pull logic version changed since this
 * device last synced, reset the cursor to EPOCH so the next pull re-reads the
 * full dataset and heals any rows a previous, buggy version skipped. This is
 * safe under last-write-wins: re-pulled rows only overwrite older local copies,
 * and any locally-edited-but-unpushed row (with a newer `updatedAt`) is kept.
 */
function healCursorForNewLogic(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(LOGIC_VERSION_KEY) !== SYNC_LOGIC_VERSION) {
    setCursor(EPOCH);
    localStorage.setItem(LOGIC_VERSION_KEY, SYNC_LOGIC_VERSION);
  }
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

// --- Row mapping (camelCase local <-> snake_case remote) ---------------------
// `dirty` is local-only bookkeeping and never leaves the device. Rows written
// back from the server are always marked `dirty: false`.

/* eslint-disable @typescript-eslint/no-explicit-any */
type RemoteRow = Record<string, any>;

function syncFromRemote(r: RemoteRow): SyncFields {
  return {
    id: r.id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    dirty: false,
  };
}

function syncToRemote(row: SyncFields): RemoteRow {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    deleted_at: toIso(row.deletedAt),
  };
}

function shopToRemote(s: Shop): RemoteRow {
  return {
    ...syncToRemote(s),
    name: s.name,
    area: s.area,
    address: s.address ?? null,
    monthly_rent: s.monthlyRent,
  };
}

function shopFromRemote(r: RemoteRow): Shop {
  return {
    ...syncFromRemote(r),
    name: r.name,
    area: r.area,
    address: r.address ?? undefined,
    monthlyRent: r.monthly_rent,
  };
}

function tenantToRemote(t: Tenant): RemoteRow {
  return {
    ...syncToRemote(t),
    shop_id: t.shopId,
    name: t.name,
    phone: t.phone ?? null,
    type: t.type,
    active: t.active,
  };
}

function tenantFromRemote(r: RemoteRow): Tenant {
  return {
    ...syncFromRemote(r),
    shopId: r.shop_id,
    name: r.name,
    phone: r.phone ?? undefined,
    type: r.type,
    active: r.active,
  };
}

function paymentToRemote(p: Payment): RemoteRow {
  return {
    ...syncToRemote(p),
    shop_id: p.shopId,
    tenant_id: p.tenantId,
    amount: p.amount,
    due_month: p.dueMonth,
    date_paid: toIso(p.datePaid),
    payment_mode: p.paymentMode,
    notes: p.notes ?? null,
  };
}

function paymentFromRemote(r: RemoteRow): Payment {
  return {
    ...syncFromRemote(r),
    shopId: r.shop_id,
    tenantId: r.tenant_id,
    amount: r.amount,
    dueMonth: r.due_month,
    datePaid: r.date_paid ? new Date(r.date_paid) : null,
    paymentMode: r.payment_mode,
    notes: r.notes ?? undefined,
  };
}

function otherTransactionToRemote(o: OtherTransaction): RemoteRow {
  return {
    ...syncToRemote(o),
    amount: o.amount,
    direction: o.direction,
    category: o.category,
    category_other: o.categoryOther ?? null,
    description: o.description ?? null,
    date: o.date.toISOString(),
    logged_by: o.loggedBy,
    photo: o.photo ?? null,
  };
}

function otherTransactionFromRemote(r: RemoteRow): OtherTransaction {
  return {
    ...syncFromRemote(r),
    amount: r.amount,
    direction: r.direction,
    category: r.category,
    categoryOther: r.category_other ?? undefined,
    description: r.description ?? undefined,
    date: new Date(r.date),
    loggedBy: r.logged_by,
    photo: r.photo ?? undefined,
  };
}

function documentToRemote(d: FamilyDocument): RemoteRow {
  return {
    ...syncToRemote(d),
    title: d.title,
    category: d.category,
    category_other: d.categoryOther ?? null,
    belongs_to: d.belongsTo,
    belongs_to_other: d.belongsToOther ?? null,
    file_url: d.fileUrl,
    file_type: d.fileType,
    expiry_date: toIso(d.expiryDate ?? null),
    notes: d.notes ?? null,
    uploaded_by: d.uploadedBy,
    sensitive: d.sensitive,
  };
}

function documentFromRemote(r: RemoteRow): FamilyDocument {
  return {
    ...syncFromRemote(r),
    title: r.title,
    category: r.category,
    categoryOther: r.category_other ?? undefined,
    belongsTo: r.belongs_to,
    belongsToOther: r.belongs_to_other ?? undefined,
    fileUrl: r.file_url,
    fileType: r.file_type,
    expiryDate: r.expiry_date ? new Date(r.expiry_date) : undefined,
    notes: r.notes ?? undefined,
    uploadedBy: r.uploaded_by,
    sensitive: r.sensitive,
  };
}

interface TableSync<T extends SyncFields> {
  table: Table<T, string>;
  remote: string;
  toRemote: (row: T) => RemoteRow;
  fromRemote: (r: RemoteRow) => T;
}

const SHOPS: TableSync<Shop> = {
  table: db.shops,
  remote: "shops",
  toRemote: shopToRemote,
  fromRemote: shopFromRemote,
};
const TENANTS: TableSync<Tenant> = {
  table: db.tenants,
  remote: "tenants",
  toRemote: tenantToRemote,
  fromRemote: tenantFromRemote,
};
const PAYMENTS: TableSync<Payment> = {
  table: db.payments,
  remote: "payments",
  toRemote: paymentToRemote,
  fromRemote: paymentFromRemote,
};
const OTHER_TRANSACTIONS: TableSync<OtherTransaction> = {
  table: db.otherTransactions,
  remote: "other_transactions",
  toRemote: otherTransactionToRemote,
  fromRemote: otherTransactionFromRemote,
};
const DOCUMENTS: TableSync<FamilyDocument> = {
  table: db.documents,
  remote: "documents",
  toRemote: documentToRemote,
  fromRemote: documentFromRemote,
};
const TABLES: TableSync<any>[] = [
  SHOPS,
  TENANTS,
  PAYMENTS,
  OTHER_TRANSACTIONS,
  DOCUMENTS,
];

// --- Push / pull -------------------------------------------------------------

async function pushTable<T extends SyncFields>(t: TableSync<T>): Promise<void> {
  const dirty = await t.table.filter((r) => r.dirty === true).toArray();
  if (dirty.length === 0) return;

  const { error } = await supabase!.from(t.remote).upsert(dirty.map(t.toRemote));
  if (error) throw error;

  // Clear the dirty flag only where the row hasn't been re-edited since we read
  // it (updatedAt unchanged), so a concurrent local edit is not lost.
  await db.transaction("rw", t.table, async () => {
    for (const row of dirty) {
      const current = await t.table.get(row.id);
      if (current && current.updatedAt.getTime() === row.updatedAt.getTime()) {
        await t.table.update(row.id, { dirty: false } as unknown as UpdateSpec<T>);
      }
    }
  });
}

/** Returns the newest `updated_at` seen, and whether any local row changed. */
async function pullTable<T extends SyncFields>(
  t: TableSync<T>,
  since: string
): Promise<{ maxUpdated: string; changed: boolean }> {
  const { data, error } = await supabase!
    .from(t.remote)
    .select("*")
    .gt("updated_at", since)
    .order("updated_at", { ascending: true });
  if (error) throw error;

  let maxUpdated = since;
  let changed = false;

  for (const r of data ?? []) {
    if (r.updated_at > maxUpdated) maxUpdated = r.updated_at;
    const remote = t.fromRemote(r);
    const local = await t.table.get(remote.id);
    // Last-write-wins: apply the remote row unless our local copy is newer.
    // This also preserves unpushed local edits (their updatedAt is newer).
    if (!local || remote.updatedAt.getTime() >= local.updatedAt.getTime()) {
      await t.table.put(remote);
      changed = true;
    }
  }

  return { maxUpdated, changed };
}

let syncing = false;

/**
 * Runs one full sync cycle. Safe to call anytime: it no-ops when sync is
 * unconfigured, offline, signed-out, or already running, and swallows network
 * errors (returning status "error") so callers never need try/catch.
 */
export async function sync(): Promise<SyncResult> {
  if (!isSyncConfigured || !supabase) return { status: "disabled" };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { status: "offline" };
  }
  const session = await getSession();
  if (!session) return { status: "unauthenticated" };
  if (syncing) return { status: "busy" };

  syncing = true;
  try {
    for (const t of TABLES) await pushTable(t);

    healCursorForNewLogic();
    const { cursor, changed } = await pullAllTables(
      TABLES.map((t) => (since: string) => pullTable(t, since)),
      getCursor()
    );
    setCursor(cursor);

    if (changed && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNCED_EVENT));
    }
    return { status: "ok" };
  } catch (err) {
    console.error("[sync] failed:", err);
    return { status: "error" };
  } finally {
    syncing = false;
  }
}
