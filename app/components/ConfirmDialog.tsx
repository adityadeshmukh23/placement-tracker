"use client";

import { useTranslation } from "@/lib/useTranslation";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
  busy = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-[var(--background)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-base opacity-70">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-14 rounded-lg text-base font-semibold disabled:opacity-40 ${
              danger
                ? "bg-red-600 text-white"
                : "bg-[var(--foreground)] text-[var(--background)]"
            }`}
          >
            {confirmLabel}
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
