"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, deleteOtherTransaction, updateOtherTransaction } from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { downscaleImageFile } from "@/lib/image";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { deleteOtherTransactionMessage } from "@/lib/confirmMessages";
import type {
  OtherTransaction,
  TransactionCategory,
  TransactionDirection,
} from "@/lib/types";
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

function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function OtherTransactionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const { t, language } = useTranslation();
  const router = useRouter();
  const [tx, setTx] = useState<OtherTransaction | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit-mode form state.
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<TransactionDirection>("out");
  const [category, setCategory] = useState<TransactionCategory>("medical");
  const [categoryOther, setCategoryOther] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  async function refresh() {
    const record = await db.otherTransactions.get(id);
    setTx(record && !record.deletedAt ? record : null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEditing() {
    if (!tx) return;
    setAmount(String(tx.amount));
    setDirection(tx.direction);
    setCategory(tx.category);
    setCategoryOther(tx.categoryOther ?? "");
    setDescription(tx.description ?? "");
    setDate(dateInputValue(tx.date));
    setPhoto(tx.photo);
    setEditing(true);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(await downscaleImageFile(file));
  }

  const canSave =
    Number(amount) > 0 &&
    date !== "" &&
    (category !== "other" || categoryOther.trim() !== "");

  async function handleSaveEdit() {
    if (!canSave || busy) return;
    setBusy(true);
    await updateOtherTransaction(id, {
      amount: Number(amount),
      direction,
      category,
      categoryOther: category === "other" ? categoryOther.trim() : undefined,
      description: description.trim() || undefined,
      date: new Date(date),
      photo,
    });
    setBusy(false);
    setEditing(false);
    await refresh();
  }

  async function handleConfirmDelete() {
    setBusy(true);
    await deleteOtherTransaction(id);
    router.push("/other");
  }

  if (tx === undefined) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-11 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-32 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]" />
      </div>
    );
  }

  if (tx === null) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/other" />
        <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>
      </div>
    );
  }

  const locale = language === "mr" ? "mr-IN" : "en-IN";

  if (editing) {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex h-11 w-fit items-center text-base opacity-70"
        >
          ← {t("back")}
        </button>

        <h2 className="text-xl font-semibold">{t("edit")}</h2>

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
          disabled={!canSave || busy}
          onClick={handleSaveEdit}
          className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
        >
          {busy ? t("loading") : t("save")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/other" />

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-2xl font-bold ${
              tx.direction === "out"
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {tx.direction === "out" ? "−" : "+"}₹{tx.amount.toLocaleString("en-IN")}
          </span>
          <span className="text-base opacity-60">
            {tx.date.toLocaleDateString(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <DetailRow
            label={t("category")}
            value={
              tx.category === "other" && tx.categoryOther
                ? tx.categoryOther
                : t(CATEGORY_KEY[tx.category])
            }
          />
          {tx.description && (
            <DetailRow label={t("notes")} value={tx.description} />
          )}
          <DetailRow label={t("loggedBy")} value={tx.loggedBy} />
        </div>

        {tx.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tx.photo}
            alt=""
            className="mt-4 max-h-64 w-full rounded-lg object-contain"
          />
        )}
      </div>

      <button
        type="button"
        onClick={startEditing}
        className="h-12 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
      >
        {t("edit")}
      </button>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="flex h-12 items-center justify-center rounded-lg text-base font-semibold text-red-700 dark:text-red-400"
      >
        {t("delete")}
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title={t("areYouSure")}
        message={deleteOtherTransactionMessage(tx.amount, language)}
        confirmLabel={t("delete")}
        busy={busy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
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
