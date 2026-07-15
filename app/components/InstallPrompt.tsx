"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

const DISMISSED_KEY = "bhadebook:install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own standalone flag
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");

    if (isStandalone()) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!deferredEvent || dismissed) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-4 top-16 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg border border-black/[.08] bg-[var(--background)] px-4 py-3 shadow-lg dark:border-white/[.145]">
      <span className="text-base font-medium">{t("installApp")}</span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="flex h-11 items-center rounded-md bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)]"
        >
          {t("install")}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
          className="flex h-11 w-11 items-center justify-center rounded-md opacity-60"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
