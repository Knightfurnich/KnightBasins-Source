import {
  basinCategories,
  basinPrices,
  installedStoneCategories,
  installedStonePrices,
  sheetStonePrices,
  customerLeads,
  paymentSlips,
  adminMembers,
  adminInvites,
} from "@workspace/db/schema";
import {
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
} from "@workspace/api-zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Router, type Response, type IRouter } from "express";
import {
  adminCookieOptions,
  adminPasswordMatches,
  COOKIE_NAME,
  createAdminToken,
  requireAdminPermission,
  requireAnyAdminPermission,
  requireAdmin,
  requireAdminOwner,
  resolveAdminSession,
  ADMIN_PERMISSIONS,
  accessForAdminMember,
} from "../middlewares/admin-auth";
import { requestOrigin } from "../lib/public-origin";
import { createAdminInviteSecrets, hashAdminInviteValue } from "../lib/admin-invites";
import { normalizeBasinFields, withBasinCategory, withBasinMedia, withStoneMedia } from "../lib/catalog-media";
import {
  createQuoteAccessSecret,
  publicQuoteTokenForLead,
} from "../lib/quote-access";
import { createRateLimiter, createConcurrencyLimiter } from "../lib/rate-limit";
import {
  cleanupUnreferencedUploadedImages,
  readMultipartImage,
  readMultipartVideo,
  saveUploadedImage,
  saveUploadedVideo,
  UploadFileCollisionError,
} from "../lib/image-upload";

export type AdminDatabase = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
};

function idFrom(value: string | string[]) {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
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

  router.use("/admin", requireAdmin);

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

  router.patch("/admin/leads/:id", requireAdminPermission("leads", "edit"), async (req, res, next) => {
    const id = idFrom(req.params.id);
    const parsed = UpdateAdminLeadBody.safeParse(req.body);
    if (!id || !parsed.success) return invalid(res, "Invalid lead data", parsed.success ? undefined : parsed.error.flatten());
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
          status: parsed.data.status,
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