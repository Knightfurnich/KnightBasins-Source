import { and, eq, ne } from "drizzle-orm";
import { paymentSlips } from "@workspace/db/schema";

export type FinancialLockResult = {
  isLocked: boolean;
  reason?: string;
  slipCount: number;
  totalAmountThb: number;
};

type FinancialSafetyDatabase = {
  select: (...args: any[]) => any;
};

const VOIDED_STATUS = "voided";

/**
 * ถอดแบบกฎเหล็กข้อ 10/18 ของ KRAKEN ERP: งานที่มีสลิปโอนเงินผูกอยู่ (ที่ยังไม่ถูกยกเลิก)
 * ต้องลบไม่ได้ เพื่อป้องกันการทำลายประวัติการเงิน
 */
export async function checkLeadFinancialLock(
  database: FinancialSafetyDatabase,
  leadId: number,
): Promise<FinancialLockResult> {
  const slips: Array<{ claimedAmountThb: number | null; verifiedAmountThb: number | null }> = await database
    .select({
      claimedAmountThb: paymentSlips.claimedAmountThb,
      verifiedAmountThb: paymentSlips.verifiedAmountThb,
    })
    .from(paymentSlips)
    .where(and(eq(paymentSlips.leadId, leadId), ne(paymentSlips.status, VOIDED_STATUS)));

  const slipCount = slips.length;
  const totalAmountThb = slips.reduce(
    (sum, slip) => sum + (slip.verifiedAmountThb ?? slip.claimedAmountThb ?? 0),
    0,
  );

  if (slipCount === 0) {
    return { isLocked: false, slipCount: 0, totalAmountThb: 0 };
  }

  return {
    isLocked: true,
    reason: `ไม่สามารถลบงานนี้ได้เนื่องจากมีสลิปโอนเงินผูกอยู่จำนวน ${slipCount} ใบ (ยอดรวม ${totalAmountThb} บาท) ตามกฎความปลอดภัยทางการเงิน`,
    slipCount,
    totalAmountThb,
  };
}
