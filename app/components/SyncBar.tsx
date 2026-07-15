"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSync, type SyncUiStatus } from "@/lib/SyncContext";
import { useTranslation } from "@/lib/useTranslation";
import { formatLastSynced } from "@/lib/relativeTime";
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
  const { configured, session, status, lastSyncedAt, signOut, syncNow, openPinGate } =
    useSync();
  const { t, language } = useTranslation();

  // Re-render every 30s so the "last synced" label stays current even between
  // syncs (e.g. if a sync stalls, the time keeps counting up rather than freezing).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [session]);

  // When sync is not configured the app behaves exactly as before: no bar.
  if (!configured) return null;

  // Show the last-synced time on any settled status (not mid-sync).
  const showLastSynced = status !== "syncing" && lastSyncedAt != null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[.06] bg-[var(--background)] px-4 py-2 text-sm dark:border-white/[.1]">
      {session ? (
        <>
          <span className="flex min-h-[36px] items-center gap-2 opacity-80">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            <span>{t(STATUS_KEY[status])}</span>
            {showLastSynced && (
              <span className="opacity-60">
                · {formatLastSynced(lastSyncedAt, language)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={syncNow}
              disabled={status === "syncing"}
              aria-label={t("syncNow")}
              className="flex h-9 w-9 items-center justify-center rounded-full opacity-70 active:bg-black/[.05] disabled:opacity-40 dark:active:bg-white/[.08]"
            >
              <RefreshCw
                className={`h-4 w-4 ${status === "syncing" ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-[36px] items-center font-medium opacity-70"
            >
              {t("signOut")}
            </button>
          </div>
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
