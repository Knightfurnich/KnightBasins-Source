import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentPath = join(knightBasinsRoot, "src/admin/StockInventoryPage.tsx");
const componentUrl = pathToFileURL(componentPath).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const items = [
  { no: 1, name: "AA 625 (Aspen Alder)", qty: 16, scrap: "", lots: [], note: "" },
  { no: 2, name: "AP 100 (Aspen Pearl)", qty: 9, scrap: "เศษ 1 ชิ้น", lots: ["ST-101"], note: "" },
  { no: 3, name: "AB 001 (Alpine White)", qty: 0, scrap: "—", lots: [], note: "" },
  { no: 4, name: "CA 008 (Cloud Grey)", qty: 4, scrap: "0", lots: [], note: "" },
  { no: 5, name: "RM 200 (Warm Stone)", qty: 2, scrap: "เศษ 2 ชิ้น", lots: [], note: "" },
  { no: 6, name: "WH 100 (White)", qty: 1, scrap: "   ", lots: [], note: "" },
];

const stockResponse = {
  updatedAt: "2026-09-25T06:30:00.000Z",
  staron: { title: "Staron", total: items.length, inStockCount: 5, items },
  zen: { title: "Zen Stone", total: 0, inStockCount: 0, items: [] },
};

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const stock = await import(${JSON.stringify(componentUrl)});
const items = ${JSON.stringify(items)};
const summaryItems = [items[1], items[4]];
const summary = stock.buildStockSummaryMessage("Staron", summaryItems);
const copied = [];
const notifications = [];
const copySucceeded = await stock.copyStockSummaryToClipboard(
  summary,
  async (text) => { copied.push(text); },
  (options) => { notifications.push(options); },
);
const copyFailed = await stock.copyStockSummaryToClipboard(
  summary,
  async () => { throw new Error("clipboard unavailable"); },
  (options) => { notifications.push(options); },
);
const markup = renderToStaticMarkup(createElement(stock.StockInventoryView, {
  stock: ${JSON.stringify(stockResponse)},
  onRefresh: () => {},
}));
process.stdout.write(JSON.stringify({
  filterHasScrap: stock.filterStockItems(items, "", "has-scrap").map((item) => item.no),
  filterHasScrapAndSearch: stock.filterStockItems(items, "warm", "has-scrap").map((item) => item.no),
  summary,
  copied,
  notifications,
  copySucceeded,
  copyFailed,
  markup,
}));
`;

type HarnessResult = {
  filterHasScrap: number[];
  filterHasScrapAndSearch: number[];
  summary: string;
  copied: string[];
  notifications: Array<{ description: string; variant?: string }>;
  copySucceeded: boolean;
  copyFailed: boolean;
  markup: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }

  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".admin-stock-filter-scrap-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("admin stock scrap filter", () => {
  it("filters only rows with a non-empty, non-dash, non-zero scrap value", () => {
    assert.deepEqual(harness.filterHasScrap, [2, 5]);
  });

  it("combines the scrap filter with the current color search", () => {
    assert.deepEqual(harness.filterHasScrapAndSearch, [5]);
  });

  it("renders the requested scrap filter button", () => {
    assert.ok(harness.markup.includes('data-testid="button-stock-filter-has-scrap"'));
    assert.ok(harness.markup.includes("มีเศษหิน"));
  });
});

describe("admin stock quick LINE summary", () => {
  it("formats only the supplied visible rows with sheet quantity and scrap details", () => {
    assert.equal(
      harness.summary,
      [
        "สรุปสต็อก Staron",
        "แสดง 2 รายการ",
        "• AP 100 (Aspen Pearl) — 9 แผ่น · เศษ 1 ชิ้น",
        "• RM 200 (Warm Stone) — 2 แผ่น · เศษ 2 ชิ้น",
      ].join("\n"),
    );
  });

  it("renders the copy summary control next to the print control", () => {
    const printIndex = harness.markup.indexOf('data-testid="button-stock-print"');
    const copyIndex = harness.markup.indexOf('data-testid="button-stock-copy-summary"');
    assert.ok(printIndex >= 0);
    assert.ok(copyIndex > printIndex);
    assert.ok(harness.markup.includes("คัดลอกสรุปส่ง LINE"));
  });

  it("copies the summary and shows the requested success toast", () => {
    assert.equal(harness.copySucceeded, true);
    assert.equal(harness.copied.length, 1);
    assert.equal(harness.copied[0], harness.summary);
    assert.deepEqual(harness.notifications[0], {
      description: "คัดลอกข้อความสรุปสต็อกเรียบร้อยแล้ว",
    });
  });

  it("shows an error toast when the clipboard write fails", () => {
    assert.equal(harness.copyFailed, false);
    assert.deepEqual(harness.notifications[1], {
      description: "คัดลอกข้อความสรุปสต็อกไม่สำเร็จ",
      variant: "destructive",
    });
  });

  it("wires the copy button to the currently visible, filtered items", () => {
    const source = readFileSync(componentPath, "utf8");
    assert.match(source, /const handleCopySummary = \(\) => \{[\s\S]*?buildStockSummaryMessage\(brandLabel, visibleItems\)/);
    assert.match(source, /onClick=\{handleCopySummary\}[\s\S]*?data-testid="button-stock-copy-summary"/);
  });
});