import { createHmac } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { customerAccounts, customerLeads, customerProfileUpdateConfirmations, db, paymentSlips } from "@workspace/db";
import { getCatalogData } from "./catalog";
import { supportQueryMatches } from "../lib/support-search";
import { getSupportIntentReply } from "../lib/support-intents";
import { askHermesSupport, hermesSupportConfigured } from "../lib/hermes-support";
import { detectPromptInjection, sanitizeAiResponse } from "../lib/prompt-guard";
import { synthesizeSpeech } from "../lib/google-tts";
import {
  extractSupportProfileFields,
  isSupportCancellation,
  isSupportConfirmation,
  supportProfileFieldLabel,
  supportProfileValue,
  type SupportProfileField,
  type SupportProfileFields,
} from "../lib/support-profile";
import { findAuthenticatedAccount, SESSION_COOKIE } from "./line-auth";
import { quoteTotalTHB } from "./leads";
import { createConcurrencyLimiter, createRateLimiter } from "../lib/rate-limit";
import { readMultipartForm, removeUploadedMedia, saveUploadedMedia } from "../lib/image-upload";
import { requestOrigin } from "../lib/public-origin";
import {
  isPublicQuoteTokenExpired,
  PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
  PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
  publicQuoteTokenForLead,
} from "../lib/quote-access";
import { notifyPaymentSlip } from "../lib/sales-notifications";
import {
  checkQuoteBeforePayment,
  PRICE_VERIFICATION_FAILED_ERROR,
  PRICE_VERIFICATION_FAILED_MESSAGE,
  type PricingDatabase,
} from "../lib/price-integrity";
import { SLIPOK_UNVERIFIABLE_CODES, verifySlip } from "../lib/slipok";

/**
 * The reply when a question matched no rule and no catalog entry (job-235).
 *
 * A visitor who is not signed in with LINE only gets the catalog here, so the reply says so and points to LINE sign-in
 * (`loginRequired: true` lets the page show the sign-in button). A signed-in customer reaches this only when the
 * assistant (Hermes) is not configured or did not answer; that path keeps its previous text and gets no flag.
 */
export const GUEST_SCOPE_REPLY = "ตอนนี้คุณกำลังใช้โหมดทั่วไป (ยังไม่เข้าสู่ระบบ LINE) ดิฉันตอบได้เฉพาะข้อมูลสินค้าในแคตตาล็อก เช่น \"KF023\" หรือ \"BW010\" ค่ะ\n\nหากต้องการปรึกษาการออกแบบ การชำระเงิน สถานะใบเสนอราคา หรือข้อมูลอื่น ๆ กรุณาเข้าสู่ระบบด้วย LINE ที่ปุ่มด้านบน เพื่อคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE ค่ะ\n\nหรือติดต่อฝ่ายขาย 094-496-1949 · 089-762-2209";
export const SIGNED_IN_FALLBACK_REPLY = "ดิฉันช่วยค้นหา SKU อ่างล้างหน้า รหัสสีหิน ราคา ขนาด และวิดีโอ 3D 360° ได้ค่ะ ลองพิมพ์เช่น KF001, KF023 หรือ BW010";

export function supportFallbackResponse(signedIn: boolean) {
  return signedIn
    ? { reply: SIGNED_IN_FALLBACK_REPLY, matchedType: "none" as const }
    : { reply: GUEST_SCOPE_REPLY, matchedType: "none" as const, loginRequired: true };
}

const LEAD_STATUS_LABEL: Record<string, string> = {
  new_lead: "ลูกค้าใหม่ ยังไม่ได้ขอใบเสนอราคา",
  quote_requested: "ขอใบเสนอราคาแล้ว รอทีมขายติดต่อกลับ",
  quote_sent: "ส่งใบเสนอราคาแล้ว รอลูกค้าตัดสินใจ",
  closed: "ปิดงานแล้ว",
};

export async function buildCustomerContextSummary(account: Account, database: typeof db = db): Promise<string> {
  const leads = await database
    .select({
      id: customerLeads.id,
      quoteNumber: customerLeads.quoteNumber,
      status: customerLeads.status,
      studioData: customerLeads.studioData,
    })
    .from(customerLeads)
    .where(and(eq(customerLeads.customerAccountId, account.id), ne(customerLeads.status, "closed")))
    .orderBy(desc(customerLeads.updatedAt))
    .limit(5);

  const header = `กำลังคุยกับลูกค้า "${account.fullName ?? "ไม่ทราบชื่อ"}" ที่ล็อกอินด้วย LINE บนเว็บ Knight Basins ตอบเฉพาะข้อมูลของลูกค้าคนนี้เท่านั้น ห้ามเปิดเผยข้อมูลลูกค้ารายอื่น`;
  if (!leads.length) return `${header}\nลูกค้าคนนี้ยังไม่มีใบเสนอราคาที่เปิดอยู่ในระบบ`;

  const slipsByLead = new Map<number, typeof paymentSlips.$inferSelect[]>();
  const leadIds = leads.map((lead) => lead.id);
  const slips = await database.select().from(paymentSlips).where(inArray(paymentSlips.leadId, leadIds));
  for (const slip of slips) {
    if (slip.leadId === null) continue;
    const list = slipsByLead.get(slip.leadId) ?? [];
    list.push(slip);
    slipsByLead.set(slip.leadId, list);
  }

  const lines = leads.map((lead) => {
    const total = quoteTotalTHB(lead.studioData);
    const statusLabel = LEAD_STATUS_LABEL[lead.status] ?? lead.status;
    const latestSlip = slipsByLead.get(lead.id)?.at(-1);
    const slipNote = latestSlip
      ? ` / สลิปล่าสุด: ${latestSlip.status === "verified" ? "ยืนยันแล้ว" : latestSlip.status === "rejected" ? "ยังไม่ยืนยัน (รอทีมขายตรวจสอบ)" : "รอตรวจสอบ"}`
      : "";
    return `- ใบเสนอราคา ${lead.quoteNumber ?? lead.id} · สถานะ: ${statusLabel}${total ? ` · ยอดรวม ${total.toLocaleString("th-TH")} บาท` : ""}${slipNote}`;
  });

  return `${header}\n${lines.join("\n")}`;
}

const router: IRouter = Router();

type Account = NonNullable<Awaited<ReturnType<typeof findAuthenticatedAccount>>>;
type PendingProfileUpdate = {
  id: number;
  fields: SupportProfileFields;
  comparison: Array<{
    field: SupportProfileField;
    label: string;
    previousValue: string;
    nextValue: string;
  }>;
  expiresAt: number;
};

const PENDING_UPDATE_TTL_MS = 10 * 60 * 1000;

function cleanMessage(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function profileValue(account: Account, field: SupportProfileField) {
  if (field === "fullName") return account.fullName;
  return account[field];
}

function profileComparison(account: Account, fields: SupportProfileFields) {
  return (Object.entries(fields) as Array<[SupportProfileField, string]>)
    .filter(([field, nextValue]) => cleanMessage(profileValue(account, field)) !== cleanMessage(nextValue))
    .map(([field, nextValue]) => ({
      field,
      label: supportProfileFieldLabel(field),
      previousValue: supportProfileValue(field, profileValue(account, field)),
      nextValue: supportProfileValue(field, nextValue),
    }));
}

function updateReply(comparison: PendingProfileUpdate["comparison"]) {
  return [
    "น้องไนท์พบข้อมูลโปรไฟล์หรือใบกำกับภาษีใหม่:",
    ...comparison.map((item) => `• ${item.label}เดิม: ${item.previousValue} → ใหม่: ${item.nextValue}`),
    "",
    "ต้องการให้น้องไนท์อัปเดตแทนข้อมูลเดิมใช่ไหมคะ? พิมพ์ “ยืนยัน” หรือ “ยกเลิก” ได้เลย",
  ].join("\n");
}

function leadValues(fields: SupportProfileFields) {
  return {
    ...(fields.fullName !== undefined ? { name: fields.fullName } : {}),
    ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
    ...(fields.email !== undefined ? { email: fields.email } : {}),
    ...(fields.address !== undefined ? { address: fields.address } : {}),
    ...(fields.taxName !== undefined ? { taxName: fields.taxName } : {}),
    ...(fields.taxId !== undefined ? { taxId: fields.taxId } : {}),
    ...(fields.taxBranch !== undefined ? { taxBranch: fields.taxBranch } : {}),
    ...(fields.taxAddress !== undefined ? { taxAddress: fields.taxAddress } : {}),
    ...(fields.propertyType !== undefined ? { propertyType: fields.propertyType } : {}),
    ...(fields.condoFloor !== undefined ? { condoFloor: fields.condoFloor } : {}),
  };
}

async function applyProfileUpdate(account: Account, fields: SupportProfileFields) {
  const now = new Date();
  const normalizedFields = fields.propertyType && fields.propertyType !== "condo"
    ? { ...fields, condoFloor: "" }
    : fields;
  await db.transaction(async (tx) => {
    await tx
      .update(customerAccounts)
      .set({
        ...(normalizedFields.fullName !== undefined ? { fullName: normalizedFields.fullName } : {}),
        ...(normalizedFields.phone !== undefined ? { phone: normalizedFields.phone } : {}),
        ...(normalizedFields.email !== undefined ? { email: normalizedFields.email } : {}),
        ...(normalizedFields.address !== undefined ? { address: normalizedFields.address } : {}),
        ...(normalizedFields.taxName !== undefined ? { taxName: normalizedFields.taxName } : {}),
        ...(normalizedFields.taxId !== undefined ? { taxId: normalizedFields.taxId } : {}),
        ...(normalizedFields.taxBranch !== undefined ? { taxBranch: normalizedFields.taxBranch } : {}),
        ...(normalizedFields.taxAddress !== undefined ? { taxAddress: normalizedFields.taxAddress } : {}),
        ...(normalizedFields.propertyType !== undefined ? { propertyType: normalizedFields.propertyType } : {}),
        ...(normalizedFields.condoFloor !== undefined ? { condoFloor: normalizedFields.condoFloor || null } : {}),
        updatedAt: now,
      })
      .where(eq(customerAccounts.id, account.id));

    const activeLeads = await tx
      .select({ id: customerLeads.id })
      .from(customerLeads)
      .where(and(eq(customerLeads.customerAccountId, account.id), ne(customerLeads.status, "closed")));
    const values = leadValues(normalizedFields);
    if (activeLeads.length) {
      for (const lead of activeLeads) {
        await tx.update(customerLeads).set({ ...values, updatedAt: now }).where(eq(customerLeads.id, lead.id));
      }
      return;
    }

    await tx.insert(customerLeads).values({
      leadKey: `support-${account.id}`,
      status: "new_lead",
      source: "knight_support",
      orderMode: "quick-purchase",
      name: normalizedFields.fullName ?? account.fullName ?? null,
      phone: normalizedFields.phone ?? account.phone ?? null,
      email: normalizedFields.email ?? account.email ?? null,
      address: normalizedFields.address ?? account.address ?? null,
      taxName: normalizedFields.taxName ?? account.taxName ?? null,
      taxId: normalizedFields.taxId ?? account.taxId ?? null,
      taxBranch: normalizedFields.taxBranch ?? account.taxBranch ?? null,
      taxAddress: normalizedFields.taxAddress ?? account.taxAddress ?? null,
      preferredContact: account.preferredContact ?? null,
      customerRole: account.customerRole ?? null,
      propertyType: normalizedFields.propertyType ?? account.propertyType ?? null,
      condoFloor: normalizedFields.condoFloor || account.condoFloor || null,
      productSkus: [],
      customerAccountId: account.id,
    });
  });
}

 router.post("/support/chat", createRateLimiter({ name: "support-chat", max: 30, windowMs: 60 * 1000 }), async (req, res, next) => {
  const message = cleanMessage(req.body?.message);
  if (!message) {
    res.status(400).json({ message: "กรุณาพิมพ์คำถามก่อนส่ง" });
    return;
  }

  // Prompt Guard: checked before any other branch (profile extraction,
  // catalog lookups, the AI call itself) so a jailbreak/system-prompt
  // extraction attempt never gets a chance to interact with those either.
  const injectionCheck = detectPromptInjection(message);
  if (injectionCheck.isSuspicious) {
    res.json({
      reply: "ขออภัยค่ะ น้องไนท์สามารถให้ข้อมูลเฉพาะเรื่องแคตตาล็อกสินค้า อ่างล้างหน้า และการออกแบบเคาน์เตอร์ของ Knight Furnich เท่านั้นค่ะ หากมีข้อสงสัยเพิ่มเติมติดต่อทีมงานได้ที่ 094-496-1949 นะคะ",
      matchedType: "none",
    });
    return;
  }

  try {
    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    let pending: PendingProfileUpdate | undefined;
    if (account) {
      const [storedPending] = await db
        .select()
        .from(customerProfileUpdateConfirmations)
        .where(eq(customerProfileUpdateConfirmations.accountId, account.id))
        .limit(1);
      if (storedPending) {
        const expiresAt = storedPending.expiresAt.getTime();
        if (expiresAt > Date.now()) {
          pending = {
            id: storedPending.id,
            fields: storedPending.fields as SupportProfileFields,
            comparison: storedPending.comparison as PendingProfileUpdate["comparison"],
            expiresAt,
          };
        } else {
          await db
            .delete(customerProfileUpdateConfirmations)
            .where(and(
              eq(customerProfileUpdateConfirmations.id, storedPending.id),
              eq(customerProfileUpdateConfirmations.accountId, account.id),
            ));
        }
      }
    }

    if (account && pending && pending.expiresAt > Date.now()) {
      if (isSupportConfirmation(message)) {
        await applyProfileUpdate(account, pending.fields);
        await db
          .delete(customerProfileUpdateConfirmations)
          .where(and(
            eq(customerProfileUpdateConfirmations.id, pending.id),
            eq(customerProfileUpdateConfirmations.accountId, account.id),
          ));
        res.json({
          reply: "น้องไนท์อัปเดตข้อมูลโปรไฟล์และใบกำกับภาษีให้เรียบร้อยแล้วค่ะ 🟢",
          matchedType: "none",
          profileUpdate: { status: "updated", fields: pending.comparison },
        });
        return;
      }
      if (isSupportCancellation(message)) {
        await db
          .delete(customerProfileUpdateConfirmations)
          .where(and(
            eq(customerProfileUpdateConfirmations.id, pending.id),
            eq(customerProfileUpdateConfirmations.accountId, account.id),
          ));
        res.json({
          reply: "ยกเลิกการอัปเดตข้อมูลแล้วค่ะ ข้อมูลเดิมยังไม่เปลี่ยนแปลง",
          matchedType: "none",
          profileUpdate: { status: "cancelled", fields: pending.comparison },
        });
        return;
      }
    }

    const extracted = extractSupportProfileFields(message);
    if (Object.keys(extracted).length > 0) {
      if (!account) {
        res.json({
          reply: "น้องไนท์พบข้อมูลโปรไฟล์ใหม่ แต่การบันทึกข้อมูลต้องเข้าสู่ระบบด้วย LINE ก่อนนะคะ",
          matchedType: "none",
          profileUpdate: { status: "login_required", fields: [] },
        });
        return;
      }
      const fieldsToConfirm = pending
        ? { ...pending.fields, ...extracted }
        : extracted;
      const comparison = profileComparison(account, fieldsToConfirm);
      if (!comparison.length) {
        res.json({
          reply: "ข้อมูลที่ส่งมาตรงกับโปรไฟล์ปัจจุบันแล้วค่ะ ยังไม่มีอะไรต้องอัปเดต",
          matchedType: "none",
          profileUpdate: { status: "no_changes", fields: [] },
        });
        return;
      }
      await db
        .insert(customerProfileUpdateConfirmations)
        .values({
          accountId: account.id,
          fields: fieldsToConfirm,
          comparison,
          expiresAt: new Date(Date.now() + PENDING_UPDATE_TTL_MS),
        })
        .onConflictDoUpdate({
          target: customerProfileUpdateConfirmations.accountId,
          set: {
            fields: fieldsToConfirm,
            comparison,
            expiresAt: new Date(Date.now() + PENDING_UPDATE_TTL_MS),
            updatedAt: new Date(),
          },
        });
      res.json({
        reply: updateReply(comparison),
        matchedType: "none",
        profileUpdate: { status: "confirmation_required", fields: comparison },
      });
      return;
    }

    if (account && (isSupportConfirmation(message) || isSupportCancellation(message))) {
      res.json({
        reply: "ตอนนี้ยังไม่มีข้อมูลโปรไฟล์ที่รอการยืนยันค่ะ",
        matchedType: "none",
      });
      return;
    }

    const intentReply = getSupportIntentReply(message);
    if (intentReply) {
      res.json({ reply: intentReply, matchedType: "none" });
      return;
    }

    const catalog = await getCatalogData(true);
    const comparedBasins = catalog.basins
      .filter((item) => supportQueryMatches(item.sku, message))
      .slice(0, 2);

    if (comparedBasins.length === 2) {
      const [first, second] = comparedBasins;
      const formatBasin = (basin: typeof first) =>
        `${basin.sku} ${basin.colorName} · ${basin.priceTHB.toLocaleString("th-TH")} บาท · ${basin.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${basin.dimensions}${basin.basinDimensions ? ` · หลุม ${basin.basinDimensions}` : ""}`;
      res.json({
        reply: `เปรียบเทียบจาก Catalog จริงให้แล้วค่ะ\n• ${formatBasin(first)}\n• ${formatBasin(second)}\n\nถ้าต้องการ ดิฉันเพิ่มทั้ง 2 รุ่นเข้าใบเสนอราคาให้ได้ค่ะ`,
        matchedType: "basin",
        matchedCode: null,
        compareItems: comparedBasins.map((basin) => ({
          code: basin.sku,
          name: basin.colorName,
          category: basin.category,
          priceTHB: basin.priceTHB,
          dimensions: basin.dimensions,
          basinDimensions: basin.basinDimensions ?? null,
        })),
      });
      return;
    }

    const basin = catalog.basins.find((item) =>
      [item.sku, item.colorCode, item.colorName].some((value) => supportQueryMatches(value, message)),
    );
    const stone = [...catalog.installedStones, ...catalog.sheetStones].find((item) =>
      [item.code, item.name, ...item.aliases].some((value) => supportQueryMatches(value, message)),
    );

    if (basin) {
      const category = basin.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น";
      res.json({
        reply: `${basin.sku} · ${basin.colorName} เป็น${category} ราคา ${basin.priceTHB.toLocaleString("th-TH")} บาท ขนาดโดยรวม ${basin.dimensions}${basin.basinDimensions ? ` และขนาดหลุม ${basin.basinDimensions}` : ""} มีวิดีโอ 3D 360° ให้ดูในรายการสินค้า`,
        matchedType: "basin",
        matchedCode: basin.sku,
      });
      return;
    }

    if (stone) {
      const installed = catalog.installedStones.find((item) => item.code === stone.code);
      const sheet = catalog.sheetStones.find((item) => item.code === stone.code);
      const prices = [
        installed ? `ตัดและติดตั้ง ${installed.pricePerSqmTHB.toLocaleString("th-TH")} บาท/ตร.ม.` : "",
        sheet ? `ขายแผ่นเริ่มต้น ${sheet.basePriceTHB.toLocaleString("th-TH")} บาท/แผ่น` : "",
      ].filter(Boolean).join(" · ");
      res.json({
        reply: `${stone.code} · ${stone.name} — ${prices || "กรุณาติดต่อทีมงานเพื่อเช็กราคา"}. เปิดภาพแผ่น HD ได้จากรายการสีหิน`,
        matchedType: "stone",
        matchedCode: stone.code,
      });
      return;
    }

    if (account && hermesSupportConfigured()) {
      const contextSummary = await buildCustomerContextSummary(account);
      const hermesResult = await askHermesSupport({
        message,
        userId: account.userId,
        contextSummary,
      });
      if (hermesResult.ok) {
        res.json({ reply: sanitizeAiResponse(hermesResult.reply), matchedType: "none" });
        return;
      }
    }

    res.json(supportFallbackResponse(Boolean(account)));
  } catch (error) {
    next(error);
  }
});

/**
 * Reads a single น้องไนท์ reply aloud. Opt-in only (the 🔊 button next to a
 * reply bubble in KnightSupport), never triggered automatically, since each
 * call spends real Google Cloud TTS quota. No auth required -- same public
 * surface as /support/chat -- but rate limited harder because voice is a
 * paid, per-character cost rather than free text.
 */
const supportSpeechRateLimit = createRateLimiter({ name: "support-speech", max: 20, windowMs: 60 * 60 * 1000 });
router.post("/support/speech", supportSpeechRateLimit, async (req, res, next) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  try {
    const result = await synthesizeSpeech(text);
    if (!result.ok) {
      res.status(422).json({ message: result.message });
      return;
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(result.audio);
  } catch (error) {
    next(error);
  }
});

const supportPaymentSlipRateLimit = createRateLimiter({ name: "support-payment-slip", max: 5, windowMs: 10 * 60 * 1000 });
type SupportSlipFailedAttemptRequest = Request & {
  supportSlipQuoteFailureKey?: string;
  supportSlipPhoneFailureKey?: string;
};
const supportPaymentSlipFailedQuoteRateLimit = createRateLimiter({
  name: "support-payment-slip-failed-quote",
  max: 5,
  windowMs: 60 * 60 * 1000,
  key: (req) => (req as SupportSlipFailedAttemptRequest).supportSlipQuoteFailureKey ?? "",
});
const supportPaymentSlipFailedPhoneRateLimit = createRateLimiter({
  name: "support-payment-slip-failed-phone",
  max: 5,
  windowMs: 60 * 60 * 1000,
  key: (req) => (req as SupportSlipFailedAttemptRequest).supportSlipPhoneFailureKey ?? "",
});
const supportUploadConcurrency = createConcurrencyLimiter("KnightSupport upload", 4);


function supportSlipTargetKey(kind: "quote" | "phone", value: string) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is required");
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

/** Applies the target-specific limit only after a quote lookup/ownership failure. */
export function applySupportPaymentSlipFailedAttemptLimits(
  req: Request,
  res: Response,
  quoteNumber: string,
  phone: string,
): boolean {
  const request = req as SupportSlipFailedAttemptRequest;
  const normalizedQuote = quoteNumber.trim().toUpperCase();
  const normalizedPhone = normalizePhoneDigits(phone);
  request.supportSlipQuoteFailureKey = supportSlipTargetKey("quote", normalizedQuote);
  let quoteAllowed = false;
  supportPaymentSlipFailedQuoteRateLimit(req, res, () => { quoteAllowed = true; });
  if (!quoteAllowed) return true;

  if (normalizedPhone) {
    request.supportSlipPhoneFailureKey = supportSlipTargetKey("phone", normalizedPhone);
    let phoneAllowed = false;
    supportPaymentSlipFailedPhoneRateLimit(req, res, () => { phoneAllowed = true; });
    if (!phoneAllowed) return true;
  }
  return false;
}

export type SupportSlipQuoteValidation =
  | { ok: true; total: number }
  | { ok: false; status: 400 | 410; error: string; message: string };

export async function validateSupportSlipQuote(
  lead: { createdAt: Date | string | null | undefined; orderMode: string; studioData: unknown },
  database: PricingDatabase = db,
  now = Date.now(),
): Promise<SupportSlipQuoteValidation> {
  if (isPublicQuoteTokenExpired(lead.createdAt, now)) {
    return {
      ok: false,
      status: 410,
      error: PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR,
      message: PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE,
    };
  }

  const priceCheck = await checkQuoteBeforePayment({ orderMode: lead.orderMode, studioData: lead.studioData }, database);
  if (!priceCheck.ok || priceCheck.total <= 0) {
    return {
      ok: false,
      status: 400,
      error: PRICE_VERIFICATION_FAILED_ERROR,
      message: PRICE_VERIFICATION_FAILED_MESSAGE,
    };
  }
  return { ok: true, total: priceCheck.total };
}
function normalizePhoneDigits(value: string) {
  // Thai mobile/landline numbers always start with 0, so a leading +66 or 66
  // country code unambiguously means "this replaces the 0" -- e.g.
  // "+66 61 845 9666" and "061-845-9666" are the same number.
  const withLocalPrefix = value.trim().replace(/^\+?66/, "0");
  return withLocalPrefix.replace(/\D/g, "");
}

/**
 * Lets a customer upload a payment slip through the KnightSupport chat
 * widget instead of the dedicated upload button on the saved-quote page.
 * The widget has no quote token in context (it's the same floating widget
 * on every page), so ownership of the quote is proven a different way:
 * either the customer is logged in via LINE and the quote belongs to their
 * account, or they confirm the phone number on file for that quote --
 * mirrors how a phone support call would verify identity. A plain typed
 * quote number alone is not proof of ownership.
 */
router.post("/support/payment-slip", supportPaymentSlipRateLimit, supportUploadConcurrency, async (req, res, next) => {
  try {
    const { media, fields } = await readMultipartForm(req, "image", { maxFiles: 1 });
    const quoteNumber = cleanMessage(fields.quoteNumber);
    const phone = cleanMessage(fields.phone);
    if (!quoteNumber) {
      res.status(400).json({ reply: "รบกวนแจ้งเลขที่ใบเสนอราคาด้วยค่ะ เช่น QT-202610-US-0001" });
      return;
    }

    const account = await findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
    const [lead] = await db
      .select()
      .from(customerLeads)
      .where(eq(customerLeads.quoteNumber, quoteNumber))
      .limit(1);

    const ownsViaAccount = Boolean(account && lead?.customerAccountId === account.id);
    const ownsViaPhone = Boolean(lead?.phone && phone && normalizePhoneDigits(lead.phone) === normalizePhoneDigits(phone));
    const validLead = lead && ["studio", "quick-purchase"].includes(lead.orderMode) && lead.studioData;

    if (!validLead || (!ownsViaAccount && !ownsViaPhone)) {
      if (validLead && !ownsViaAccount && !phone) {
        res.status(400).json({ reply: "รบกวนแจ้งเบอร์โทรที่ให้ไว้ตอนขอใบเสนอราคานี้ด้วยค่ะ เพื่อยืนยันว่าเป็นเจ้าของใบเสนอราคาก่อนอัปโหลดสลิป" });
        return;
      }
      // Deliberately vague either way (quote not found vs. phone mismatch) --
      // same anti-enumeration principle as the public quote-access route.
      if (applySupportPaymentSlipFailedAttemptLimits(req, res, quoteNumber, phone)) return;
      res.status(404).json({ reply: "ไม่พบใบเสนอราคานี้ หรือข้อมูลที่แจ้งมาไม่ตรงกันค่ะ รบกวนตรวจสอบเลขที่ใบเสนอราคาและเบอร์โทรอีกครั้งนะคะ" });
      return;
    }

    const quoteValidation = await validateSupportSlipQuote(lead, db);
    if (!quoteValidation.ok) {
      res.status(quoteValidation.status).json({
        error: quoteValidation.error,
        message: quoteValidation.message,
        reply: quoteValidation.message,
      });
      return;
    }

    const item = media[0]!;
    const upload = await saveUploadedMedia(item, "slip");
    try {
      const claimedAmountThb = quoteValidation.total;
      const result = await verifySlip(item, claimedAmountThb);
      const needsManualReview = !result.ok && result.errorCode !== null && SLIPOK_UNVERIFIABLE_CODES.has(result.errorCode);
      const [slip] = await db
        .insert(paymentSlips)
        .values(
          result.ok
            ? {
                leadId: lead.id,
                kind: "deposit",
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
                kind: "deposit",
                status: needsManualReview ? "needs_review" : "rejected",
                slipImageUrl: upload.url,
                claimedAmountThb,
                slipokErrorCode: result.errorCode,
                slipokRawResponse: result.raw,
              },
        )
        .returning();
      if (!slip) throw new Error("Payment slip was not saved");

      const quoteToken = publicQuoteTokenForLead(lead);
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
        quoteToken ? `/quote/view?token=${encodeURIComponent(quoteToken)}` : undefined,
      );

      const reply = slip.status === "verified"
        ? `✅ ตรวจสอบแล้วค่ะ เงินโอน ${slip.verifiedAmountThb?.toLocaleString("th-TH") ?? "-"} บาท จาก ${slip.senderName ?? "-"} เข้าเรียบร้อย ขอบคุณค่ะ`
        : slip.status === "needs_review"
          ? "ได้รับรูปที่แนบมาแล้วค่ะ แต่ระบบตรวจสอบอัตโนมัติหาข้อมูลยืนยันการโอนในรูปนี้ไม่เจอ ถ้าเป็นรูปสลิปโอนเงินจริง ทีมงานจะเปิดดูและยืนยันให้อีกครั้งค่ะ แต่ถ้าไม่ใช่รูปสลิปโอนเงิน รบกวนแนบรูปสลิปที่ถูกต้องมาใหม่อีกครั้งนะคะ"
          : "ตรวจสอบสลิปแล้วยังไม่ผ่านค่ะ (ยอดเงินหรือข้อมูลอาจไม่ตรงกัน) ทีมขายจะติดต่อกลับเพื่อตรวจสอบให้อีกครั้งนะคะ";

      res.status(201).json({ reply, status: slip.status });
    } catch (error) {
      await removeUploadedMedia(upload.filename).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && /required|invalid|choose|allowed|large/i.test(error.message)) {
      res.status(400).json({ reply: error.message });
      return;
    }
    next(error);
  }
});

export default router;