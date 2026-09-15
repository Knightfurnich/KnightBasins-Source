import { customerAccounts, customerLeads, db } from "@workspace/db";
import { UpdateCustomerProfileBody } from "@workspace/api-zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { findAuthenticatedAccount, SESSION_COOKIE } from "./line-auth";

const router: IRouter = Router();

function unauthorized(res: Response) {
  return res.status(401).json({ message: "กรุณาเข้าสู่ระบบด้วย LINE ก่อนใช้งานโปรไฟล์" });
}

async function authenticatedAccount(req: Request) {
  return findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE]);
}

function profileResponse(account: NonNullable<Awaited<ReturnType<typeof findAuthenticatedAccount>>>) {
  return {
    id: account.id,
    lineUserId: account.userId,
    displayName: account.displayName,
    pictureUrl: account.pictureUrl,
    fullName: account.fullName ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    company: account.company ?? "",
    project: account.project ?? "",
    address: account.address ?? "",
    taxName: account.taxName ?? "",
    taxId: account.taxId ?? "",
    taxBranch: account.taxBranch ?? "",
    taxAddress: account.taxAddress ?? "",
    preferredContact: account.preferredContact ?? "line",
    customerRole: account.customerRole ?? "homeowner",
    propertyType: account.propertyType ?? "",
    condoFloor: account.condoFloor ?? "",
    expectedInstallationDate: account.expectedInstallationDate ?? "",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function quotationTotal(studioData: unknown) {
  if (!studioData || typeof studioData !== "object") return null;
  const data = studioData as { total?: unknown; estimate?: { totalTHB?: unknown } };
  const value = typeof data.total === "number" ? data.total : data.estimate?.totalTHB;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

router.get("/customer/profile", async (req, res, next) => {
  try {
    const account = await authenticatedAccount(req);
    if (!account) return unauthorized(res);
    return res.json(profileResponse(account));
  } catch (error) {
    return next(error);
  }
});

router.put("/customer/profile", async (req, res, next) => {
  const parsed = UpdateCustomerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "กรุณากรอกชื่อจริงและเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง", details: parsed.error.flatten() });
  }

  try {
    const account = await authenticatedAccount(req);
    if (!account) return unauthorized(res);
    const [updated] = await db
      .update(customerAccounts)
      .set({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        company: parsed.data.company || null,
        project: parsed.data.project || null,
        address: parsed.data.address || null,
        taxName: parsed.data.taxName || null,
        taxId: parsed.data.taxId || null,
        taxBranch: parsed.data.taxBranch || null,
        taxAddress: parsed.data.taxAddress || null,
        preferredContact: parsed.data.preferredContact,
        customerRole: parsed.data.customerRole,
        ...(parsed.data.propertyType !== undefined ? { propertyType: parsed.data.propertyType || null } : {}),
        ...(parsed.data.condoFloor !== undefined ? { condoFloor: parsed.data.condoFloor || null } : {}),
        ...(parsed.data.expectedInstallationDate !== undefined
          ? {
              expectedInstallationDate: parsed.data.expectedInstallationDate instanceof Date
                ? parsed.data.expectedInstallationDate.toISOString().slice(0, 10)
                : parsed.data.expectedInstallationDate || null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(customerAccounts.id, account.id))
      .returning({
        id: customerAccounts.id,
        userId: customerAccounts.lineUserId,
        displayName: customerAccounts.displayName,
        pictureUrl: customerAccounts.pictureUrl,
        fullName: customerAccounts.fullName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        company: customerAccounts.company,
        project: customerAccounts.project,
        address: customerAccounts.address,
        taxName: customerAccounts.taxName,
        taxId: customerAccounts.taxId,
        taxBranch: customerAccounts.taxBranch,
        taxAddress: customerAccounts.taxAddress,
        preferredContact: customerAccounts.preferredContact,
        customerRole: customerAccounts.customerRole,
        propertyType: customerAccounts.propertyType,
        condoFloor: customerAccounts.condoFloor,
        expectedInstallationDate: customerAccounts.expectedInstallationDate,
        createdAt: customerAccounts.createdAt,
        updatedAt: customerAccounts.updatedAt,
      });
    if (!updated) return res.status(404).json({ message: "ไม่พบโปรไฟล์ลูกค้า" });
    return res.json(profileResponse(updated));
  } catch (error) {
    return next(error);
  }
});

router.get("/customer/quotes", async (req, res, next) => {
  try {
    const account = await authenticatedAccount(req);
    if (!account) return unauthorized(res);
    const leads = await db
      .select({
        id: customerLeads.id,
        quoteNumber: customerLeads.quoteNumber,
        orderMode: customerLeads.orderMode,
        studioData: customerLeads.studioData,
        createdAt: customerLeads.createdAt,
        updatedAt: customerLeads.updatedAt,
      })
      .from(customerLeads)
      .where(and(
        eq(customerLeads.customerAccountId, account.id),
        inArray(customerLeads.orderMode, ["studio", "quick-purchase"]),
      ))
      .orderBy(desc(customerLeads.createdAt))
      .limit(50);

    return res.json(leads
      .filter((lead) => Boolean(lead.quoteNumber))
      .map((lead) => ({
        id: lead.id,
        quoteNumber: lead.quoteNumber!,
        orderMode: lead.orderMode as "studio" | "quick-purchase",
        issuedAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        amountTHB: quotationTotal(lead.studioData),
        viewUrl: `/quote/view?quote=${encodeURIComponent(lead.quoteNumber!)}`,
      })));
  } catch (error) {
    return next(error);
  }
});

export default router;