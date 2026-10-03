import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Copy, Download, RefreshCw, Search, XCircle } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatThaiDateTime } from "@/data/date-time";
import { useToast } from "@/hooks/use-toast";

export type AuditStatus = "success" | "warning" | "error";
export type AuditActorType = "customer" | "admin" | "system";

export type AuditLogRow = {
  id: number;
  actorType: AuditActorType;
  actorName: string | null;
  action: string;
  targetId: string | null;
  status: AuditStatus;
  errorCode: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AuditLogsResponse = { items: AuditLogRow[]; total: number; limit: number; offset: number };
type AuditInsightCategory = "ux" | "slip" | "form";
type AuditInsightRange = "7d" | "30d" | "90d";
type AuditTrackerStatus = "pending" | "in_progress" | "resolved";
type AuditTrackerCategory = "ux" | "payment" | "form";
type AuditLogInsightsResponse = {
  range: AuditInsightRange;
  periodDays: number;
  totals: { total: number; success: number; warning: number; error: number };
  trend: { current: number; previous: number; direction: "up" | "down" | "flat"; changePercent: number | null };
  customerIssues: number;
  categories: Array<{ category: AuditInsightCategory; label: string; count: number }>;
  painPoints: Array<{
    key: string;
    count: number;
    category: AuditInsightCategory;
    categoryLabel: string;
    description: string;
    recommendation: string;
  }>;
  generatedAt: string;
};
type AuditLogPruneResponse = { prunedCount: number; prunedAt: string };
type AuditPrunePreviewResponse = {
  totalCount: number;
  rules: Array<{
    key: "success-30d" | "warning-error-90d";
    label: string;
    thresholdDays: number;
    count: number;
    warningCount?: number;
    errorCount?: number;
    oldestAt: string | null;
    newestAt: string | null;
  }>;
  generatedAt: string;
};
type AuditIssueTracker = {
  id: number;
  errorCode: string;
  title: string;
  category: AuditTrackerCategory;
  status: AuditTrackerStatus;
  assignee: string | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type AuditIssueTrackerResponse = { item: AuditIssueTracker };
type AuditIssueTrackersResponse = { items: AuditIssueTracker[] };
type AuditLogExportResponse = { generatedAt: string; totalCount: number; items: AuditLogRow[] };
type AuditTrackerDraft = {
  errorCode: string;
  title: string;
  category: AuditTrackerCategory;
  assignee: string;
  notes: string;
};

export type AuditInsightCategoryFilter = "all" | AuditTrackerCategory;
type AuditPainPointCsvRow = Pick<AuditLogInsightsResponse["painPoints"][number], "key" | "description" | "category" | "count" | "recommendation">;

export const AUDIT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;
const AUDIT_INSIGHT_RANGES: ReadonlyArray<{ value: AuditInsightRange; label: string }> = [
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
  { value: "90d", label: "90 วัน" },
];
const AUDIT_TRACKER_STATUSES: ReadonlyArray<{ value: AuditTrackerStatus; label: string }> = [
  { value: "pending", label: "รอตรวจสอบ" },
  { value: "in_progress", label: "กำลังแก้" },
  { value: "resolved", label: "เสร็จแล้ว" },
];

export const AUDIT_INSIGHT_CATEGORIES: ReadonlyArray<{ value: AuditInsightCategoryFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "ux", label: "🎨 ผังและขนาด (UX)" },
  { value: "payment", label: "💰 สลิปและการเงิน (Payment)" },
  { value: "form", label: "📝 ข้อมูลฟอร์ม (Form)" },
];

export const AUDIT_PAIN_POINT_CSV_HEADERS = [
  "ลำดับ",
  "รหัสปัญหา (Error Code)",
  "ชื่อปัญหาภาษาไทย",
  "หมวดหมู่ (UX/การเงิน/ฟอร์ม)",
  "จำนวนครั้งที่พบ",
  "% สัดส่วน",
  "คำแนะนำการปรับปรุง",
];

export function escapeAuditCsvField(value: unknown): string {
  const text = String(value ?? "").replace(/\r\n|\r|\n/g, "\r\n");
  // Keep formula-like values inside a quoted field with an Excel-resistant tab prefix.
  const excelSafeText = /^[\s\uFEFF]*[=+\-@＝＋－＠]/.test(text) ? `\t${text}` : text;
  return /[",\r\n\t]/.test(excelSafeText) ? `"${excelSafeText.replace(/"/g, '""')}"` : excelSafeText;
}

export function filterAuditPainPointsByCategory<T extends { category: AuditInsightCategory }>(
  painPoints: readonly T[],
  category: AuditInsightCategoryFilter,
): T[] {
  if (category === "all") return [...painPoints];
  return painPoints.filter((point) => (point.category === "slip" ? "payment" : point.category) === category);
}

export function filterAuditTrackersByCategory<T extends { category: AuditTrackerCategory }>(
  trackers: readonly T[],
  category: AuditInsightCategoryFilter,
): T[] {
  return category === "all" ? [...trackers] : trackers.filter((tracker) => tracker.category === category);
}

function auditCsvCategoryLabel(category: AuditInsightCategory): string {
  if (category === "ux") return "UX";
  if (category === "slip") return "การเงิน";
  return "ฟอร์ม";
}

export function buildAuditPainPointsCsv(painPoints: readonly AuditPainPointCsvRow[], totalCustomerIssues: number): string {
  const rows = [
    AUDIT_PAIN_POINT_CSV_HEADERS,
    ...painPoints.map((point, index) => [
      index + 1,
      point.key,
      point.description,
      auditCsvCategoryLabel(point.category),
      point.count,
      `${totalCustomerIssues > 0 ? ((point.count / totalCustomerIssues) * 100).toFixed(1) : "0.0"}%`,
      point.recommendation,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(escapeAuditCsvField).join(",")).join("\r\n")}`;
}

export function formatBangkokDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export const AUDIT_STATUS_FILTERS: ReadonlyArray<{ value: "all" | AuditStatus; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "success", label: "สำเร็จ" },
  { value: "warning", label: "คำเตือน" },
  { value: "error", label: "ข้อผิดพลาด" },
];

const ACTOR_FILTERS: ReadonlyArray<{ value: "all" | AuditActorType; label: string }> = [
  { value: "all", label: "ทุกผู้ทำรายการ" },
  { value: "customer", label: "ลูกค้า" },
  { value: "admin", label: "ทีมงาน / แอดมิน" },
  { value: "system", label: "ระบบ" },
];

const ACTOR_LABELS: Record<AuditActorType, string> = { customer: "ลูกค้า", admin: "ทีมงาน", system: "ระบบ" };

const ACTION_LABELS: Record<string, string> = {
  "lead.upsert": "ลูกค้าส่งคำขอใบเสนอราคา",
  "slip.upload": "ลูกค้าอัปโหลดสลิป",
  "admin.lead.delete": "ทีมงานลบ Lead",
  "admin.stone.update": "ทีมงานแก้ราคา/ข้อมูลหิน",
  "admin.basin.update": "ทีมงานแก้ข้อมูลอ่าง",
};

/** Green / orange / red, as a tinted pill plus a row accent, so the colour reads on both admin themes. */
export const AUDIT_STATUS_STYLES: Record<AuditStatus, { label: string; badge: string; row: string; dot: string }> = {
  success: { label: "สำเร็จ", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", row: "border-l-emerald-500", dot: "bg-emerald-500" },
  warning: { label: "คำเตือน", badge: "bg-amber-500/20 text-amber-800 dark:text-amber-300", row: "border-l-amber-500", dot: "bg-amber-500" },
  error: { label: "ข้อผิดพลาด", badge: "bg-red-500/15 text-red-700 dark:text-red-300", row: "border-l-red-500", dot: "bg-red-500" },
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function StatusIcon({ status }: { status: AuditStatus }) {
  if (status === "error") return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "warning") return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const style = AUDIT_STATUS_STYLES[status] ?? AUDIT_STATUS_STYLES.success;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold ${style.badge}`} data-testid={`badge-audit-status-${status}`}>
      <StatusIcon status={status} />
      {style.label}
    </span>
  );
}

function formatLogTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatThaiDateTime(date);
}

/**
 * The lead a log row is about, if there is one to open: the quote number is what the Leads page can search for.
 * A deleted lead no longer exists, and a failed save has no quotation yet, so neither gets a link.
 */
export function auditLeadSearchTerm(row: Pick<AuditLogRow, "action" | "targetId" | "details">): string | null {
  if (row.action === "admin.lead.delete") return null;
  const quoteNumber = row.details && typeof row.details["quoteNumber"] === "string" ? (row.details["quoteNumber"] as string) : null;
  if (quoteNumber) return quoteNumber;
  const isLeadEvent = row.action.startsWith("lead.") || row.action.startsWith("slip.");
  return isLeadEvent && row.targetId && row.targetId.includes(" / ") ? row.targetId : null;
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AdminLogsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"history" | "insights">("history");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | AuditStatus>("all");
  const [actorType, setActorType] = useState<"all" | AuditActorType>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [lastPruneCount, setLastPruneCount] = useState<number | null>(null);
  const [insightsRange, setInsightsRange] = useState<AuditInsightRange>("30d");
  const [insightsCategoryFilter, setInsightsCategoryFilter] = useState<AuditInsightCategoryFilter>("all");
  const [trackerDraft, setTrackerDraft] = useState<AuditTrackerDraft | null>(null);
  const [trackerNotes, setTrackerNotes] = useState<Record<number, string>>({});
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const debouncedSearch = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);

  // A new filter always starts from the first page.
  useEffect(() => setPage(0), [debouncedSearch, status, actorType]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE), offset: String(page * AUDIT_PAGE_SIZE) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (status !== "all") params.set("status", status);
    if (actorType !== "all") params.set("actorType", actorType);
    return params.toString();
  }, [debouncedSearch, status, actorType, page]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/admin/audit-logs", queryString],
    queryFn: () => customFetch<AuditLogsResponse>(`/api/admin/audit-logs?${queryString}`),
    placeholderData: (previous) => previous,
    enabled: activeTab === "history",
    refetchOnWindowFocus: false,
  });

  const insightsQuery = useQuery<AuditLogInsightsResponse>({
    queryKey: ["/api/admin/audit-logs/insights", insightsRange],
    queryFn: () => customFetch<AuditLogInsightsResponse>(`/api/admin/audit-logs/insights?range=${insightsRange}`),
    enabled: activeTab === "insights",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const trackersQuery = useQuery<AuditIssueTrackersResponse>({
    queryKey: ["/api/admin/audit-issues"],
    queryFn: () => customFetch<AuditIssueTrackersResponse>("/api/admin/audit-issues"),
    enabled: activeTab === "insights",
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const prunePreviewQuery = useQuery<AuditPrunePreviewResponse>({
    queryKey: ["/api/admin/audit-logs/prune-preview"],
    queryFn: () => customFetch<AuditPrunePreviewResponse>("/api/admin/audit-logs/prune-preview"),
    enabled: confirmPrune,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const pruneMutation = useMutation({
    mutationFn: () => customFetch<AuditLogPruneResponse>("/api/admin/audit-logs/prune", { method: "POST" }),
    onSuccess: (result) => {
      setConfirmPrune(false);
      setBackupDownloaded(false);
      setLastPruneCount(result.prunedCount);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs/insights"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs/prune-preview"] });
      toast({ title: `ล้าง Log เก่าแล้ว ${result.prunedCount.toLocaleString("th-TH")} รายการ` });
    },
  });

  const createTrackerMutation = useMutation({
    mutationFn: (draft: AuditTrackerDraft) => customFetch<AuditIssueTrackerResponse>("/api/admin/audit-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }),
    onSuccess: () => {
      setTrackerDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-issues"] });
      toast({ title: "สร้างรายการติดตามแล้ว" });
    },
  });

  const updateTrackerMutation = useMutation({
    mutationFn: ({ id, ...changes }: { id: number; status?: AuditTrackerStatus; notes?: string | null; assignee?: string | null }) =>
      customFetch<AuditIssueTrackerResponse>(`/api/admin/audit-issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-issues"] });
      toast({ title: "บันทึกรายการติดตามแล้ว" });
    },
  });

  const pruneExportMutation = useMutation({
    mutationFn: async () => {
      const backup = await customFetch<AuditLogExportResponse>("/api/admin/audit-logs/export");
      const expectedCount = prunePreviewQuery.data?.totalCount;
      if (expectedCount === undefined || backup.totalCount !== expectedCount || backup.items.length !== expectedCount) {
        throw new Error("จำนวนแถวในสำรองไม่ตรงกับ Dry-run กรุณาโหลดตัวอย่างใหม่");
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `audit-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
      return backup.totalCount;
    },
    onSuccess: (count) => {
      setBackupDownloaded(true);
      toast({ title: `ดาวน์โหลดสำรอง ${count.toLocaleString("th-TH")} รายการแล้ว` });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const firstShown = total === 0 ? 0 : page * AUDIT_PAGE_SIZE + 1;
  const lastShown = Math.min(total, page * AUDIT_PAGE_SIZE + items.length);
  const hasNext = (page + 1) * AUDIT_PAGE_SIZE < total;
  const painPoints = useMemo(
    () => filterAuditPainPointsByCategory(insightsQuery.data?.painPoints ?? [], insightsCategoryFilter),
    [insightsQuery.data?.painPoints, insightsCategoryFilter],
  );
  const filteredTrackers = useMemo(
    () => filterAuditTrackersByCategory(trackersQuery.data?.items ?? [], insightsCategoryFilter),
    [trackersQuery.data?.items, insightsCategoryFilter],
  );
  const openPruneDialog = () => {
    setBackupDownloaded(false);
    setConfirmPrune(true);
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs/prune-preview"] });
  };
  const startTrackerDraft = (point: AuditLogInsightsResponse["painPoints"][number]) => {
    setTrackerDraft({
      errorCode: point.key.slice(0, 64),
      title: point.description.slice(0, 200),
      category: point.category === "slip" ? "payment" : point.category,
      assignee: "Owner",
      notes: point.recommendation,
    });
  };
  const exportPainPointsCsv = () => {
    const insights = insightsQuery.data;
    if (!insights) return;
    const csv = buildAuditPainPointsCsv(painPoints.slice(0, 5), insights.customerIssues);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `knight-customer-pain-points-${insightsRange}-${formatBangkokDateStamp(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    toast({ title: "ดาวน์โหลดรายงาน CSV แล้ว" });
  };

  return (
    <div className="flex flex-col gap-5" data-testid="admin-audit-logs-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">SYSTEM / AUDIT</p>
          <h1 className="text-2xl font-semibold text-[var(--ink)]">Logs ตรวจสอบ</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">
            ประวัติสิ่งที่เกิดขึ้นกับใบเสนอราคา สลิป และการแก้ข้อมูลของทีมงาน ใช้ค้นหาเมื่อลูกค้าแจ้งว่าส่งข้อมูลไม่ได้ ระบบตัดรหัสผ่านและโทเคนออกก่อนบันทึกเสมอ
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => { void (activeTab === "history" ? refetch() : insightsQuery.refetch()); }}
          disabled={activeTab === "history" ? isFetching : insightsQuery.isFetching}
          data-testid="button-audit-refresh"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${(activeTab === "history" ? isFetching : insightsQuery.isFetching) ? "animate-spin" : ""}`} aria-hidden="true" />
          รีเฟรช
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-3" role="tablist" aria-label="มุมมอง Logs">
        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          variant={activeTab === "history" ? "secondary" : "outline"}
          onClick={() => setActiveTab("history")}
          data-testid="tab-audit-history"
        >
          ประวัติ Log ทั้งหมด
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "insights"}
          variant={activeTab === "insights" ? "secondary" : "outline"}
          onClick={() => setActiveTab("insights")}
          data-testid="tab-audit-insights"
        >
          📊 สรุปจุดติดขัดลูกค้า (UX Insights)
        </Button>
      </div>

      {activeTab === "history" ? (
      <>
      <section className="flex flex-col gap-3 md:flex-row md:items-center" aria-label="ค้นหาและกรอง Logs">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาเลขที่ใบเสนอราคา / เบอร์โทรลูกค้า / ชื่อทีมงาน"
            className="rounded-none pl-9"
            aria-label="ค้นหา Logs"
            data-testid="input-audit-log-search"
          />
        </div>
        <select
          value={actorType}
          onChange={(event) => setActorType(event.target.value as "all" | AuditActorType)}
          className="h-10 rounded-none border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink)]"
          aria-label="กรองตามผู้ทำรายการ"
          data-testid="select-audit-actor-type"
        >
          {ACTOR_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามสถานะ" data-testid="audit-status-filters">
        {AUDIT_STATUS_FILTERS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={status === option.value ? "secondary" : "outline"}
            className={status === option.value ? "bg-[var(--line)] text-[var(--ink)]" : "text-[var(--ink-soft)]"}
            aria-pressed={status === option.value}
            onClick={() => setStatus(option.value)}
            data-testid={`button-audit-status-${option.value}`}
          >
            {option.value !== "all" && <span className={`mr-2 inline-block h-2 w-2 rounded-full ${AUDIT_STATUS_STYLES[option.value].dot}`} aria-hidden="true" />}
            {option.label}
          </Button>
        ))}
      </div>

      {isError && (
        <div role="alert" className="border border-red-500/50 bg-red-500/10 p-4 text-sm text-[var(--ink)]" data-testid="audit-logs-error">
          <p className="font-semibold">โหลด Logs ไม่สำเร็จ</p>
          <p className="mt-1 text-[var(--ink-soft)]">{error instanceof Error ? error.message : "ไม่ทราบสาเหตุ"} — เมนูนี้เปิดได้เฉพาะเจ้าของระบบ</p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>ลองอีกครั้ง</Button>
        </div>
      )}

      <div className="overflow-x-auto border border-[var(--line)]" data-testid="audit-logs-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">เวลา</TableHead>
              <TableHead className="w-32">สถานะ</TableHead>
              <TableHead>เหตุการณ์</TableHead>
              <TableHead>ผู้ทำรายการ</TableHead>
              <TableHead>อ้างอิง</TableHead>
              <TableHead>รหัสปัญหา</TableHead>
              <TableHead className="w-28 text-right">รายละเอียด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-[var(--ink-soft)]" data-testid="audit-logs-loading">กำลังโหลด…</TableCell></TableRow>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-[var(--ink-soft)]" data-testid="audit-logs-empty">ไม่พบรายการ Logs ตามเงื่อนไขนี้</TableCell></TableRow>
            )}
            {items.map((row) => (
              <TableRow
                key={row.id}
                className={`border-l-4 ${AUDIT_STATUS_STYLES[row.status]?.row ?? ""}`}
                data-testid={`row-audit-log-${row.id}`}
                data-status={row.status}
              >
                <TableCell className="whitespace-nowrap text-sm">{formatLogTime(row.createdAt)}</TableCell>
                <TableCell><AuditStatusBadge status={row.status} /></TableCell>
                <TableCell className="text-sm font-medium">{actionLabel(row.action)}</TableCell>
                <TableCell className="text-sm">
                  <span className="text-[var(--ink-soft)]">{ACTOR_LABELS[row.actorType] ?? row.actorType}</span>
                  {row.actorName ? <span className="ml-1">· {row.actorName}</span> : null}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.targetId ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.errorCode ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelected(row)} data-testid={`button-audit-detail-${row.id}`}>ดูรายละเอียด</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-soft)]">
        <span data-testid="text-audit-range">{total === 0 ? "ไม่มีรายการ" : `แสดง ${firstShown}–${lastShown} จาก ${total} รายการ`}</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} data-testid="button-audit-prev">ก่อนหน้า</Button>
          <Button type="button" size="sm" variant="outline" disabled={!hasNext} onClick={() => setPage((current) => current + 1)} data-testid="button-audit-next">ถัดไป</Button>
        </div>
      </footer>

      <AuditLogDetailDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onCopy={(text) => {
          void navigator.clipboard?.writeText(text).then(
            () => toast({ title: "คัดลอกแล้ว" }),
            () => toast({ title: "คัดลอกไม่สำเร็จ", variant: "destructive" }),
          );
        }}
      />
      </>
      ) : (
        <section className="flex flex-col gap-5" aria-label="สรุปจุดติดขัดลูกค้า" data-testid="audit-logs-insights">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลาสรุป" data-testid="audit-insights-range">
                  {AUDIT_INSIGHT_RANGES.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={insightsRange === option.value ? "secondary" : "outline"}
                      aria-pressed={insightsRange === option.value}
                      onClick={() => setInsightsRange(option.value)}
                      data-testid={`button-audit-insights-range-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={exportPainPointsCsv}
                  disabled={!insightsQuery.data}
                  data-testid="button-audit-insights-export-csv"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  📥 ส่งออกรายงานเป็น CSV (Excel)
                </Button>
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="กรองหมวดหมู่ปัญหา"
                data-testid="audit-insights-category-filter"
              >
                {AUDIT_INSIGHT_CATEGORIES.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={insightsCategoryFilter === option.value ? "secondary" : "outline"}
                    aria-pressed={insightsCategoryFilter === option.value}
                    onClick={() => setInsightsCategoryFilter(option.value)}
                    data-testid={`button-audit-insights-category-${option.value}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            {insightsQuery.data && (
              <div
                className={`border px-3 py-2 text-sm font-semibold ${
                  insightsQuery.data.trend.direction === "up"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : insightsQuery.data.trend.direction === "down"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
                aria-label={`แนวโน้มเทียบกับ ${insightsQuery.data.periodDays} วันก่อนหน้า`}
                data-testid="audit-insights-trend"
              >
                {insightsQuery.data.trend.changePercent === null
                  ? "🔺 เริ่มพบรายการ (ช่วงก่อนหน้า 0)"
                  : insightsQuery.data.trend.direction === "up"
                    ? `🔺 เพิ่มขึ้น ${insightsQuery.data.trend.changePercent}%`
                    : insightsQuery.data.trend.direction === "down"
                      ? `🔻 ลดลง ${Math.abs(insightsQuery.data.trend.changePercent)}%`
                      : "→ คงที่ 0%"}
              </div>
            )}
          </div>
          {insightsQuery.isError && (
            <div role="alert" className="border border-red-500/50 bg-red-500/10 p-4 text-sm" data-testid="audit-insights-error">
              โหลดสรุปจุดติดขัดไม่สำเร็จ — {insightsQuery.error instanceof Error ? insightsQuery.error.message : "ไม่ทราบสาเหตุ"}
            </div>
          )}
          {insightsQuery.isLoading && (
            <div className="border border-[var(--line)] p-8 text-center text-sm text-[var(--ink-soft)]" data-testid="audit-insights-loading">
              กำลังสรุปข้อมูล {AUDIT_INSIGHT_RANGES.find((option) => option.value === insightsRange)?.label ?? "30 วัน"} ที่ผ่านมา…
            </div>
          )}
          {!insightsQuery.isLoading && !insightsQuery.isError && insightsQuery.data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={`ตัวเลขสรุป ${insightsQuery.data.periodDays} วัน`}>
                <InsightSummaryCard label="รายการทั้งหมด" value={insightsQuery.data.totals.total} testId="insights-summary-total" />
                <InsightSummaryCard label="สำเร็จ" value={insightsQuery.data.totals.success} testId="insights-summary-success" />
                <InsightSummaryCard label="จุดติดขัดของลูกค้า" value={insightsQuery.data.customerIssues} testId="insights-summary-friction" />
                <InsightSummaryCard
                  label="อัตราความราบรื่น"
                  value={`${insightsQuery.data.totals.total === 0 ? "0.0" : ((insightsQuery.data.totals.success / insightsQuery.data.totals.total) * 100).toFixed(1)}%`}
                  testId="insights-summary-smooth-rate"
                />
              </div>

              <section aria-label="ปัญหาแยกตามหมวด">
                <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">ปัญหาลูกค้าแยกตามหมวด</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {insightsQuery.data.categories.map((category) => (
                    <div key={category.category} className="border border-[var(--line)] bg-[var(--card-paper)] p-4" data-testid={`insights-category-${category.category}`}>
                      <p className="text-xs text-[var(--ink-soft)]">{category.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{category.count.toLocaleString("th-TH")}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-label="ปัญหาที่ลูกค้าพบบ่อยที่สุด">
                <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">
                  {insightsQuery.data.periodDays === 30
                    ? "5 ปัญหาที่ลูกค้าพบบ่อยที่สุดในรอบเดือน"
                    : `5 ปัญหาที่ลูกค้าพบบ่อยที่สุดใน ${insightsQuery.data.periodDays} วัน`}
                </h2>
                <p className="mb-3 text-sm text-[var(--ink-soft)]">เรียงตามจำนวน Warning และ Error ของลูกค้าในช่วงที่เลือก</p>
                <div className="overflow-x-auto border border-[var(--line)]" data-testid="table-audit-pain-points">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ปัญหา</TableHead>
                        <TableHead>หมวด</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead>คำอธิบายและคำแนะนำ</TableHead>
                        <TableHead>ติดตาม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {painPoints.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-[var(--ink-soft)]" data-testid="audit-pain-points-empty">ยังไม่พบจุดติดขัดของลูกค้าในช่วงนี้</TableCell></TableRow>
                      ) : painPoints.slice(0, 5).map((point, index) => (
                        <TableRow key={point.key} data-testid={`row-audit-pain-point-${index + 1}`}>
                          <TableCell className="font-mono text-xs">{point.key}</TableCell>
                          <TableCell className="whitespace-nowrap">{point.categoryLabel}</TableCell>
                          <TableCell className="text-right font-semibold">{point.count.toLocaleString("th-TH")}</TableCell>
                          <TableCell className="min-w-64 text-sm">
                            <p className="font-medium">{point.description}</p>
                            <p className="mt-1 text-[var(--ink-soft)]">แนะนำ: {point.recommendation}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => startTrackerDraft(point)}
                              data-testid={`button-audit-create-tracker-${index + 1}`}
                            >
                              + สร้างรายการติดตาม
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="flex flex-col gap-3" aria-label="รายการติดตามการแก้ไข" data-testid="audit-issue-tracker">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ink)]">รายการติดตามการแก้ไข (Action Tracker)</h2>
                  <p className="text-sm text-[var(--ink-soft)]">บันทึกสถานะและหมายเหตุสำหรับปัญหาที่ต้องติดตาม</p>
                </div>
                {trackersQuery.isError && (
                  <div role="alert" className="border border-red-500/50 bg-red-500/10 p-3 text-sm" data-testid="audit-trackers-error">
                    โหลดรายการติดตามไม่สำเร็จ — {trackersQuery.error instanceof Error ? trackersQuery.error.message : "ไม่ทราบสาเหตุ"}
                  </div>
                )}
                {trackersQuery.isLoading && (
                  <div className="border border-[var(--line)] p-5 text-center text-sm text-[var(--ink-soft)]" data-testid="audit-trackers-loading">กำลังโหลดรายการติดตาม…</div>
                )}
                {!trackersQuery.isLoading && !trackersQuery.isError && (
                  <div className="grid gap-3 xl:grid-cols-3">
                    {AUDIT_TRACKER_STATUSES.map((statusOption) => {
                      const itemsForStatus = filteredTrackers.filter((item) => item.status === statusOption.value);
                      return (
                        <section key={statusOption.value} className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--card-paper)] p-3" data-testid={`audit-tracker-column-${statusOption.value}`}>
                          <h3 className="flex items-center justify-between text-sm font-semibold text-[var(--ink)]">
                            <span>{statusOption.label}</span>
                            <span className="text-[var(--ink-soft)]">{itemsForStatus.length.toLocaleString("th-TH")}</span>
                          </h3>
                          {itemsForStatus.length === 0 && (
                            <p className="text-sm text-[var(--ink-soft)]">
                              {insightsCategoryFilter === "all" ? "ยังไม่มีรายการ" : "ไม่มีรายการในหมวดที่เลือก"}
                            </p>
                          )}
                          {itemsForStatus.map((item) => (
                            <article key={item.id} className="flex flex-col gap-3 border border-[var(--line)] p-3" data-testid={`audit-tracker-card-${item.id}`}>
                              <div>
                                <p className="font-mono text-xs text-[var(--ink-soft)]">{item.errorCode}</p>
                                <h4 className="mt-1 text-sm font-semibold text-[var(--ink)]">{item.title}</h4>
                                <p className="mt-1 text-xs text-[var(--ink-soft)]">
                                  {item.category === "payment" ? "การชำระเงิน" : item.category === "ux" ? "UX/ผังเคาน์เตอร์" : "ข้อมูลฟอร์ม"}
                                  {" · "}ผู้รับผิดชอบ: {item.assignee ?? "Owner"}
                                </p>
                              </div>
                              <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
                                หมายเหตุ
                                <textarea
                                  value={trackerNotes[item.id] ?? item.notes ?? ""}
                                  onChange={(event) => setTrackerNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                                  rows={3}
                                  maxLength={5000}
                                  className="w-full resize-y border border-[var(--line)] bg-transparent p-2 text-sm text-[var(--ink)]"
                                  aria-label={`หมายเหตุรายการ ${item.id}`}
                                  data-testid={`textarea-audit-tracker-notes-${item.id}`}
                                />
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateTrackerMutation.mutate({ id: item.id, notes: trackerNotes[item.id] ?? item.notes ?? "" })}
                                disabled={updateTrackerMutation.isPending || (trackerNotes[item.id] ?? item.notes ?? "") === (item.notes ?? "")}
                                data-testid={`button-audit-tracker-save-notes-${item.id}`}
                              >
                                บันทึกหมายเหตุ
                              </Button>
                              <div className="flex flex-wrap gap-1" role="group" aria-label={`ปรับสถานะรายการ ${item.id}`}>
                                {AUDIT_TRACKER_STATUSES.filter((option) => option.value !== item.status).map((option) => (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateTrackerMutation.mutate({ id: item.id, status: option.value })}
                                    disabled={updateTrackerMutation.isPending}
                                    data-testid={`button-audit-tracker-status-${item.id}-${option.value}`}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                            </article>
                          ))}
                        </section>
                      );
                    })}
                  </div>
                )}
                {createTrackerMutation.isError && (
                  <div role="alert" className="text-sm text-red-700 dark:text-red-300" data-testid="audit-tracker-create-error">
                    สร้างรายการติดตามไม่สำเร็จ — {createTrackerMutation.error instanceof Error ? createTrackerMutation.error.message : "ไม่ทราบสาเหตุ"}
                  </div>
                )}
                {updateTrackerMutation.isError && (
                  <div role="alert" className="text-sm text-red-700 dark:text-red-300" data-testid="audit-tracker-update-error">
                    บันทึกรายการติดตามไม่สำเร็จ — {updateTrackerMutation.error instanceof Error ? updateTrackerMutation.error.message : "ไม่ทราบสาเหตุ"}
                  </div>
                )}
              </section>

              <section className="border border-[var(--line)] bg-[var(--card-paper)] p-4" aria-label="ล้างประวัติ Logs เก่า">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[var(--ink)]">ล้างประวัติ Log เก่า</h2>
                    <p className="mt-1 max-w-3xl text-sm text-[var(--ink-soft)]">
                      ล้างรายการสำเร็จที่เกิน 30 วัน และ Warning/Error ที่เกิน 90 วัน โดยเก็บรายการสลิปการเงินและรายการของแอดมินไว้ทั้งหมด
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={openPruneDialog}
                    disabled={pruneMutation.isPending}
                    data-testid="button-audit-prune"
                  >
                    ล้างประวัติ Log เก่าตามเกณฑ์
                  </Button>
                </div>
                {lastPruneCount !== null && (
                  <p className="mt-3 text-sm font-medium text-[var(--ink)]" role="status" data-testid="text-audit-prune-result">
                    ล้างล่าสุด {lastPruneCount.toLocaleString("th-TH")} แถว
                  </p>
                )}
                {pruneMutation.isError && (
                  <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert" data-testid="audit-prune-error">
                    ล้าง Log ไม่สำเร็จ — {pruneMutation.error instanceof Error ? pruneMutation.error.message : "ไม่ทราบสาเหตุ"}
                  </p>
                )}
              </section>
            </>
          )}
        </section>
      )}

      {confirmPrune && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="audit-prune-title" data-testid="dialog-audit-prune-confirm">
          <div className="w-full max-w-2xl border border-[var(--line)] bg-[var(--card-paper)] p-6 text-[var(--ink)] shadow-xl">
            <h2 id="audit-prune-title" className="text-lg font-semibold">ยืนยันการล้าง Log เก่า?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              ตรวจตัวอย่างรายการก่อน ระบบจะลบรายการสำเร็จที่เกิน 30 วัน และ Warning/Error ที่เกิน 90 วัน โดยไม่ลบ action slip.upload หรือรายการของแอดมิน
            </p>
            <div className="mt-4 border border-[var(--line)] p-3" data-testid="audit-prune-preview">
              {prunePreviewQuery.isLoading && (
                <p className="text-sm text-[var(--ink-soft)]" data-testid="audit-prune-preview-loading">กำลังตรวจรายการที่จะลบ…</p>
              )}
              {prunePreviewQuery.isError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-red-700 dark:text-red-300" data-testid="audit-prune-preview-error">
                  <span>โหลดตัวอย่างไม่สำเร็จ — {prunePreviewQuery.error instanceof Error ? prunePreviewQuery.error.message : "ไม่ทราบสาเหตุ"}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void prunePreviewQuery.refetch()}>ลองอีกครั้ง</Button>
                </div>
              )}
              {prunePreviewQuery.data && (
                <>
                  <p className="mb-3 text-sm font-semibold" data-testid="audit-prune-preview-total">
                    Dry-run พบ {prunePreviewQuery.data.totalCount.toLocaleString("th-TH")} รายการ
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {prunePreviewQuery.data.rules.map((rule) => (
                      <div key={rule.key} className="border border-[var(--line)] p-3" data-testid={`audit-prune-preview-rule-${rule.key}`}>
                        <p className="text-sm font-medium">{rule.label}</p>
                        <p className="mt-1 text-lg font-semibold">{rule.count.toLocaleString("th-TH")} รายการ</p>
                        {rule.warningCount !== undefined && (
                          <p className="text-xs text-[var(--ink-soft)]">
                            Warning {rule.warningCount.toLocaleString("th-TH")} · Error {(rule.errorCount ?? 0).toLocaleString("th-TH")}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          ช่วงข้อมูล: {rule.oldestAt ? formatLogTime(rule.oldestAt) : "—"} ถึง {rule.newestAt ? formatLogTime(rule.newestAt) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="max-w-lg text-sm">
                <p className="font-semibold">สำรองก่อนลบ</p>
                <p className="mt-1 text-[var(--ink-soft)]">ดาวน์โหลดไฟล์ JSON และตรวจว่าจำนวนแถวตรงกับตัวอย่างก่อนยืนยัน</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => pruneExportMutation.mutate()}
                disabled={!prunePreviewQuery.data || prunePreviewQuery.isFetching || pruneExportMutation.isPending}
                data-testid="button-audit-prune-download-backup"
              >
                {pruneExportMutation.isPending ? "กำลังดาวน์โหลด…" : backupDownloaded ? "ดาวน์โหลดสำรองอีกครั้ง" : "ดาวน์โหลด JSON สำรอง"}
              </Button>
            </div>
            {backupDownloaded && (
              <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status" data-testid="audit-prune-backup-ready">
                ดาวน์โหลดไฟล์สำรองแล้ว สามารถยืนยันการลบได้
              </p>
            )}
            {pruneExportMutation.isError && (
              <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert" data-testid="audit-prune-export-error">
                สำรอง Log ไม่สำเร็จ — {pruneExportMutation.error instanceof Error ? pruneExportMutation.error.message : "ไม่ทราบสาเหตุ"}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmPrune(false)} disabled={pruneMutation.isPending} data-testid="button-audit-prune-cancel">ยกเลิก</Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => pruneMutation.mutate()}
                disabled={pruneMutation.isPending || pruneExportMutation.isPending || !backupDownloaded || !prunePreviewQuery.data}
                data-testid="button-audit-prune-confirm"
              >
                {pruneMutation.isPending ? "กำลังล้าง…" : "ยืนยันและล้าง"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {trackerDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="audit-tracker-create-title" data-testid="dialog-audit-tracker-create">
          <form
            className="flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto border border-[var(--line)] bg-[var(--card-paper)] p-6 text-[var(--ink)] shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              createTrackerMutation.mutate(trackerDraft);
            }}
          >
            <div>
              <h2 id="audit-tracker-create-title" className="text-lg font-semibold">สร้างรายการติดตามการแก้ไข</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">ข้อมูลตั้งต้นมาจากปัญหาที่เลือก คุณแก้ไขก่อนบันทึกได้</p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              รหัสปัญหา
              <input
                required
                maxLength={64}
                value={trackerDraft.errorCode}
                onChange={(event) => setTrackerDraft((draft) => draft ? { ...draft, errorCode: event.target.value } : draft)}
                className="border border-[var(--line)] bg-transparent px-3 py-2"
                data-testid="input-audit-tracker-error-code"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              หัวข้อ
              <input
                required
                maxLength={200}
                value={trackerDraft.title}
                onChange={(event) => setTrackerDraft((draft) => draft ? { ...draft, title: event.target.value } : draft)}
                className="border border-[var(--line)] bg-transparent px-3 py-2"
                data-testid="input-audit-tracker-title"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              หมวด
              <select
                value={trackerDraft.category}
                onChange={(event) => setTrackerDraft((draft) => draft ? { ...draft, category: event.target.value as AuditTrackerCategory } : draft)}
                className="border border-[var(--line)] bg-[var(--card-paper)] px-3 py-2"
                data-testid="select-audit-tracker-category"
              >
                <option value="ux">UX/ผังเคาน์เตอร์</option>
                <option value="payment">การชำระเงิน</option>
                <option value="form">ข้อมูลฟอร์ม</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              ผู้รับผิดชอบ
              <input
                maxLength={120}
                value={trackerDraft.assignee}
                onChange={(event) => setTrackerDraft((draft) => draft ? { ...draft, assignee: event.target.value } : draft)}
                className="border border-[var(--line)] bg-transparent px-3 py-2"
                data-testid="input-audit-tracker-assignee"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              หมายเหตุ
              <textarea
                rows={4}
                maxLength={5000}
                value={trackerDraft.notes}
                onChange={(event) => setTrackerDraft((draft) => draft ? { ...draft, notes: event.target.value } : draft)}
                className="resize-y border border-[var(--line)] bg-transparent px-3 py-2"
                data-testid="textarea-audit-tracker-create-notes"
              />
            </label>
            {createTrackerMutation.isError && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300" data-testid="audit-tracker-create-dialog-error">
                บันทึกไม่สำเร็จ — {createTrackerMutation.error instanceof Error ? createTrackerMutation.error.message : "ไม่ทราบสาเหตุ"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTrackerDraft(null)} disabled={createTrackerMutation.isPending}>ยกเลิก</Button>
              <Button type="submit" disabled={createTrackerMutation.isPending || !trackerDraft.errorCode.trim() || !trackerDraft.title.trim()} data-testid="button-audit-tracker-create-submit">
                {createTrackerMutation.isPending ? "กำลังบันทึก…" : "สร้างรายการ"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function InsightSummaryCard({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--card-paper)] p-4" data-testid={testId}>
      <p className="text-xs text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{typeof value === "number" ? value.toLocaleString("th-TH") : value}</p>
    </div>
  );
}

function AuditLogDetailDrawer({ row, onClose, onCopy }: { row: AuditLogRow | null; onClose: () => void; onCopy: (text: string) => void }) {
  const detailsJson = row?.details ? JSON.stringify(row.details, null, 2) : "";
  const rawError = row?.details && typeof row.details["errorMessage"] === "string" ? (row.details["errorMessage"] as string) : null;
  const leadTerm = row ? auditLeadSearchTerm(row) : null;
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="audit-log-detail-drawer">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {actionLabel(row.action)}
                <AuditStatusBadge status={row.status} />
              </SheetTitle>
              <SheetDescription>{formatLogTime(row.createdAt)} · Log #{row.id}</SheetDescription>
            </SheetHeader>

            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm" data-testid="audit-log-detail-summary">
              <dt className="text-[var(--ink-soft)]">ผู้ทำรายการ</dt>
              <dd>{ACTOR_LABELS[row.actorType] ?? row.actorType}{row.actorName ? ` · ${row.actorName}` : ""}</dd>
              <dt className="text-[var(--ink-soft)]">อ้างอิง</dt>
              <dd className="font-mono text-xs">{row.targetId ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">รหัสปัญหา</dt>
              <dd className="font-mono text-xs">{row.errorCode ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">IP</dt>
              <dd className="font-mono text-xs">{row.ipAddress ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">อุปกรณ์</dt>
              <dd className="break-all text-xs">{row.userAgent ?? "—"}</dd>
            </dl>

            {rawError && (
              <section className="mt-5" aria-label="ข้อความ Error ดิบ">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">ข้อความ Error ดิบ</h3>
                <pre className="mt-1 whitespace-pre-wrap break-words border border-red-500/50 bg-red-500/10 p-3 text-xs" data-testid="audit-log-raw-error">{rawError}</pre>
              </section>
            )}

            <section className="mt-5" aria-label="ข้อมูลเชิงลึก (JSON)">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]">ข้อมูลเชิงลึก (JSON)</h3>
                {detailsJson && (
                  <Button type="button" size="sm" variant="outline" onClick={() => onCopy(detailsJson)} data-testid="button-audit-copy-json">
                    <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" />คัดลอก JSON
                  </Button>
                )}
              </div>
              <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-[var(--line)] p-3 text-xs" data-testid="audit-log-detail-json">
                {detailsJson || "ไม่มีข้อมูลเพิ่มเติม"}
              </pre>
            </section>

            {leadTerm && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/leads?q=${encodeURIComponent(leadTerm)}`}
                  className="inline-flex items-center border border-[var(--line)] px-3 py-2 text-sm font-medium underline-offset-4 hover:underline"
                  data-testid="link-audit-open-lead"
                  onClick={onClose}
                >
                  เปิดหน้า Lead นี้
                </Link>
                <span className="font-mono text-xs text-[var(--ink-soft)]">{leadTerm}</span>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default AdminLogsManager;
