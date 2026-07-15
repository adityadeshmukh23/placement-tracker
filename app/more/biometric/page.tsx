"use client";

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { isSyncConfigured } from "@/lib/supabase";
import { useTranslation } from "@/lib/useTranslation";
import { useBiometricAvailable } from "@/lib/useBiometricAvailable";
import {
  clearBiometric,
  hasBiometricRegistered,
  registerBiometric,
} from "@/lib/webauthn";
import { BackButton } from "@/app/components/BackButton";

export default function BiometricSettingsPage() {
  const { t } = useTranslation();
  const biometricAvailable = useBiometricAvailable();
  const [registered, setRegistered] = useState(() => hasBiometricRegistered());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!isSyncConfigured) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/more" />
        <h2 className="text-xl font-semibold">{t("biometricSettingsTitle")}</h2>
        <p className="py-8 text-center text-base opacity-60">
          {t("biometricRequiresSync")}
        </p>
      </div>
    );
  }

  if (!biometricAvailable) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/more" />
        <h2 className="text-xl font-semibold">{t("biometricSettingsTitle")}</h2>
        <p className="py-8 text-center text-base opacity-60">
          {t("biometricNotSupported")}
        </p>
      </div>
    );
  }

  async function handleToggle() {
    setBusy(true);
    setError(false);
    if (registered) {
      clearBiometric();
      setRegistered(false);
      setBusy(false);
      return;
    }
    const { error } = await registerBiometric();
    setBusy(false);
    if (error) {
      setError(true);
      return;
    }
    setRegistered(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/more" />

      <h2 className="text-xl font-semibold">{t("biometricSettingsTitle")}</h2>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/[.08] p-6 text-center dark:border-white/[.12]">
        <Fingerprint className="h-10 w-10 opacity-70" aria-hidden />
        <p className="text-base font-medium">
          {registered
            ? t("biometricEnabledStatus")
            : t("biometricNotEnabledStatus")}
        </p>
        <p className="text-sm opacity-60">{t("thisDeviceOnly")}</p>
      </div>

      {error && (
        <p className="text-base text-red-600 dark:text-red-400">
          {t("biometricRegisterFailed")}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={handleToggle}
        className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
      >
        {busy
          ? t("loading")
          : registered
            ? t("turnOffBiometric")
            : t("turnOnBiometric")}
      </button>
    </div>
  );
}
