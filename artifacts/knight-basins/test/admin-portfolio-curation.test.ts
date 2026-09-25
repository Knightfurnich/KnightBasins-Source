import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * WHY THIS FILE SPAWNS A SUBPROCESS
 *
 * Same constraint as admin-portfolio-gallery.test.ts (see the long comment
 * there): node's native `--experimental-strip-types` test runner cannot
 * import .tsx files at all. filterPortfolioItemsByVisibility and
 * toggleVisibility are pure, non-JSX functions, but this task's SCOPE
 * doesn't allow a sibling .ts helper module, so they stay exported from
 * PortfolioGalleryPage.tsx itself, and this file transpiles+runs the REAL
 * file via `tsx`, an already-installed devDependency of this monorepo's
 * own `scripts` workspace, and calls those exports directly.
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
  visible?: boolean;
};

const FIXTURE_ITEMS: PortfolioItemFixture[] = [
  { id: "bathroom_001", category: "bathroom", categoryName: "งานห้องน้ำ", icon: "🛁", url: "/x/1.webp", width: 1600, height: 1200, title: "t1", visible: true },
  { id: "kitchen_007", category: "kitchen", categoryName: "งานครัว", icon: "🍳", url: "/x/2.webp", width: 1600, height: 1200, title: "t2", visible: false },
  { id: "counter_042", category: "counter", categoryName: "เคาน์เตอร์", icon: "🏢", url: "/x/3.webp", width: 1600, height: 1200, title: "t3" },
];

const HARNESS_SCRIPT = `
const mod = await import(${JSON.stringify(componentUrl)});
const { filterPortfolioItemsByVisibility, toggleVisibility, isPortfolioItemVisible } = mod;

const items = ${JSON.stringify(FIXTURE_ITEMS)};

const result = {
  filterAll: filterPortfolioItemsByVisibility(items, "all").map((item) => item.id),
  filterVisible: filterPortfolioItemsByVisibility(items, "visible").map((item) => item.id),
  filterHidden: filterPortfolioItemsByVisibility(items, "hidden").map((item) => item.id),
  toggleFromVisible: toggleVisibility(true),
  toggleFromHidden: toggleVisibility(false),
  isVisibleWhenTrue: isPortfolioItemVisible(items[0]),
  isVisibleWhenFalse: isPortfolioItemVisible(items[1]),
  isVisibleWhenAbsent: isPortfolioItemVisible(items[2]),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  filterAll: string[];
  filterVisible: string[];
  filterHidden: string[];
  toggleFromVisible: boolean;
  toggleFromHidden: boolean;
  isVisibleWhenTrue: boolean;
  isVisibleWhenFalse: boolean;
  isVisibleWhenAbsent: boolean;
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

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".portfolio-curation-test-"));
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

describe("filterPortfolioItemsByVisibility", () => {
  it('"all" returns every item unchanged', () => {
    assert.deepEqual(harness.filterAll, ["bathroom_001", "kitchen_007", "counter_042"]);
  });

  it('"visible" returns only items that are not explicitly hidden (visible: false)', () => {
    assert.deepEqual(harness.filterVisible, ["bathroom_001", "counter_042"]);
  });

  it('"hidden" returns only items explicitly marked visible: false', () => {
    assert.deepEqual(harness.filterHidden, ["kitchen_007"]);
  });
});

describe("isPortfolioItemVisible", () => {
  it("is true when visible: true", () => {
    assert.equal(harness.isVisibleWhenTrue, true);
  });

  it("is false when visible: false", () => {
    assert.equal(harness.isVisibleWhenFalse, false);
  });

  it("defaults to true when the visible field is absent (older cached responses)", () => {
    assert.equal(harness.isVisibleWhenAbsent, true);
  });
});

describe("toggleVisibility", () => {
  it("flips true to false", () => {
    assert.equal(harness.toggleFromVisible, false);
  });

  it("flips false to true", () => {
    assert.equal(harness.toggleFromHidden, true);
  });
});
