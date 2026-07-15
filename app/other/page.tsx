"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOtherTransactions } from "@/lib/db";
import { SYNCED_EVENT } from "@/lib/sync";
import { useTranslation } from "@/lib/useTranslation";
import { BackButton } from "@/app/components/BackButton";
import type {
  OtherTransaction,
  TransactionCategory,
} from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

const CATEGORIES: TransactionCategory[] = [
  "medical",
  "insurance",
  "family",
  "donation",
  "personal",
  "other",
];

const CATEGORY_KEY: Record<TransactionCategory, TranslationKey> = {
  medical: "categoryMedical",
  insurance: "categoryInsurance",
  family: "family",
  donation: "categoryDonation",
  personal: "categoryPersonal",
  other: "other",
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

function categoryLabel(
  tx: OtherTransaction,
  t: (key: TranslationKey) => string
): string {
  if (tx.category === "other" && tx.categoryOther) return tx.categoryOther;
  return t(CATEGORY_KEY[tx.category]);
}

export default function OtherRecordsPage() {
  const { t, language } = useTranslation();
  const initialRange = currentMonthRange();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<TransactionCategory | "">("");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [results, setResults] = useState<OtherTransaction[] | null>(null);

  const locale = language === "mr" ? "mr-IN" : "en-IN";

  useEffect(() => {
    const refresh = () =>
      getOtherTransactions({
        keyword: keyword || undefined,
        category: category || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }).then(setResults);
    refresh();
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, [keyword, category, startDate, endDate]);

  const totals = useMemo(() => {
    const list = results ?? [];
    const totalOut = list
      .filter((tx) => tx.direction === "out")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalIn = list
      .filter((tx) => tx.direction === "in")
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { totalOut, totalIn, net: totalIn - totalOut };
  }, [results]);

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/" />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("otherRecords")}</h2>
        <Link
          href="/other/new"
          className="flex h-11 shrink-0 items-center rounded-lg bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)]"
        >
          + {t("otherTransaction")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("moneyOut")}
          </p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            ₹{totals.totalOut.toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("moneyIn")}
          </p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            ₹{totals.totalIn.toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide opacity-50">
            {t("netTotal")}
          </p>
          <p className="text-lg font-bold">
            ₹{totals.net.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={t("search")}
        className="h-12 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]"
      />

      <div className="flex gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label={t("fromDate")}
          className="h-11 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label={t("toDate")}
          className="h-11 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
        />
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TransactionCategory | "")}
        className="h-11 w-full rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
      >
        <option value="">{t("allCategories")}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(CATEGORY_KEY[c])}
          </option>
        ))}
      </select>

      {results === null ? (
        <RowsSkeleton />
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-base opacity-60">
          {t("noOtherTransactions")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
          {results.map((tx) => (
            <li key={tx.id}>
              <Link
                href={`/other/${tx.id}`}
                className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 active:bg-black/[.03] dark:active:bg-white/[.05]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-medium">
                    {categoryLabel(tx, t)}
                    {tx.description ? ` · ${tx.description}` : ""}
                  </span>
                  <span className="truncate text-sm opacity-60">
                    {tx.date.toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {tx.loggedBy}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-base font-semibold ${
                    tx.direction === "out"
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {tx.direction === "out" ? "−" : "+"}₹
                  {tx.amount.toLocaleString("en-IN")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
            <div className="h-4 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          </div>
          <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ))}
    </div>
  );
}
