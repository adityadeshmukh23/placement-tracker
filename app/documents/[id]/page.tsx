"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db, updateDocument } from "@/lib/db";
import { getDocumentSignedUrl } from "@/lib/storage";
import { isSensitiveUnlocked, grantSensitiveUnlock } from "@/lib/sensitiveUnlock";
import { useTranslation } from "@/lib/useTranslation";
import { FormField, inputClass } from "@/app/components/FormField";
import { BackButton } from "@/app/components/BackButton";
import { SensitivePinModal } from "@/app/components/SensitivePinModal";
import type {
  DocumentCategory,
  DocumentOwner,
  FamilyDocument,
} from "@/lib/types";
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

function ownerLabel(doc: FamilyDocument, t: (k: TranslationKey) => string): string {
  if (doc.belongsTo === "other" && doc.belongsToOther) return doc.belongsToOther;
  return t(OWNER_KEY[doc.belongsTo]);
}

function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const { t, language } = useTranslation();
  const router = useRouter();
  const [doc, setDoc] = useState<FamilyDocument | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [opening, setOpening] = useState(false);

  // Edit-mode form state.
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("identity");
  const [categoryOther, setCategoryOther] = useState("");
  const [belongsTo, setBelongsTo] = useState<DocumentOwner>("family");
  const [belongsToOther, setBelongsToOther] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.documents.get(id).then((record) => {
      setDoc(record && !record.deletedAt ? record : null);
    });
  }, [id]);

  useEffect(() => {
    setUnlocked(isSensitiveUnlocked());
  }, [doc]);

  const locale = language === "mr" ? "mr-IN" : "en-IN";
  const locked = doc?.sensitive === true && !unlocked;

  function startEditing() {
    if (!doc) return;
    setTitle(doc.title);
    setCategory(doc.category);
    setCategoryOther(doc.categoryOther ?? "");
    setBelongsTo(doc.belongsTo);
    setBelongsToOther(doc.belongsToOther ?? "");
    setExpiryDate(doc.expiryDate ? dateInputValue(doc.expiryDate) : "");
    setNotes(doc.notes ?? "");
    setSensitive(doc.sensitive);
    setEditing(true);
  }

  const canSave =
    title.trim() !== "" &&
    (category !== "other" || categoryOther.trim() !== "") &&
    (belongsTo !== "other" || belongsToOther.trim() !== "") &&
    !saving;

  async function handleSaveEdit() {
    if (!canSave) return;
    setSaving(true);
    await updateDocument(id, {
      title: title.trim(),
      category,
      categoryOther: category === "other" ? categoryOther.trim() : undefined,
      belongsTo,
      belongsToOther: belongsTo === "other" ? belongsToOther.trim() : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      notes: notes.trim() || undefined,
      sensitive,
    });
    const record = await db.documents.get(id);
    setDoc(record && !record.deletedAt ? record : null);
    setSaving(false);
    setEditing(false);
  }

  async function handleOpenFile() {
    if (!doc || opening) return;
    setOpening(true);
    const url = await getDocumentSignedUrl(doc.fileUrl);
    setOpening(false);
    if (url) window.open(url, "_blank");
  }

  function handleUnlock() {
    grantSensitiveUnlock();
    setUnlocked(true);
  }

  if (doc === undefined) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-11 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-32 animate-pulse rounded-lg bg-black/[.03] dark:bg-white/[.05]" />
      </div>
    );
  }

  if (doc === null) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/documents" />
        <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/documents" />
        <SensitivePinModal
          open
          onCancel={() => router.push("/documents")}
          onUnlock={handleUnlock}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex h-11 w-fit items-center gap-1.5 text-base opacity-70"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("back")}
        </button>

        <h2 className="text-xl font-semibold">{t("edit")}</h2>

        <FormField label={t("documentTitle")}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={() => setSensitive((prev) => !prev)}
            className="h-6 w-6 shrink-0"
          />
        </label>

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSaveEdit}
          className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
        >
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/documents" />

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.12]">
        <h2 className="text-xl font-semibold">{doc.title}</h2>

        <div className="mt-4 flex flex-col gap-1">
          <DetailRow
            label={t("category")}
            value={
              doc.category === "other" && doc.categoryOther
                ? doc.categoryOther
                : t(CATEGORY_KEY[doc.category])
            }
          />
          <DetailRow label={t("belongsTo")} value={ownerLabel(doc, t)} />
          {doc.expiryDate && (
            <DetailRow
              label={t("expiryDate")}
              value={doc.expiryDate.toLocaleDateString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          )}
          {doc.notes && <DetailRow label={t("notes")} value={doc.notes} />}
          <DetailRow label={t("uploadedBy")} value={doc.uploadedBy} />
        </div>
      </div>

      <button
        type="button"
        disabled={opening}
        onClick={handleOpenFile}
        className="flex h-14 items-center justify-center gap-2 rounded-lg border border-black/[.12] text-base font-semibold disabled:opacity-40 dark:border-white/[.15]"
      >
        <ExternalLink className="h-5 w-5" />
        {opening ? t("loading") : t("viewDownload")}
      </button>

      <button
        type="button"
        onClick={startEditing}
        className="h-12 rounded-lg border border-black/[.12] text-base font-semibold dark:border-white/[.15]"
      >
        {t("edit")}
      </button>
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
