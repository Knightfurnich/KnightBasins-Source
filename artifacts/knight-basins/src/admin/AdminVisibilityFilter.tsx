import { Archive, Check, Layers3 } from "lucide-react";

export type AdminVisibility = "active" | "archived" | "all";

type AdminVisibilityFilterProps = {
  value: AdminVisibility;
  onChange: (value: AdminVisibility) => void;
  activeCount: number;
  archivedCount: number;
};

export function AdminVisibilityFilter({
  value,
  onChange,
  activeCount,
  archivedCount,
}: AdminVisibilityFilterProps) {
  const options: Array<{
    value: AdminVisibility;
    label: string;
    count: number;
    icon: typeof Check;
  }> = [
    { value: "active", label: "เปิดแสดง", count: activeCount, icon: Check },
    { value: "archived", label: "Archived", count: archivedCount, icon: Archive },
    { value: "all", label: "ทั้งหมด", count: activeCount + archivedCount, icon: Layers3 },
  ];

  return (
    <div className="admin-visibility-filter flex flex-wrap items-center gap-1" role="tablist" aria-label="ตัวกรองสถานะรายการ">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] transition-colors ${
              selected
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                : "border-[var(--line)] bg-transparent text-[var(--ink-soft)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Icon className="h-3 w-3" />
            {option.label}
            <span className="font-mono opacity-75">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}