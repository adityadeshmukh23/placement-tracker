/**
 * Formats a rupee amount for display, respecting the privacy toggle. The
 * masked form keeps the ₹ symbol (still clearly a money figure) but replaces
 * the digits with a fixed-width placeholder — not proportional to the real
 * amount, so the length itself can't leak how large the figure is.
 */
export function formatMoney(amount: number, visible: boolean): string {
  return visible ? `₹${amount.toLocaleString("en-IN")}` : "₹••••••";
}
