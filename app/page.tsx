"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  MessageCircle,
  Phone,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { currentMonth, deletePayment, getShopsWithCurrentStatus } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { useMoneyVisibility } from "@/lib/useMoneyVisibility";
import { SYNCED_EVENT } from "@/lib/sync";
import { useTranslation } from "@/lib/useTranslation";
import { StatusPill } from "@/app/components/StatusPill";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { RentScopeToggle } from "@/app/components/RentScopeToggle";
import { deletePaymentMessage } from "@/lib/confirmMessages";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import type { Payment, PaymentStatus, ShopWithStatus, TenantType } from "@/lib/types";
import type { Language, TranslationKey } from "@/lib/translations";

type ViewMode = "month" | "all";
type T = (key: TranslationKey) => string;

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

const STATUS_PRIORITY: Record<PaymentStatus, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  // Shop Rent (regular tenants) is the default landing view — the primary
  // business — with Family Rent one tap away via the toggle.
  const [scope, setScope] = useState<TenantType>("regular");
  const [pendingUndo, setPendingUndo] = useState<Payment | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [paymentSavedToast, setPaymentSavedToast] = useState<string | null>(null);
  const [moneyVisible, toggleMoneyVisible] = useMoneyVisibility();

  useEffect(() => {
    const refresh = () => getShopsWithCurrentStatus().then(setShops);
    refresh();
    // Refresh when a background sync pulls in changes from the other device.
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, []);

  // Shows the same "Payment recorded" confirmation as the Shops list does,
  // for a payment whose Add Payment flow returned here (e.g. it was started
  // from a Dashboard row) instead of always landing on /shops.
  useEffect(() => {
    const paymentSaved = searchParams.get("paymentSaved");
    if (!paymentSaved || !shops) return;
    const shop = shops.find((s) => s.id === paymentSaved);
    if (!shop) return;
    setPaymentSavedToast(shop.name);
    router.replace("/");
    const timeout = setTimeout(() => setPaymentSavedToast(null), 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, shops]);

  async function handleConfirmUndoPayment() {
    if (!pendingUndo) return;
    setUndoBusy(true);
    await deletePayment(pendingUndo.id);
    setPendingUndo(null);
    setUndoBusy(false);
    setShops(await getShopsWithCurrentStatus());
  }

  // Vacant shops have no tenant type to belong to, so they're always shown
  // regardless of the selected scope — only occupied shops of the *other*
  // rent type are filtered out.
  const scopedShops = useMemo(
    () => (shops ?? []).filter((s) => s.tenant === null || s.tenant.type === scope),
    [shops, scope]
  );

  const occupied = useMemo(
    () => scopedShops.filter((s) => s.tenant !== null),
    [scopedShops]
  );
  const vacant = useMemo(
    () => scopedShops.filter((s) => s.tenant === null),
    [scopedShops]
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
      return [...scopedShops].sort(
        (a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)
      );
    }
    return [
      ...[...occupied].sort(
        (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
      ),
      ...vacant,
    ];
  }, [scopedShops, viewMode, occupied, vacant]);

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
      {paymentSavedToast && (
        <div className="fixed inset-x-4 top-16 z-30 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-medium text-white shadow-lg">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            {paymentSavedToast} — {t("paymentRecorded")}
          </span>
        </div>
      )}

      <RentScopeToggle scope={scope} onChange={setScope} />

      <SummaryCard
        totalCollected={summary.totalCollected}
        totalPending={summary.totalPending}
        paidCount={summary.paidCount}
        unpaidCount={summary.unpaidCount}
        moneyVisible={moneyVisible}
        onToggleMoneyVisible={toggleMoneyVisible}
        t={t}
      />

      <ViewToggle mode={viewMode} onChange={setViewMode} t={t} />

      {summary.unpaidCount > 0 && (
        <Link
          href="/reminders"
          className="flex h-14 items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
        >
          <MessageCircle className="h-5 w-5" />
          {t("sendReminders")} ({summary.unpaidCount})
        </Link>
      )}

      <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
        {listShops.map((shop) => (
          <ShopRow
            key={shop.id}
            shop={shop}
            t={t}
            language={language}
            onRequestUndo={setPendingUndo}
          />
        ))}
      </ul>

      {pendingUndo && (
        <ConfirmDialog
          open={pendingUndo !== null}
          title={t("areYouSure")}
          message={deletePaymentMessage(
            pendingUndo.amount,
            formatMonthLabel(currentMonth(), language === "mr" ? "mr-IN" : "en-IN"),
            language
          )}
          confirmLabel={t("delete")}
          busy={undoBusy}
          onConfirm={handleConfirmUndoPayment}
          onCancel={() => setPendingUndo(null)}
        />
      )}
    </div>
  );
}

function OnboardingEmptyState({ t }: { t: T }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-black/[.15] px-6 py-12 text-center dark:border-white/[.2]">
      <Store className="h-12 w-12" aria-hidden />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("welcomeTitle")}</h2>
        <p className="text-base opacity-70">{t("welcomeBody")}</p>
      </div>
      <Link
        href="/shops/new"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-6 text-base font-semibold text-[var(--background)]"
      >
        <Plus className="h-5 w-5" />
        {t("addShop")}
      </Link>
    </div>
  );
}

function SummaryCard({
  totalCollected,
  totalPending,
  paidCount,
  unpaidCount,
  moneyVisible,
  onToggleMoneyVisible,
  t,
}: {
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  unpaidCount: number;
  moneyVisible: boolean;
  onToggleMoneyVisible: () => void;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-medium opacity-60">{t("thisMonth")}</p>
        <button
          type="button"
          onClick={onToggleMoneyVisible}
          aria-label={moneyVisible ? t("hideAmounts") : t("showAmounts")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-60"
        >
          {moneyVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("totalCollected")}
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formatMoney(totalCollected, moneyVisible)}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("totalPending")}
          </p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {formatMoney(totalPending, moneyVisible)}
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
  onRequestUndo,
}: {
  shop: ShopWithStatus;
  t: T;
  language: Language;
  onRequestUndo: (payment: Payment) => void;
}) {
  const href = shop.tenant
    ? `/payments/new?shopId=${shop.id}&from=/`
    : `/shops/${shop.id}`;

  const showReminder = shop.tenant && shop.status !== "paid" && shop.tenant.phone;
  const showCall = shop.tenant != null;

  function handleSendReminder() {
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
      {showCall && (
        <a
          href={shop.tenant?.phone ? `tel:${shop.tenant.phone}` : undefined}
          aria-label={t("call")}
          aria-disabled={!shop.tenant?.phone}
          title={shop.tenant?.phone ? undefined : t("noPhoneOnFile")}
          onClick={(e) => {
            if (!shop.tenant?.phone) e.preventDefault();
          }}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
            shop.tenant?.phone
              ? "border-black/[.12] dark:border-white/[.15]"
              : "border-black/[.08] opacity-30 dark:border-white/[.08]"
          }`}
        >
          <Phone className="h-5 w-5" />
        </a>
      )}
      {showReminder && (
        <button
          type="button"
          onClick={handleSendReminder}
          aria-label={t("sendReminder")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] dark:border-white/[.15]"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}
      {shop.tenant &&
        shop.status === "paid" &&
        shop.payments.length > 0 &&
        (shop.payments.length === 1 ? (
          <button
            type="button"
            onClick={() => onRequestUndo(shop.payments[0])}
            aria-label={t("removeThisPayment")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] dark:border-white/[.15]"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : (
          <Link
            href={`/shops/${shop.id}`}
            aria-label={t("removeThisPayment")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] dark:border-white/[.15]"
          >
            <Trash2 className="h-5 w-5" />
          </Link>
        ))}
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
