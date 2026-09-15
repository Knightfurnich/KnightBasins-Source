import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractSupportProfileFields,
  isSupportCancellation,
  isSupportConfirmation,
} from "../src/lib/support-profile.ts";

describe("KnightSupport profile extraction", () => {
  it("extracts labelled contact, tax, address, and condo fields", () => {
    const fields = extractSupportProfileFields(
      "ชื่อผู้ติดต่อ: คุณเอ เบอร์โทรศัพท์: 0812345678 อีเมล: a@example.com ที่อยู่ติดตั้ง: 99 ถนนสุขุมวิท ประเภทสถานที่: คอนโด ชั้นคอนโด: 12 ชื่อออกใบกำกับภาษี: บริษัท เอบีซี จำกัด เลขประจำตัวผู้เสียภาษี: 0105551111111 สาขา: สำนักงานใหญ่ ที่อยู่ใบกำกับภาษี: 99 ถนนสุขุมวิท",
    );

    assert.deepEqual(fields, {
      fullName: "คุณเอ",
      phone: "0812345678",
      email: "a@example.com",
      address: "99 ถนนสุขุมวิท",
      propertyType: "condo",
      condoFloor: "12",
      taxName: "บริษัท เอบีซี จำกัด",
      taxId: "0105551111111",
      taxBranch: "สำนักงานใหญ่",
      taxAddress: "99 ถนนสุขุมวิท",
    });
  });

  it("does not accept a non-13-digit tax id or a non-10-digit phone", () => {
    assert.deepEqual(extractSupportProfileFields("เลขผู้เสียภาษี: 123 เบอร์โทร: 08123"), {});
  });

  it("recognizes confirmation and cancellation words", () => {
    assert.equal(isSupportConfirmation("ยืนยัน"), true);
    assert.equal(isSupportConfirmation("ตกลง"), true);
    assert.equal(isSupportCancellation("ยกเลิก"), true);
    assert.equal(isSupportCancellation("ไม่ใช่"), true);
  });
});