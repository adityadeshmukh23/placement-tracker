"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getShopsWithCurrentStatus } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { PaymentHistory } from "@/app/components/PaymentHistory";
import type { ShopWithStatus } from "@/lib/types";

export default function ShopDetailPage({
  params,
}: {
  params: { shopId: string };
}) {
  const shopId = Number(params.shopId);
  const { t } = useTranslation();
  const router = useRouter();
  const [shop, setShop] = useState<ShopWithStatus | null | undefined>(
    undefined
  );

  useEffect(() => {
    (async () => {
      const shops = await getShopsWithCurrentStatus();
      setShop(shops.find((s) => s.id === shopId) ?? null);
    })();
  }, [shopId]);

  if (shop === undefined) return null;

  if (shop === null) {
    return <p className="py-8 text-center opacity-60">{t("noResults")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex h-11 w-fit items-center text-sm opacity-70"
      >
        ← {t("back")}
      </button>

      <div>
        <h2 className="text-2xl font-semibold">{shop.name}</h2>
        <p className="text-sm opacity-60">{shop.area}</p>
      </div>

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
        <DetailRow
          label={t("monthlyRent")}
          value={`₹${shop.monthlyRent.toLocaleString("en-IN")}`}
        />
        {shop.address && (
          <DetailRow label={t("address")} value={shop.address} />
        )}
      </div>

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="mb-2 text-base font-semibold">{t("tenant")}</h3>
        {shop.tenant ? (
          <div className="flex flex-col gap-1">
            <DetailRow label={t("name")} value={shop.tenant.name} />
            {shop.tenant.phone && (
              <DetailRow label={t("phone")} value={shop.tenant.phone} />
            )}
            <DetailRow
              label={t("tenantType")}
              value={shop.tenant.type === "family" ? t("family") : t("regular")}
            />
          </div>
        ) : (
          <p className="opacity-60">{t("vacant")}</p>
        )}
        <Link
          href={`/shops/${shopId}/tenants/new`}
          className="mt-4 flex h-12 items-center justify-center rounded-lg border border-black/[.12] text-sm font-semibold dark:border-white/[.15]"
        >
          + {t("addTenant")}
        </Link>
      </div>

      <PaymentHistory shopId={shopId} tenant={shop.tenant} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm opacity-60">{label}</span>
      <span className="truncate text-base font-medium">{value}</span>
    </div>
  );
}
