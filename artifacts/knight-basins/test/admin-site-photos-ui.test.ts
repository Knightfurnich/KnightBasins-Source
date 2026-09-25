import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * WHY THIS FILE SPAWNS A SUBPROCESS
 *
 * node's native `--experimental-strip-types` test runner (this project's
 * `npm test`) cannot load .tsx files at all -- not a JSX-syntax error, but
 * "Unknown file extension .tsx" at the module-resolution level, confirmed
 * empirically. No other admin *.tsx component in this codebase is imported
 * by a test for the same reason; every existing "UI" test (e.g.
 * basin-image-manager-field.test.ts) only unit-tests plain .ts helper
 * modules extracted from a component, never the component itself.
 *
 * SitePhotosPage.tsx's only meaningfully-extractable pure logic --
 * sitePhotosQueryParams, the function that turns the search bar + stage
 * buttons into the GET /admin/site-photos query filters -- can't be pulled
 * into a sibling .ts helper file without going outside this task's SCOPE
 * (only SitePhotosPage.tsx, AdminApp.tsx and this test file). So instead,
 * this file transpiles+runs the REAL SitePhotosPage.tsx (TS types stripped
 * and JSX compiled to the automatic react/jsx-runtime, matching this
 * project's actual Vite build) in a child process via `tsx` -- an
 * already-installed, pnpm-catalog-pinned devDependency of this monorepo's
 * own `scripts` workspace (see scripts/package.json) -- then renders the
 * component server-side with @tanstack/react-query's cache pre-seeded, so
 * these tests exercise the genuine shipped component and its real
 * stage/jobCode filtering logic, not a hand-copied duplicate.
 *
 * If this ever needs to become a first-class, always-available capability,
 * the proper fix is adding a JSX-capable test runner (tsx or vitest) as a
 * real devDependency of artifacts/knight-basins -- that's a package.json
 * change, outside this task's SCOPE, so it isn't done here.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/SitePhotosPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

type SitePhotoFixture = {
  id: number;
  leadId: number | null;
  jobCode: string | null;
  imageUrl: string;
  description: string | null;
  stage: "survey" | "installation" | "service" | "completed";
  senderName: string | null;
  capturedAt: string | null;
  createdAt: string;
};

const FIXTURE_PHOTOS: SitePhotoFixture[] = [
  { id: 1, leadId: null, jobCode: "JB01/2569", imageUrl: "https://example.com/1.jpg", description: "รูปวัดหน้างาน", stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-09-20T03:00:00.000Z", createdAt: "2026-09-20T03:05:00.000Z" },
  { id: 2, leadId: 42, jobCode: "JB02/2569", imageUrl: "https://example.com/2.jpg", description: null, stage: "installation", senderName: "ช่างบี", capturedAt: "2026-09-22T03:00:00.000Z", createdAt: "2026-09-22T03:05:00.000Z" },
  { id: 3, leadId: 42, jobCode: "JB02/2569", imageUrl: "https://example.com/3.jpg", description: null, stage: "completed", senderName: "ช่างบี", capturedAt: "2026-09-24T03:00:00.000Z", createdAt: "2026-09-24T03:05:00.000Z" },
];

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListAdminSitePhotosQueryKey } from "@workspace/api-client-react";

const mod = await import(${JSON.stringify(componentUrl)});
const { SitePhotosPage, sitePhotosQueryParams } = mod;

function renderWithCache(data) {
  const queryClient = new QueryClient();
  if (data !== undefined) {
    const params = sitePhotosQueryParams({ jobCode: "", stage: "all" });
    queryClient.setQueryData(getListAdminSitePhotosQueryKey(params), data);
  }
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(SitePhotosPage)));
}

const result = {
  queryParams: {
    trimsAndIncludesJobCode: sitePhotosQueryParams({ jobCode: "  JB01/2569  ", stage: "all" }),
    omitsBlankJobCode: sitePhotosQueryParams({ jobCode: "   ", stage: "all" }),
    omitsAllStage: sitePhotosQueryParams({ jobCode: "", stage: "all" }),
    includesSpecificStage: sitePhotosQueryParams({ jobCode: "", stage: "survey" }),
    combinesJobCodeAndStage: sitePhotosQueryParams({ jobCode: "JB02/2569", stage: "installation" }),
  },
  loadingHtml: renderWithCache(undefined),
  emptyHtml: renderWithCache([]),
  populatedHtml: renderWithCache(${JSON.stringify(FIXTURE_PHOTOS)}),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  queryParams: {
    trimsAndIncludesJobCode: Record<string, unknown>;
    omitsBlankJobCode: Record<string, unknown>;
    omitsAllStage: Record<string, unknown>;
    includesSpecificStage: Record<string, unknown>;
    combinesJobCodeAndStage: Record<string, unknown>;
  };
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
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".site-photos-ui-test-"));
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

describe("sitePhotosQueryParams (drives GET /admin/site-photos filters)", () => {
  it("trims the jobCode search and includes it when non-blank", () => {
    assert.deepEqual(harness.queryParams.trimsAndIncludesJobCode, { jobCode: "JB01/2569" });
  });

  it("omits jobCode entirely when it is blank or whitespace-only", () => {
    assert.deepEqual(harness.queryParams.omitsBlankJobCode, {});
  });

  it('omits stage entirely when the "ทั้งหมด" (all) filter is selected', () => {
    assert.deepEqual(harness.queryParams.omitsAllStage, {});
  });

  it("includes stage when a specific stage button is selected", () => {
    assert.deepEqual(harness.queryParams.includesSpecificStage, { stage: "survey" });
  });

  it("combines jobCode and stage when both filters are active", () => {
    assert.deepEqual(harness.queryParams.combinesJobCodeAndStage, { jobCode: "JB02/2569", stage: "installation" });
  });
});

describe("SitePhotosPage render", () => {
  it("renders successfully", () => {
    assert.ok(harness.populatedHtml.length > 0);
    assert.ok(harness.populatedHtml.includes('data-testid="admin-site-photos"'));
  });

  it("shows the loading skeleton (not the grid) before data has loaded", () => {
    assert.ok(harness.loadingHtml.includes('data-testid="status-site-photos-loading"'));
    assert.ok(!harness.loadingHtml.includes('data-testid="grid-site-photos"'));
  });

  it("shows the empty state when there are no matching photos", () => {
    assert.ok(harness.emptyHtml.includes('data-testid="status-site-photos-empty"'));
  });

  it("renders a card for every photo, with its jobCode and sender", () => {
    for (const photo of FIXTURE_PHOTOS) {
      assert.ok(harness.populatedHtml.includes(`data-testid="card-site-photo-${photo.id}"`), `missing card for photo ${photo.id}`);
      if (photo.jobCode) assert.ok(harness.populatedHtml.includes(photo.jobCode));
      if (photo.senderName) assert.ok(harness.populatedHtml.includes(photo.senderName));
    }
  });

  it("renders the correct stage badge for each photo's stage", () => {
    assert.ok(harness.populatedHtml.includes('data-testid="badge-stage-survey"'));
    assert.ok(harness.populatedHtml.includes('data-testid="badge-stage-installation"'));
    assert.ok(harness.populatedHtml.includes('data-testid="badge-stage-completed"'));
  });

  it("shows the image with a src of photo.imageUrl", () => {
    for (const photo of FIXTURE_PHOTOS) {
      assert.ok(harness.populatedHtml.includes(`src="${photo.imageUrl}"`), `missing <img> for photo ${photo.id}`);
    }
  });

  it("shows the AI description when present", () => {
    assert.ok(harness.populatedHtml.includes(FIXTURE_PHOTOS[0]!.description!));
  });
});
