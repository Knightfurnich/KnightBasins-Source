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
} from "@workspace/api-zod";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
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
};

export type DashboardSlipRow = {
  leadId: number | null;
  status: string;
  verifiedAmountThb: number | null;
  claimedAmountThb: number | null;
};

export type AdminDashboardStats = {
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

export function computeAdminDashboardStats(
  leads: DashboardLeadRow[],
  slips: DashboardSlipRow[],
  now = new Date(),
): AdminDashboardStats {
  const pipelineRatio = { usCount: 0, ofCount: 0, otherCount: 0 };
  let readyForProduction = 0;
  let closed = 0;
  let awaitingContactCount = 0;
  for (const lead of leads) {
    if (lead.status === "ready_for_production") readyForProduction += 1;
    else if (lead.status === "closed") closed += 1;
    if (DASHBOARD_AWAITING_CONTACT_STATUSES.has(lead.status)) awaitingContactCount += 1;
    const orderType = pipelineOrderType(lead.quoteNumber);
    if (orderType === "us") pipelineRatio.usCount += 1;
    else if (orderType === "of") pipelineRatio.ofCount += 1;
    else pipelineRatio.otherCount += 1;
  }

  const unassignedSlipsCount = slips.filter((slip) => slip.leadId === null && slip.status !== "voided").length;

  return {
    kpis: {
      totalRevenueThb: computeTotalRevenueThb(slips),
      totalLeads: leads.length,
      readyForProduction,
      closed,
    },
    actionItems: { unassignedSlipsCount, awaitingContactCount },
    pipelineRatio,
    upcomingInstallations: computeUpcomingInstallations(leads, now),
    asOf: now.toISOString(),
  };
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

  router.get("/admin/leads", requireAdminPermission("leads"), async (_req, res, next) => {
    try {
      const leads = await database.select().from(customerLeads).orderBy(desc(customerLeads.updatedAt), desc(customerLeads.id));
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

  router.get("/admin/dashboard-stats", requireAdminPermission("leads"), async (_req, res, next) => {
    try {
      const leadRows: DashboardLeadRow[] = await database
        .select({
          id: customerLeads.id,
          leadKey: customerLeads.leadKey,
          status: customerLeads.status,
          quoteNumber: customerLeads.quoteNumber,
          name: customerLeads.name,
          project: customerLeads.project,
          address: customerLeads.address,
          expectedInstallationDate: customerLeads.expectedInstallationDate,
          notes: customerLeads.notes,
        })
        .from(customerLeads)
        .orderBy(asc(customerLeads.id));

      const slipRows: DashboardSlipRow[] = await database
        .select({
          leadId: paymentSlips.leadId,
          status: paymentSlips.status,
          verifiedAmountThb: paymentSlips.verifiedAmountThb,
          claimedAmountThb: paymentSlips.claimedAmountThb,
        })
        .from(paymentSlips)
        .orderBy(asc(paymentSlips.id));

      res.json(computeAdminDashboardStats(leadRows, slipRows, new Date()));
    } catch (error) {
      next(error);
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
      if (parsed.data.staffDimensions !== undefined) {
        const [existing] = await database
          .select({ studioData: customerLeads.studioData })
          .from(customerLeads)
          .where(eq(customerLeads.id, id))
          .limit(1);
        studioData = { ...(existing?.studioData as Record<string, unknown> ?? {}), staffDimensions: parsed.data.staffDimensions };
      }
      const [updated] = await database
        .update(customerLeads)
        .set({
          status: finalStatus,
          notes: parsed.data.notes,
          ...(studioData !== undefined ? { studioData } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customerLeads.id, id))
        .returning();
      return updated ? res.json(updated) : res.status(404).json({ message: "Lead not found" });
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

  return router;
}