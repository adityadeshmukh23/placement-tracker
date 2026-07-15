"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, FolderLock, Image as ImageIcon, Lock, Plus } from "lucide-react";
import { getDocuments } from "@/lib/db";
import { isSyncConfigured } from "@/lib/supabase";
import { isSensitiveUnlocked, grantSensitiveUnlock } from "@/lib/sensitiveUnlock";
import { SYNCED_EVENT } from "@/lib/sync";
import { useTranslation } from "@/lib/useTranslation";
import { BackButton } from "@/app/components/BackButton";
import { SensitivePinModal } from "@/app/components/SensitivePinModal";
import type { DocumentCategory, FamilyDocument } from "@/lib/types";
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

function categoryLabel(doc: FamilyDocument, t: (k: TranslationKey) => string): string {
  if (doc.category === "other" && doc.categoryOther) return doc.categoryOther;
  return t(CATEGORY_KEY[doc.category]);
}

function ownerLabel(doc: FamilyDocument, t: (k: TranslationKey) => string): string {
  if (doc.belongsTo === "other" && doc.belongsToOther) return doc.belongsToOther;
  if (doc.belongsTo === "father") return t("ownerFather");
  if (doc.belongsTo === "mother") return t("ownerMother");
  if (doc.belongsTo === "family") return t("ownerFamily");
  return t("other");
}

/** "Father" -> "F●●●●●" — enough to recognize the entry, not read it. */
function obscureLabel(label: string): string {
  if (label.length <= 1) return label;
  return label[0] + "●".repeat(label.length - 1);
}

/** Null when there's no expiry, or it's more than 60 days away. */
function expiryUrgency(expiryDate?: Date): "expired" | "soon" | null {
  if (!expiryDate) return null;
  const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= 60) return "soon";
  return null;
}

export default function DocumentsPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<FamilyDocument[] | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<FamilyDocument | null>(null);

  const locale = language === "mr" ? "mr-IN" : "en-IN";

  useEffect(() => {
    if (!isSyncConfigured) return;
    const refresh = () => getDocuments({ keyword: keyword || undefined }).then(setResults);
    refresh();
    window.addEventListener(SYNCED_EVENT, refresh);
    return () => window.removeEventListener(SYNCED_EVENT, refresh);
  }, [keyword]);

  // Sensitive rows re-lock on their own once the unlock window elapses, even
  // without a fresh navigation — poll rather than relying on a one-off check.
  useEffect(() => {
    setUnlocked(isSensitiveUnlocked());
    const interval = setInterval(() => setUnlocked(isSensitiveUnlocked()), 15000);
    return () => clearInterval(interval);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<DocumentCategory, FamilyDocument[]>();
    for (const doc of results ?? []) {
      const list = map.get(doc.category) ?? [];
      list.push(doc);
      map.set(doc.category, list);
    }
    return CATEGORIES.filter((c) => map.has(c)).map((c) => ({
      category: c,
      docs: map.get(c)!,
    }));
  }, [results]);

  function handleRowClick(doc: FamilyDocument) {
    if (doc.sensitive && !isSensitiveUnlocked()) {
      setPendingDoc(doc);
      return;
    }
    router.push(`/documents/${doc.id}`);
  }

  function handleUnlock() {
    grantSensitiveUnlock();
    setUnlocked(true);
    const doc = pendingDoc;
    setPendingDoc(null);
    if (doc) router.push(`/documents/${doc.id}`);
  }

  if (!isSyncConfigured) {
    return (
      <div className="flex flex-col gap-5">
        <BackButton fallbackHref="/more" />
        <h2 className="text-xl font-semibold">{t("familyDocuments")}</h2>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/[.15] px-6 py-12 text-center dark:border-white/[.2]">
          <FolderLock className="h-10 w-10 opacity-50" />
          <p className="text-base opacity-70">{t("documentsRequireSync")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/more" />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("familyDocuments")}</h2>
        <Link
          href="/documents/new"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-4 text-base font-semibold text-[var(--background)]"
        >
          <Plus className="h-4 w-4" />
          {t("addDocument")}
        </Link>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={t("search")}
        className="h-12 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]"
      />

      {results === null ? (
        <GroupsSkeleton />
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-base opacity-60">{t("noDocumentsYet")}</p>
      ) : (
        grouped.map(({ category, docs }) => (
          <details
            key={category}
            open
            className="rounded-lg border border-black/[.08] dark:border-white/[.12]"
          >
            <summary className="flex min-h-[48px] cursor-pointer select-none items-center px-4 py-3 text-base font-semibold">
              {t(CATEGORY_KEY[category])}
              <span className="ml-2 text-base font-normal opacity-50">
                ({docs.length})
              </span>
            </summary>
            <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
              {docs.map((doc) => {
                const urgency = expiryUrgency(doc.expiryDate);
                const locked = doc.sensitive && !unlocked;
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(doc)}
                      className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[.03] dark:active:bg-white/[.05]"
                    >
                      {locked ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/[.08] opacity-80 blur-[1px] dark:bg-white/[.1]">
                          <Lock className="h-4 w-4" />
                        </div>
                      ) : doc.fileType === "image" ? (
                        <ImageIcon className="h-5 w-5 shrink-0 opacity-60" />
                      ) : (
                        <FileText className="h-5 w-5 shrink-0 opacity-60" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base font-medium">
                          {doc.title}
                        </span>
                        <span className="truncate text-base opacity-60">
                          {locked ? obscureLabel(ownerLabel(doc, t)) : ownerLabel(doc, t)}
                        </span>
                      </div>
                      {doc.expiryDate && (
                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                            urgency === "expired"
                              ? "bg-red-600/15 text-red-700 dark:text-red-400"
                              : urgency === "soon"
                              ? "bg-amber-600/15 text-amber-700 dark:text-amber-400"
                              : "bg-black/[.05] opacity-60 dark:bg-white/[.08]"
                          }`}
                        >
                          {urgency === "expired"
                            ? t("documentExpired")
                            : urgency === "soon"
                            ? t("documentExpiringSoon")
                            : doc.expiryDate.toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        ))
      )}

      <SensitivePinModal
        open={pendingDoc !== null}
        onCancel={() => setPendingDoc(null)}
        onUnlock={handleUnlock}
      />
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((g) => (
        <div
          key={g}
          className="rounded-lg border border-black/[.08] dark:border-white/[.12]"
        >
          <div className="flex min-h-[48px] items-center px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.08]">
            {[0, 1].map((i) => (
              <div key={i} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
                <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
                  <div className="h-4 w-20 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
