import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("v2.0.0 release notes", () => {
  it("puts v2.0.0 first and records the required release highlights", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.equal(versions[0], "v2.0.0");
    assert.deepEqual(versions.slice(0, 3), ["v2.0.0", "v1.2.0", "v1.1.0"]);
    assert.match(
      updatesSource,
      /version: "v2\.0\.0",\s*badge: "[^"]+",\s*date: "3 ตุลาคม 2569",\s*dateTime: "2026-10-03",\s*title: "Release v2\.0\.0 — สถาปัตยกรรมความปลอดภัยขั้นสูง, 2D Studio Smart Positioning และ DevOps Auto-Migration"/,
    );

    const releaseBlock = updatesSource.match(
      /version: "v2\.0\.0",[\s\S]*?(?=\n  },\n  \{\n    version: "v1\.2\.0")/,
    )?.[0] ?? "";
    for (const expected of [
      "Smart 7-Level Positioning",
      "รักษาระยะปลอดภัย 100 มม. ทุกด้าน",
      "Asset WebP Optimization",
      "ลดขนาดลง 88.4% โหลดเร็วขึ้น 10 เท่า",
      "Financial Security & Price Guard",
      "คำนวณราคาจริงบนเซิร์ฟเวอร์",
      "Freestanding Pillar Separation",
      "KF029/030",
      "DevOps CI/CD",
      "Auto-Migration",
      "Proactive Emergency Alert",
      "Knight UX Digest ประจำสัปดาห์",
    ]) {
      assert.ok(releaseBlock.includes(expected), `Missing v2.0.0 release detail: ${expected}`);
    }
  });

  it("updates the footer link label to v2.0", () => {
    assert.match(
      appSource,
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v2\.0\)<\/Link>/,
    );
  });
});