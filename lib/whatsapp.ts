import type { Language } from "./translations";

const LANDLORD_NAME_KEY = "bhadebook:landlord-name";

/**
 * Normalizes a phone number to the digits-only format wa.me expects. Assumes
 * an Indian mobile number: a bare 10-digit number gets the "91" country code
 * prepended; an 11-digit number with a leading 0 has that stripped first.
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

/** Builds a wa.me link that opens WhatsApp with `message` pre-filled. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function formatMonthYear(month: string, language: Language): string {
  const [year, monthNum] = month.split("-").map(Number);
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function getLandlordName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LANDLORD_NAME_KEY) ?? "";
}

export function setLandlordName(name: string): void {
  localStorage.setItem(LANDLORD_NAME_KEY, name);
}

/**
 * Returns the saved landlord name, asking once (via a native prompt) if none
 * has been set yet, so message sign-offs have a name without needing a
 * dedicated settings screen. Returns "" if the user cancels the prompt.
 */
export function getOrAskLandlordName(language: Language): string {
  const existing = getLandlordName();
  if (existing) return existing;

  const question =
    language === "mr"
      ? "तुमचे नाव टाका (WhatsApp संदेशांमध्ये दिसेल):"
      : "Enter your name (shown in WhatsApp messages):";
  const entered = window.prompt(question, "");
  if (entered === null) return "";

  const trimmed = entered.trim();
  setLandlordName(trimmed);
  return trimmed;
}

export function buildReceiptMessage(params: {
  amount: number;
  shopName: string;
  month: string;
  landlordName: string;
  language: Language;
}): string {
  const { amount, shopName, month, landlordName, language } = params;
  const monthLabel = formatMonthYear(month, language);
  const amountLabel = amount.toLocaleString("en-IN");
  const signOff = landlordName ? ` - ${landlordName}` : "";

  if (language === "mr") {
    return `${shopName} चे ${monthLabel} महिन्याचे ₹${amountLabel} भाडे मिळाले. धन्यवाद!${signOff}`;
  }
  return `Received ₹${amountLabel} rent for ${shopName}, ${monthLabel}. Thank you!${signOff}`;
}

export function buildReminderMessage(params: {
  tenantName: string;
  amountDue: number;
  shopName: string;
  month: string;
  landlordName: string;
  language: Language;
}): string {
  const { tenantName, amountDue, shopName, month, landlordName, language } = params;
  const monthLabel = formatMonthYear(month, language);
  const amountLabel = amountDue.toLocaleString("en-IN");
  const signOff = landlordName ? ` - ${landlordName}` : "";

  if (language === "mr") {
    return `नमस्कार ${tenantName}, ${shopName} चे ${monthLabel} महिन्याचे ₹${amountLabel} भाडे अजून प्रलंबित आहे. कृपया लवकरात लवकर भरा. धन्यवाद!${signOff}`;
  }
  return `Hi ${tenantName}, this is a reminder that ₹${amountLabel} rent for ${shopName} (${monthLabel}) is still pending. Kindly pay at your earliest convenience. Thank you!${signOff}`;
}
