import type { Language } from "./translations";

export function deleteShopMessage(shopName: string, language: Language): string {
  if (language === "mr") {
    return `${shopName} हटवायचे? यामुळे दुकान, भाडेकरू आणि सर्व पेमेंट इतिहास कायमचा हटवला जाईल. हे पूर्ववत करता येणार नाही.`;
  }
  return `Delete ${shopName}? This will permanently remove the shop, its tenant, and all payment history. This cannot be undone.`;
}

export function removeTenantMessage(
  tenantName: string,
  shopName: string,
  language: Language
): string {
  if (language === "mr") {
    return `${tenantName} ला ${shopName} मधून काढायचे? दुकान रिकामे म्हणून दाखवले जाईल. मागील पेमेंट इतिहास कायम राहील.`;
  }
  return `Remove ${tenantName} from ${shopName}? The shop will be marked vacant. Past payment history will be kept.`;
}

export function deletePaymentMessage(
  amount: number,
  monthLabel: string,
  language: Language
): string {
  const amountLabel = amount.toLocaleString("en-IN");
  if (language === "mr") {
    return `${monthLabel} साठीचे हे ₹${amountLabel} पेमेंट हटवायचे? हे पूर्ववत करता येणार नाही.`;
  }
  return `Delete this ₹${amountLabel} payment for ${monthLabel}? This cannot be undone.`;
}

/** Inline warning shown on the Add Payment form when the shop is already fully paid. */
export function alreadyPaidMessage(monthLabel: string, language: Language): string {
  if (language === "mr") {
    return `${monthLabel} साठी आधीच पूर्ण भाडे भरले आहे.`;
  }
  return `Already fully paid for ${monthLabel}.`;
}

/** Confirmation before recording an extra/advance payment on an already-paid shop. */
export function recordAnywayConfirmMessage(
  shopName: string,
  monthLabel: string,
  language: Language
): string {
  if (language === "mr") {
    return `${shopName} साठी ${monthLabel} महिन्याचे भाडे आधीच पूर्ण भरले आहे. तरीही अतिरिक्त पेमेंट नोंदवायचे आहे का?`;
  }
  return `${shopName} is already fully paid for ${monthLabel}. Are you sure you want to record an additional payment anyway?`;
}

export function deleteOtherTransactionMessage(
  amount: number,
  language: Language
): string {
  const amountLabel = amount.toLocaleString("en-IN");
  if (language === "mr") {
    return `हे ₹${amountLabel} चे रेकॉर्ड हटवायचे? हे पूर्ववत करता येणार नाही.`;
  }
  return `Delete this ₹${amountLabel} record? This cannot be undone.`;
}
