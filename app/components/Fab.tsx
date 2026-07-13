"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";

export function Fab() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname.startsWith("/payments/new")) return null;

  return (
    <Link
      href="/payments/new"
      aria-label={t("addPayment")}
      className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--foreground)] text-3xl font-light leading-none text-[var(--background)] shadow-lg active:scale-95"
    >
      +
    </Link>
  );
}
