"use client";

import { useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { useSync, getRememberedPin } from "@/lib/SyncContext";
import { useTranslation } from "@/lib/useTranslation";
import { useBiometricAvailable } from "@/lib/useBiometricAvailable";
import {
  authenticateBiometric,
  dismissEnablePrompt,
  hasBiometricRegistered,
  registerBiometric,
  wasEnablePromptDismissed,
} from "@/lib/webauthn";

/**
 * Full-screen prompt for the shared household PIN, shown on first launch (and
 * any time this device is configured for sync but not yet unlocked). Entering
 * the correct PIN signs the device into the shared account and never asks
 * again (the session + PIN are remembered). "Continue without sync" lets the
 * app be used offline-only — important when there's no signal to sign in.
 *
 * If this device has biometrics enabled, it tries that first; the PIN field
 * is always present as a fallback. After a successful *manual* PIN entry, a
 * one-time prompt offers to turn biometrics on for next time.
 */
export function PinGate() {
  const { pinGateOpen, signInWithPin, dismissPinGate } = useSync();
  const { t } = useTranslation();
  const biometricAvailable = useBiometricAvailable();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(() =>
    hasBiometricRegistered()
  );
  const [enablePromptOpen, setEnablePromptOpen] = useState(false);
  const [enableBusy, setEnableBusy] = useState(false);
  const [enableError, setEnableError] = useState(false);

  if (!pinGateOpen && !enablePromptOpen) return null;

  function maybeOfferEnableBiometric() {
    if (
      biometricAvailable &&
      !hasBiometricRegistered() &&
      !wasEnablePromptDismissed()
    ) {
      setEnablePromptOpen(true);
    }
  }

  async function handleUnlock() {
    if (busy || pin.trim().length === 0) return;
    setBusy(true);
    setError(false);
    const { error } = await signInWithPin(pin.trim());
    if (error) {
      setError(true);
      setBusy(false);
      setPin("");
    } else {
      setBusy(false);
      maybeOfferEnableBiometric();
    }
  }

  async function handleBiometricUnlock() {
    if (busy) return;
    setBusy(true);
    setBiometricError(null);
    setError(false);
    const ok = await authenticateBiometric();
    if (!ok) {
      setBiometricError(t("biometricAuthFailed"));
      setBusy(false);
      return;
    }
    const remembered = getRememberedPin();
    if (!remembered) {
      setBiometricError(t("pinMayBeOutdated"));
      setBusy(false);
      return;
    }
    const { error } = await signInWithPin(remembered);
    if (error) {
      setBiometricError(t("pinMayBeOutdated"));
      setBusy(false);
    }
    // On success the provider clears pinGateOpen and this unmounts.
  }

  async function handleEnableBiometric() {
    setEnableBusy(true);
    setEnableError(false);
    const { error } = await registerBiometric();
    setEnableBusy(false);
    if (error) {
      setEnableError(true);
      return;
    }
    setBiometricRegistered(true);
    setEnablePromptOpen(false);
  }

  function handleDismissEnablePrompt() {
    dismissEnablePrompt();
    setEnablePromptOpen(false);
  }

  if (enablePromptOpen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Fingerprint className="h-12 w-12" aria-hidden />
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold">
              {t("enableBiometricTitle")}
            </h2>
            <p className="text-base opacity-70">{t("enableBiometricBody")}</p>
          </div>

          {enableError && (
            <p className="text-base text-red-600 dark:text-red-400">
              {t("biometricRegisterFailed")}
            </p>
          )}

          <button
            type="button"
            disabled={enableBusy}
            onClick={handleEnableBiometric}
            className="h-14 w-full rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
          >
            {enableBusy ? t("loading") : t("turnOnBiometric")}
          </button>

          <button
            type="button"
            disabled={enableBusy}
            onClick={handleDismissEnablePrompt}
            className="flex h-11 items-center text-base font-medium opacity-60 disabled:opacity-30"
          >
            {t("notNow")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Lock className="h-12 w-12" aria-hidden />
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold">{t("enterPin")}</h2>
          <p className="text-base opacity-70">{t("pinGateSubtitle")}</p>
        </div>

        {biometricAvailable && biometricRegistered && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleBiometricUnlock}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-black/[.15] text-base font-semibold disabled:opacity-40 dark:border-white/[.2]"
            >
              <Fingerprint className="h-5 w-5" aria-hidden />
              {busy ? t("loading") : t("biometricUnlock")}
            </button>
            {biometricError && (
              <p className="text-base text-red-600 dark:text-red-400">
                {biometricError}
              </p>
            )}
            <p className="text-sm font-medium uppercase tracking-wide opacity-50">
              {t("usePinInstead")}
            </p>
          </>
        )}

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={!biometricRegistered}
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
