"use client";

import { useEffect } from "react";

/**
 * next-pwa's `register: true` auto-injects a registration script via the
 * Pages Router's `_document`, which doesn't exist under the App Router — so
 * the generated public/sw.js is never actually registered without this.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
