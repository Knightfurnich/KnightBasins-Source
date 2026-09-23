import { useMemo, useState } from "react";
import {
  CustomerLeadStatus,
  useListAdminLeads,
  useListLeadPaymentSlips,
  useUpdateAdminLead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Clipboard, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminQuoteUrl, filterAdminLeads } from "./leads-utils";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";

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

function sketchImageUrls(lead: { sketchUrl?: string | null; studioData?: unknown }) {
  const studio = lead.studioData as { sketchUrls?: unknown } | null | undefined;
  const urls = Array.isArray(studio?.sketchUrls)
    ? studio.sketchUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  if (urls.length) return urls;
  return lead.sketchUrl ? [lead.sketchUrl] : [];
}

type StaffDimensions = { widthMm?: number | null; lengthMm?: number | null; depthMm?: number | null };

function staffDimensionsOf(lead: { studioData?: unknown }): StaffDimensions {
  const studio = lead.studioData as { staffDimensions?: StaffDimensions } | null | undefined;
  return studio?.staffDimensions ?? {};
}

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

const paymentStatusLabels: Record<string, string> = {
  pending: "รอตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  needs_review: "ไม่มี QR · ต้องตรวจด้วยตา",
  rejected: "ไม่ผ่านอัตโนมัติ",
};

const paymentKindLabels: Record<string, string> = {
  deposit: "มัดจำ",
  final: "งวดสุดท้าย",
};

function LeadPaymentSlips({ leadId }: { leadId: number }) {
  const { data: slips } = useListLeadPaymentSlips(leadId);
  if (!slips?.length) return null;
  return (
    <div className="mt-4 max-w-2xl">
      <label className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">การชำระเงิน</label>
      <div className="mt-1 grid gap-2">
        {slips.map((slip) => (
          <div key={slip.id} className="flex items-center gap-3 border border-[var(--line)] p-2 text-xs" data-testid={`row-payment-slip-${slip.id}`}>
            <a href={slip.slipImageUrl} target="_blank" rel="noreferrer" className="block h-12 w-12 shrink-0 border border-[var(--line)] overflow-hidden">
              <img src={slip.slipImageUrl} alt="สลิปโอนเงิน" className="h-full w-full object-cover" />
            </a>
            <div>
              <span className={slip.status === "verified" ? "text-[#17816d]" : slip.status === "rejected" ? "text-[#a24439]" : slip.status === "needs_review" ? "text-[#a9791f]" : "text-[var(--ink-soft)]"}>
                {paymentStatusLabels[slip.status] ?? slip.status}
              </span>
              {" · "}{paymentKindLabels[slip.kind] ?? slip.kind}
              {typeof slip.verifiedAmountThb === "number" && ` · ${slip.verifiedAmountThb.toLocaleString("th-TH")} บาท`}
              {slip.senderName && ` · จาก ${slip.senderName}`}
              {slip.slipokErrorCode && ` · code ${slip.slipokErrorCode}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLeadDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "วันที่ไม่ถูกต้อง"
    : formatThaiDateTime(date);
}

function LeadPageGuide() {
  return (
    <details open className="border border-[var(--brand-blue)]/25 bg-[#eef7fb] text-sm" data-testid="admin-leads-guide">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[var(--brand-blue)]" />
          วิธีใช้งานหน้านี้แบบสั้น
        </span>
        <span className="text-xs font-normal text-[var(--ink-soft)]">กดเพื่อพับ/กางคู่มือ</span>
      </summary>
      <div className="border-t border-[var(--brand-blue)]/15 px-4 py-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="font-semibold text-[var(--brand-blue)]">1. หา Lead ที่ต้องการ</p>
            <p className="mt-1 leading-relaxed text-[var(--ink-soft)]">
              เลือกแท็บสถานะด้านบน หรือค้นหาด้วยเลขที่ใบเสนอราคา ชื่อลูกค้า ชื่อโครงการ หรือเบอร์โทร
              ใช้ช่วงเร็ว “วันนี้ / 7 วัน / 30 วัน” หรือกำหนดวันที่เองได้
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--brand-blue)]">2. อัปเดตการติดตาม</p>
            <p className="mt-1 leading-relaxed text-[var(--ink-soft)]">
              กดปุ่มสถานะบนการ์ดเพื่อย้าย Lead ตามงานจริง: New Lead → เลือกสินค้า → ขอใบเสนอราคา → ปิดการขาย
              พิมพ์บันทึกทีมงาน แล้วคลิกออกจากช่องเพื่อบันทึก
            </p>
          </div>
          <div>
            <p className="font-semibold text-[var(--brand-blue)]">3. เปิดข้อมูลประกอบ</p>
            <p className="mt-1 leading-relaxed text-[var(--ink-soft)]">
              เปิดใบเสนอราคาหรือคัดลอกลิงก์ส่งลูกค้าได้จากเลขที่ใบเสนอราคา
              กดรูปแบบร่างเพื่อดูภาพเต็ม และตรวจสถานะสลิปในส่วนการชำระเงิน
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-[var(--brand-blue)]/15 pt-3 text-xs leading-relaxed text-[var(--ink-soft)]">
          <strong className="text-[var(--ink)]">หมายเหตุ:</strong> Lead แบบ “แบบร่างมือ” จะมีช่องกรอกขนาด กว้าง / ยาว / หนา-ลึก (มม.)
          ให้กรอกตามภาพแล้วกด “บันทึกขนาด” ส่วนปุ่ม “รีเฟรช” มุมขวาบนใช้ดึงข้อมูลล่าสุดจากระบบ
        </div>
      </div>
    </details>
  );
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
  const [editingDimensions, setEditingDimensions] = useState<Record<number, { widthMm: string; lengthMm: string; depthMm: string }>>({});
  const [savedDimensions, setSavedDimensions] = useState<number | null>(null);
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

  const saveDimensions = (lead: { id: number; status: CustomerLeadStatus; notes?: string | null }) => {
    const draft = editingDimensions[lead.id];
    const toNumberOrNull = (value: string | undefined) => {
      const trimmed = (value ?? "").trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const staffDimensions = {
      widthMm: toNumberOrNull(draft?.widthMm),
      lengthMm: toNumberOrNull(draft?.lengthMm),
      depthMm: toNumberOrNull(draft?.depthMm),
    };
    updateLead.mutate(
      { id: lead.id, data: { status: lead.status, notes: lead.notes ?? null, staffDimensions } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
          setSavedDimensions(lead.id);
          window.setTimeout(() => setSavedDimensions((current) => current === lead.id ? null : current), 1800);
        },
      },
    );
  };

  const copyQuoteLink = async (quoteNumber: string, publicQuoteToken: string) => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(adminQuoteUrl(publicQuoteToken));
      setCopiedQuote(quoteNumber);
      window.setTimeout(() => setCopiedQuote((current) => current === quoteNumber ? null : current), 1800);
    } catch {
      setCopyError("คัดลอกลิงก์ไม่ได้ กรุณาเปิดหน้าเว็บผ่าน HTTPS หรือคัดลอกจากลิงก์โดยตรง");
    }
  };

  const setDatePreset = (days: number) => {
    const today = new Date();
    const todayThai = thaiDateInputValue(today);
    const from = new Date(`${todayThai}T12:00:00+07:00`);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    setFromDate(thaiDateInputValue(from));
    setToDate(thaiDateInputValue(today));
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

      <LeadPageGuide />

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
                   <p className="text-xs text-[var(--ink-soft)] mt-1">หน้างาน: {lead.site || "ยังไม่ระบุ"}</p>
                   <p className="text-sm mt-3">{[lead.phone, lead.lineContact && `LINE: ${lead.lineContact}`, lead.email, lead.company].filter(Boolean).join(" · ") || "ยังไม่มีข้อมูลติดต่อ"}</p>
                   <p className="text-xs text-[var(--ink-soft)] mt-2">สินค้า: {lead.productSkus.join(", ") || "ยังไม่ได้เลือก"}</p>
                   <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                     <span>สร้างเมื่อ {formatLeadDate(lead.createdAt)}</span>
                    {lead.quoteNumber && <><span className="font-mono text-[var(--brand-blue)]">{lead.quoteNumber}</span>{lead.publicQuoteToken ? <><a className="text-[var(--brand-blue)] underline" href={adminQuoteUrl(lead.publicQuoteToken)} target="_blank" rel="noreferrer">เปิดใบเสนอราคา</a><Button type="button" size="sm" variant="outline" className="h-7 rounded-none px-2" onClick={() => void copyQuoteLink(lead.quoteNumber!, lead.publicQuoteToken!)} data-testid={`button-copy-quote-link-${lead.id}`}>{copiedQuote === lead.quoteNumber ? <><Check className="w-3 h-3 mr-1" /> คัดลอกแล้ว</> : <><Clipboard className="w-3 h-3 mr-1" /> คัดลอกลิงก์</>}</Button></> : <span className="text-[var(--ink-soft)]">กำลังสร้างลิงก์ปลอดภัย...</span>}</>}
                   </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="border border-[var(--line)] px-2 py-1 text-[var(--brand-blue)]">{modeLabels[lead.orderMode ?? "quick-purchase"] ?? lead.orderMode ?? "quick-purchase"}</span>
                    {lead.studioData && <span className="text-[var(--ink-soft)]">{studioSummary(lead.studioData) ?? "มีข้อมูลขนาดและประมาณการ"}</span>}
                  </div>
                  {sketchImageUrls(lead).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2" data-testid={`gallery-lead-sketch-${lead.id}`}>
                      {sketchImageUrls(lead).map((url, index) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 border border-[var(--line)] overflow-hidden" data-testid={`link-lead-sketch-${lead.id}-${index}`}>
                          <img src={url} alt={`แบบร่าง ${lead.name || ""} รูปที่ ${index + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
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
              {lead.orderMode === "sketch" && (() => {
                const saved = staffDimensionsOf(lead);
                const draft = editingDimensions[lead.id] ?? {
                  widthMm: saved.widthMm != null ? String(saved.widthMm) : "",
                  lengthMm: saved.lengthMm != null ? String(saved.lengthMm) : "",
                  depthMm: saved.depthMm != null ? String(saved.depthMm) : "",
                };
                const setField = (field: "widthMm" | "lengthMm" | "depthMm", value: string) => {
                  setEditingDimensions((current) => ({ ...current, [lead.id]: { ...draft, [field]: value } }));
                };
                return (
                  <div className="mt-4 max-w-2xl">
                    <label className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ขนาดที่ลูกค้าเขียนกำกับในภาพ (mm)</label>
                    <div className="mt-1 flex flex-wrap items-end gap-2">
                      <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
                        กว้าง
                        <Input type="number" inputMode="decimal" value={draft.widthMm} onChange={(event) => setField("widthMm", event.target.value)} className="w-28 rounded-none bg-transparent" data-testid={`input-lead-dimension-width-${lead.id}`} />
                      </label>
                      <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
                        ยาว
                        <Input type="number" inputMode="decimal" value={draft.lengthMm} onChange={(event) => setField("lengthMm", event.target.value)} className="w-28 rounded-none bg-transparent" data-testid={`input-lead-dimension-length-${lead.id}`} />
                      </label>
                      <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
                        หนา/ลึก
                        <Input type="number" inputMode="decimal" value={draft.depthMm} onChange={(event) => setField("depthMm", event.target.value)} className="w-28 rounded-none bg-transparent" data-testid={`input-lead-dimension-depth-${lead.id}`} />
                      </label>
                      <Button type="button" size="sm" variant="outline" className="h-9 rounded-none" disabled={updateLead.isPending} onClick={() => saveDimensions(lead)} data-testid={`button-save-lead-dimensions-${lead.id}`}>
                        {savedDimensions === lead.id ? <><Check className="w-3 h-3 mr-1" /> บันทึกแล้ว</> : "บันทึกขนาด"}
                      </Button>
                    </div>
                  </div>
                );
              })()}
              <LeadPaymentSlips leadId={lead.id} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}