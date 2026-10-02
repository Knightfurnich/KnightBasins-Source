/**
 * Static source inspection for the Material Comparison Matrix (StonePage,
 * /stone route). App.tsx is far too large to render in this test runner, so
 * the wiring into StonePage is asserted against the real source text, same
 * pattern as the other GEO static-inspection tests in this suite.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const componentSource = readFileSync(
  new URL("../src/components/StoneComparisonTable.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

const REQUIRED_FEATURES = [
  "มีหลายสีสันให้เลือกใช้งาน",
  "ไม่ลามไฟ",
  "ไม่ซึมน้ำ ไม่เป็นแหล่งเพาะพันธุ์เชื้อโรค",
  "ทนสารเคมีได้",
  "ดัดโค้งเป็นรูปทรงต่างๆ ได้",
  "สีสันสวยงาม ไม่เปลี่ยนแปลง (Color Stability)",
  "ไม่เป็นพิษหรือปล่อยสารพิษออกมา (Toxicity)",
  "สามารถนำกลับมาใช้ใหม่ได้ (Recycle)",
  "สามารถใช้กับงานตกแต่งภายนอกได้",
];

const REQUIRED_STANDARDS = ["UBC CLASS 1", "ASTM G22", "NEMA LD3", "LC 50"];

describe("StoneComparisonTable", () => {
  it("renders all 9 required comparison features", () => {
    for (const feature of REQUIRED_FEATURES) {
      assert.ok(componentSource.includes(feature), `missing feature row: ${feature}`);
    }
  });

  it("carries every required standard code", () => {
    for (const standard of REQUIRED_STANDARDS) {
      assert.ok(componentSource.includes(standard), `missing standard: ${standard}`);
    }
  });

  it("covers all 4 comparison columns", () => {
    assert.match(componentSource, /คุณสมบัติวัสดุ/);
    assert.match(componentSource, /หินสังเคราะห์อะคริลิก 100% Staron และ Zen Stone \(Knight Furnich\)/);
    assert.match(componentSource, /หินสังเคราะห์ Modified/);
    assert.match(componentSource, /หินธรรมชาติ \(แกรนิต\/หินอ่อน\)/);
  });

  it("uses semantic table markup via the shared Table primitives", () => {
    assert.match(componentSource, /<Table>/);
    assert.match(componentSource, /<TableHeader>/);
    assert.match(componentSource, /<TableBody>/);
    assert.match(componentSource, /<TableRow/);
    assert.match(componentSource, /<TableHead>/);
    assert.match(componentSource, /<TableCell/);
  });

  it("exposes exactly 9 feature rows (COMPARISON_ROWS)", () => {
    const matches = componentSource.match(/feature: "/g) ?? [];
    assert.equal(matches.length, 9);
  });
});

describe("StonePage wiring (static source inspection)", () => {
  it("imports and mounts StoneComparisonTable with the required test id", () => {
    assert.match(appSource, /import \{ StoneComparisonTable \} from "@\/components\/StoneComparisonTable";/);
    assert.match(appSource, /<StoneComparisonTable \/>/);
  });

  it("is mounted at the end of StonePage's page-wrap, right after the source-note", () => {
    assert.match(
      appSource,
      /source-note">.*ราคายังไม่รวม VAT 7%<\/div><StoneComparisonTable \/><\/div>;/,
    );
  });
});
