"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";

export function Fab() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/payments/new") || pathname.startsWith("/shops/new")) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("addPayment")}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--foreground)] text-3xl font-light leading-none text-[var(--background)] shadow-lg active:scale-95"
      >
        +
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
                <span className="text-xl" aria-hidden>
                  ₹
                </span>
                {t("recordPayment")}
              </Link>
              <Link
                href="/shops/new"
                onClick={() => setOpen(false)}
                className="flex h-14 items-center gap-3 rounded-lg border border-black/[.12] px-4 text-base font-semibold dark:border-white/[.15]"
              >
                <span className="text-xl" aria-hidden>
                  🏠
                </span>
                {t("addNewShop")}
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
