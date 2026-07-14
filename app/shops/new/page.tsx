"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addShop } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";

export default function AddShopPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave =
    name.trim() !== "" && area.trim() !== "" && Number(monthlyRent) > 0;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    const id = await addShop({
      name: name.trim(),
      area: area.trim(),
      monthlyRent: Number(monthlyRent),
      address: address.trim() || undefined,
    });
    router.push(`/shops/${id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/shops" />

      <h2 className="text-xl font-semibold">{t("addShop")}</h2>

      <FormField label={t("name")}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          autoFocus
        />
      </FormField>

      <FormField label={t("area")}>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label={t("monthlyRent")}>
        <input
          type="number"
          inputMode="numeric"
          value={monthlyRent}
          onChange={(e) => setMonthlyRent(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label={`${t("address")} (${t("optional")})`}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </FormField>

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
