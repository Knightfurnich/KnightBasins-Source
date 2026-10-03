import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const routeMetaSource = readFileSync(new URL("../src/components/RouteMeta.logic.ts", import.meta.url), "utf8");

describe("stone page reframing", () => {
  it("presents the worktop and custom-cut hero copy", () => {
    assert.ok(appSource.includes("ท็อปครัว &amp; เคาน์เตอร์หินสังเคราะห์"));
    assert.ok(appSource.includes("สั่งตัดตามพื้นที่ของคุณ"));
    assert.ok(appSource.includes(
      "สั่งทำท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์แท้ 100% ไร้รอยต่อ พร้อมบริการวัดหน้างานและติดตั้ง หรือเลือกซื้อแผ่นมาตรฐานสำหรับช่างและโรงงาน",
    ));
  });

  it("keeps each order mode test id and shows the correct offer details", () => {
    assert.match(
      appSource,
      /data-testid="button-stone-installed"><span>สั่งทำท็อปครัว \/ เคาน์เตอร์ \(รวมติดตั้ง\)<\/span><small>ราคาต่อ ตร\.ม\. พร้อมติดตั้งและวัดหน้างาน<\/small>/,
    );
    assert.match(
      appSource,
      /data-testid="button-stone-whole-sheet"><span>ซื้อแผ่นหินมาตรฐาน \(สำหรับช่าง\/โรงงาน\)<\/span><small>ราคาขายส่งต่อแผ่น ขนาด 0\.76 × 3\.60 ม\.<\/small>/,
    );
  });

  it("shows the three synthetic-stone worktop highlights below color selection", () => {
    const stonePageStart = appSource.indexOf("function StonePage");
    const colorSectionStart = appSource.indexOf("SURFACE TONE", stonePageStart);
    const highlightStart = appSource.indexOf('data-testid="stone-worktop-highlights"', colorSectionStart);
    const nextStepIndex = appSource.indexOf('<span className="step">03</span>', highlightStart);
    const nextStepStart = appSource.lastIndexOf('<div className="section-heading">', nextStepIndex);
    const highlightEnd = appSource.indexOf("</section>", highlightStart);
    const highlights = appSource.slice(highlightStart, appSource.indexOf("</section>", highlightStart));
    assert.ok(colorSectionStart >= 0 && highlightStart > colorSectionStart);
    assert.ok(nextStepIndex > highlightStart && nextStepStart > highlightStart && highlightEnd < nextStepStart, "Expected the banner between color selection and the next configuration step");
    assert.ok(highlights, "Expected the worktop highlights banner");
    for (const text of [
      "Food Grade",
      "สัมผัสอาหารปลอดภัย",
      "ไร้รอยต่อ ไม่ซึมคราบ",
      "ขัดเคลือบใหม่ได้ตลอดอายุการใช้งาน",
    ]) {
      assert.ok(highlights.includes(text), `Missing worktop benefit: ${text}`);
    }
  });

  it("uses worktop-specific SEO metadata for /stone", () => {
    const stoneMeta = routeMetaSource.match(/"\/stone": \{([\s\S]*?)\n  \},/)?.[1] ?? "";
    assert.ok(stoneMeta, "Expected /stone route metadata");
    assert.ok(stoneMeta.includes("ท็อปครัว & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ | Knight Furnich"));
    assert.ok(stoneMeta.includes(
      "สั่งทำท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์แท้ ไร้รอยต่อ หรือซื้อแผ่นดิบมาตรฐาน คำนวณราคาตามขนาดจริง พร้อมบริการติดตั้ง",
    ));
  });
});