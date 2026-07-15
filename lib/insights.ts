import {
  currentMonth,
  db,
  getShopsWithCurrentStatus,
  isLiveActive,
  monthsBetween,
  notDeleted,
} from "./db";
import { formatMoney } from "./money";
import type { Language } from "./translations";
import type {
  AreaIncome,
  HeadlineInsight,
  MonthlyCollected,
  MonthProgress,
  Payment,
  Tenant,
  TenantAttention,
  TenantReliability,
  TenantType,
  VacantShopNote,
  YoyComparison,
} from "./types";

/** Shifts a "YYYY-MM" month string by `delta` months (negative moves back). */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  let year = y;
  let monthNum = m + delta;
  while (monthNum > 12) {
    monthNum -= 12;
    year += 1;
  }
  while (monthNum < 1) {
    monthNum += 12;
    year -= 1;
  }
  return `${year}-${String(monthNum).padStart(2, "0")}`;
}

/** The last `count` months up to and including `endMonth`, oldest first. */
function trailingMonths(count: number, endMonth: string = currentMonth()): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, -(count - 1 - i)));
}

function collectedFrom(payments: Payment[]): number {
  return payments
    .filter((p) => p.datePaid != null)
    .reduce((sum, p) => sum + p.amount, 0);
}

// --- Data functions ----------------------------------------------------

/**
 * Total collected for each of the last 12 calendar months (oldest first,
 * ending with the current month), scoped to one rent type — mirrors the
 * Shop Rent / Family Rent split used everywhere else in the app.
 */
export async function getLast12MonthsCollection(
  scope: TenantType
): Promise<MonthlyCollected[]> {
  const months = trailingMonths(12);
  const [payments, tenants] = await Promise.all([
    db.payments
      .where("dueMonth")
      .between(months[0], months[months.length - 1], true, true)
      .filter(notDeleted)
      .toArray(),
    db.tenants.filter(notDeleted).toArray(),
  ]);

  const typeByTenant = new Map(tenants.map((t) => [t.id, t.type]));
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (p.datePaid == null) continue;
    if (typeByTenant.get(p.tenantId) !== scope) continue;
    byMonth.set(p.dueMonth, (byMonth.get(p.dueMonth) ?? 0) + p.amount);
  }

  return months.map((month) => ({ month, collected: byMonth.get(month) ?? 0 }));
}

/**
 * Total collected this year, January through the current month, versus the
 * same Jan–current-month window last year — a fair "to date" comparison
 * rather than comparing a partial year against a full one.
 */
export async function getYoyComparison(scope: TenantType): Promise<YoyComparison> {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const monthNum = now.getMonth() + 1;

  const [payments, tenants] = await Promise.all([
    db.payments
      .where("dueMonth")
      .between(`${lastYear}-01`, `${thisYear}-12`, true, true)
      .filter(notDeleted)
      .toArray(),
    db.tenants.filter(notDeleted).toArray(),
  ]);

  const typeByTenant = new Map(tenants.map((t) => [t.id, t.type]));
  let thisYearToDate = 0;
  let lastYearSamePeriod = 0;
  for (const p of payments) {
    if (p.datePaid == null) continue;
    if (typeByTenant.get(p.tenantId) !== scope) continue;
    const [y, m] = p.dueMonth.split("-").map(Number);
    if (m > monthNum) continue;
    if (y === thisYear) thisYearToDate += p.amount;
    else if (y === lastYear) lastYearSamePeriod += p.amount;
  }

  const percentChange =
    lastYearSamePeriod > 0
      ? ((thisYearToDate - lastYearSamePeriod) / lastYearSamePeriod) * 100
      : null;

  return { thisYearToDate, lastYearSamePeriod, percentChange };
}

/**
 * Ranks currently active tenants by on-time payment history (trailing up to
 * 12 months, or since they moved in if shorter) into two lists:
 * - `reliable`: best on-time rate, top 5 (needs 2+ tracked months, so a
 *   single-payment tenant can't outrank a proven long-standing one).
 * - `attention`: arrears across 2+ months (a single missed month isn't
 *   "building" arrears yet), worst-first by total amount owed.
 * A month counts "on time" if its full rent was collected against the
 * shop's *current* monthly rent — consistent with how the rest of the app
 * (ledger, dashboard status) always evaluates past months against the
 * current rent rather than a historical snapshot.
 */
export async function getTenantPerformance(scope: TenantType): Promise<{
  reliable: TenantReliability[];
  attention: TenantAttention[];
}> {
  const endMonth = currentMonth();
  const [shops, tenants, payments] = await Promise.all([
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(isLiveActive).toArray(),
    db.payments.filter(notDeleted).toArray(),
  ]);

  const shopById = new Map(shops.map((s) => [s.id, s]));
  const scopedTenants = tenants.filter(
    (t) => t.type === scope && shopById.has(t.shopId)
  );

  const paymentsByTenant = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByTenant.get(p.tenantId) ?? [];
    list.push(p);
    paymentsByTenant.set(p.tenantId, list);
  }

  const reliable: TenantReliability[] = [];
  const attention: TenantAttention[] = [];

  for (const tenant of scopedTenants) {
    const shop = shopById.get(tenant.shopId)!;
    const months = monthsBetween(currentMonth(tenant.createdAt), endMonth).slice(-12);

    const collectedByMonth = new Map<string, number>();
    for (const p of paymentsByTenant.get(tenant.id) ?? []) {
      if (p.datePaid == null) continue;
      collectedByMonth.set(p.dueMonth, (collectedByMonth.get(p.dueMonth) ?? 0) + p.amount);
    }

    let monthsPaidOnTime = 0;
    let monthsInArrears = 0;
    let totalArrears = 0;
    for (const month of months) {
      const collected = collectedByMonth.get(month) ?? 0;
      if (collected >= shop.monthlyRent) {
        monthsPaidOnTime += 1;
      } else {
        monthsInArrears += 1;
        totalArrears += shop.monthlyRent - collected;
      }
    }

    if (months.length >= 2) {
      reliable.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        shopName: shop.name,
        tenantType: tenant.type,
        monthsTracked: months.length,
        monthsPaidOnTime,
        reliabilityRate: monthsPaidOnTime / months.length,
      });
    }

    if (monthsInArrears >= 2) {
      attention.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        shopName: shop.name,
        tenantType: tenant.type,
        monthsInArrears,
        totalArrears,
      });
    }
  }

  reliable.sort(
    (a, b) => b.reliabilityRate - a.reliabilityRate || b.monthsTracked - a.monthsTracked
  );
  attention.sort(
    (a, b) => b.totalArrears - a.totalArrears || b.monthsInArrears - a.monthsInArrears
  );

  return { reliable: reliable.slice(0, 5), attention };
}

/** Total collected this year so far, grouped by shop area, highest first. */
export async function getIncomeByAreaThisYear(scope: TenantType): Promise<AreaIncome[]> {
  const year = currentMonth().slice(0, 4);
  const [shops, tenants, payments] = await Promise.all([
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(notDeleted).toArray(),
    db.payments
      .where("dueMonth")
      .between(`${year}-01`, `${year}-12`, true, true)
      .filter(notDeleted)
      .toArray(),
  ]);

  const shopById = new Map(shops.map((s) => [s.id, s]));
  const typeByTenant = new Map(tenants.map((t) => [t.id, t.type]));

  const byArea = new Map<string, number>();
  for (const p of payments) {
    if (p.datePaid == null) continue;
    if (typeByTenant.get(p.tenantId) !== scope) continue;
    const shop = shopById.get(p.shopId);
    if (!shop) continue;
    byArea.set(shop.area, (byArea.get(shop.area) ?? 0) + p.amount);
  }

  return Array.from(byArea.entries())
    .map(([area, collected]) => ({ area, collected }))
    .sort((a, b) => b.collected - a.collected);
}

/** Expected vs collected-so-far vs remaining for the current month, scoped. */
export async function getThisMonthProgress(scope: TenantType): Promise<MonthProgress> {
  const shops = await getShopsWithCurrentStatus();
  const occupied = shops.filter((s) => s.tenant !== null && s.tenant.type === scope);
  const expected = occupied.reduce((sum, s) => sum + s.monthlyRent, 0);
  const collected = occupied.reduce((sum, s) => sum + s.collected, 0);
  return { expected, collected, remaining: expected - collected };
}

/**
 * Shops vacant for `minMonths` or more, worst-first. Vacancy start is when
 * the shop's last tenant was deactivated, or the shop's own creation date if
 * it never had one; duration is counted in whole calendar months (the month
 * vacancy started through the current month, inclusive) so "vacant for 2
 * months" reads the same way a person would count it on a calendar.
 */
export async function getLongVacantShops(minMonths = 2): Promise<VacantShopNote[]> {
  const [shops, tenants] = await Promise.all([
    db.shops.filter(notDeleted).toArray(),
    db.tenants.filter(notDeleted).toArray(),
  ]);

  const tenantsByShop = new Map<string, Tenant[]>();
  for (const t of tenants) {
    const list = tenantsByShop.get(t.shopId) ?? [];
    list.push(t);
    tenantsByShop.set(t.shopId, list);
  }
  const occupiedShopIds = new Set(tenants.filter(isLiveActive).map((t) => t.shopId));

  const endMonth = currentMonth();
  const notes: VacantShopNote[] = [];
  for (const shop of shops) {
    if (occupiedShopIds.has(shop.id)) continue;
    const shopTenants = tenantsByShop.get(shop.id) ?? [];
    const vacancyStart =
      shopTenants.length === 0
        ? shop.createdAt
        : shopTenants.reduce(
            (latest, t) => (t.updatedAt > latest ? t.updatedAt : latest),
            shopTenants[0].updatedAt
          );

    const monthsVacant = monthsBetween(currentMonth(vacancyStart), endMonth).length;
    if (monthsVacant >= minMonths) {
      notes.push({ shopName: shop.name, monthsVacant });
    }
  }

  return notes.sort((a, b) => b.monthsVacant - a.monthsVacant);
}

/**
 * Picks the single most relevant headline for the top of the Insights
 * screen, in priority order:
 * 1. This month (so far) already beats every other month collected this
 *    year — always true or gets more true as the month goes on, so it's
 *    safe to declare mid-month.
 * 2. Otherwise, a fair same-day-of-month comparison against last month
 *    (using each payment's actual paid date, not just its due month).
 * 3. Otherwise (no usable history yet), how much of this month's expected
 *    rent has come in so far.
 */
export async function getHeadlineInsight(scope: TenantType): Promise<HeadlineInsight> {
  const series = await getLast12MonthsCollection(scope);
  const thisMonthCollected = series[series.length - 1]?.collected ?? 0;
  const priorMonths = series.slice(0, -1);
  const priorMax = Math.max(0, ...priorMonths.map((m) => m.collected));

  if (thisMonthCollected > 0 && thisMonthCollected >= priorMax && priorMax > 0) {
    return { tone: "green", kind: "bestMonth" };
  }

  const day = new Date().getDate();
  const lastMonth = shiftMonth(currentMonth(), -1);
  const [lastMonthPayments, tenants] = await Promise.all([
    db.payments.where("dueMonth").equals(lastMonth).filter(notDeleted).toArray(),
    db.tenants.filter(notDeleted).toArray(),
  ]);
  const typeByTenant = new Map(tenants.map((t) => [t.id, t.type]));
  const hasScopedHistory = tenants.some((t) => t.type === scope);

  if (hasScopedHistory) {
    const lastMonthSoFar = collectedFrom(
      lastMonthPayments.filter(
        (p) =>
          typeByTenant.get(p.tenantId) === scope &&
          p.datePaid != null &&
          p.datePaid.getDate() <= day
      )
    );
    if (lastMonthSoFar > 0 || thisMonthCollected > 0) {
      const diff = thisMonthCollected - lastMonthSoFar;
      if (diff > 0) return { tone: "green", kind: "aheadOfLastMonth", amount: diff };
      if (diff < 0) return { tone: "amber", kind: "behindLastMonth", amount: -diff };
      return { tone: "green", kind: "onPaceLastMonth" };
    }
  }

  const progress = await getThisMonthProgress(scope);
  if (progress.expected <= 0) return { tone: "green", kind: "noData" };
  const percent = Math.round((progress.collected / progress.expected) * 100);
  return { tone: percent >= 50 ? "green" : "amber", kind: "monthProgress", percent };
}

// --- Copy builders -------------------------------------------------------
// Full localized sentences (not simple key lookups) since these need
// interpolated amounts/percentages — same approach as lib/whatsapp.ts.

export function buildHeadlineText(
  insight: HeadlineInsight,
  language: Language,
  moneyVisible: boolean
): string {
  const amountLabel = insight.amount != null ? formatMoney(insight.amount, moneyVisible) : "";

  if (language === "mr") {
    switch (insight.kind) {
      case "bestMonth":
        return "या वर्षीचा हा तुमचा सर्वात चांगला वसुलीचा महिना आहे!";
      case "aheadOfLastMonth":
        return `या टप्प्यावर गेल्या महिन्यापेक्षा तुम्ही ${amountLabel} ने पुढे आहात.`;
      case "behindLastMonth":
        return `या टप्प्यावर गेल्या महिन्यापेक्षा तुम्ही ${amountLabel} ने मागे आहात.`;
      case "onPaceLastMonth":
        return "गेल्या महिन्याइतकीच वसुली सुरू आहे.";
      case "monthProgress":
        return `या महिन्याचे आतापर्यंत ${insight.percent}% भाडे जमा झाले आहे.`;
      case "noData":
      default:
        return "पुरेसा डेटा जमा होताच इथे ठळक मुद्दे दिसतील.";
    }
  }

  switch (insight.kind) {
    case "bestMonth":
      return "This is your best collection month this year!";
    case "aheadOfLastMonth":
      return `You're ${amountLabel} ahead of where you were last month at this point.`;
    case "behindLastMonth":
      return `You're ${amountLabel} behind where you were last month at this point.`;
    case "onPaceLastMonth":
      return "You're right on pace with last month.";
    case "monthProgress":
      return `You've collected ${insight.percent}% of this month's rent so far.`;
    case "noData":
    default:
      return "Highlights will appear here once you have some data.";
  }
}

export function buildYoySentence(yoy: YoyComparison, language: Language): string {
  const thisLabel = yoy.thisYearToDate.toLocaleString("en-IN");

  if (yoy.percentChange == null) {
    if (language === "mr") {
      return `या वर्षी आतापर्यंत ₹${thisLabel} जमा झाले (गेल्या वर्षीच्या याच काळाशी तुलना करण्याइतका डेटा नाही).`;
    }
    return `₹${thisLabel} collected so far this year (not enough data from last year to compare).`;
  }

  const pct = Math.abs(Math.round(yoy.percentChange));
  const up = yoy.percentChange >= 0;

  if (language === "mr") {
    return up
      ? `या वर्षी आतापर्यंत ₹${thisLabel} जमा झाले — गेल्या वर्षीच्या याच काळापेक्षा ${pct}% जास्त.`
      : `या वर्षी आतापर्यंत ₹${thisLabel} जमा झाले — गेल्या वर्षीच्या याच काळापेक्षा ${pct}% कमी.`;
  }
  return up
    ? `₹${thisLabel} collected so far this year — ${pct}% more than the same period last year.`
    : `₹${thisLabel} collected so far this year — ${pct}% less than the same period last year.`;
}

export function buildThisMonthSentence(
  progress: MonthProgress,
  language: Language,
  moneyVisible: boolean
): string {
  const expected = formatMoney(progress.expected, moneyVisible);
  const collected = formatMoney(progress.collected, moneyVisible);
  const remaining = formatMoney(Math.max(0, progress.remaining), moneyVisible);

  if (language === "mr") {
    return `या महिन्याचे एकूण अपेक्षित भाडे ${expected} आहे — त्यापैकी ${collected} जमा झाले असून ${remaining} अजून येणे बाकी आहे.`;
  }
  return `Expected ${expected} this month — ${collected} collected so far, ${remaining} still to come.`;
}

export function buildVacancyLine(note: VacantShopNote, language: Language): string {
  if (language === "mr") {
    return `${note.shopName} गेले ${note.monthsVacant} महिने रिकामे आहे.`;
  }
  return `${note.shopName} has been vacant for ${note.monthsVacant} months.`;
}

export function formatReliabilityDetail(r: TenantReliability, language: Language): string {
  if (language === "mr") {
    return `${r.monthsTracked} पैकी ${r.monthsPaidOnTime} महिने वेळेवर भरले`;
  }
  return `${r.monthsPaidOnTime} of ${r.monthsTracked} months on time`;
}

/**
 * Mirrors lib/whatsapp.ts's family-soft / regular-firm convention: a family
 * tenant's arrears read as gently "pending", a regular tenant's read as
 * firmly "overdue" — same distinction the reminder messages and StatusPill
 * already make.
 */
export function formatArrearsDetail(a: TenantAttention, language: Language): string {
  const amountLabel = a.totalArrears.toLocaleString("en-IN");
  const isFamily = a.tenantType === "family";

  if (language === "mr") {
    const word = isFamily ? "प्रलंबित" : "थकीत";
    return `${a.monthsInArrears} महिने ${word} · ₹${amountLabel}`;
  }
  const word = isFamily ? "pending" : "overdue";
  return `${a.monthsInArrears} months ${word} · ₹${amountLabel}`;
}
