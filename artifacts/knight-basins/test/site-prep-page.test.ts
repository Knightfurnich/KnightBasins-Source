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
 * admin-portfolio-gallery.test.ts (see the long comment in the former):
 * node's native `--experimental-strip-types` test runner cannot import
 * .tsx files at all. This file transpiles+runs the REAL SitePrepPage.tsx
 * (TS types stripped, JSX compiled to the automatic react/jsx-runtime,
 * matching this project's actual Vite build) via `tsx`, an
 * already-installed devDependency of this monorepo's own `scripts`
 * workspace, so these tests exercise the genuine shipped page -- both its
 * pure buildLineShareUrl function and a real server-side render (with
 * @tanstack/react-query's cache pre-seeded) -- not a hand-copied
 * duplicate.
 *
 * Two extra wrinkles specific to this page, on top of the usual JSX
 * transpile:
 *
 * 1. src/data/assets.ts reads `import.meta.env.BASE_URL` (a Vite-only
 *    global) at module load time, which crashes outside Vite. Since this
 *    task's SCOPE doesn't allow adding a mockable seam to that shared
 *    file, the override tsconfig below redirects the `@/data/assets`
 *    path alias to a tiny local stub (a plain string), while re-adding
 *    the normal `@/*` -> ./src/* mapping (and an explicit baseUrl,
 *    since a tsconfig that DEFINES `paths` anchors relative entries to
 *    its own directory unless baseUrl says otherwise) so every other
 *    `@/...` import keeps resolving into the real src/ tree.
 * 2. SitePrepPage uses wouter's <Link>, which reads the browser `location`
 *    global -- the harness script shims a minimal window/location/history
 *    before importing the page, same idea as jsdom but hand-rolled for
 *    just what wouter's static (non-interactive) render path touches.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/pages/SitePrepPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

type FixturePhoto = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
};

const FIXTURE_PHOTOS: FixturePhoto[] = [
  { id: "site_prep_001", category: "site_prep", categoryName: "การเตรียมหน้างานและการติดตั้ง", icon: "📐", url: "/api/uploads/portfolio/site_prep/site_prep_001.webp", width: 1600, height: 1200, title: "การเตรียมหน้างานและการติดตั้ง Knight Furnich" },
  { id: "site_prep_002", category: "site_prep", categoryName: "การเตรียมหน้างานและการติดตั้ง", icon: "📐", url: "/api/uploads/portfolio/site_prep/site_prep_002.webp", width: 1600, height: 1200, title: "การเตรียมหน้างานและการติดตั้ง Knight Furnich" },
];

const HARNESS_SCRIPT = `
globalThis.window = globalThis;
globalThis.location = { pathname: "/site-prep", search: "", hash: "", href: "https://knightbasins.srv1964473.hstgr.cloud/site-prep", origin: "https://knightbasins.srv1964473.hstgr.cloud" };
globalThis.history = { pushState: () => {}, replaceState: () => {}, state: null };
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.removeEventListener = globalThis.removeEventListener || (() => {});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mod = await import(${JSON.stringify(componentUrl)});
const { SitePrepPage, buildLineShareUrl, SITE_PREP_CHECKLIST } = mod;

function renderWithPhotos(photos) {
  const queryClient = new QueryClient();
  if (photos !== undefined) {
    queryClient.setQueryData(["/api/portfolio", "site_prep"], photos);
  }
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(SitePrepPage)));
}

const result = {
  lineShareUrl: buildLineShareUrl("https://knightbasins.srv1964473.hstgr.cloud/site-prep", "หัวข้อทดสอบ\\nบรรทัดสอง"),
  checklistCount: SITE_PREP_CHECKLIST.length,
  checklistTitles: SITE_PREP_CHECKLIST.map((item) => item.title),
  loadingHtml: renderWithPhotos(undefined),
  emptyHtml: renderWithPhotos([]),
  populatedHtml: renderWithPhotos(${JSON.stringify(FIXTURE_PHOTOS)}),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  lineShareUrl: string;
  checklistCount: number;
  checklistTitles: string[];
  loadingHtml: string;
  emptyHtml: string;
  populatedHtml: string;
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
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".site-prep-page-test-"));

  const stubAssetsPath = join(tmpDir, "stub-assets.ts").replace(/\\/g, "/");
  writeFileSync(stubAssetsPath, 'export const knightFurnichLogo = "/knight-furnich-logo.png";\n', "utf8");

  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: {
      jsx: "react-jsx",
      baseUrl: knightBasinsRoot.replace(/\\/g, "/"),
      paths: {
        "@/data/assets": [stubAssetsPath],
        "@/*": ["./src/*"],
      },
    },
  };

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

describe("buildLineShareUrl", () => {
  it("returns the LINE share intent URL with the title and page URL URL-encoded", () => {
    const expected = `https://line.me/R/msg/text/?${encodeURIComponent("หัวข้อทดสอบ\nบรรทัดสอง\nhttps://knightbasins.srv1964473.hstgr.cloud/site-prep")}`;
    assert.equal(harness.lineShareUrl, expected);
  });
});

describe("SITE_PREP_CHECKLIST", () => {
  it("has exactly the 5 items the work order specifies", () => {
    assert.equal(harness.checklistCount, 5);
    assert.deepEqual(harness.checklistTitles, [
      "ระบบน้ำดี-น้ำเสีย",
      "โครงสร้างรับน้ำหนัก",
      "ระยะเผื่อขอบและผนัง",
      "ระบบไฟฟ้าและปลั๊ก",
      "ทางเข้าหน้างานและลิฟต์",
    ]);
  });
});

describe("SitePrepPage render", () => {
  it("renders successfully and shows all 5 checklist cards", () => {
    assert.ok(harness.populatedHtml.length > 0);
    assert.ok(harness.populatedHtml.includes('data-testid="section-site-prep-checklist"'));
    for (let index = 0; index < 5; index++) {
      assert.ok(harness.populatedHtml.includes(`data-testid="trigger-site-prep-${index}"`), `missing checklist trigger ${index}`);
    }
    assert.ok(harness.populatedHtml.includes("💧"));
    assert.ok(harness.populatedHtml.includes("ระบบน้ำดี-น้ำเสีย"));
  });

  it("shows the hero heading and subtext", () => {
    assert.ok(harness.populatedHtml.includes("คู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์"));
    assert.ok(harness.populatedHtml.includes("ส่งลิงก์นี้ให้ผู้รับเหมาหรือช่างโครงการเปิดดูได้เลย ก่อนวันเข้าติดตั้งจริง"));
  });

  it("shows the copy-link and LINE share buttons", () => {
    assert.ok(harness.populatedHtml.includes('data-testid="button-site-prep-copy-link"'));
    assert.ok(harness.populatedHtml.includes('data-testid="link-site-prep-line-share"'));
  });

  it("shows the loading skeleton before the gallery has loaded", () => {
    assert.ok(harness.loadingHtml.includes('data-testid="status-site-prep-gallery-loading"'));
    assert.ok(!harness.loadingHtml.includes('data-testid="grid-site-prep-photos"'));
  });

  it("shows the empty state when there are no site-prep photos", () => {
    assert.ok(harness.emptyHtml.includes('data-testid="status-site-prep-gallery-empty"'));
  });

  it("renders a card with the real image src for every fetched photo", () => {
    for (const photo of FIXTURE_PHOTOS) {
      assert.ok(harness.populatedHtml.includes(`data-testid="card-site-prep-photo-${photo.id}"`), `missing card for ${photo.id}`);
      assert.ok(harness.populatedHtml.includes(`src="${photo.url}"`), `missing <img> src for ${photo.id}`);
    }
  });
});
