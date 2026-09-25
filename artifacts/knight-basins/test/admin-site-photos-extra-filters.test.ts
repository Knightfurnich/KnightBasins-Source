import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type PhotoFixture = {
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

const FIXTURE_PHOTOS: PhotoFixture[] = [
  { id: 1, leadId: null, jobCode: "JB01/2569", imageUrl: "https://example.com/1.jpg", description: null, stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-09-30T16:59:59.000Z", createdAt: "2026-09-30T17:00:00.000Z" },
  { id: 2, leadId: null, jobCode: null, imageUrl: "https://example.com/2.jpg", description: null, stage: "installation", senderName: "ช่างบี", capturedAt: "2026-09-30T17:00:00.000Z", createdAt: "2026-09-30T17:05:00.000Z" },
  { id: 3, leadId: null, jobCode: "  	 ", imageUrl: "https://example.com/3.jpg", description: null, stage: "service", senderName: "ช่างซี", capturedAt: "2026-10-05T03:00:00.000Z", createdAt: "2026-10-05T03:05:00.000Z" },
  { id: 4, leadId: null, jobCode: "", imageUrl: "https://example.com/4.jpg", description: null, stage: "survey", senderName: "ช่างดี", capturedAt: "not-a-date", createdAt: "2026-10-05T03:05:00.000Z" },
  { id: 5, leadId: null, jobCode: null, imageUrl: "https://example.com/5.jpg", description: null, stage: "completed", senderName: "ช่างอี", capturedAt: null, createdAt: "2026-10-05T03:10:00.000Z" },
];

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/SitePhotosPage.tsx")).href;
function findWorkspaceRoot(startDirectory: string): string {
  let currentDirectory = startDirectory;
  while (true) {
    if (existsSync(join(currentDirectory, "scripts/node_modules/tsx/dist/loader.mjs"))) return currentDirectory;
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  throw new Error("Could not locate the workspace tsx loader");
}

const tsxLoaderPath = join(findWorkspaceRoot(testDir), "scripts/node_modules/tsx/dist/loader.mjs");

const HARNESS_SCRIPT = [
  "import { createElement } from 'react';",
  "import { renderToStaticMarkup } from 'react-dom/server';",
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';",
  "import { getListAdminSitePhotosQueryKey } from '@workspace/api-client-react';",
  "const mod = await import(" + JSON.stringify(componentUrl) + ");",
  "const { SitePhotosPage, sitePhotosQueryParams, filterSitePhotosExtra, sitePhotoCapturedMonthKey, sitePhotoMonthOptions } = mod;",
  "const photos = " + JSON.stringify(FIXTURE_PHOTOS) + ";",
  "const params = sitePhotosQueryParams({ jobCode: '', stage: 'all' });",
  "const queryClient = new QueryClient();",
  "queryClient.setQueryData(getListAdminSitePhotosQueryKey(params), photos.filter((photo) => photo.id !== 4));",
  "const populatedHtml = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(SitePhotosPage)));",
  "const output = {",
  "  unassignedIds: filterSitePhotosExtra(photos, { onlyUnassigned: true, month: 'all' }).map((photo) => photo.id),",
  "  octoberUnassignedIds: filterSitePhotosExtra(photos, { onlyUnassigned: true, month: '2026-10' }).map((photo) => photo.id),",
  "  septemberIds: filterSitePhotosExtra(photos, { onlyUnassigned: false, month: '2026-09' }).map((photo) => photo.id),",
  "  allMonthIds: filterSitePhotosExtra(photos, { onlyUnassigned: false, month: 'all' }).map((photo) => photo.id),",
  "  bangkokBoundaryMonth: sitePhotoCapturedMonthKey('2026-09-30T17:00:00.000Z'),",
  "  monthOptions: sitePhotoMonthOptions(photos),",
  "  populatedHtml,",
  "};",
  "process.stdout.write(JSON.stringify(output));",
].join("\n");

type HarnessResult = {
  unassignedIds: number[];
  octoberUnassignedIds: number[];
  septemberIds: number[];
  allMonthIds: number[];
  bangkokBoundaryMonth: string | null;
  monthOptions: Array<{ value: string; label: string }>;
  populatedHtml: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) throw new Error("tsx loader is required to render the SitePhotosPage component");
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".site-photos-extra-filters-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");
  const stdout = execFileSync(process.execPath, ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath], {
    cwd: knightBasinsRoot,
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
    encoding: "utf8",
  });
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("site photo unassigned and captured-month filters", () => {
  it("includes null, empty, and whitespace-only job codes only when unassigned is active", () => {
    assert.deepEqual(harness.unassignedIds, [2, 3, 4, 5]);
  });

  it("combines unassigned filtering with the selected capturedAt month", () => {
    assert.deepEqual(harness.octoberUnassignedIds, [2, 3]);
  });

  it("filters by capturedAt in the Bangkok timezone and excludes missing or invalid dates for a selected month", () => {
    assert.deepEqual(harness.septemberIds, [1]);
    assert.equal(harness.bangkokBoundaryMonth, "2026-10");
  });

  it("leaves missing or invalid capturedAt values visible when all months are selected", () => {
    assert.deepEqual(harness.allMonthIds, [1, 2, 3, 4, 5]);
  });

  it("offers Thai month/year labels in descending month order", () => {
    assert.deepEqual(harness.monthOptions, [
      { value: "2026-10", label: "ต.ค. 69" },
      { value: "2026-09", label: "ก.ย. 69" },
    ]);
  });

  it("renders the unassigned toggle and captured-month dropdown", () => {
    assert.ok(harness.populatedHtml.includes('data-testid="button-filter-unassigned-site-photos"'));
    assert.ok(harness.populatedHtml.includes("⚠️ ยังไม่ระบุรหัสงาน"));
    assert.ok(harness.populatedHtml.includes('data-testid="select-site-photo-month"'));
    assert.ok(harness.populatedHtml.includes("ทุกเดือน"));
    assert.ok(harness.populatedHtml.includes("ต.ค. 69"));
  });
});
