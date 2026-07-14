import type { Language } from "./translations";
import type { TenantType } from "./types";

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

/**
 * Builds a wa.me link with no recipient — WhatsApp opens its own contact/group
 * picker with `message` pre-filled. Used as the fallback for sharing when the
 * Web Share API isn't available.
 */
export function buildShareOnlyWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function formatMonthYear(month: string, language: Language): string {
  const [year, monthNum] = month.split("-").map(Number);
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function buildReceiptMessage(params: {
  amount: number;
  shopName: string;
  month: string;
  language: Language;
}): string {
  const { amount, shopName, month, language } = params;
  const monthLabel = formatMonthYear(month, language);
  const amountLabel = amount.toLocaleString("en-IN");

  if (language === "mr") {
    return `${shopName} चे ${monthLabel} महिन्याचे ₹${amountLabel} भाडे मिळाले. धन्यवाद!`;
  }
  return `Received ₹${amountLabel} rent for ${shopName}, ${monthLabel}. Thank you!`;
}

/**
 * Family tenants get the original, softer wording (an informal arrangement,
 * not overdue rent from a formal tenancy — matches the same soft treatment
 * used for their status pill). Regular tenants get firmer wording, since
 * these are normal, formal tenancies where a clearer nudge is appropriate.
 */
export function buildReminderMessage(params: {
  tenantName: string;
  amountDue: number;
  shopName: string;
  month: string;
  language: Language;
  tenantType: TenantType;
}): string {
  const { tenantName, amountDue, shopName, month, language, tenantType } = params;
  const monthLabel = formatMonthYear(month, language);
  const amountLabel = amountDue.toLocaleString("en-IN");

  if (tenantType === "family") {
    if (language === "mr") {
      return `नमस्कार ${tenantName}, ${shopName} चे ${monthLabel} महिन्याचे ₹${amountLabel} भाडे अजून प्रलंबित आहे. कृपया लवकरात लवकर भरा. धन्यवाद!`;
    }
    return `Hi ${tenantName}, this is a reminder that ₹${amountLabel} rent for ${shopName} (${monthLabel}) is still pending. Kindly pay at your earliest convenience. Thank you!`;
  }

  if (language === "mr") {
    return `${tenantName}, ${shopName} चे ${monthLabel} महिन्याचे ₹${amountLabel} भाडे थकीत आहे. कृपया त्वरित भरणा करा. धन्यवाद.`;
  }
  return `Dear ${tenantName}, your rent of ₹${amountLabel} for ${shopName} (${monthLabel}) is overdue. Please make the payment at the earliest to avoid any inconvenience. Thank you.`;
}
