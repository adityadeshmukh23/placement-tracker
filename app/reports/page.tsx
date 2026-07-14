"use client";

import { useEffect, useMemo, useState } from "react";
import {
  currentMonth,
  getAvailableYears,
  getShopsWithCurrentStatus,
  getYearlyCollectionSummary,
} from "@/lib/db";
import { downloadCsv } from "@/lib/csv";
import { useTranslation } from "@/lib/useTranslation";
import { RentScopeToggle } from "@/app/components/RentScopeToggle";
import { BackButton } from "@/app/components/BackButton";
import type { MonthlyCollected, ShopWithStatus, TenantType } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

type ReportTab = "monthly" | "yearly";
type T = (key: TranslationKey) => string;

export default function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ReportTab>("monthly");
  // Shared across both tabs — switching Monthly/Yearly keeps the same scope.
  const [scope, setScope] = useState<TenantType>("regular");

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/" />

      <h2 className="text-xl font-semibold">{t("reports")}</h2>

      <RentScopeToggle scope={scope} onChange={setScope} />

      <div className="flex rounded-lg border border-black/[.12] p-1 dark:border-white/[.15]">
        {(["monthly", "yearly"] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={`h-11 flex-1 rounded-md text-base font-medium ${
              tab === tb
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "opacity-60"
            }`}
          >
            {t(tb)}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <MonthlyReport t={t} scope={scope} />
      ) : (
        <YearlyReport t={t} scope={scope} />
      )}
    </div>
  );
}

function MonthlyReport({ t, scope }: { t: T; scope: TenantType }) {
  const [month, setMonth] = useState(currentMonth());
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);

  useEffect(() => {
    setShops(null);
    getShopsWithCurrentStatus(month).then(setShops);
  }, [month]);

  const occupiedShops = useMemo(
    () =>
      (shops ?? [])
        .filter((s) => s.tenant !== null && s.tenant.type === scope)
        .sort(
          (a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)
        ),
    [shops, scope]
  );

  const summary = useMemo(() => {
    const totalDue = occupiedShops.reduce((sum, s) => sum + s.monthlyRent, 0);
    const totalCollected = occupiedShops.reduce((sum, s) => sum + s.collected, 0);
    return { totalCollected, totalPending: totalDue - totalCollected };
  }, [occupiedShops]);

  function handleExport() {
    if (shops === null) return;
    const rows: (string | number)[][] = [
      [t("shop"), t("area"), t("rent"), t("collected"), t("pending")],
      ...occupiedShops.map((s) => [
        s.name,
        s.area,
        s.monthlyRent,
        s.collected,
        Math.max(0, s.monthlyRent - s.collected),
      ]),
      [],
      [t("totalCollected"), summary.totalCollected],
      [t("totalPending"), summary.totalPending],
    ];
    downloadCsv(`rental-book-${month}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-11 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
        />
        <button
          type="button"
          onClick={handleExport}
          disabled={shops === null}
          className="flex h-11 shrink-0 items-center rounded-lg bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)] disabled:opacity-40"
        >
          {t("export")}
        </button>
      </div>

      {shops !== null ? (
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
          <div>
            <p className="text-sm uppercase tracking-wide opacity-50">
              {t("totalCollected")}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₹{summary.totalCollected.toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide opacity-50">
              {t("totalPending")}
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              ₹{summary.totalPending.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
          <div className="h-9 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          <div className="h-9 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      )}

      {shops === null ? (
        <RowsSkeleton />
      ) : occupiedShops.length === 0 ? (
        <p className="py-4 text-center text-base opacity-50">{t("noResults")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
          {occupiedShops.map((shop) => (
            <li
              key={shop.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-medium">
                  {shop.name}
                </span>
                <span className="truncate text-base opacity-60">{shop.area}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-base font-semibold text-green-600 dark:text-green-400">
                  ₹{shop.collected.toLocaleString("en-IN")}
                </span>
                {shop.collected < shop.monthlyRent && (
                  <span className="text-sm text-red-600 dark:text-red-400">
                    ₹{(shop.monthlyRent - shop.collected).toLocaleString("en-IN")}{" "}
                    {t("pending")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function YearlyReport({ t, scope }: { t: T; scope: TenantType }) {
  const { language } = useTranslation();
  const [years, setYears] = useState<string[]>([]);
  const [year, setYear] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<MonthlyCollected[] | null>(null);

  useEffect(() => {
    getAvailableYears().then((ys) => {
      setYears(ys);
      setYear((prev) => prev ?? ys[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (!year) return;
    setMonthly(null);
    getYearlyCollectionSummary(year, scope).then(setMonthly);
  }, [year, scope]);

  const total = useMemo(
    () => (monthly ?? []).reduce((sum, m) => sum + m.collected, 0),
    [monthly]
  );
  const max = useMemo(
    () => Math.max(1, ...(monthly ?? []).map((m) => m.collected)),
    [monthly]
  );

  const locale = language === "mr" ? "mr-IN" : "en-IN";

  function handleExport() {
    if (!monthly || !year) return;
    const rows: (string | number)[][] = [
      [t("month"), t("collected")],
      ...monthly.map((m) => [monthLabel(m.month, locale, "long"), m.collected]),
      [],
      [t("total"), total],
    ];
    downloadCsv(`rental-book-${year}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <select
          value={year ?? ""}
          onChange={(e) => setYear(e.target.value)}
          className="h-11 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-base dark:border-white/[.15]"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={!monthly}
          className="flex h-11 shrink-0 items-center rounded-lg bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)] disabled:opacity-40"
        >
          {t("export")}
        </button>
      </div>

      <div className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.12]">
        <p className="text-sm uppercase tracking-wide opacity-50">
          {t("total")}
          {year ? ` · ${year}` : ""}
        </p>
        {monthly ? (
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            ₹{total.toLocaleString("en-IN")}
          </p>
        ) : (
          <div className="mt-1 h-9 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        )}
      </div>

      {monthly && (
        <div className="flex items-end gap-1.5 overflow-x-auto rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
          {monthly.map((m) => (
            <div key={m.month} className="flex w-8 shrink-0 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-green-600/70 dark:bg-green-400/70"
                style={{ height: `${Math.max(2, (m.collected / max) * 80)}px` }}
              />
              <span className="text-xs opacity-60">
                {monthLabel(m.month, locale, "short")}
              </span>
            </div>
          ))}
        </div>
      )}

      {monthly === null ? (
        <RowsSkeleton />
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
          {monthly.map((m) => (
            <li key={m.month} className="flex items-center justify-between px-4 py-3">
              <span className="text-base font-medium">
                {monthLabel(m.month, locale, "long")}
              </span>
              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                ₹{m.collected.toLocaleString("en-IN")}
              </span>
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
          <div className="h-4 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          <div className="h-4 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ))}
    </div>
  );
}

function monthLabel(
  month: string,
  locale: string,
  style: "long" | "short"
): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: style,
    ...(style === "long" ? { year: "numeric" as const } : {}),
  });
}
