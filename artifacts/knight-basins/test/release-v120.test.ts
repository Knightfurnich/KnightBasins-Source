import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("v1.2.0 release notes", () => {
  it("puts v1.2.0 first with the work-order release metadata", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions, ["v1.2.0", "v1.1.0", "v1.0.0", "v0.9.0", "v0.1.0"]);
    assert.match(
      updatesSource,
      /version: "v1\.2\.0",\s*badge: "Stone Visual Experience & AI Matcher Suite — รุ่นล่าสุด",\s*date: "3 ตุลาคม 2569",\s*dateTime: "2026-10-03",\s*title: "ระบบภาพหิน 3 บทบาทเต็มรูปแบบ, Studio Slab Viewer และ AI Visual Matcher"/,
    );
  });

  it("records all four v1.2.0 feature highlights", () => {
    const releaseBlock = updatesSource.match(/version: "v1\.2\.0",[\s\S]*?(?=\n  },\n  \{\n    version: "v1\.1\.0")/)?.[0] ?? "";
    for (const expected of [
      "Full Slab & Studio Viewer",
      "ดูภาพเต็มแผ่นบนหน้าร้าน /stone",
      "ดูลายแผ่นจริง",
      "Formal Quotation Stone Thumbnails",
      "ใบเสนอราคาทางการ (PDF/A4) ทั้งแบบ US และ OF",
      "Automated Studio Sales Alert",
      "Telegram",
      "AI Visual Matcher (Gemini)",
      "Vertex AI Gemini",
      "วิเคราะห์เฉพาะหินในแคตตาล็อก",
    ]) {
      assert.ok(releaseBlock.includes(expected), `Missing v1.2.0 release detail: ${expected}`);
    }
  });

  it("updates the footer link label to v1.2", () => {
    assert.match(
      appSource,
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v1\.2\)<\/Link>/,
    );
  });
});