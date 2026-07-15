/**
 * Cursor orchestration for the pull half of sync, kept in its own dependency-
 * free module so it can be unit-tested in isolation. This is the most
 * integrity-critical piece of the sync engine: getting it wrong silently loses
 * data across devices.
 */

/** What pulling one table reports back: how far its data reached, and whether
 * anything actually changed locally. */
export interface TablePullResult {
  /** The newest `updated_at` this table returned (or `since` if it returned nothing). */
  maxUpdated: string;
  /** Whether at least one local row was written as a result. */
  changed: boolean;
}

/**
 * Pulls every table from the SAME `since` floor, then returns the new cursor as
 * the newest `updated_at` seen across all of them.
 *
 * The critical invariant is that all tables are pulled from the same `since`.
 * Advancing the cursor between tables within one cycle (as an earlier version
 * did) means a table pulled after `shops` gets queried with a floor already
 * raised by the newest shop — so any row in it whose `updated_at` falls below
 * that is skipped, and skipped permanently once the cursor is persisted past it.
 * That caused shops to sync across devices while their tenants/payments silently
 * did not. Passing `since` (not the running maximum) to every puller is the fix;
 * a stray dependency on the running maximum would reintroduce the data loss.
 */
export async function pullAllTables(
  pullers: ((since: string) => Promise<TablePullResult>)[],
  since: string
): Promise<{ cursor: string; changed: boolean }> {
  let cursor = since;
  let changed = false;
  for (const pull of pullers) {
    const res = await pull(since);
    if (res.maxUpdated > cursor) cursor = res.maxUpdated;
    changed = changed || res.changed;
  }
  return { cursor, changed };
}
