"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { getRememberedPin } from "@/lib/SyncContext";

/**
 * Lightweight PIN re-entry gate for a single sensitive document — not a full
 * app logout/relogin. Verifies against the PIN already remembered on this
 * device (set by the original sign-in), so it works offline and doesn't
 * touch the app's actual session.
 */
export function SensitivePinModal({
  open,
  onCancel,
  onUnlock,
}: {
  open: boolean;
  onCancel: () => void;
  onUnlock: () => void;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  if (!open) return null;

  function handleSubmit() {
    const remembered = getRememberedPin();
    if (pin.trim().length > 0 && remembered && pin.trim() === remembered) {
      setPin("");
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  }

  function handleCancel() {
    setPin("");
    setError(false);
    onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-[var(--background)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{t("enterPinToView")}</h3>
        <p className="mt-1 text-base opacity-70">{t("sensitiveDocPinPrompt")}</p>

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
            if (e.key === "Enter") handleSubmit();
          }}
          aria-label={t("pin")}
          className="mt-4 h-14 w-full rounded-lg border border-black/[.15] bg-transparent px-4 text-center text-2xl tracking-[0.3em] focus:border-black/[.4] focus:outline-none dark:border-white/[.2] dark:focus:border-white/[.5]"
        />

        {error && (
          <p className="mt-2 text-base text-red-600 dark:text-red-400">
            {t("wrongPin")}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={pin.trim().length === 0}
            onClick={handleSubmit}
            className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
          >
            {t("unlock")}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-14 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
