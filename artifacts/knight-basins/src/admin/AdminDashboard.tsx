import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  FileText,
  ClipboardList,
  Factory,
  FileStack,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react";
import type { AdminDashboardActivity, AdminDashboardPopularItem, AdminDashboardStats } from "@workspace/api-client-react";
import { formatThaiDateTime, THAI_TIME_ZONE } from "@/data/date-time";

type AdminDashboardProps = {
  canNavigate: (href: string) => boolean;
  onNavigate: (href: string) => void;
};

const dashboardQueryKey = ["/api/admin/dashboard-stats"];
const countFormatter = new Intl.NumberFormat("th-TH");
const bahtFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

function useAdminDashboardStats() {
  return useQuery<AdminDashboardStats>({
    queryKey: dashboardQueryKey,
    queryFn: () => customFetch<AdminDashboardStats>("/api/admin/dashboard-stats", { responseType: "json" }),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });
}

function safeDate(value: string) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+07:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatActivityAge(value: string) {
  const date = safeDate(value);
  if (!date) return "ไม่ทราบเวลา";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return "เมื่อสักครู่";
  if (elapsed < 60 * 60_000) return countFormatter.format(Math.floor(elapsed / 60_000)) + " นาทีที่แล้ว";
  if (elapsed < 24 * 60 * 60_000) return countFormatter.format(Math.floor(elapsed / (60 * 60_000))) + " ชั่วโมงที่แล้ว";

  const thaiDateParts = (input: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: THAI_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input);
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"));
  };
  const dayDifference = Math.floor((thaiDateParts(new Date()) - thaiDateParts(date)) / (24 * 60 * 60_000));
  if (dayDifference === 1) return "เมื่อวานนี้";
  if (dayDifference > 1) return countFormatter.format(dayDifference) + " วันที่แล้ว";
  return "วันนี้";
}

function installationSortValue(value: string) {
  return safeDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function formatInstallationDate(value: string) {
  const date = safeDate(value);
  if (!date) return "ไม่ระบุวันติดตั้ง";
  const hasTime = !/^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

function Panel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={`border border-[var(--line)] bg-[var(--card-paper)] shadow-sm ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  testId,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  testId: string;
  accent: string;
}) {
  return (
    <Panel className="relative min-w-0 overflow-hidden p-4 sm:p-5" data-testid={`card-${testId}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
      <div className="flex min-w-0 items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-snug text-[var(--ink-soft)] sm:text-sm">{title}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl" data-testid={`value-${testId}`}>
            {value}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)] sm:text-xs">{detail}</p>
        </div>
        <span className="shrink-0 border border-[var(--line)] p-2 text-[var(--ink-soft)]" aria-hidden="true">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" data-testid="dashboard-loading" aria-label="กำลังโหลดข้อมูลภาพรวม">
      <div className="h-8 w-52 animate-pulse bg-[var(--line)]" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse border border-[var(--line)] bg-[var(--card-paper)]" />
        ))}
      </div>
      <div className="h-48 animate-pulse border border-[var(--line)] bg-[var(--card-paper)]" />
    </div>
  );
}

function ActionCard({
  title,
  description,
  count,
  icon: Icon,
  testId,
  onClick,
}: {
  title: string;
  description: string;
  count: number;
  icon: LucideIcon;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-h-28 w-full items-center justify-between gap-4 border border-[var(--line)] bg-[var(--paper)] p-4 text-left transition-colors hover:border-[var(--saffron)]/60 hover:bg-[var(--saffron)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--saffron)]"
      onClick={onClick}
      data-testid={`button-${testId}`}
      aria-label={`${title}: ${countFormatter.format(count)} รายการ ไปหน้าจัดการ`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--saffron)]/30 bg-[var(--saffron)]/10 text-[var(--saffron)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--ink)]">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--ink-soft)]">{description}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums text-[var(--ink)]" data-testid={`count-${testId}`}>
          {countFormatter.format(count)}
        </span>
        <ArrowRight className="h-4 w-4 text-[var(--ink-soft)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function InstallationCard({
  installation,
}: {
  installation: AdminDashboardStats["upcomingInstallations"][number];
}) {
  const address = installation.address?.trim() ?? "";
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  const reference = installation.quoteNumber?.trim() || installation.leadKey?.trim();

  return (
    <article
      className="flex min-w-0 flex-col justify-between gap-4 border border-[var(--line)] bg-[var(--paper)] p-4"
      data-testid={`card-installation-${installation.id}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-blue)]">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {formatInstallationDate(installation.expectedInstallationDate)}
          </p>
          {reference && (
            <span className="max-w-full truncate border border-[var(--line)] px-2 py-1 font-mono text-[10px] text-[var(--ink-soft)]" title={reference}>
              {reference}
            </span>
          )}
        </div>
        <h3 className="mt-3 truncate font-semibold text-[var(--ink)]" title={installation.name || "ยังไม่ระบุชื่อลูกค้า"}>
          {installation.name || "ยังไม่ระบุชื่อลูกค้า"}
        </h3>
        {installation.project && (
          <p className="mt-1 truncate text-sm text-[var(--ink-soft)]" title={installation.project}>
            {installation.project}
          </p>
        )}
        {address && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]" title={address}>
            {address}
          </p>
        )}
        {installation.notes && (
          <p className="mt-2 line-clamp-2 border-l-2 border-[var(--line)] pl-2 text-xs leading-relaxed text-[var(--ink-soft)]">
            {installation.notes}
          </p>
        )}
      </div>
      {mapsUrl ? (
        <a
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--brand-blue)]/40 px-3 py-2 text-sm font-medium text-[var(--brand-blue)] transition-colors hover:bg-[var(--brand-blue)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`เปิด Google Maps สำหรับ ${installation.name || "งานติดตั้ง"}${address ? ` ที่ ${address}` : ""}`}
          data-testid={`link-dashboard-map-${installation.id}`}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          เปิด Google Maps
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : (
        <p className="flex min-h-10 items-center justify-center gap-2 border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-soft)]">
          ยังไม่มีที่อยู่สำหรับเปิดแผนที่
        </p>
      )}
    </article>
  );
}

function PipelineRatio({ ratio }: { ratio: AdminDashboardStats["pipelineRatio"] }) {
  const total = ratio.usCount + ratio.ofCount + ratio.otherCount;
  const entries = [
    { label: "US · สั่งผลิต", count: ratio.usCount, color: "bg-sky-700" },
    { label: "OF · ขายแผ่น", count: ratio.ofCount, color: "bg-[var(--saffron)]" },
    { label: "อื่น ๆ", count: ratio.otherCount, color: "bg-slate-400" },
  ];
  const ariaDescription = entries
    .map(({ label, count }) => `${label} ${countFormatter.format(count)} งาน`)
    .join(", ");

  return (
    <Panel className="p-4 sm:p-5" data-testid="panel-pipeline-ratio">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]">Pipeline</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">สัดส่วน US / OF</h2>
        </div>
        <FileStack className="h-5 w-5 text-[var(--ink-soft)]" aria-hidden="true" />
      </div>
      {total > 0 ? (
        <>
          <div
            className="mt-5 flex h-3 w-full overflow-hidden bg-[var(--line)]"
            role="img"
            aria-label={`สัดส่วนงานทั้งหมด ${countFormatter.format(total)} รายการ: ${ariaDescription}`}
            data-testid="chart-pipeline-ratio"
          >
            {entries.map(({ label, count, color }) => (
              <span
                key={label}
                className={`${color} h-full`}
                style={{ width: `${(count / total) * 100}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {entries.map(({ label, count, color }) => (
              <li key={label} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-[var(--ink-soft)]">
                  <span className={`h-2.5 w-2.5 shrink-0 ${color}`} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
                  {countFormatter.format(count)} <span className="text-[var(--ink-soft)]">({((count / total) * 100).toFixed(1)}%)</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--ink-soft)]">
            รวม {countFormatter.format(total)} งาน
          </p>
        </>
      ) : (
        <p className="mt-5 border border-dashed border-[var(--line)] px-3 py-5 text-center text-sm text-[var(--ink-soft)]" data-testid="empty-pipeline-ratio">
          ยังไม่มีงานใน Pipeline
        </p>
      )}
    </Panel>
  );
}

function PopularItemsPanel({ items }: { items: AdminDashboardPopularItem[] }) {
    const topItems = [...items].sort((left, right) => right.count - left.count).slice(0, 5);
    const maxCount = Math.max(0, ...topItems.map((item) => item.count));

    return (
      <Panel className="p-4 sm:p-5" data-testid="panel-popular-items">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]">Top 5 best sellers</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">🏆 สินค้ายอดนิยม</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">รหัส SKU และจำนวนงานที่เลือกสินค้า</p>
          </div>
        </div>
        {topItems.length > 0 ? (
          <ol className="divide-y divide-[var(--line)]" data-testid="list-popular-items">
            {topItems.map((item, index) => {
              const share = maxCount > 0 ? Math.max(0, item.count) / maxCount * 100 : 0;
              return (
                <li key={item.sku} className="py-3 first:pt-1 last:pb-1" data-testid="popular-item-row">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--line)] font-mono text-[10px] text-[var(--ink-soft)]" aria-label={"อันดับ " + (index + 1)}>
                        {index + 1}
                      </span>
                      <span className="truncate font-mono text-sm font-semibold tracking-wide text-[var(--ink)]">{item.sku}</span>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-soft)]">{countFormatter.format(Math.max(0, item.count))} งาน</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden bg-[var(--brand-sky)]"
                    role="progressbar"
                    aria-label={"ความถี่ของ " + item.sku}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share)}
                    aria-valuetext={Math.round(share) + "% ของอันดับหนึ่ง"}
                  >
                    <div className="h-full bg-[var(--brand-blue)] transition-[width]" style={{ width: share + "%" }} />
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="border border-dashed border-[var(--line)] px-3 py-8 text-center text-sm text-[var(--ink-soft)]" data-testid="empty-popular-items">
            ยังไม่มีข้อมูลสินค้ายอดนิยม
          </p>
        )}
      </Panel>
    );
    }

    function RecentActivitiesPanel({ items }: { items: AdminDashboardActivity[] }) {
    const activities = [...items]
      .sort((left, right) => (safeDate(right.timestamp)?.getTime() ?? 0) - (safeDate(left.timestamp)?.getTime() ?? 0))
      .slice(0, 5);

    return (
      <Panel className="p-4 sm:p-5" data-testid="panel-recent-activities">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]">Recent activities</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">⚡️ ความเคลื่อนไหวล่าสุด</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">รายการอัปเดตจากลูกค้าและการชำระเงิน</p>
          </div>
        </div>
        {activities.length > 0 ? (
          <ol className="divide-y divide-[var(--line)]" data-testid="list-recent-activities">
            {activities.map((activity) => {
              const isPayment = activity.type === "payment_received";
              const relativeTime = formatActivityAge(activity.timestamp);
              return (
                <li key={activity.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1" data-testid={"activity-row-" + activity.id}>
                  <span
                    className={"relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center border " + (isPayment ? "border-[#17816d]/20 bg-[#17816d]/10 text-[#17816d]" : "border-[var(--brand-blue)]/20 bg-[var(--brand-sky)] text-[var(--brand-blue)]")}
                    aria-hidden="true"
                  >
                    {isPayment ? (
                      <>
                        <Banknote className="h-4 w-4" />
                        <CheckCircle2 className="absolute -bottom-1 -right-1 h-3 w-3 fill-[var(--card-paper)]" />
                      </>
                    ) : (
                      <>
                        <UserRound className="h-4 w-4" />
                        <FileText className="absolute -bottom-1 -right-1 h-3 w-3 fill-[var(--card-paper)]" />
                      </>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="m-0 min-w-0 text-xs font-semibold text-[var(--ink)]">{activity.title}</p>
                      <time className="shrink-0 text-[10px] text-[var(--ink-soft)]" dateTime={activity.timestamp} title={activity.timestamp}>
                        {relativeTime}
                      </time>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-soft)]">{activity.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="border border-dashed border-[var(--line)] px-3 py-8 text-center text-sm text-[var(--ink-soft)]" data-testid="empty-recent-activities">
            ยังไม่มีกิจกรรมล่าสุด
          </p>
        )}
      </Panel>
    );
    }

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { data, isError, isFetching, isLoading, refetch } = useAdminDashboardStats();
  const installations = useMemo(
    () => [...(data?.upcomingInstallations ?? [])].sort(
      (left, right) => installationSortValue(left.expectedInstallationDate) - installationSortValue(right.expectedInstallationDate),
    ),
    [data?.upcomingInstallations],
  );

  if (isLoading && !data) return <DashboardSkeleton />;

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-2xl border border-[#a24439]/30 bg-[var(--card-paper)] p-6 text-center sm:p-10" role="alert" data-testid="dashboard-error">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#a24439]">Dashboard unavailable</p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--ink)]">โหลดข้อมูลภาพรวมไม่สำเร็จ</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
          ตรวจสอบการเชื่อมต่อกับระบบ แล้วลองโหลดข้อมูลอีกครั้ง
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5 rounded-none"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-testid="button-dashboard-retry"
        >
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          ลองอีกครั้ง
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const actionsTotal = data.actionItems.unassignedSlipsCount + data.actionItems.awaitingContactCount;

  return (
    <div className="admin-dashboard space-y-5 sm:space-y-6" data-testid="admin-dashboard">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow accent">BUSINESS OVERVIEW</p>
          <h1 className="text-2xl font-semibold font-display tracking-tight text-[var(--ink)] sm:text-3xl">ภาพรวมธุรกิจ</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">ยอดขาย งานที่ต้องติดตาม และคิวนัดติดตั้ง</p>
        </div>
        <div className="flex items-center justify-between gap-3 border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2 sm:justify-end">
          <span className="min-w-0 text-xs text-[var(--ink-soft)]">
            อัปเดต {safeDate(data.asOf) ? formatThaiDateTime(safeDate(data.asOf)!) : "ไม่ทราบเวลา"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-none text-[var(--ink-soft)]"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="รีเฟรชข้อมูล Dashboard"
            title="รีเฟรชข้อมูล"
            data-testid="button-dashboard-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {isError && (
        <div className="border border-[#a9791f]/30 bg-[#a9791f]/5 px-4 py-3 text-xs text-[var(--ink)]" role="status" data-testid="dashboard-refresh-warning">
          รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดได้ก่อนหน้า
        </div>
      )}

      <section aria-label="ตัวเลขภาพรวม" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          title="ยอดรับจริง"
          value={`฿${bahtFormatter.format(data.kpis.totalRevenueThb)}`}
          detail="รวมยอดจากสลิปจริง"
          icon={Banknote}
          testId="total-revenue"
          accent="bg-[var(--saffron)]"
        />
        <MetricCard
          title="งานทั้งหมด"
          value={countFormatter.format(data.kpis.totalLeads)}
          detail="Lead ในระบบ"
          icon={ClipboardList}
          testId="total-leads"
          accent="bg-sky-700"
        />
        <MetricCard
          title="พร้อมผลิต"
          value={countFormatter.format(data.kpis.readyForProduction)}
          detail="พร้อมส่งผลิต"
          icon={Factory}
          testId="ready-production"
          accent="bg-[#17816d]"
        />
        <MetricCard
          title="ปิดการขาย"
          value={countFormatter.format(data.kpis.closed)}
          detail="สถานะปิดการขาย"
          icon={PackageCheck}
          testId="closed"
          accent="bg-[var(--brand-blue)]"
        />
      </section>

      <Panel className="p-4 sm:p-5" data-testid="panel-dashboard-actions">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]">Needs attention</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">งานที่ต้องติดตาม</h2>
          </div>
          <span className="border border-[var(--saffron)]/40 bg-[var(--saffron)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--ink)]" data-testid="dashboard-action-total">
            {countFormatter.format(actionsTotal)} รายการ
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ActionCard
            title="สลิปที่ยังไม่ผูกกับงาน"
            description="เปิดหน้าลูกค้า / Lead เพื่อตรวจและผูกสลิป"
            count={data.actionItems.unassignedSlipsCount}
            icon={Banknote}
            testId="unassigned-slips"
            onClick={() => onNavigate("/admin/leads")}
          />
          <ActionCard
            title="ลูกค้ารอติดต่อ"
            description="เปิดหน้าลูกค้า / Lead เพื่อติดตามลูกค้า"
            count={data.actionItems.awaitingContactCount}
            icon={Users}
            testId="awaiting-contact"
            onClick={() => onNavigate("/admin/leads?status=awaiting_contact")}
          />
        </div>
        {actionsTotal === 0 && (
          <p className="mt-3 text-xs text-[#17816d]" data-testid="empty-dashboard-actions">
            ไม่มีรายการเร่งด่วนในขณะนี้
          </p>
        )}
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <Panel className="p-4 sm:p-5" data-testid="panel-upcoming-installations">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]">Next 7 days</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">คิวนัดติดตั้ง</h2>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">งานนัดติดตั้งใน 7 วันข้างหน้า</p>
            </div>
            <span className="border border-[var(--line)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--ink)]" data-testid="installation-count">
              {countFormatter.format(installations.length)} งาน
            </span>
          </div>
          {installations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {installations.map((installation) => (
                <InstallationCard key={installation.id} installation={installation} />
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-[var(--line)] px-4 py-10 text-center" data-testid="empty-installations">
              <MapPin className="mx-auto h-6 w-6 text-[var(--ink-soft)]" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-[var(--ink)]">ไม่มีคิวนัดติดตั้งใน 7 วันข้างหน้า</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">คิวใหม่จะแสดงที่นี่เมื่อมีวันติดตั้ง</p>
            </div>
          )}
        </Panel>

        <div className="grid gap-5">
          <PipelineRatio ratio={data.pipelineRatio} />
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <PopularItemsPanel items={data.popularItems} />
        <RecentActivitiesPanel items={data.recentActivities} />
      </div>
    </div>
  );
}