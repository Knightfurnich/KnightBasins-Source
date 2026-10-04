// v2.2.0 history is merged into the latest v2.2.1 card; older tags remain accurate.
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

describe("the newest release entry (v2.2.1)", () => {
  it("is first in the timeline, ahead of v2.1.0 and v2.0.0", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions.slice(0, 4), ["v2.2.1", "v2.1.0", "v2.0.0", "v1.2.0"]);
  });

  it("is the only entry badged as the latest release", () => {
    const latestBadges = updatesSource.match(/— รุ่นล่าสุด/g) ?? [];
    assert.equal(latestBadges.length, 1, `expected exactly one "รุ่นล่าสุด" badge, found ${latestBadges.length}`);
    assert.match(updatesSource, /version: "v2\.2\.1",\s*badge: "[^"]+— รุ่นล่าสุด"/);
  });
});
describe("the v2.2.0 history merged into v2.2.1", () => {
  it("is folded into v2.2.1 rather than shown as a separate tag", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions.slice(0, 3), ["v2.2.1", "v2.1.0", "v2.0.0"]);
    assert.ok(!versions.includes("v2.2.0"), "v2.2.0 must not have a separate card");
  });

  it("records the sequential numbering and support-safety highlights", () => {
    const block = releaseBlock("v2.2.1", "v2.1.0");
    for (const expected of [
      "เลขใบเสนอราคาเรียงลำดับ",
      "QT-YYYYMM-TYPE-NNNN",
      "5 ครั้งต่อ IP/10 นาที",
      "จำกัดความพยายามผิดพลาด",
      "5 ครั้งต่อเลขหรือเบอร์โทร/ชั่วโมง",
      "45 วัน",
      "ราคาจริงก่อนรับสลิป",
    ]) {
      assert.ok(block.includes(expected), `missing v2.2.0 highlight: ${expected}`);
    }
  });

  it("does not claim the support slip page prevents guessing: it limits failed attempts (the lock never refuses correct details)", () => {
    const block = releaseBlock("v2.2.1", "v2.1.0");
    assert.ok(!block.includes("ป้องกันการสุ่ม"), "the v2.2.0 entry must not say it prevents guessing");
    assert.ok(block.includes("จำกัดความพยายามผิดพลาด"));
  });


});
describe("the v2.1.0 release entry", () => {
  it("remains directly below v2.2.1 and ahead of v2.0.0", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions.slice(1, 3), ["v2.1.0", "v2.0.0"]);
  });

  it("records the required highlights", () => {
    const block = releaseBlock("v2.1.0", "v2.0.0");
    for (const expected of [
      "ตรวจราคาโดยเซิร์ฟเวอร์",
      "PRICE_VERIFICATION_FAILED",
      "สิทธิ์ส่วนลดพนักงาน",
      "leads:edit",
      "จำกัดคำขอและล็อกอิน LINE",
      "Open Redirect",
      "กรองคำขอใบเสนอราคา",
      "ปกป้องแบบร่าง Studio",
      "แก้ราคาขอบเปิดและเลขซ้ำ",
    ]) {
      assert.ok(block.includes(expected), `missing v2.1.0 highlight: ${expected}`);
    }
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
      "วางตำแหน่งอ่าง 7 ระดับ",
      "ระยะปลอดภัย 100 มม. รอบทุกด้าน",
      "ลดขนาดภาพสินค้า",
      "แยกเสาตั้งพื้น",
      "KF029/030",
      "อายุลิงก์ใบเสนอราคา",
      "ติดตั้งระบบอัตโนมัติ",
      "ปรับฐานข้อมูลบน VPS อัตโนมัติ",
      "แจ้งเตือนเหตุฉุกเฉิน",
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
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v2\.2\)<\/Link>/,
    );
  });
});
