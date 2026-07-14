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
