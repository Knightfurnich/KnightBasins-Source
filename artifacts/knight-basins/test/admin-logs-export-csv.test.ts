import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import ts from "typescript";

const logsManager = readFileSync(new URL("../src/admin/AdminLogsManager.tsx", import.meta.url), "utf8");

function loadExportHelpers() {
  const start = logsManager.indexOf("export type AuditInsightCategoryFilter =");
  const end = logsManager.indexOf("\nexport const AUDIT_STATUS_FILTERS", start);
  assert.ok(start >= 0 && end > start, "CSV and category helpers should be grouped in the admin logs manager");

  const helperSource = logsManager.slice(start, end);
  const transpiled = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", transpiled)(module, module.exports);
  return module.exports as {
    AUDIT_PAIN_POINT_CSV_HEADERS: string[];
    buildAuditPainPointsCsv: (points: Array<{
      key: string;
      description: string;
      category: "ux" | "slip" | "form";
      count: number;
      recommendation: string;
    }>, totalCustomerIssues: number) => string;
    filterAuditPainPointsByCategory: <T extends { category: "ux" | "slip" | "form" }>(
      points: T[],
      category: "all" | "ux" | "payment" | "form",
    ) => T[];
    filterAuditTrackersByCategory: <T extends { category: "ux" | "payment" | "form" }>(
      trackers: T[],
      category: "all" | "ux" | "payment" | "form",
    ) => T[];
    formatBangkokDateStamp: (date: Date) => string;
  };
}

describe("Admin Logs CSV export and category filters", () => {
  it("always starts the CSV with a UTF-8 BOM and writes the required columns", () => {
    const helpers = loadExportHelpers();
    const csv = helpers.buildAuditPainPointsCsv([], 0);

    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.slice(1), [
      "ลำดับ",
      "รหัสปัญหา (Error Code)",
      "ชื่อปัญหาภาษาไทย",
      "หมวดหมู่ (UX/การเงิน/ฟอร์ม)",
      "จำนวนครั้งที่พบ",
      "% สัดส่วน",
      "คำแนะนำการปรับปรุง",
    ].join(","));
  });

  it("uses RFC 4180 escaping and calculates each share against customer issues", () => {
    const helpers = loadExportHelpers();
    const csv = helpers.buildAuditPainPointsCsv([{
      key: "EDGE, CLEARANCE",
      description: "ขอบ \"ชิด\"\nขนาด",
      category: "ux",
      count: 2,
      recommendation: "วัดซ้ำ, \"ก่อนผลิต\"",
    }], 8);

    assert.equal(
      csv,
      "\uFEFFลำดับ,รหัสปัญหา (Error Code),ชื่อปัญหาภาษาไทย,หมวดหมู่ (UX/การเงิน/ฟอร์ม),จำนวนครั้งที่พบ,% สัดส่วน,คำแนะนำการปรับปรุง\r\n1,\"EDGE, CLEARANCE\",\"ขอบ \"\"ชิด\"\"\r\nขนาด\",UX,2,25.0%,\"วัดซ้ำ, \"\"ก่อนผลิต\"\"\"",
    );
    assert.equal(helpers.buildAuditPainPointsCsv([{
      key: "FORM_EMPTY",
      description: "ข้อมูลไม่ครบ",
      category: "form",
      count: 3,
      recommendation: "ตรวจสอบ",
    }], 0).endsWith(",0.0%,ตรวจสอบ"), true);
  });

  it("filters pain points and Action Tracker items by UX, payment, and form categories", () => {
    const helpers = loadExportHelpers();
    const painPoints = [
      { key: "EDGE", category: "ux" as const },
      { key: "SLIP", category: "slip" as const },
      { key: "FORM", category: "form" as const },
    ];
    const trackers = [
      { id: 1, category: "ux" as const },
      { id: 2, category: "payment" as const },
      { id: 3, category: "form" as const },
    ];

    assert.deepEqual(helpers.filterAuditPainPointsByCategory(painPoints, "all"), painPoints);
    assert.deepEqual(helpers.filterAuditPainPointsByCategory(painPoints, "payment"), [painPoints[1]]);
    assert.deepEqual(helpers.filterAuditPainPointsByCategory(painPoints, "ux"), [painPoints[0]]);
    assert.deepEqual(helpers.filterAuditPainPointsByCategory(painPoints, "form"), [painPoints[2]]);
    assert.deepEqual(helpers.filterAuditTrackersByCategory(trackers, "payment"), [trackers[1]]);
    assert.deepEqual(helpers.filterAuditTrackersByCategory(trackers, "form"), [trackers[2]]);
  });

  it("wires the category buttons to both live lists and names exports with the selected range and Bangkok date", () => {
    assert.match(logsManager, /data-testid="audit-insights-category-filter"/);
    assert.match(logsManager, /onClick=\{\(\) => setInsightsCategoryFilter\(option\.value\)\}/);
    assert.match(logsManager, /filterAuditPainPointsByCategory\(insightsQuery\.data\?\.painPoints \?\? \[\], insightsCategoryFilter\)/);
    assert.match(logsManager, /filterAuditTrackersByCategory\(trackersQuery\.data\?\.items \?\? \[\], insightsCategoryFilter\)/);
    assert.match(logsManager, /painPoints\.slice\(0, 5\)/);
    assert.match(logsManager, /filteredTrackers\.filter\(\(item\) => item\.status === statusOption\.value\)/);
    assert.match(logsManager, /data-testid="button-audit-insights-export-csv"/);
    assert.match(logsManager, /anchor\.download = `knight-customer-pain-points-\$\{insightsRange\}-\$\{formatBangkokDateStamp\(new Date\(\)\)\}\.csv`/);
    assert.equal(loadExportHelpers().formatBangkokDateStamp(new Date("2026-10-02T18:30:00.000Z")), "2026-10-03");
  });
});