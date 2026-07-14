"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { currentMonth, getShopsWithCurrentStatus } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { StatusPill } from "@/app/components/StatusPill";
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  getOrAskLandlordName,
} from "@/lib/whatsapp";
import type { PaymentStatus, ShopWithStatus } from "@/lib/types";
import type { Language, TranslationKey } from "@/lib/translations";

type ViewMode = "month" | "all";
type T = (key: TranslationKey) => string;

const STATUS_PRIORITY: Record<PaymentStatus, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
};

export default function Home() {
  const { t, language } = useTranslation();
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  useEffect(() => {
    getShopsWithCurrentStatus().then(setShops);
  }, []);

  const occupied = useMemo(
    () => (shops ?? []).filter((s) => s.tenant !== null),
    [shops]
  );
  const vacant = useMemo(
    () => (shops ?? []).filter((s) => s.tenant === null),
    [shops]
  );

  const summary = useMemo(() => {
    const totalDue = occupied.reduce((sum, s) => sum + s.monthlyRent, 0);
    const totalCollected = occupied.reduce((sum, s) => sum + s.collected, 0);
    const paidCount = occupied.filter((s) => s.status === "paid").length;
    return {
      totalCollected,
      totalPending: totalDue - totalCollected,
      paidCount,
      unpaidCount: occupied.length - paidCount,
    };
  }, [occupied]);

  const listShops = useMemo(() => {
    if (viewMode === "all") {
      return [...(shops ?? [])].sort(
        (a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)
      );
    }
    return [
      ...[...occupied].sort(
        (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
      ),
      ...vacant,
    ];
  }, [shops, viewMode, occupied, vacant]);

  if (shops === null) {
    return (
      <div className="flex flex-col gap-5">
        <SummaryCardSkeleton />
        <ListSkeleton />
      </div>
    );
  }

  if (shops.length === 0) {
    return <OnboardingEmptyState t={t} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SummaryCard
        totalCollected={summary.totalCollected}
        totalPending={summary.totalPending}
        paidCount={summary.paidCount}
        unpaidCount={summary.unpaidCount}
        t={t}
      />

      <div className="flex items-center gap-2">
        <ViewToggle mode={viewMode} onChange={setViewMode} t={t} />
        <Link
          href="/shops"
          aria-label={t("search")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/[.12] text-xl dark:border-white/[.15]"
        >
          🔍
        </Link>
        <Link
          href="/reports"
          aria-label={t("reports")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/[.12] text-xl dark:border-white/[.15]"
        >
          📊
        </Link>
      </div>

      <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
        {listShops.map((shop) => (
          <ShopRow key={shop.id} shop={shop} t={t} language={language} />
        ))}
      </ul>
    </div>
  );
}

function OnboardingEmptyState({ t }: { t: T }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-black/[.15] px-6 py-12 text-center dark:border-white/[.2]">
      <span className="text-5xl" aria-hidden>
        🏠
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("welcomeTitle")}</h2>
        <p className="text-base opacity-70">{t("welcomeBody")}</p>
      </div>
      <Link
        href="/shops/new"
        className="flex h-14 w-full items-center justify-center rounded-lg bg-[var(--foreground)] px-6 text-base font-semibold text-[var(--background)]"
      >
        + {t("addShop")}
      </Link>
    </div>
  );
}

function SummaryCard({
  totalCollected,
  totalPending,
  paidCount,
  unpaidCount,
  t,
}: {
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  unpaidCount: number;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
      <p className="mb-3 text-base font-medium opacity-60">{t("thisMonth")}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("totalCollected")}
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("totalPending")}
          </p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            ₹{totalPending.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-black/[.06] pt-4 text-base dark:border-white/[.08]">
        <span className="font-semibold text-green-700 dark:text-green-400">
          {paidCount} {t("paid")}
        </span>
        <span className="opacity-30">|</span>
        <span className="font-semibold text-red-700 dark:text-red-400">
          {unpaidCount} {t("unpaid")}
        </span>
      </div>
    </section>
  );
}

function SummaryCardSkeleton() {
  return (
    <section className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
      <div className="mb-3 h-5 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-9 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-9 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      </div>
      <div className="mt-4 h-5 w-40 animate-pulse rounded bg-black/[.06] pt-0 dark:bg-white/[.08]" />
    </section>
  );
}

function ViewToggle({
  mode,
  onChange,
  t,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  t: T;
}) {
  return (
    <div className="flex flex-1 rounded-lg border border-black/[.12] p-1 dark:border-white/[.15]">
      {(["month", "all"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`h-11 flex-1 rounded-md text-base font-medium ${
            mode === m
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "opacity-60"
          }`}
        >
          {m === "month" ? t("thisMonth") : t("allShops")}
        </button>
      ))}
    </div>
  );
}

function ShopRow({
  shop,
  t,
  language,
}: {
  shop: ShopWithStatus;
  t: T;
  language: Language;
}) {
  const href = shop.tenant
    ? `/payments/new?shopId=${shop.id}`
    : `/shops/${shop.id}`;

  const showReminder = shop.tenant && shop.status !== "paid" && shop.tenant.phone;

  function handleSendReminder() {
    if (!shop.tenant?.phone) return;
    const landlordName = getOrAskLandlordName(language);
    const amountDue = Math.max(0, shop.monthlyRent - shop.collected);
    const message = buildReminderMessage({
      tenantName: shop.tenant.name,
      amountDue,
      shopName: shop.name,
      month: currentMonth(),
      landlordName,
      language,
    });
    window.open(buildWhatsAppUrl(shop.tenant.phone, message), "_blank");
  }

  return (
    <li className="flex min-h-[60px] items-center gap-2 py-2 pl-4 pr-3">
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-md py-1 active:bg-black/[.03] dark:active:bg-white/[.05]"
      >
        <span className="truncate text-base font-medium">{shop.name}</span>
        <span className="truncate text-base opacity-60">
          {shop.tenant ? shop.tenant.name : t("vacant")}
          {shop.tenant?.type === "family" ? ` · ${t("family")}` : ""}
        </span>
      </Link>
      <StatusPill shop={shop} />
      {showReminder && (
        <button
          type="button"
          onClick={handleSendReminder}
          aria-label={t("sendReminder")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[.12] text-xl dark:border-white/[.15]"
        >
          💬
        </button>
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="h-4 w-32 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
            <div className="h-4 w-20 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          </div>
          <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ))}
    </div>
  );
}
