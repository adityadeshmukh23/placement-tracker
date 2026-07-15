"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, IndianRupee, Plus, Trash2 } from "lucide-react";
import {
  currentMonth,
  deletePayment,
  getShopsWithCurrentStatus,
  getUsualAmount,
  isShopFullyPaid,
  recordPayment,
} from "@/lib/db";
import { SYNCED_EVENT } from "@/lib/sync";
import { useTranslation } from "@/lib/useTranslation";
import { StatusPill } from "@/app/components/StatusPill";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { BackButton } from "@/app/components/BackButton";
import { RentScopeToggle } from "@/app/components/RentScopeToggle";
import { deletePaymentMessage } from "@/lib/confirmMessages";
import type { Payment, ShopWithStatus, TenantType } from "@/lib/types";

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

/**
 * "quickMarked" is undo-able (a few seconds' safety window after the one-tap
 * mark-as-paid shortcut, since accidental taps are the concern there).
 * "paymentSaved" (from the full Add Payment form) and "alreadyPaid" are plain
 * confirmations with no undo.
 */
type Toast =
  | { kind: "quickMarked"; shopName: string; paymentId: string }
  | { kind: "paymentSaved"; shopName: string }
  | { kind: "alreadyPaid"; shopName: string };

export default function ShopsPage() {
  return (
    <Suspense fallback={null}>
      <ShopsList />
    </Suspense>
  );
}

function ShopsList() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  // Shop Rent (regular tenants) is the default view, matching the Dashboard's
  // convention — Family Rent is one tap away via the same toggle.
  const [scope, setScope] = useState<TenantType>("regular");
  const [query, setQuery] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Payment | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  function showToast(next: Toast, durationMs: number) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(next);
    toastTimeoutRef.current = setTimeout(() => setToast(null), durationMs);
  }

  useEffect(() => {
    const refresh = () => getShopsWithCurrentStatus().then(setShops);
    refresh();
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const paymentSaved = searchParams.get("paymentSaved");
    if (!paymentSaved || !shops) return;
    const shop = shops.find((s) => s.id === paymentSaved);
    if (!shop) return;
    showToast({ kind: "paymentSaved", shopName: shop.name }, 3000);
    router.replace("/shops");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, shops]);

  async function handleMarkAsPaid(shop: ShopWithStatus) {
    if (!shop.tenant || markingId !== null) return;
    setMarkingId(shop.id);

    // Re-check fresh (not the possibly-stale `shop` in this closure) so a
    // stray double-tap or a change that just synced in can't create a
    // duplicate payment for a month that's already fully paid.
    if (await isShopFullyPaid(shop.id)) {
      setShops(await getShopsWithCurrentStatus());
      showToast({ kind: "alreadyPaid", shopName: shop.name }, 3000);
      setMarkingId(null);
      return;
    }

    const amount = await getUsualAmount(shop.id);
    const paymentId = await recordPayment({
      shopId: shop.id,
      tenantId: shop.tenant.id,
      amount,
      datePaid: new Date(),
      paymentMode: "cash",
    });
    setShops(await getShopsWithCurrentStatus());
    showToast({ kind: "quickMarked", shopName: shop.name, paymentId }, 5000);
    setMarkingId(null);
  }

  async function handleUndo() {
    if (!toast || toast.kind !== "quickMarked") return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    await deletePayment(toast.paymentId);
    setToast(null);
    setShops(await getShopsWithCurrentStatus());
  }

  async function handleConfirmUndoPayment() {
    if (!pendingUndo) return;
    setUndoBusy(true);
    await deletePayment(pendingUndo.id);
    setPendingUndo(null);
    setUndoBusy(false);
    setShops(await getShopsWithCurrentStatus());
  }

  // Vacant shops have no tenant type to belong to, so they're shown regardless
  // of the selected scope — only occupied shops of the *other* rent type are
  // filtered out. Matches the same convention used on the Dashboard.
  const scopedShops = useMemo(
    () => (shops ?? []).filter((s) => s.tenant === null || s.tenant.type === scope),
    [shops, scope]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scopedShops;
    return scopedShops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(q) ||
        (shop.tenant?.name.toLowerCase().includes(q) ?? false)
    );
  }, [scopedShops, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShopWithStatus[]>();
    for (const shop of filtered) {
      const list = map.get(shop.area) ?? [];
      list.push(shop);
      map.set(shop.area, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div
          className={`fixed inset-x-4 top-16 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 text-base font-medium text-white shadow-lg ${
            toast.kind === "alreadyPaid" ? "bg-slate-600" : "bg-green-600"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {toast.kind !== "alreadyPaid" && (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            )}
            <span className="truncate">
              {toast.shopName} —{" "}
              {toast.kind === "alreadyPaid"
                ? t("alreadyPaidThisMonth")
                : t("paymentRecorded")}
            </span>
          </span>
          {toast.kind === "quickMarked" && (
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {t("undo")}
            </button>
          )}
        </div>
      )}

      <BackButton fallbackHref="/" />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("allShops")}</h2>
        <Link
          href="/shops/new"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)]"
        >
          <Plus className="h-4 w-4" />
          {t("addShop")}
        </Link>
      </div>

      {shops !== null && shops.length > 0 && (
        <RentScopeToggle scope={scope} onChange={setScope} />
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        className="h-12 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]"
      />

      {shops === null && <ShopsListSkeleton />}

      {shops !== null && shops.length === 0 && (
        <p className="py-8 text-center text-base opacity-60">{t("noShopsYet")}</p>
      )}

      {shops !== null && shops.length > 0 && grouped.length === 0 && (
        <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>
      )}

      {grouped.map(([area, areaShops]) => (
        <details
          key={area}
          open
          className="rounded-lg border border-black/[.08] dark:border-white/[.12]"
        >
          <summary className="flex min-h-[48px] cursor-pointer select-none items-center px-4 py-3 text-base font-semibold">
            {area}
            <span className="ml-2 text-base font-normal opacity-50">
              ({areaShops.length})
            </span>
          </summary>
          <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
            {areaShops.map((shop) => (
              <li
                key={shop.id}
                className="flex min-h-[60px] items-center gap-2 py-2 pl-4 pr-3"
              >
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-md py-1 active:bg-black/[.03] dark:active:bg-white/[.05]"
                >
                  <span className="truncate text-base font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-base opacity-60">
                    {shop.tenant ? shop.tenant.name : t("vacant")}
                  </span>
                </Link>

                <StatusPill shop={shop} />

                {shop.tenant && shop.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsPaid(shop)}
                    disabled={markingId === shop.id}
                    aria-label={t("markAsPaid")}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] disabled:opacity-40 dark:border-white/[.15]"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}

                {shop.tenant &&
                  shop.status === "paid" &&
                  shop.payments.length > 0 &&
                  (shop.payments.length === 1 ? (
                    <button
                      type="button"
                      onClick={() => setPendingUndo(shop.payments[0])}
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

                {shop.tenant && (
                  <Link
                    href={`/payments/new?shopId=${shop.id}&from=/shops`}
                    aria-label={t("addPayment")}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] dark:border-white/[.15]"
                  >
                    <IndianRupee className="h-5 w-5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}

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

function ShopsListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((g) => (
        <div
          key={g}
          className="rounded-lg border border-black/[.08] dark:border-white/[.12]"
        >
          <div className="flex min-h-[48px] items-center px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.08]">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex min-h-[60px] items-center gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
                  <div className="h-4 w-20 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
                </div>
                <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-black/[.06] dark:bg-white/[.08]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
