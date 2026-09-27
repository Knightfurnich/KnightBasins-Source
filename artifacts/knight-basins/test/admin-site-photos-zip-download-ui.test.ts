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
  { id: 101, leadId: 1, jobCode: "JB26/1080", imageUrl: "https://example.test/101.jpg", description: "ไซต์ A", stage: "survey", senderName: "ช่างหนึ่ง", capturedAt: "2026-09-10T00:00:00.000Z", createdAt: "2026-09-10T00:05:00.000Z" },
  { id: 102, leadId: 2, jobCode: "JB26/1080", imageUrl: "https://example.test/102.jpg", description: "ไซต์ A เพิ่มเติม", stage: "installation", senderName: "ช่างสอง", capturedAt: "2026-09-11T00:00:00.000Z", createdAt: "2026-09-11T00:05:00.000Z" },
  { id: 103, leadId: null, jobCode: null, imageUrl: "https://example.test/103.jpg", description: "ยังไม่ระบุงาน", stage: "survey", senderName: "ทีม ก", capturedAt: null, createdAt: "2026-09-12T00:05:00.000Z" },
  { id: 104, leadId: 4, jobCode: "JB26/1081", imageUrl: "https://example.test/104.jpg", description: "ไซต์ B", stage: "completed", senderName: "ช่างสาม", capturedAt: "2026-09-13T00:00:00.000Z", createdAt: "2026-09-13T00:05:00.000Z" },
];

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
const renderPage = (visiblePhotos) => {
  const queryClient = new QueryClient();
  const params = page.sitePhotosQueryParams({ jobCode: "", stage: "all" });
  queryClient.setQueryData(getListAdminSitePhotosQueryKey(params), visiblePhotos);
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: queryClient }, createElement(page.SitePhotosPage)),
  );
};
const singleJobPhotos = photos.filter((photo) => photo.jobCode === "JB26/1080");
process.stdout.write(JSON.stringify({
  url: page.sitePhotoZipDownloadUrl("  JB26/1080 & A  "),
  singleJobCode: page.sitePhotoZipJobCode(singleJobPhotos),
  multipleJobCodes: page.sitePhotoZipJobCode(photos),
  noJobCodes: page.sitePhotoZipJobCode(photos.filter((photo) => !photo.jobCode)),
  singleJobHtml: renderPage(singleJobPhotos),
  allPhotosHtml: renderPage(photos),
}));
`;

type HarnessResult = {
  url: string;
  singleJobCode: string | null;
  multipleJobCodes: string | null;
  noJobCodes: string | null;
  singleJobHtml: string;
  allPhotosHtml: string;
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
  tmpDir = mkdtempSync(join(appRoot, "node_modules", ".admin-site-photos-zip-download-test-"));
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

describe("site photo ZIP download controls", () => {
  it("builds the ZIP endpoint URL with an encoded, trimmed job code", () => {
    assert.equal(
      harness.url,
      "/api/admin/site-photos/download-zip?jobCode=JB26%2F1080%20%26%20A",
    );
  });

  it("shows a bulk ZIP button when visible results identify one job code", () => {
    assert.equal(harness.singleJobCode, "JB26/1080");
    assert.ok(harness.singleJobHtml.includes('data-testid="button-download-site-photos-zip"'));
    assert.ok(harness.singleJobHtml.includes("ดาวน์โหลด ZIP ของงานนี้"));
  });

  it("does not offer an ambiguous bulk ZIP action across different job codes", () => {
    assert.equal(harness.multipleJobCodes, null);
    assert.ok(!harness.allPhotosHtml.includes('data-testid="button-download-site-photos-zip"'));
    assert.equal(harness.noJobCodes, null);
  });

  it("adds a quick ZIP action to each coded photo card only", () => {
    assert.ok(harness.allPhotosHtml.includes('data-testid="button-card-download-zip-101"'));
    assert.ok(harness.allPhotosHtml.includes('data-testid="button-card-download-zip-102"'));
    assert.ok(harness.allPhotosHtml.includes('data-testid="button-card-download-zip-104"'));
    assert.ok(!harness.allPhotosHtml.includes('data-testid="button-card-download-zip-103"'));
    assert.ok(harness.allPhotosHtml.includes("ดาวน์โหลดรูปทั้งหมดของรหัสงานนี้เป็น ZIP"));
  });
});