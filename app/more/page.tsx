"use client";

import Link from "next/link";
import { ChevronRight, Fingerprint, FolderLock, KeyRound, Receipt } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import { BackButton } from "@/app/components/BackButton";
import type { TranslationKey } from "@/lib/translations";

const MENU_ITEMS: {
  href: string;
  labelKey: TranslationKey;
  Icon: typeof Receipt;
}[] = [
  { href: "/other", labelKey: "otherRecords", Icon: Receipt },
  { href: "/documents", labelKey: "familyDocuments", Icon: FolderLock },
  { href: "/more/change-pin", labelKey: "changePin", Icon: KeyRound },
  { href: "/more/biometric", labelKey: "biometricSettingsTitle", Icon: Fingerprint },
];

export default function MorePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/" />

      <h2 className="text-xl font-semibold">{t("more")}</h2>

      <ul className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.12]">
        {MENU_ITEMS.map(({ href, labelKey, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[56px] items-center gap-3 px-4 py-3 active:bg-black/[.03] dark:active:bg-white/[.05]"
            >
              <Icon className="h-5 w-5 shrink-0 opacity-70" />
              <span className="flex-1 text-base font-medium">{t(labelKey)}</span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-40" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
