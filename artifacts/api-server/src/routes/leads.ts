import { customerLeads } from "@workspace/db/schema";
import { UpsertLeadBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { readMultipartForm, removeUploadedMedia, saveUploadedMedia } from "../lib/image-upload";
import { requestOrigin } from "../lib/public-origin";
import {
  createQuoteAccessSecret,
  publicQuoteResponse,
  publicQuoteTokenForLead,
  quoteAccessSecretMatches,
  verifyPublicQuoteToken,
} from "../lib/quote-access";
import { createConcurrencyLimiter, createRateLimiter } from "../lib/rate-limit";
import { notifyQuote, notifySketch } from "../lib/sales-notifications";
import { formatQuoteMonth } from "../lib/date-time";
import { findAuthenticatedAccount, SESSION_COOKIE } from "./line-auth";

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
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
  const uploadConcurrency = createConcurrencyLimiter("Upload service", 4);
  const notificationRateLimit = createRateLimiter({
    name: "quote-notification",
    max: 3,
    windowMs: 15 * 60 * 1000,
    key: (req) => `${req.ip}:${String(req.body?.token ?? "")}`,
  });

 router.post("/leads", leadRateLimit, async (req, res, next) => {
  const parsed = UpsertLeadBody.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Invalid lead data", parsed.error.flatten());

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
    const statusPriority = {
      new_lead: 0,
      selecting: 1,
      quote_requested: 2,
      closed: 3,
    } as const;
    const requestedPriority = statusPriority[parsed.data.status];
    const [lead] = await database
      .insert(customerLeads)
      .values({
        ...parsed.data,
        expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
        quoteNumber,
        quoteAccessSecret,
        customerAccountId: account?.id ?? null,
      })
      .onConflictDoUpdate({
        target: customerLeads.leadKey,
        set: {
          status: sql`CASE WHEN ${customerLeads.status} = 'closed' OR ${customerLeads.status} = 'quote_requested' AND ${requestedPriority} < 2 OR ${customerLeads.status} = 'selecting' AND ${requestedPriority} < 1 THEN ${customerLeads.status} ELSE ${parsed.data.status} END`,
          source: parsed.data.source,
          name: parsed.data.name,
          company: parsed.data.company,
          phone: parsed.data.phone,
          email: parsed.data.email,
          project: parsed.data.project,
          address: parsed.data.address,
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
           studioData: parsed.data.studioData,
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

router.get("/quotes", async (req, res, next) => {
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
    return res.json(publicQuoteResponse(lead));
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
    const result = await notifyQuote(lead, requestOrigin(req), `/quote/view?token=${encodeURIComponent(token)}`);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

  router.post("/leads/sketch", sketchRateLimit, uploadConcurrency, async (req, res, next) => {
  try {
    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    const { media, fields } = await readMultipartForm(req, "image");
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
    const upload = await saveUploadedMedia(media, "sketch");
    let lead;
    try {
      [lead] = await database
        .insert(customerLeads)
        .values({
          ...parsed.data,
          expectedInstallationDate: dateValue(parsed.data.expectedInstallationDate),
          sketchUrl: upload.url,
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
            email: parsed.data.email,
            project: parsed.data.project,
            address: parsed.data.address,
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
            studioData: parsed.data.studioData,
            sketchUrl: upload.url,
            customerAccountId: account?.id ?? customerLeads.customerAccountId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!lead) throw new Error("Lead was not saved");
    } catch (error) {
      try {
        await removeUploadedMedia(upload.filename);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Lead save failed and sketch upload cleanup failed for ${upload.filename}`,
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

  return router;
}

export default createLeadsRouter();