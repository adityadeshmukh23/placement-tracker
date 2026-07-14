"use client";

import { useEffect, useMemo, useState } from "react";
import { currentMonth, getShopsWithCurrentStatus } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { BackButton } from "@/app/components/BackButton";
import type { ShopWithStatus } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

type T = (key: TranslationKey) => string;

export default function RemindersPage() {
  const { t, language } = useTranslation();
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<ShopWithStatus[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getShopsWithCurrentStatus().then(setShops);
  }, []);

  const pending = useMemo(
    () => (shops ?? []).filter((s) => s.tenant && s.status !== "paid"),
    [shops]
  );
  const regularPending = useMemo(
    () => pending.filter((s) => s.tenant?.type === "regular"),
    [pending]
  );
  const familyPending = useMemo(
    () => pending.filter((s) => s.tenant?.type === "family"),
    [pending]
  );

  function toggle(shopId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  }

  function eligibleIds(list: ShopWithStatus[]): string[] {
    return list.filter((s) => s.tenant?.phone).map((s) => s.id);
  }

  function isAllSelected(list: ShopWithStatus[]): boolean {
    const ids = eligibleIds(list);
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }

  function toggleSelectAll(list: ShopWithStatus[]) {
    const ids = eligibleIds(list);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function openReminderFor(shop: ShopWithStatus) {
    if (!shop.tenant?.phone) return;
    const amountDue = Math.max(0, shop.monthlyRent - shop.collected);
    const message = buildReminderMessage({
      tenantName: shop.tenant.name,
      amountDue,
      shopName: shop.name,
      month: currentMonth(),
      language,
      tenantType: shop.tenant.type,
    });
    window.open(buildWhatsAppUrl(shop.tenant.phone, message), "_blank");
  }

  function handleStartSending() {
    const list = [...regularPending, ...familyPending].filter((s) =>
      selected.has(s.id)
    );
    if (list.length === 0) return;
    setQueue(list);
    setQueueIndex(0);
    setDone(false);
    openReminderFor(list[0]);
  }

  function handleSentNext() {
    if (!queue) return;
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      openReminderFor(queue[nextIndex]);
    } else {
      setDone(true);
    }
  }

  function resetToSelection() {
    setQueue(null);
    setQueueIndex(0);
    setDone(false);
    setSelected(new Set());
  }

  if (shops === null) {
    return <RemindersSkeleton />;
  }

  // Sending / progress mode.
  if (queue) {
    if (done) {
      return (
        <div className="flex flex-col gap-5">
          <BackButton fallbackHref="/" />
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <span className="text-4xl">✓</span>
            <p className="text-lg font-semibold">{t("remindersDone")}</p>
            <button
              type="button"
              onClick={resetToSelection}
              className="h-14 w-full max-w-xs rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)]"
            >
              {t("done")}
            </button>
          </div>
        </div>
      );
    }

    const current = queue[queueIndex];
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/" />
        <p className="text-base opacity-60">
          {queueIndex + 1} / {queue.length}
        </p>
        <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
          <p className="text-lg font-semibold">{current.name}</p>
          <p className="text-base opacity-60">
            {current.tenant?.name}
            {current.tenant?.type === "family" ? ` · ${t("family")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openReminderFor(current)}
          className="flex h-14 items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
        >
          💬 {t("openWhatsApp")}
        </button>
        <button
          type="button"
          onClick={handleSentNext}
          className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)]"
        >
          {t("sentNext")}
        </button>
        <button
          type="button"
          onClick={resetToSelection}
          className="h-14 rounded-lg text-base font-semibold text-red-700 dark:text-red-400"
        >
          {t("stop")}
        </button>
      </div>
    );
  }

  // Selection mode.
  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/" />

      <h2 className="text-xl font-semibold">{t("sendReminders")}</h2>

      {pending.length === 0 ? (
        <p className="py-8 text-center text-base opacity-60">
          {t("noPendingReminders")}
        </p>
      ) : (
        <>
          <ReminderSection
            title={t("regularTenantsPending")}
            shops={regularPending}
            selected={selected}
            onToggle={toggle}
            allSelected={isAllSelected(regularPending)}
            onToggleAll={() => toggleSelectAll(regularPending)}
            t={t}
          />
          <ReminderSection
            title={t("familyTenantsPending")}
            shops={familyPending}
            selected={selected}
            onToggle={toggle}
            allSelected={isAllSelected(familyPending)}
            onToggleAll={() => toggleSelectAll(familyPending)}
            t={t}
          />

          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handleStartSending}
            className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
          >
            {t("sendReminders")} ({selected.size})
          </button>
        </>
      )}
    </div>
  );
}

function ReminderSection({
  title,
  shops,
  selected,
  onToggle,
  allSelected,
  onToggleAll,
  t,
}: {
  title: string;
  shops: ShopWithStatus[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  t: T;
}) {
  if (shops.length === 0) return null;

  const hasEligible = shops.some((s) => s.tenant?.phone);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {hasEligible && (
          <button
            type="button"
            onClick={onToggleAll}
            className={`flex h-11 items-center text-base font-medium ${
              allSelected ? "opacity-100" : "opacity-60"
            }`}
          >
            {t("selectAll")}
          </button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
        {shops.map((shop) => {
          const hasPhone = Boolean(shop.tenant?.phone);
          const amountDue = Math.max(0, shop.monthlyRent - shop.collected);
          return (
            <li key={shop.id}>
              <label
                className={`flex min-h-[60px] items-center gap-3 px-4 py-3 ${
                  hasPhone ? "cursor-pointer" : "opacity-40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(shop.id)}
                  disabled={!hasPhone}
                  onChange={() => onToggle(shop.id)}
                  className="h-5 w-5 shrink-0"
                  aria-label={shop.name}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-base opacity-60">
                    {shop.tenant?.name} · ₹{amountDue.toLocaleString("en-IN")}
                  </span>
                  {!hasPhone && (
                    <span className="text-sm opacity-50">
                      {t("noPhoneOnFile")}
                    </span>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RemindersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-11 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      <div className="h-7 w-40 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]"
          />
        ))}
      </div>
    </div>
  );
}
