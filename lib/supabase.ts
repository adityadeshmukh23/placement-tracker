import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Cloud sync is OPTIONAL. When the Supabase env vars are absent the client is
 * null and every sync entry point becomes a no-op, so the app runs exactly as
 * it did before — a purely local, offline PWA. Configuring the two env vars
 * (see docs/CLOUD_SYNC_SETUP.md) is all it takes to switch sync on.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSyncConfigured = Boolean(url && anonKey);

/**
 * Auth is a single shared PIN, not per-person logins. Behind the scenes there
 * is exactly one Supabase account for the whole household; its email is a fixed
 * constant nobody sees, and the **PIN is that account's password**. So entering
 * the PIN just signs in to that one shared account. The owner "sets the PIN
 * once" by creating this user in Supabase with the PIN as its password (see
 * docs/CLOUD_SYNC_SETUP.md). The email can be overridden via env if desired.
 */
export const SYNC_EMAIL =
  process.env.NEXT_PUBLIC_SYNC_EMAIL ?? "household@rental-book.app";

export const supabase: SupabaseClient | null = isSyncConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** Unlocks sync by signing into the shared household account with the PIN. */
export async function signInWithPin(
  pin: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Sync is not configured." };
  const { error } = await supabase.auth.signInWithPassword({
    email: SYNC_EMAIL,
    password: pin,
  });
  return { error: error?.message ?? null };
}

/**
 * Changes the shared account's password — i.e. the PIN everyone enters.
 * Supabase hashes and stores it server-side (never plaintext, never visible
 * to the client); there's no separate custom hash to manage here. Requires
 * an already-authenticated session, which the caller establishes by
 * re-verifying the current PIN first (see SyncContext's `changePin`).
 */
export async function updatePassword(
  newPin: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Sync is not configured." };
  const { error } = await supabase.auth.updateUser({ password: newPin });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribes to sign-in/sign-out changes. Returns an unsubscribe function.
 * No-op (returns a noop unsubscribe) when sync is unconfigured.
 */
export function onAuthChange(
  callback: (session: Session | null) => void
): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
