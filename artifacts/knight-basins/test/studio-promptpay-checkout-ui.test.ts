import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studioSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
const checkoutSource = readFileSync(new URL("../src/components/StudioCheckoutModal.tsx", import.meta.url), "utf8");

test("PromptPay checkout is launched from the standalone 2D Studio and saves a public quote first", () => {
  assert.match(studioSource, /mode === "studio" && !isLeadLinkedMode && <button/);
  assert.match(studioSource, /data-testid="button-open-promptpay-checkout"/);
  assert.match(studioSource, /const lead = await upsertLead\.mutateAsync\(/);
  assert.match(studioSource, /status: "quote_requested"/);
  assert.match(studioSource, /source: "studio"/);
  assert.match(studioSource, /orderMode: "studio"/);
  assert.match(studioSource, /studioData: \{ state: safeState, estimate: safeEstimate, notification, worksitePlaceId \}/);
  assert.match(studioSource, /token: lead\.publicQuoteToken/);
  assert.match(studioSource, /<StudioCheckoutModal/);
  assert.match(studioSource, /quoteTotalTHB: safeEstimate\.totalTHB/);
});

test("checkout requests server-priced QRs and submits the selected type with the slip", () => {
  assert.match(checkoutSource, /useCreatePromptPayQr/);
  assert.match(checkoutSource, /useSubmitPaymentSlip/);
  assert.match(checkoutSource, /data: \{ token, paymentType: type \}/);
  assert.match(checkoutSource, /QRCode\.toDataURL\(result\.qrPayload/);
  assert.match(checkoutSource, /data: \{ file: selectedFile, token, kind: "deposit", paymentType \}/);
  assert.match(checkoutSource, /qr\.amountThb/);
  assert.match(checkoutSource, /quoteTotalTHB - qr\.amountThb/);
  for (const paymentType of ['"deposit_50"', '"deposit_30"', '"full"']) {
    assert.ok(checkoutSource.includes(paymentType), `expected payment option ${paymentType}`);
  }
});

test("checkout includes required account details, slip states, IDs, success, and tracking link", () => {
  for (const requiredText of [
    "บริษัท ไนท์ เฟอร์นิช จำกัด",
    "ธ.กรุงศรีอยุธยา",
    "574-1-18925-4",
    "🟢 ชำระมัดจำ 50%",
    "ชำระมัดจำ 30%",
    "ชำระเต็มจำนวน 100%",
    "📥 บันทึกรูป QR ลงมือถือ",
    "🚀 ยืนยันการชำระเงิน",
    "📱 ติดตามสถานะงานของคุณ (/track)",
    "status-payment-verified",
    "status-payment-needs-review",
    "status-payment-rejected",
    "modal-studio-checkout",
    "input-checkout-slip",
    "button-submit-checkout-slip",
    "text-payment-production-status",
    'href="/track"',
  ]) {
    assert.ok(checkoutSource.includes(requiredText), `missing checkout detail: ${requiredText}`);
  }
  assert.match(checkoutSource, /รหัสงานของคุณคือ \{quoteNumber\}.*ระบบกำลังเปิดคิวผลิตอัตโนมัติ/);
});