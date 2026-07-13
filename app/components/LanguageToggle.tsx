"use client";

import { useLanguage } from "@/lib/LanguageContext";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label="Switch language"
      className="fixed right-3 top-3 z-20 rounded-full border border-black/[.08] bg-[var(--background)] px-3 py-2 text-sm font-medium shadow-sm active:scale-95 dark:border-white/[.145]"
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
