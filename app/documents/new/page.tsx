"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, FolderLock, Upload } from "lucide-react";
import { addDocument } from "@/lib/db";
import { uploadDocumentFile } from "@/lib/storage";
import { isSyncConfigured } from "@/lib/supabase";
import { useTranslation } from "@/lib/useTranslation";
import { getOrAskLoggedByName } from "@/lib/loggedBy";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";
import type { DocumentCategory, DocumentOwner } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

const CATEGORIES: DocumentCategory[] = [
  "identity",
  "property",
  "insurance",
  "medical",
  "financial",
  "certificates",
  "vehicle",
  "other",
];

const CATEGORY_KEY: Record<DocumentCategory, TranslationKey> = {
  identity: "categoryIdentity",
  property: "categoryProperty",
  insurance: "categoryInsurance",
  medical: "categoryMedical",
  financial: "categoryFinancial",
  certificates: "categoryCertificates",
  vehicle: "categoryVehicle",
  other: "other",
};

const OWNERS: DocumentOwner[] = ["father", "mother", "family", "other"];

const OWNER_KEY: Record<DocumentOwner, TranslationKey> = {
  father: "ownerFather",
  mother: "ownerMother",
  family: "ownerFamily",
  other: "other",
};

/** Identity and Financial documents default to sensitive; the rest don't. */
function defaultSensitive(category: DocumentCategory): boolean {
  return category === "identity" || category === "financial";
}

export default function AddDocumentPage() {
  return (
    <Suspense fallback={null}>
      <AddDocumentForm />
    </Suspense>
  );
}

function AddDocumentForm() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/documents";

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("identity");
  const [categoryOther, setCategoryOther] = useState("");
  const [belongsTo, setBelongsTo] = useState<DocumentOwner>("family");
  const [belongsToOther, setBelongsToOther] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sensitive, setSensitive] = useState(defaultSensitive("identity"));
  const [sensitiveTouched, setSensitiveTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function handleCategoryChange(next: DocumentCategory) {
    setCategory(next);
    if (!sensitiveTouched) setSensitive(defaultSensitive(next));
  }

  function handleSensitiveToggle() {
    setSensitiveTouched(true);
    setSensitive((prev) => !prev);
  }

  const canSave =
    file != null &&
    title.trim() !== "" &&
    (category !== "other" || categoryOther.trim() !== "") &&
    (belongsTo !== "other" || belongsToOther.trim() !== "") &&
    !saving;

  async function handleSave() {
    if (!file || !canSave) return;
    setSaving(true);
    setError(false);

    const uploaded = await uploadDocumentFile(file);
    if ("error" in uploaded) {
      setError(true);
      setSaving(false);
      return;
    }

    const uploadedBy = getOrAskLoggedByName(language);
    await addDocument({
      title: title.trim(),
      category,
      categoryOther: category === "other" ? categoryOther.trim() : undefined,
      belongsTo,
      belongsToOther: belongsTo === "other" ? belongsToOther.trim() : undefined,
      fileUrl: uploaded.path,
      fileType: file.type.startsWith("image/") ? "image" : "pdf",
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      notes: notes.trim() || undefined,
      uploadedBy,
      sensitive,
    });
    router.push(from);
  }

  if (!isSyncConfigured) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref={from} />
        <h2 className="text-xl font-semibold">{t("addDocument")}</h2>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/[.15] px-6 py-12 text-center dark:border-white/[.2]">
          <FolderLock className="h-10 w-10 opacity-50" />
          <p className="text-base opacity-70">{t("documentsRequireSync")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref={from} />

      <h2 className="text-xl font-semibold">{t("addDocument")}</h2>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-black/[.12] px-4 py-3 dark:border-white/[.15]">
          <span className="truncate text-base font-medium">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="shrink-0 text-base font-semibold opacity-60"
          >
            {t("cancel")}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <label className="flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]">
            <Camera className="h-5 w-5" />
            {t("takePhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <label className="flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]">
            <Upload className="h-5 w-5" />
            {t("chooseFile")}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>
      )}

      {file && (
        <>
          <FormField label={t("documentTitle")}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </FormField>

          <div className="flex flex-col gap-1.5">
            <span className="text-base font-medium opacity-70">{t("category")}</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCategoryChange(c)}
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

          <div className="flex flex-col gap-1.5">
            <span className="text-base font-medium opacity-70">{t("belongsTo")}</span>
            <div className="flex flex-wrap gap-2">
              {OWNERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setBelongsTo(o)}
                  className={`h-11 rounded-full border px-4 text-base font-medium ${
                    belongsTo === o
                      ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
                      : "border-black/[.12] dark:border-white/[.15]"
                  }`}
                >
                  {t(OWNER_KEY[o])}
                </button>
              ))}
            </div>
          </div>

          {belongsTo === "other" && (
            <FormField label={t("specifyOwner")}>
              <input
                value={belongsToOther}
                onChange={(e) => setBelongsToOther(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}

          <FormField label={`${t("expiryDate")} (${t("optional")})`}>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label={`${t("notes")} (${t("optional")})`}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClass} h-auto py-3`}
            />
          </FormField>

          <label className="flex h-14 items-center justify-between rounded-lg border border-black/[.12] px-4 dark:border-white/[.15]">
            <span className="text-base font-medium">{t("sensitiveDocument")}</span>
            <input
              type="checkbox"
              checked={sensitive}
              onChange={handleSensitiveToggle}
              className="h-6 w-6 shrink-0"
            />
          </label>

          {error && (
            <p className="text-base text-red-600 dark:text-red-400">
              {t("uploadFailed")}
            </p>
          )}

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
          >
            {saving ? t("uploading") : t("save")}
          </button>
        </>
      )}
    </div>
  );
}
