import { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "wouter";
import {
  CustomerLeadStatus,
  type CustomerLead,
  type PaymentSlip,
  type SitePhoto,
  useAssignAdminPaymentSlip,
  useListAdminLeads,
  useListAdminSitePhotos,
  useListAdminUnassignedSlips,
  useListLeadPaymentSlips,
  useUpdateAdminLead,
  useVoidAdminPaymentSlip,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Check, ChevronDown, ChevronRight, Clipboard, Download, LayoutGrid, List, Loader2, MapPin, MessageSquare, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminQuoteUrl, downloadLeadsCsv, filterAdminLeads, findDuplicateLeads, leadStatusLabels as statusLabels } from "./leads-utils";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";
import { FactoryCutListModal } from "./FactoryCutListModal";
import {
  basinPlacementsViolatingEdgeClearance,
  placementCrossesPanelJoint,
  studioPieces,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type SideStatus,
  type StudioState,
} from "@/data/studio-model";

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
const FABRICATION_RISK_LABEL = "⚠️ มีจุดเสี่ยงงานช่าง";
const FABRICATION_RISK_GENERIC = "พบข้อมูลความเสี่ยงงานช่าง โปรดตรวจสอบแบบก่อนผลิต";
const FABRICATION_CLEARANCE_WARNING = `ระยะขอบเจาะอ่างต่ำกว่า ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม.`;
const FABRICATION_JOINT_WARNING = "ตำแหน่งอ่างทับแนวรอยต่อแผ่นหิน";

type FabricationFilter = "all" | "normal" | "risk";
type FinancialSafetyLead = CustomerLead & {
  hasMatchedSlip?: boolean | null;
  paymentSlipCount?: number | null;
};
type LeadWithFabricationWarnings = CustomerLead & { fabricationWarnings?: unknown };
type LeadWithTrackingInsights = CustomerLead & {
  trackingViewCount?: number | null;
  trackingViewedAt?: string | null;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function customerTrackingUrl(token: string, origin = window.location.origin): string {
  const url = new URL("/track", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

const CUSTOMER_TRACKING_LINE_MESSAGE =
  "สวัสดีครับ สามารถติดตามสถานะงานสั่งทำเคาน์เตอร์หินสังเคราะห์ของคุณได้ตลอด 24 ชม. ที่ลิงก์นี้ครับ: ";

function customerTrackingLineUrl(token: string): string {
  const message = `${CUSTOMER_TRACKING_LINE_MESSAGE}${customerTrackingUrl(token)}`;
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

function leadTrackingViewCount(lead: CustomerLead): number {
  const count = (lead as LeadWithTrackingInsights).trackingViewCount;
  return typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function leadTrackingViewedAt(lead: CustomerLead): Date | null {
  const value = (lead as LeadWithTrackingInsights).trackingViewedAt;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function LeadTrackingViewsBadge({ lead }: { lead: CustomerLead }) {
  const viewCount = leadTrackingViewCount(lead);
  const viewedAt = leadTrackingViewedAt(lead);
  const hasViews = viewCount > 0;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2 py-1 text-[11px] font-semibold ${
        hasViews
          ? "border-[#17816d]/35 bg-[#17816d]/10 text-[#116654]"
          : "border-[var(--line)] bg-[var(--line)]/20 text-[var(--ink-soft)]"
      }`}
      title={hasViews ? `เปิดดูล่าสุด: ${viewedAt ? formatThaiDateTime(viewedAt) : "ไม่พบข้อมูลเวลา"}` : undefined}
      data-testid={`badge-tracking-views-${lead.id}`}
    >
      {hasViews ? `👁️ เปิดดูแล้ว ${viewCount} ครั้ง` : "ยังไม่เคยเปิดดู"}
    </span>
  );
}

function CustomerTrackingInsightsPanel({
  lead,
  copyTrackLink,
  copiedTrackLinkId,
}: {
  lead: CustomerLead;
  copyTrackLink: (leadId: number, publicQuoteToken: string) => Promise<void>;
  copiedTrackLinkId: number | null;
}) {
  const viewCount = leadTrackingViewCount(lead);
  const viewedAt = leadTrackingViewedAt(lead);
  const publicQuoteToken = lead.quoteNumber ? lead.publicQuoteToken : null;
  const trackingUrl = publicQuoteToken ? customerTrackingUrl(publicQuoteToken) : null;

  return (
    <section
      className="border border-[var(--brand-blue)]/25 bg-[var(--brand-blue)]/5 p-3"
      data-testid="panel-customer-tracking-insights"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">การติดตามงานของลูกค้า</h3>
          <p className="text-[11px] text-[var(--ink-soft)]">Customer Portal Tracking</p>
        </div>
        <span
          className={`whitespace-nowrap text-xs font-medium ${
            viewCount > 0 ? "text-[#116654]" : "text-[var(--ink-soft)]"
          }`}
        >
          {viewCount > 0 ? `👁️ เปิดดูแล้ว ${viewCount} ครั้ง` : "ยังไม่เคยเปิดดู"}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-[var(--ink-soft)]">ลิงก์ติดตามงาน</p>
        {trackingUrl ? (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-1 block break-all text-xs text-[var(--brand-blue)] underline underline-offset-2"
            data-testid={`link-customer-tracking-${lead.id}`}
          >
            {trackingUrl}
          </a>
        ) : (
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            {lead.quoteNumber
              ? "กำลังสร้างลิงก์ติดตามงาน..."
              : "สร้างใบเสนอราคาเพื่อเปิดใช้งานลิงก์ติดตามงาน"}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--ink-soft)]">
        วันเวลาที่ลูกค้าเปิดดูล่าสุด:{" "}
        {viewedAt ? (
          <time dateTime={viewedAt.toISOString()} className="font-medium text-[var(--ink)]">
            {formatThaiDateTime(viewedAt)}
          </time>
        ) : (
          <span>{viewCount > 0 ? "ไม่พบข้อมูลเวลา" : "ยังไม่เคยเปิดดู"}</span>
        )}
      </p>
      {trackingUrl && publicQuoteToken && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-none"
            onClick={(event) => {
              event.stopPropagation();
              window.open(customerTrackingLineUrl(publicQuoteToken), "_blank", "noopener,noreferrer");
            }}
            data-testid={`button-share-track-line-${lead.id}`}
          >
            📲 ส่งลิงก์เข้า LINE ลูกค้า
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-none"
            onClick={(event) => {
              event.stopPropagation();
              void copyTrackLink(lead.id, publicQuoteToken);
            }}
            data-testid={`button-copy-track-link-${lead.id}`}
          >
            {copiedTrackLinkId === lead.id
              ? <><Check className="mr-1 h-3.5 w-3.5" /> คัดลอกแล้ว</>
              : <><Clipboard className="mr-1 h-3.5 w-3.5" /> 🔗 คัดลอกลิงก์</>}
          </Button>
        </div>
      )}
    </section>
  );
}

function hasWarningSignal(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  const record = objectRecord(value);
  return record ? Object.values(record).some(hasWarningSignal) : false;
}

function fabricationWarningMessages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const messages = fabricationWarningMessages(item);
      return messages.length ? messages : [FABRICATION_RISK_GENERIC];
    });
  }
  const record = objectRecord(value);
  if (!record) return value === true ? [FABRICATION_RISK_GENERIC] : [];
  const message = [record.message, record.summary, record.warning, record.description]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  if (message) return [message.trim()];
  const kind = [record.code, record.type, record.kind]
    .find((candidate): candidate is string => typeof candidate === "string")
    ?.toLowerCase();
  if (kind?.includes("clearance")) return [FABRICATION_CLEARANCE_WARNING];
  if (kind?.includes("joint")) return [FABRICATION_JOINT_WARNING];
  const keyedWarnings = Object.entries(record).flatMap(([key, candidate]) => {
    if (!hasWarningSignal(candidate)) return [];
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("clearance")) return [FABRICATION_CLEARANCE_WARNING];
    if (normalizedKey.includes("joint")) return [FABRICATION_JOINT_WARNING];
    if (["warning", "message", "issue", "risk"].some((term) => normalizedKey.includes(term))) {
      return fabricationWarningMessages(candidate);
    }
    return [];
  });
  if (keyedWarnings.length) return keyedWarnings;
  const nested = [record.warnings, record.messages, record.issues]
    .flatMap((candidate) => fabricationWarningMessages(candidate));
  if (nested.length) return nested;
  return record.hasRisk === true || record.risky === true || record.isSafe === false
    ? [FABRICATION_RISK_GENERIC]
    : [];
}

function leadFabricationWarnings(lead: CustomerLead): string[] {
  const extendedLead = lead as LeadWithFabricationWarnings;
  const studioData = objectRecord(lead.studioData);
  const estimate = objectRecord(studioData?.estimate);
  const warnings = [
    ...fabricationWarningMessages(extendedLead.fabricationWarnings),
    ...fabricationWarningMessages(studioData?.fabricationWarnings),
    ...fabricationWarningMessages(estimate?.fabricationWarnings),
  ];

  if (Array.isArray(estimate?.crossJointPlacements) && estimate.crossJointPlacements.length > 0) {
    warnings.push(FABRICATION_JOINT_WARNING);
  }
  if (
    Array.isArray(estimate?.basinPlacementsViolatingEdgeClearance) &&
    estimate.basinPlacementsViolatingEdgeClearance.length > 0
  ) {
    warnings.push(FABRICATION_CLEARANCE_WARNING);
  }

  const stateData = objectRecord(studioData?.state) ?? studioData;
  const rawPlacements = stateData?.basinPlacements;
  const dimensions = objectRecord(stateData?.dimensions);
  const hasLegacyGeometry = ["I", "L", "U"].includes(String(stateData?.shape)) &&
    dimensions !== null &&
    ["depthMm", "runAMm", "runBMm", "runCMm"].every((key) => typeof dimensions[key] === "number");
  if (
    Array.isArray(rawPlacements) &&
    rawPlacements.length > 0 &&
    (Array.isArray(stateData?.pieces) || hasLegacyGeometry)
  ) {
    try {
      const state = stateData as unknown as Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">;
      if (basinPlacementsViolatingEdgeClearance(state, STUDIO_BASIN_SAFETY_MARGIN_MM).length > 0) {
        warnings.push(FABRICATION_CLEARANCE_WARNING);
      }
      const pieces = studioPieces(state);
      const hasCrossJointPlacement = rawPlacements.some((rawPlacement) => {
        const placement = rawPlacement as BasinPlacement;
        const piece = pieces.find((candidate) => candidate.id === placement.pieceId) ?? pieces[0];
        return piece ? placementCrossesPanelJoint(piece, placement) : false;
      });
      if (hasCrossJointPlacement) warnings.push(FABRICATION_JOINT_WARNING);
    } catch {
      // Malformed or legacy payloads do not break the admin list; API warnings above remain visible.
    }
  }

  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))];
}

function LeadFabricationSafetyBadge({ leadId, warnings }: { leadId: number; warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  const summary = warnings.join(" · ");
  return (
    <span
      className="inline-flex items-center gap-1 border border-[#e5a354] bg-[#fff4e3] px-2 py-1 text-[11px] font-semibold leading-tight text-[#8a421d]"
      title={summary}
      aria-label={`${FABRICATION_RISK_LABEL}: ${summary}`}
      data-testid={`badge-fabrication-risk-${leadId}`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {FABRICATION_RISK_LABEL}
    </span>
  );
}

function sketchImageUrls(lead: { sketchUrl?: string | null; sketchUrls?: unknown; studioData?: unknown }) {
  const studio = objectRecord(lead.studioData);
  const studioUrls = Array.isArray(studio?.sketchUrls)
    ? studio.sketchUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];
  if (studioUrls.length) return studioUrls;
  const leadUrls = Array.isArray(lead.sketchUrls)
    ? lead.sketchUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];
  if (leadUrls.length) return leadUrls;
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

const STUDIO_DRAFT_KEY_PATTERN = /^dft_[a-f0-9]{24}$/i;

type LeadStudioDraftPayload = {
  shape: string;
  dimensions: StudioState["dimensions"];
  stoneColor?: string;
  basinSku?: string;
  basinPlacements: BasinPlacement[];
  edges: {
    activePieceId?: string;
    pieces: NonNullable<StudioState["pieces"]>;
    sideStatusesByPiece: Record<string, Record<string, string>>;
  };
};

export type LeadStudioDraftLink = {
  draftKey: string;
  resumeUrl: string;
  studioUrl: string;
};

function finiteDimension(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildLeadStudioDraftPayload(value: unknown): LeadStudioDraftPayload {
  const studioData = objectRecord(value);
  if (!studioData) throw new Error("studio-data-unavailable");
  const state = objectRecord(studioData.state) ?? studioData;
  const sourceDimensions = objectRecord(state.dimensions);
  if (!sourceDimensions) throw new Error("studio-dimensions-unavailable");

  const shapeValue = typeof state.shape === "string" ? state.shape : "I";
  const statePieces = Array.isArray(state.pieces)
    ? state.pieces as NonNullable<StudioState["pieces"]>
    : undefined;
  const pieces = studioPieces({
    shape: shapeValue as StudioState["shape"],
    dimensions: {
      depthMm: finiteDimension(sourceDimensions.depthMm),
      runAMm: finiteDimension(sourceDimensions.runAMm),
      runBMm: finiteDimension(sourceDimensions.runBMm),
      runCMm: finiteDimension(sourceDimensions.runCMm),
    },
    ...(statePieces ? { pieces: statePieces } : {}),
  });
  const firstPiece = pieces[0];
  const rectangles = firstPiece?.rectangles ?? [];
  const firstRectangle = rectangles[0];
  const secondRectangle = rectangles[1];
  const thirdRectangle = rectangles[2];
  const positiveDimension = (key: string, fallback: number) => {
    const candidate = sourceDimensions[key];
    return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
      ? candidate
      : fallback;
  };
  const depthMm = positiveDimension("depthMm", firstRectangle?.lengthMm ?? 600);
  const dimensions = {
    depthMm,
    runAMm: positiveDimension("runAMm", firstRectangle?.widthMm ?? 1500),
    runBMm: positiveDimension("runBMm", secondRectangle ? secondRectangle.lengthMm + depthMm : 0),
    runCMm: positiveDimension("runCMm", thirdRectangle ? thirdRectangle.lengthMm + depthMm : 0),
  };
  const secondLeg = rectangles.find((rectangle) => rectangle.id === "wizard-leg-1") ?? secondRectangle;
  const shape = typeof firstPiece?.preset === "string"
    ? firstPiece.preset
    : rectangles.length === 3
      ? "u"
      : rectangles.length === 2
        ? (secondLeg?.xMm ?? 0) > 0 ? "l-right" : "l-left"
        : shapeValue === "U" ? "u" : shapeValue === "L" ? "l-left" : "i";

  const rawPlacements = Array.isArray(state.basinPlacements) ? state.basinPlacements : [];
  const basinPlacements = rawPlacements.map((placement) => ({ ...placement })) as BasinPlacement[];
  const firstPlacement = objectRecord(rawPlacements[0]);
  const basinSkus = Array.isArray(state.basinSkus) ? state.basinSkus : [];
  const basinSku = typeof firstPlacement?.sku === "string" && firstPlacement.sku
    ? firstPlacement.sku
    : typeof basinSkus[0] === "string" && basinSkus[0]
      ? basinSkus[0]
      : undefined;
  const activeStone = typeof state.activeStone === "string" ? state.activeStone.trim() : "";
  const safePieces = pieces.map((piece) => {
    if (!piece || typeof piece.id !== "string" || !Array.isArray(piece.rectangles)) {
      throw new Error("studio-piece-invalid");
    }
    const sideStatuses = (objectRecord(piece.sideStatuses) ?? {}) as Record<string, SideStatus>;
    return {
      ...piece,
      rectangles: piece.rectangles.map((rectangle) => ({ ...rectangle })),
      sideStatuses: { ...sideStatuses },
    };
  });

  return {
    shape,
    dimensions,
    ...(activeStone ? { stoneColor: activeStone } : {}),
    ...(basinSku ? { basinSku } : {}),
    basinPlacements,
    edges: {
      activePieceId: typeof state.activePieceId === "string" ? state.activePieceId : safePieces[0]?.id,
      pieces: safePieces,
      sideStatusesByPiece: Object.fromEntries(
        safePieces.map((piece) => [piece.id, { ...piece.sideStatuses }]),
      ),
    },
  };
}

export async function createLeadStudioDraft(
  studioData: unknown,
  fetcher: typeof fetch = fetch,
  origin?: string,
): Promise<LeadStudioDraftLink> {
  const payload = buildLeadStudioDraftPayload(studioData);
  const response = await fetcher("/api/studio/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`studio-draft-http-${response.status}`);

  const result = objectRecord(await response.json());
  const draftKey = typeof result?.draftKey === "string" ? result.draftKey : "";
  const resumeUrl = typeof result?.resumeUrl === "string" ? result.resumeUrl.trim() : "";
  if (!STUDIO_DRAFT_KEY_PATTERN.test(draftKey) || !resumeUrl) {
    throw new Error("studio-draft-response-invalid");
  }
  const baseOrigin = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  if (!baseOrigin) throw new Error("studio-draft-origin-unavailable");

  return {
    draftKey,
    resumeUrl: new URL(resumeUrl, baseOrigin).toString(),
    studioUrl: `/studio?draft=${encodeURIComponent(draftKey)}`,
  };
}

export async function handleLeadStudioDraftRequest(
  studioData: unknown,
  onCreated: (draft: LeadStudioDraftLink) => void,
  fetcher: typeof fetch = fetch,
  origin?: string,
): Promise<LeadStudioDraftLink> {
  const draft = await createLeadStudioDraft(studioData, fetcher, origin);
  onCreated(draft);
  return draft;
}

export function LeadStudioDraftDialogContent({
  draft,
  copied,
  error,
  onCopy,
}: {
  draft: LeadStudioDraftLink;
  copied: boolean;
  error: string;
  onCopy: () => void;
}) {
  return (
    <>
      <DialogTitle>ลิงก์แบบร่าง Studio</DialogTitle>
      <label htmlFor="lead-studio-draft-url" className="mt-3 text-sm font-medium">ลิงก์สำหรับแชร์</label>
      <Input
        id="lead-studio-draft-url"
        value={draft.resumeUrl}
        readOnly
        className="mt-1 rounded-none"
        data-testid="input-lead-studio-draft-url"
      />
      {error && <p className="text-sm text-[#a24439]" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-none" onClick={onCopy} data-testid="button-copy-lead-studio-draft-link">
          {copied ? <><Check className="mr-1 h-4 w-4" /> คัดลอกแล้ว</> : <><Clipboard className="mr-1 h-4 w-4" /> คัดลอกลิงก์</>}
        </Button>
        <Link href={draft.studioUrl} className="button button--accent" data-testid="link-lead-studio-draft-open">
          ↗️ เปิดใน Studio
        </Link>
      </div>
    </>
  );
}

export function LeadStudioDraftAction({ lead }: { lead: CustomerLead }) {
  const [draft, setDraft] = useState<LeadStudioDraftLink | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const createDraft = async () => {
    setError("");
    setCopied(false);
    setPending(true);
    try {
      await handleLeadStudioDraftRequest(lead.studioData, setDraft);
    } catch {
      setError("สร้างลิงก์ Studio ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  };
  const copyDraftLink = async () => {
    if (!draft) return;
    setError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(draft.resumeUrl);
      setCopied(true);
    } catch {
      setError("คัดลอกลิงก์ไม่ได้ กรุณาคัดลอกจากช่องลิงก์โดยตรง");
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-none"
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          void createDraft();
        }}
        data-testid="button-lead-generate-studio-draft"
      >
        {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> กำลังสร้างลิงก์...</> : "📐 สร้างลิงก์ Studio"}
      </Button>
      {error && !draft && <p className="mt-2 text-sm text-[#a24439]" role="alert">{error}</p>}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            setCopied(false);
            setError("");
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-none" data-testid="dialog-lead-studio-draft">
          {draft && (
            <LeadStudioDraftDialogContent
              draft={draft}
              copied={copied}
              error={error}
              onCopy={() => void copyDraftLink()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeadSketchAction({ lead }: { lead: CustomerLead }) {
  const imageUrl = sketchImageUrls(lead)[0];
  if (!imageUrl) return null;
  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="button button--outline"
      data-testid="button-lead-view-sketch"
    >
      🖼️ ดูภาพแบบร่าง
    </a>
  );
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

const sitePhotoStageLabels: Record<string, string> = {
  survey: "📐 วัดหน้างาน",
  installation: "🛠️ ติดตั้ง",
  service: "🔧 เก็บงาน",
  completed: "✅ เสร็จสมบูรณ์",
};

/**
 * Matches site photos to a lead via GET /admin/site-photos?leadId=... --
 * i.e. photo.leadId === lead.id, computed server-side. There is no jobCode
 * field on CustomerLead (leadKey/quoteNumber use unrelated formats, and the
 * lead's matched LINE job code lives in lead_external_references with no
 * endpoint exposing it here), so a jobCode-based fallback match isn't
 * implemented: it would either be a no-op or risk showing a photo on the
 * wrong lead, which is worse than just relying on the leadId link staff set
 * from the site-photos gallery's lightbox editor.
 */
export function LeadSitePhotos({ leadId }: { leadId: number }) {
  const { data: photos } = useListAdminSitePhotos({ leadId });
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);

  return (
    <div className="mt-4 max-w-2xl">
      <label className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">
        📸 ภาพถ่ายหน้างานจริง{photos && photos.length > 0 ? ` (${photos.length} ภาพ)` : ""}
      </label>
      {!photos?.length ? (
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]" data-testid={`text-no-site-photos-${leadId}`}>ยังไม่มีภาพหน้างาน</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-2" data-testid={`gallery-lead-site-photos-${leadId}`}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="relative block h-16 w-16 shrink-0 overflow-hidden border border-[var(--line)]"
              data-testid={`button-lead-site-photo-${photo.id}`}
            >
              <img src={photo.imageUrl} alt={photo.description || "ภาพหน้างาน"} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[10px] leading-tight text-white" data-testid={`badge-lead-site-photo-stage-${photo.id}`}>
                {sitePhotoStageLabels[photo.stage] ?? photo.stage}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={selectedPhoto !== null} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}>
        <DialogContent className="max-w-2xl gap-0 rounded-none p-0" data-testid="dialog-lead-site-photo-lightbox">
          {selectedPhoto && (
            <div>
              <DialogTitle className="sr-only">{selectedPhoto.description || "ภาพหน้างาน"}</DialogTitle>
              <img src={selectedPhoto.imageUrl} alt={selectedPhoto.description || "ภาพหน้างาน"} className="max-h-[70vh] w-full bg-black object-contain" />
              <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
                <span>{sitePhotoStageLabels[selectedPhoto.stage] ?? selectedPhoto.stage}</span>
                {selectedPhoto.senderName && <span className="text-[var(--ink-soft)]">จาก {selectedPhoto.senderName}</span>}
              </div>
              {selectedPhoto.description && <p className="px-4 pb-4 text-sm text-[var(--ink-soft)]">{selectedPhoto.description}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
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

function buildSalesLineMessage(lead: CustomerLead): string {
  const quoteUrl = lead.publicQuoteToken ? adminQuoteUrl(lead.publicQuoteToken) : "";
  const name = lead.name || "ท่าน";
  const quoteNum = lead.quoteNumber || "อยู่ระหว่างสรุป";
  const project = [lead.project, lead.site].filter(Boolean).join(" · ") || "-";

  const studio = lead.studioData as { estimate?: { totalTHB?: number } } | null;
  const estimateTotal = studio?.estimate?.totalTHB ? `${studio.estimate.totalTHB.toLocaleString("th-TH")} บาท` : null;

  return `สวัสดีค่ะคุณ ${name} ดิฉัน "น้องไนท์" จาก Knight Furnich นะคะ 🐴✨

สรุปข้อมูลใบเสนอราคา/งานสั่งผลิตของท่าน:
• เลขที่ใบเสนอราคา: ${quoteNum}
• โครงการ/สถานที่: ${project}${estimateTotal ? `\n• ยอดรวมประมาณการ: ${estimateTotal}` : ""}${quoteUrl ? `\n\nท่านสามารถคลิกดูรายละเอียดและใบเสนอราคาฉบับเต็มได้ที่ลิงก์นี้ค่ะ:\n👉 ${quoteUrl}` : ""}

หากต้องการปรับเปลี่ยนแบบ เพิ่ม-ลดขนาด หรือปรึกษาเรื่องการติดตั้ง สามารถแจ้งน้องไนท์ได้ตลอดเลยนะคะ ขอบคุณค่ะ 🙏`;
}

export type LeadSortField = "id" | "createdAt" | "name" | "project" | "contact" | "quoteNumber" | "mode" | "status";

type LeadSiteLocationFields = {
  siteLat?: number | null;
  siteLng?: number | null;
  siteMapsUrl?: string | null;
};

function leadAddressMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function LeadSiteLocationEditor({ lead }: { lead: CustomerLead }) {
  const leadLocation = lead as CustomerLead & LeadSiteLocationFields;
  const queryClient = useQueryClient();
  const [mapsLink, setMapsLink] = useState(leadLocation.siteMapsUrl ?? "");
  const [siteLocation, setSiteLocation] = useState<LeadSiteLocationFields>({
    siteLat: leadLocation.siteLat ?? null,
    siteLng: leadLocation.siteLng ?? null,
    siteMapsUrl: leadLocation.siteMapsUrl ?? null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const hasCoordinates =
    typeof siteLocation.siteLat === "number" &&
    Number.isFinite(siteLocation.siteLat) &&
    typeof siteLocation.siteLng === "number" &&
    Number.isFinite(siteLocation.siteLng);

  const saveMapsLink = async () => {
    const normalizedLink = mapsLink.trim();
    if (!normalizedLink) {
      setFeedback({ kind: "error", text: "กรุณาวางลิงก์ Google Maps ก่อนบันทึก" });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}/site-location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mapsLink: normalizedLink }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const payloadRecord = payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : null;

      if (!response.ok) {
        const apiMessage = typeof payloadRecord?.message === "string" ? payloadRecord.message.trim() : "";
        const text = response.status === 400 && apiMessage
          ? apiMessage
          : response.status === 404
            ? "ไม่พบ Lead นี้ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง"
            : "บันทึกลิงก์ Google Maps ไม่สำเร็จ กรุณาตรวจสอบลิงก์แล้วลองอีกครั้ง";
        setFeedback({ kind: "error", text });
        return;
      }

      if (!payloadRecord || typeof payloadRecord.siteMapsUrl !== "string") {
        setFeedback({ kind: "error", text: "บันทึกพิกัดไม่สำเร็จ กรุณาลองอีกครั้ง" });
        return;
      }

      const nextLocation: LeadSiteLocationFields = {
        siteLat: typeof payloadRecord.siteLat === "number" && Number.isFinite(payloadRecord.siteLat)
          ? payloadRecord.siteLat
          : null,
        siteLng: typeof payloadRecord.siteLng === "number" && Number.isFinite(payloadRecord.siteLng)
          ? payloadRecord.siteLng
          : null,
        siteMapsUrl: payloadRecord.siteMapsUrl,
      };
      setSiteLocation(nextLocation);
      setFeedback({ kind: "success", text: "บันทึกลิงก์และพิกัดหน้างานแล้ว" });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/technician-calendar"] });
    } catch {
      setFeedback({ kind: "error", text: "เชื่อมต่อเพื่อบันทึกลิงก์ Google Maps ไม่ได้ กรุณาลองอีกครั้ง" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-2 border border-[var(--line)] bg-[var(--paper)] p-3" aria-label="พิกัดและการนำทางหน้างาน">
      <label htmlFor={`lead-maps-link-${lead.id}`} className="block text-[12px] font-medium text-[var(--ink-soft)]">
        ลิงก์ Google Maps หน้างาน
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`lead-maps-link-${lead.id}`}
          type="text"
          inputMode="url"
          value={mapsLink}
          onChange={(event) => {
            setMapsLink(event.target.value);
            setFeedback(null);
          }}
          placeholder="วางลิงก์ Google Maps"
          className="min-w-0 rounded-none bg-white"
          data-testid="input-lead-maps-link"
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-10 rounded-none"
          disabled={isSaving || !mapsLink.trim()}
          onClick={() => void saveMapsLink()}
          data-testid="button-save-lead-maps-link"
        >
          {isSaving ? <><RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> กำลังบันทึก</> : "บันทึกลิงก์"}
        </Button>
      </div>

      {hasCoordinates && (
        <p className="text-[12px] text-[var(--ink-soft)]" data-testid="lead-maps-coords">
          พิกัดหน้างาน: {siteLocation.siteLat!.toFixed(5)}, {siteLocation.siteLng!.toFixed(5)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {siteLocation.siteMapsUrl && (
          <a
            href={siteLocation.siteMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 border border-[var(--brand-blue)] bg-[var(--brand-blue)] px-3 text-xs font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
            data-testid="button-navigate-lead"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            นำทาง Google Maps
          </a>
        )}
        {!hasCoordinates && lead.address?.trim() && (
          <a
            href={leadAddressMapsSearchUrl(lead.address.trim())}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
            data-testid="button-search-lead-address"
          >
            ค้นหาที่อยู่ใน Google Maps
          </a>
        )}
      </div>
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={feedback.kind === "error" ? "text-[12px] text-[#a24439]" : "text-[12px] text-[#17816d]"}
          data-testid="status-lead-maps-save"
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}

function LeadDeleteAction({
  lead,
  onRequestDelete,
}: {
  lead: FinancialSafetyLead;
  onRequestDelete: (lead: FinancialSafetyLead) => void;
}) {
  const paymentSlipCount = Math.max(0, lead.paymentSlipCount ?? 0);
  const hasFinancialLock = lead.hasMatchedSlip === true || paymentSlipCount > 0;
  const lockTooltip = "มีรายการเงินผูกอยู่ ไม่สามารถลบได้";

  return (
    <div className="flex flex-col items-center gap-1">
      {hasFinancialLock && (
        <span
          className="whitespace-nowrap border border-[#b78320]/40 bg-[#b78320]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6318]"
          data-testid={`badge-financial-lock-${lead.id}`}
        >
          🔒 มีสลิป {paymentSlipCount} ใบ
        </span>
      )}
      <span className="inline-flex" title={hasFinancialLock ? lockTooltip : undefined}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 whitespace-nowrap rounded-none border-[#a24439]/40 px-2 text-[14px] text-[#a24439]"
          disabled={hasFinancialLock}
          title={hasFinancialLock ? lockTooltip : undefined}
          onClick={() => onRequestDelete(lead)}
          data-testid={`button-delete-lead-${lead.id}`}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          ลบงาน
        </Button>
      </span>
    </div>
  );
}

function LeadsTableView({
  leads,
  fabricationWarningsByLeadId,
  duplicateLeadsById,
  expandedLeadId,
  setExpandedLeadId,
  onRequestDeleteLead,
  highlightedLeadId,
  onNavigateToLead,
  updateStatus,
  updateLeadPending,
  quickUpdateStatus,
  quickStatusPending,
  copyQuoteLink,
  copiedQuote,
  copyTrackLink,
  copiedTrackLinkId,
  copySalesMessage,
  copiedSalesMsg,
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
  fabricationWarningsByLeadId: ReadonlyMap<number, readonly string[]>;
  duplicateLeadsById: ReadonlyMap<number, CustomerLead[]>;
  expandedLeadId: number | null;
  setExpandedLeadId: (id: number | null) => void;
  onRequestDeleteLead: (lead: FinancialSafetyLead) => void;
  highlightedLeadId: number | null;
  onNavigateToLead: (id: number) => void;
  updateStatus: (id: number, status: string, notes?: string | null) => void;
  updateLeadPending: boolean;
  quickUpdateStatus: (id: number, status: string) => void;
  quickStatusPending: boolean;
  copyQuoteLink: (quoteNumber: string, publicQuoteToken: string) => Promise<void>;
  copiedQuote: string | null;
  copyTrackLink: (leadId: number, publicQuoteToken: string) => Promise<void>;
  copiedTrackLinkId: number | null;
  copySalesMessage: (lead: CustomerLead) => Promise<void>;
  copiedSalesMsg: number | null;
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
            const duplicateLeads = duplicateLeadsById.get(lead.id) ?? [];
            const isHighlighted = highlightedLeadId === lead.id;
            return (
              <Fragment key={lead.id}>
                <TableRow
                  id={`lead-row-${lead.id}`}
                  data-testid={`row-admin-lead-${lead.id}`}
                  className={`hover:bg-[var(--line)]/20 transition-colors cursor-pointer ${isExpanded ? "bg-[var(--line)]/15 font-medium" : ""} ${isHighlighted ? "bg-[#fff4e3] outline outline-2 outline-[#e5a354] outline-offset-[-2px]" : ""}`}
                  onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                >
                  <TableCell className="font-mono text-center text-[var(--ink-soft)] font-semibold">
                    #{lead.id}
                  </TableCell>
                  <TableCell className="text-[14px] text-[var(--ink-soft)] whitespace-nowrap">
                    {formatLeadDate(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[var(--ink)] leading-snug">{lead.name || "ยังไม่ระบุชื่อ"}</span>
                      <LeadFabricationSafetyBadge leadId={lead.id} warnings={fabricationWarningsByLeadId.get(lead.id) ?? []} />
                      <LeadTrackingViewsBadge lead={lead} />
                    </div>
                    {lead.company && <div className="text-[14px] text-[var(--ink-soft)] truncate max-w-[170px]">{lead.company}</div>}
                    <div className="mt-1">
                      <DuplicateLeadBadge
                        lead={lead}
                        count={duplicateLeads.length}
                        isExpanded={isExpanded}
                        onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                      />
                    </div>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[14px] rounded-none font-semibold text-[var(--brand-blue)]"
                          onClick={() => void copySalesMessage(lead)}
                          title="คัดลอกข้อความทักทายพร้อมรายละเอียดใบเสนอราคา เพื่อส่งให้ลูกค้าทาง LINE"
                          data-testid={`button-copy-sales-message-${lead.id}`}
                        >
                          {copiedSalesMsg === lead.id ? <><Check className="w-3 h-3 mr-1 text-[#17816d]" /> คัดลอกแล้ว</> : <><MessageSquare className="w-3 h-3 mr-1" /> ข้อความส่งลูกค้า</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-[var(--ink-soft)]">-</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[14px] rounded-none font-semibold text-[var(--brand-blue)]"
                          onClick={() => void copySalesMessage(lead)}
                          title="คัดลอกข้อความทักทายพร้อมรายละเอียดงาน เพื่อส่งให้ลูกค้าทาง LINE"
                          data-testid={`button-copy-sales-message-${lead.id}`}
                        >
                          {copiedSalesMsg === lead.id ? <><Check className="w-3 h-3 mr-1 text-[#17816d]" /> คัดลอกแล้ว</> : <><MessageSquare className="w-3 h-3 mr-1" /> ข้อความส่งลูกค้า</>}
                        </Button>
                      </div>
                    )}
                    {lead.publicQuoteToken && (
                      <div className="mt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[14px] rounded-none font-semibold text-[var(--brand-blue)]"
                          onClick={() => void copyTrackLink(lead.id, lead.publicQuoteToken!)}
                            data-testid={`button-copy-track-link-summary-${lead.id}`}
                        >
                          {copiedTrackLinkId === lead.id
                            ? <><Check className="w-3 h-3 mr-1 text-[#17816d]" /> คัดลอกแล้ว</>
                            : <><Clipboard className="w-3 h-3 mr-1" /> ลิงก์ติดตามงาน</>}
                        </Button>
                        <Link
                          href={`/handover?token=${encodeURIComponent(lead.publicQuoteToken)}`}
                          className="ml-1 inline-flex h-6 items-center gap-1 rounded-none px-1.5 text-[14px] font-semibold text-[var(--brand-blue)] hover:bg-[var(--brand-sky)]"
                          data-testid={`button-open-handover-${lead.id}`}
                          title="เปิดเอกสารส่งมอบและรับประกันงานติดตั้ง"
                        >
                          <Clipboard className="h-3 w-3" aria-hidden="true" />
                          ใบส่งมอบงาน
                        </Link>
                      </div>
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
                    <div className="flex flex-col items-center gap-1.5">
                      <LeadDeleteAction lead={lead} onRequestDelete={onRequestDeleteLead} />
                      <FactoryCutListModal lead={lead} />
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
                    </div>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-[var(--paper)]/60 border-b-2 border-[var(--brand-blue)]/30">
                    <TableCell colSpan={10} className="p-4 space-y-4">
                      <CustomerTrackingInsightsPanel
                        lead={lead}
                        copyTrackLink={copyTrackLink}
                        copiedTrackLinkId={copiedTrackLinkId}
                      />
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
                          <LeadSiteLocationEditor key={lead.id} lead={lead} />
                          <LeadPaymentSlips leadId={lead.id} />
                          <LeadSitePhotos leadId={lead.id} />
                        </div>
                      </div>
                    <DuplicateLeadHistory
                      leadId={lead.id}
                      duplicateLeads={duplicateLeads}
                      onNavigateToLead={onNavigateToLead}
                    />
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

function DuplicateLeadBadge({
  lead,
  count,
  isExpanded,
  onClick,
}: {
  lead: Pick<CustomerLead, "id">;
  count: number;
  isExpanded: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-controls={`panel-duplicate-leads-${lead.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex rounded-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a85b13]"
      data-testid={`button-toggle-duplicate-lead-${lead.id}`}
    >
      <span
        className="inline-flex items-center border border-[#e5a354] bg-[#fff4e3] px-2 py-1 text-[11px] font-semibold leading-tight text-[#8a421d]"
        data-testid={`badge-duplicate-lead-${lead.id}`}
      >
        ⚠️ มีประวัติเดิม {count} รายการ
      </span>
    </button>
  );
}

function DuplicateLeadHistory({
  leadId,
  duplicateLeads,
  onNavigateToLead,
}: {
  leadId: number;
  duplicateLeads: CustomerLead[];
  onNavigateToLead: (id: number) => void;
}) {
  if (duplicateLeads.length === 0) return null;
  return (
    <section
      id={`panel-duplicate-leads-${leadId}`}
      className="border border-[#e5a354] bg-[#fffaf1] p-3"
      aria-labelledby={`title-duplicate-leads-${leadId}`}
      data-testid="panel-duplicate-leads"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`title-duplicate-leads-${leadId}`} className="text-sm font-semibold text-[#8a421d]">
          ประวัติที่เกี่ยวข้องของลูกค้ารายนี้
        </h3>
        <span className="text-xs text-[var(--ink-soft)]">{duplicateLeads.length} รายการที่อาจเกี่ยวข้อง</span>
      </div>
      <ul className="mt-2 divide-y divide-[#e5a354]/40">
        {duplicateLeads.map((relatedLead) => (
          <li key={relatedLead.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold text-[var(--brand-blue)]">
                {relatedLead.leadKey || relatedLead.quoteNumber || `#${relatedLead.id}`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink)]">
                วันที่ {formatLeadDate(relatedLead.createdAt)} · สถานะ {statusLabels[relatedLead.status] ?? relatedLead.status}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
                {[relatedLead.name, relatedLead.project].filter(Boolean).join(" · ") || "ไม่ระบุชื่อลูกค้า"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-none border-[#d49a5b] px-2 text-xs text-[#8a421d]"
              onClick={() => onNavigateToLead(relatedLead.id)}
              data-testid={`button-open-duplicate-lead-${relatedLead.id}`}
            >
              ไปยัง Lead
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
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
  const { toast } = useToast();
  const [leadToDelete, setLeadToDelete] = useState<FinancialSafetyLead | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [activeView, setActiveView] = useState<"leads" | "unassigned">("leads");
  const [displayMode, setDisplayMode] = useState<"table" | "cards">("table");
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<number | null>(null);
  const [fabricationFilter, setFabricationFilter] = useState<FabricationFilter>("all");
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
  const [copiedTrackLinkId, setCopiedTrackLinkId] = useState<number | null>(null);
  const [copiedSalesMsg, setCopiedSalesMsg] = useState<number | null>(null);
  const [copyError, setCopyError] = useState("");
  const [quickStatusPending, setQuickStatusPending] = useState(false);
  const [sortField, setSortField] = useState<LeadSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const fabricationWarningsByLeadId = useMemo(() => {
    const warningsByLeadId = new Map<number, string[]>();
    (leads ?? []).forEach((lead) => {
      const warnings = leadFabricationWarnings(lead);
      if (warnings.length > 0) warningsByLeadId.set(lead.id, warnings);
    });
    return warningsByLeadId;
  }, [leads]);

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
    if (fabricationFilter === "risk") {
      result = result.filter((lead) => fabricationWarningsByLeadId.has(lead.id));
    } else if (fabricationFilter === "normal") {
      result = result.filter((lead) => !fabricationWarningsByLeadId.has(lead.id));
    }
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
  }, [filter, fromDate, leads, search, toDate, quoteTypeFilter, awaitingContactOnly, sortField, sortDirection, fabricationFilter, fabricationWarningsByLeadId]);
  const visibleFinancialLeads = visibleLeads as FinancialSafetyLead[];
  const duplicateLeadsById = useMemo(
    () => new Map(visibleLeads.map((lead) => [lead.id, findDuplicateLeads(lead, leads ?? [])])),
    [leads, visibleLeads],
  );
  useEffect(() => {
    if (highlightedLeadId === null || displayMode !== "table") return;
    const row = document.getElementById(`lead-row-${highlightedLeadId}`);
    if (!row || typeof row.scrollIntoView !== "function") return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeoutId = window.setTimeout(() => {
      setHighlightedLeadId((current) => current === highlightedLeadId ? null : current);
    }, 2200);
    return () => window.clearTimeout(timeoutId);
  }, [displayMode, highlightedLeadId, visibleLeads]);
  const hasSearchFilters = Boolean(search || fromDate || toDate || quoteTypeFilter !== "all");
  const fabricationRiskCount = fabricationWarningsByLeadId.size;
  const fabricationNormalCount = Math.max(0, (leads?.length ?? 0) - fabricationRiskCount);

  const clearAwaitingContactOnly = () => {
    setAwaitingContactOnly(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const navigateToRelatedLead = (leadId: number) => {
    setActiveView("leads");
    setDisplayMode("table");
    setFilter("all");
    clearAwaitingContactOnly();
    setQuoteTypeFilter("all");
    setSearch("");
    setFromDate("");
    setToDate("");
    setFabricationFilter("all");
    setExpandedLeadId(leadId);
    setHighlightedLeadId(leadId);
  };

  const updateStatus = (id: number, status: string, notes?: string | null) => {
    updateLead.mutate(
      { id, data: { status: status as any, notes: notes ?? null } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] }) },
    );
  };

  const confirmLeadDeletion = async () => {
    const lead = leadToDelete;
    if (!lead || isDeletingLead) return;
    if (lead.hasMatchedSlip === true || (lead.paymentSlipCount ?? 0) > 0) {
      toast({
        description: "มีรายการเงินผูกอยู่ ไม่สามารถลบได้",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingLead(true);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        let errorMessage = "ลบงานไม่สำเร็จ กรุณาลองใหม่";
        try {
          const payload = objectRecord(await response.json());
          const responseMessage = payload
            && [payload.message, payload.error, payload.reason].find(
              (value): value is string => typeof value === "string" && value.trim().length > 0,
            );
          if (responseMessage) errorMessage = responseMessage;
        } catch {
          // Use the local message when the server does not return a JSON error.
        }
        throw new Error(errorMessage);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      setLeadToDelete(null);
      toast({ description: "ลบ Lead เรียบร้อยแล้ว" });
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : "ลบงานไม่สำเร็จ กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsDeletingLead(false);
    }
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

  const copyTrackLink = async (leadId: number, publicQuoteToken: string) => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(customerTrackingUrl(publicQuoteToken));
      setCopiedTrackLinkId(leadId);
      toast({ description: "คัดลอกลิงก์ติดตามงานแล้ว" });
      window.setTimeout(() => setCopiedTrackLinkId((current) => current === leadId ? null : current), 1800);
    } catch {
      const message = "คัดลอกลิงก์ติดตามงานไม่ได้ กรุณาเปิดหน้าเว็บผ่าน HTTPS";
      setCopyError(message);
      toast({ description: message, variant: "destructive" });
    }
  };

  const copySalesMessage = async (lead: CustomerLead) => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(buildSalesLineMessage(lead));
      setCopiedSalesMsg(lead.id);
      window.setTimeout(() => setCopiedSalesMsg((current) => current === lead.id ? null : current), 2200);
    } catch {
      setCopyError("คัดลอกข้อความไม่ได้ กรุณาเปิดหน้าเว็บผ่าน HTTPS");
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
        <Button
          variant="outline"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
            void queryClient.invalidateQueries({ queryKey: ["/api/admin/slips/unassigned"] });
            void refetch();
          }}
          disabled={isLoading}
          className="rounded-none"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> รีเฟรช
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

      <div className="flex flex-wrap items-center gap-1 border border-[var(--line)] p-1 text-xs" role="group" aria-label="กรองความเสี่ยงงานช่าง" data-testid="filter-fabrication-risk">
        <span className="text-[var(--ink-soft)] px-1">ความเสี่ยงงานช่าง:</span>
        <Button type="button" size="sm" variant={fabricationFilter === "all" ? "secondary" : "ghost"} aria-pressed={fabricationFilter === "all"} onClick={() => setFabricationFilter("all")} className="h-7 px-2 text-xs rounded-none" data-testid="filter-fabrication-all">
          ทั้งหมด ({leads?.length ?? 0})
        </Button>
        <Button type="button" size="sm" variant={fabricationFilter === "normal" ? "secondary" : "ghost"} aria-pressed={fabricationFilter === "normal"} onClick={() => setFabricationFilter("normal")} className="h-7 px-2 text-xs rounded-none" data-testid="filter-fabrication-normal">
          ปกติ ({fabricationNormalCount})
        </Button>
        <Button type="button" size="sm" variant={fabricationFilter === "risk" ? "secondary" : "ghost"} aria-pressed={fabricationFilter === "risk"} onClick={() => setFabricationFilter("risk")} className="h-7 px-2 text-xs rounded-none text-[#8a421d]" data-testid="filter-fabrication-risk-only">
          {FABRICATION_RISK_LABEL} ({fabricationRiskCount})
        </Button>
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
          leads={visibleFinancialLeads}
          fabricationWarningsByLeadId={fabricationWarningsByLeadId}
          duplicateLeadsById={duplicateLeadsById}
          expandedLeadId={expandedLeadId}
          setExpandedLeadId={setExpandedLeadId}
          onRequestDeleteLead={setLeadToDelete}
          highlightedLeadId={highlightedLeadId}
          onNavigateToLead={navigateToRelatedLead}
          updateStatus={updateStatus}
          updateLeadPending={updateLead.isPending}
          quickUpdateStatus={(id, status) => void quickUpdateStatus(id, status)}
          quickStatusPending={quickStatusPending}
          copyQuoteLink={copyQuoteLink}
          copiedQuote={copiedQuote}
          copyTrackLink={copyTrackLink}
          copiedTrackLinkId={copiedTrackLinkId}
          copySalesMessage={copySalesMessage}
          copiedSalesMsg={copiedSalesMsg}
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
          {visibleFinancialLeads.map((lead) => {
            const duplicateLeads = duplicateLeadsById.get(lead.id) ?? [];
            const isExpanded = expandedLeadId === lead.id;
            const isHighlighted = highlightedLeadId === lead.id;
            return (
            <article
              key={lead.id}
              id={`lead-row-${lead.id}`}
              data-testid={`row-admin-lead-${lead.id}`}
              className={`border border-[var(--line)] bg-[var(--card-paper)] p-5 ${isHighlighted ? "outline outline-2 outline-[#e5a354]" : ""}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">{lead.name || "ยังไม่ระบุชื่อ"}</strong>
                    <span className="text-xs border border-[var(--line)] px-2 py-1">{statusLabels[lead.status]}</span>
                      <LeadDeleteAction lead={lead} onRequestDelete={setLeadToDelete} />
                    <LeadFabricationSafetyBadge leadId={lead.id} warnings={fabricationWarningsByLeadId.get(lead.id) ?? []} />
                    <LeadTrackingViewsBadge lead={lead} />
                    <DuplicateLeadBadge
                      lead={lead}
                      count={duplicateLeads.length}
                      isExpanded={isExpanded}
                      onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                    />
                  </div>
                  <p className="text-sm text-[var(--ink-soft)] mt-1">{lead.project || "ยังไม่ระบุโครงการ"} · แหล่งที่มา {lead.source}</p>
                   <p className="text-xs text-[var(--ink-soft)] mt-1">หน้างาน: {lead.site || "ยังไม่ระบุ"}</p>
                    <div className="mt-1"><WorksiteDirectionsLink lead={lead} /></div>
                    <div className="mt-3"><LeadSiteLocationEditor key={lead.id} lead={lead} /></div>
                   <p className="text-sm mt-3">{[lead.phone, lead.lineContact && `LINE: ${lead.lineContact}`, lead.email, lead.company].filter(Boolean).join(" · ") || "ยังไม่มีข้อมูลติดต่อ"}</p>
                   <p className="text-xs text-[var(--ink-soft)] mt-2">สินค้า: {lead.productSkus.join(", ") || "ยังไม่ได้เลือก"}</p>
                   <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                     <span>สร้างเมื่อ {formatLeadDate(lead.createdAt)}</span>
                    {lead.quoteNumber && <><span className="font-mono text-[var(--brand-blue)]">{lead.quoteNumber}</span>{lead.publicQuoteToken ? <><a className="text-[var(--brand-blue)] underline" href={adminQuoteUrl(lead.publicQuoteToken)} target="_blank" rel="noreferrer">เปิดใบเสนอราคา</a><Button type="button" size="sm" variant="outline" className="h-7 rounded-none px-2" onClick={() => void copyQuoteLink(lead.quoteNumber!, lead.publicQuoteToken!)} data-testid={`button-copy-quote-link-${lead.id}`}>{copiedQuote === lead.quoteNumber ? <><Check className="w-3 h-3 mr-1" /> คัดลอกแล้ว</> : <><Clipboard className="w-3 h-3 mr-1" /> คัดลอกลิงก์</>}</Button></> : <span className="text-[var(--ink-soft)]">กำลังสร้างลิงก์ปลอดภัย...</span>}</>}
                    {lead.publicQuoteToken && <Button type="button" size="sm" variant="outline" className="h-7 rounded-none px-2" onClick={() => void copyTrackLink(lead.id, lead.publicQuoteToken!)} data-testid={`button-copy-track-link-summary-${lead.id}`}>{copiedTrackLinkId === lead.id ? <><Check className="w-3 h-3 mr-1" /> คัดลอกแล้ว</> : <><Clipboard className="w-3 h-3 mr-1" /> ลิงก์ติดตามงาน</>}</Button>}
                     {lead.publicQuoteToken && <Link href={`/handover?token=${encodeURIComponent(lead.publicQuoteToken)}`} className="inline-flex h-7 items-center gap-1 border border-[var(--line)] px-2 text-xs font-semibold text-[var(--brand-blue)] hover:bg-[var(--brand-sky)]" data-testid={`button-open-handover-${lead.id}`} title="เปิดเอกสารส่งมอบและรับประกันงานติดตั้ง"><Clipboard className="h-3 w-3" aria-hidden="true" /> ใบส่งมอบงาน</Link>}
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
                  {lead.studioData ? (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        <LeadStudioDraftAction lead={lead} />
                        <FactoryCutListModal lead={lead} />
                      </div>
                    </div>
                  ) : sketchImageUrls(lead).length > 0 ? (
                    <div className="mt-3">
                      <LeadSketchAction lead={lead} />
                    </div>
                  ) : null}
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
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  <CustomerTrackingInsightsPanel
                    lead={lead}
                    copyTrackLink={copyTrackLink}
                    copiedTrackLinkId={copiedTrackLinkId}
                  />
                  <DuplicateLeadHistory
                    leadId={lead.id}
                    duplicateLeads={duplicateLeads}
                    onNavigateToLead={navigateToRelatedLead}
                  />
                </div>
              )}
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
              <LeadSitePhotos leadId={lead.id} />
            </article>
            );
          })}
        </div>
      )}
        </>
      )}
      <Dialog
        open={leadToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingLead) setLeadToDelete(null);
        }}
      >
        <DialogContent className="max-w-md rounded-none" data-testid="dialog-confirm-delete-lead">
          <DialogTitle>ยืนยันการลบงาน</DialogTitle>
          <div className="space-y-2 text-sm">
            <p>ชื่อลูกค้า: <strong>{leadToDelete?.name || "ยังไม่ระบุชื่อ"}</strong></p>
            <p>รหัสงาน: <span className="font-mono">{leadToDelete?.leadKey || "ไม่ระบุรหัสงาน"}</span></p>
            <p className="text-[#a24439]">การลบนี้ไม่สามารถเรียกคืนได้</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={isDeletingLead}
              onClick={() => setLeadToDelete(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={isDeletingLead}
              onClick={() => void confirmLeadDeletion()}
              data-testid="button-confirm-delete-lead"
            >
              {isDeletingLead ? "กำลังลบ..." : "ยืนยันลบ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}