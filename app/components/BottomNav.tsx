"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, TrendingUp, Menu } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import type { TranslationKey } from "@/lib/translations";

const ITEMS: {
  href: string;
  labelKey: TranslationKey;
  Icon: typeof Home;
  isActive: (pathname: string) => boolean;
}[] = [
  {
    href: "/",
    labelKey: "dashboard",
    Icon: Home,
    isActive: (p) => p === "/",
  },
  {
    href: "/shops",
    labelKey: "navShops",
    Icon: Store,
    isActive: (p) => p.startsWith("/shops"),
  },
  {
    href: "/insights",
    labelKey: "insights",
    Icon: TrendingUp,
    isActive: (p) => p.startsWith("/insights") || p.startsWith("/reports"),
  },
  {
    href: "/more",
    labelKey: "more",
    Icon: Menu,
    isActive: (p) => p.startsWith("/more") || p.startsWith("/other"),
  },
];

/**
 * The app's 4 primary destinations, always visible — unlike the FAB, this
 * never hides on sub-flows, so there's always a way back to a top-level
 * screen. Icon + short text label on every item (not icon-only) since an
 * unlabeled icon forces a guess about what it does.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-black/[.08] bg-[var(--background)] dark:border-white/[.145]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ href, labelKey, Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
          >
            <Icon
              className={`h-6 w-6 ${active ? "" : "opacity-50"}`}
              strokeWidth={active ? 2.25 : 2}
            />
            <span
              className={`whitespace-nowrap text-[11px] leading-tight ${
                active ? "font-semibold" : "font-medium opacity-50"
              }`}
            >
              {t(labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
