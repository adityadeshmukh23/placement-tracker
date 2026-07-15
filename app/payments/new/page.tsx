"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircle, Plus } from "lucide-react";
import {
  currentMonth,
  getShopsWithCurrentStatus,
  getUsualAmount,
  recordPayment,
} from "@/lib/db";
import { useTranslation } from "@/lib/useTranslation";
import { FormField, inputClass } from "@/app/components/FormField";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { BackButton } from "@/app/components/BackButton";
import { buildReceiptMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { alreadyPaidMessage, recordAnywayConfirmMessage } from "@/lib/confirmMessages";
import type { PaymentMode, ShopWithStatus } from "@/lib/types";

interface SavedPayment {
  shopId: string;
  shopName: string;
  tenantPhone?: string;
  amount: number;
  month: string;
}

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function todayInputValue(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AddPaymentPage() {
  return (
    <Suspense fallback={null}>
      <AddPaymentForm />
    </Suspense>
  );
}

function AddPaymentForm() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedShopId = searchParams.get("shopId");
  // Where to return to when done — the screen this flow was actually opened
  // from (a shop row, the FAB from wherever it was tapped, etc.), not a
  // screen hardcoded regardless of origin. Falls back to the shop list for
  // old links that don't carry it.
  const from = searchParams.get("from") || "/shops";

  const [shops, setShops] = useState<ShopWithStatus[] | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(
    preselectedShopId
  );
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedPayment, setSavedPayment] = useState<SavedPayment | null>(null);
  const [recordAnyway, setRecordAnyway] = useState(false);
  const [confirmRecordAnyway, setConfirmRecordAnyway] = useState(false);

  useEffect(() => {
    getShopsWithCurrentStatus().then(setShops);
  }, []);

  const selectedShop = useMemo(
    () => shops?.find((s) => s.id === selectedShopId) ?? null,
    [shops, selectedShopId]
  );

  useEffect(() => {
    if (!selectedShopId) return;
    getUsualAmount(selectedShopId).then((usual) => setAmount(String(usual)));
    setRecordAnyway(false);
  }, [selectedShopId]);

  const occupiedShops = useMemo(
    () => (shops ?? []).filter((s) => s.tenant !== null),
    [shops]
  );

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return occupiedShops;
    return occupiedShops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tenant?.name.toLowerCase().includes(q) ?? false)
    );
  }, [occupiedShops, query]);

  const month = currentMonth();
  const locale = language === "mr" ? "mr-IN" : "en-IN";
  const monthLabel = formatMonthLabel(month, locale);
  const alreadyPaid = selectedShop?.status === "paid";

  const canSave =
    selectedShop?.tenant != null &&
    Number(amount) > 0 &&
    date !== "" &&
    !saving &&
    (!alreadyPaid || recordAnyway);

  async function handleSave() {
    if (!selectedShop?.tenant || !canSave) return;
    setSaving(true);
    await recordPayment({
      shopId: selectedShop.id,
      tenantId: selectedShop.tenant.id,
      amount: Number(amount),
      dueMonth: month,
      datePaid: new Date(date),
      paymentMode: mode,
      notes: notes.trim() || undefined,
    });
    setSavedPayment({
      shopId: selectedShop.id,
      shopName: selectedShop.name,
      tenantPhone: selectedShop.tenant.phone,
      amount: Number(amount),
      month,
    });
  }

  function handleSendReceipt() {
    if (!savedPayment?.tenantPhone) return;
    const message = buildReceiptMessage({
      amount: savedPayment.amount,
      shopName: savedPayment.shopName,
      month: savedPayment.month,
      language,
    });
    window.open(buildWhatsAppUrl(savedPayment.tenantPhone, message), "_blank");
  }

  function handleDone() {
    if (!savedPayment) return;
    router.push(`${from}?paymentSaved=${savedPayment.shopId}`);
  }

  /** Back from the step-2 form: a real previous step (the shop picker) if we
   * came from there, otherwise the true origin screen — with a safe fallback
   * if there's no in-app history to go back to. */
  function handleBackFromForm() {
    if (!preselectedShopId) {
      setSelectedShopId(null);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(from);
    }
  }

  // Step 3: payment recorded — offer to send a WhatsApp receipt before leaving.
  if (savedPayment) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/[.08] p-6 text-center dark:border-white/[.12]">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          <p className="text-base font-semibold">{t("paymentRecorded")}</p>
          <p className="text-base opacity-60">
            {savedPayment.shopName} · ₹{savedPayment.amount.toLocaleString("en-IN")}
          </p>
        </div>

        {savedPayment.tenantPhone ? (
          <button
            type="button"
            onClick={handleSendReceipt}
            className="flex h-14 items-center justify-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 text-base font-semibold text-green-700 dark:text-green-400"
          >
            <MessageCircle className="h-5 w-5" /> {t("sendReceipt")}
          </button>
        ) : (
          <p className="text-center text-base opacity-50">{t("noPhoneOnFile")}</p>
        )}

        <button
          type="button"
          onClick={handleDone}
          className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)]"
        >
          {t("done")}
        </button>
      </div>
    );
  }

  // Step 1: pick a shop (skipped when arriving pre-selected from a shop row).
  if (!selectedShopId) {
    return (
      <div className="flex flex-col gap-4">
        <BackButton fallbackHref={from} />

        <h2 className="text-xl font-semibold">{t("addPayment")}</h2>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          autoFocus
          className="h-12 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]"
        />

        {shops === null && <ShopPickerSkeleton />}

        {shops !== null && filteredShops.length === 0 && (
          <p className="py-8 text-center text-base opacity-60">{t("noResults")}</p>
        )}

        <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
          {filteredShops.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                onClick={() => setSelectedShopId(shop.id!)}
                className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[.03] dark:active:bg-white/[.05]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-medium">
                    {shop.name}
                  </span>
                  <span className="truncate text-base opacity-60">
                    {shop.tenant?.name}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Step 2: the payment form for the selected shop.
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={handleBackFromForm}
        className="flex h-11 w-fit items-center gap-1.5 text-base opacity-70"
      >
        <ArrowLeft className="h-5 w-5" />
        {t("back")}
      </button>

      <div>
        <h2 className="text-xl font-semibold">{t("addPayment")}</h2>
        {selectedShop && (
          <p className="text-base opacity-60">
            {selectedShop.name} · {selectedShop.tenant?.name}
          </p>
        )}
      </div>

      {alreadyPaid && (
        <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3 text-base text-amber-800 dark:text-amber-400">
          <p>{alreadyPaidMessage(monthLabel, language)}</p>
          {recordAnyway ? (
            <p className="mt-2 text-sm font-medium">
              {t("recordingAnywayConfirmed")}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRecordAnyway(true)}
              className="mt-2 flex h-11 items-center rounded-lg border border-amber-600/40 px-3 text-base font-semibold"
            >
              {t("recordAnyway")}
            </button>
          )}
        </div>
      )}

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
        <span className="text-base font-medium opacity-70">
          {t("paymentMode")}
        </span>
        <div className="flex gap-2">
          {(["cash", "upi", "cheque"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-14 flex-1 rounded-lg border text-base font-medium ${
                mode === m
                  ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
                  : "border-black/[.12] dark:border-white/[.15]"
              }`}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>

      {!notesOpen ? (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="flex h-11 w-fit items-center gap-1.5 text-base font-medium opacity-70"
        >
          <Plus className="h-4 w-4" />
          {t("addNote")}
        </button>
      ) : (
        <FormField label={t("notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            autoFocus
            className={`${inputClass} h-auto py-3`}
          />
        </FormField>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={handleSave}
        className="h-14 rounded-lg bg-[var(--foreground)] text-base font-semibold text-[var(--background)] disabled:opacity-40"
      >
        {saving ? t("loading") : t("save")}
      </button>

      {selectedShop && (
        <ConfirmDialog
          open={confirmRecordAnyway}
          title={t("areYouSure")}
          message={recordAnywayConfirmMessage(selectedShop.name, monthLabel, language)}
          confirmLabel={t("recordAnyway")}
          danger={false}
          onConfirm={() => {
            setRecordAnyway(true);
            setConfirmRecordAnyway(false);
          }}
          onCancel={() => setConfirmRecordAnyway(false)}
        />
      )}
    </div>
  );
}

function ShopPickerSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-[60px] flex-col justify-center gap-1.5 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
          <div className="h-4 w-20 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ))}
    </div>
  );
}
