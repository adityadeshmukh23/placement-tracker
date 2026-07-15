"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  getSession,
  isSyncConfigured,
  onAuthChange,
  signInWithPin as sbSignInWithPin,
  signOut as sbSignOut,
  updatePassword as sbUpdatePassword,
} from "./supabase";
import { sync } from "./sync";
import { LOCAL_CHANGE_EVENT } from "./db";

/** How often to poll for the other device's changes while signed in. */
const SYNC_INTERVAL_MS = 20_000;
/** Debounce window to coalesce a burst of local writes into one push. */
const DEBOUNCE_MS = 800;
/**
 * The PIN is remembered on the device so it isn't asked again, and so the app
 * can silently re-authenticate if the Supabase session ever expires while
 * offline. localStorage is the only durable store available to a PWA; for a
 * private household app guarded by a shared PIN this is an accepted trade-off.
 */
const PIN_KEY = "bhadebook:sync-pin";

/**
 * Reads the PIN remembered on this device (set on a successful sign-in).
 * Used to verify PIN re-entry for sensitive documents — a lightweight local
 * check rather than a full re-auth round trip, consistent with this app's
 * shared-PIN trust model (see lib/loggedBy.ts).
 */
export function getRememberedPin(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(PIN_KEY);
}

export type SyncUiStatus = "idle" | "syncing" | "synced" | "offline" | "error";

/** Sentinel `error` value from `changePin` meaning the *current* PIN was wrong
 * (as opposed to some other failure updating the new one). */
export const WRONG_CURRENT_PIN = "wrong-current-pin";

interface SyncContextValue {
  /** Whether Supabase env vars are present at all. */
  configured: boolean;
  session: Session | null;
  status: SyncUiStatus;
  lastSyncedAt: Date | null;
  /** Whether the first-launch PIN gate should be shown. */
  pinGateOpen: boolean;
  openPinGate: () => void;
  dismissPinGate: () => void;
  signInWithPin: (pin: string) => Promise<{ error: string | null }>;
  /**
   * Verifies `currentPin` (via the same path as a normal sign-in), then — only
   * if that succeeds — changes the shared account's password to `newPin` and
   * updates what's remembered on this device. Returns `{ error:
   * WRONG_CURRENT_PIN }` specifically when step one fails, so the caller can
   * show a targeted message rather than a generic one.
   */
  changePin: (
    currentPin: string,
    newPin: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncUiStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  // Prompt for the PIN on first launch whenever sync is configured for the app
  // but this device hasn't unlocked it yet.
  const [pinGateOpen, setPinGateOpen] = useState(isSyncConfigured);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(async () => {
    if (!isSyncConfigured) return;
    setStatus("syncing");
    const { status: result } = await sync();
    if (result === "ok") {
      setStatus("synced");
      setLastSyncedAt(new Date());
    } else if (result === "offline") {
      setStatus("offline");
    } else if (result === "error") {
      setStatus("error");
    } else if (result === "unauthenticated" || result === "disabled") {
      setStatus("idle");
    }
    // "busy": another cycle is running; leave the current status untouched.
  }, []);

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSync, DEBOUNCE_MS);
  }, [runSync]);

  // Track the shared-account session. On mount, restore any persisted session;
  // if there is none but a PIN was remembered on this device, silently
  // re-authenticate with it (covers an expired/cleared session).
  useEffect(() => {
    if (!isSyncConfigured) return;
    getSession().then(async (existing) => {
      if (existing) {
        setSession(existing);
        return;
      }
      const storedPin =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(PIN_KEY)
          : null;
      if (storedPin) {
        const { error } = await sbSignInWithPin(storedPin);
        if (!error) setSession(await getSession());
      }
    });
    return onAuthChange(setSession);
  }, []);

  // While signed in: sync now, then on an interval, on reconnect, and shortly
  // after any local write.
  useEffect(() => {
    if (!isSyncConfigured || !session) return;
    runSync();
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    const onLocalChange = () => scheduleSync();
    const onOnline = () => scheduleSync();
    window.addEventListener(LOCAL_CHANGE_EVENT, onLocalChange);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener(LOCAL_CHANGE_EVENT, onLocalChange);
      window.removeEventListener("online", onOnline);
    };
  }, [session, runSync, scheduleSync]);

  const signInWithPin = useCallback(async (pin: string) => {
    const res = await sbSignInWithPin(pin);
    if (!res.error) {
      if (typeof localStorage !== "undefined") localStorage.setItem(PIN_KEY, pin);
      setSession(await getSession());
      setPinGateOpen(false);
    }
    return res;
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    const verify = await sbSignInWithPin(currentPin);
    if (verify.error) return { error: WRONG_CURRENT_PIN };

    const update = await sbUpdatePassword(newPin);
    if (update.error) return { error: update.error };

    if (typeof localStorage !== "undefined") localStorage.setItem(PIN_KEY, newPin);
    setSession(await getSession());
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await sbSignOut();
    if (typeof localStorage !== "undefined") localStorage.removeItem(PIN_KEY);
    setSession(null);
    setStatus("idle");
  }, []);

  const openPinGate = useCallback(() => setPinGateOpen(true), []);
  const dismissPinGate = useCallback(() => setPinGateOpen(false), []);

  return (
    <SyncContext.Provider
      value={{
        configured: isSyncConfigured,
        session,
        status,
        lastSyncedAt,
        pinGateOpen: pinGateOpen && !session,
        openPinGate,
        dismissPinGate,
        signInWithPin,
        changePin,
        signOut,
        syncNow: runSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
