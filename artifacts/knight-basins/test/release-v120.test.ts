import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("v1.2.0 release notes", () => {
  it("preserves v1.2.0 release metadata beneath the newer entries", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.equal(versions[0], "v2.2.1");
    assert.equal(versions[1], "v2.2.0");
    assert.equal(versions[2], "v2.1.0");
    assert.equal(versions[3], "v2.0.0");
    assert.equal(versions[4], "v1.2.0");
    assert.match(
      updatesSource,
      /version: "v1\.2\.0",\s*badge: "Stone Visual Experience & AI Matcher Suite",\s*date: "3 ตุลาคม 2569",\s*dateTime: "2026-10-03",\s*title: "ระบบภาพหิน 3 บทบาทเต็มรูปแบบ, Studio Slab Viewer และ AI Visual Matcher"/,
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

  it("updates the footer link label to v2.2", () => {
    assert.match(
      appSource,
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v2\.2\)<\/Link>/,
    );
  });
});