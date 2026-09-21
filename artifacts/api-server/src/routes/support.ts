import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { customerAccounts, customerLeads, customerProfileUpdateConfirmations, db, paymentSlips } from "@workspace/db";
import { getCatalogData } from "./catalog";
import { supportQueryMatches } from "../lib/support-search";
import { getSupportIntentReply } from "../lib/support-intents";
import { askHermesSupport, hermesSupportConfigured } from "../lib/hermes-support";
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
import { createRateLimiter } from "../lib/rate-limit";

const LEAD_STATUS_LABEL: Record<string, string> = {
  new_lead: "ลูกค้าใหม่ ยังไม่ได้ขอใบเสนอราคา",
  quote_requested: "ขอใบเสนอราคาแล้ว รอทีมขายติดต่อกลับ",
  quote_sent: "ส่งใบเสนอราคาแล้ว รอลูกค้าตัดสินใจ",
  closed: "ปิดงานแล้ว",
};

async function buildCustomerContextSummary(account: Account): Promise<string> {
  const leads = await db
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
  const slips = await db.select().from(paymentSlips).where(inArray(paymentSlips.leadId, leadIds));
  for (const slip of slips) {
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
        reply: `เปรียบเทียบจาก Catalog จริงให้แล้วครับ\n• ${formatBasin(first)}\n• ${formatBasin(second)}\n\nถ้าต้องการ ผมเพิ่มทั้ง 2 รุ่นเข้าใบเสนอราคาให้ได้ครับ`,
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
        res.json({ reply: hermesResult.reply, matchedType: "none" });
        return;
      }
    }

    res.json({
      reply: "ผมช่วยค้นหา SKU อ่างล้างหน้า รหัสสีหิน ราคา ขนาด และวิดีโอ 3D 360° ได้ ลองพิมพ์เช่น KF001, KF023 หรือ BW010",
      matchedType: "none",
    });
  } catch (error) {
    next(error);
  }
});

export default router;