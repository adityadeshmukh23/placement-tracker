const UNLOCK_KEY = "bhadebook:sensitive-unlock-until";
const UNLOCK_WINDOW_MS = 5 * 60 * 1000;

/**
 * A short-lived, session-only unlock for sensitive documents: entering the
 * correct PIN once grants 5 minutes during which any sensitive document can
 * be viewed without re-prompting. Backed by sessionStorage (not localStorage)
 * so it doesn't outlive the browser tab, and not extended just by viewing —
 * only a fresh correct PIN entry resets the window.
 */
export function isSensitiveUnlocked(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const until = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
  return Date.now() < until;
}

export function grantSensitiveUnlock(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_WINDOW_MS));
}
