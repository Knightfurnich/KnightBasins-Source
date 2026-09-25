import { createHash } from "node:crypto";
import {
  basinCategories,
  basinPrices,
  installedStoneCategories,
  installedStonePrices,
  sheetStonePrices,
  customerLeads,
  leadExternalReferences,
  paymentSlips,
  adminMembers,
  adminInvites,
  adminApiKeys,
  technicianTeams,
  supportVoiceSettings,
  sitePhotos,
} from "@workspace/db/schema";
import {
  AssignAdminPaymentSlipBody,
  CreateAdminMemberBody,
  CreateAdminInviteBody,
  CreateAdminBasinBody,
  CreateAdminBasinCategoryBody,
  CreateAdminInstalledStoneCategoryBody,
  CreateAdminInstalledStoneBody,
  CreateAdminSessionBody,
  CreateAdminSheetStoneBody,
  UpdateAdminBasinBody,
  UpdateAdminBasinCategoryBody,
  UpdateAdminInstalledStoneCategoryBody,
  UpdateAdminInstalledStoneBody,
  UpdateAdminSheetStoneBody,
  UpdateAdminLeadBody,
  UpdateAdminMemberBody,
  CreateAdminApiKeyBody,
  UpdateAdminSupportVoiceBody,
  CreateAdminSitePhotoBody,
  UpdateAdminSitePhotoBody,
} from "@workspace/api-zod";
import { and, asc, desc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { Router, type Response, type IRouter } from "express";
import {
  adminCookieOptions,
  adminPasswordMatches,
  COOKIE_NAME,
  createAdminToken,
  requireAdminPermission,
  requireAnyAdminPermission,
  createAdminAuthMiddleware,
  requireAdminOwner,
  resolveAdminSession,
  ADMIN_PERMISSIONS,
  accessForAdminMember,
} from "../middlewares/admin-auth";
import { requestOrigin } from "../lib/public-origin";
import { createAdminInviteSecrets, hashAdminInviteValue } from "../lib/admin-invites";
import { ADMIN_API_KEY_SCOPE, createAdminApiKeySecret } from "../lib/admin-api-keys";
import { normalizeBasinFields, withBasinCategory, withBasinMedia, withStoneMedia } from "../lib/catalog-media";
import { findAutoMatchLead } from "../lib/slip-matching";
import {
  createQuoteAccessSecret,
  publicQuoteTokenForLead,
} from "../lib/quote-access";
import { createRateLimiter, createConcurrencyLimiter } from "../lib/rate-limit";
import {
  cleanupUnreferencedUploadedImages,
  readMultipartForm,
  readMultipartImage,
  readMultipartVideo,
  removeUploadedMedia,
  saveUploadedMedia,
  saveUploadedImage,
  saveUploadedVideo,
  UploadFileCollisionError,
} from "../lib/image-upload";
import { createQuoteNumber, quoteTotalTHB } from "./leads";
import { formatThaiDateTime } from "../lib/date-time";
import { SUPPORT_VOICE_OPTIONS, resolveVoiceConfig, synthesizeSpeech } from "../lib/google-tts";

export type AdminDatabase = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
  transaction?: <T>(callback: (transaction: AdminDatabase) => Promise<T>) => Promise<T>;
};

function idFrom(value: string | string[]) {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const LINE_JOB_REFERENCE_TYPE = "line_job_code";
const LINE_ARCHIVE_SOURCE_TYPE = "line_group_archive";
const LINE_JOB_CODE_PATTERN = /^(?:JB)?\d{2}\/\d{4}$/;

function normalizeLineJobCode(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  return LINE_JOB_CODE_PATTERN.test(normalized) ? normalized : null;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

function parsedOptionalInteger(value: string | undefined) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
}

const SITE_PHOTO_STAGES = ["survey", "installation", "service", "completed"] as const;

const LEAD_STATUS_LABELS_TH: Record<string, string> = {
  new_lead: "ลูกค้าใหม่",
  selecting: "กำลังเลือกสินค้า",
  quote_requested: "ขอใบเสนอราคา",
  waiting_deposit: "รอมัดจำ",
  team_reported_paid: "ทีมรายงานชำระแล้ว",
  deposit_paid: "มัดจำแล้ว",
  ready_for_production: "พร้อมผลิต",
  closed: "ปิดงาน",
};

const LEADS_EXPORT_COLUMNS = ["รหัสงาน", "ชื่อลูกค้า", "โครงการ", "ที่อยู่", "ทีมช่าง", "วันที่นัด", "สถานะ", "ยอดเงิน", "วันที่สร้าง"];
const BASINS_EXPORT_COLUMNS = ["SKU", "ชื่อสี", "รหัสสี", "ราคา", "ขนาด", "ขนาดหลุม", "ลิงก์ภาพหลัก", "ลิงก์ภาพ Top View"];

const CSV_SPECIAL_CHARS_PATTERN = /[",\r\n]/;

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return CSV_SPECIAL_CHARS_PATTERN.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a leading UTF-8 BOM so Excel opens Thai text correctly. */
function toCsv(columns: string[], rows: unknown[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(csvEscape).join(","));
  return `﻿${lines.join("\r\n")}`;
}

/**
 * The full real status domain a lead can hold. Wider than UpdateAdminLeadBody's
 * generated zod enum (new_lead/selecting/quote_requested/closed only, stale
 * relative to the actual varchar(32) column) -- this mirrors what
 * LeadsManager.tsx's statusOptions dropdown offers, plus quote_sent, which the
 * customer-facing quote-send flow can set even though the admin dropdown
 * doesn't offer it directly.
 */
const LEAD_STATUS_VALUES = [
  "new_lead",
  "selecting",
  "quote_requested",
  "quote_sent",
  "waiting_deposit",
  "team_reported_paid",
  "deposit_paid",
  "ready_for_production",
  "closed",
];

type BulkSlipAssignErrorCode = "lead-not-found" | "missing" | "conflict" | "reference-conflict";

const BULK_SLIP_ASSIGN_ERROR_MESSAGES: Record<BulkSlipAssignErrorCode, string> = {
  "lead-not-found": "Lead not found",
  "missing": "Payment slip not found",
  "conflict": "Payment slip is already assigned or voided",
  "reference-conflict": "That job code is already assigned to another lead",
};

class BulkSlipAssignError extends Error {
  code: BulkSlipAssignErrorCode;
  slipId: number;
  leadId: number;

  constructor(code: BulkSlipAssignErrorCode, slipId: number, leadId: number) {
    super(BULK_SLIP_ASSIGN_ERROR_MESSAGES[code]);
    this.code = code;
    this.slipId = slipId;
    this.leadId = leadId;
  }
}

function parseBulkSlipAssignments(body: unknown): Array<{ slipId: number; leadId: number }> | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { assignments?: unknown }).assignments)) return null;
  const assignments = (body as { assignments: unknown[] }).assignments;
  if (assignments.length === 0) return null;

  const parsed: Array<{ slipId: number; leadId: number }> = [];
  for (const item of assignments) {
    if (!item || typeof item !== "object") return null;
    const slipId = Number((item as { slipId?: unknown }).slipId);
    const leadId = Number((item as { leadId?: unknown }).leadId);
    if (!Number.isInteger(slipId) || slipId <= 0 || !Number.isInteger(leadId) || leadId <= 0) return null;
    parsed.push({ slipId, leadId });
  }
  return parsed;
}

function serializeAdminMember(member: any) {
  const role = member.role === "owner" || member.role === "viewer" ? member.role : "staff";
  const access = accessForAdminMember({ role, permissions: member.permissions ?? [] });
  return {
    id: member.id,
    lineUserId: member.lineUserId,
    displayName: member.displayName,
    pictureUrl: member.pictureUrl ?? null,
    role,
    permissions: access.permissions,
    active: Boolean(member.active),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function serializeAdminApiKey(key: any) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: Array.isArray(key.scopes) ? key.scopes : [],
    expiresAt: key.expiresAt ?? null,
    revokedAt: key.revokedAt ?? null,
    lastUsedAt: key.lastUsedAt ?? null,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  };
}

function memberValues(input: {
  displayName: string;
  pictureUrl?: string | null;
  role: "owner" | "staff" | "viewer";
  permissions: string[];
  active: boolean;
}) {
  const role = input.role;
  return {
    displayName: input.displayName.trim(),
    pictureUrl: input.pictureUrl ?? null,
    role,
    permissions: role === "owner"
      ? [...ADMIN_PERMISSIONS]
      : [...new Set(input.permissions.filter((permission) => ADMIN_PERMISSIONS.includes(permission as typeof ADMIN_PERMISSIONS[number])))],
    active: input.active,
  };
}

async function catalogImageUrls(database: AdminDatabase) {
  const [basins, installedStones, sheetStones, leads] = await Promise.all([
    database.select({
      imageUrl: basinPrices.imageUrl,
      galleryImageUrls: basinPrices.galleryImageUrls,
      quoteImageUrl: basinPrices.quoteImageUrl,
      videoUrl: basinPrices.videoUrl,
    }).from(basinPrices),
    database.select({ imageUrl: installedStonePrices.imageUrl }).from(installedStonePrices),
    database.select({ imageUrl: sheetStonePrices.imageUrl }).from(sheetStonePrices),
    database.select({ sketchUrl: customerLeads.sketchUrl }).from(customerLeads),
  ]);

  return [
    ...basins.flatMap((row: { imageUrl?: unknown; galleryImageUrls?: unknown; quoteImageUrl?: unknown; videoUrl?: unknown }) => [
      row.imageUrl,
      ...(Array.isArray(row.galleryImageUrls) ? row.galleryImageUrls : []),
      row.quoteImageUrl,
      row.videoUrl,
    ]),
    ...installedStones.map((row: { imageUrl?: unknown }) => row.imageUrl),
    ...sheetStones.map((row: { imageUrl?: unknown }) => row.imageUrl),
    ...leads.map((row: { sketchUrl?: unknown }) => row.sketchUrl),
  ];
}

async function basinCategoryRows(database: AdminDatabase) {
  return database
    .select()
    .from(basinCategories)
    .orderBy(asc(basinCategories.sortOrder), asc(basinCategories.id));
}

function isDuplicateCategory(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

export type DashboardLeadRow = {
  id: number;
  leadKey: string;
  status: string;
  quoteNumber: string | null;
  name: string | null;
  project: string | null;
  address: string | null;
  expectedInstallationDate: string | null;
  notes: string | null;
  productSkus: string[];
  createdAt: string;
  studioData: unknown;
  technicianTeamCode: string | null;
};

/** Shared column list for every query that hydrates DashboardLeadRow, so the set of columns can't drift between call sites. */
const DASHBOARD_LEAD_COLUMNS = {
  id: customerLeads.id,
  leadKey: customerLeads.leadKey,
  status: customerLeads.status,
  quoteNumber: customerLeads.quoteNumber,
  name: customerLeads.name,
  project: customerLeads.project,
  address: customerLeads.address,
  expectedInstallationDate: customerLeads.expectedInstallationDate,
  notes: customerLeads.notes,
  productSkus: customerLeads.productSkus,
  createdAt: customerLeads.createdAt,
  studioData: customerLeads.studioData,
  technicianTeamCode: customerLeads.technicianTeamCode,
} as const;

export type DashboardSlipRow = {
  id: number;
  leadId: number | null;
  status: string;
  verifiedAmountThb: number | null;
  claimedAmountThb: number | null;
  senderName: string | null;
  createdAt: string;
};

export type DashboardPeriod = "all" | "7d" | "30d" | "3m" | "year";

const DASHBOARD_PERIODS: DashboardPeriod[] = ["all", "7d", "30d", "3m", "year"];

export type AdminDashboardStats = {
  period: DashboardPeriod;
  kpis: {
    totalRevenueThb: number;
    totalLeads: number;
    readyForProduction: number;
    closed: number;
  };
  actionItems: {
    unassignedSlipsCount: number;
    awaitingContactCount: number;
  };
  pipelineRatio: {
    usCount: number;
    ofCount: number;
    otherCount: number;
  };
  upcomingInstallations: Array<{
    id: number;
    leadKey: string;
    name: string;
    quoteNumber: string | null;
    project: string | null;
    address: string | null;
    expectedInstallationDate: string;
    notes: string | null;
  }>;
  popularItems: Array<{ sku: string; count: number }>;
  popularStones: Array<{ sku: string; count: number }>;
  popularBasins: Array<{ sku: string; count: number }>;
  recentActivities: Array<{
    id: string;
    type: "lead_created" | "payment_received";
    title: string;
    detail: string;
    timestamp: string;
  }>;
  monthlyComparison: Array<{ monthLabel: string; revenueThb: number; leadCount: number }>;
  projectedCashInflowThb: number;
  technicianCapacity: Array<{
    teamCode: string;
    teamName: string;
    activeJobsCount: number;
    status: "busy" | "moderate" | "available";
    jobs: Array<{ id: number; leadKey: string; name: string; project: string | null; date: string; confidence: TechnicianTeamMatchConfidence }>;
  }>;
  asOf: string;
};

const DASHBOARD_AWAITING_CONTACT_STATUSES = new Set(["new_lead", "selecting", "quote_requested"]);
const DASHBOARD_INSTALLATION_WINDOW_DAYS = 7;

/**
 * Revenue actually received per slip.status -- verified slips are confirmed by
 * SlipOK (verifiedAmountThb), team_reported_paid slips come from a LINE report
 * with no SlipOK check (claimedAmountThb). Every other status, including
 * voided, contributes nothing.
 */
export function computeTotalRevenueThb(slips: DashboardSlipRow[]): number {
  return slips.reduce((total, slip) => {
    if (slip.status === "verified") return total + (slip.verifiedAmountThb ?? 0);
    if (slip.status === "team_reported_paid") return total + (slip.claimedAmountThb ?? 0);
    return total;
  }, 0);
}

/** "YYYY-MM-DD" for the given instant in Asia/Bangkok (fixed UTC+7, no DST). */
function bangkokDateOnly(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup["year"]}-${lookup["month"]}-${lookup["day"]}`;
}

export function computeUpcomingInstallations(
  leads: DashboardLeadRow[],
  now: Date,
  windowDays = DASHBOARD_INSTALLATION_WINDOW_DAYS,
): AdminDashboardStats["upcomingInstallations"] {
  const start = bangkokDateOnly(now);
  const end = bangkokDateOnly(new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000));

  return leads
    .filter((lead): lead is DashboardLeadRow & { expectedInstallationDate: string } =>
      Boolean(lead.expectedInstallationDate) &&
      lead.expectedInstallationDate! >= start &&
      lead.expectedInstallationDate! <= end)
    .sort((a, b) =>
      a.expectedInstallationDate === b.expectedInstallationDate
        ? a.id - b.id
        : a.expectedInstallationDate < b.expectedInstallationDate ? -1 : 1)
    .map((lead) => ({
      id: lead.id,
      leadKey: lead.leadKey,
      name: lead.name ?? "",
      quoteNumber: lead.quoteNumber ?? null,
      project: lead.project ?? null,
      address: lead.address ?? null,
      expectedInstallationDate: lead.expectedInstallationDate,
      notes: lead.notes ?? null,
    }));
}

/** quoteNumber carries the order type as a substring, e.g. "Sep 26 / US / 296579". */
function pipelineOrderType(quoteNumber: string | null): "us" | "of" | "other" {
  const value = (quoteNumber ?? "").toUpperCase();
  if (value.includes("US")) return "us";
  if (value.includes("OF")) return "of";
  return "other";
}

/** Top 5 SKUs by how many leads ordered them, skipping blank entries; ties break alphabetically. */
function computePopularSkus(leads: DashboardLeadRow[], includeSku: (sku: string) => boolean): AdminDashboardStats["popularItems"] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    for (const sku of lead.productSkus) {
      const trimmed = sku?.trim();
      if (!trimmed || !includeSku(trimmed)) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([skuA, countA], [skuB, countB]) => countB - countA || skuA.localeCompare(skuB))
    .slice(0, 5)
    .map(([sku, count]) => ({ sku, count }));
}

export function computePopularItems(leads: DashboardLeadRow[]): AdminDashboardStats["popularItems"] {
  return computePopularSkus(leads, () => true);
}

/** Basin SKUs (KFxxx) are their own catalog family, so "popular items" splits into stones vs basins. */
function isBasinSku(sku: string): boolean {
  return sku.toUpperCase().startsWith("KF");
}

export function computePopularStones(leads: DashboardLeadRow[]): AdminDashboardStats["popularStones"] {
  return computePopularSkus(leads, (sku) => !isBasinSku(sku));
}

export function computePopularBasins(leads: DashboardLeadRow[]): AdminDashboardStats["popularBasins"] {
  return computePopularSkus(leads, isBasinSku);
}

/** Defensive timestamp parse: an unparseable value sorts as oldest rather than throwing or producing NaN comparisons. */
function activityTimestampMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

type DashboardActivity = AdminDashboardStats["recentActivities"][number];

/**
 * Newest 5 activities overall, drawn from the newest 5 leads and the newest 5
 * non-voided slips independently (per the spec) before merging and re-sorting
 * -- so this can never surface a 6th lead even if it would outrank a slip.
 */
export function computeRecentActivities(leads: DashboardLeadRow[], slips: DashboardSlipRow[]): AdminDashboardStats["recentActivities"] {
  const recentLeads: DashboardActivity[] = [...leads]
    .sort((a, b) => activityTimestampMs(b.createdAt) - activityTimestampMs(a.createdAt))
    .slice(0, 5)
    .map((lead) => ({
      id: `lead-${lead.id}`,
      type: "lead_created",
      title: `Lead ใหม่: ${lead.name ?? "-"}`,
      detail: lead.quoteNumber || lead.project || lead.leadKey,
      timestamp: new Date(lead.createdAt).toISOString(),
    }));

  const recentSlips: DashboardActivity[] = [...slips]
    .filter((slip) => slip.status !== "voided")
    .sort((a, b) => activityTimestampMs(b.createdAt) - activityTimestampMs(a.createdAt))
    .slice(0, 5)
    .map((slip) => {
      const amount = (slip.status === "verified" ? slip.verifiedAmountThb : slip.claimedAmountThb) ?? 0;
      return {
        id: `slip-${slip.id}`,
        type: "payment_received",
        title: `ได้รับเงินโอน ฿${amount.toLocaleString()}`,
        detail: slip.senderName || "รายงานผ่าน LINE",
        timestamp: new Date(slip.createdAt).toISOString(),
      };
    });

  return [...recentLeads, ...recentSlips]
    .sort((a, b) => activityTimestampMs(b.timestamp) - activityTimestampMs(a.timestamp))
    .slice(0, 5);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** {year, month} of the given instant in Asia/Bangkok (fixed UTC+7, no DST). */
function bangkokYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(lookup["year"]), month: Number(lookup["month"]) };
}

type DashboardDateRange = { start: string; end: string };

/**
 * Date range (inclusive, "YYYY-MM-DD" in Asia/Bangkok) for each period value.
 * "all" has no range (null = no filtering). "3m" is spec'd explicitly: the
 * 1st of the month two months back through the last day of the current
 * month. "year" mirrors that "whole current period, not just to-date"
 * shape for consistency: Jan 1 through Dec 31 of the current year.
 */
function periodDateRange(period: DashboardPeriod, now: Date): DashboardDateRange | null {
  const today = bangkokDateOnly(now);
  if (period === "all") return null;
  if (period === "7d") return { start: bangkokDateOnly(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)), end: today };
  if (period === "30d") return { start: bangkokDateOnly(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)), end: today };
  const { year, month } = bangkokYearMonth(now);
  if (period === "3m") {
    const start = addMonths(year, month, -2);
    return { start: isoDate(start.year, start.month, 1), end: isoDate(year, month, daysInMonth(year, month)) };
  }
  return { start: isoDate(year, 1, 1), end: isoDate(year, 12, 31) };
}

function withinPeriod(createdAt: string, range: DashboardDateRange | null): boolean {
  if (!range) return true;
  const day = bangkokDateOnly(new Date(createdAt));
  return day >= range.start && day <= range.end;
}

const THAI_MONTH_ABBREVIATIONS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** e.g. year=2026 month=7 -> "ก.ค. 69" (Buddhist year, last 2 digits). */
function monthLabel(year: number, month: number): string {
  const buddhistYear = year + 543;
  return `${THAI_MONTH_ABBREVIATIONS[month - 1]} ${String(buddhistYear).slice(-2)}`;
}

function trailingMonths(now: Date, count: number): Array<{ year: number; month: number }> {
  const { year, month } = bangkokYearMonth(now);
  const months: Array<{ year: number; month: number }> = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(addMonths(year, month, -offset));
  }
  return months;
}

/** Revenue and lead count for the trailing 3 calendar months (oldest to newest), independent of the `period` filter. */
export function computeMonthlyComparison(
  leads: DashboardLeadRow[],
  slips: DashboardSlipRow[],
  now: Date,
): AdminDashboardStats["monthlyComparison"] {
  return trailingMonths(now, 3).map(({ year, month }) => {
    const revenueThb = slips.reduce((total, slip) => {
      const slipMonth = bangkokYearMonth(new Date(slip.createdAt));
      if (slipMonth.year !== year || slipMonth.month !== month) return total;
      if (slip.status === "verified") return total + (slip.verifiedAmountThb ?? 0);
      if (slip.status === "team_reported_paid") return total + (slip.claimedAmountThb ?? 0);
      return total;
    }, 0);
    const leadCount = leads.filter((lead) => {
      const leadMonth = bangkokYearMonth(new Date(lead.createdAt));
      return leadMonth.year === year && leadMonth.month === month;
    }).length;
    return { monthLabel: monthLabel(year, month), revenueThb, leadCount };
  });
}

/**
 * Cash not yet collected for leads installing within the next `windowDays`:
 * quote total (from studioData, via quoteTotalTHB) minus whatever has
 * already been verified/team-reported-paid for that lead. Leads with no
 * resolvable quote total are skipped rather than treated as zero, since
 * "no quote total" and "fully paid" are different things.
 */
export function computeProjectedCashInflowThb(
  leads: DashboardLeadRow[],
  slips: DashboardSlipRow[],
  now: Date,
  windowDays = 14,
): number {
  const start = bangkokDateOnly(now);
  const end = bangkokDateOnly(new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000));
  const paidByLead = new Map<number, number>();
  for (const slip of slips) {
    if (slip.leadId === null) continue;
    const amount = slip.status === "verified" ? slip.verifiedAmountThb : slip.status === "team_reported_paid" ? slip.claimedAmountThb : null;
    if (amount === null) continue;
    paidByLead.set(slip.leadId, (paidByLead.get(slip.leadId) ?? 0) + amount);
  }
  let total = 0;
  for (const lead of leads) {
    if (!lead.expectedInstallationDate) continue;
    if (lead.expectedInstallationDate < start || lead.expectedInstallationDate > end) continue;
    const quoteTotal = quoteTotalTHB(lead.studioData);
    if (quoteTotal === null) continue;
    total += Math.max(0, quoteTotal - (paidByLead.get(lead.id) ?? 0));
  }
  return total;
}

type TechnicianTeam = { code: string; name: string; shortName: string; aliases: string[] };

/** How a free-text team mention was resolved: `manual` is the explicit `technicianTeamCode` column; the rest come from `matchTeamToken`'s three layers. Lower confidence (`prefix`/`fuzzy`) should be surfaced to an admin to confirm, not trusted blindly. */
export type TechnicianTeamMatchConfidence = "exact" | "prefix" | "fuzzy" | "manual";

export type TechnicianTeamMatch = { code: string; confidence: TechnicianTeamMatchConfidence };

/**
 * Seed roster: the 10 install teams in the canonical order used by the work
 * orders. This is the *fallback* -- the live roster lives in the
 * `technician_teams` table and is loaded via `loadTechnicianTeams()`, which
 * falls back to this constant if the table is empty. It's also the default
 * for `matchedTechnicianTeamCode`/`computeTechnicianCapacity`/
 * `computeTechnicianCalendar` so existing callers (and unit tests) that
 * don't pass a `teams` argument keep working unchanged. `shortName` and
 * `aliases` only widen what counts as a match inside free-text notes/project
 * fields (e.g. "TP", "ทีมเปา", "ช่างชัยยา", "แอนนี่", "ทีมออฟฟิศ"); `aliases`
 * are stored *without* a "ทีม"/"ช่าง" prefix -- matchedTechnicianTeamCode
 * composes both prefixes itself (see textMentionsAlias below).
 *
 * The team roster is owned by the owner/admin and can grow or shrink, so
 * this seed must stay aligned with knight-design-kb/TEAM.md (section 4) --
 * that file is the source of truth for who each code is.
 */
export const SEED_TECHNICIAN_TEAMS: TechnicianTeam[] = [
  { code: "TP", name: "ช่างยี่", shortName: "ยี่", aliases: ["แอนนี่"] },
  { code: "PP", name: "ช่างเนตร", shortName: "เนตร", aliases: [] },
  { code: "ST", name: "ช่างทู", shortName: "ทู", aliases: [] },
  { code: "CM", name: "ช่างเจมส์", shortName: "เจมส์", aliases: [] },
  { code: "KF", name: "ทีมโรงงาน", shortName: "โรงงาน", aliases: ["ออฟฟิศ", "ออฟฟิต"] },
  { code: "PA", name: "ช่างเปา", shortName: "เปา", aliases: [] },
  { code: "PM", name: "ช่างพร้อม", shortName: "พร้อม", aliases: [] },
  { code: "TJ", name: "ช่างกอล์ฟ", shortName: "กอล์ฟ", aliases: [] },
  { code: "AM", name: "ช่างเจ๋ง", shortName: "เจ๋ง", aliases: [] },
  { code: "CL", name: "ช่างชัยยา", shortName: "ชัยยา", aliases: [] },
];

/** True if `text` contains `alias` on its own, or prefixed with "ทีม"/"ช่าง" -- aliases are stored without a prefix so this catches "ทีมออฟฟิศ", "ช่างออฟฟิศ", and bare "ออฟฟิศ" from one stored alias "ออฟฟิศ". */
function textMentionsAlias(text: string, alias: string): boolean {
  return text.includes(alias) || text.includes(`ทีม${alias}`) || text.includes(`ช่าง${alias}`);
}

// --- Fuzzy/prefix team-name matcher -------------------------------------
// Ported from the validated prototype at bin/knight_team_match_prototype.py
// (26/26 synthetic cases; 548-message replay in
// knight-design-kb/qa/design-team-name-matching.md found 0 missed real
// jobs). Don't hand-tune this against a new failure without re-running that
// replay -- the 3 gotchas called out below were each found that way.

const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
/** Consonants folded together because casual Thai spelling treats them as interchangeable (they sound, or used to sound, alike). */
const CONFUSABLE_CONSONANTS: Record<string, string> = {
  "ศ": "ส", "ษ": "ส",
  "ฏ": "ต",
  "ฑ": "ท", "ฒ": "ท", "ธ": "ท",
  "ณ": "น",
  "ญ": "ย",
  "ภ": "พ",
  "ฬ": "ล",
};
/** Tone marks and the การันต์/above-line vowel marks stripped by `looseTeamText`. */
const TEAM_TEXT_MARKS = new Set([..."ั็่้๊๋์ํิีึืุู"]);

/** NFC -> strip zero-width chars -> Thai digits to Arabic -> fold confusable consonants -> strip whitespace. Deterministic normalization, not a guess. */
export function normalizeTeamText(text: string): string {
  let result = text.normalize("NFC").replace(ZERO_WIDTH_PATTERN, "");
  result = [...result].map((char) => {
    const digitIndex = THAI_DIGITS.indexOf(char);
    return digitIndex >= 0 ? String(digitIndex) : char;
  }).join("");
  result = [...result].map((char) => CONFUSABLE_CONSONANTS[char] ?? char).join("");
  return result.replace(/\s+/g, "");
}

/** `normalizeTeamText()` with tone marks/การันต์ also stripped, so "เจมส" (dropped การันต์) equals "เจมส์". */
export function looseTeamText(text: string): string {
  return [...normalizeTeamText(text)].filter((char) => !TEAM_TEXT_MARKS.has(char)).join("");
}

/** Plain Levenshtein edit distance between two strings. */
export function teamTextEditDistance(a: string, b: string): number {
  let previousRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(previousRow[j]! + 1, currentRow[j - 1]! + 1, previousRow[j - 1]! + cost));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length]!;
}

/**
 * Match a single already-extracted token (e.g. the word right after
 * "ทีม"/"ช่าง") against the roster. Three layers, first hit wins:
 *
 *  1. exact  -- token equals a candidate's shortName/name/alias, compared
 *     both normalized and loose (so "เจมส" == "เจมส์").
 *  2. prefix -- token is a prefix of a candidate's loose form, and the
 *     *normalized* token is >= 3 chars. The guard must measure the
 *     normalized length, not loose: "ชัย" loses its tone mark in
 *     looseTeamText ("ชย", 2 chars) and would wrongly fail a loose-length
 *     guard even though it's a valid prefix of "ชัยยา".
 *  3. fuzzy  -- candidate name is >= 4 chars and edit distance <= 1. Short
 *     names (2-3 chars, e.g. "ยี่"/"ทู"/"เปา") never fuzzy-match -- they
 *     must hit exact, or nothing.
 *
 * Returns null if nothing clears any layer.
 */
export function matchTeamToken(token: string, teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS): TechnicianTeamMatch | null {
  const tokenNormalized = normalizeTeamText(token);
  const tokenLoose = looseTeamText(token);
  if (!tokenNormalized) return null;

  for (const team of teams) {
    for (const candidate of [team.shortName, team.name, ...team.aliases]) {
      if (tokenNormalized === normalizeTeamText(candidate) || tokenLoose === looseTeamText(candidate)) {
        return { code: team.code, confidence: "exact" };
      }
    }
  }
  for (const team of teams) {
    for (const candidate of [team.shortName, team.name, ...team.aliases]) {
      if (tokenNormalized.length >= 3 && looseTeamText(candidate).startsWith(tokenLoose)) {
        return { code: team.code, confidence: "prefix" };
      }
    }
  }
  for (const team of teams) {
    for (const candidate of [team.shortName, team.name, ...team.aliases]) {
      const candidateNormalized = normalizeTeamText(candidate);
      if (candidateNormalized.length >= 4 && teamTextEditDistance(tokenNormalized, candidateNormalized) <= 1) {
        return { code: team.code, confidence: "fuzzy" };
      }
    }
  }
  return null;
}

/** Trailing polite particles stripped from a token before matching. */
const TEAM_TOKEN_TRAILING_PARTICLES = /(ครับผม|ครับ|ค่ะ|คะ|นะครับ|นะ|จ้า|ด้วย)$/;

/** Strip trailing punctuation, *then* trailing particles, then punctuation again -- order matters: a real LINE message reads "ทีมเจมส์ครับ." and only becomes "เจมส์" if the "." is stripped before "ครับ" is matched at the end. */
function cleanTeamToken(token: string): string {
  const stripTrailingPunctuation = (value: string) => value.replace(/[.,;:!?"'”’)\]]+$/, "");
  return stripTrailingPunctuation(stripTrailingPunctuation(token.trim()).replace(TEAM_TOKEN_TRAILING_PARTICLES, "")).trim();
}

/** Every token immediately following "ทีม"/"ช่าง" in `text`, cleaned, in appearance order. */
function teamPrefixedTokens(text: string): string[] {
  const pattern = /(?:ทีม|ช่าง)\s*([^\s/,·()\[\]ๆ]{1,12})/g;
  return [...text.matchAll(pattern)].map((match) => cleanTeamToken(match[1] ?? ""));
}

/** Fallback for text with no "ทีม"/"ช่าง" token to key off -- a bare code ("TP"), or a team name/alias mentioned without a prefix. Whole-word code match, literal name/alias substring; no fuzzy layer here since there's no token boundary to guard a false positive. */
function matchedTeamByLiteralMention(text: string, teams: TechnicianTeam[]): TechnicianTeamMatch | null {
  const upper = text.toUpperCase();
  for (const team of teams) {
    const codePattern = new RegExp(`\\b${team.code}\\b`);
    if (codePattern.test(upper)) return { code: team.code, confidence: "exact" };
    if (text.includes(team.name) || text.includes(`ทีม${team.shortName}`)) return { code: team.code, confidence: "exact" };
    if (team.aliases.some((alias) => textMentionsAlias(text, alias))) return { code: team.code, confidence: "exact" };
  }
  return null;
}

/**
 * First team (in order of appearance) whose "ทีม"/"ช่าง"-prefixed token
 * matches the roster via `matchTeamToken` (exact/prefix/fuzzy, tolerating
 * misspellings and dropped trailing consonants like "ทีมเจม" for
 * "ทีมเจมส์"), falling back to a literal whole-text scan for mentions with
 * no prefix (a bare code like "TP", or a name/alias with no "ทีม"/"ช่าง" in
 * front). A job is credited to at most one team; null if nothing matches.
 */
export function matchedTechnicianTeamCode(text: string, teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS): TechnicianTeamMatch | null {
  if (!text.trim()) return null;
  for (const token of teamPrefixedTokens(text)) {
    const match = matchTeamToken(token, teams);
    if (match) return match;
  }
  return matchedTeamByLiteralMention(text, teams);
}

/** Radar of all `teams`' installation load over the next `windowDays`, parsed from lead.notes/lead.project. */
export function computeTechnicianCapacity(
  leads: DashboardLeadRow[],
  now: Date,
  windowDays = DASHBOARD_INSTALLATION_WINDOW_DAYS,
  teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS,
): AdminDashboardStats["technicianCapacity"] {
  const start = bangkokDateOnly(now);
  const end = bangkokDateOnly(new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000));
  const jobsByTeam = new Map<string, AdminDashboardStats["technicianCapacity"][number]["jobs"]>(
    teams.map((team) => [team.code, []]),
  );

  for (const lead of leads) {
    if (!lead.expectedInstallationDate) continue;
    if (lead.expectedInstallationDate < start || lead.expectedInstallationDate > end) continue;
    const match = matchedTechnicianTeamCode(`${lead.notes ?? ""} ${lead.project ?? ""}`, teams);
    if (!match) continue;
    jobsByTeam.get(match.code)?.push({
      id: lead.id,
      leadKey: lead.leadKey,
      name: lead.name ?? "",
      project: lead.project ?? null,
      date: lead.expectedInstallationDate,
      confidence: match.confidence,
    });
  }

  return teams.map((team) => {
    const jobs = jobsByTeam.get(team.code) ?? [];
    const activeJobsCount = jobs.length;
    const status: "busy" | "moderate" | "available" = activeJobsCount >= 3 ? "busy" : activeJobsCount >= 1 ? "moderate" : "available";
    return { teamCode: team.code, teamName: team.name, activeJobsCount, status, jobs };
  });
}

const TECHNICIAN_TEAM_CODES: string[] = SEED_TECHNICIAN_TEAMS.map((team) => team.code);

/** A lead's team + how confident the match is: the explicit column always wins (confidence "manual"); older leads (pre-migration 011) fall back to the notes/project regex/fuzzy guess, or null if nothing matches. */
function resolvedTechnicianTeamCode(
  lead: Pick<DashboardLeadRow, "technicianTeamCode" | "notes" | "project">,
  teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS,
): TechnicianTeamMatch | null {
  if (lead.technicianTeamCode) return { code: lead.technicianTeamCode, confidence: "manual" };
  return matchedTechnicianTeamCode(`${lead.notes ?? ""} ${lead.project ?? ""}`, teams);
}

export type TechnicianCalendarStatus = "available" | "moderate" | "busy";

export type TechnicianCalendarJob = {
  id: number;
  leadKey: string;
  name: string;
  project: string | null;
  address: string | null;
  quoteNumber: string | null;
  confidence: TechnicianTeamMatchConfidence;
};

export type TechnicianCalendarTeamDay = {
  teamCode: string;
  teamName: string;
  status: TechnicianCalendarStatus;
  jobCount: number;
  jobs: TechnicianCalendarJob[];
};

export type TechnicianCalendarDay = {
  date: string;
  dayStatus: TechnicianCalendarStatus;
  totalJobs: number;
  teams: TechnicianCalendarTeamDay[];
};

export type TechnicianCalendarResponse = {
  month: string;
  days: TechnicianCalendarDay[];
  technicianTeams: Array<{ teamCode: string; teamName: string }>;
};

/** Team-level status: available (0 jobs), moderate (1-2), busy (>=3) -- same thresholds as computeTechnicianCapacity's weekly radar. */
function technicianCalendarTeamStatus(jobCount: number): TechnicianCalendarStatus {
  return jobCount >= 3 ? "busy" : jobCount >= 1 ? "moderate" : "available";
}

/** Day-level status combines total load and per-team saturation: available (0), busy (>=4 total, or any single team busy), otherwise moderate. */
function technicianCalendarDayStatus(totalJobs: number, teams: TechnicianCalendarTeamDay[]): TechnicianCalendarStatus {
  if (totalJobs === 0) return "available";
  if (totalJobs >= 4 || teams.some((team) => team.status === "busy")) return "busy";
  return "moderate";
}

/**
 * Full-month dispatch calendar: every day of `month` ("YYYY-MM", already
 * validated by the caller), each carrying all 10 teams' jobs for that day.
 * `leads` is expected to already be filtered to the month's date range --
 * this function only groups/derives status, it doesn't filter by date itself.
 */
export function computeTechnicianCalendar(
  leads: DashboardLeadRow[],
  month: string,
  teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS,
): TechnicianCalendarResponse {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const leadsByDate = new Map<string, DashboardLeadRow[]>();
  for (const lead of leads) {
    if (!lead.expectedInstallationDate) continue;
    const list = leadsByDate.get(lead.expectedInstallationDate) ?? [];
    list.push(lead);
    leadsByDate.set(lead.expectedInstallationDate, list);
  }

  const days: TechnicianCalendarDay[] = [];
  const totalDays = daysInMonth(year, monthNum);
  for (let day = 1; day <= totalDays; day += 1) {
    const date = isoDate(year, monthNum, day);
    const leadsThatDay = leadsByDate.get(date) ?? [];

    const jobsByTeam = new Map<string, TechnicianCalendarJob[]>(teams.map((team) => [team.code, []]));
    for (const lead of leadsThatDay) {
      const match = resolvedTechnicianTeamCode(lead, teams);
      if (!match) continue;
      jobsByTeam.get(match.code)?.push({
        id: lead.id,
        leadKey: lead.leadKey,
        name: lead.name ?? "",
        project: lead.project ?? null,
        address: lead.address ?? null,
        quoteNumber: lead.quoteNumber ?? null,
        confidence: match.confidence,
      });
    }

    const dayTeams: TechnicianCalendarTeamDay[] = teams.map((team) => {
      const teamJobs = jobsByTeam.get(team.code) ?? [];
      return {
        teamCode: team.code,
        teamName: team.name,
        status: technicianCalendarTeamStatus(teamJobs.length),
        jobCount: teamJobs.length,
        jobs: teamJobs,
      };
    });

    days.push({
      date,
      dayStatus: technicianCalendarDayStatus(leadsThatDay.length, dayTeams),
      totalJobs: leadsThatDay.length,
      teams: dayTeams,
    });
  }

  return {
    month,
    days,
    technicianTeams: teams.map((team) => ({ teamCode: team.code, teamName: team.name })),
  };
}

/**
 * `period` filters the "activity snapshot" fields (kpis, actionItems,
 * pipelineRatio, popular*, recentActivities) by lead/slip createdAt.
 * upcomingInstallations, technicianCapacity, monthlyComparison, and
 * projectedCashInflowThb are forward-looking or their own fixed windows
 * (next 7 days, trailing 3 months, next 14 days) and always use the full,
 * unfiltered leads/slips -- filtering a future installation queue by a past
 * creation-date window would just hide real upcoming work.
 */
export function computeAdminDashboardStats(
  leads: DashboardLeadRow[],
  slips: DashboardSlipRow[],
  now = new Date(),
  period: DashboardPeriod = "all",
  teams: TechnicianTeam[] = SEED_TECHNICIAN_TEAMS,
): AdminDashboardStats {
  const range = periodDateRange(period, now);
  const filteredLeads = leads.filter((lead) => withinPeriod(lead.createdAt, range));
  const filteredSlips = slips.filter((slip) => withinPeriod(slip.createdAt, range));

  const pipelineRatio = { usCount: 0, ofCount: 0, otherCount: 0 };
  let readyForProduction = 0;
  let closed = 0;
  let awaitingContactCount = 0;
  for (const lead of filteredLeads) {
    if (lead.status === "ready_for_production") readyForProduction += 1;
    else if (lead.status === "closed") closed += 1;
    if (DASHBOARD_AWAITING_CONTACT_STATUSES.has(lead.status)) awaitingContactCount += 1;
    const orderType = pipelineOrderType(lead.quoteNumber);
    if (orderType === "us") pipelineRatio.usCount += 1;
    else if (orderType === "of") pipelineRatio.ofCount += 1;
    else pipelineRatio.otherCount += 1;
  }

  const unassignedSlipsCount = filteredSlips.filter((slip) => slip.leadId === null && slip.status !== "voided").length;

  return {
    period,
    kpis: {
      totalRevenueThb: computeTotalRevenueThb(filteredSlips),
      totalLeads: filteredLeads.length,
      readyForProduction,
      closed,
    },
    actionItems: { unassignedSlipsCount, awaitingContactCount },
    pipelineRatio,
    upcomingInstallations: computeUpcomingInstallations(leads, now),
    popularItems: computePopularItems(filteredLeads),
    popularStones: computePopularStones(filteredLeads),
    popularBasins: computePopularBasins(filteredLeads),
    recentActivities: computeRecentActivities(filteredLeads, filteredSlips),
    monthlyComparison: computeMonthlyComparison(leads, slips, now),
    projectedCashInflowThb: computeProjectedCashInflowThb(leads, slips, now),
    technicianCapacity: computeTechnicianCapacity(leads, now, undefined, teams),
    asOf: now.toISOString(),
  };
}

/** Short LINE text summary: cumulative revenue, total job count, and today's install queue by team. */
export function buildDashboardBriefingText(stats: AdminDashboardStats, now: Date): string {
  const today = bangkokDateOnly(now);
  const todaysJobs = stats.technicianCapacity.flatMap((team) =>
    team.jobs
      .filter((job) => job.date === today)
      .map((job) => `- ${team.teamName} (${team.teamCode}): ${job.name || "-"}${job.project ? ` · ${job.project}` : ""}`));
  return [
    "📊 Knight Basins Dashboard Briefing",
    `⏰ ${formatThaiDateTime(now)} น.`,
    `ยอดรับเงินสะสม: ${stats.kpis.totalRevenueThb.toLocaleString()} บาท`,
    `จำนวนงานทั้งหมด: ${stats.kpis.totalLeads} งาน`,
    "คิวช่างวันนี้:",
    ...(todaysJobs.length ? todaysJobs : ["- ไม่มีคิวติดตั้งวันนี้"]),
  ].join("\n");
}

type LineSendResult = { ok: true } | { ok: false; message: string };

/** Same LINE Messaging API push pattern as lib/sales-notifications.ts's sendLineText. */
async function sendDashboardBriefingToLine(text: string): Promise<LineSendResult> {
  const accessToken = process.env["LINE_MESSAGING_ACCESS_TOKEN"] ?? process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  const destination = process.env["LINE_SALES_DESTINATION_ID"];
  if (!accessToken || !destination) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า LINE channel หรือปลายทางสำหรับ dashboard briefing" };
  }
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: destination, messages: [{ type: "text", text }] }),
    });
    if (!response.ok) return { ok: false, message: `LINE push returned ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "ส่ง LINE briefing ไม่สำเร็จ" };
  }
}

export function createAdminRouter(database: AdminDatabase): IRouter {
  const router: IRouter = Router();
  const adminLoginRateLimit = createRateLimiter({ name: "admin-login", max: 5, windowMs: 60 * 1000 });
  // Each basin can now hold up to 5 photos (primary + 4 gallery), so a bulk photo
  // session across several basins easily exceeds the old single-image-era cap of 20.
  // This route already sits behind requireAdmin (line below), so a higher ceiling
  // only bounds an already-authenticated admin session, not an anonymous attacker.
  const uploadRateLimit = createRateLimiter({ name: "admin-upload", max: 150, windowMs: 10 * 60 * 1000 });
  const uploadConcurrency = createConcurrencyLimiter("Upload service", 4);

  async function loadTechnicianTeamRows(includeInactive = false) {
    return database
      .select()
      .from(technicianTeams)
      .where(includeInactive ? undefined : eq(technicianTeams.active, true))
      .orderBy(asc(technicianTeams.sortOrder), asc(technicianTeams.code));
  }

  /** Live roster from `technician_teams`, falling back to the seed constant if the table is empty (e.g. before migration 012 has run). */
  async function loadTechnicianTeams(includeInactive = false): Promise<TechnicianTeam[]> {
    const rows = await loadTechnicianTeamRows(includeInactive);
    if (rows.length === 0) return SEED_TECHNICIAN_TEAMS;
    return rows.map((row: any) => ({
      code: row.code,
      name: row.name,
      shortName: row.shortName,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
    }));
  }

  function serializeTechnicianTeam(row: any) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      shortName: row.shortName,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      sortOrder: row.sortOrder,
      active: row.active,
    };
  }

  router.get("/admin/session", async (req, res, next) => {
    try {
      res.json(await resolveAdminSession(req.cookies?.[COOKIE_NAME]));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/session", adminLoginRateLimit, async (req, res) => {
    const parsed = CreateAdminSessionBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid login", parsed.error.flatten());
    if (!process.env["ADMIN_PASSWORD"]) {
      return res.status(503).json({ message: "Admin access is not configured" });
    }
    if (!adminPasswordMatches(parsed.data.password)) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    const token = createAdminToken();
    res.cookie(COOKIE_NAME, token, adminCookieOptions());
    return res.json(await resolveAdminSession(token));
  });

  router.delete("/admin/session", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(204).end();
  });

  router.use("/admin", createAdminAuthMiddleware(database));

  router.get("/admin/api-keys", requireAdminOwner, async (_req, res, next) => {
    try {
      const keys = await database
        .select()
        .from(adminApiKeys)
        .orderBy(desc(adminApiKeys.createdAt));
      return res.json(keys.map(serializeAdminApiKey));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/admin/api-keys", requireAdminOwner, async (req, res, next) => {
    const parsed = CreateAdminApiKeyBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.name.trim()) {
      return invalid(res, "ข้อมูล API key ไม่ถูกต้อง", parsed.success ? undefined : parsed.error.flatten());
    }
    if (parsed.data.expiresInDays !== undefined && !Number.isSafeInteger(parsed.data.expiresInDays)) {
      return invalid(res, "expiresInDays must be a whole number");
    }
    try {
      const secret = createAdminApiKeySecret();
      const expiresAt = parsed.data.expiresInDays === undefined
        ? null
        : new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);
      const [created] = await database
        .insert(adminApiKeys)
        .values({
          name: parsed.data.name.trim(),
          keyPrefix: secret.keyPrefix,
          tokenHash: secret.tokenHash,
          scopes: [ADMIN_API_KEY_SCOPE],
          expiresAt,
        })
        .returning();
      if (!created) {
        res.status(500).json({ message: "สร้าง API key ไม่สำเร็จ" });
        return;
      }
      return res.status(201).json({
        ...serializeAdminApiKey(created),
        token: secret.token,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/admin/api-keys/:id", requireAdminOwner, async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) {
      invalid(res, "รหัส API key ไม่ถูกต้อง");
      return;
    }
    try {
      const [revoked] = await database
        .update(adminApiKeys)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(adminApiKeys.id, id), isNull(adminApiKeys.revokedAt)))
        .returning({ id: adminApiKeys.id });
      if (!revoked) {
        res.status(404).json({ message: "ไม่พบ API key ที่ยังใช้งานได้" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/team", requireAdminOwner, async (_req, res, next) => {
    try {
      const members = await database
        .select()
        .from(adminMembers)
        .orderBy(asc(adminMembers.active), asc(adminMembers.displayName), asc(adminMembers.id));
      return res.json(members.map(serializeAdminMember));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/admin/team/invites", requireAdminOwner, async (_req, res, next) => {
    try {
      const invites = await database
        .select({
          id: adminInvites.id,
          role: adminInvites.role,
          permissions: adminInvites.permissions,
          expiresAt: adminInvites.expiresAt,
          usedAt: adminInvites.usedAt,
          createdAt: adminInvites.createdAt,
        })
        .from(adminInvites)
        .orderBy(desc(adminInvites.createdAt));
      return res.json(invites.map((invite: any) => ({
        ...invite,
        role: invite.role === "owner" || invite.role === "viewer" ? invite.role : "staff",
        permissions: accessForAdminMember({
          role: invite.role === "owner" || invite.role === "viewer" ? invite.role : "staff",
          permissions: invite.permissions ?? [],
        }).permissions,
      })));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/admin/team/invites", requireAdminOwner, async (req, res, next) => {
    const parsed = CreateAdminInviteBody.safeParse(req.body);
    if (!parsed.success) {
      return invalid(res, "ข้อมูลคำเชิญไม่ถูกต้อง", parsed.error.flatten());
    }
    try {
      const { token, code } = createAdminInviteSecrets();
      const role = parsed.data.role;
      const permissions = accessForAdminMember({
        role,
        permissions: parsed.data.permissions,
      }).permissions;
      const expiresAt = new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000);
      const [created] = await database
        .insert(adminInvites)
        .values({
          tokenHash: hashAdminInviteValue(token),
          codeHash: hashAdminInviteValue(code),
          role,
          permissions,
          expiresAt,
        })
        .returning({
          id: adminInvites.id,
          role: adminInvites.role,
          permissions: adminInvites.permissions,
          expiresAt: adminInvites.expiresAt,
          createdAt: adminInvites.createdAt,
        });
      if (!created) {
        res.status(500).json({ message: "สร้างคำเชิญไม่สำเร็จ" });
        return;
      }
      return res.status(201).json({
        ...created,
        role: role === "owner" || role === "viewer" ? role : "staff",
        permissions,
        code,
        inviteUrl: `${requestOrigin(req)}/admin?invite=${encodeURIComponent(token)}`,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/admin/team/invites/:id", requireAdminOwner, async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) {
      invalid(res, "รหัสคำเชิญไม่ถูกต้อง");
      return;
    }
    try {
      const [revoked] = await database
        .update(adminInvites)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(adminInvites.id, id), isNull(adminInvites.usedAt)))
        .returning({ id: adminInvites.id });
      if (!revoked) {
        res.status(404).json({ message: "ไม่พบคำเชิญที่ยังใช้งานได้" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/team/invites/:id/permanent", requireAdminOwner, async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) {
      invalid(res, "รหัสคำเชิญไม่ถูกต้อง");
      return;
    }
    try {
      const [deleted] = await database
        .delete(adminInvites)
        .where(eq(adminInvites.id, id))
        .returning({ id: adminInvites.id });
      if (!deleted) {
        res.status(404).json({ message: "ไม่พบคำเชิญที่ต้องการลบ" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/team", requireAdminOwner, async (req, res, next) => {
    const parsed = CreateAdminMemberBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.displayName.trim() || !parsed.data.lineUserId.trim()) {
      return invalid(res, "ข้อมูลสมาชิกทีมไม่ถูกต้อง", parsed.success ? undefined : parsed.error.flatten());
    }
    try {
      const [created] = await database
        .insert(adminMembers)
        .values({
          lineUserId: parsed.data.lineUserId.trim(),
          ...memberValues(parsed.data),
        })
        .returning();
      return res.status(201).json(serializeAdminMember(created));
    } catch (error) {
      if (isDuplicateCategory(error)) return res.status(409).json({ message: "บัญชี LINE นี้มีอยู่ในทีมแล้ว" });
      return next(error);
    }
  });

  router.patch("/admin/team/:id", requireAdminOwner, async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminMemberBody.safeParse(req.body);
    if (!id || !parsed.success || !parsed.data.displayName.trim()) {
      return invalid(res, "ข้อมูลสมาชิกทีมไม่ถูกต้อง", parsed.success ? undefined : parsed.error.flatten());
    }
    try {
      const [updated] = await database
        .update(adminMembers)
        .set({ ...memberValues(parsed.data), updatedAt: new Date() })
        .where(eq(adminMembers.id, id))
        .returning();
      return updated ? res.json(serializeAdminMember(updated)) : res.status(404).json({ message: "ไม่พบสมาชิกทีม" });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/admin/team/:id", requireAdminOwner, async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) {
      invalid(res, "รหัสสมาชิกไม่ถูกต้อง");
      return;
    }
    try {
      const [deleted] = await database
        .delete(adminMembers)
        .where(eq(adminMembers.id, id))
        .returning({ id: adminMembers.id });
      if (!deleted) {
        res.status(404).json({ message: "ไม่พบสมาชิกที่ต้องการลบ" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/leads", requireAdminPermission("leads"), async (req, res, next) => {
    try {
      const rawTeamCode = req.query["technicianTeamCode"];
      const teamCodeFilter = typeof rawTeamCode === "string" ? rawTeamCode : undefined;
      if (teamCodeFilter !== undefined && teamCodeFilter !== "unassigned" && !TECHNICIAN_TEAM_CODES.includes(teamCodeFilter)) {
        return invalid(res, `technicianTeamCode must be one of: ${TECHNICIAN_TEAM_CODES.join(", ")}, or "unassigned"`);
      }
      const teamCodeCondition = teamCodeFilter === undefined
        ? undefined
        : teamCodeFilter === "unassigned"
          ? isNull(customerLeads.technicianTeamCode)
          : eq(customerLeads.technicianTeamCode, teamCodeFilter);

      const leads = await database
        .select()
        .from(customerLeads)
        .where(teamCodeCondition)
        .orderBy(desc(customerLeads.updatedAt), desc(customerLeads.id));
      const hydrated = await Promise.all(leads.map(async (lead: any) => {
        if (!lead.quoteNumber || lead.quoteAccessSecret) return lead;
        const quoteAccessSecret = createQuoteAccessSecret();
        const [updated] = await database
          .update(customerLeads)
          .set({ quoteAccessSecret, updatedAt: new Date() })
          .where(eq(customerLeads.id, lead.id))
          .returning();
        return updated ?? { ...lead, quoteAccessSecret };
      }));
      return res.json(hydrated.map((lead: any) => ({
        ...lead,
        publicQuoteToken: publicQuoteTokenForLead(lead),
      })));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/admin/dashboard-stats", requireAdminPermission("leads"), async (req, res, next) => {
    try {
      const rawPeriod = req.query["period"];
      const period: DashboardPeriod = typeof rawPeriod === "string" && (DASHBOARD_PERIODS as string[]).includes(rawPeriod)
        ? rawPeriod as DashboardPeriod
        : "all";

      const leadRows: DashboardLeadRow[] = await database
        .select(DASHBOARD_LEAD_COLUMNS)
        .from(customerLeads)
        .orderBy(asc(customerLeads.id));

      const slipRows: DashboardSlipRow[] = await database
        .select({
          id: paymentSlips.id,
          leadId: paymentSlips.leadId,
          status: paymentSlips.status,
          verifiedAmountThb: paymentSlips.verifiedAmountThb,
          claimedAmountThb: paymentSlips.claimedAmountThb,
          senderName: paymentSlips.senderName,
          createdAt: paymentSlips.createdAt,
        })
        .from(paymentSlips)
        .orderBy(asc(paymentSlips.id));

      const teams = await loadTechnicianTeams();
      res.json(computeAdminDashboardStats(leadRows, slipRows, new Date(), period, teams));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/dashboard-briefing/line", requireAdminPermission("leads"), async (_req, res, next) => {
    try {
      const leadRows: DashboardLeadRow[] = await database
        .select(DASHBOARD_LEAD_COLUMNS)
        .from(customerLeads)
        .orderBy(asc(customerLeads.id));

      const slipRows: DashboardSlipRow[] = await database
        .select({
          id: paymentSlips.id,
          leadId: paymentSlips.leadId,
          status: paymentSlips.status,
          verifiedAmountThb: paymentSlips.verifiedAmountThb,
          claimedAmountThb: paymentSlips.claimedAmountThb,
          senderName: paymentSlips.senderName,
          createdAt: paymentSlips.createdAt,
        })
        .from(paymentSlips)
        .orderBy(asc(paymentSlips.id));

      const now = new Date();
      const stats = computeAdminDashboardStats(leadRows, slipRows, now);
      const text = buildDashboardBriefingText(stats, now);
      const result = await sendDashboardBriefingToLine(text);
      if (!result.ok) {
        res.status(502).json({ message: result.message });
        return;
      }
      res.json({ success: true, deliveredAt: now.toISOString() });
    } catch (error) {
      next(error);
    }
  });

  const TECHNICIAN_CALENDAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

  router.get("/admin/technician-calendar", requireAdminPermission("leads"), async (req, res, next) => {
    try {
      const rawMonth = req.query["month"];
      const month = typeof rawMonth === "string" ? rawMonth : "";
      const [, monthPart] = month.split("-");
      const monthNum = Number(monthPart);
      if (!TECHNICIAN_CALENDAR_MONTH_PATTERN.test(month) || monthNum < 1 || monthNum > 12) {
        return invalid(res, "month must match YYYY-MM");
      }

      const [yearStr] = month.split("-");
      const year = Number(yearStr);
      const start = isoDate(year, monthNum, 1);
      const end = isoDate(year, monthNum, daysInMonth(year, monthNum));

      const leadRows: DashboardLeadRow[] = await database
        .select(DASHBOARD_LEAD_COLUMNS)
        .from(customerLeads)
        .where(and(gte(customerLeads.expectedInstallationDate, start), lte(customerLeads.expectedInstallationDate, end)))
        .orderBy(asc(customerLeads.id));

      const teams = await loadTechnicianTeams();
      return res.json(computeTechnicianCalendar(leadRows, month, teams));
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/admin/leads/:id", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const bodyStatus = typeof req.body?.status === "string" && req.body.status.length <= 32 ? req.body.status : undefined;
    const bodyForZod = { ...req.body, status: "new_lead" };
    const parsed = UpdateAdminLeadBody.safeParse(bodyForZod);
    if (!id || !parsed.success) return invalid(res, "Invalid lead data", parsed.success ? undefined : parsed.error.flatten());
    const finalStatus = bodyStatus ?? parsed.data.status;
    try {
      let studioData: Record<string, unknown> | undefined;
      let newQuoteNumber: string | undefined;
      let newQuoteAccessSecret: string | undefined;
      if (parsed.data.staffDimensions !== undefined || parsed.data.studioData !== undefined) {
        const [existing] = await database
          .select({
            studioData: customerLeads.studioData,
            quoteNumber: customerLeads.quoteNumber,
            quoteAccessSecret: customerLeads.quoteAccessSecret,
          })
          .from(customerLeads)
          .where(eq(customerLeads.id, id))
          .limit(1);
        studioData = {
          ...(existing?.studioData as Record<string, unknown> ?? {}),
          ...(parsed.data.studioData as Record<string, unknown> ?? {}),
        };
        if (parsed.data.staffDimensions !== undefined) {
          studioData = { ...studioData, staffDimensions: parsed.data.staffDimensions };
        }
        // A lead without a quote number yet (e.g. a hand-sketch lead) gets one
        // the first time staff attach studioData to it, so the public quote
        // link becomes usable without a separate "create quote" step.
        if (!existing?.quoteNumber && parsed.data.studioData !== undefined) {
          newQuoteNumber = createQuoteNumber();
          newQuoteAccessSecret = createQuoteAccessSecret();
        }
      }
      const [updated] = await database
        .update(customerLeads)
        .set({
          status: finalStatus,
          notes: parsed.data.notes,
          ...(studioData !== undefined ? { studioData } : {}),
          ...(newQuoteNumber ? { quoteNumber: newQuoteNumber, quoteAccessSecret: newQuoteAccessSecret } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customerLeads.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Lead not found" });
      return res.json({ ...updated, publicQuoteToken: publicQuoteTokenForLead(updated) });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * Lightweight, status-only sibling of PATCH /admin/leads/:id, for one-click
   * quick actions (e.g. LeadsManager's row buttons) that shouldn't have to
   * send notes/staffDimensions just to flip a status.
   */
  router.patch("/admin/leads/:id/status", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid lead id");
    const status = typeof req.body?.status === "string" ? req.body.status : undefined;
    if (!status || !LEAD_STATUS_VALUES.includes(status)) {
      return invalid(res, `status must be one of: ${LEAD_STATUS_VALUES.join(", ")}`);
    }
    try {
      const [updated] = await database
        .update(customerLeads)
        .set({ status, updatedAt: new Date() })
        .where(eq(customerLeads.id, id))
        .returning();
      return updated ? res.json(updated) : res.status(404).json({ message: "Lead not found" });
    } catch (error) {
      return next(error);
    }
  });

  const EXPECTED_INSTALLATION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * One-click reassignment for the technician dispatch calendar: team,
   * installation date (Asia/Bangkok, "YYYY-MM-DD"), or both in one call.
   * Either field may be omitted to leave it untouched, or sent as `null` to
   * clear it (unassign the team / remove the installation date) -- at least
   * one of the two must be present.
   */
  router.patch("/admin/leads/:id/technician", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid lead id");

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const hasTeamCode = Object.prototype.hasOwnProperty.call(body, "technicianTeamCode");
    const hasInstallDate = Object.prototype.hasOwnProperty.call(body, "expectedInstallationDate");
    if (!hasTeamCode && !hasInstallDate) {
      return invalid(res, "Provide at least one of technicianTeamCode or expectedInstallationDate");
    }

    const teamCode = body.technicianTeamCode;
    if (hasTeamCode && teamCode !== null) {
      if (typeof teamCode !== "string") {
        return invalid(res, "technicianTeamCode must be a string or null");
      }
      // Inactive teams still validate here (old jobs must stay editable) -- only the dropdown source (loadTechnicianTeams with no arg) excludes them.
      const knownTeams = await loadTechnicianTeams(true);
      if (!knownTeams.some((team) => team.code === teamCode)) {
        return invalid(res, `technicianTeamCode must be one of: ${knownTeams.map((team) => team.code).join(", ")}, or null`);
      }
    }

    const installDate = body.expectedInstallationDate;
    if (hasInstallDate && installDate !== null && !(typeof installDate === "string" && EXPECTED_INSTALLATION_DATE_PATTERN.test(installDate))) {
      return invalid(res, "expectedInstallationDate must match YYYY-MM-DD, or null");
    }

    const changes: { technicianTeamCode?: string | null; expectedInstallationDate?: string | null; updatedAt: Date } = { updatedAt: new Date() };
    if (hasTeamCode) changes.technicianTeamCode = teamCode;
    if (hasInstallDate) changes.expectedInstallationDate = installDate;

    try {
      const [updated] = await database
        .update(customerLeads)
        .set(changes)
        .where(eq(customerLeads.id, id))
        .returning();
      return updated ? res.json(updated) : res.status(404).json({ message: "Lead not found" });
    } catch (error) {
      return next(error);
    }
  });

  const TECHNICIAN_TEAM_CODE_PATTERN = /^[A-Z]{2,8}$/;

  /** Admin-managed roster shown in the technician dispatch calendar/dashboard. No DELETE by design -- retiring a team must not orphan its historical jobs, so "removing" a team is PATCH { active: false }. */
  router.get("/admin/technician-teams", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    try {
      const includeInactive = req.query["includeInactive"] === "1" || req.query["includeInactive"] === "true";
      const rows = await loadTechnicianTeamRows(includeInactive);
      res.json(rows.map(serializeTechnicianTeam));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/technician-teams", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const code = typeof body.code === "string" ? body.code : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const shortName = typeof body.shortName === "string" ? body.shortName.trim() : "";
    const aliases = Array.isArray(body.aliases) && body.aliases.every((alias: unknown) => typeof alias === "string") ? body.aliases : [];
    const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) ? body.sortOrder : 0;

    if (!TECHNICIAN_TEAM_CODE_PATTERN.test(code)) return invalid(res, "code must match ^[A-Z]{2,8}$");
    if (!name) return invalid(res, "name is required");
    if (!shortName) return invalid(res, "shortName is required");

    try {
      const [existing] = await database.select().from(technicianTeams).where(eq(technicianTeams.code, code));
      if (existing) return invalid(res, "code already exists");
      const [created] = await database
        .insert(technicianTeams)
        .values({ code, name, shortName, aliases, sortOrder })
        .returning();
      return res.status(201).json(serializeTechnicianTeam(created));
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/admin/technician-teams/:id", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid technician team id");

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasShortName = Object.prototype.hasOwnProperty.call(body, "shortName");
    const hasAliases = Object.prototype.hasOwnProperty.call(body, "aliases");
    const hasSortOrder = Object.prototype.hasOwnProperty.call(body, "sortOrder");
    const hasActive = Object.prototype.hasOwnProperty.call(body, "active");
    if (!hasName && !hasShortName && !hasAliases && !hasSortOrder && !hasActive) {
      return invalid(res, "Provide at least one of name, shortName, aliases, sortOrder, active");
    }

    const changes: Record<string, unknown> = { updatedAt: new Date() };
    if (hasName) {
      if (typeof body.name !== "string" || !body.name.trim()) return invalid(res, "name must be a non-empty string");
      changes["name"] = body.name.trim();
    }
    if (hasShortName) {
      if (typeof body.shortName !== "string" || !body.shortName.trim()) return invalid(res, "shortName must be a non-empty string");
      changes["shortName"] = body.shortName.trim();
    }
    if (hasAliases) {
      if (!Array.isArray(body.aliases) || !body.aliases.every((alias: unknown) => typeof alias === "string")) {
        return invalid(res, "aliases must be an array of strings");
      }
      changes["aliases"] = body.aliases;
    }
    if (hasSortOrder) {
      if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) return invalid(res, "sortOrder must be an integer");
      changes["sortOrder"] = body.sortOrder;
    }
    if (hasActive) {
      if (typeof body.active !== "boolean") return invalid(res, "active must be a boolean");
      changes["active"] = body.active;
    }

    try {
      const [updated] = await database.update(technicianTeams).set(changes).where(eq(technicianTeams.id, id)).returning();
      return updated ? res.json(serializeTechnicianTeam(updated)) : res.status(404).json({ message: "Technician team not found" });
    } catch (error) {
      return next(error);
    }
  });

  function serializeSupportVoiceSetting(row: { voiceName: string; languageCode: string; speakingRate: number; updatedAt: Date } | null) {
    const resolved = resolveVoiceConfig(row);
    return {
      voiceName: resolved.voiceName,
      languageCode: resolved.languageCode,
      speakingRate: resolved.speakingRate,
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
    };
  }

  router.get("/admin/support-voice", requireAdminPermission("leads", "edit"), async (_req, res, next) => {
    try {
      const [row] = await database.select().from(supportVoiceSettings).orderBy(desc(supportVoiceSettings.id)).limit(1);
      res.json({
        current: serializeSupportVoiceSetting(row ?? null),
        options: SUPPORT_VOICE_OPTIONS,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/support-voice", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const parsed = UpdateAdminSupportVoiceBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "voiceName is required", parsed.error.flatten());
    const option = SUPPORT_VOICE_OPTIONS.find((candidate) => candidate.voiceName === parsed.data.voiceName);
    if (!option) return invalid(res, "voiceName must be one of the curated options");

    try {
      const [existing] = await database.select().from(supportVoiceSettings).orderBy(desc(supportVoiceSettings.id)).limit(1);
      if (existing) {
        const [updated] = await database
          .update(supportVoiceSettings)
          .set({ voiceName: option.voiceName, updatedAt: new Date() })
          .where(eq(supportVoiceSettings.id, existing.id))
          .returning();
        return res.json(serializeSupportVoiceSetting(updated));
      }
      const [created] = await database
        .insert(supportVoiceSettings)
        .values({ voiceName: option.voiceName })
        .returning();
      return res.json(serializeSupportVoiceSetting(created));
    } catch (error) {
      return next(error);
    }
  });

  // Same greeting customers actually hear from น้องไนท์ (KnightSupport.tsx),
  // reused here so "ฟังตัวอย่าง" previews a real, representative line rather
  // than a synthetic test sentence.
  const SUPPORT_VOICE_PREVIEW_TEXT = "สวัสดีค่ะ ดิฉันช่วยค้นหา SKU ราคา ขนาด วิดีโอ 3D 360° และอธิบายวิธีใช้งานหน้า Knight Basins ได้ค่ะ";

  router.post("/admin/support-voice/preview", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const voiceName = typeof req.body?.voiceName === "string" ? req.body.voiceName : "";
    const option = SUPPORT_VOICE_OPTIONS.find((candidate) => candidate.voiceName === voiceName);
    if (!option) return invalid(res, "voiceName must be one of the curated options");

    try {
      const result = await synthesizeSpeech(SUPPORT_VOICE_PREVIEW_TEXT, option.voiceName);
      if (!result.ok) return res.status(422).json({ message: result.message });
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "no-store");
      return res.send(result.audio);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/admin/site-photos", requireAdminPermission("leads"), async (req, res, next) => {
    try {
      const rawJobCode = req.query["jobCode"];
      const jobCode = typeof rawJobCode === "string" && rawJobCode.trim() !== "" ? rawJobCode.trim() : undefined;

      const rawLeadId = req.query["leadId"];
      let leadIdFilter: number | undefined;
      if (rawLeadId !== undefined) {
        const parsed = idFrom(rawLeadId as string | string[]);
        if (parsed === null) return invalid(res, "leadId must be a positive integer");
        leadIdFilter = parsed;
      }

      const rawStage = req.query["stage"];
      const stage = typeof rawStage === "string" ? rawStage : undefined;
      if (stage !== undefined && !(SITE_PHOTO_STAGES as readonly string[]).includes(stage)) {
        return invalid(res, `stage must be one of: ${SITE_PHOTO_STAGES.join(", ")}`);
      }

      const rawLimit = req.query["limit"];
      let limit = 50;
      if (typeof rawLimit === "string" && rawLimit.trim() !== "") {
        const parsedLimit = Number(rawLimit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) return invalid(res, "limit must be a positive integer");
        limit = Math.min(parsedLimit, 200);
      }

      const conditions = [
        jobCode !== undefined ? eq(sitePhotos.jobCode, jobCode) : undefined,
        leadIdFilter !== undefined ? eq(sitePhotos.leadId, leadIdFilter) : undefined,
        stage !== undefined ? eq(sitePhotos.stage, stage) : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

      const rows = await database
        .select()
        .from(sitePhotos)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sitePhotos.capturedAt), desc(sitePhotos.id))
        .limit(limit);

      return res.json(rows);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/admin/site-photos", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const parsed = CreateAdminSitePhotoBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid site photo data", parsed.error.flatten());

    try {
      const [created] = await database
        .insert(sitePhotos)
        .values({
          leadId: parsed.data.leadId ?? null,
          jobCode: parsed.data.jobCode ?? null,
          imageUrl: parsed.data.imageUrl,
          description: parsed.data.description ?? null,
          stage: parsed.data.stage ?? "installation",
          senderName: parsed.data.senderName ?? null,
          capturedAt: parsed.data.capturedAt ?? null,
        })
        .returning();
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/admin/site-photos/:id", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid site photo id");

    const parsed = UpdateAdminSitePhotoBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid site photo data", parsed.error.flatten());
    if (Object.keys(parsed.data).length === 0) return invalid(res, "At least one field must be present");

    try {
      const changes: Record<string, unknown> = { ...parsed.data };

      const [updated] = await database
        .update(sitePhotos)
        .set(changes)
        .where(eq(sitePhotos.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Site photo not found" });
      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/admin/leads/:id/payment-slips", requireAdminPermission("leads"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid lead id");
    try {
      const slips = await database
        .select()
        .from(paymentSlips)
        .where(eq(paymentSlips.leadId, id))
        .orderBy(desc(paymentSlips.createdAt));
      return res.json(slips);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/admin/slips/intake", requireAdminPermission("leads", "edit"), uploadRateLimit, uploadConcurrency, async (req, res, next) => {
    let upload: Awaited<ReturnType<typeof saveUploadedMedia>> | undefined;
    try {
      const { media, fields } = await readMultipartForm(req, "image", { maxFiles: 1 });
      const archiveAttachmentId = fields.archiveAttachmentId?.trim();
      const sourceHash = fields.sourceHash?.trim().toLowerCase();
      const archiveMessageId = fields.archiveMessageId?.trim() || null;
      const referenceValue = fields.referenceValue?.trim() || null;
      const normalizedReference = referenceValue ? normalizeLineJobCode(referenceValue) : null;
      const senderName = fields.senderName?.trim() || null;
      const kind = fields.kind?.trim() || "deposit";
      const claimedAmountThb = parsedOptionalInteger(fields.claimedAmountThb);

      if (!archiveAttachmentId || archiveAttachmentId.length > 128) {
        invalid(res, "archiveAttachmentId is required");
        return;
      }
      if (!sourceHash || !/^[a-f0-9]{64}$/.test(sourceHash)) {
        invalid(res, "sourceHash must be a SHA-256 hex digest");
        return;
      }
      const actualSourceHash = createHash("sha256").update(media[0]!.buffer).digest("hex");
      if (actualSourceHash !== sourceHash) {
        invalid(res, "sourceHash does not match the uploaded image");
        return;
      }
      if (referenceValue && !normalizedReference) {
        invalid(res, "referenceValue must match 26/XXXX or JB26/XXXX");
        return;
      }
      if (archiveMessageId && archiveMessageId.length > 128) {
        invalid(res, "archiveMessageId is too long");
        return;
      }
      if (senderName && senderName.length > 200) {
        invalid(res, "senderName is too long");
        return;
      }
      if (kind !== "deposit" && kind !== "final") {
        invalid(res, "kind must be deposit or final");
        return;
      }
      if (claimedAmountThb === undefined) {
        invalid(res, "claimedAmountThb must be a non-negative integer");
        return;
      }

      const [existing] = await database
        .select()
        .from(paymentSlips)
        .where(and(
          eq(paymentSlips.sourceType, LINE_ARCHIVE_SOURCE_TYPE),
          eq(paymentSlips.archiveAttachmentId, archiveAttachmentId),
        ))
        .limit(1);
      if (existing) {
        res.status(409).json({ message: "This archive attachment has already been imported", existing });
        return;
      }

      upload = await saveUploadedMedia(media[0]!, "slip");
      const insertIntake = async (transaction: AdminDatabase) => {
        let leadId: number | null = null;
        if (normalizedReference) {
          const [reference] = await transaction
            .select()
            .from(leadExternalReferences)
            .where(and(
              eq(leadExternalReferences.referenceType, LINE_JOB_REFERENCE_TYPE),
              eq(leadExternalReferences.normalizedValue, normalizedReference),
            ))
            .limit(1);
          leadId = reference?.leadId ?? null;
        }

        const [created] = await transaction
          .insert(paymentSlips)
          .values({
            leadId,
            kind,
            status: "team_reported_paid",
            sourceType: LINE_ARCHIVE_SOURCE_TYPE,
            referenceValue,
            archiveMessageId,
            archiveAttachmentId,
            sourceHash,
            slipImageUrl: upload!.url,
            claimedAmountThb,
            senderName,
          })
          .returning();
        if (!created) throw new Error("Payment slip was not saved");
        return created;
      };

      const created = database.transaction
        ? await database.transaction(insertIntake)
        : await insertIntake(database);
      res.status(201).json(created);
    } catch (error) {
      if (upload) await removeUploadedMedia(upload.filename).catch(() => undefined);
      if (isUniqueViolation(error)) {
        res.status(409).json({ message: "This archive attachment has already been imported" });
        return;
      }
      if (error instanceof Error && /required|invalid|choose|allowed|large|multipart/i.test(error.message)) {
        invalid(res, error.message);
        return;
      }
      next(error);
    }
  });

  router.get("/admin/slips/unassigned", requireAdminPermission("leads"), async (_req, res, next) => {
    try {
      const slips = await database
        .select()
        .from(paymentSlips)
        .where(and(isNull(paymentSlips.leadId), ne(paymentSlips.status, "voided")))
        .orderBy(desc(paymentSlips.createdAt));

      const candidateLeads = await database
        .select({ id: customerLeads.id, leadKey: customerLeads.leadKey, quoteNumber: customerLeads.quoteNumber, name: customerLeads.name, company: customerLeads.company })
        .from(customerLeads)
        .orderBy(asc(customerLeads.id));

      const withSuggestions = slips.map((slip: { referenceValue?: string | null; senderName?: string | null }) => {
        const match = findAutoMatchLead({ referenceValue: slip.referenceValue, senderName: slip.senderName }, candidateLeads);
        return {
          ...slip,
          suggestedMatch: match ? { leadId: match.matchedLeadId, reason: match.matchedReason } : null,
        };
      });
      res.json(withSuggestions);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/slips/assign-bulk", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const assignments = parseBulkSlipAssignments(req.body);
    if (!assignments) {
      invalid(res, "Invalid bulk payment slip assignment");
      return;
    }

    try {
      const runBulkAssign = async (transaction: AdminDatabase) => {
        const assignedSlips: unknown[] = [];
        for (const { slipId, leadId } of assignments) {
          const [lead] = await transaction
            .select({ id: customerLeads.id })
            .from(customerLeads)
            .where(eq(customerLeads.id, leadId))
            .limit(1);
          if (!lead) throw new BulkSlipAssignError("lead-not-found", slipId, leadId);

          const [slip] = await transaction
            .select()
            .from(paymentSlips)
            .where(eq(paymentSlips.id, slipId))
            .limit(1);
          if (!slip) throw new BulkSlipAssignError("missing", slipId, leadId);
          if (slip.status === "voided" || slip.leadId !== null) throw new BulkSlipAssignError("conflict", slipId, leadId);

          if (slip.referenceValue) {
            const normalizedReference = normalizeLineJobCode(slip.referenceValue);
            if (normalizedReference) {
              const [existingReference] = await transaction
                .select()
                .from(leadExternalReferences)
                .where(and(
                  eq(leadExternalReferences.referenceType, LINE_JOB_REFERENCE_TYPE),
                  eq(leadExternalReferences.normalizedValue, normalizedReference),
                ))
                .limit(1);
              if (existingReference && existingReference.leadId !== lead.id) {
                throw new BulkSlipAssignError("reference-conflict", slipId, leadId);
              }
              await transaction
                .insert(leadExternalReferences)
                .values({
                  leadId: lead.id,
                  referenceType: LINE_JOB_REFERENCE_TYPE,
                  referenceValue: slip.referenceValue,
                  normalizedValue: normalizedReference,
                })
                .onConflictDoNothing();
            }
          }

          const [updated] = await transaction
            .update(paymentSlips)
            .set({
              leadId: lead.id,
              reviewedByAdmin: true,
              updatedAt: new Date(),
            })
            .where(and(eq(paymentSlips.id, slipId), isNull(paymentSlips.leadId)))
            .returning();
          if (!updated) throw new BulkSlipAssignError("conflict", slipId, leadId);
          assignedSlips.push(updated);
        }
        return assignedSlips;
      };

      const assignedSlips = database.transaction
        ? await database.transaction(runBulkAssign)
        : await runBulkAssign(database);
      res.json({ assigned: assignedSlips });
    } catch (error) {
      if (error instanceof BulkSlipAssignError) {
        const status = error.code === "lead-not-found" || error.code === "missing" ? 404 : 409;
        res.status(status).json({ message: error.message, slipId: error.slipId, leadId: error.leadId });
        return;
      }
      if (isUniqueViolation(error)) {
        res.status(409).json({ message: "That job code is already assigned to another lead" });
        return;
      }
      next(error);
    }
  });

  router.post("/admin/slips/:id/assign", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = AssignAdminPaymentSlipBody.safeParse(req.body);
    if (!id || !parsed.success) {
      invalid(res, "Invalid payment slip assignment", parsed.success ? undefined : parsed.error.flatten());
      return;
    }

    try {
      const [lead] = await database
        .select({ id: customerLeads.id })
        .from(customerLeads)
        .where(eq(customerLeads.id, parsed.data.leadId))
        .limit(1);
      if (!lead) {
        res.status(404).json({ message: "Lead not found" });
        return;
      }

      const assignSlip = async (transaction: AdminDatabase) => {
        const [slip] = await transaction
          .select()
          .from(paymentSlips)
          .where(eq(paymentSlips.id, id))
          .limit(1);
        if (!slip) return { kind: "missing" as const };
        if (slip.status === "voided" || slip.leadId !== null) return { kind: "conflict" as const };

        if (slip.referenceValue) {
          const normalizedReference = normalizeLineJobCode(slip.referenceValue);
          if (normalizedReference) {
            const [existingReference] = await transaction
              .select()
              .from(leadExternalReferences)
              .where(and(
                eq(leadExternalReferences.referenceType, LINE_JOB_REFERENCE_TYPE),
                eq(leadExternalReferences.normalizedValue, normalizedReference),
              ))
              .limit(1);
            if (existingReference && existingReference.leadId !== lead.id) {
              return { kind: "reference-conflict" as const };
            }
            await transaction
              .insert(leadExternalReferences)
              .values({
                leadId: lead.id,
                referenceType: LINE_JOB_REFERENCE_TYPE,
                referenceValue: slip.referenceValue,
                normalizedValue: normalizedReference,
              })
              .onConflictDoNothing();
          }
        }

        const [updated] = await transaction
          .update(paymentSlips)
          .set({
            leadId: lead.id,
            reviewedByAdmin: true,
            updatedAt: new Date(),
          })
          .where(and(eq(paymentSlips.id, id), isNull(paymentSlips.leadId)))
          .returning();
        return updated ? { kind: "updated" as const, slip: updated } : { kind: "conflict" as const };
      };

      const result = database.transaction
        ? await database.transaction(assignSlip)
        : await assignSlip(database);
      if (result.kind === "missing") {
        res.status(404).json({ message: "Payment slip not found" });
        return;
      }
      if (result.kind === "conflict") {
        res.status(409).json({ message: "Payment slip is already assigned or voided" });
        return;
      }
      if (result.kind === "reference-conflict") {
        res.status(409).json({ message: "That job code is already assigned to another lead" });
        return;
      }
      res.json(result.slip);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ message: "That job code is already assigned to another lead" });
        return;
      }
      next(error);
    }
  });

  router.post("/admin/slips/:id/void", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) {
      invalid(res, "Invalid payment slip id");
      return;
    }
    try {
      const [updated] = await database
        .update(paymentSlips)
        .set({ status: "voided", reviewedByAdmin: true, updatedAt: new Date() })
        .where(and(eq(paymentSlips.id, id), eq(paymentSlips.status, "team_reported_paid")))
        .returning();
      if (!updated) {
        const [existing] = await database
          .select({ id: paymentSlips.id })
          .from(paymentSlips)
          .where(eq(paymentSlips.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ message: "Payment slip not found" });
          return;
        }
        res.status(409).json({ message: "Only team-reported payment slips can be voided" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/upload", requireAnyAdminPermission(["basins", "installed-stones", "sheet-stones"], "edit"), uploadRateLimit, uploadConcurrency, async (req, res, next) => {
    try {
      const image = await readMultipartImage(req);
      return res.status(201).json(await saveUploadedImage(image));
    } catch (error) {
      if (error instanceof UploadFileCollisionError) {
        return res.status(409).json({ message: error.message });
      }
      if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) {
        return res.status(400).json({ message: error.message });
      }
      return next(error);
    }
  });

  router.post("/admin/upload/video", requireAdminPermission("basins", "edit"), uploadRateLimit, uploadConcurrency, async (req, res, next) => {
    try {
      const video = await readMultipartVideo(req);
      return res.status(201).json(await saveUploadedVideo(video));
    } catch (error) {
      if (error instanceof UploadFileCollisionError) {
        return res.status(409).json({ message: error.message });
      }
      if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) {
        return res.status(400).json({ message: error.message });
      }
      return next(error);
    }
  });

  router.post("/admin/uploads/cleanup", requireAnyAdminPermission(["basins", "installed-stones", "sheet-stones"], "edit"), async (_req, res, next) => {
    try {
      const result = await cleanupUnreferencedUploadedImages(await catalogImageUrls(database));
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/admin/basins", requireAdminPermission("basins"), async (_req, res, next) => {
    try {
      const basins = await database.select().from(basinPrices).orderBy(asc(basinPrices.sortOrder), asc(basinPrices.id));
      const categories = typeof database.select === "function" ? await basinCategoryRows(database) : [];
      res.json(basins.map((basin: any) => withBasinCategory(withBasinMedia(basin), categories)));
    } catch (error) { return next(error); }
  });

  router.post("/admin/basins", requireAdminPermission("basins", "edit"), async (req, res, next) => {
    const parsed = CreateAdminBasinBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid basin data", parsed.error.flatten());
    try {
      const normalized = normalizeBasinFields(parsed.data);
      const data = { ...parsed.data };
      if (typeof parsed.data.categoryId === "number") {
        const [category] = await database.select().from(basinCategories).where(eq(basinCategories.id, parsed.data.categoryId));
        if (!category) return res.status(400).json({ message: "Basin category not found" });
        if (!category.active) return res.status(400).json({ message: "Archived basin categories cannot be assigned to new basins" });
        data.category = category.name;
      }
      const [created] = await database.insert(basinPrices).values({
        ...data,
        ...(typeof parsed.data.categoryId === "number" ? { categoryId: parsed.data.categoryId, category: data.category } : {}),
        dimensions: normalized.dimensions,
        basinDimensions: normalized.basinDimensions,
        bowlMm: normalized.bowlMm,
      }).returning();
      const categories = typeof database.select === "function" ? await basinCategoryRows(database) : [];
      return res.status(201).json(withBasinCategory(withBasinMedia(created), categories));
    } catch (error) { return next(error); }
  });

  router.put("/admin/basins/:id", requireAdminPermission("basins", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminBasinBody.safeParse(req.body);
    if (!id || !parsed.success) return invalid(res, "Invalid basin data");
    try {
      const normalized = normalizeBasinFields(parsed.data);
      const data = { ...parsed.data };
      if (typeof parsed.data.categoryId === "number") {
        const [category] = await database.select().from(basinCategories).where(eq(basinCategories.id, parsed.data.categoryId));
        if (!category) return res.status(400).json({ message: "Basin category not found" });
        const [current] = await database.select().from(basinPrices).where(eq(basinPrices.id, id));
        if (!category.active && current?.categoryId !== category.id) {
          return res.status(400).json({ message: "Archived basin categories cannot be newly assigned" });
        }
        data.category = category.name;
      }
      const [updated] = await database.update(basinPrices).set({
        ...data,
        ...(typeof parsed.data.categoryId === "number" ? { categoryId: parsed.data.categoryId, category: data.category } : {}),
        dimensions: normalized.dimensions,
        basinDimensions: normalized.basinDimensions,
        bowlMm: normalized.bowlMm,
        updatedAt: new Date(),
      }).where(eq(basinPrices.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Basin not found" });
      const categories = typeof database.select === "function" ? await basinCategoryRows(database) : [];
      return res.json(withBasinCategory(withBasinMedia(updated), categories));
    } catch (error) { return next(error); }
  });

  router.delete("/admin/basins/:id", requireAdminPermission("basins", "delete"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid basin id");
    try {
      const deleted = await database.delete(basinPrices).where(eq(basinPrices.id, id)).returning({ id: basinPrices.id });
      return deleted.length ? res.status(204).end() : res.status(404).json({ message: "Basin not found" });
    } catch (error) { return next(error); }
  });

  router.get("/admin/basin-categories", requireAdminPermission("basins"), async (_req, res, next) => {
    try {
      return res.json(await basinCategoryRows(database));
    } catch (error) { return next(error); }
  });

  router.post("/admin/basin-categories", requireAdminPermission("basins", "edit"), async (req, res, next) => {
    const parsed = CreateAdminBasinCategoryBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.name.trim()) return invalid(res, "Invalid basin category data", parsed.success ? undefined : parsed.error.flatten());
    try {
      const [created] = await database.insert(basinCategories).values({ ...parsed.data, name: parsed.data.name.trim() }).returning();
      return res.status(201).json(created);
    } catch (error) {
      if (isDuplicateCategory(error)) return res.status(409).json({ message: "A category with this name already exists" });
      return next(error);
    }
  });

  router.put("/admin/basin-categories/:id", requireAdminPermission("basins", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminBasinCategoryBody.safeParse(req.body);
    if (!id || !parsed.success || !parsed.data.name.trim()) return invalid(res, "Invalid basin category data", parsed.success ? undefined : parsed.error.flatten());
    try {
      const [updated] = await database.update(basinCategories)
        .set({ ...parsed.data, name: parsed.data.name.trim(), updatedAt: new Date() })
        .where(eq(basinCategories.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Basin category not found" });
      return res.json(updated);
    } catch (error) {
      if (isDuplicateCategory(error)) return res.status(409).json({ message: "A category with this name already exists" });
      return next(error);
    }
  });

  router.delete("/admin/basin-categories/:id", requireAdminPermission("basins", "delete"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid basin category id");
    try {
      const deleted = await database.delete(basinCategories)
        .where(eq(basinCategories.id, id))
        .returning({ id: basinCategories.id });
      if (!deleted.length) return res.status(404).json({ message: "Basin category not found" });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });

  router.get("/admin/installed-stones", requireAdminPermission("installed-stones"), async (_req, res, next) => {
    try {
      const stones = await database.select().from(installedStonePrices).orderBy(asc(installedStonePrices.sortOrder), asc(installedStonePrices.id));
      res.json(stones.map(withStoneMedia));
    } catch (error) { return next(error); }
  });

  router.get("/admin/installed-stone-categories", requireAdminPermission("installed-stones"), async (_req, res, next) => {
    try {
      const categories = await database
        .select()
        .from(installedStoneCategories)
        .orderBy(asc(installedStoneCategories.sortOrder), asc(installedStoneCategories.id));
      res.json(categories);
    } catch (error) { return next(error); }
  });

  router.post("/admin/installed-stone-categories", requireAdminPermission("installed-stones", "edit"), async (req, res, next) => {
    const parsed = CreateAdminInstalledStoneCategoryBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.name.trim()) return invalid(res, "Invalid installed stone category data", parsed.success ? undefined : parsed.error.flatten());
    try {
      const [created] = await database.insert(installedStoneCategories).values({ ...parsed.data, name: parsed.data.name.trim() }).returning();
      return res.status(201).json(created);
    } catch (error) {
      if (isDuplicateCategory(error)) return res.status(409).json({ message: "A category with this name already exists" });
      return next(error);
    }
  });

  router.put("/admin/installed-stone-categories/:id", requireAdminPermission("installed-stones", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminInstalledStoneCategoryBody.safeParse(req.body);
    if (!id || !parsed.success || !parsed.data.name.trim()) return invalid(res, "Invalid installed stone category data", parsed.success ? undefined : parsed.error.flatten());
    try {
      const [updated] = await database
        .update(installedStoneCategories)
        .set({ ...parsed.data, name: parsed.data.name.trim(), updatedAt: new Date() })
        .where(eq(installedStoneCategories.id, id))
        .returning();
      return updated ? res.json(updated) : res.status(404).json({ message: "Installed stone category not found" });
    } catch (error) {
      if (isDuplicateCategory(error)) return res.status(409).json({ message: "A category with this name already exists" });
      return next(error);
    }
  });

  router.delete("/admin/installed-stone-categories/:id", requireAdminPermission("installed-stones", "delete"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid installed stone category id");
    try {
      const deleted = await database.delete(installedStoneCategories)
        .where(eq(installedStoneCategories.id, id))
        .returning({ id: installedStoneCategories.id });
      if (!deleted.length) return res.status(404).json({ message: "Installed stone category not found" });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });

  router.post("/admin/installed-stones", requireAdminPermission("installed-stones", "edit"), async (req, res, next) => {
    const parsed = CreateAdminInstalledStoneBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid installed stone data", parsed.error.flatten());
    try {
      const [created] = await database.insert(installedStonePrices).values(parsed.data).returning();
      return res.status(201).json(withStoneMedia(created));
    } catch (error) { return next(error); }
  });

  router.put("/admin/installed-stones/:id", requireAdminPermission("installed-stones", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminInstalledStoneBody.safeParse(req.body);
    if (!id || !parsed.success) return invalid(res, "Invalid installed stone data");
    try {
      const [updated] = await database.update(installedStonePrices).set({ ...parsed.data, updatedAt: new Date() }).where(eq(installedStonePrices.id, id)).returning();
      return updated ? res.json(withStoneMedia(updated)) : res.status(404).json({ message: "Installed stone not found" });
    } catch (error) { return next(error); }
  });

  router.delete("/admin/installed-stones/:id", requireAdminPermission("installed-stones", "delete"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid installed stone id");
    try {
      const deleted = await database.delete(installedStonePrices).where(eq(installedStonePrices.id, id)).returning({ id: installedStonePrices.id });
      return deleted.length ? res.status(204).end() : res.status(404).json({ message: "Installed stone not found" });
    } catch (error) { return next(error); }
  });

  router.get("/admin/sheet-stones", requireAdminPermission("sheet-stones"), async (_req, res, next) => {
    try {
      const stones = await database.select().from(sheetStonePrices).orderBy(asc(sheetStonePrices.sortOrder), asc(sheetStonePrices.id));
      res.json(stones.map(withStoneMedia));
    } catch (error) { return next(error); }
  });

  router.post("/admin/sheet-stones", requireAdminPermission("sheet-stones", "edit"), async (req, res, next) => {
    const parsed = CreateAdminSheetStoneBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, "Invalid sheet stone data", parsed.error.flatten());
    try {
      const [created] = await database.insert(sheetStonePrices).values(parsed.data).returning();
      return res.status(201).json(withStoneMedia(created));
    } catch (error) { return next(error); }
  });

  router.put("/admin/sheet-stones/:id", requireAdminPermission("sheet-stones", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminSheetStoneBody.safeParse(req.body);
    if (!id || !parsed.success) return invalid(res, "Invalid sheet stone data");
    try {
      const [updated] = await database.update(sheetStonePrices).set({ ...parsed.data, updatedAt: new Date() }).where(eq(sheetStonePrices.id, id)).returning();
      return updated ? res.json(withStoneMedia(updated)) : res.status(404).json({ message: "Sheet stone not found" });
    } catch (error) { return next(error); }
  });

  router.delete("/admin/sheet-stones/:id", requireAdminPermission("sheet-stones", "delete"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    if (!id) return invalid(res, "Invalid sheet stone id");
    try {
      const deleted = await database.delete(sheetStonePrices).where(eq(sheetStonePrices.id, id)).returning({ id: sheetStonePrices.id });
      return deleted.length ? res.status(204).end() : res.status(404).json({ message: "Sheet stone not found" });
    } catch (error) { return next(error); }
  });

  router.get("/admin/backup/summary", requireAnyAdminPermission(["leads", "basins"]), async (_req, res, next) => {
    try {
      const [leads, photos, basins, slips] = await Promise.all([
        database.select().from(customerLeads),
        database.select().from(sitePhotos),
        database.select().from(basinPrices),
        database.select().from(paymentSlips),
      ]);
      res.json({
        leadsCount: leads.length,
        sitePhotosCount: photos.length,
        basinsCount: basins.length,
        paymentSlipsCount: slips.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) { return next(error); }
  });

  router.get("/admin/backup/leads-export", requireAnyAdminPermission(["leads", "basins"]), async (_req, res, next) => {
    try {
      const leads = await database.select().from(customerLeads).orderBy(asc(customerLeads.id));
      const rows = leads.map((lead: any) => [
        lead.leadKey,
        lead.name ?? "",
        lead.project ?? "",
        lead.address ?? "",
        lead.technicianTeamCode ?? "",
        lead.expectedInstallationDate ?? "",
        LEAD_STATUS_LABELS_TH[lead.status] ?? lead.status,
        quoteTotalTHB(lead.studioData) ?? "",
        lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
      ]);
      const csv = toCsv(LEADS_EXPORT_COLUMNS, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="knight-basins-leads-${Date.now()}.csv"`);
      return res.send(csv);
    } catch (error) { return next(error); }
  });

  router.get("/admin/backup/basins-export", requireAnyAdminPermission(["leads", "basins"]), async (_req, res, next) => {
    try {
      const basins = await database.select().from(basinPrices).orderBy(asc(basinPrices.sortOrder), asc(basinPrices.id));
      const rows = basins.map((basin: any) => {
        const media = withBasinMedia(basin);
        return [
          basin.sku,
          basin.colorName,
          basin.colorCode,
          basin.priceTHB,
          basin.dimensions,
          basin.bowlMm ?? basin.basinDimensions ?? "",
          media.imageUrl,
          basin.topViewImageUrl ?? "",
        ];
      });
      const csv = toCsv(BASINS_EXPORT_COLUMNS, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="knight-basins-basins-${Date.now()}.csv"`);
      return res.send(csv);
    } catch (error) { return next(error); }
  });

  return router;
}