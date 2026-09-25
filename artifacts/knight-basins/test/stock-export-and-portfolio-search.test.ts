import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * WHY THIS FILE SPAWNS A SUBPROCESS
 *
 * Same constraint as admin-portfolio-gallery.test.ts and
 * admin-portfolio-curation.test.ts (see the long comment in the former):
 * node's native `--experimental-strip-types` test runner cannot import
 * .tsx files at all. buildStockCsv (new, in StockInventoryPage.tsx) and
 * filterPortfolioItems (already shipped, in PortfolioGalleryPage.tsx --
 * read only here, not modified by this task) are both pure, non-JSX
 * functions, so this file transpiles+runs the real .tsx files via `tsx`,
 * an already-installed devDependency of this monorepo's own `scripts`
 * workspace, and calls those exports directly.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const stockComponentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/StockInventoryPage.tsx")).href;
const portfolioComponentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/PortfolioGalleryPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const FIXTURE_STOCK = {
  updatedAt: "2026-09-25T13:00:00.000Z",
  staron: {
    title: "สต๊อคแผ่นหินสังเคราะห์ Staron",
    total: 2,
    inStockCount: 1,
    items: [
      { no: 1, name: "AA 625 (Aspen Alder)", qty: 21, scrap: "", lots: ["L001"], note: "" },
      // colorName ("Bianco, White") has a comma; note has an embedded quote --
      // both must be individually escaped per RFC 4180.
      { no: 2, name: "BW 010 (Bianco, White)", qty: 0, scrap: "", lots: [], note: 'ด่วน "เร่งรัด"' },
    ],
  },
  zen: {
    title: "สต๊อคแผ่นหินสังเคราะห์ Zen Stone",
    total: 1,
    inStockCount: 1,
    items: [
      // note has an embedded newline -- an RFC 4180 quoted field may
      // legally contain one.
      { no: 1, name: "AP 100 (Apex)", qty: 3, scrap: "", lots: [], note: "บรรทัดหนึ่ง\nบรรทัดสอง" },
    ],
  },
};

const FIXTURE_PORTFOLIO_ITEMS = [
  { id: "bathroom_001", category: "bathroom", categoryName: "งานห้องน้ำ", icon: "🛁", url: "/x/1.webp", width: 1600, height: 1200, title: "งานห้องน้ำ คอนโดสุขุมวิท" },
  { id: "kitchen_007", category: "kitchen", categoryName: "งานครัวและไอส์แลนด์", icon: "🍳", url: "/x/2.webp", width: 1600, height: 1200, title: "งานครัวไอส์แลนด์" },
  { id: "counter_042", category: "counter", categoryName: "เคาน์เตอร์ต้อนรับ/ธุรกิจ", icon: "🏢", url: "/x/3.webp", width: 1600, height: 1200, title: "เคาน์เตอร์คลินิกทันตกรรม" },
];

const HARNESS_SCRIPT = `
const stockMod = await import(${JSON.stringify(stockComponentUrl)});
const portfolioMod = await import(${JSON.stringify(portfolioComponentUrl)});

const { buildStockCsv } = stockMod;
const { filterPortfolioItems } = portfolioMod;

const result = {
  csv: buildStockCsv(${JSON.stringify(FIXTURE_STOCK)}),
  searchByThaiCategoryKeyword: filterPortfolioItems(${JSON.stringify(FIXTURE_PORTFOLIO_ITEMS)}, "ไอส์แลนด์").map((item) => item.id),
  searchByTitleKeyword: filterPortfolioItems(${JSON.stringify(FIXTURE_PORTFOLIO_ITEMS)}, "คลินิก").map((item) => item.id),
  searchByIdLikeSlug: filterPortfolioItems(${JSON.stringify(FIXTURE_PORTFOLIO_ITEMS)}, "bathroom").map((item) => item.id),
  searchNoMatch: filterPortfolioItems(${JSON.stringify(FIXTURE_PORTFOLIO_ITEMS)}, "ไม่มีคำนี้แน่นอน").map((item) => item.id),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  csv: string;
  searchByThaiCategoryKeyword: string[];
  searchByTitleKeyword: string[];
  searchByIdLikeSlug: string[];
  searchNoMatch: string[];
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(
      `Expected tsx's loader at ${tsxLoaderPath} (a devDependency of the scripts workspace, pinned in pnpm-workspace.yaml's catalog) -- ` +
      `run "pnpm install" at the repo root. See the comment at the top of this file for why this test needs it.`,
    );
  }
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".stock-export-portfolio-search-test-"));
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

describe("buildStockCsv", () => {
  it("starts with a UTF-8 BOM", () => {
    assert.equal(harness.csv.charCodeAt(0), 0xFEFF);
  });

  it("has the exact column headers in order", () => {
    const firstLine = harness.csv.replace(/^﻿/, "").split("\r\n")[0];
    assert.equal(firstLine, "ยี่ห้อ,รหัสสี,ชื่อสี,ขนาดแผ่น,ความหนา,จำนวนคงเหลือ,หมายเหตุ,วันที่อัปเดต");
  });

  it("splits a code (name) row correctly and leaves sheet size/thickness blank", () => {
    assert.ok(harness.csv.includes("Staron,AA 625,Aspen Alder,,,21,,2026-09-25T13:00:00.000Z"));
  });

  it("quotes a color name containing a comma", () => {
    assert.ok(harness.csv.includes('Staron,BW 010,"Bianco, White",,,0,'));
  });

  it("doubles an embedded quote inside a quoted field", () => {
    assert.ok(harness.csv.includes('"ด่วน ""เร่งรัด"""'));
  });

  it("preserves an embedded newline inside a quoted field (legal per RFC 4180)", () => {
    assert.ok(harness.csv.includes('"บรรทัดหนึ่ง\nบรรทัดสอง"'));
  });

  it("includes every item from both brands", () => {
    assert.ok(harness.csv.includes("Staron,AA 625,"));
    assert.ok(harness.csv.includes("Staron,BW 010,"));
    assert.ok(harness.csv.includes("Zen Stone,AP 100,Apex,,,3,"));
  });
});

describe("filterPortfolioItems (existing portfolio search, unchanged by this task)", () => {
  it("matches a Thai keyword found in the category name", () => {
    assert.deepEqual(harness.searchByThaiCategoryKeyword, ["kitchen_007"]);
  });

  it("matches a keyword found only in an item's own title", () => {
    assert.deepEqual(harness.searchByTitleKeyword, ["counter_042"]);
  });

  it("matches the category slug itself", () => {
    assert.deepEqual(harness.searchByIdLikeSlug, ["bathroom_001"]);
  });

  it("returns nothing when no item matches", () => {
    assert.deepEqual(harness.searchNoMatch, []);
  });
});
