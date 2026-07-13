"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { FormField, inputClass } from "@/app/components/FormField";

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
    const id = await db.shops.add({
      name: name.trim(),
      area: area.trim(),
      monthlyRent: Number(monthlyRent),
      address: address.trim() || undefined,
      createdAt: new Date(),
    });
    router.push(`/shops/${id}`);
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
        {t("save")}
      </button>
    </div>
  );
}
