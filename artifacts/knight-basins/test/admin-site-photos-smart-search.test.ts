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

const PHOTOS: PhotoFixture[] = [
  { id: 1, leadId: 1, jobCode: "JB26/1080", imageUrl: "https://example.test/1.jpg", description: "บ้านคุณสมชาย ถนนสุขุมวิท", stage: "survey", senderName: "ช่างก้อง", capturedAt: "2026-10-10T00:00:00.000Z", createdAt: "2026-10-10T00:05:00.000Z" },
  { id: 2, leadId: 2, jobCode: "26/1080", imageUrl: "https://example.test/2.jpg", description: "บ้านราชพฤกษ์", stage: "installation", senderName: "ทีม ก", capturedAt: "2026-09-10T00:00:00.000Z", createdAt: "2026-09-10T00:05:00.000Z" },
  { id: 3, leadId: 3, jobCode: "JB25/1080", imageUrl: "https://example.test/3.jpg", description: "ไซต์เก่า", stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-09-09T23:59:59.000Z", createdAt: "2026-09-10T00:00:00.000Z" },
  { id: 4, leadId: 4, jobCode: "JB27/0101", imageUrl: "https://example.test/4.jpg", description: "ข้ามปีจาก UTC", stage: "completed", senderName: "ช่างบี", capturedAt: "2026-12-31T17:00:00.000Z", createdAt: "2026-12-31T17:05:00.000Z" },
  { id: 5, leadId: 5, jobCode: "JB26/0202", imageUrl: "https://example.test/5.jpg", description: "ไซต์สุขุมวิท", stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-04-15T03:00:00.000Z", createdAt: "2026-04-15T03:05:00.000Z" },
  { id: 6, leadId: 6, jobCode: "JB26/0101", imageUrl: "https://example.test/6.jpg", description: "งานมีนาคม", stage: "survey", senderName: "ช่างซี", capturedAt: "2026-03-31T00:00:00.000Z", createdAt: "2026-03-31T00:05:00.000Z" },
  { id: 7, leadId: null, jobCode: null, imageUrl: "https://example.test/7.jpg", description: "บ้านไม่มีรหัส ราชพฤกษ์", stage: "survey", senderName: "ทีม ก", capturedAt: null, createdAt: "2026-10-01T00:00:00.000Z" },
  { id: 8, leadId: 8, jobCode: "JB25/0701", imageUrl: "https://example.test/8.jpg", description: "ภาพวันที่ไม่ถูกต้อง", stage: "service", senderName: "ช่างดี", capturedAt: "not-a-date", createdAt: "2025-07-01T00:00:00.000Z" },
  { id: 9, leadId: 9, jobCode: "JB26/1011", imageUrl: "https://example.test/9.jpg", description: "ไซต์สุขุมวิท", stage: "installation", senderName: "ช่างก้อง", capturedAt: "2026-10-11T00:00:00.000Z", createdAt: "2026-10-11T00:05:00.000Z" },
];

const NOW = "2026-10-10T00:00:00.000Z";
const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(appRoot, "src/admin/SitePhotosPage.tsx")).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListAdminSitePhotosQueryKey } from "@workspace/api-client-react";
const page = await import(${JSON.stringify(componentUrl)});
const photos = ${JSON.stringify(PHOTOS)};
const now = new Date(${JSON.stringify(NOW)});
const baseFilters = {
  search: "",
  stage: "all",
  onlyUnassigned: false,
  timeRange: "all",
  year: "",
  yearPeriod: "all",
};
const ids = (filters) => page.filterSitePhotosSmart(photos, { ...baseFilters, ...filters }, now).map((photo) => photo.id);
const queryClient = new QueryClient();
const queryParams = page.sitePhotosQueryParams({ jobCode: "", stage: "all", visibility: "visible" });
const hiddenQueryParams = page.sitePhotosQueryParams({ jobCode: "", stage: "all", visibility: "hidden" });
queryClient.setQueryData(getListAdminSitePhotosQueryKey(hiddenQueryParams), []);
queryClient.setQueryData(getListAdminSitePhotosQueryKey(queryParams), photos.filter((photo) => photo.id !== 8));
const renderedHtml = renderToStaticMarkup(
  createElement(QueryClientProvider, { client: queryClient }, createElement(page.SitePhotosPage)),
);
process.stdout.write(JSON.stringify({
  yearOptions: page.sitePhotoYearOptions(photos),
  year2026PeriodOptions: page.sitePhotoYearPeriodOptions(photos, "2026"),
  recentIds: ids({ timeRange: "30d" }),
  year2026Ids: ids({ timeRange: "year", year: "2026" }),
  year2026Quarter1Ids: ids({ timeRange: "year", year: "2026", yearPeriod: "q1" }),
  year2026Quarter2Ids: ids({ timeRange: "year", year: "2026", yearPeriod: "q2" }),
  year2026OctoberIds: ids({ timeRange: "year", year: "2026", yearPeriod: "month:2026-10" }),
  jobCodeIds: ids({ search: "  jb26/1080  " }),
  partialJobCodeIds: ids({ search: "26/1080" }),
  descriptionIds: ids({ search: "  คุณสมชาย " }),
  senderIds: ids({ search: " ทีม ก " }),
  combinedIds: ids({
    search: "สุขุมวิท",
    stage: "survey",
    timeRange: "year",
    year: "2026",
    yearPeriod: "q2",
  }),
  renderedHtml,
}));
`;

type HarnessResult = {
  yearOptions: Array<{ value: string; label: string }>;
  year2026PeriodOptions: Array<{ value: string; label: string }>;
  recentIds: number[];
  year2026Ids: number[];
  year2026Quarter1Ids: number[];
  year2026Quarter2Ids: number[];
  year2026OctoberIds: number[];
  jobCodeIds: number[];
  partialJobCodeIds: number[];
  descriptionIds: number[];
  senderIds: number[];
  combinedIds: number[];
  renderedHtml: string;
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
  tmpDir = mkdtempSync(join(appRoot, "node_modules", ".admin-site-photos-smart-search-test-"));
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

describe("site photo smart search and flexible time filters", () => {
  it("offers Buddhist-calendar years derived from actual photo dates in descending order", () => {
    assert.deepEqual(harness.yearOptions, [
      { value: "2027", label: "พ.ศ. 2570" },
      { value: "2026", label: "พ.ศ. 2569" },
      { value: "2025", label: "พ.ศ. 2568" },
    ]);
  });

  it("filters the rolling 30-day range inclusively and excludes future or older photos", () => {
    assert.deepEqual(harness.recentIds, [1, 2, 7]);
  });

  it("filters a selected year using the Bangkok calendar year, including UTC year boundaries", () => {
    assert.deepEqual(harness.year2026Ids, [1, 2, 3, 5, 6, 7, 9]);
    assert.ok(!harness.year2026Ids.includes(4));
  });

  it("filters quarters and months within the selected year only", () => {
    assert.deepEqual(harness.year2026Quarter1Ids, [6]);
    assert.deepEqual(harness.year2026Quarter2Ids, [5]);
    assert.deepEqual(harness.year2026OctoberIds, [1, 7, 9]);
    assert.ok(harness.year2026PeriodOptions.some((option) => option.value === "q1"));
    assert.ok(harness.year2026PeriodOptions.some((option) => option.value === "q4"));
    assert.ok(harness.year2026PeriodOptions.some((option) => option.value === "month:2026-10"));
    assert.ok(!harness.year2026PeriodOptions.some((option) => option.value === "month:2027-01"));
  });

  it("searches job codes case-insensitively after trimming the search term", () => {
    assert.deepEqual(harness.jobCodeIds, [1]);
  });

  it("supports partial job-code searches", () => {
    assert.deepEqual(harness.partialJobCodeIds, [1, 2]);
  });

  it("searches descriptions, customer names, and locations", () => {
    assert.deepEqual(harness.descriptionIds, [1]);
  });

  it("searches technician and sender names", () => {
    assert.deepEqual(harness.senderIds, [2, 7]);
  });

  it("combines universal search, stage, and year-quarter filters", () => {
    assert.deepEqual(harness.combinedIds, [5]);
  });

  it("renders the universal search field, quick ranges, Buddhist year, and in-year period controls", () => {
    assert.ok(harness.renderedHtml.includes('data-testid="input-site-photos-search"'));
    assert.ok(harness.renderedHtml.includes('data-testid="button-site-photos-time-all"'));
    assert.ok(harness.renderedHtml.includes('data-testid="button-site-photos-time-30d"'));
    assert.ok(harness.renderedHtml.includes('data-testid="select-site-photo-year"'));
    assert.ok(harness.renderedHtml.includes('data-testid="select-site-photo-month"'));
    assert.ok(harness.renderedHtml.includes("พ.ศ. 2570"));
    assert.ok(harness.renderedHtml.includes("ทั้งปี (ทุกเดือน)"));
  });
});