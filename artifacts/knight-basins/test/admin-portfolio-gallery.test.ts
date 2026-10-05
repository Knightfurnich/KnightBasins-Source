import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * WHY THIS FILE SPAWNS A SUBPROCESS
 *
 * Same constraint as admin-site-photos-ui.test.ts and
 * admin-leads-site-photos.test.ts (see the long comment in the former):
 * node's native `--experimental-strip-types` test runner cannot import
 * .tsx files at all. toAbsolutePhotoUrl, portfolioCustomerMessage, and
 * filterPortfolioItems are pure, non-JSX functions, but this task's SCOPE
 * is only AdminApp.tsx, PortfolioGalleryPage.tsx, and this test file -- no
 * sibling .ts helper module is allowed -- so they stay exported from the
 * .tsx file itself, and this file transpiles+runs the REAL
 * PortfolioGalleryPage.tsx (TS types stripped, JSX compiled to the
 * automatic react/jsx-runtime, matching this project's actual Vite build)
 * via `tsx`, an already-installed devDependency of this monorepo's own
 * `scripts` workspace, and calls those exports directly.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/PortfolioGalleryPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

type PortfolioItemFixture = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
};

const FIXTURE_ITEMS: PortfolioItemFixture[] = [
  { id: "bathroom_001", category: "bathroom", categoryName: "งานห้องน้ำ", icon: "🛁", url: "/api/uploads/portfolio/bathroom/bathroom_001.webp", width: 1600, height: 1200, title: "งานห้องน้ำ Knight Furnich" },
  { id: "kitchen_007", category: "kitchen", categoryName: "งานครัวและไอส์แลนด์", icon: "🍳", url: "/api/uploads/portfolio/kitchen/kitchen_007.webp", width: 1600, height: 1200, title: "งานครัวไอส์แลนด์ คอนโดสุขุมวิท" },
  { id: "counter_042", category: "counter", categoryName: "เคาน์เตอร์ต้อนรับ/ธุรกิจ", icon: "🏢", url: "https://cdn.example.com/already-absolute/counter_042.webp", width: 1600, height: 1200, title: "เคาน์เตอร์คลินิกทันตกรรม" },
];

const HARNESS_SCRIPT = `
const mod = await import(${JSON.stringify(componentUrl)});
const { toAbsolutePhotoUrl, portfolioCustomerMessage, filterPortfolioItems } = mod;

const result = {
  absoluteFromRelative: toAbsolutePhotoUrl("/api/uploads/portfolio/bathroom/bathroom_001.webp", "https://knightbasins.com"),
  absoluteFromRelativeTrailingSlashOrigin: toAbsolutePhotoUrl("/api/uploads/portfolio/x.webp", "https://knightbasins.com/"),
  alreadyAbsoluteUnchanged: toAbsolutePhotoUrl("https://cdn.example.com/already-absolute/counter_042.webp", "https://knightbasins.com"),
  customerMessage: portfolioCustomerMessage("งานห้องน้ำ", "https://knightbasins.com/api/uploads/portfolio/bathroom/bathroom_001.webp"),
  filterByThaiCategoryKeyword: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "ไอส์แลนด์").map((item) => item.id),
  filterByTitleKeyword: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "คลินิก").map((item) => item.id),
  filterByCategorySlug: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "bathroom").map((item) => item.id),
  filterCaseInsensitive: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "ห้องน้ำ".toUpperCase()).map((item) => item.id),
  filterEmptyQueryReturnsAll: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "").map((item) => item.id),
  filterNoMatch: filterPortfolioItems(${JSON.stringify(FIXTURE_ITEMS)}, "ไม่มีคำนี้แน่นอน").map((item) => item.id),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  absoluteFromRelative: string;
  absoluteFromRelativeTrailingSlashOrigin: string;
  alreadyAbsoluteUnchanged: string;
  customerMessage: string;
  filterByThaiCategoryKeyword: string[];
  filterByTitleKeyword: string[];
  filterByCategorySlug: string[];
  filterCaseInsensitive: string[];
  filterEmptyQueryReturnsAll: string[];
  filterNoMatch: string[];
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

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".portfolio-gallery-test-"));
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

describe("toAbsolutePhotoUrl", () => {
  it("prefixes a relative URL with the given origin", () => {
    assert.equal(harness.absoluteFromRelative, "https://knightbasins.com/api/uploads/portfolio/bathroom/bathroom_001.webp");
  });

  it("does not produce a double slash when the origin has a trailing slash", () => {
    assert.equal(harness.absoluteFromRelativeTrailingSlashOrigin, "https://knightbasins.com/api/uploads/portfolio/x.webp");
  });

  it("leaves an already-absolute URL unchanged", () => {
    assert.equal(harness.alreadyAbsoluteUnchanged, "https://cdn.example.com/already-absolute/counter_042.webp");
  });
});

describe("portfolioCustomerMessage", () => {
  it("matches the exact format the work order specifies", () => {
    assert.equal(
      harness.customerMessage,
      "ภาพตัวอย่างผลงานงานห้องน้ำจริงจากโรงงาน Knight Furnich ครับ\nhttps://knightbasins.com/api/uploads/portfolio/bathroom/bathroom_001.webp",
    );
  });
});

describe("filterPortfolioItems", () => {
  it("matches a Thai keyword found in the category name", () => {
    assert.deepEqual(harness.filterByThaiCategoryKeyword, ["kitchen_007"]);
  });

  it("matches a keyword found only in an item's own title", () => {
    assert.deepEqual(harness.filterByTitleKeyword, ["counter_042"]);
  });

  it("matches the category slug itself", () => {
    assert.deepEqual(harness.filterByCategorySlug, ["bathroom_001"]);
  });

  it("matches case-insensitively", () => {
    assert.deepEqual(harness.filterCaseInsensitive, ["bathroom_001"]);
  });

  it("returns every item when the query is blank", () => {
    assert.deepEqual(harness.filterEmptyQueryReturnsAll, ["bathroom_001", "kitchen_007", "counter_042"]);
  });

  it("returns nothing when no item matches", () => {
    assert.deepEqual(harness.filterNoMatch, []);
  });
});
