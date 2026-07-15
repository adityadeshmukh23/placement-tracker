"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IndianRupee, Plus, Receipt, Store } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

export function Fab() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (
    pathname.startsWith("/payments/new") ||
    pathname.startsWith("/shops/new") ||
    pathname.startsWith("/other/new")
  ) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("addPayment")}
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-lg active:scale-95"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-[var(--background)] p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <Link
                href={`/payments/new?from=${encodeURIComponent(pathname)}`}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center gap-3 rounded-lg border border-black/[.12] px-4 text-base font-semibold dark:border-white/[.15]"
              >
                <IndianRupee className="h-5 w-5 shrink-0" aria-hidden />
                {t("recordPayment")}
              </Link>
              <Link
                href="/shops/new"
                onClick={() => setOpen(false)}
                className="flex h-14 items-center gap-3 rounded-lg border border-black/[.12] px-4 text-base font-semibold dark:border-white/[.15]"
              >
                <Store className="h-5 w-5 shrink-0" aria-hidden />
                {t("addNewShop")}
              </Link>
              <Link
                href={`/other/new?from=${encodeURIComponent(pathname)}`}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center gap-3 rounded-lg border border-black/[.12] px-4 text-base font-semibold dark:border-white/[.15]"
              >
                <Receipt className="h-5 w-5 shrink-0" aria-hidden />
                {t("otherTransaction")}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-14 rounded-lg text-base font-semibold opacity-60"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
