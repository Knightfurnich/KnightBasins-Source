import assert from "node:assert/strict";
import test from "node:test";
import { calculateFormalQuoteTotals, formatQuoteMonth, quoteQrImageUrl, thaiNumberText } from "../src/data/quote-utils.ts";

test("formal quote totals apply VAT 7 percent", () => {
  const totals = calculateFormalQuoteTotals({
    basinSubtotal: 10000,
    requestedInstallationCharge: 5000,
    basinSets: 1,
    stoneTotal: 20000,
    vat: true,
  });

  assert.equal(totals.subtotal, 35000);
  assert.equal(totals.vatAmount, 2450);
  assert.equal(totals.total, 37450);
});

test("formal quote totals include every selected stone configuration", () => {
  const totals = calculateFormalQuoteTotals({
    basinSubtotal: 19000,
    requestedInstallationCharge: 0,
    basinSets: 1,
    stoneTotal: 5900 + 4900,
    vat: true,
  });

  assert.equal(totals.subtotal, 29800);
  assert.equal(totals.vatAmount, 2086);
  assert.equal(totals.total, 31886);
});

test("orders at least three basins turn installation into a discount", () => {
  const totals = calculateFormalQuoteTotals({
    basinSubtotal: 30000,
    requestedInstallationCharge: 15000,
    basinSets: 3,
    stoneTotal: 0,
    vat: false,
  });

  assert.equal(totals.installationCharge, 0);
  assert.equal(totals.installationDiscount, 15000);
  assert.equal(totals.subtotal, 30000);
  assert.ok(totals.subtotal <= 40000);
});

test("quotation number keeps the US and OF document modes", () => {
  const issueDate = new Date("2026-09-26T00:00:00Z");
  assert.equal(`${formatQuoteMonth(issueDate)} / US / 0754`, "Sep 26 / US / 0754");
  assert.equal(`${formatQuoteMonth(issueDate)} / OF / 1125`, "Sep 26 / OF / 1125");
});

test("quotation month follows Bangkok time at the UTC month boundary", () => {
  assert.equal(formatQuoteMonth(new Date("2026-09-30T23:30:00.000Z")), "Oct 26");
});

test("Thai amount words and QR images are generated from the same total/video URL", () => {
  assert.equal(thaiNumberText(37450), "สามหมื่นเจ็ดพันสี่ร้อยห้าสิบบาทถ้วน");
  const videoUrl = "https://example.com/videos/KF020-360.mp4";
  const qrImage = quoteQrImageUrl(videoUrl);
  assert.match(qrImage, /^data:image\/svg\+xml,/);
  assert.doesNotMatch(qrImage, /api\.qrserver\.com/);
  assert.match(decodeURIComponent(qrImage), /<svg[^>]+viewBox="0 0 \d+ \d+"/);
  assert.match(decodeURIComponent(qrImage), /<path[^>]+d="M/);
});
