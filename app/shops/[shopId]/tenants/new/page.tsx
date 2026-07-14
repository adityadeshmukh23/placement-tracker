"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, addTenant } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";
import type { Shop, TenantType } from "@/lib/types";

export default function AddTenantPage({
  params,
}: {
  params: { shopId: string };
}) {
  const shopId = params.shopId;
  const { t } = useTranslation();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<TenantType>("regular");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.shops.get(shopId).then((s) => setShop(s ?? null));
  }, [shopId]);

  const canSave = name.trim() !== "";

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    await addTenant({
      shopId,
      name: name.trim(),
      phone: phone.trim() || undefined,
      type,
    });
    router.push(`/shops/${shopId}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref={`/shops/${shopId}`} />

      <div>
        <h2 className="text-xl font-semibold">{t("addTenant")}</h2>
        {shop && <p className="text-base opacity-60">{shop.name}</p>}
      </div>

      <FormField label={t("name")}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          autoFocus
        />
      </FormField>

      <FormField label={`${t("phone")} (${t("optional")})`}>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium opacity-70">
          {t("tenantType")}
        </span>
        <div className="flex gap-2">
          <ToggleOption
            active={type === "regular"}
            label={t("regular")}
            onClick={() => setType("regular")}
          />
          <ToggleOption
            active={type === "family"}
            label={t("family")}
            onClick={() => setType("family")}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!canSave || saving}
        onClick={handleSave}
        className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
      >
        {saving ? t("loading") : t("save")}
      </button>
    </div>
  );
}

function ToggleOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 flex-1 rounded-lg border text-base font-medium ${
        active
          ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
          : "border-black/[.12] dark:border-white/[.15]"
      }`}
    >
      {label}
    </button>
  );
}
