import { useMemo, useState } from "react";
import {
  CustomerLeadStatus,
  useListAdminLeads,
  useUpdateAdminLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clipboard, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminQuoteUrl, filterAdminLeads } from "./leads-utils";

const statusLabels: Record<CustomerLeadStatus, string> = {
  new_lead: "New Lead",
  selecting: "เลือกสินค้า",
  quote_requested: "ขอใบเสนอราคา",
  closed: "ปิดการขาย",
};

const statusOptions: CustomerLeadStatus[] = ["new_lead", "selecting", "quote_requested", "closed"];
const modeLabels: Record<string, string> = {
  "quick-purchase": "ซื้อด่วน",
  studio: "2D Studio",
  sketch: "แบบร่างมือ",
};

function studioSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as {
    state?: { shape?: string; dimensions?: { runAMm?: number; runBMm?: number; runCMm?: number; depthMm?: number }; location?: string };
    estimate?: { stoneAreaSqM?: number; totalTHB?: number };
  };
  const dimensions = data.state?.dimensions;
  if (!dimensions) return null;
  const runs = [dimensions.runAMm, dimensions.runBMm, dimensions.runCMm].filter((run): run is number => typeof run === "number" && run > 0).join(" / ");
  return `${data.state?.shape ?? "-"} · ${runs} × ${dimensions.depthMm ?? "-"} mm · ${data.estimate?.stoneAreaSqM?.toFixed(2) ?? "-"} m² · ประมาณ ${data.estimate?.totalTHB?.toLocaleString("th-TH") ?? "-"} บาท · ${data.state?.location === "province" ? "ต่างจังหวัด" : "กรุงเทพฯ/ปริมณฑล"}`;
}

function formatLeadDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "วันที่ไม่ถูกต้อง"
    : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LeadsManager() {
  const { data: leads, isLoading, refetch } = useListAdminLeads();
  const updateLead = useUpdateAdminLead();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CustomerLeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [copiedQuote, setCopiedQuote] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const visibleLeads = useMemo(() => filterAdminLeads(leads ?? [], filter, search, { fromDate, toDate }), [filter, fromDate, leads, search, toDate]);
  const hasSearchFilters = Boolean(search || fromDate || toDate);

  const updateStatus = (id: number, status: CustomerLeadStatus, notes?: string | null) => {
    updateLead.mutate(
      { id, data: { status, notes: notes ?? null } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] }) },
    );
  };

  const copyQuoteLink = async (quoteNumber: string) => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(adminQuoteUrl(quoteNumber));
      setCopiedQuote(quoteNumber);
      window.setTimeout(() => setCopiedQuote((current) => current === quoteNumber ? null : current), 1800);
    } catch {
      setCopyError("คัดลอกลิงก์ไม่ได้ กรุณาเปิดหน้าเว็บผ่าน HTTPS หรือคัดลอกจากลิงก์โดยตรง");
    }
  };

  const setDatePreset = (days: number) => {
    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    setFromDate(dateInputValue(from));
    setToDate(dateInputValue(today));
  };

  return (
    <div className="admin-manager leads-manager space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="eyebrow accent">LEAD PIPELINE</p>
          <h1 className="text-3xl font-semibold font-display tracking-tight">ลูกค้าและใบเสนอราคา</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-2">ติดตามตั้งแต่เริ่มคุย เลือกสินค้า จนถึงปิดการขาย</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="rounded-none">
          <RefreshCw className="w-4 h-4 mr-2" /> รีเฟรช
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")} className="rounded-none">
          ทั้งหมด ({leads?.length ?? 0})
        </Button>
        {statusOptions.map((status) => (
          <Button key={status} variant={filter === status ? "secondary" : "ghost"} onClick={() => setFilter(status)} className="rounded-none">
            {statusLabels[status]} ({leads?.filter((lead) => lead.status === status).length ?? 0})
          </Button>
        ))}
      </div>

      <div className="border border-[var(--line)] bg-[var(--card-paper)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Search className="w-4 h-4 text-[var(--brand-blue)]" /> ค้นหาใบเสนอราคาและลูกค้า</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--ink-soft)]">ช่วงเร็ว:</span>
          {[["วันนี้", 1], ["7 วัน", 7], ["30 วัน", 30]].map(([label, days]) => (
            <Button key={label} type="button" size="sm" variant={fromDate && toDate ? "outline" : "ghost"} onClick={() => setDatePreset(days as number)} className="h-7 rounded-none px-2" data-testid={`button-admin-lead-date-${days}`}>
              {label}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto] items-end">
          <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
            เลขที่ / ชื่อลูกค้า / โครงการ / เบอร์โทร
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="เช่น Sep 26 / US / 296579" data-testid="input-admin-lead-search" className="rounded-none bg-transparent" />
          </label>
          <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
            ตั้งแต่วันที่
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} data-testid="input-admin-lead-from-date" className="rounded-none bg-transparent" />
          </label>
          <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
            ถึงวันที่
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} data-testid="input-admin-lead-to-date" className="rounded-none bg-transparent" />
          </label>
          {hasSearchFilters && <Button type="button" variant="ghost" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }} className="rounded-none"><X className="w-4 h-4 mr-1" /> ล้างตัวกรอง</Button>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
          <span>พบ {visibleLeads.length} จาก {leads?.length ?? 0} รายการ</span>
          {copyError && <span className="text-[#a24439]" role="alert">{copyError}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด lead...</div>
      ) : visibleLeads.length === 0 ? (
        <div className="border border-[var(--line)] bg-[var(--card-paper)] p-10 text-center text-sm text-[var(--ink-soft)]">ยังไม่มี lead ในสถานะนี้</div>
      ) : (
        <div className="grid gap-4">
          {visibleLeads.map((lead) => (
            <article key={lead.id} className="border border-[var(--line)] bg-[var(--card-paper)] p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">{lead.name || "ยังไม่ระบุชื่อ"}</strong>
                    <span className="text-xs border border-[var(--line)] px-2 py-1">{statusLabels[lead.status]}</span>
                  </div>
                  <p className="text-sm text-[var(--ink-soft)] mt-1">{lead.project || "ยังไม่ระบุโครงการ"} · แหล่งที่มา {lead.source}</p>
                  <p className="text-sm mt-3">{[lead.phone, lead.email, lead.company].filter(Boolean).join(" · ") || "ยังไม่มีข้อมูลติดต่อ"}</p>
                   <p className="text-xs text-[var(--ink-soft)] mt-2">สินค้า: {lead.productSkus.join(", ") || "ยังไม่ได้เลือก"}</p>
                   <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                     <span>สร้างเมื่อ {formatLeadDate(lead.createdAt)}</span>
                     {lead.quoteNumber && <><span className="font-mono text-[var(--brand-blue)]">{lead.quoteNumber}</span><a className="text-[var(--brand-blue)] underline" href={adminQuoteUrl(lead.quoteNumber)} target="_blank" rel="noreferrer">เปิดใบเสนอราคา</a><Button type="button" size="sm" variant="outline" className="h-7 rounded-none px-2" onClick={() => void copyQuoteLink(lead.quoteNumber!)} data-testid={`button-copy-quote-link-${lead.id}`}>{copiedQuote === lead.quoteNumber ? <><Check className="w-3 h-3 mr-1" /> คัดลอกแล้ว</> : <><Clipboard className="w-3 h-3 mr-1" /> คัดลอกลิงก์</>}</Button></>}
                   </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="border border-[var(--line)] px-2 py-1 text-[var(--brand-blue)]">{modeLabels[lead.orderMode ?? "quick-purchase"] ?? lead.orderMode ?? "quick-purchase"}</span>
                    {lead.sketchUrl && <a className="text-[var(--brand-blue)] underline" href={lead.sketchUrl} target="_blank" rel="noreferrer">เปิดไฟล์แบบร่าง</a>}
                    {lead.studioData && <span className="text-[var(--ink-soft)]">{studioSummary(lead.studioData) ?? "มีข้อมูลขนาดและประมาณการ"}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button key={status} size="sm" variant={lead.status === status ? "secondary" : "outline"} className="rounded-none" disabled={updateLead.isPending} onClick={() => updateStatus(lead.id, status, lead.notes)}>
                      {statusLabels[status]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="mt-4 max-w-2xl">
                <label className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">บันทึกทีมงาน</label>
                <Textarea
                  value={editingNotes[lead.id] ?? lead.notes ?? ""}
                  onChange={(event) => setEditingNotes((current) => ({ ...current, [lead.id]: event.target.value }))}
                  onBlur={(event) => {
                    const value = event.target.value.trim() || null;
                    if (value !== (lead.notes ?? null)) updateStatus(lead.id, lead.status, value);
                  }}
                  className="mt-1 min-h-20 bg-transparent border-[var(--line)] rounded-none"
                  placeholder="เช่น นัดส่งตัวอย่างหิน หรือรอยืนยันแบบ"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}