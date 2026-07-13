"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getShopsWithCurrentStatus,
  getUsualAmount,
  recordPayment,
} from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";
import { useTranslation } from "@/lib/useTranslation";
import { StatusPill } from "@/app/components/StatusPill";
import type { ShopWithStatus } from "@/lib/types";

export default function ShopsPage() {
  return (
    <Suspense fallback={null}>
      <ShopsList />
    </Suspense>
  );
}

function ShopsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  const [query, setQuery] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [toastShopName, setToastShopName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      setShops(await getShopsWithCurrentStatus());
    })();
  }, []);

  useEffect(() => {
    const paymentSaved = searchParams.get("paymentSaved");
    if (!paymentSaved || !shops) return;
    const shop = shops.find((s) => s.id === Number(paymentSaved));
    if (!shop) return;
    setToastShopName(shop.name);
    router.replace("/shops");
    const timeout = setTimeout(() => setToastShopName(null), 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, shops]);

  async function handleMarkAsPaid(shop: ShopWithStatus) {
    if (!shop.tenant || markingId !== null) return;
    setMarkingId(shop.id!);
    const amount = await getUsualAmount(shop.id!);
    await recordPayment({
      shopId: shop.id!,
      tenantId: shop.tenant.id!,
      amount,
      datePaid: new Date(),
      paymentMode: "cash",
    });
    setShops(await getShopsWithCurrentStatus());
    setToastShopName(shop.name);
    setTimeout(() => setToastShopName(null), 3000);
    setMarkingId(null);
  }

  const filtered = useMemo(() => {
    if (!shops) return [];
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(q) ||
        (shop.tenant?.name.toLowerCase().includes(q) ?? false)
    );
  }, [shops, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShopWithStatus[]>();
    for (const shop of filtered) {
      const list = map.get(shop.area) ?? [];
      list.push(shop);
      map.set(shop.area, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      {toastShopName && (
        <div className="fixed inset-x-4 top-16 z-30 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span>✓</span>
          <span>
            {toastShopName} — {t("paymentRecorded")}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("allShops")}</h2>
        <Link
          href="/shops/new"
          className="flex h-11 shrink-0 items-center rounded-lg bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
        >
          + {t("addShop")}
        </Link>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        className="h-12 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]"
      />

      {shops !== null && grouped.length === 0 && (
        <p className="py-8 text-center opacity-60">{t("noResults")}</p>
      )}

      {grouped.map(([area, areaShops]) => (
        <details
          key={area}
          open
          className="rounded-lg border border-black/[.08] dark:border-white/[.12]"
        >
          <summary className="flex min-h-[44px] cursor-pointer select-none items-center px-4 py-3 text-base font-semibold">
            {area}
            <span className="ml-2 text-sm font-normal opacity-50">
              ({areaShops.length})
            </span>
          </summary>
          <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
            {areaShops.map((shop) => (
              <li
                key={shop.id}
                className="flex min-h-[56px] items-center gap-2 py-2 pl-4 pr-3"
              >
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-md py-1 active:bg-black/[.03] dark:active:bg-white/[.05]"
                >
                  <span className="truncate text-base font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-sm opacity-60">
                    {shop.tenant ? shop.tenant.name : t("vacant")}
                  </span>
                </Link>

                <StatusPill shop={shop} />

                {shop.tenant && shop.status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsPaid(shop)}
                    disabled={markingId === shop.id}
                    aria-label={t("markAsPaid")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[.12] text-lg disabled:opacity-40 dark:border-white/[.15]"
                  >
                    ✓
                  </button>
                )}

                {shop.tenant && (
                  <Link
                    href={`/payments/new?shopId=${shop.id}`}
                    aria-label={t("addPayment")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
                  >
                    ₹
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
