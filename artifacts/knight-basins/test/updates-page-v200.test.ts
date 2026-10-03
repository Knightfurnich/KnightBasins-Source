// The newest entry on /updates (v2.1.0 as of this change) plus the corrections
// that keep the page honest about older tags: the v2.0.0 tag was cut before the
// server price guard shipped, so that claim must not sit under v2.0.0.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

/** The block of `UPDATE_RELEASES` for one version, up to the next entry. */
function releaseBlock(version: string, nextVersion: string): string {
  const escaped = version.replace(/\./g, "\\.");
  const nextEscaped = nextVersion.replace(/\./g, "\\.");
  return updatesSource.match(
    new RegExp(`version: "${escaped}",[\\s\\S]*?(?=\\n  },\\n  \\{\\n    version: "${nextEscaped}")`),
  )?.[0] ?? "";
}

describe("the newest release entry (v2.1.0)", () => {
  it("is first in the timeline, ahead of v2.0.0 and v1.2.0", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions.slice(0, 3), ["v2.1.0", "v2.0.0", "v1.2.0"]);
  });

  it("records the required highlights", () => {
    const block = releaseBlock("v2.1.0", "v2.0.0");
    for (const expected of [
      "Server Price Guard",
      "PRICE_VERIFICATION_FAILED",
      "Staff Discount Authorization",
      "leads:edit",
      "Rate Limit & LINE Login Hardening",
      "Open Redirect",
      "Lead Spam Guard",
      "Studio Draft Protection",
      "Open-Edge Price Fix & Unique Quote Numbers",
    ]) {
      assert.ok(block.includes(expected), `missing v2.1.0 highlight: ${expected}`);
    }
  });

  it("is the only entry badged as the latest release", () => {
    // Chai flagged this: three releases all carried "รุ่นล่าสุด", which makes the
    // badge meaningless. Exactly one entry may claim it.
    const latestBadges = updatesSource.match(/— รุ่นล่าสุด/g) ?? [];
    assert.equal(latestBadges.length, 1, `expected exactly one "รุ่นล่าสุด" badge, found ${latestBadges.length}`);
    assert.match(updatesSource, /version: "v2\.1\.0",\s*badge: "[^"]+— รุ่นล่าสุด"/);
  });

  it("quotes an image saving that was actually measured, not a multiplier", () => {
    // The page used to claim "โหลดเร็วขึ้น 10 เท่า" with nothing behind it.
    assert.ok(!updatesSource.includes("10 เท่า"), "/updates must not claim an unmeasured 10x speed-up");
    assert.match(updatesSource, /88\.4% \(13\.71 MB → 1\.60 MB\)/);
  });
});

describe("the v2.0.0 entry stays accurate about its own tag", () => {
  it("keeps its own highlights, without the price guard it did not contain", () => {
    const block = releaseBlock("v2.0.0", "v1.2.0");
    for (const expected of [
      "Smart 7-Level Positioning",
      "รักษาระยะปลอดภัย 100 มม. ทุกด้าน",
      "Asset WebP Optimization",
      "Freestanding Pillar Separation",
      "KF029/030",
      "Quote Link Lifetime Enforcement",
      "DevOps CI/CD",
      "Auto-Migration",
      "Proactive Emergency Alert",
    ]) {
      assert.ok(block.includes(expected), `missing v2.0.0 detail: ${expected}`);
    }
    // The tag `v2.0.0` (8671edb) predates Job 226, so this must not be claimed there.
    assert.ok(
      !block.includes("คำนวณราคาจริงบนเซิร์ฟเวอร์"),
      "the price guard belongs to v2.1.0; tag v2.0.0 did not contain it",
    );
  });
});

describe("the footer link label", () => {
  it("matches the newest release", () => {
    assert.match(
      appSource,
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v2\.1\)<\/Link>/,
    );
  });
});
