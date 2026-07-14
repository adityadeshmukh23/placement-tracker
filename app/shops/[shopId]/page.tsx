"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  currentMonth,
  deleteShop,
  getShopsWithCurrentStatus,
  removeTenant,
  updateMonthlyRent,
} from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { PaymentHistory } from "@/app/components/PaymentHistory";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { BackButton } from "@/app/components/BackButton";
import { FormField, inputClass } from "@/app/components/FormField";
import { deleteShopMessage, removeTenantMessage } from "@/lib/confirmMessages";
import type { TranslationKey } from "@/lib/translations";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import type { ShopWithStatus } from "@/lib/types";

export default function ShopDetailPage({
  params,
}: {
  params: { shopId: string };
}) {
  const shopId = params.shopId;
  const { t, language } = useTranslation();
  const router = useRouter();
  const [shop, setShop] = useState<ShopWithStatus | null | undefined>(
    undefined
  );
  const [confirmDeleteShop, setConfirmDeleteShop] = useState(false);
  const [confirmRemoveTenant, setConfirmRemoveTenant] = useState(false);
  const [editRentOpen, setEditRentOpen] = useState(false);
  const [savingRent, setSavingRent] = useState(false);
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

  async function handleSaveRent(newRent: number) {
    setSavingRent(true);
    await updateMonthlyRent(shopId, newRent);
    setEditRentOpen(false);
    setSavingRent(false);
    await refresh();
  }

  function handleSendReminder() {
    if (!shop?.tenant?.phone) return;
    const amountDue = Math.max(0, shop.monthlyRent - shop.collected);
    const message = buildReminderMessage({
      tenantName: shop.tenant.name,
      amountDue,
      shopName: shop.name,
      month: currentMonth(),
      language,
      tenantType: shop.tenant.type,
    });
    window.open(buildWhatsAppUrl(shop.tenant.phone, message), "_blank");
  }

  if (shop === undefined) {
    return <ShopDetailSkeleton />;
  }

  if (shop === null) {
    return <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/shops" />

      <div>
        <h2 className="text-2xl font-semibold">{shop.name}</h2>
        <p className="text-base opacity-60">{shop.area}</p>
      </div>

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-base opacity-60">{t("monthlyRent")}</span>
          <div className="flex items-center gap-1">
            <span className="truncate text-base font-medium">
              ₹{shop.monthlyRent.toLocaleString("en-IN")}
            </span>
            <button
              type="button"
              onClick={() => setEditRentOpen(true)}
              aria-label={t("editMonthlyRent")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base opacity-60"
            >
              ✏️
            </button>
          </div>
        </div>
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

        {shop.tenant && (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex gap-2">
              <a
                href={shop.tenant.phone ? `tel:${shop.tenant.phone}` : undefined}
                aria-disabled={!shop.tenant.phone}
                onClick={(e) => {
                  if (!shop.tenant?.phone) e.preventDefault();
                }}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border text-base font-semibold ${
                  shop.tenant.phone
                    ? "border-black/[.12] dark:border-white/[.15]"
                    : "border-black/[.08] opacity-30 dark:border-white/[.08]"
                }`}
              >
                📞 {t("call")}
              </a>
              {shop.status !== "paid" && (
                <button
                  type="button"
                  disabled={!shop.tenant.phone}
                  onClick={handleSendReminder}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold disabled:opacity-30 dark:border-white/[.15]"
                >
                  💬 {t("sendReminder")}
                </button>
              )}
            </div>
            {!shop.tenant.phone && (
              <p className="text-sm opacity-50">{t("noPhoneOnFile")}</p>
            )}
          </div>
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

      <PaymentHistory shopId={shopId} tenant={shop.tenant} shopName={shop.name} />

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

      <EditRentDialog
        open={editRentOpen}
        currentRent={shop.monthlyRent}
        busy={savingRent}
        onSave={handleSaveRent}
        onCancel={() => setEditRentOpen(false)}
        t={t}
      />
    </div>
  );
}

function EditRentDialog({
  open,
  currentRent,
  busy,
  onSave,
  onCancel,
  t,
}: {
  open: boolean;
  currentRent: number;
  busy: boolean;
  onSave: (newRent: number) => void;
  onCancel: () => void;
  t: (key: TranslationKey) => string;
}) {
  const [value, setValue] = useState(String(currentRent));

  useEffect(() => {
    if (open) setValue(String(currentRent));
  }, [open, currentRent]);

  if (!open) return null;

  const canSave = Number(value) > 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-[var(--background)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{t("editMonthlyRent")}</h3>
        <div className="mt-4">
          <FormField label={t("monthlyRent")}>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={!canSave || busy}
            onClick={() => onSave(Number(value))}
            className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
          >
            {busy ? t("loading") : t("save")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-14 rounded-lg border border-black/[.12] text-base font-semibold disabled:opacity-40 dark:border-white/[.15]"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
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
