import type { Language } from "./translations";

const LOGGED_BY_KEY = "bhadebook:logged-by-name";

/**
 * There's no real per-person login in this app (everyone shares one PIN, by
 * design — see CLAUDE.md). "Who logged this" is therefore just a label this
 * device remembers, captured once, not a verified identity. Same pattern the
 * app previously used for the WhatsApp landlord sign-off name.
 */
export function getLoggedByName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LOGGED_BY_KEY) ?? "";
}

export function setLoggedByName(name: string): void {
  localStorage.setItem(LOGGED_BY_KEY, name);
}

/**
 * Returns the saved name for this device, asking once (via a native prompt)
 * if none has been set yet. Returns "" if the user cancels the prompt.
 */
export function getOrAskLoggedByName(language: Language): string {
  const existing = getLoggedByName();
  if (existing) return existing;

  const question =
    language === "mr"
      ? "तुमचे नाव टाका (प्रत्येक नोंदीत कोणी नोंदवले ते दाखवले जाईल):"
      : "Enter your name (shown as who logged each record):";
  const entered = window.prompt(question, "");
  if (entered === null) return "";

  const trimmed = entered.trim();
  setLoggedByName(trimmed);
  return trimmed;
}
