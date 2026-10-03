import { customerLeads, paymentSlips, sitePhotos } from "@workspace/db/schema";
import { UpsertLeadBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { recordAiUsage } from "../lib/ai-cost-tracker";
import { checkCutoutJointClash, MIN_BASIN_CLEARANCE_MM, validateBasinClearance } from "../lib/fabrication-geometry";
import { readMultipartForm, removeUploadedMedia, saveUploadedMedia, UPLOAD_DIR } from "../lib/image-upload";
import { requestOrigin } from "../lib/public-origin";
import { validateNumericDimensions, verifyAndSanitizeQuoteTotal } from "../lib/price-integrity";
import { analyzeSketchImage } from "../lib/sketch-vision";
import {
  createQuoteAccessSecret,
  isPublicQuoteTokenExpired,
  maskPhone,
  PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
  PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
  publicQuoteResponse,
  publicQuoteTokenForLead,
  quoteAccessSecretMatches,
  verifyPublicQuoteToken,
} from "../lib/quote-access";
import { createConcurrencyLimiter, createRateLimiter } from "../lib/rate-limit";
import { amountForPaymentType, generatePromptPayPayload, type PromptPayPaymentType } from "../lib/promptpay";
import { notifyPaymentSlip, notifyQuote, notifySketch } from "../lib/sales-notifications";
import { SLIPOK_UNVERIFIABLE_CODES, verifySlip } from "../lib/slipok";
import { formatQuoteMonth } from "../lib/date-time";
import { findAuthenticatedAccount, SESSION_COOKIE } from "./line-auth";

const MAX_SKETCH_FILES = 5;
// Separate limit from MAX_SKETCH_FILES above (which caps the /leads/sketch lead-submission
// upload at 5): job-72 calls for a distinct cap of 3 for the AI vision-analysis endpoint.
const MAX_SKETCH_VISION_FILES = 3;
// Mirrors sketch-vision.ts's own GEMINI_MODEL constant, for cost-tracking labeling only.
// job-82's SCOPE excludes sketch-vision.ts, so this can't import that constant directly;
// keep this literal in sync if that model ever changes.
const SKETCH_VISION_COST_MODEL = "gemini-3.8-flash";

/** Delegates to price-integrity.ts's tamper-aware check; a negative, non-finite, or out-of-range total is treated the same as "no total present" here, never trusted through as-is. */
export function quoteTotalTHB(studioData: unknown): number | null {
  return verifyAndSanitizeQuoteTotal(studioData).verifiedTotal;
}

// Knight Furnich Co., Ltd.'s own tax ID, used as the PromptPay QR target
// (job-163's spec gives this exact number -- it's not a secret, it's the
// company's public PromptPay registration). Bank account display details
// are read from env vars rather than hardcoded, since this codebase has no
// access to the real values -- GET /public/quotes/promptpay-qr returns
// `null` for whichever of these isn't configured.
const KNIGHT_FURNICH_PROMPTPAY_TAX_ID = "0135553014114";
const KNIGHT_FURNICH_ACCOUNT_NAME = "บริษัท ไนท์ เฟอร์นิช จำกัด";

export function knightFurnichCompanyAccount() {
  return {
    bankName: process.env["KNIGHT_FURNICH_BANK_NAME"] ?? null,
    bankAccountName: KNIGHT_FURNICH_ACCOUNT_NAME,
    bankAccountNumber: process.env["KNIGHT_FURNICH_BANK_ACCOUNT_NUMBER"] ?? null,
    taxId: KNIGHT_FURNICH_PROMPTPAY_TAX_ID,
  };
}

/**
 * The job-163 auto-confirm alert needs an exact literal tag
 * ("✅ [ชำระเงินมัดจำสำเร็จ - เริ่มเปิดคิวผลิตอัตโนมัติ]") that the existing
 * notifyPaymentSlip (sales-notifications.ts, out of this job's SCOPE)
 * doesn't produce -- sent as a second, best-effort Telegram message rather
 * than replacing that call. Never throws: a Telegram outage must not turn
 * an already-saved, already-verified payment into a 500.
 */
async function sendAutoConfirmTelegramAlert(
  lead: { quoteNumber: string | null; name: string | null; phone: string | null },
  verifiedAmountThb: number,
): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) return;
  const text = [
    "✅ [ชำระเงินมัดจำสำเร็จ - เริ่มเปิดคิวผลิตอัตโนมัติ]",
    `เลขที่: ${lead.quoteNumber || "-"}`,
    `ผู้ติดต่อ: ${lead.name || "-"} · โทร: ${lead.phone || "-"}`,
    `ยอดที่ได้รับ: ${verifiedAmountThb.toLocaleString("th-TH")} บาท`,
  ].join("\n");
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      console.warn("Auto-confirm Telegram alert failed", { status: response.status });
    }
  } catch (error) {
    console.warn("Auto-confirm Telegram alert failed", error instanceof Error ? error.message : "unknown");
  }
}

export type FabricationAudit = {
  safe: boolean;
  warnings: string[];
};

type StudioFabricationBasin = {
  counterWidthMm?: unknown;
  counterDepthMm?: unknown;
  widthMm?: unknown;
  depthMm?: unknown;
  xMm?: unknown;
  yMm?: unknown;
};

/**
 * Server-side Fabrication Geometry Guard (job-95/job-97): runs
 * validateBasinClearance/checkCutoutJointClash from fabrication-geometry.ts
 * against whatever basin-cutout layout `studioData` describes, and returns a
 * warning list rather than rejecting -- a risky layout must still be
 * reachable by sales (the customer/lead flow can't hard-fail on this), but
 * an admin needs to see the warning before the job goes to production.
 *
 * The shape this currently reads is deliberately simple --
 * `studioData.basin = { counterWidthMm, counterDepthMm, widthMm, depthMm,
 * xMm, yMm }` and `studioData.joints = [{ x, y }, ...]` -- rather than the
 * full StudioState/BasinPlacement[]/StudioPiece[] shape the studio
 * calculator (artifacts/knight-basins/, out of this job's SCOPE) actually
 * produces; wiring the real calculator output into this shape is a
 * follow-up for whoever owns that frontend. Missing or non-numeric fields
 * are skipped, never treated as a fabricated warning.
 */
export function auditStudioFabrication(studioData: unknown): FabricationAudit {
  const warnings: string[] = [];
  if (!studioData || typeof studioData !== "object") return { safe: true, warnings };

  const data = studioData as { basin?: StudioFabricationBasin; joints?: unknown };
  const basin = data.basin;
  const hasNumericBasinLayout =
    basin &&
    typeof basin.counterWidthMm === "number" &&
    typeof basin.counterDepthMm === "number" &&
    typeof basin.widthMm === "number" &&
    typeof basin.depthMm === "number" &&
    typeof basin.xMm === "number" &&
    typeof basin.yMm === "number";

  if (hasNumericBasinLayout) {
    const { counterWidthMm, counterDepthMm, widthMm, depthMm, xMm, yMm } = basin as Required<StudioFabricationBasin> as Record<string, number>;
    const clearance = validateBasinClearance(counterWidthMm, counterDepthMm, widthMm, depthMm, xMm, yMm);
    if (!clearance.valid) {
      warnings.push(
        `ระยะเนื้อหินรอบอ่างต่ำกว่ามาตรฐานความปลอดภัย ${MIN_BASIN_CLEARANCE_MM}mm (พบ ${clearance.minClearanceMm}mm) เสี่ยงหินแตกขณะเจาะ`,
      );
    }

    const joints = Array.isArray(data.joints)
      ? data.joints.filter(
          (joint): joint is { x: number; y: number } =>
            Boolean(joint) &&
            typeof joint === "object" &&
            typeof (joint as { x?: unknown }).x === "number" &&
            typeof (joint as { y?: unknown }).y === "number",
        )
      : [];
    if (joints.length > 0 && checkCutoutJointClash(xMm, yMm, widthMm, depthMm, joints)) {
      warnings.push("ตำแหน่งหลุมเจาะอ่างวางทับแนวรอยต่อแผ่นหิน (Joint Line) เสี่ยงจุดประกบกาวอ่อนแอ");
    }
  }

  return { safe: warnings.length === 0, warnings };
}

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
}

/** id -> isVisible. Mirrors admin-router.ts's own (unexported) site-photo
 * visibility map -- job-147's SCOPE is this file only, so that logic can't be
 * imported and is duplicated here read-only. A photo with no entry is visible
 * by default, matching admin-router.ts's semantics exactly. */
type SitePhotoVisibilityMap = Record<string, boolean>;

async function loadSitePhotoVisibilityMap(): Promise<SitePhotoVisibilityMap> {
  try {
    const raw = await readFile(join(UPLOAD_DIR, "site_photos_visibility.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: SitePhotoVisibilityMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") map[id] = value;
    }
    return map;
  } catch {
    return {};
  }
}

function isSitePhotoVisible(map: SitePhotoVisibilityMap, id: number): boolean {
  return map[String(id)] !== false;
}

type PublicTrackStageKey = "quote_accepted" | "in_production" | "ready_to_install" | "installing" | "completed";

const PUBLIC_TRACK_STAGE_LABELS_TH: Record<PublicTrackStageKey, string> = {
  quote_accepted: "รับออเดอร์/ยืนยันแบบ",
  in_production: "โรงงานกำลังตัดประกอบหิน",
  ready_to_install: "งานผลิตเสร็จ นัดหมายช่าง",
  installing: "ช่างเข้าติดตั้งหน้างาน",
  completed: "ส่งมอบงานเรียบร้อย",
};

const PUBLIC_TRACK_STAGE_ORDER: readonly PublicTrackStageKey[] = [
  "quote_accepted",
  "in_production",
  "ready_to_install",
  "installing",
  "completed",
];

export type PublicTrackStage = {
  stage: PublicTrackStageKey;
  label: string;
  date: string | null;
  done: boolean;
  active: boolean;
};

type PublicTrackPhotoRow = {
  id: number;
  stage: string;
  takenAt: Date | null;
};

/**
 * Maps the internal `lead.status` value (new_lead / selecting /
 * quote_requested / quote_sent / waiting_deposit / team_reported_paid /
 * deposit_paid / ready_for_production / closed -- see admin-router.ts's
 * LEAD_STATUS_VALUES) onto the 5-step public tracking timeline the KRAKEN
 * customer portal spec calls for. The lead table has no dedicated
 * in_production/ready_to_install/installing state of its own, so those three
 * steps are inferred from whether a site_photos row for this lead has
 * reached the "installation"/"service" or "completed" stage -- the closest
 * real signal available for "a crew is physically on site" without adding a
 * new column (out of this job's SCOPE). Any deposit-confirmed status is
 * treated as the order being accepted; "closed" (this lead table's only
 * terminal status) is treated as the job being fully completed since there
 * is no separate "lost/cancelled" status in the current domain.
 */
export function buildPublicTrackTimeline(
  lead: { status: string; updatedAt: Date | null },
  photos: PublicTrackPhotoRow[],
): PublicTrackStage[] {
  // "confirmed" is the status job-163's SlipOK Auto-Close sets on a
  // PromptPay-paid lead -- without it here, a customer who pays via the new
  // QR checkout flow sees zero progress on their own tracking page despite
  // having genuinely paid.
  const depositConfirmed = ["team_reported_paid", "deposit_paid", "confirmed", "ready_for_production", "closed"].includes(lead.status);
  const inProduction = ["ready_for_production", "closed"].includes(lead.status);
  const installPhoto = photos.find((photo) => photo.stage === "installation" || photo.stage === "service");
  const completedPhoto = photos.find((photo) => photo.stage === "completed");
  const installDate = installPhoto?.takenAt ?? null;
  const completedDate = completedPhoto?.takenAt ?? null;

  let reachedIndex = -1;
  if (depositConfirmed) reachedIndex = 0;
  if (inProduction) reachedIndex = 1;
  if (installPhoto) reachedIndex = 3;
  if (completedPhoto || lead.status === "closed") reachedIndex = 4;

  const fallbackDate = lead.updatedAt ? lead.updatedAt.toISOString() : null;

  return PUBLIC_TRACK_STAGE_ORDER.map((stage, index) => {
    const done = index <= reachedIndex;
    if (!done) {
      return { stage, label: PUBLIC_TRACK_STAGE_LABELS_TH[stage], date: null, done: false, active: index === reachedIndex + 1 };
    }
    const date = stage === "installing" ? (installDate?.toISOString() ?? fallbackDate)
      : stage === "completed" ? (completedDate?.toISOString() ?? fallbackDate)
      : fallbackDate;
    return { stage, label: PUBLIC_TRACK_STAGE_LABELS_TH[stage], date, done: true, active: false };
  });
}

export type PublicStudioSummary = {
  shape: string | null;
  dimensionsMm: { depth: number | null; runA: number | null; runB: number | null; runC: number | null } | null;
  stoneColor: string | null;
  basinSkus: string[];
};

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Allow-lists exactly the fields a customer needs to recognize their own
 * design (shape, panel dimensions, stone color, basin models) out of
 * `lead.studioData` -- never spreads the raw object, so `estimate` (which
 * carries cost/profit fields per StudioEstimate in
 * artifacts/knight-basins/src/data/studio-model.ts) can never leak here even
 * if its shape changes later. Returns null when studioData has none of these
 * recognizable fields (e.g. a quick-purchase or sketch lead with no Studio
 * design attached).
 */
export function publicStudioSummary(studioData: unknown): PublicStudioSummary | null {
  if (!studioData || typeof studioData !== "object") return null;
  const root = studioData as Record<string, unknown>;
  const state = (root.state && typeof root.state === "object" ? root.state : root) as Record<string, unknown>;

  const shape = typeof state.shape === "string" ? state.shape : null;
  const dims = state.dimensions && typeof state.dimensions === "object" ? (state.dimensions as Record<string, unknown>) : null;
  const dimensionsMm = dims
    ? { depth: numberOrNull(dims.depthMm), runA: numberOrNull(dims.runAMm), runB: numberOrNull(dims.runBMm), runC: numberOrNull(dims.runCMm) }
    : null;
  const stoneColor = typeof state.activeStone === "string" ? state.activeStone : null;
  const basinSkus = Array.isArray(state.basinSkus) ? state.basinSkus.filter((sku): sku is string => typeof sku === "string") : [];

  if (!shape && !dimensionsMm && !stoneColor && basinSkus.length === 0) return null;
  return { shape, dimensionsMm, stoneColor, basinSkus };
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export function createQuoteNumber(now = new Date()) {
  const month = formatQuoteMonth(now);
  const serial = String(now.getTime()).slice(-6);
  return `${month} / US / ${serial}`;
}

export function createLeadsRouter(database: typeof db = db): IRouter {
  const router: IRouter = Router();
  const leadRateLimit = createRateLimiter({ name: "leads", max: 30, windowMs: 60 * 1000 });
  const sketchRateLimit = createRateLimiter({ name: "sketch-upload", max: 5, windowMs: 10 * 60 * 1000 });
  const sketchVisionRateLimit = createRateLimiter({ name: "sketch-vision-analyze", max: 5, windowMs: 10 * 60 * 1000 });
  const paymentSlipRateLimit = createRateLimiter({ name: "payment-slip-upload", max: 5, windowMs: 10 * 60 * 1000 });
  const uploadConcurrency = createConcurrencyLimiter("Upload service", 4);
  const notificationRateLimit = createRateLimiter({
    name: "quote-notification",
    max: 3,
    windowMs: 15 * 60 * 1000,
    key: (req) => `${req.ip}:${String(req.body?.token ?? "")}`,
  });
  // CONTRACT specified a `keyPrefix` option; the existing RateLimitOptions
  // field for namespacing buckets is `name`, so this reuses that field with
  // the same "rl:quotes:get" value rather than adding a second option that
  // does the same thing.
  const quotesGetRateLimit = createRateLimiter({ name: "rl:quotes:get", max: 60, windowMs: 10 * 60 * 1000 });
  const trackGetRateLimit = createRateLimiter({ name: "rl:public-track:get", max: 60, windowMs: 10 * 60 * 1000 });
  const promptpayQrRateLimit = createRateLimiter({ name: "rl:public-quotes-promptpay-qr", max: 30, windowMs: 60 * 1000 });

 router.post("/leads", leadRateLimit, async (req, res, next) => {
  const parsed = UpsertLeadBody.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Invalid lead data", parsed.error.flatten());

  // Zero-Trust guard: studioData's `total` (and, if present, `widthMm`/`depthMm`)
  // come straight from the browser-side studio calculator, so a negative,
  // non-finite, or wildly out-of-range value is treated as a tampered
  // payload and rejected before it ever reaches the database -- never
  // silently clamped or saved as-is.
  const priceCheck = verifyAndSanitizeQuoteTotal(parsed.data.studioData);
  if (priceCheck.isTampered) {
    console.warn("Rejected lead payload: tampered quote total in studioData", { leadKey: parsed.data.leadKey });
    return invalid(res, "Invalid quote total");
  }
  const dimensions = parsed.data.studioData as { widthMm?: unknown; depthMm?: unknown } | undefined;
  if (
    dimensions &&
    typeof dimensions.widthMm === "number" &&
    typeof dimensions.depthMm === "number" &&
    !validateNumericDimensions(dimensions.widthMm, dimensions.depthMm)
  ) {
    console.warn("Rejected lead payload: tampered dimensions in studioData", { leadKey: parsed.data.leadKey });
    return invalid(res, "Invalid dimensions");
  }

  // Fabrication Geometry Guard (job-95/job-97): a risky basin-cutout layout
  // is a warning, not a rejection -- sales still needs to save the lead, but
  // an admin must see this before the job is confirmed for production.
  const fabricationAudit = auditStudioFabrication(parsed.data.studioData);
  const studioDataToSave = fabricationAudit.safe
    ? parsed.data.studioData
    : { ...(parsed.data.studioData as Record<string, unknown>), fabricationWarnings: fabricationAudit.warnings };
  if (!fabricationAudit.safe) {
    console.warn("Lead payload flagged by fabrication geometry guard", { leadKey: parsed.data.leadKey, warnings: fabricationAudit.warnings });
  }

  try {
    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    const [existing] = await database
      .select({
        quoteNumber: customerLeads.quoteNumber,
        quoteAccessSecret: customerLeads.quoteAccessSecret,
      })
      .from(customerLeads)
      .where(eq(customerLeads.leadKey, parsed.data.leadKey))
      .limit(1);
    const quoteNumber = parsed.data.quoteNumber ?? existing?.quoteNumber ?? (parsed.data.status === "quote_requested" ? createQuoteNumber() : null);
    const quoteAccessSecret = quoteNumber
      ? existing?.quoteAccessSecret ?? createQuoteAccessSecret()
      : existing?.quoteAccessSecret ?? null;
    const statusPriority: Record<string, number> = {
      new_lead: 0,
      selecting: 1,
      quote_requested: 2,
      quote_sent: 2,
      waiting_deposit: 2,
      closed: 3,
    };
    const requestedPriority = statusPriority[parsed.data.status];
    const [lead] = await database
      .insert(customerLeads)
      .values({
        ...parsed.data,
        expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
        quoteNumber,
        quoteAccessSecret,
        customerAccountId: account?.id ?? null,
        studioData: studioDataToSave,
      })
      .onConflictDoUpdate({
        target: customerLeads.leadKey,
        set: {
          status: sql`CASE WHEN ${customerLeads.status} = 'closed' OR ${customerLeads.status} = 'quote_requested' AND ${requestedPriority} < 2 OR ${customerLeads.status} = 'selecting' AND ${requestedPriority} < 1 THEN ${customerLeads.status} ELSE ${parsed.data.status} END`,
          source: parsed.data.source,
          name: parsed.data.name,
          company: parsed.data.company,
          phone: parsed.data.phone,
           lineContact: parsed.data.lineContact,
          email: parsed.data.email,
          project: parsed.data.project,
          address: parsed.data.address,
           site: parsed.data.site,
           purchasingDepartment: parsed.data.purchasingDepartment,
          notes: parsed.data.notes,
           taxName: parsed.data.taxName,
           taxId: parsed.data.taxId,
           taxBranch: parsed.data.taxBranch,
           taxAddress: parsed.data.taxAddress,
           preferredContact: parsed.data.preferredContact,
           customerRole: parsed.data.customerRole,
           propertyType: parsed.data.propertyType,
           condoFloor: parsed.data.condoFloor,
           expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
          productSkus: parsed.data.productSkus,
           quoteNumber: quoteNumber ?? customerLeads.quoteNumber,
            quoteAccessSecret: quoteAccessSecret ?? customerLeads.quoteAccessSecret,
           orderMode: parsed.data.orderMode,
           studioData: studioDataToSave,
           sketchUrl: parsed.data.sketchUrl,
           customerAccountId: account?.id ?? customerLeads.customerAccountId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.json({
      ...lead,
      publicQuoteToken: publicQuoteTokenForLead(lead),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/quotes", quotesGetRateLimit, async (req, res, next) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  const access = verifyPublicQuoteToken(token);
  if (!access) return res.status(404).json({ message: "Quote not found" });

  try {
    const [lead] = await database
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, access.quoteNumber))
      .limit(1);
    if (
      !lead ||
      !["studio", "quick-purchase"].includes(lead.orderMode) ||
      !lead.studioData ||
      !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)
    ) {
      return res.status(404).json({ message: "Quote not found" });
    }
    if (isPublicQuoteTokenExpired(lead.createdAt)) {
      res.status(410).json({
        error: PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
        message: PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
      });
      return;
    }
    return res.json(publicQuoteResponse(lead));
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/public/quotes/promptpay-qr
 * Builds a dynamic PromptPay QR payload (job-163) for a customer holding a
 * valid quote token -- lets Studio/the quote page move from "wait for a
 * salesperson to send bank details" to "scan and pay". Never exposes
 * anything beyond what GET /quotes already allows this same token to see.
 */
router.post("/public/quotes/promptpay-qr", promptpayQrRateLimit, async (req, res, next) => {
  const body = (req.body ?? {}) as { token?: unknown; paymentType?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const access = verifyPublicQuoteToken(token);
  if (!access) return res.status(404).json({ message: "Quote not found" });

  const paymentType: PromptPayPaymentType =
    body.paymentType === "deposit_50" || body.paymentType === "deposit_30" || body.paymentType === "full"
      ? body.paymentType
      : "full";

  try {
    const [lead] = await database
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, access.quoteNumber))
      .limit(1);
    if (
      !lead ||
      !["studio", "quick-purchase"].includes(lead.orderMode) ||
      !lead.studioData ||
      !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)
    ) {
      return res.status(404).json({ message: "Quote not found" });
    }
    if (isPublicQuoteTokenExpired(lead.createdAt)) {
      res.status(410).json({
        error: PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
        message: PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
      });
      return;
    }

    const total = quoteTotalTHB(lead.studioData);
    if (total === null || total <= 0) {
      return res.status(400).json({ message: "ไม่พบยอดเงินที่ถูกต้องสำหรับใบเสนอราคานี้" });
    }

    const amountThb = amountForPaymentType(total, paymentType);
    const qrPayload = generatePromptPayPayload({ target: KNIGHT_FURNICH_PROMPTPAY_TAX_ID, amountThb });

    return res.json({
      qrPayload,
      amountThb,
      paymentType,
      companyAccount: knightFurnichCompanyAccount(),
    });
  } catch (error) {
    return next(error);
  }
});

  /**
   * Public Customer Job Tracking API (job-147): lets a customer holding a
   * valid publicQuoteToken see their own job's status without an admin
   * login. Never exposes cost/profit, internal notes, or which technician is
   * assigned -- only the fields a customer needs (see the explicit response
   * shape below), same no-internal-data-on-public-pages principle as
   * catalog.ts's /site-photos/showcase route.
   */
  router.get("/public/track", trackGetRateLimit, async (req, res, next) => {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    const access = verifyPublicQuoteToken(token);
    if (!access) return res.status(404).json({ message: "Job not found" });

    try {
      const [lead] = await database
        .select()
        .from(customerLeads)
        .where(eq(customerLeads.quoteNumber, access.quoteNumber))
        .limit(1);
      if (!lead || !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)) {
        return res.status(404).json({ message: "Job not found" });
      }

      try {
        await database
          .update(customerLeads)
          .set({
            trackingViewCount: (lead.trackingViewCount ?? 0) + 1,
            trackingViewedAt: new Date(),
          })
          .where(eq(customerLeads.id, lead.id));
      } catch (trackingError) {
        console.warn("Failed to record tracking view", { leadId: lead.id, error: trackingError });
      }

      const photoRows = await database
        .select({
          id: sitePhotos.id,
          imageUrl: sitePhotos.imageUrl,
          caption: sitePhotos.description,
          stage: sitePhotos.stage,
          takenAt: sitePhotos.capturedAt,
        })
        .from(sitePhotos)
        .where(eq(sitePhotos.leadId, lead.id))
        .orderBy(desc(sitePhotos.capturedAt), desc(sitePhotos.id));

      const visibilityMap = await loadSitePhotoVisibilityMap();
      // Deliberately the single source of truth for both the timeline's
      // installing/completed signal and the photo list below -- a photo an
      // admin hid shouldn't move the public status forward either.
      const visiblePhotos = photoRows.filter((photo) => isSitePhotoVisible(visibilityMap, photo.id));

      return res.json({
        jobCode: lead.quoteNumber,
        customerName: lead.name,
        projectName: lead.project,
        phone: maskPhone(lead.phone),
        timeline: buildPublicTrackTimeline(lead, visiblePhotos),
        studio: publicStudioSummary(lead.studioData),
        handoverDate: lead.handoverDate ?? null,
        warrantyNo: lead.warrantyNo ?? null,
        warrantyPeriodMonths: lead.warrantyPeriodMonths ?? null,
        sitePhotos: visiblePhotos
          .filter((photo) => photo.stage === "completed")
          .map((photo) => ({ id: photo.id, imageUrl: photo.imageUrl, stage: photo.stage, caption: photo.caption, takenAt: photo.takenAt })),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/quotes/notify", notificationRateLimit, async (req, res, next) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const access = verifyPublicQuoteToken(token);
  if (!access) return res.status(404).json({ message: "Quote not found" });
  try {
    const [lead] = await database
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, access.quoteNumber))
      .limit(1);
    if (
      !lead ||
      !["studio", "quick-purchase"].includes(lead.orderMode) ||
      !lead.studioData ||
      !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)
    ) {
      return res.status(404).json({ message: "Quote not found" });
    }
    if (isPublicQuoteTokenExpired(lead.createdAt)) {
      res.status(410).json({
        error: PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
        message: PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
      });
      return;
    }
    const result = await notifyQuote(lead, requestOrigin(req), `/quote/view?token=${encodeURIComponent(token)}`);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

  router.post("/leads/sketch", sketchRateLimit, uploadConcurrency, async (req, res, next) => {
  try {
    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    const { media, fields } = await readMultipartForm(req, "image", { maxFiles: MAX_SKETCH_FILES });
    let metadata: unknown;
    try {
      metadata = JSON.parse(fields.metadata ?? "");
    } catch {
      return invalid(res, "Sketch lead metadata must be valid JSON");
    }
    const parsed = UpsertLeadBody.safeParse(metadata);
    if (!parsed.success || parsed.data.orderMode !== "sketch") {
      return invalid(res, "Invalid sketch lead data", parsed.success ? undefined : parsed.error.flatten());
    }
    const uploads: Awaited<ReturnType<typeof saveUploadedMedia>>[] = [];
    try {
      for (const item of media) {
        uploads.push(await saveUploadedMedia(item, "sketch"));
      }
    } catch (error) {
      await Promise.all(uploads.map((upload) => removeUploadedMedia(upload.filename))).catch(() => undefined);
      throw error;
    }
    const sketchUrls = uploads.map((upload) => upload.url);
    const studioData = { ...(parsed.data.studioData ?? {}), sketchUrls };
    let lead;
    try {
      [lead] = await database
        .insert(customerLeads)
        .values({
          ...parsed.data,
          expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
          sketchUrl: sketchUrls[0],
          studioData,
          orderMode: "sketch",
          customerAccountId: account?.id ?? null,
        })
        .onConflictDoUpdate({
          target: customerLeads.leadKey,
          set: {
            status: parsed.data.status,
            source: parsed.data.source,
            orderMode: "sketch",
            name: parsed.data.name,
            company: parsed.data.company,
            phone: parsed.data.phone,
            lineContact: parsed.data.lineContact,
            email: parsed.data.email,
            project: parsed.data.project,
            address: parsed.data.address,
            site: parsed.data.site,
            purchasingDepartment: parsed.data.purchasingDepartment,
            notes: parsed.data.notes,
            taxName: parsed.data.taxName,
            taxId: parsed.data.taxId,
            taxBranch: parsed.data.taxBranch,
            taxAddress: parsed.data.taxAddress,
            preferredContact: parsed.data.preferredContact,
            customerRole: parsed.data.customerRole,
            propertyType: parsed.data.propertyType,
            condoFloor: parsed.data.condoFloor,
            expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
            productSkus: parsed.data.productSkus,
            studioData,
            sketchUrl: sketchUrls[0],
            customerAccountId: account?.id ?? customerLeads.customerAccountId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!lead) throw new Error("Lead was not saved");
    } catch (error) {
      try {
        await Promise.all(uploads.map((upload) => removeUploadedMedia(upload.filename)));
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Lead save failed and sketch upload cleanup failed for ${uploads.map((upload) => upload.filename).join(", ")}`,
        );
      }
      throw error;
    }
    const result = await notifySketch(
      lead,
      requestOrigin(req),
      publicQuoteTokenForLead(lead)
        ? `/quote/view?token=${encodeURIComponent(publicQuoteTokenForLead(lead)!)}`
        : undefined,
    );
    return res.status(201).json({ lead: { ...lead, publicQuoteToken: publicQuoteTokenForLead(lead) }, ...result });
  } catch (error) {
    if (error instanceof Error && /required|invalid|choose|allowed|large|metadata/i.test(error.message)) return invalid(res, error.message);
    return next(error);
  }
});

  router.post("/leads/payment-slip", paymentSlipRateLimit, uploadConcurrency, async (req, res, next) => {
    try {
      const { media, fields } = await readMultipartForm(req, "image", { maxFiles: 1 });
      const token = (fields.token ?? "").trim();
      const access = verifyPublicQuoteToken(token);
      if (!access) return res.status(404).json({ message: "Quote not found" });
      const kind = fields.kind?.trim() === "final" ? "final" : "deposit";

      const [lead] = await database
        .select()
        .from(customerLeads)
        .where(eq(customerLeads.quoteNumber, access.quoteNumber))
        .limit(1);
      if (
        !lead ||
        !["studio", "quick-purchase"].includes(lead.orderMode) ||
        !lead.studioData ||
        !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)
      ) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const item = media[0]!;
      const upload = await saveUploadedMedia(item, "slip");
      try {
        const fullTotalThb = quoteTotalTHB(lead.studioData);
        const paymentType = (fields.paymentType ?? "").trim();
        // Default stays the full quote total so existing deposits/final
        // uploads keep their historical behaviour; only an explicit
        // paymentType narrows the expected amount to a deposit share.
        let claimedAmountThb: number | null = fullTotalThb;
        if (typeof fullTotalThb === "number") {
          if (paymentType === "deposit_30") {
            claimedAmountThb = Math.round(fullTotalThb * 0.3);
          } else if (paymentType === "deposit_50") {
            claimedAmountThb = Math.round(fullTotalThb * 0.5);
          }
        }
        const result = await verifySlip(item, claimedAmountThb);
        // A slip SlipOK can't read as a QR-verifiable image at all (no QR
        // present, corrupt image, unsupported format) isn't the same as a
        // genuine mismatch -- no automated provider can check it against
        // the bank, so it goes to manual review instead of auto-rejection.
        const needsManualReview = !result.ok && result.errorCode !== null && SLIPOK_UNVERIFIABLE_CODES.has(result.errorCode);
        const [slip] = await database
          .insert(paymentSlips)
          .values(
            result.ok
              ? {
                  leadId: lead.id,
                  kind,
                  status: "verified",
                  slipImageUrl: upload.url,
                  claimedAmountThb,
                  verifiedAmountThb: result.amount,
                  senderName: result.senderName,
                  transRef: result.transRef || null,
                  slipokRawResponse: result.raw,
                }
              : {
                  leadId: lead.id,
                  kind,
                  status: needsManualReview ? "needs_review" : "rejected",
                  slipImageUrl: upload.url,
                  claimedAmountThb,
                  slipokErrorCode: result.errorCode,
                  slipokRawResponse: result.raw,
                },
          )
          .returning();
        if (!slip) throw new Error("Payment slip was not saved");

        // Auto-Close (job-163): a SlipOK-verified slip against a lead still
        // waiting on payment closes the sale immediately, no admin click
        // needed. Scoped tightly: only fires on a genuine SlipOK pass
        // (never on "needs_review"/"rejected" -- the FORBIDDEN clause this
        // job was issued under), and only moves a lead out of "new"/"quoted"
        // -- a lead already confirmed/closed/etc. is left exactly as-is.
        if (result.ok && ["new", "quoted"].includes(lead.status)) {
          try {
            await database
              .update(customerLeads)
              .set({
                status: "confirmed",
                notes: [lead.notes, `[ระบบอัตโนมัติ]: ชำระเงินมัดจำเรียบร้อยแล้วผ่าน SlipOK (ยอด ${result.amount} บาท)`]
                  .filter((part) => part && part.trim())
                  .join("\n"),
                updatedAt: new Date(),
              })
              .where(eq(customerLeads.id, lead.id));
            await sendAutoConfirmTelegramAlert(lead, result.amount);
          } catch (confirmError) {
            console.warn("Failed to auto-confirm lead after a verified payment slip", { leadId: lead.id, error: confirmError });
          }
        }

        await notifyPaymentSlip(
          lead,
          requestOrigin(req),
          upload.url,
          {
            status: slip.status as "verified" | "needs_review" | "rejected",
            claimedAmountThb: slip.claimedAmountThb,
            verifiedAmountThb: slip.verifiedAmountThb,
            senderName: slip.senderName,
            errorCode: slip.slipokErrorCode,
            message: result.ok ? "" : result.message,
          },
          publicQuoteTokenForLead(lead)
            ? `/quote/view?token=${encodeURIComponent(publicQuoteTokenForLead(lead)!)}`
            : undefined,
        );
        // Lets the frontend show "track your order" right after a successful
        // payment, instead of the customer having to message sales to ask --
        // same token GET /public/track already accepts.
        const trackToken = publicQuoteTokenForLead(lead);
        return res.status(201).json({
          ...slip,
          trackUrl: trackToken ? `/track?token=${encodeURIComponent(trackToken)}` : null,
        });
      } catch (error) {
        await removeUploadedMedia(upload.filename).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) return invalid(res, error.message);
      return next(error);
    }
  });

  // Reads a hand-drawn sketch and pre-fills the /sketch page's form via Gemini
  // Vision. Never fails the request over an AI problem (no key, network error,
  // malformed response): analyzeSketchImage always resolves to an "unknown"
  // item in that case, so the customer/sales team just fills the form by hand
  // -- see analyzeSketchImage's docstring for the reasoning.
  router.post("/sketch/analyze", sketchVisionRateLimit, uploadConcurrency, async (req, res, next) => {
    try {
      const { media } = await readMultipartForm(req, "image", { maxFiles: MAX_SKETCH_VISION_FILES });
      const startedAt = Date.now();
      const items = await Promise.all(media.map((item, index) => analyzeSketchImage(item.buffer, item.contentType, index)));
      // analyzeSketchImage never throws (see its own docstring), so reaching this
      // line means the request completed; it doesn't distinguish a genuine AI
      // read from its own internal "unknown" fallback, and exact token counts
      // aren't exposed here either -- both would need sketch-vision.ts itself
      // (out of SCOPE for job-82) to expose. Cost for this event is computed
      // from imageCount alone, per the per-image rate job-82's pricing table
      // defines specifically for that reason.
      recordAiUsage({
        service: "sketch_vision",
        model: SKETCH_VISION_COST_MODEL,
        imageCount: media.length,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return res.status(200).json({ items });
    } catch (error) {
      if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) return invalid(res, error.message);
      return next(error);
    }
  });

  return router;
}

export default createLeadsRouter();