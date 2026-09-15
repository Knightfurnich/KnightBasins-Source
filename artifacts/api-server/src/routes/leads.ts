import { customerLeads } from "@workspace/db/schema";
import { UpsertLeadBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { readMultipartForm, saveUploadedMedia } from "../lib/image-upload";
import { requestOrigin } from "../lib/public-origin";
import { notifyQuote, notifySketch } from "../lib/sales-notifications";
import { formatQuoteMonth } from "../lib/date-time";
import { findAuthenticatedAccount, SESSION_COOKIE } from "./line-auth";

const router: IRouter = Router();

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
}

export function createQuoteNumber(now = new Date()) {
  const month = formatQuoteMonth(now);
  const serial = String(now.getTime()).slice(-6);
  return `${month} / US / ${serial}`;
}

router.post("/leads", async (req, res, next) => {
  const parsed = UpsertLeadBody.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Invalid lead data", parsed.error.flatten());

  try {
    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    const [existing] = await db
      .select({ quoteNumber: customerLeads.quoteNumber })
      .from(customerLeads)
      .where(eq(customerLeads.leadKey, parsed.data.leadKey))
      .limit(1);
    const quoteNumber = parsed.data.quoteNumber ?? existing?.quoteNumber ?? (parsed.data.status === "quote_requested" ? createQuoteNumber() : null);
    const statusPriority = {
      new_lead: 0,
      selecting: 1,
      quote_requested: 2,
      closed: 3,
    } as const;
    const requestedPriority = statusPriority[parsed.data.status];
    const [lead] = await db
      .insert(customerLeads)
      .values({ ...parsed.data, quoteNumber, customerAccountId: account?.id ?? null })
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
          productSkus: parsed.data.productSkus,
           quoteNumber: quoteNumber ?? customerLeads.quoteNumber,
           orderMode: parsed.data.orderMode,
           studioData: parsed.data.studioData,
           sketchUrl: parsed.data.sketchUrl,
           customerAccountId: account?.id ?? customerLeads.customerAccountId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.json(lead);
  } catch (error) {
    return next(error);
  }
});

router.get("/quotes", async (req, res, next) => {
  const quoteNumber = typeof req.query.quoteNumber === "string" ? req.query.quoteNumber.trim() : "";
  if (!quoteNumber) return invalid(res, "quoteNumber is required");

  try {
    const [lead] = await db
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, quoteNumber))
      .limit(1);
    if (!lead || !["studio", "quick-purchase"].includes(lead.orderMode) || !lead.studioData) {
      return res.status(404).json({ message: "Quote not found" });
    }
    return res.json(lead);
  } catch (error) {
    return next(error);
  }
});

router.post("/quotes/notify", async (req, res, next) => {
  const quoteNumber = typeof req.body?.quoteNumber === "string" ? req.body.quoteNumber.trim() : "";
  if (!quoteNumber) return invalid(res, "quoteNumber is required");
  try {
    const [lead] = await db
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, quoteNumber))
      .limit(1);
    if (!lead || !["studio", "quick-purchase"].includes(lead.orderMode) || !lead.studioData) {
      return res.status(404).json({ message: "Quote not found" });
    }
    const result = await notifyQuote(lead, requestOrigin(req), `/quote/view?quote=${encodeURIComponent(quoteNumber)}`);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/leads/sketch", async (req, res, next) => {
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
    const [lead] = await db
      .insert(customerLeads)
      .values({ ...parsed.data, sketchUrl: upload.url, orderMode: "sketch", customerAccountId: account?.id ?? null })
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
          productSkus: parsed.data.productSkus,
          studioData: parsed.data.studioData,
          sketchUrl: upload.url,
           customerAccountId: account?.id ?? customerLeads.customerAccountId,
          updatedAt: new Date(),
        },
      })
      .returning();
    const result = await notifySketch(
      lead,
      requestOrigin(req),
      lead.quoteNumber ? `/quote/view?quote=${encodeURIComponent(lead.quoteNumber)}` : undefined,
    );
    return res.status(201).json({ lead, ...result });
  } catch (error) {
    if (error instanceof Error && /required|invalid|choose|allowed|large|metadata/i.test(error.message)) return invalid(res, error.message);
    return next(error);
  }
});

export default router;