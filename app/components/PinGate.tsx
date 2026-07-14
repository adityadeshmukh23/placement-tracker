"use client";

import { useState } from "react";
import { useSync } from "@/lib/SyncContext";
import { useTranslation } from "@/lib/useTranslation";

/**
 * Full-screen prompt for the shared household PIN, shown on first launch (and
 * any time this device is configured for sync but not yet unlocked). Entering
 * the correct PIN signs the device into the shared account and never asks
 * again (the session + PIN are remembered). "Continue without sync" lets the
 * app be used offline-only — important when there's no signal to sign in.
 */
export function PinGate() {
  const { pinGateOpen, signInWithPin, dismissPinGate } = useSync();
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!pinGateOpen) return null;

  async function handleUnlock() {
    if (busy || pin.trim().length === 0) return;
    setBusy(true);
    setError(false);
    const { error } = await signInWithPin(pin.trim());
    if (error) {
      setError(true);
      setBusy(false);
      setPin("");
    }
    // On success the provider clears pinGateOpen and this unmounts.
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <span className="text-5xl" aria-hidden>
          🔒
        </span>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold">{t("enterPin")}</h2>
          <p className="text-base opacity-70">{t("pinGateSubtitle")}</p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUnlock();
          }}
          aria-label={t("pin")}
          className="h-14 w-full rounded-lg border border-black/[.15] bg-transparent px-4 text-center text-2xl tracking-[0.3em] focus:border-black/[.4] focus:outline-none dark:border-white/[.2] dark:focus:border-white/[.5]"
        />

        {error && (
          <p className="text-base text-red-600 dark:text-red-400">
            {t("wrongPin")}
          </p>
        )}

        <button
          type="button"
          disabled={busy || pin.trim().length === 0}
          onClick={handleUnlock}
          className="h-14 w-full rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
        >
          {busy ? t("loading") : t("unlock")}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={dismissPinGate}
          className="flex h-11 items-center text-base font-medium opacity-60 disabled:opacity-30"
        >
          {t("continueOffline")}
        </button>
      </div>
    </div>
  );
}
