import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/LeadsManager.tsx")).href;
const dialogComponentUrl = pathToFileURL(join(knightBasinsRoot, "src/components/ui/dialog.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const draftKey = "dft_0123456789abcdef01234567";

const studioData = {
  state: {
    shape: "L",
    dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1400, runCMm: 0 },
    pieces: [{
      id: "piece-1",
      name: "งานหลัก",
      preset: "l-right",
      rectangles: [
        { id: "rect-a", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 },
        { id: "wizard-leg-1", widthMm: 600, lengthMm: 800, xMm: 1200, yMm: 0, rotation: 0 },
      ],
      sideStatuses: { "rect-a:top": "normal" },
    }],
    activePieceId: "piece-1",
    activeStone: "Arctic",
    basinSkus: ["BASIN-42"],
    basinPlacements: [{ id: "basin-1", sku: "BASIN-42", pieceId: "piece-1", xMm: 300, yMm: 120 }],
  },
};

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { pathname: "/admin/leads", search: "", hash: "" },
});
const mod = await import(${JSON.stringify(componentUrl)});
const { Dialog } = await import(${JSON.stringify(dialogComponentUrl)});
const calls = [];
let createdDraft = null;
const fetcher = async (url, init) => {
  calls.push({ url: String(url), method: init.method, headers: init.headers, credentials: init.credentials, body: init.body });
  return {
    ok: true,
    status: 201,
    json: async () => ({
      draftKey: ${JSON.stringify(draftKey)},
      resumeUrl: "/studio?draft=${draftKey}",
      expiresAt: "2026-10-01T00:00:00.000Z",
    }),
  };
};
const result = await mod.handleLeadStudioDraftRequest(
  ${JSON.stringify(studioData)},
  (draft) => { createdDraft = draft; },
  fetcher,
  "https://admin.example",
);
const buttonHtml = renderToStaticMarkup(createElement(mod.LeadStudioDraftAction, {
  lead: { id: 42, name: "ลูกค้าทดสอบ", studioData: ${JSON.stringify(studioData)} },
}));
const dialogContentHtml = renderToStaticMarkup(createElement(Dialog, {
  open: true,
  onOpenChange: () => {},
}, createElement(mod.LeadStudioDraftDialogContent, {
  draft: result,
  copied: false,
  error: "",
  onCopy: () => {},
})));
const sketchHtml = renderToStaticMarkup(createElement(mod.LeadSketchAction, {
  lead: { id: 43, sketchUrls: ["https://images.example/sketch.png"] },
}));

process.stdout.write(JSON.stringify({ calls, result, createdDraft, buttonHtml, dialogContentHtml, sketchHtml }));
`;

type HarnessResult = {
  calls: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    credentials: string;
    body: string;
  }>;
  result: { draftKey: string; resumeUrl: string; studioUrl: string };
  createdDraft: { draftKey: string; resumeUrl: string; studioUrl: string };
  buttonHtml: string;
  dialogContentHtml: string;
  sketchHtml: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".admin-lead-studio-draft-test-"));
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

describe("admin lead Studio draft action", () => {
  it("renders the create-draft button for a lead with studioData", () => {
    assert.ok(harness.buttonHtml.includes('data-testid="button-lead-generate-studio-draft"'));
    assert.ok(harness.buttonHtml.includes("สร้างลิงก์ Studio"));
  });

  it("posts the saved lead state and publishes the created resume link to the dialog state", () => {
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].url, "/api/studio/draft");
    assert.equal(harness.calls[0].method, "POST");
    assert.equal(harness.calls[0].credentials, "include");
    assert.equal(harness.calls[0].headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(harness.calls[0].body), {
      shape: "l-right",
      dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1400, runCMm: 0 },
      stoneColor: "Arctic",
      basinSku: "BASIN-42",
      basinPlacements: [{ id: "basin-1", sku: "BASIN-42", pieceId: "piece-1", xMm: 300, yMm: 120 }],
      edges: {
        activePieceId: "piece-1",
        pieces: [{
          id: "piece-1",
          name: "งานหลัก",
          preset: "l-right",
          rectangles: [
            { id: "rect-a", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 },
            { id: "wizard-leg-1", widthMm: 600, lengthMm: 800, xMm: 1200, yMm: 0, rotation: 0 },
          ],
          sideStatuses: { "rect-a:top": "normal" },
        }],
        sideStatusesByPiece: { "piece-1": { "rect-a:top": "normal" } },
      },
    });
    assert.deepEqual(harness.createdDraft, {
      draftKey,
      resumeUrl: `https://admin.example/studio?draft=${draftKey}`,
      studioUrl: `/studio?draft=${draftKey}`,
    });
  });

  it("renders the full resume URL, copy control, and local Studio link in the dialog content", () => {
    assert.ok(harness.dialogContentHtml.includes(`value="https://admin.example/studio?draft=${draftKey}"`));
    assert.ok(harness.dialogContentHtml.includes('data-testid="button-copy-lead-studio-draft-link"'));
    assert.ok(harness.dialogContentHtml.includes(`href="/studio?draft=${draftKey}"`));
    assert.ok(harness.dialogContentHtml.includes('data-testid="link-lead-studio-draft-open"'));
  });

  it("shows a direct sketch-image link when only sketch URLs are available", () => {
    assert.ok(harness.sketchHtml.includes('data-testid="button-lead-view-sketch"'));
    assert.ok(harness.sketchHtml.includes('href="https://images.example/sketch.png"'));
    assert.ok(harness.sketchHtml.includes("ดูภาพแบบร่าง"));
  });
});