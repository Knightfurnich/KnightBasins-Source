import { customerLeads } from "@workspace/db/schema";
import { UpsertLeadBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { readMultipartForm, saveUploadedMedia } from "../lib/image-upload";

const router: IRouter = Router();

function invalid(res: Response, message: string, details?: unknown) {
  return res.status(400).json({ message, details });
}

router.post("/leads", async (req, res, next) => {
  const parsed = UpsertLeadBody.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Invalid lead data", parsed.error.flatten());

  try {
    const statusPriority = {
      new_lead: 0,
      selecting: 1,
      quote_requested: 2,
      closed: 3,
    } as const;
    const requestedPriority = statusPriority[parsed.data.status];
    const [lead] = await db
      .insert(customerLeads)
      .values(parsed.data)
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
          quoteNumber: parsed.data.quoteNumber,
           orderMode: parsed.data.orderMode,
           studioData: parsed.data.studioData,
           sketchUrl: parsed.data.sketchUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.json(lead);
  } catch (error) {
    return next(error);
  }
});

async function notifySalesTeam(lead: { name: string | null; phone: string | null; project: string | null; productSkus: string[]; sketchUrl: string | null }) {
  const accessToken = process.env["LINE_MESSAGING_ACCESS_TOKEN"] ?? process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  const destination = process.env["LINE_SALES_DESTINATION_ID"];
  if (!accessToken || !destination) return false;
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: destination,
        messages: [{
          type: "text",
          text: [
            "Knight Basins: มีแบบร่างใหม่",
            `ผู้ติดต่อ: ${lead.name || "-"}`,
            `โทร: ${lead.phone || "-"}`,
            `โครงการ: ${lead.project || "-"}`,
            `อ่าง: ${lead.productSkus.join(", ") || "-"}`,
            `ไฟล์: ${lead.sketchUrl || "-"}`,
          ].join("\n"),
        }],
      }),
    });
    if (!response.ok) throw new Error(`LINE push returned ${response.status}`);
    return true;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : "unknown" }, "Sketch lead LINE notification failed");
    return false;
  }
}

router.post("/leads/sketch", async (req, res, next) => {
  try {
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
      .values({ ...parsed.data, sketchUrl: upload.url, orderMode: "sketch" })
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
          updatedAt: new Date(),
        },
      })
      .returning();
    const notified = await notifySalesTeam(lead);
    return res.status(201).json({ lead, notificationStatus: notified ? "notified" : "saved_not_notified" });
  } catch (error) {
    if (error instanceof Error && /required|invalid|choose|allowed|large|metadata/i.test(error.message)) return invalid(res, error.message);
    return next(error);
  }
});

export default router;