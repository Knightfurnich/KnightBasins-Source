import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const pagePath = join(appRoot, "src/admin/AiCostCenterPage.tsx");
const pageUrl = pathToFileURL(pagePath).href;
const pageSource = readFileSync(pagePath, "utf8");
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const costResponse = {
  period: "30d",
  updatedAt: "2026-09-26T03:00:00.000Z",
  totalCostThb: 1532.5,
  totalRequests: 4,
  totalTokens: 392_500_000,
  services: [
    {
      id: "sales_bot",
      name: "น้องไนท์ (LINE Bot)",
      requests: 2,
      tokens: 1_000_000,
      costThb: 845.75,
      status: "active",
    },
    {
      id: "sketch_vision",
      name: "วิเคราะห์แบบร่าง",
      requests: 1,
      tokens: 999_999,
      costThb: 501.25,
      status: "active",
    },
    {
      id: "hermes_ops",
      name: "เฮอร์มีส",
      requests: 1,
      tokens: 390_500_001,
      costThb: 185.5,
      status: "no-data",
    },
  ],
  modelBreakdown: [
    { model: "claude-3-haiku", requests: 3, costThb: 1000.25 },
    { model: "gpt-4.1-mini", requests: 1, costThb: 532.25 },
  ],
  apiKey: "fixture-api-key-must-not-copy",
  providerToken: "fixture-provider-token-must-not-copy",
  customerEmail: "private-fixture@example.test",
};

const emptyResponse = {
  ...costResponse,
  totalCostThb: 0,
  totalRequests: 0,
  totalTokens: 0,
  services: [],
  modelBreakdown: [],
};

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const page = await import(${JSON.stringify(pageUrl)});
const data = ${JSON.stringify(costResponse)};
const emptyData = ${JSON.stringify(emptyResponse)};
const periods = ["today", "7d", "30d", "all"];
const summaries = Object.fromEntries(
  periods.map((period) => [period, page.buildAiCostSummaryMessage(data, period)]),
);
const emptySummary = page.buildAiCostSummaryMessage(emptyData, "today");
const copied = [];
const notifications = [];
const copySucceeded = await page.copyAiCostSummaryToClipboard(
  summaries["30d"],
  async (text) => { copied.push(text); },
  (options) => { notifications.push(options); },
);
const copyFailed = await page.copyAiCostSummaryToClipboard(
  summaries["30d"],
  async () => { throw new Error("clipboard unavailable"); },
  (options) => { notifications.push(options); },
);
const buttonMarkup = renderToStaticMarkup(
  createElement(page.AiCostCopySummaryButton, { onClick: () => {} }),
);
process.stdout.write(JSON.stringify({
  summaries,
  emptySummary,
  copied,
  notifications,
  copySucceeded,
  copyFailed,
  buttonMarkup,
}));
`;

type HarnessResult = {
  summaries: Record<string, string>;
  emptySummary: string;
  copied: string[];
  notifications: Array<{ description: string; variant?: string }>;
  copySucceeded: boolean;
  copyFailed: boolean;
  buttonMarkup: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }

  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(appRoot, "node_modules", ".admin-ai-cost-copy-summary-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: appRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("admin AI cost LINE summary copy", () => {
  it("renders the copy button beside the CSV action and wires the selected period", () => {
    assert.ok(harness.buttonMarkup.includes('data-testid="button-ai-cost-copy-summary"'));
    assert.ok(harness.buttonMarkup.includes("คัดลอกสรุปส่ง LINE"));

    const actionsStart = pageSource.indexOf('<div className="ai-cost-toolbar__actions">');
    const actionsEnd = pageSource.indexOf("</div>", actionsStart);
    const actionsSource = pageSource.slice(actionsStart, actionsEnd);
    assert.ok(actionsStart >= 0);
    assert.ok(actionsSource.includes('data-testid="button-ai-cost-export-csv"'));
    assert.match(actionsSource, /button-ai-cost-export-csv[\s\S]*?<AiCostCopySummaryButton/);
    assert.match(actionsSource, /onClick=\{handleCopySummary\}/);
    assert.match(pageSource, /buildAiCostSummaryMessage\(data, period\)/);
  });

  it("formats the selected period, totals, service breakdown, and model breakdown", () => {
    const currency = new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const count = new Intl.NumberFormat("th-TH");

    assert.deepEqual(harness.summaries["30d"]!.split("\n"), [
      "สรุปต้นทุน AI - Knight Basins",
      "ช่วงเวลา: 30 วัน",
      `ยอดรวม: ${currency.format(1532.5)}`,
      `จำนวนคำขอ: ${count.format(4)}`,
      "โทเค็นรวม: 392.5 ล้านโทเคน (392,500,000 โทเคน)",
      "",
      "แยกตามบริการ:",
      `• น้องไนท์ (LINE Bot): ${currency.format(845.75)} · ${count.format(2)} คำขอ · 1.0 ล้านโทเคน (1,000,000 โทเคน)`,
      `• วิเคราะห์แบบร่าง: ${currency.format(501.25)} · ${count.format(1)} คำขอ · 999,999 โทเคน`,
      `• เฮอร์มีส: ${currency.format(185.5)} · ${count.format(1)} คำขอ · 390.5 ล้านโทเคน (390,500,001 โทเคน)`,
      "",
      "แยกตามโมเดล:",
      `• claude-3-haiku: ${currency.format(1000.25)} · ${count.format(3)} คำขอ`,
      `• gpt-4.1-mini: ${currency.format(532.25)} · ${count.format(1)} คำขอ`,
    ]);
  });

  it("uses the currently selected period label for each supported range", () => {
    assert.ok(harness.summaries["today"]!.includes("ช่วงเวลา: วันนี้"));
    assert.ok(harness.summaries["7d"]!.includes("ช่วงเวลา: 7 วัน"));
    assert.ok(harness.summaries["30d"]!.includes("ช่วงเวลา: 30 วัน"));
    assert.ok(harness.summaries["all"]!.includes("ช่วงเวลา: ทั้งหมด"));
  });

  it("shows a clear empty state when services or models have no records", () => {
    assert.ok(harness.emptySummary.includes("ยังไม่มีข้อมูลบริการในช่วงเวลานี้"));
    assert.ok(harness.emptySummary.includes("ยังไม่มีข้อมูลโมเดลในช่วงเวลานี้"));
  });

  it("does not copy provider credentials or customer details", () => {
    assert.ok(!harness.summaries["30d"]!.includes("fixture-api-key-must-not-copy"));
    assert.ok(!harness.summaries["30d"]!.includes("fixture-provider-token-must-not-copy"));
    assert.ok(!harness.summaries["30d"]!.includes("private-fixture@example.test"));
  });

  it("copies the summary and shows the requested success toast", () => {
    assert.equal(harness.copySucceeded, true);
    assert.deepEqual(harness.copied, [harness.summaries["30d"]]);
    assert.deepEqual(harness.notifications[0], {
      description: "คัดลอกสรุปต้นทุน AI เรียบร้อยแล้ว",
    });
  });

  it("shows an error toast if writing to the clipboard fails", () => {
    assert.equal(harness.copyFailed, false);
    assert.deepEqual(harness.notifications[1], {
      description: "คัดลอกสรุปต้นทุน AI ไม่สำเร็จ",
      variant: "destructive",
    });
  });
});