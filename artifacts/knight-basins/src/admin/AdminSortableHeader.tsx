import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { AdminSortDirection } from "./adminArchive";

type AdminSortableHeaderProps = {
  label: string;
  active: boolean;
  direction?: AdminSortDirection;
  onClick: () => void;
  align?: "left" | "center" | "right";
};

export function AdminSortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: AdminSortableHeaderProps) {
  const alignmentClass =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";
  const Icon = active
    ? direction === "desc"
      ? ArrowDown
      : ArrowUp
    : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center gap-1 text-left transition-colors hover:text-[var(--ink)] ${alignmentClass}`}
      aria-label={`เรียงตาม${label}${active ? ` (${direction === "desc" ? "มากไปน้อย" : "น้อยไปมาก"})` : ""}`}
      title={`เรียงตาม${label}`}
    >
      <span>{label}</span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[var(--saffron)]" : "opacity-50"}`} aria-hidden="true" />
    </button>
  );
}