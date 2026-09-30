import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);

describe("admin customer tracking insights", () => {
  it("shows tracking-view badges in table rows and lead cards", () => {
    assert.match(
      leadsManagerSource,
      /data-testid=\{`badge-tracking-views-\$\{lead\.id\}`\}/,
    );
    assert.match(leadsManagerSource, /trackingViewCount/);
    assert.match(leadsManagerSource, /👁️ เปิดดูแล้ว \$\{viewCount\} ครั้ง/);
    assert.match(leadsManagerSource, /ยังไม่เคยเปิดดู/);
    assert.ok(
      (leadsManagerSource.match(/<LeadTrackingViewsBadge lead=\{lead\} \/>/g) ?? []).length === 2,
      "Expected one tracking-view badge in the table and one in the card view",
    );
  });

  it("renders the expanded tracking panel with the full link and latest Thai date", () => {
    assert.match(leadsManagerSource, /data-testid="panel-customer-tracking-insights"/);
    assert.match(
      leadsManagerSource,
      /data-testid=\{`link-customer-tracking-\$\{lead\.id\}`\}/,
    );
    assert.match(leadsManagerSource, /trackingViewedAt/);
    assert.match(leadsManagerSource, /formatThaiDateTime\(viewedAt\)/);
    assert.match(leadsManagerSource, /สร้างใบเสนอราคาเพื่อเปิดใช้งานลิงก์ติดตามงาน/);
  });

  it("shares the standard customer message through LINE", () => {
    assert.match(
      leadsManagerSource,
      /สวัสดีครับ สามารถติดตามสถานะงานสั่งทำเคาน์เตอร์หินสังเคราะห์ของคุณได้ตลอด 24 ชม\. ที่ลิงก์นี้ครับ:/,
    );
    assert.match(leadsManagerSource, /https:\/\/line\.me\/R\/msg\/text\/\?\$\{encodeURIComponent\(message\)\}/);
    assert.match(
      leadsManagerSource,
      /data-testid=\{`button-share-track-line-\$\{lead\.id\}`\}/,
    );
  });

  it("copies the tracking link and gives a Thai success notification", () => {
    assert.match(
      leadsManagerSource,
      /data-testid=\{`button-copy-track-link-\$\{lead\.id\}`\}/,
    );
    assert.match(
      leadsManagerSource,
      /navigator\.clipboard\.writeText\(customerTrackingUrl\(publicQuoteToken\)\)/,
    );
    assert.match(leadsManagerSource, /คัดลอกลิงก์ติดตามงานแล้ว/);
  });
});