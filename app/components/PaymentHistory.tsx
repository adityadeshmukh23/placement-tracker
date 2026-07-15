"use client";

import { useEffect, useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import { deletePayment, getShopLedger } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { deletePaymentMessage } from "@/lib/confirmMessages";
import { buildShareOnlyWhatsAppUrl } from "@/lib/whatsapp";
import type { LedgerRow, Payment, ShopLedger, Tenant } from "@/lib/types";
import type { Language, TranslationKey } from "@/lib/translations";

type T = (key: TranslationKey) => string;

export function PaymentHistory({
  shopId,
  shopName,
  tenant,
}: {
  shopId: string;
  shopName: string;
  tenant: Tenant | null;
}) {
  const { t, language } = useTranslation();
  const [ledger, setLedger] = useState<ShopLedger | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!tenant) return;
    const result = await getShopLedger(shopId, tenant.createdAt);
    setLedger(result);
    setYear((prev) => prev ?? result.years[0] ?? null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, tenant]);

  async function handleConfirmDelete() {
    if (!pendingDelete?.id) return;
    setBusy(true);
    await deletePayment(pendingDelete.id);
    setPendingDelete(null);
    setBusy(false);
    await refresh();
  }

  if (!tenant) {
    return (
      <section className="rounded-lg border border-dashed border-black/[.15] p-4 text-center dark:border-white/[.2]">
        <h3 className="mb-1 text-base font-semibold">{t("history")}</h3>
        <p className="text-base opacity-50">{t("noTenantCurrently")}</p>
      </section>
    );
  }

  const filteredRows = (ledger?.rows ?? []).filter(
    (row) => year !== null && monthOf(row).startsWith(year)
  );

  const yearTotal = filteredRows.reduce(
    (sum, row) => (row.kind === "payment" ? sum + row.payment.amount : sum),
    0
  );

  const locale = language === "mr" ? "mr-IN" : "en-IN";

  async function handleShare() {
    if (!tenant) return;
    const text = buildLedgerShareText({
      shopName,
      tenantName: tenant.name,
      year: year ?? "",
      rows: filteredRows,
      total: yearTotal,
      locale,
      t,
    });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
    } else {
      window.open(buildShareOnlyWhatsAppUrl(text), "_blank");
    }
  }

  return (
    <section className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("history")}</h3>
        <div className="flex items-center gap-2">
          {ledger && ledger.years.length > 0 && (
            <select
              value={year ?? ""}
              onChange={(e) => setYear(e.target.value)}
              className="h-11 rounded-md border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
            >
              {ledger.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {filteredRows.length > 0 && (
            <button
              type="button"
              onClick={handleShare}
              aria-label={t("share")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/[.12] dark:border-white/[.15]"
            >
              <Share2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {ledger === null ? (
        <LedgerSkeleton />
      ) : filteredRows.length === 0 ? (
        <p className="py-4 text-center text-base opacity-50">{t("noResults")}</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between rounded-md bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
            <span className="text-base opacity-60">
              {t("totalCollected")}
              {year ? ` · ${year}` : ""}
            </span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              ₹{yearTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.08]">
            {filteredRows.map((row) => (
              <LedgerRowView
                key={rowKey(row)}
                row={row}
                language={language}
                t={t}
                onRequestDelete={setPendingDelete}
              />
            ))}
          </ul>
        </>
      )}

      {pendingDelete && (
        <ConfirmDialog
          open={pendingDelete !== null}
          title={t("areYouSure")}
          message={deletePaymentMessage(
            pendingDelete.amount,
            formatMonthLabel(pendingDelete.dueMonth, locale),
            language
          )}
          confirmLabel={t("delete")}
          busy={busy}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}

function LedgerRowView({
  row,
  language,
  t,
  onRequestDelete,
}: {
  row: LedgerRow;
  language: Language;
  t: T;
  onRequestDelete: (payment: Payment) => void;
}) {
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  const monthLabel = formatMonthLabel(monthOf(row), locale);

  if (row.kind === "missed") {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md bg-red-500/5 px-3 py-3">
        <span className="text-base font-medium">{monthLabel}</span>
        <span className="shrink-0 rounded-full bg-red-600/15 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          {t("missed")}
        </span>
      </li>
    );
  }

  const { payment } = row;
  const dateLabel = payment.datePaid
    ? payment.datePaid.toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <li className="flex items-center gap-2 px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium">{monthLabel}</span>
          <span className="text-base font-semibold text-green-600 dark:text-green-400">
            ₹{payment.amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm opacity-60">
          <span>{dateLabel}</span>
          <span>·</span>
          <span>{t(payment.paymentMode)}</span>
        </div>
        {payment.notes && (
          <p className="text-sm italic opacity-50">{payment.notes}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRequestDelete(payment)}
        aria-label={t("delete")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-50"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </li>
  );
}

function LedgerSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 h-12 animate-pulse rounded-md bg-black/[.03] dark:bg-white/[.05]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
            <div className="h-4 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ))}
    </div>
  );
}

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function monthOf(row: LedgerRow): string {
  return row.kind === "payment" ? row.payment.dueMonth : row.month;
}

function rowKey(row: LedgerRow): string {
  return row.kind === "payment" ? `p-${row.payment.id}` : `m-${row.month}`;
}

function buildLedgerShareText(params: {
  shopName: string;
  tenantName: string;
  year: string;
  rows: LedgerRow[];
  total: number;
  locale: string;
  t: T;
}): string {
  const { shopName, tenantName, year, rows, total, locale, t } = params;
  const lines = rows.map((row) => {
    const label = formatMonthLabel(monthOf(row), locale);
    if (row.kind === "missed") return `${label}: ${t("missed")}`;
    return `${label}: ₹${row.payment.amount.toLocaleString("en-IN")}`;
  });
  return [
    `${shopName} — ${tenantName} (${year})`,
    ...lines,
    `${t("totalCollected")}: ₹${total.toLocaleString("en-IN")}`,
  ].join("\n");
}
