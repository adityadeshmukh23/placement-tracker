"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildHeadlineText,
  buildThisMonthSentence,
  buildVacancyLine,
  buildYoySentence,
  formatArrearsDetail,
  formatReliabilityDetail,
  getHeadlineInsight,
  getIncomeByAreaThisYear,
  getLast12MonthsCollection,
  getLongVacantShops,
  getTenantPerformance,
  getThisMonthProgress,
  getYoyComparison,
} from "@/lib/insights";
import { SYNCED_EVENT } from "@/lib/sync";
import { useTranslation } from "@/lib/useTranslation";
import { RentScopeToggle } from "@/app/components/RentScopeToggle";
import { BackButton } from "@/app/components/BackButton";
import type {
  AreaIncome,
  HeadlineInsight,
  MonthlyCollected,
  MonthProgress,
  TenantAttention,
  TenantReliability,
  TenantType,
  VacantShopNote,
  YoyComparison,
} from "@/lib/types";
import type { Language } from "@/lib/translations";

interface InsightsData {
  headline: HeadlineInsight;
  yoy: YoyComparison;
  series: MonthlyCollected[];
  reliable: TenantReliability[];
  attention: TenantAttention[];
  incomeByArea: AreaIncome[];
  progress: MonthProgress;
  vacantShops: VacantShopNote[];
}

export default function InsightsPage() {
  const { t, language } = useTranslation();
  const [scope, setScope] = useState<TenantType>("regular");
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);

    async function load() {
      const [headline, yoy, series, performance, incomeByArea, progress, vacantShops] =
        await Promise.all([
          getHeadlineInsight(scope),
          getYoyComparison(scope),
          getLast12MonthsCollection(scope),
          getTenantPerformance(scope),
          getIncomeByAreaThisYear(scope),
          getThisMonthProgress(scope),
          getLongVacantShops(),
        ]);
      if (cancelled) return;
      setData({
        headline,
        yoy,
        series,
        reliable: performance.reliable,
        attention: performance.attention,
        incomeByArea,
        progress,
        vacantShops,
      });
    }

    load();
    window.addEventListener(SYNCED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(SYNCED_EVENT, load);
    };
  }, [scope]);

  const locale = language === "mr" ? "mr-IN" : "en-IN";
  const max = useMemo(
    () => Math.max(1, ...(data?.series ?? []).map((m) => m.collected)),
    [data]
  );

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/" />
      <h2 className="text-xl font-semibold">{t("insights")}</h2>
      <RentScopeToggle scope={scope} onChange={setScope} />

      {data === null ? (
        <InsightsSkeleton />
      ) : (
        <>
          <HeadlineCard headline={data.headline} language={language} />

          <Section title={t("yearVsLastYear")}>
            <p className="text-base">{buildYoySentence(data.yoy, language)}</p>
          </Section>

          <Section title={t("last12Months")}>
            <BarChart series={data.series} max={max} locale={locale} />
          </Section>

          <Section title={t("mostReliableShops")}>
            {data.reliable.length === 0 ? (
              <EmptyNote text={t("noInsightsYet")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.reliable.map((r) => (
                  <li
                    key={r.tenantId}
                    className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 dark:border-white/[.12]"
                  >
                    <span className="text-xl" aria-hidden>
                      ⭐
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-medium">
                        {r.shopName} · {r.tenantName}
                      </span>
                      <span className="truncate text-sm opacity-60">
                        {formatReliabilityDetail(r, language)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t("needsAttention")}>
            {data.attention.length === 0 ? (
              <EmptyNote text={t("noAttentionNeeded")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.attention.map((a) => {
                  const isFamily = a.tenantType === "family";
                  return (
                    <li
                      key={a.tenantId}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                        isFamily
                          ? "border-slate-400/20 bg-slate-500/[.05] dark:border-slate-400/20"
                          : "border-red-600/20 bg-red-600/[.04] dark:border-red-400/20"
                      }`}
                    >
                      <span className="text-xl" aria-hidden>
                        {isFamily ? "🔔" : "⚠️"}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-medium">
                          {a.shopName} · {a.tenantName}
                        </span>
                        <span
                          className={`truncate text-sm ${
                            isFamily
                              ? "opacity-60"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        >
                          {formatArrearsDetail(a, language)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={t("incomeByArea")}>
            {data.incomeByArea.length === 0 ? (
              <EmptyNote text={t("noInsightsYet")} />
            ) : (
              <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
                {data.incomeByArea.map((a) => (
                  <li
                    key={a.area}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-base font-medium">{a.area}</span>
                    <span className="text-base font-semibold text-green-600 dark:text-green-400">
                      ₹{a.collected.toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t("thisMonthSoFarHeading")}>
            <p className="text-base">{buildThisMonthSentence(data.progress, language)}</p>
          </Section>

          {data.vacantShops.length > 0 && (
            <Section title={t("vacantShopsHeading")}>
              <ul className="flex flex-col gap-1.5">
                {data.vacantShops.map((v) => (
                  <li key={v.shopName} className="text-base opacity-70">
                    {buildVacancyLine(v, language)}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function HeadlineCard({
  headline,
  language,
}: {
  headline: HeadlineInsight;
  language: Language;
}) {
  const isGreen = headline.tone === "green";
  return (
    <section
      className={`rounded-2xl border p-5 ${
        isGreen
          ? "border-green-600/20 bg-green-600/[.06] dark:border-green-400/20"
          : "border-amber-600/20 bg-amber-600/[.06] dark:border-amber-400/20"
      }`}
    >
      <p
        className={`text-lg font-semibold ${
          isGreen
            ? "text-green-700 dark:text-green-400"
            : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {buildHeadlineText(headline, language)}
      </p>
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold opacity-70">{title}</h3>
      {children}
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-4 text-center text-base opacity-50">{text}</p>;
}

function BarChart({
  series,
  max,
  locale,
}: {
  series: MonthlyCollected[];
  max: number;
  locale: string;
}) {
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
      {series.map((m) => (
        <div key={m.month} className="flex w-8 shrink-0 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-green-600/70 dark:bg-green-400/70"
            style={{ height: `${Math.max(2, (m.collected / max) * 80)}px` }}
          />
          <span className="text-xs opacity-60">{monthShortLabel(m.month, locale)}</span>
        </div>
      ))}
    </div>
  );
}

function monthShortLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, { month: "short" });
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-20 animate-pulse rounded-2xl bg-black/[.05] dark:bg-white/[.06]" />
      <div className="h-8 w-2/3 animate-pulse rounded bg-black/[.05] dark:bg-white/[.06]" />
      <div className="h-32 animate-pulse rounded-lg bg-black/[.05] dark:bg-white/[.06]" />
      <div className="h-24 animate-pulse rounded-lg bg-black/[.05] dark:bg-white/[.06]" />
      <div className="h-24 animate-pulse rounded-lg bg-black/[.05] dark:bg-white/[.06]" />
    </div>
  );
}
