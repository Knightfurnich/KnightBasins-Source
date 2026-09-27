import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  { id: 1, leadId: 11, jobCode: "JB01/2569", imageUrl: "https://example.com/1.jpg", description: "บ้านคุณสมชาย", stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-09-20T03:00:00.000Z", createdAt: "2026-09-20T03:05:00.000Z" },
  { id: 2, leadId: 12, jobCode: "JB02/2569", imageUrl: "https://example.com/2.jpg", description: null, stage: "installation", senderName: "ช่างบี", capturedAt: "2026-09-22T03:00:00.000Z", createdAt: "2026-09-22T03:05:00.000Z" },
  { id: 3, leadId: null, jobCode: null, imageUrl: "https://example.com/3.jpg", description: "ไซต์งานสำรวจ", stage: "service", senderName: "ช่างซี", capturedAt: "2026-09-24T03:00:00.000Z", createdAt: "2026-09-24T03:05:00.000Z" },
  { id: 4, leadId: null, jobCode: null, imageUrl: "https://example.com/4.jpg", description: null, stage: "completed", senderName: "ช่างดี", capturedAt: "2026-09-25T03:00:00.000Z", createdAt: "2026-09-25T03:05:00.000Z" },
];

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/SitePhotosPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const componentSource = readFileSync(
  join(knightBasinsRoot, "src/admin/SitePhotosPage.tsx"),
  "utf8",
);

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListAdminSitePhotosQueryKey } from "@workspace/api-client-react";

const mod = await import(${JSON.stringify(componentUrl)});
const { SitePhotosPage, sitePhotosQueryParams } = mod;
const photos = ${JSON.stringify(FIXTURE_PHOTOS)};
const params = sitePhotosQueryParams({ jobCode: "", stage: "all" });
const queryClient = new QueryClient();
queryClient.setQueryData(getListAdminSitePhotosQueryKey(params), photos);
const html = renderToStaticMarkup(
  createElement(QueryClientProvider, { client: queryClient }, createElement(SitePhotosPage)),
);
process.stdout.write(html);
`;

let renderedHtml = "";
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected the workspace tsx loader at ${tsxLoaderPath}`);
  }
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".site-photos-manage-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");
  renderedHtml = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("admin site photo management UI", () => {
  it("renders delete, description-edit, and stage controls for every photo", () => {
    for (const photo of FIXTURE_PHOTOS) {
      assert.ok(renderedHtml.includes(`data-testid="card-site-photo-${photo.id}"`));
      assert.ok(renderedHtml.includes(`data-testid="select-site-photo-stage-${photo.id}"`));
    }
    assert.equal((renderedHtml.match(/data-testid="button-delete-site-photo"/g) ?? []).length, FIXTURE_PHOTOS.length);
    assert.equal((renderedHtml.match(/data-testid="button-edit-site-photo-description"/g) ?? []).length, FIXTURE_PHOTOS.length);
    for (const stage of ["survey", "installation", "service", "completed"]) {
      assert.ok(renderedHtml.includes(`<option value="${stage}"`), `missing stage option ${stage}`);
    }
  });

  it("requires confirmation before sending the site-photo DELETE request", () => {
    assert.ok(componentSource.includes("คุณต้องการลบภาพนี้ออกจากระบบใช่หรือไม่?"));
    assert.match(componentSource, /data-testid="dialog-delete-site-photo"/);
    assert.match(componentSource, /onClick=\{\(\) => void confirmDeleteSitePhoto\(\)\}[\s\S]*?data-testid="button-confirm-delete-site-photo"/);
    assert.match(componentSource, /setPhotoToDelete\(photo\);[\s\S]*?data-testid="button-delete-site-photo"/);

    const handler = componentSource.match(/const confirmDeleteSitePhoto = async \(\) => \{([\s\S]*?)\n  \};/);
    assert.ok(handler, "expected a confirmation handler");
    assert.match(handler[1]!, /if \(!photoToDelete \|\| deletingPhotoId !== null\) return/);
    assert.match(handler[1]!, /customFetch<void>\(`\/api\/admin\/site-photos\/\$\{encodeURIComponent\(photo\.id\)\}`, \{ method: "DELETE" \}\)/);
    assert.match(handler[1]!, /invalidateQueries\(\{ queryKey: SITE_PHOTOS_BASE_QUERY_KEY \}\)/);
  });

  it("sends only the selected stage through the existing PATCH mutation", () => {
    assert.match(componentSource, /data-testid=\{`select-site-photo-stage-\$\{photo\.id\}`\}/);
    assert.match(componentSource, /useUpdateAdminSitePhoto/);
    const handler = componentSource.match(/const changePhotoStage = \(photo: SitePhoto, nextStage: SitePhotoStage\) => \{([\s\S]*?)\n  \};/);
    assert.ok(handler, "expected a stage-change handler");
    assert.match(handler[1]!, /updatePhoto\.mutate\(\s*\{\s*id: photo\.id,\s*data: \{ stage: nextStage \} \}/);
    assert.match(handler[1]!, /invalidateQueries\(\{ queryKey: SITE_PHOTOS_BASE_QUERY_KEY \}\)/);
  });

  it("opens a description editor and saves the job description through PATCH", () => {
    assert.match(componentSource, /data-testid="button-edit-site-photo-description"/);
    assert.match(componentSource, /onClick=\{\(\) => openPhoto\(photo, true\)\}/);
    assert.match(componentSource, /startEditingDescription=\{editDescriptionOnOpen\}/);
    assert.match(componentSource, /data-testid="textarea-lightbox-description"/);
    assert.match(componentSource, /data: \{ description: description\.trim\(\) === "" \? null : description\.trim\(\), stage \}/);
    assert.match(componentSource, /data-testid="button-lightbox-save"/);
  });
});