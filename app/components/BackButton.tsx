"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";

/**
 * The consistent back affordance used on every screen except the top-level
 * tabs (Dashboard, Shops, Reports each still get one — see the audit notes —
 * this just means "screens with no further-up parent"). Prefers real
 * history (so it returns to wherever the user actually came from, not a
 * fixed screen), but falls back to `fallbackHref` when there's no in-app
 * history to go back to — e.g. the PWA was launched directly onto this
 * screen. This also sidesteps relying on the platform's native back
 * gesture/button, which isn't consistently available in an installed PWA
 * (iOS standalone mode has no back gesture at all).
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-11 w-fit items-center text-base opacity-70"
    >
      ← {t("back")}
    </button>
  );
}
