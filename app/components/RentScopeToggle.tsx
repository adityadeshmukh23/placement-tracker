"use client";

import { useTranslation } from "@/lib/useTranslation";
import type { TenantType } from "@/lib/types";

/**
 * Segmented Shop Rent / Family Rent toggle. Shop rent (`"regular"` tenants)
 * and family rent are tracked as fully separate totals throughout the app —
 * this is the shared control for switching which one a screen is showing.
 */
export function RentScopeToggle({
  scope,
  onChange,
}: {
  scope: TenantType;
  onChange: (scope: TenantType) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex rounded-lg border border-black/[.12] p-1 dark:border-white/[.15]">
      {(["regular", "family"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`h-11 flex-1 rounded-md text-base font-medium ${
            scope === s
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "opacity-60"
          }`}
        >
          {s === "regular" ? t("shopRent") : t("familyRent")}
        </button>
      ))}
    </div>
  );
}
