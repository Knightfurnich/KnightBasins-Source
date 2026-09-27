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

const visiblePhoto: SitePhotoFixture = {
  id: 1,
  leadId: 11,
  jobCode: "JB01/2569",
  imageUrl: "https://example.com/1.jpg",
  description: "ภาพตัวอย่างที่แสดงอยู่",
  stage: "survey",
  senderName: "ช่างเอ",
  capturedAt: "2026-09-20T03:00:00.000Z",
  createdAt: "2026-09-20T03:05:00.000Z",
};
const hiddenPhoto: SitePhotoFixture = {
  ...visiblePhoto,
  id: 2,
  jobCode: "JB02/2569",
  description: "ภาพตัวอย่างที่ซ่อนไว้",
};

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const componentPath = join(appRoot, "src/admin/SitePhotosPage.tsx");
const componentUrl = pathToFileURL(componentPath).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const componentSource = readFileSync(componentPath, "utf8");

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getListAdminSitePhotosQueryKey,
  getListAdminSitePhotosUrl,
} from "@workspace/api-client-react";

const mod = await import(${JSON.stringify(componentUrl)});
const visiblePhoto = ${JSON.stringify(visiblePhoto)};
const hiddenPhoto = ${JSON.stringify(hiddenPhoto)};
const defaultParams = mod.sitePhotosQueryParams({ jobCode: "", stage: "all", visibility: "visible" });
const omittedVisibilityParams = mod.sitePhotosQueryParams({ jobCode: "", stage: "all" });
const hiddenParams = mod.sitePhotosQueryParams({ jobCode: "", stage: "all", visibility: "hidden" });
const queryClient = new QueryClient();
queryClient.setQueryData(getListAdminSitePhotosQueryKey(defaultParams), [visiblePhoto]);
queryClient.setQueryData(getListAdminSitePhotosQueryKey(hiddenParams), [hiddenPhoto]);
const html = renderToStaticMarkup(
  createElement(QueryClientProvider, { client: queryClient }, createElement(mod.SitePhotosPage)),
);
process.stdout.write(JSON.stringify({
  defaultParams,
  omittedVisibilityParams,
  hiddenParams,
  visibleUrl: getListAdminSitePhotosUrl(defaultParams),
  hiddenUrl: getListAdminSitePhotosUrl(hiddenParams),
  hideRequest: mod.sitePhotoVisibilityRequest(1, false),
  unhideRequest: mod.sitePhotoVisibilityRequest(2, true),
  html,
}));
`;

type HarnessResult = {
  defaultParams: Record<string, string>;
  omittedVisibilityParams: Record<string, string>;
  hiddenParams: Record<string, string>;
  visibleUrl: string;
  hiddenUrl: string;
  hideRequest: { url: string; init: { method: string; headers: Record<string, string>; body: string } };
  unhideRequest: { url: string; init: { method: string; headers: Record<string, string>; body: string } };
  html: string;
};

let harness: HarnessResult;
let tempDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected the workspace tsx loader at ${tsxLoaderPath}`);
  }
  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tempDir = mkdtempSync(join(appRoot, "node_modules", ".admin-site-photos-hide-test-"));
  const tsconfigPath = join(tempDir, "tsconfig.override.json");
  const harnessPath = join(tempDir, "harness.mjs");
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
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("admin site photos hide and restore UI", () => {
  it("defaults to visible photos and sends visibility filters through the list URL", () => {
    assert.deepEqual(harness.defaultParams, { visibility: "visible" });
    assert.deepEqual(harness.omittedVisibilityParams, {});
    assert.deepEqual(harness.hiddenParams, { visibility: "hidden" });
    assert.match(harness.visibleUrl, /[?&]visibility=visible(?:&|$)/);
    assert.match(harness.hiddenUrl, /[?&]visibility=hidden(?:&|$)/);
    assert.match(componentSource, /useState<SitePhotoVisibilityFilter>\("visible"\)/);
    assert.match(componentSource, /data-testid="button-visibility-visible"/);
    assert.match(componentSource, /data-testid="button-visibility-hidden"/);
    assert.match(componentSource, /ภาพที่ซ่อนไว้ \(\{hiddenPhotoCount\}\)/);
    assert.match(componentSource, /setVisibilityFilter\("hidden"\)/);
  });

  it("shows hide controls for visible cards and restore controls for hidden cards", () => {
    assert.match(harness.html, /data-testid="button-hide-site-photo"/);
    assert.match(harness.html, /ภาพที่ซ่อนไว้ \(1\)/);
    assert.match(componentSource, /data-testid="button-unhide-site-photo"/);
    assert.match(componentSource, /visibilityFilter === "visible" \? \([\s\S]*?data-testid="button-hide-site-photo"[\s\S]*?\) : \([\s\S]*?data-testid="button-unhide-site-photo"/);
    assert.match(componentSource, /visibilityFilter === "visible" && photo\.jobCode\?\.trim\(\)/);
  });

  it("builds PATCH requests with false for hide and true for restore", () => {
    assert.deepEqual(harness.hideRequest, {
      url: "/api/admin/site-photos/1/visibility",
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{\"isVisible\":false}",
      },
    });
    assert.deepEqual(harness.unhideRequest, {
      url: "/api/admin/site-photos/2/visibility",
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{\"isVisible\":true}",
      },
    });
    assert.match(componentSource, /await customFetch<unknown>\(request\.url, request\.init\)/);
    assert.match(componentSource, /updateSitePhotoVisibility\(photo, true\)/);
    assert.match(componentSource, /updateSitePhotoVisibility\(photoToHide, false\)/);
    assert.doesNotMatch(componentSource, /method:\s*["']DELETE["']/);
    assert.doesNotMatch(componentSource, /\/api\/admin\/site-photos\/\$\{[^}]+\}`,\s*\{\s*method:\s*["']DELETE["']/);
  });

  it("confirms hiding with the non-destructive warning and shows the requested success messages", () => {
    assert.ok(componentSource.includes("ซ่อนภาพนี้จากรายการ? ภาพจะไม่ถูกลบและกู้คืนได้ทุกเมื่อ"));
    assert.doesNotMatch(componentSource, /ลบถาวร/);
    assert.match(componentSource, /ซ่อนภาพนี้จากรายการแล้ว \(กู้คืนได้ทุกเมื่อ\)/);
    assert.match(componentSource, /นำภาพกลับมาแสดงแล้ว/);
    assert.match(componentSource, /data-testid="button-confirm-hide-site-photo"/);
  });
});