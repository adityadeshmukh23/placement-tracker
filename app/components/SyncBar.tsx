"use client";

import { useSync, type SyncUiStatus } from "@/lib/SyncContext";
import { useTranslation } from "@/lib/useTranslation";
import type { TranslationKey } from "@/lib/translations";

const STATUS_KEY: Record<SyncUiStatus, TranslationKey> = {
  idle: "cloudSync",
  syncing: "syncing",
  synced: "synced",
  offline: "syncOffline",
  error: "syncError",
};

const STATUS_DOT: Record<SyncUiStatus, string> = {
  idle: "bg-black/30 dark:bg-white/30",
  syncing: "bg-amber-500 animate-pulse",
  synced: "bg-green-600",
  offline: "bg-black/30 dark:bg-white/30",
  error: "bg-red-600",
};

export function SyncBar() {
  const { configured, session, status, signOut, syncNow, openPinGate } =
    useSync();
  const { t } = useTranslation();

  // When sync is not configured the app behaves exactly as before: no bar.
  if (!configured) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[.06] bg-[var(--background)] px-4 py-2 text-sm dark:border-white/[.1]">
      {session ? (
        <>
          <button
            type="button"
            onClick={syncNow}
            className="flex min-h-[36px] items-center gap-2 opacity-80"
            aria-label={t("syncNow")}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            <span>{t(STATUS_KEY[status])}</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-[36px] items-center font-medium opacity-70"
          >
            {t("signOut")}
          </button>
        </>
      ) : (
        <>
          <span className="flex items-center gap-2 opacity-70">
            <span className="h-2 w-2 rounded-full bg-black/30 dark:bg-white/30" />
            {t("signInToSync")}
          </span>
          <button
            type="button"
            onClick={openPinGate}
            className="flex min-h-[36px] items-center rounded-lg bg-[var(--foreground)] px-3 font-semibold text-[var(--background)]"
          >
            {t("signIn")}
          </button>
        </>
      )}
    </div>
  );
}
