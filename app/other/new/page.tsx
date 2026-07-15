"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addOtherTransaction } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { getOrAskLoggedByName } from "@/lib/loggedBy";
import { downscaleImageFile } from "@/lib/image";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";
import type { TransactionCategory, TransactionDirection } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

const CATEGORIES: TransactionCategory[] = [
  "medical",
  "insurance",
  "family",
  "donation",
  "personal",
  "other",
];

const CATEGORY_KEY: Record<TransactionCategory, TranslationKey> = {
  medical: "categoryMedical",
  insurance: "categoryInsurance",
  family: "family",
  donation: "categoryDonation",
  personal: "categoryPersonal",
  other: "other",
};

function todayInputValue(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AddOtherTransactionPage() {
  return (
    <Suspense fallback={null}>
      <AddOtherTransactionForm />
    </Suspense>
  );
}

function AddOtherTransactionForm() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/other";

  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<TransactionDirection>("out");
  const [category, setCategory] = useState<TransactionCategory>("medical");
  const [categoryOther, setCategoryOther] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const canSave =
    Number(amount) > 0 &&
    date !== "" &&
    (category !== "other" || categoryOther.trim() !== "") &&
    !saving;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await downscaleImageFile(file);
    setPhoto(dataUrl);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const loggedBy = getOrAskLoggedByName(language);
    await addOtherTransaction({
      amount: Number(amount),
      direction,
      category,
      categoryOther: category === "other" ? categoryOther.trim() : undefined,
      description: description.trim() || undefined,
      date: new Date(date),
      loggedBy,
      photo,
    });
    router.push(from);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref={from} />

      <h2 className="text-xl font-semibold">{t("addOtherTransaction")}</h2>

      <div className="flex gap-2">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`h-14 flex-1 rounded-lg border text-base font-medium ${
              direction === d
                ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
                : "border-black/[.12] dark:border-white/[.15]"
            }`}
          >
            {d === "out" ? t("moneyOut") : t("moneyIn")}
          </button>
        ))}
      </div>

      <FormField label={t("amount")}>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
          autoFocus
        />
      </FormField>

      <FormField label={t("date")}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium opacity-70">{t("category")}</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`h-11 rounded-full border px-4 text-base font-medium ${
                category === c
                  ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
                  : "border-black/[.12] dark:border-white/[.15]"
              }`}
            >
              {t(CATEGORY_KEY[c])}
            </button>
          ))}
        </div>
      </div>

      {category === "other" && (
        <FormField label={t("specifyCategory")}>
          <input
            value={categoryOther}
            onChange={(e) => setCategoryOther(e.target.value)}
            className={inputClass}
          />
        </FormField>
      )}

      <FormField label={`${t("notes")} (${t("optional")})`}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} h-auto py-3`}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium opacity-70">
          {t("addPhoto")} ({t("optional")})
        </span>
        {photo ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="max-h-56 w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => setPhoto(undefined)}
              className="h-11 rounded-lg border border-red-600/30 text-base font-semibold text-red-700 dark:text-red-400"
            >
              {t("removePhoto")}
            </button>
          </div>
        ) : (
          <label className="flex h-14 cursor-pointer items-center justify-center rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]">
            {t("addPhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      <button
        type="button"
        disabled={!canSave}
        onClick={handleSave}
        className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
      >
        {saving ? t("loading") : t("save")}
      </button>
    </div>
  );
}
