import type { ReactNode } from "react";

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium opacity-70">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-14 w-full rounded-lg border border-black/[.12] bg-transparent px-4 text-base focus:border-black/[.3] focus:outline-none dark:border-white/[.15] dark:focus:border-white/[.4]";
