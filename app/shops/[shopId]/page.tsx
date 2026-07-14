"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteShop, getShopsWithCurrentStatus, removeTenant } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { PaymentHistory } from "@/app/components/PaymentHistory";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { deleteShopMessage, removeTenantMessage } from "@/lib/confirmMessages";
import type { ShopWithStatus } from "@/lib/types";

export default function ShopDetailPage({
  params,
}: {
  params: { shopId: string };
}) {
  const shopId = Number(params.shopId);
  const { t, language } = useTranslation();
  const router = useRouter();
  const [shop, setShop] = useState<ShopWithStatus | null | undefined>(
    undefined
  );
  const [confirmDeleteShop, setConfirmDeleteShop] = useState(false);
  const [confirmRemoveTenant, setConfirmRemoveTenant] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const shops = await getShopsWithCurrentStatus();
    setShop(shops.find((s) => s.id === shopId) ?? null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  async function handleConfirmDeleteShop() {
    setBusy(true);
    await deleteShop(shopId);
    router.push("/shops");
  }

  async function handleConfirmRemoveTenant() {
    if (!shop?.tenant?.id) return;
    setBusy(true);
    await removeTenant(shop.tenant.id);
    setConfirmRemoveTenant(false);
    setBusy(false);
    await refresh();
  }

  if (shop === undefined) {
    return <ShopDetailSkeleton />;
  }

  if (shop === null) {
    return <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex h-11 w-fit items-center text-base opacity-70"
      >
        ← {t("back")}
      </button>

      <div>
        <h2 className="text-2xl font-semibold">{shop.name}</h2>
        <p className="text-base opacity-60">{shop.area}</p>
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
          <p className="text-base opacity-60">{t("vacant")}</p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={`/shops/${shopId}/tenants/new`}
            className="flex h-12 items-center justify-center rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
          >
            + {t("addTenant")}
          </Link>
          {shop.tenant && (
            <button
              type="button"
              onClick={() => setConfirmRemoveTenant(true)}
              className="flex h-12 items-center justify-center rounded-lg border border-red-600/30 text-base font-semibold text-red-700 dark:text-red-400"
            >
              {t("removeTenant")}
            </button>
          )}
        </div>
      </div>

      <PaymentHistory shopId={shopId} tenant={shop.tenant} />

      <button
        type="button"
        onClick={() => setConfirmDeleteShop(true)}
        className="flex h-12 items-center justify-center rounded-lg text-base font-semibold text-red-700 dark:text-red-400"
      >
        {t("deleteShop")}
      </button>

      <ConfirmDialog
        open={confirmDeleteShop}
        title={t("areYouSure")}
        message={deleteShopMessage(shop.name, language)}
        confirmLabel={t("deleteShop")}
        busy={busy}
        onConfirm={handleConfirmDeleteShop}
        onCancel={() => setConfirmDeleteShop(false)}
      />

      {shop.tenant && (
        <ConfirmDialog
          open={confirmRemoveTenant}
          title={t("areYouSure")}
          message={removeTenantMessage(shop.tenant.name, shop.name, language)}
          confirmLabel={t("removeTenant")}
          busy={busy}
          onConfirm={handleConfirmRemoveTenant}
          onCancel={() => setConfirmRemoveTenant(false)}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-base opacity-60">{label}</span>
      <span className="truncate text-base font-medium">{value}</span>
    </div>
  );
}

function ShopDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-11 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-5 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      </div>
      <div className="h-20 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]" />
      <div className="h-32 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]" />
      <div className="h-40 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]" />
    </div>
  );
}
