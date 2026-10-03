import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("updates changelog page", () => {
  it("declares the page root and release cards", () => {
    assert.match(updatesSource, /data-testid="page-updates"/);
    assert.match(updatesSource, /data-testid=\{`card-update-\$\{release\.version\}`\}/);
    assert.match(updatesSource, /version: "v2\.0\.0"/);
    assert.match(updatesSource, /version: "v1\.1\.0"/);
    assert.match(updatesSource, /version: "v1\.0\.0"/);
    assert.match(updatesSource, /version: "v0\.9\.0"/);
    assert.match(updatesSource, /version: "v0\.1\.0"/);
  });

  it("keeps every release in the timeline, newest first", () => {
    const versions = [...updatesSource.matchAll(/version: "(v[0-9.]+)"/g)].map((match) => match[1]);
    assert.deepEqual(versions, ["v2.1.0", "v2.0.0", "v1.2.0", "v1.1.0", "v1.0.0", "v0.9.0", "v0.1.0"]);
    assert.match(
      updatesSource,
      /version: "v1\.1\.0",\s*badge: "Logistics & Financial Safety Suite"/,
    );
  });

  it("contains the release names, dates, and milestone details from the work order", () => {
    for (const expected of [
      "v1.1.0",
      "Logistics & Financial Safety Suite",
      "รุ่นล่าสุด",
      "30 กันยายน 2569",
      "2026-09-30",
      "ระบบพิกัดหน้างานอัจฉริยะ และล็อกความปลอดภัยทางการเงิน",
      "Google Maps Smart Navigation",
      "ถอดรหัสพิกัดหน้างานอัตโนมัติจากทุกลิงก์ Maps พร้อมปุ่มนำทางแตะครั้งเดียวบนมือถือช่าง",
      "Smart Duplicate Detection",
      "ระบบตรวจจับประวัติลูกค้าและเบอร์โทรซ้ำซ้อนอัตโนมัติ พร้อมแสดงประวัติงานเดิมทันที",
      "Technician LINE Job Card",
      "ปุ่มสร้างการ์ดงานช่างส่งเข้า LINE คัดลอกสรุปงานพร้อมลิงก์แผนที่นำทางในคลิกเดียว",
      "Financial Safety Lock",
      "ถอดแบบกฎเหล็ก KRAKEN ล็อกความปลอดภัยปิดปุ่มลบงานที่มีสลิปการเงินผูกอยู่ 100%",
      "Official Launch",
      "27 ก.ย. 2569",
      "ระบบออกแบบเคาน์เตอร์และจัดการภาพหน้างานสมบูรณ์แบบ",
      "2D Studio & Smart Blueprint",
      "Google Cloud Vertex AI Singapore",
      "Latency 0.68 วินาที",
      "คลังภาพหน้างาน",
      "Backup Vault",
      "Studio & Edge Revolution",
      "กลางเดือนกันยายน 2569",
      "ขอบเปิด ⊗ · ขอบปิด ⊞",
      "≥ 100 มม.",
      "Portfolio Gallery",
      "360 ภาพ แยก 17 หมวดหมู่",
      "59 ภาพ",
      "Foundation",
      "สิงหาคม 2569",
      "Knight Basins Catalog & Pricing Calculator",
      "อ่างล้างหน้าสำเร็จรูป",
      "โดยไม่หักช่องเจาะ",
    ]) {
      assert.ok(updatesSource.includes(expected), `Missing changelog content: ${expected}`);
    }
  });

  it("declares LINE sharing and copy-link controls with the required test IDs", () => {
    assert.match(updatesSource, /data-testid="button-share-updates-line"/);
    assert.match(updatesSource, /data-testid="button-copy-updates-link"/);
    assert.match(updatesSource, /แชร์หน้านี้ลง LINE/);
    assert.match(updatesSource, /คัดลอกลิงก์/);
    assert.match(updatesSource, /https:\/\/line\.me\/R\/msg\/text\/\?/);
    assert.match(updatesSource, /window\.open\(lineShareUrl, "_blank", "noopener,noreferrer"\)/);
    assert.match(updatesSource, /navigator\.clipboard\.writeText\(value\)/);
    assert.match(updatesSource, /คัดลอกลิงก์หน้าบันทึกการอัปเดตแล้ว/);
    assert.match(updatesSource, /คัดลอกลิงก์หน้าบันทึกการอัปเดตไม่สำเร็จ/);
  });

  it("registers the updates route and the footer navigation link", () => {
    assert.match(appSource, /import UpdatesPage from "\.\/pages\/UpdatesPage"/);
    assert.match(appSource, /<Route path="\/updates" component=\{UpdatesPage\} \/>/);
    assert.match(
      appSource,
      /<Link href="\/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต \(v2\.1\)<\/Link>/,
    );
  });
});