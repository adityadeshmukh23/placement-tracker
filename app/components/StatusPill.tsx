"use client";

import { useTranslation } from "@/lib/useTranslation";
import type { ShopWithStatus } from "@/lib/types";

/**
 * Status badge for a shop row. A vacant shop has no tenant to owe rent, so it
 * gets a neutral "Vacant" badge rather than inheriting the red "Unpaid" color
 * from the underlying status calculation. An unsettled family tenant (an
 * informal arrangement) gets a soft neutral badge instead of the urgent
 * red/amber treatment used for regular tenants.
 */
export function StatusPill({ shop }: { shop: ShopWithStatus }) {
  const { t } = useTranslation();

  if (!shop.tenant) {
    return (
      <span className="shrink-0 rounded-full bg-black/[.05] px-3 py-1 text-xs font-medium opacity-60 dark:bg-white/[.08]">
        {t("vacant")}
      </span>
    );
  }

  const isUnsettledFamily =
    shop.tenant.type === "family" && shop.status !== "paid";

  const colorClass = isUnsettledFamily
    ? "bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300"
    : shop.status === "paid"
    ? "bg-green-600/15 text-green-700 dark:text-green-400"
    : shop.status === "partial"
    ? "bg-amber-600/15 text-amber-700 dark:text-amber-400"
    : "bg-red-600/15 text-red-700 dark:text-red-400";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${colorClass}`}
    >
      {t(shop.status)}
    </span>
  );
}
