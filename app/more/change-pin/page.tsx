"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useSync, WRONG_CURRENT_PIN } from "@/lib/SyncContext";
import { isSyncConfigured } from "@/lib/supabase";
import { useTranslation } from "@/lib/useTranslation";
import { FormField } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";

const MIN_PIN_LENGTH = 6;

const pinInputClass =
  "h-14 w-full rounded-lg border border-black/[.15] bg-transparent px-4 text-center text-2xl tracking-[0.3em] focus:border-black/[.4] focus:outline-none dark:border-white/[.2] dark:focus:border-white/[.5]";

export default function ChangePinPage() {
  const { t } = useTranslation();
  const { changePin } = useSync();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = newPin.length > 0 && newPin.length < MIN_PIN_LENGTH;
  const mismatch = confirmPin.length > 0 && newPin !== confirmPin;

  const canSave =
    currentPin.trim().length > 0 &&
    newPin.length >= MIN_PIN_LENGTH &&
    newPin === confirmPin &&
    !saving;

  function clearError() {
    if (error) setError(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await changePin(currentPin.trim(), newPin);
    setSaving(false);
    if (result.error === WRONG_CURRENT_PIN) {
      setError(t("wrongCurrentPin"));
      return;
    }
    if (result.error) {
      setError(t("genericChangePinError"));
      return;
    }
    setDone(true);
  }

  if (!isSyncConfigured) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/more" />
        <h2 className="text-xl font-semibold">{t("changePin")}</h2>
        <p className="py-8 text-center text-base opacity-60">
          {t("changePinRequiresSync")}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/more" />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-600/20 bg-green-600/[.06] p-6 text-center dark:border-green-400/20">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          <p className="text-base font-semibold text-green-700 dark:text-green-400">
            {t("pinChanged")}
          </p>
          <p className="text-base opacity-80">{t("pinChangedReminder")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/more" />

      <h2 className="text-xl font-semibold">{t("changePin")}</h2>

      <FormField label={t("currentPin")}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={currentPin}
          onChange={(e) => {
            setCurrentPin(e.target.value);
            clearError();
          }}
          className={pinInputClass}
        />
      </FormField>

      <FormField label={t("newPin")}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={newPin}
          onChange={(e) => {
            setNewPin(e.target.value);
            clearError();
          }}
          className={pinInputClass}
        />
      </FormField>
      {tooShort && (
        <p className="-mt-3 text-sm text-red-600 dark:text-red-400">
          {t("pinTooShort")}
        </p>
      )}

      <FormField label={t("confirmNewPin")}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={confirmPin}
          onChange={(e) => {
            setConfirmPin(e.target.value);
            clearError();
          }}
          className={pinInputClass}
        />
      </FormField>
      {mismatch && (
        <p className="-mt-3 text-sm text-red-600 dark:text-red-400">
          {t("pinsDontMatch")}
        </p>
      )}

      {error && (
        <p className="text-base text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={handleSave}
        className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
      >
        {saving ? t("loading") : t("save")}
      </button>
    </div>
  );
}
