import type { Language } from "./translations";

/**
 * A short, human "time ago" label for the last successful sync, e.g. "just now",
 * "2 min ago", "3 hr ago". Kept as a copy-layer builder (like lib/whatsapp.ts)
 * since it's a small templated phrase rather than a fixed UI string.
 */
export function formatLastSynced(
  syncedAt: Date,
  language: Language,
  now: Date = new Date()
): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - syncedAt.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (language === "mr") {
    if (seconds < 60) return "आत्ताच";
    if (minutes < 60) return `${minutes} मिनिटांपूर्वी`;
    if (hours < 24) return `${hours} तासांपूर्वी`;
    return `${days} दिवसांपूर्वी`;
  }

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  return `${days} d ago`;
}
