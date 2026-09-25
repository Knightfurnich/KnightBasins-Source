import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminStock,
  getGetAdminStockQueryKey,
  useGetAdminStock,
  type AdminStockItem,
  type AdminStockResponse,
  type AdminStockSheet,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, Database, Download, PackageCheck, PackageX, RefreshCw, Search } from "lucide-react";

export type StockItem = AdminStockItem;
export type StockGroup = AdminStockSheet;
export type StockResponse = AdminStockResponse;

export type StockMaterial = "staron" | "zen";
export type StockFilter = "all" | "positive" | "zero";

export const STOCK_QUERY_KEY = getGetAdminStockQueryKey();

export function formatStockValue(value: string | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return String(value);
}

export function formatStockLots(lots: string[] | null | undefined): string {
  if (!lots?.length) return "—";
  return lots.map((lot) => String(lot)).join(",");
}

export function formatStockNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function formatStockUpdatedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const formatUpdatedAt = formatStockUpdatedAt;

const STOCK_CSV_COLUMNS = ["ยี่ห้อ", "รหัสสี", "ชื่อสี", "ขนาดแผ่น", "ความหนา", "จำนวนคงเหลือ", "หมายเหตุ", "วันที่อัปเดต"];

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Splits a stock row's "code (name)" convention (e.g. "AA 625 (Aspen
 * Alder)") into a code and a color name; falls back to the whole string
 * for both when a row doesn't follow that convention. */
function splitStockCodeAndName(name: string): { code: string; colorName: string } {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { code: (match[1] ?? "").trim(), colorName: (match[2] ?? "").trim() };
  return { code: name, colorName: name };
}

/**
 * Converts the full stock snapshot (both brands) into RFC 4180 CSV text
 * with a leading UTF-8 BOM, matching GET /admin/stock/export's own output
 * column-for-column -- ขนาดแผ่น/ความหนา (sheet size/thickness) are left
 * blank since the underlying stock sheet data doesn't carry them.
 */
export function buildStockCsv(stock: StockResponse): string {
  const rows: string[][] = [];
  for (const [brand, sheet] of [["Staron", stock.staron], ["Zen Stone", stock.zen]] as const) {
    for (const item of sheet.items) {
      const { code, colorName } = splitStockCodeAndName(item.name);
      rows.push([brand, code, colorName, "", "", String(item.qty), item.note, stock.updatedAt]);
    }
  }
  const lines = [STOCK_CSV_COLUMNS, ...rows].map((row) => row.map(csvEscape).join(","));
  return `﻿${lines.join("\r\n")}`;
}

export function filterStockItems(
  items: StockItem[],
  search: string,
  filter: StockFilter = "all",
): StockItem[] {
  const query = search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesSearch = !query || item.name.toLocaleLowerCase().includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "positive" && item.qty > 0) ||
      (filter === "zero" && item.qty === 0);
    return matchesSearch && matchesFilter;
  });
}

export type StockQuantityTone = "good" | "caution" | "empty";

export function getStockQuantityTone(qty: number): StockQuantityTone {
  if (qty > 10) return "good";
  if (qty > 0) return "caution";
  return "empty";
}

function getErrorMessage(): string {
  return "ไม่สามารถโหลดข้อมูลสต็อกได้ กรุณาลองใหม่อีกครั้ง";
}

function StockLoadingState() {
  return (
    <section className="space-y-4" aria-label="กำลังโหลดข้อมูลสต็อก" data-testid="stock-loading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-[116px] border border-[var(--line)] bg-[var(--card-paper)] p-5">
            <div className="h-3 w-20 bg-[var(--line)]" />
            <div className="mt-5 h-8 w-24 bg-[var(--line)]" />
          </div>
        ))}
      </div>
      <div className="border border-[var(--line)] bg-[var(--card-paper)] p-5">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="grid grid-cols-4 gap-4">
              <div className="h-4 bg-[var(--line)]" />
              <div className="col-span-2 h-4 bg-[var(--line)]" />
              <div className="h-4 bg-[var(--line)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StockErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <section
      className="border border-[#a24439]/30 bg-[#a24439]/5 p-6 sm:p-8"
      role="alert"
      data-testid="stock-error"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#a24439]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-[var(--ink)]">โหลดสต็อกไม่สำเร็จ</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{getErrorMessage()}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-10 items-center border border-[#a24439]/40 px-4 text-sm text-[#8e3d34] transition-colors hover:bg-[#a24439]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
            data-testid="button-stock-retry"
          >
            ลองโหลดข้อมูลอีกครั้ง
          </button>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon,
  testId,
}: {
  label: string;
  value: number;
  tone: "neutral" | "positive" | "negative";
  icon: "database" | "check" | "empty";
  testId: string;
}) {
  const Icon = icon === "database" ? Database : icon === "check" ? PackageCheck : PackageX;
  const toneClass =
    tone === "positive"
      ? "text-[#197b67]"
      : tone === "negative"
        ? "text-[#a24439]"
        : "text-[var(--ink)]";

  return (
    <article className="border border-[var(--line)] bg-[var(--card-paper)] p-5" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.13em] text-[var(--ink-soft)]">{label}</p>
        <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden="true" />
      </div>
      <p className={`mt-4 font-mono text-3xl leading-none tracking-tight ${toneClass}`} data-testid={`${testId}-value`}>
        {formatStockNumber(value)}
      </p>
      <p className="mt-2 text-xs text-[var(--ink-soft)]">สี</p>
    </article>
  );
}

function QuantityBadge({ qty }: { qty: number }) {
  const tone = getStockQuantityTone(qty);
  const toneClass =
    tone === "good"
      ? "border-[#197b67]/25 bg-[#197b67]/10 text-[#197b67]"
      : tone === "caution"
        ? "border-[#b27a24]/30 bg-[#b27a24]/10 text-[#8f681e]"
        : "border-[#a24439]/25 bg-[#a24439]/10 text-[#a24439]";

  return (
    <span
      className={`inline-flex min-w-[58px] justify-center border px-2 py-1 font-mono text-sm ${toneClass}`}
      data-testid={`stock-qty-${qty}`}
    >
      {formatStockNumber(qty)}
    </span>
  );
}

export function StockInventoryView({
  stock,
  isRefreshing = false,
  refreshError = null,
  onRefresh,
}: {
  stock: StockResponse;
  isRefreshing?: boolean;
  refreshError?: unknown;
  onRefresh: () => void;
}) {
  const [material, setMaterial] = useState<StockMaterial>("staron");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const group = stock[material];
  const visibleItems = useMemo(
    () => filterStockItems(group.items, search, filter),
    [filter, group.items, search],
  );
  const outOfStock = group.total - group.inStockCount;

  return (
    <div className="admin-manager space-y-6" data-testid="stock-inventory-page">
      <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow accent">04 / STOCK INVENTORY</p>
          <h1 className="workbench-manager-title">คลังแผ่นหินสังเคราะห์</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
            เช็กสีที่มีอยู่จริงก่อนแจ้งลูกค้า เพื่อให้ฝ่ายขายและทีมผลิตใช้ข้อมูลชุดเดียวกัน
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="flex items-center gap-2 text-xs text-[var(--ink-soft)]" data-testid="stock-source-label">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            สต็อกจาก API ของระบบ · Read-only
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-10 items-center gap-2 border border-[var(--ink)] bg-[var(--ink)] px-4 text-sm text-[var(--paper)] transition-colors hover:bg-[#3c5056] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
            data-testid="button-stock-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "กำลังรีเฟรช" : "รีเฟรช"}
          </button>
          {refreshError ? (
            <p className="text-xs text-[#a24439]" role="status" data-testid="stock-refresh-error">
              อัปเดตไม่สำเร็จ · ยังคงแสดงข้อมูลเดิม
            </p>
          ) : null}
        </div>
      </header>

      <section aria-label="เลือกแบรนด์หิน" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full border border-[var(--line)] bg-[var(--card-paper)] p-1 sm:w-auto" role="tablist" aria-label="แบรนด์หิน">
          {(["staron", "zen"] as const).map((key) => {
            const isSelected = material === key;
            const label = key === "staron" ? "Staron" : "Zen Stone";
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setMaterial(key)}
                className={`min-h-10 flex-1 px-5 text-sm transition-colors sm:flex-none ${
                  isSelected
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--line)]/50 hover:text-[var(--ink)]"
                }`}
                data-testid={`tab-stock-${key}`}
              >
                {label}
                <span className={`ml-2 font-mono text-xs ${isSelected ? "opacity-75" : "opacity-60"}`}>
                  {formatStockNumber(stock[key].total)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="font-mono text-xs text-[var(--ink-soft)]" data-testid="stock-updated-at">
          อัปเดตล่าสุด · {formatStockUpdatedAt(stock.updatedAt)}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="สรุปจำนวนสี">
        <KpiCard label="สีทั้งหมด" value={group.total} tone="neutral" icon="database" testId="stock-kpi-total" />
        <KpiCard label="มีสต็อก" value={group.inStockCount} tone="positive" icon="check" testId="stock-kpi-in-stock" />
        <KpiCard label="หมดสต็อก" value={outOfStock} tone="negative" icon="empty" testId="stock-kpi-out-of-stock" />
      </section>

      <section className="border border-[var(--line)] bg-[var(--card-paper)]" aria-label="รายการสี">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 border-b border-[var(--line)] pb-2 lg:w-[min(100%,340px)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" aria-hidden="true" />
            <label className="sr-only" htmlFor="stock-search">ค้นหารหัสหรือชื่อสี</label>
            <input
              id="stock-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหารหัสหรือชื่อสี..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
              data-testid="input-stock-search"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="กรองตามจำนวนคงเหลือ">
              {([
                ["all", "ทั้งหมด"],
                ["positive", "qty > 0"],
                ["zero", "qty = 0"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={`min-h-9 border px-3 text-xs transition-colors ${
                    filter === value
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                      : "border-transparent text-[var(--ink-soft)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                  }`}
                  data-testid={`button-stock-filter-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <a
              href="/api/admin/stock/export"
              className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--ink)] px-3 text-xs text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
              data-testid="button-stock-export-csv"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              ส่งออกสต็อกเป็น CSV
            </a>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-14 text-center" data-testid="stock-empty-filter">
            <PackageX className="h-8 w-8 text-[var(--ink-soft)]" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">ไม่พบสีตามเงื่อนไข</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--ink-soft)]">
              ลองเปลี่ยนคำค้นหาหรือเลือกตัวกรองอื่นเพื่อดูรายการสี
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="mt-5 min-h-10 border border-[var(--line)] px-4 text-sm text-[var(--ink)] hover:bg-[var(--line)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
              data-testid="button-stock-clear-filters"
            >
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left" data-testid="stock-table">
              <caption className="sr-only">รายการสต็อก {group.title}</caption>
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)]">
                  <th scope="col" className="w-16 px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">No.</th>
                  <th scope="col" className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">รหัส / ชื่อสี</th>
                  <th scope="col" className="w-28 px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">Qty (แผ่น)</th>
                  <th scope="col" className="w-28 px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">Scrap</th>
                  <th scope="col" className="w-36 px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">Lot No.</th>
                  <th scope="col" className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    key={`${material}-${item.no}-${item.name}`}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--paper)]"
                    data-testid={`stock-row-${material}-${item.no}`}
                  >
                    <td className="px-4 py-4 text-right font-mono text-xs text-[var(--ink-soft)]">{item.no}</td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-[var(--ink)]" data-testid={`stock-name-${material}-${item.no}`}>
                        {formatStockValue(item.name)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <QuantityBadge qty={item.qty} />
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-[var(--ink-soft)]">{formatStockValue(item.scrap)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-[var(--ink-soft)]">{formatStockLots(item.lots)}</td>
                    <td className="max-w-[260px] px-4 py-4 text-sm leading-relaxed text-[var(--ink-soft)]">{formatStockValue(item.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs text-[var(--ink-soft)] sm:px-5">
          <span data-testid="stock-visible-count">แสดง {formatStockNumber(visibleItems.length)} รายการ</span>
          <span className="font-mono">{group.title}</span>
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-soft)]" data-testid="stock-read-only-note">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#197b67]" aria-hidden="true" />
        หน้านี้ใช้ตรวจสอบข้อมูลเท่านั้น การแก้ไขสต็อกทำในแหล่งข้อมูลต้นทาง
      </p>
    </div>
  );
}

export default function StockInventoryPage() {
  const queryClient = useQueryClient();
  const stockQuery = useGetAdminStock(undefined, {
    query: { retry: false, staleTime: 60_000 },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const latest = await getAdminStock({ refresh: true });
      queryClient.setQueryData(STOCK_QUERY_KEY, latest);
    } catch (error) {
      setRefreshError(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (stockQuery.isLoading) return <StockLoadingState />;
  if (stockQuery.isError || !stockQuery.data) {
    return <StockErrorState error={stockQuery.error} onRetry={() => void stockQuery.refetch()} />;
  }

  return (
    <StockInventoryView
      stock={stockQuery.data}
      isRefreshing={isRefreshing}
      refreshError={refreshError}
      onRefresh={() => void handleRefresh()}
    />
  );
}