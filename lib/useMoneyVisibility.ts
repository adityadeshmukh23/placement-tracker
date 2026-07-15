"use client";

import { useEffect, useState } from "react";

const KEY = "bhadebook:money-visible";

function readStored(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

function writeStored(visible: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, visible ? "1" : "0");
}

/**
 * Shared privacy toggle for money figures — a device-local preference (never
 * synced to Supabase), read fresh from localStorage on every mount so it's
 * consistent everywhere it's used (Dashboard, Insights) without a global
 * context. Revealed state is force-reset to hidden the moment the app is
 * backgrounded (not just on an explicit reload), so re-opening it — whether
 * seconds or hours later — always comes back safe/hidden rather than staying
 * revealed indefinitely just because someone unhid it once.
 */
export function useMoneyVisibility(): [boolean, () => void] {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readStored());

    function hide() {
      writeStored(false);
      setVisible(false);
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") hide();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", hide);
    };
  }, []);

  function toggle() {
    setVisible((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }

  return [visible, toggle];
}
