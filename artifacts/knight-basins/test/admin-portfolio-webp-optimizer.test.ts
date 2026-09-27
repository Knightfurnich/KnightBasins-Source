import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminSource = readFileSync(new URL("../src/admin/PortfolioGalleryPage.tsx", import.meta.url), "utf8");

function extractHelperBody(pattern: RegExp, helperName: string): string {
  const body = adminSource.match(pattern)?.[1];
  assert.ok(body, `Expected ${helperName} to exist in the admin portfolio page`);
  return body;
}

const dimensionsBody = extractHelperBody(
  /export function getPortfolioImageDimensions\([^)]*\): PortfolioImageDimensions \{\n([\s\S]*?)\n\}/,
  "getPortfolioImageDimensions",
);
const getPortfolioImageDimensions = new Function(
  "PORTFOLIO_IMAGE_MAX_DIMENSION",
  `return function(width, height) {${dimensionsBody}};`,
)(1920) as (width: number, height: number) => { width: number; height: number };

const compressionDecisionBody = extractHelperBody(
  /export function shouldCompressPortfolioImage\([^)]*\): boolean \{\n([\s\S]*?)\n\}/,
  "shouldCompressPortfolioImage",
);
const shouldCompressPortfolioImage = new Function(
  "PORTFOLIO_IMAGE_SMALL_FILE_THRESHOLD",
  `return function(file) {${compressionDecisionBody}};`,
)(256 * 1024) as (file: { name: string; size: number; type: string }) => boolean;

test("limits the longest image side to 1920px without upscaling", () => {
  assert.deepEqual(getPortfolioImageDimensions(4000, 2000), { width: 1920, height: 960 });
  assert.deepEqual(getPortfolioImageDimensions(1200, 2400), { width: 960, height: 1920 });
  assert.deepEqual(getPortfolioImageDimensions(1200, 900), { width: 1200, height: 900 });
  assert.deepEqual(getPortfolioImageDimensions(0, 900), { width: 0, height: 0 });
});

test("keeps existing WebP and small images on their original files", () => {
  assert.equal(shouldCompressPortfolioImage({ name: "already.webp", type: "image/webp", size: 2_000_000 }), false);
  assert.equal(shouldCompressPortfolioImage({ name: "already.WEBP", type: "image/jpeg", size: 2_000_000 }), false);
  assert.equal(shouldCompressPortfolioImage({ name: "small.jpg", type: "image/jpeg", size: 256 * 1024 }), false);
  assert.equal(shouldCompressPortfolioImage({ name: "large.png", type: "image/png", size: 256 * 1024 + 1 }), true);
});

test("uses Canvas WebP at quality 0.82 and falls back unless output is a smaller WebP", () => {
  assert.match(adminSource, /const PORTFOLIO_IMAGE_WEBP_QUALITY = 0\.82/);
  assert.match(adminSource, /canvas\.toBlob\(resolve, "image\/webp", PORTFOLIO_IMAGE_WEBP_QUALITY\)/);
  assert.match(adminSource, /blob\.type\.toLowerCase\(\) !== "image\/webp" \|\| blob\.size === 0 \|\| blob\.size >= file\.size\) return file/);
  assert.match(adminSource, /catch \{\s*return file;\s*\}\s*finally/);
});

test("waits for preprocessing, shows original and upload sizes, and sends the processed draft file", () => {
  assert.match(adminSource, /optimizePortfolioImage\(draft\.originalFile\)/);
  assert.match(adminSource, /file: optimizedFile, compressionStatus: "ready"/);
  assert.match(adminSource, /formData\.append\("file", draft\.file\)/);
  assert.match(adminSource, /fetch\("\/api\/admin\/portfolio\/upload", \{ method: "POST", body: formData \}\)/);
  assert.match(adminSource, /formatPortfolioFileSize\(draft\.originalFile\.size\)} → \$\{formatPortfolioFileSize\(draft\.file\.size\)/);
  assert.match(adminSource, /disabled=\{writesPending \|\| uploadCompressionPending \|\| uploadDrafts\.length === 0 \|\| !uploadCategory\}/);
});