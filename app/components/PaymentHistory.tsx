"use client";

import { useEffect, useMemo, useState } from "react";
import { getShopLedger } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import type { LedgerRow, ShopLedger, Tenant } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

type T = (key: TranslationKey) => string;

export function PaymentHistory({
  shopId,
  tenant,
}: {
  shopId: number;
  tenant: Tenant | null;
}) {
  const { t, language } = useTranslation();
  const [ledger, setLedger] = useState<ShopLedger | null>(null);
  const [year, setYear] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    getShopLedger(shopId, tenant.createdAt).then((result) => {
      setLedger(result);
      setYear((prev) => prev ?? result.years[0] ?? null);
    });
  }, [shopId, tenant]);

  if (!tenant) {
    return (
      <section className="rounded-lg border border-dashed border-black/[.15] p-4 text-center dark:border-white/[.2]">
        <h3 className="mb-1 text-base font-semibold">{t("history")}</h3>
        <p className="text-sm opacity-50">{t("noTenantCurrently")}</p>
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

  return (
    <section className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("history")}</h3>
        {ledger && ledger.years.length > 0 && (
          <select
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-md border border-black/[.12] bg-transparent px-2 text-sm dark:border-white/[.15]"
          >
            {ledger.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {ledger === null ? (
        <p className="py-4 text-center text-sm opacity-50">…</p>
      ) : filteredRows.length === 0 ? (
        <p className="py-4 text-center text-sm opacity-50">{t("noResults")}</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between rounded-md bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
            <span className="text-sm opacity-60">
              {t("totalCollected")}
              {year ? ` · ${year}` : ""}
            </span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              ₹{yearTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.08]">
            {filteredRows.map((row) => (
              <LedgerRowView key={rowKey(row)} row={row} language={language} t={t} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function LedgerRowView({
  row,
  language,
  t,
}: {
  row: LedgerRow;
  language: string;
  t: T;
}) {
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  const monthLabel = formatMonthLabel(monthOf(row), locale);

  if (row.kind === "missed") {
    return (
      <li className="flex items-center justify-between gap-3 rounded-md bg-red-500/5 px-3 py-3">
        <span className="text-sm font-medium">{monthLabel}</span>
        <span className="shrink-0 rounded-full bg-red-600/15 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400">
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
    <li className="flex flex-col gap-1 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{monthLabel}</span>
        <span className="text-base font-semibold text-green-600 dark:text-green-400">
          ₹{payment.amount.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs opacity-60">
        <span>{dateLabel}</span>
        <span>·</span>
        <span>{t(payment.paymentMode)}</span>
      </div>
      {payment.notes && <p className="text-xs italic opacity-50">{payment.notes}</p>}
    </li>
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
