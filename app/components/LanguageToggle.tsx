"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/useTranslation";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={t("switchLanguage")}
      className="fixed right-3 top-3 z-20 flex h-11 items-center rounded-full border border-black/[.08] bg-[var(--background)] px-4 text-base font-medium shadow-sm active:scale-95 dark:border-white/[.145]"
    >
      <span className={language === "en" ? "font-semibold" : "opacity-50"}>
        EN
      </span>
      {" / "}
      <span className={language === "mr" ? "font-semibold" : "opacity-50"}>
        मर
      </span>
    </button>
  );
}
