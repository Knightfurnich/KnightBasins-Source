import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "wouter";
import {
  CustomerLeadStatus,
  type CustomerLead,
  type PaymentSlip,
  useAssignAdminPaymentSlip,
  useListAdminLeads,
  useListAdminUnassignedSlips,
  useListLeadPaymentSlips,
  useUpdateAdminLead,
  useVoidAdminPaymentSlip,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Check, ChevronDown, ChevronRight, Clipboard, Download, LayoutGrid, List, Loader2, MapPin, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminQuoteUrl, downloadLeadsCsv, filterAdminLeads, leadStatusLabels as statusLabels } from "./leads-utils";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";

const statusOptions: string[] = [
  "new_lead",
  "selecting",
  "quote_requested",
  "waiting_deposit",
  "team_reported_paid",
  "deposit_paid",
  "ready_for_production",
  "closed",
];
/** Mirrors the dashboard's own "awaiting contact" grouping (admin-router.ts DASHBOARD_AWAITING_CONTACT_STATUSES). */
const AWAITING_CONTACT_STATUSES = ["new_lead", "selecting", "quote_requested"];
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

function worksiteGoogleMapsUrl(lead: Pick<CustomerLead, "address" | "studioData">) {
  const address = lead.address?.trim() ?? "";
  const studioData = lead.studioData;
  const rawPlaceId = studioData && typeof studioData === "object" && !Array.isArray(studioData)
    ? (studioData as Record<string, unknown>).worksitePlaceId
    : null;
  const placeId = typeof rawPlaceId === "string" ? rawPlaceId.trim() : "";
  if (!address && !placeId) return null;

  const query = encodeURIComponent(address || placeId);
  const placeIdQuery = placeId ? "&query_place_id=" + encodeURIComponent(placeId) : "";
  return "https://www.google.com/maps/search/?api=1&query=" + query + placeIdQuery;
}

function WorksiteDirectionsLink({ lead }: { lead: CustomerLead }) {
  const href = worksiteGoogleMapsUrl(lead);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={"เปิดเส้นทาง Google Maps ไปยัง " + (lead.address || "หน้างาน")}
      data-testid={"link-worksite-directions-" + lead.id}
      className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--brand-blue)] underline underline-offset-2"
    >
      <MapPin className="h-3 w-3" /> 🗺️ เปิดเส้นทาง Google Maps
    </a>
  );
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
  team_reported_paid: "ชำระแล้วตามรายงานทีม LINE",
  voided: "ยกเลิกแล้ว",
};

const paymentKindLabels: Record<string, string> = {
  deposit: "มัดจำ",
  final: "งวดสุดท้าย",
};

function LeadPaymentSlips({ leadId }: { leadId: number }) {
  const { data: slips } = useListLeadPaymentSlips(leadId);
  const voidSlip = useVoidAdminPaymentSlip();
  const queryClient = useQueryClient();
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
             <div className="min-w-0 flex-1">
               <span className={slip.status === "verified" || slip.status === "team_reported_paid" ? "text-[#17816d]" : slip.status === "rejected" || slip.status === "voided" ? "text-[#a24439]" : slip.status === "needs_review" ? "text-[#a9791f]" : "text-[var(--ink-soft)]"}>
                {paymentStatusLabels[slip.status] ?? slip.status}
              </span>
              {" · "}{paymentKindLabels[slip.kind] ?? slip.kind}
               {typeof (slip.status === "verified" ? slip.verifiedAmountThb : slip.claimedAmountThb) === "number" && ` · ${(slip.status === "verified" ? slip.verifiedAmountThb : slip.claimedAmountThb)!.toLocaleString("th-TH")} บาท`}
              {slip.senderName && ` · จาก ${slip.senderName}`}
              {slip.slipokErrorCode && ` · code ${slip.slipokErrorCode}`}
               {slip.status === "team_reported_paid" && (
                 <p className="mt-1 text-[var(--ink-soft)]">ชำระเงินแล้วตามการรายงานของทีมใน LINE</p>
               )}
             </div>
             {slip.status === "team_reported_paid" && (
               <Button
                 type="button"
                 size="sm"
                 variant="outline"
                 className="shrink-0 rounded-none text-[#a24439]"
                 disabled={voidSlip.isPending}
                 onClick={() => {
                   if (!window.confirm("ยืนยันยกเลิกสลิปที่รายงานจากทีมนี้หรือไม่?")) return;
                   voidSlip.mutate(
                     { id: slip.id },
                     {
                       onSuccess: () => {
                         void queryClient.invalidateQueries({ queryKey: [`/api/admin/leads/${leadId}/payment-slips`] });
                         void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
                       },
                     },
                   );
                 }}
                 data-testid={`button-void-payment-slip-${slip.id}`}
               >
                 ยกเลิกสลิป (Void)
               </Button>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadPaymentSlipsBadge({ leadId }: { leadId: number }) {
  const { data: slips } = useListLeadPaymentSlips(leadId);
  if (!slips?.length) return <span className="text-[14px] text-[var(--ink-soft)]">-</span>;
  const teamReported = slips.find((s) => s.status === "team_reported_paid");
  const verified = slips.find((s) => s.status === "verified");
  if (teamReported) {
    return (
      <span className="inline-flex items-center text-[14px] text-[#17816d] bg-[#17816d]/10 px-1.5 py-0.5 font-medium whitespace-nowrap" title={`ยอดรายงาน: ${teamReported.claimedAmountThb?.toLocaleString("th-TH") ?? "-"} บาท`}>
        ● ชำระแล้ว (LINE)
      </span>
    );
  }
  if (verified) {
    return (
      <span className="inline-flex items-center text-[14px] text-[#17816d] bg-[#17816d]/10 px-1.5 py-0.5 font-medium whitespace-nowrap">
        ● ชำระแล้ว (SlipOK)
      </span>
    );
  }
  const pending = slips[0];
  return (
    <span className="inline-flex items-center text-[14px] text-[#a9791f] bg-[#a9791f]/10 px-1.5 py-0.5 whitespace-nowrap">
      ● {paymentStatusLabels[pending.status] ?? pending.status}
    </span>
  );
}

export type LeadSortField = "id" | "createdAt" | "name" | "project" | "contact" | "quoteNumber" | "mode" | "status";

function LeadsTableView({
  leads,
  expandedLeadId,
  setExpandedLeadId,
  updateStatus,
  updateLeadPending,
  quickUpdateStatus,
  quickStatusPending,
  copyQuoteLink,
  copiedQuote,
  editingNotes,
  setEditingNotes,
  editingDimensions,
  setEditingDimensions,
  saveDimensions,
  savedDimensions,
  sortField,
  sortDirection,
  onSort,
}: {
  leads: CustomerLead[];
  expandedLeadId: number | null;
  setExpandedLeadId: (id: number | null) => void;
  updateStatus: (id: number, status: string, notes?: string | null) => void;
  updateLeadPending: boolean;
  quickUpdateStatus: (id: number, status: string) => void;
  quickStatusPending: boolean;
  copyQuoteLink: (quoteNumber: string, publicQuoteToken: string) => Promise<void>;
  copiedQuote: string | null;
  editingNotes: Record<number, string>;
  setEditingNotes: Dispatch<SetStateAction<Record<number, string>>>;
  editingDimensions: Record<number, { widthMm: string; lengthMm: string; depthMm: string }>;
  setEditingDimensions: Dispatch<SetStateAction<Record<number, { widthMm: string; lengthMm: string; depthMm: string }>>>;
  saveDimensions: (lead: { id: number; status: CustomerLeadStatus; notes?: string | null }) => void;
  savedDimensions: number | null;
  sortField: LeadSortField;
  sortDirection: "asc" | "desc";
  onSort: (field: LeadSortField) => void;
}) {
  const renderSortHeader = (field: LeadSortField, label: string, className?: string) => {
    const isActive = sortField === field;
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-[var(--line)]/50 transition-colors group ${className ?? ""}`}
        onClick={() => onSort(field)}
        title={`คลิกเพื่อเรียงลำดับ ${label} (${isActive ? (sortDirection === "asc" ? "ก-ฮ / น้อย-มาก" : "ฮ-ก / มาก-น้อย") : "เรียงลำดับ"})`}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-[var(--brand-blue)] shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[var(--brand-blue)] shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-[var(--ink-soft)]/40 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="border border-[var(--line)] bg-[var(--card-paper)] overflow-x-auto shadow-sm">
      <Table className="text-xs">
        <TableHeader className="bg-[var(--line)]/30">
          <TableRow>
            {renderSortHeader("id", "#ID", "w-16 text-center font-semibold")}
            {renderSortHeader("createdAt", "วันที่", "w-28")}
            {renderSortHeader("name", "ลูกค้า / บริษัท", "w-44")}
            {renderSortHeader("project", "โครงการ / หน้างาน", "w-48")}
            {renderSortHeader("contact", "ช่องทางติดต่อ", "w-36")}
            {renderSortHeader("quoteNumber", "ใบเสนอราคา", "w-40")}
            {renderSortHeader("mode", "สินค้า / โหมด", "w-32")}
            {renderSortHeader("status", "สถานะ Lead", "w-36")}
            <TableHead className="w-36">การชำระเงิน</TableHead>
            <TableHead className="w-20 text-center">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const isExpanded = expandedLeadId === lead.id;
            return (
              <Fragment key={lead.id}>
                <TableRow
                  className={`hover:bg-[var(--line)]/20 transition-colors cursor-pointer ${isExpanded ? "bg-[var(--line)]/15 font-medium" : ""}`}
                  onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                >
                  <TableCell className="font-mono text-center text-[var(--ink-soft)] font-semibold">
                    #{lead.id}
                  </TableCell>
                  <TableCell className="text-[14px] text-[var(--ink-soft)] whitespace-nowrap">
                    {formatLeadDate(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-[var(--ink)] leading-snug">{lead.name || "ยังไม่ระบุชื่อ"}</div>
                    {lead.company && <div className="text-[14px] text-[var(--ink-soft)] truncate max-w-[170px]">{lead.company}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-[var(--ink)] font-medium truncate max-w-[180px]">{lead.project || "-"}</div>
                    {lead.site && <div className="text-[14px] text-[var(--ink-soft)] truncate max-w-[180px]" title={lead.site}>{lead.site}</div>}
                    <div className="mt-1"><WorksiteDirectionsLink lead={lead} /></div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-[var(--ink)]">{lead.phone || "-"}</div>
                    {lead.lineContact && <div className="text-[14px] text-[var(--ink-soft)] truncate max-w-[140px]">LINE: {lead.lineContact}</div>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {lead.quoteNumber ? (
                      <div className="space-y-1">
                        {lead.publicQuoteToken ? (
                          <a
                            href={adminQuoteUrl(lead.publicQuoteToken)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[var(--brand-blue)] hover:underline block truncate max-w-[150px]"
                            title="เปิดใบเสนอราคา"
                          >
                            {lead.quoteNumber}
                          </a>
                        ) : (
                          <span className="font-mono text-[var(--brand-blue)]">{lead.quoteNumber}</span>
                        )}
                        {lead.publicQuoteToken && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[14px] rounded-none text-[var(--ink-soft)]"
                            onClick={() => void copyQuoteLink(lead.quoteNumber!, lead.publicQuoteToken!)}
                          >
                            {copiedQuote === lead.quoteNumber ? <><Check className="w-3 h-3 mr-1 text-[#17816d]" /> คัดลอกแล้ว</> : <><Clipboard className="w-3 h-3 mr-1" /> ก๊อปลิงก์</>}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--ink-soft)]">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-[var(--ink)] truncate max-w-[130px] font-mono text-[14px]">
                      {lead.productSkus.length > 0 ? lead.productSkus.join(", ") : "-"}
                    </div>
                    <span className="inline-block mt-0.5 text-[14px] px-1 py-0.2 border border-[var(--line)] text-[var(--ink-soft)]">
                      {modeLabels[lead.orderMode ?? "quick-purchase"] ?? lead.orderMode}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-1.5 min-w-[130px]">
                      <select
                        value={lead.status}
                        disabled={updateLeadPending}
                        onChange={(e) => updateStatus(lead.id, e.target.value, lead.notes)}
                        className="h-7 w-full border border-[var(--line)] bg-white px-1 text-xs text-[var(--ink)] font-medium rounded-none"
                      >
                        {statusOptions.map((st) => (
                          <option key={st} value={st}>{statusLabels[st] ?? st}</option>
                        ))}
                      </select>
                      {AWAITING_CONTACT_STATUSES.includes(lead.status as string) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[14px] rounded-none text-[var(--brand-blue)] border-[var(--brand-blue)]/40 bg-[var(--brand-blue)]/10 hover:bg-[var(--brand-blue)]/20 font-semibold"
                          disabled={quickStatusPending}
                          onClick={() => quickUpdateStatus(lead.id, "selecting")}
                          title="กดเมื่อได้ติดต่อลูกค้ารายนี้แล้ว"
                          data-testid={`button-quick-contacted-${lead.id}`}
                        >
                          📞 ติดต่อแล้ว
                        </Button>
                      )}
                      {((lead.status as string) === "team_reported_paid" || (lead.status as string) === "deposit_paid") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[14px] rounded-none text-[#17816d] border-[#17816d]/40 bg-[#17816d]/10 hover:bg-[#17816d]/20 font-semibold"
                          disabled={quickStatusPending}
                          onClick={() => quickUpdateStatus(lead.id, "ready_for_production")}
                          title="กดยืนยันเพื่อเปลี่ยนเป็นพร้อมผลิต"
                          data-testid={`button-quick-production-${lead.id}`}
                        >
                          🏭 ส่งผลิต
                        </Button>
                      )}
                      {(lead.status as string) === "ready_for_production" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[14px] rounded-none text-[var(--brand-blue)] border-[var(--brand-blue)]/40 bg-[var(--brand-blue)]/10 hover:bg-[var(--brand-blue)]/20 font-semibold"
                          disabled={updateLeadPending}
                          onClick={() => updateStatus(lead.id, "closed", lead.notes)}
                          title="กดเมื่อส่งมอบงานสำเร็จแล้ว"
                        >
                          <Check className="w-3 h-3 mr-1" /> ปิดการขาย
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LeadPaymentSlipsBadge leadId={lead.id} />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[14px] rounded-none"
                      onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {isExpanded ? "ย่อ" : "ดู"}
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-[var(--paper)]/60 border-b-2 border-[var(--brand-blue)]/30">
                    <TableCell colSpan={10} className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <span className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)] font-medium">บันทึกทีมงาน</span>
                            <Textarea
                              value={editingNotes[lead.id] ?? lead.notes ?? ""}
                              onChange={(event) => setEditingNotes((current) => ({ ...current, [lead.id]: event.target.value }))}
                              onBlur={(event) => {
                                const value = event.target.value.trim() || null;
                                if (value !== (lead.notes ?? null)) updateStatus(lead.id, lead.status, value);
                              }}
                              className="mt-1 min-h-[70px] bg-white border-[var(--line)] rounded-none text-xs"
                              placeholder="เช่น นัดส่งตัวอย่างหิน หรือรอยืนยันแบบ"
                            />
                          </div>

                          {sketchImageUrls(lead).length > 0 && (
                            <div>
                              <span className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)] font-medium">แบบร่างมือ / รูปภาพหน้างาน</span>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {sketchImageUrls(lead).map((url, index) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 border border-[var(--line)] bg-black/5 overflow-hidden">
                                    <img src={url} alt={`แบบร่าง ${lead.name || ""} รูปที่ ${index + 1}`} className="h-full w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

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
                              <div className="mt-2">
                                <span className="text-[12px] uppercase tracking-wider text-[var(--ink-soft)] font-medium">ขนาดตามภาพ (mm)</span>
                                <div className="mt-1 flex flex-wrap items-end gap-2">
                                  <label className="grid gap-1 text-[14px] text-[var(--ink-soft)]">
                                    กว้าง
                                    <Input type="number" value={draft.widthMm} onChange={(e) => setField("widthMm", e.target.value)} className="w-20 h-7 text-xs rounded-none bg-white" />
                                  </label>
                                  <label className="grid gap-1 text-[14px] text-[var(--ink-soft)]">
                                    ยาว
                                    <Input type="number" value={draft.lengthMm} onChange={(e) => setField("lengthMm", e.target.value)} className="w-20 h-7 text-xs rounded-none bg-white" />
                                  </label>
                                  <label className="grid gap-1 text-[14px] text-[var(--ink-soft)]">
                                    หนา/ลึก
                                    <Input type="number" value={draft.depthMm} onChange={(e) => setField("depthMm", e.target.value)} className="w-20 h-7 text-xs rounded-none bg-white" />
                                  </label>
                                  <Button type="button" size="sm" variant="outline" className="h-7 rounded-none text-xs" disabled={updateLeadPending} onClick={() => saveDimensions(lead)}>
                                    {savedDimensions === lead.id ? <><Check className="w-3 h-3 mr-1" /> บันทึกแล้ว</> : "บันทึกขนาด"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="space-y-3">
                          <LeadPaymentSlips leadId={lead.id} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// The API server computes this (findAutoMatchLead in artifacts/api-server/src/lib/slip-matching.ts)
// and attaches it to each unassigned slip; the generated PaymentSlip type predates that field.
type UnassignedPaymentSlip = PaymentSlip & { suggestedMatch?: { leadId: number; reason: string } | null };

function UnassignedSlipsPanel({ leads }: { leads: CustomerLead[] }) {
  const { data: slips, isLoading } = useListAdminUnassignedSlips();
  const assignSlip = useAssignAdminPaymentSlip();
  const voidSlip = useVoidAdminPaymentSlip();
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<Record<number, string>>({});
  const [slipSearch, setSlipSearch] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const filteredSlips = useMemo(() => {
    const query = slipSearch.trim().toLowerCase();
    if (!query) return slips ?? [];
    return (slips ?? []).filter((slip) => {
      const sender = (slip.senderName ?? "").toLowerCase();
      const amount = typeof slip.claimedAmountThb === "number" ? slip.claimedAmountThb.toString() : "";
      return sender.includes(query) || amount.includes(query);
    });
  }, [slips, slipSearch]);

  const matchableSlips = useMemo(
    () =>
      (slips ?? []).filter((slip) => {
        const suggestedMatch = (slip as UnassignedPaymentSlip).suggestedMatch;
        return Boolean(suggestedMatch?.leadId && leads.some((lead) => lead.id === suggestedMatch.leadId));
      }),
    [slips, leads],
  );

  const bulkAssignAll = async () => {
    if (!matchableSlips.length || isBulkAssigning) return;
    setBulkError("");
    setIsBulkAssigning(true);
    try {
      const response = await fetch("/api/admin/slips/assign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assignments: matchableSlips.map((slip) => ({
            slipId: slip.id,
            leadId: (slip as UnassignedPaymentSlip).suggestedMatch!.leadId,
          })),
        }),
      });
      if (!response.ok) throw new Error("bulk-assign-failed");
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
    } catch {
      setBulkError("ผูกอัตโนมัติทั้งหมดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดสลิปรอระบุงาน...</div>;
  }

  if (!slips?.length) {
    return <div className="border border-[var(--line)] bg-[var(--card-paper)] p-10 text-center text-sm text-[var(--ink-soft)]">ไม่มีสลิปรอระบุงาน</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[var(--ink-soft)]">
        <span>
          พบสลิปรอระบุงานทั้งหมด {slips.length} รายการ
          {filteredSlips.length !== slips.length ? ` (กรองเหลือ ${filteredSlips.length} รายการ)` : ""} (มุมมองแกลเลอรี 6 คอลัมน์)
        </span>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {matchableSlips.length > 0 && (
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-none text-[14px] bg-[#17816d] text-white hover:bg-[#12634f] whitespace-nowrap"
              disabled={isBulkAssigning}
              onClick={() => void bulkAssignAll()}
              data-testid="button-bulk-auto-match-slips"
            >
              {isBulkAssigning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              ผูกอัตโนมัติทั้งหมด ({matchableSlips.length} ใบ)
            </Button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-soft)]" />
            <Input
              value={slipSearch}
              onChange={(event) => setSlipSearch(event.target.value)}
              placeholder="ค้นหาชื่อผู้โอน / ยอดเงิน"
              className="h-7 rounded-none bg-white pl-7 text-xs"
              data-testid="input-unassigned-slip-search"
            />
          </div>
        </div>
      </div>
      {bulkError && (
        <p className="text-[#a24439] text-xs" role="alert" data-testid="text-bulk-auto-match-error">
          {bulkError}
        </p>
      )}
      {filteredSlips.length === 0 ? (
        <div className="border border-[var(--line)] bg-[var(--card-paper)] p-10 text-center text-sm text-[var(--ink-soft)]">ไม่พบสลิปที่ตรงกับคำค้นหา</div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
        {filteredSlips.map((slip) => {
          const suggestedMatch = (slip as UnassignedPaymentSlip).suggestedMatch;
          const matchedLead = suggestedMatch ? leads.find((lead) => lead.id === suggestedMatch.leadId) : undefined;
          const matchedReason = suggestedMatch?.reason;
          return (
          <article key={slip.id} className="border border-[var(--line)] bg-[var(--card-paper)] p-3 flex flex-col justify-between hover:shadow-md transition-shadow text-xs" data-testid={`card-unassigned-slip-${slip.id}`}>
            <div className="space-y-2">
              <a href={slip.slipImageUrl} target="_blank" rel="noreferrer" className="block w-full h-36 border border-[var(--line)] bg-black/5 overflow-hidden" title="คลิกเพื่อดูสลิปขนาดเต็ม">
                <img src={slip.slipImageUrl} alt="สลิปรอระบุงาน" className="h-full w-full object-cover hover:scale-105 transition-transform" />
              </a>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="font-semibold text-sm text-[var(--brand-blue)]">
                    {typeof slip.claimedAmountThb === "number" ? `${slip.claimedAmountThb.toLocaleString("th-TH")} ฿` : "ไม่ระบุยอด"}
                  </strong>
                  <span className="text-[14px] border border-[var(--line)] px-1 py-0.5 text-[var(--ink-soft)] bg-white/70">
                    {paymentStatusLabels[slip.status] ?? slip.status}
                  </span>
                </div>
                <p className="font-medium text-[var(--ink)] truncate" title={slip.senderName ?? ""}>
                  จาก: {slip.senderName || "-"}
                </p>
                <p className="text-[var(--ink-soft)] text-[14px]">
                  รหัส: <strong className="text-[var(--brand-blue)] font-mono">{slip.referenceValue ?? "ไม่ระบุ"}</strong>
                </p>
                <p className="text-[14px] text-[var(--ink-soft)]">
                  รับเข้า: {formatLeadDate(slip.createdAt)}
                </p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[var(--line)] space-y-1.5">
              {matchedLead && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    title={matchedReason}
                    className="h-7 w-full rounded-none text-[14px] bg-[#17816d] text-white hover:bg-[#12634f] flex items-center justify-center gap-1"
                    disabled={assignSlip.isPending}
                    onClick={() => {
                      assignSlip.mutate(
                        { id: slip.id, data: { leadId: matchedLead.id } },
                        {
                          onSuccess: () => {
                            setSelectedLeads((current) => {
                              const next = { ...current };
                              delete next[slip.id];
                              return next;
                            });
                            void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
                            void queryClient.invalidateQueries({ queryKey: [`/api/admin/leads/${matchedLead.id}/payment-slips`] });
                          },
                        },
                      );
                    }}
                    data-testid={`button-auto-match-unassigned-slip-${slip.id}`}
                  >
                    <Check className="h-3 w-3" /> ผูกอัตโนมัติ #{matchedLead.id}
                  </Button>
                  {matchedReason && (
                    <p className="text-[14px] text-[#17816d] text-center truncate" title={matchedReason} data-testid={`text-auto-match-reason-${slip.id}`}>
                      {matchedReason}
                    </p>
                  )}
                </>
              )}
              <select
                value={selectedLeads[slip.id] ?? ""}
                onChange={(event) => setSelectedLeads((current) => ({ ...current, [slip.id]: event.target.value }))}
                className="h-7 w-full border border-[var(--line)] bg-white px-1 text-[14px] text-[var(--ink)]"
                data-testid={`select-unassigned-slip-lead-${slip.id}`}
              >
                <option value="">เลือก Lead เพื่อผูก</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    #{lead.id} · {lead.name || "ไม่ระบุ"}{lead.quoteNumber ? ` (${lead.quoteNumber})` : ""}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className="h-7 w-full rounded-none text-[14px] bg-[var(--ink)] text-white hover:bg-[var(--brand-blue)]"
                disabled={!selectedLeads[slip.id] || assignSlip.isPending}
                onClick={() => {
                  const leadId = Number(selectedLeads[slip.id]);
                  if (!Number.isInteger(leadId) || leadId <= 0) return;
                  assignSlip.mutate(
                    { id: slip.id, data: { leadId } },
                    {
                      onSuccess: () => {
                        setSelectedLeads((current) => {
                          const next = { ...current };
                          delete next[slip.id];
                          return next;
                        });
                        void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
                        void queryClient.invalidateQueries({ queryKey: [`/api/admin/leads/${leadId}/payment-slips`] });
                      },
                    },
                  );
                }}
                data-testid={`button-assign-unassigned-slip-${slip.id}`}
              >
                ผูกกับ Lead
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full rounded-none text-[14px] text-[#a24439] border-[#a24439]/40 hover:bg-[#a24439]/10"
                disabled={voidSlip.isPending}
                onClick={() => {
                  if (!window.confirm("ยืนยันยกเลิกสลิปนี้หรือไม่? (สลิปนี้จะไม่ถูกนำไปผูกกับ Lead ใดๆ)")) return;
                  voidSlip.mutate(
                    { id: slip.id },
                    {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
                      },
                    },
                  );
                }}
                data-testid={`button-void-unassigned-slip-${slip.id}`}
              >
                ยกเลิกสลิป (Void)
              </Button>
            </div>
          </article>
          );
        })}
      </div>
      )}
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
  const [activeView, setActiveView] = useState<"leads" | "unassigned">("leads");
  const [displayMode, setDisplayMode] = useState<"table" | "cards">("table");
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const initialStatusParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("status");
  const [filter, setFilter] = useState<string>(
    initialStatusParam && initialStatusParam !== "awaiting_contact" ? initialStatusParam : "all",
  );
  const [awaitingContactOnly, setAwaitingContactOnly] = useState(initialStatusParam === "awaiting_contact");
  const [quoteTypeFilter, setQuoteTypeFilter] = useState<"all" | "US" | "OF">("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [editingDimensions, setEditingDimensions] = useState<Record<number, { widthMm: string; lengthMm: string; depthMm: string }>>({});
  const [savedDimensions, setSavedDimensions] = useState<number | null>(null);
  const [copiedQuote, setCopiedQuote] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const [quickStatusPending, setQuickStatusPending] = useState(false);
  const [sortField, setSortField] = useState<LeadSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: LeadSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "createdAt" || field === "id" ? "desc" : "asc");
    }
  };

  const visibleLeads = useMemo(() => {
    let result = filterAdminLeads(leads ?? [], filter, search, { fromDate, toDate });
    if (quoteTypeFilter !== "all") {
      result = result.filter((lead) => (lead.quoteNumber ?? "").toUpperCase().includes(quoteTypeFilter));
    }
    if (awaitingContactOnly) {
      result = result.filter((lead) => AWAITING_CONTACT_STATUSES.includes(lead.status as string));
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "id":
          cmp = a.id - b.id;
          break;
        case "createdAt":
          cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
          break;
        case "name":
          cmp = (a.name || a.company || "").localeCompare(b.name || b.company || "", "th");
          break;
        case "project":
          cmp = (a.project || a.site || "").localeCompare(b.project || b.site || "", "th");
          break;
        case "contact":
          cmp = (a.phone || a.lineContact || "").localeCompare(b.phone || b.lineContact || "");
          break;
        case "quoteNumber":
          cmp = (a.quoteNumber || "").localeCompare(b.quoteNumber || "");
          break;
        case "mode":
          cmp = (a.orderMode || "").localeCompare(b.orderMode || "");
          break;
        case "status":
          cmp = (statusLabels[a.status] || a.status).localeCompare(statusLabels[b.status] || b.status, "th");
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });
  }, [filter, fromDate, leads, search, toDate, quoteTypeFilter, awaitingContactOnly, sortField, sortDirection]);
  const hasSearchFilters = Boolean(search || fromDate || toDate || quoteTypeFilter !== "all");

  const clearAwaitingContactOnly = () => {
    setAwaitingContactOnly(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const updateStatus = (id: number, status: string, notes?: string | null) => {
    updateLead.mutate(
      { id, data: { status: status as any, notes: notes ?? null } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] }) },
    );
  };

  const quickUpdateStatus = async (id: number, status: string) => {
    setQuickStatusPending(true);
    try {
      const response = await fetch(`/api/admin/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("quick-status-update-failed");
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
    } catch {
      window.alert("อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setQuickStatusPending(false);
    }
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
          <h1 className="font-semibold font-display tracking-tight">ลูกค้าและใบเสนอราคา</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-2">ติดตามตั้งแต่เริ่มคุย เลือกสินค้า จนถึงปิดการขาย</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="rounded-none">
          <RefreshCw className="w-4 h-4 mr-2" /> รีเฟรช
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div className="flex flex-wrap gap-2">
          <Button variant={activeView === "leads" ? "secondary" : "ghost"} onClick={() => setActiveView("leads")} className="rounded-none">
            Lead ทั้งหมด
          </Button>
          <Button variant={activeView === "unassigned" ? "secondary" : "ghost"} onClick={() => setActiveView("unassigned")} className="rounded-none">
            สลิปรอระบุงาน
          </Button>
        </div>
        {activeView === "leads" && (
          <div className="flex items-center gap-1 border border-[var(--line)] p-0.5" role="group" aria-label="รูปแบบการแสดงผล">
            <Button
              type="button"
              size="sm"
              variant={displayMode === "table" ? "secondary" : "ghost"}
              className="h-7 rounded-none text-xs gap-1.5"
              onClick={() => setDisplayMode("table")}
              data-testid="button-lead-view-table"
            >
              <List className="w-3.5 h-3.5" /> ตาราง
            </Button>
            <Button
              type="button"
              size="sm"
              variant={displayMode === "cards" ? "secondary" : "ghost"}
              className="h-7 rounded-none text-xs gap-1.5"
              onClick={() => setDisplayMode("cards")}
              data-testid="button-lead-view-cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> การ์ด
            </Button>
          </div>
        )}
      </div>

      {activeView === "unassigned" ? (
        <UnassignedSlipsPanel leads={leads ?? []} />
      ) : (
        <>
      {awaitingContactOnly && (
        <div className="flex items-center justify-between gap-2 border border-[var(--brand-blue)]/30 bg-[var(--brand-blue)]/10 px-3 py-2 text-xs text-[var(--ink)]" data-testid="banner-awaiting-contact-filter">
          <span>กำลังกรอง: ลูกค้ารอติดต่อ (จากหน้า Dashboard)</span>
          <Button type="button" size="sm" variant="ghost" onClick={clearAwaitingContactOnly} className="h-6 rounded-none px-2 text-xs">
            <X className="w-3 h-3 mr-1" /> ล้างตัวกรองนี้
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")} className="rounded-none">
            ทั้งหมด ({leads?.length ?? 0})
          </Button>
          <Button variant={filter === "team_reported_paid" ? "secondary" : "ghost"} onClick={() => setFilter("team_reported_paid")} className="rounded-none text-[#17816d] font-medium">
            ชำระแล้ว (LINE) ({leads?.filter((lead) => (lead.status as string) === "team_reported_paid").length ?? 0})
          </Button>
          <Button variant={filter === "ready_for_production" ? "secondary" : "ghost"} onClick={() => setFilter("ready_for_production")} className="rounded-none text-[#234c7d] font-medium">
            พร้อมผลิต ({leads?.filter((lead) => (lead.status as string) === "ready_for_production").length ?? 0})
          </Button>
          <Button variant={filter === "deposit_paid" ? "secondary" : "ghost"} onClick={() => setFilter("deposit_paid")} className="rounded-none font-medium">
            มัดจำแล้ว ({leads?.filter((lead) => (lead.status as string) === "deposit_paid").length ?? 0})
          </Button>
          <Button variant={filter === "closed" ? "secondary" : "ghost"} onClick={() => setFilter("closed")} className="rounded-none">
            ปิดการขาย ({leads?.filter((lead) => (lead.status as string) === "closed").length ?? 0})
          </Button>
          <Button variant={filter === "quote_sent" ? "secondary" : "ghost"} onClick={() => setFilter("quote_sent")} className="rounded-none">
            ส่งใบเสนอราคาแล้ว ({leads?.filter((lead) => (lead.status as string) === "quote_sent").length ?? 0})
          </Button>
        </div>

        <div className="flex items-center gap-1 border border-[var(--line)] p-1 text-xs">
          <span className="text-[var(--ink-soft)] px-1">ประเภทบิล:</span>
          <Button size="sm" variant={quoteTypeFilter === "all" ? "secondary" : "ghost"} onClick={() => setQuoteTypeFilter("all")} className="h-6 px-2 text-xs rounded-none">
            ทั้งหมด
          </Button>
          <Button size="sm" variant={quoteTypeFilter === "US" ? "secondary" : "ghost"} onClick={() => setQuoteTypeFilter("US")} className="h-6 px-2 text-xs rounded-none">
            งานติดตั้ง (US)
          </Button>
          <Button size="sm" variant={quoteTypeFilter === "OF" ? "secondary" : "ghost"} onClick={() => setQuoteTypeFilter("OF")} className="h-6 px-2 text-xs rounded-none">
            ขายแผ่น/กาว (OF)
          </Button>
        </div>
      </div>

      <div className="border border-[var(--line)] bg-[var(--card-paper)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium"><Search className="w-4 h-4 text-[var(--brand-blue)]" /> ค้นหาใบเสนอราคาและลูกค้า</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-none text-xs"
            onClick={() => downloadLeadsCsv(visibleLeads)}
            data-testid="button-export-leads-csv"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> ส่งออก CSV
          </Button>
        </div>
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
      ) : displayMode === "table" ? (
        <LeadsTableView
          leads={visibleLeads}
          expandedLeadId={expandedLeadId}
          setExpandedLeadId={setExpandedLeadId}
          updateStatus={updateStatus}
          updateLeadPending={updateLead.isPending}
          quickUpdateStatus={(id, status) => void quickUpdateStatus(id, status)}
          quickStatusPending={quickStatusPending}
          copyQuoteLink={copyQuoteLink}
          copiedQuote={copiedQuote}
          editingNotes={editingNotes}
          setEditingNotes={setEditingNotes}
          editingDimensions={editingDimensions}
          setEditingDimensions={setEditingDimensions}
          saveDimensions={saveDimensions}
          savedDimensions={savedDimensions}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                   <div className="mt-1"><WorksiteDirectionsLink lead={lead} /></div>
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
                  {(lead.orderMode === "sketch" || sketchImageUrls(lead).length > 0) && (
                    <div className="mt-3">
                      <Link
                        href={`/studio?leadId=${lead.id}`}
                        className="button button--accent"
                        data-testid={`link-open-studio-for-lead-${lead.id}`}
                      >
                        🎨 เปิดวาดใน 2D Studio
                      </Link>
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
        </>
      )}
    </div>
  );
}