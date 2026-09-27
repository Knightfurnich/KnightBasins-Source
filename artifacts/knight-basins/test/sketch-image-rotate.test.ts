import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const studioPagePath = join(appRoot, "src/components/StudioPage.tsx");
const studioPageUrl = pathToFileURL(studioPagePath).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const studioPageSource = readFileSync(studioPagePath, "utf8");

const HARNESS_SCRIPT = `
import { pathToFileURL } from "node:url";
const page = await import(${JSON.stringify(studioPageUrl)});
const calls = [];
const context = {
  imageSmoothingEnabled: false,
  imageSmoothingQuality: "low",
  fillStyle: "",
  fillRect(...args) { calls.push(["fillRect", ...args]); },
  translate(...args) { calls.push(["translate", ...args]); },
  rotate(...args) { calls.push(["rotate", ...args]); },
  scale(...args) { calls.push(["scale", ...args]); },
  drawImage(...args) { calls.push(["drawImage", args[0]?.width, args[0]?.height, ...args.slice(1)]); },
};
const canvas = {
  width: 0,
  height: 0,
  getContext(kind) {
    calls.push(["getContext", kind]);
    return context;
  },
  toBlob(callback, type, quality) {
    calls.push(["toBlob", type, quality ?? null]);
    callback(new Blob(["rotated"], { type }));
  },
};
globalThis.document = {
  createElement(tagName) {
    calls.push(["createElement", tagName]);
    return canvas;
  },
};
globalThis.createImageBitmap = async (file) => {
  calls.push(["createImageBitmap", file.name]);
  return {
    width: 4000,
    height: 1000,
    close() { calls.push(["close"]); },
  };
};
const sourceFile = new File(["original"], "hand-sketch.png", { type: "image/png", lastModified: 1234 });
const rotatedFile = await page.rotateSketchFile(sourceFile);
process.stdout.write(JSON.stringify({
  largeDimensions: page.getRotatedSketchDimensions(4000, 1000),
  smallDimensions: page.getRotatedSketchDimensions(800, 600),
  canvasSize: [canvas.width, canvas.height],
  calls,
  outputFile: {
    name: rotatedFile.name,
    type: rotatedFile.type,
    lastModified: rotatedFile.lastModified,
    size: rotatedFile.size,
  },
}));
`;

type HarnessResult = {
  largeDimensions: { width: number; height: number };
  smallDimensions: { width: number; height: number };
  canvasSize: [number, number];
  calls: Array<Array<string | number | null>>;
  outputFile: { name: string; type: string; lastModified: number; size: number };
};

let harness: HarnessResult;
let tempDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }

  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tempDir = mkdtempSync(join(appRoot, "node_modules", ".sketch-image-rotate-test-"));
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

describe("Studio sketch image rotation", () => {
  it("adds an accessible rotate button to every image card and disables it while busy", () => {
    assert.match(studioPageSource, /data-testid=\{`button-rotate-sketch-\$\{index\}`\}/);
    assert.match(studioPageSource, /aria-label="หมุนภาพแบบร่าง 90 องศา"/);
    assert.match(studioPageSource, /style=\{\{ minHeight: 40, alignSelf: "flex-start" \}\}/);
    assert.match(
      studioPageSource,
      /disabled=\{submissionInFlightRef\.current \|\| submitting \|\| sketchStatus\?\.busy \|\| isBusy\}/,
    );
  });

  it("swaps image dimensions and keeps the long edge at or below 1920px", () => {
    assert.deepEqual(harness.largeDimensions, { width: 480, height: 1920 });
    assert.deepEqual(harness.smallDimensions, { width: 600, height: 800 });
    assert.ok(Math.max(...harness.canvasSize) <= 1920);
  });

  it("rotates the bitmap clockwise with canvas and keeps the original file name and supported type", () => {
    assert.deepEqual(harness.canvasSize, [480, 1920]);
    assert.ok(harness.calls.some(([name, angle]) => name === "rotate" && angle === Math.PI / 2));
    assert.ok(harness.calls.some(([name]) => name === "drawImage"));
    assert.ok(harness.calls.some(([name, type]) => name === "toBlob" && type === "image/png"));
    assert.deepEqual(harness.outputFile, {
      name: "hand-sketch.png",
      type: "image/png",
      lastModified: 1234,
      size: 7,
    });
  });

  it("shows the rotation hint and re-analyzes the replacement file through the existing queue", () => {
    assert.match(
      studioPageSource,
      /data-testid="text-sketch-rotate-hint">ภาพเอียง\? กดปุ่ม 'หมุน 90°' ที่การ์ดภาพก่อนให้ AI อ่าน/,
    );
    assert.match(studioPageSource, /next\.delete\(file\);\s*next\.set\(rotatedFile,/);
    assert.match(
      studioPageSource,
      /sketchAnalysisQueueRef\.current = sketchAnalysisQueueRef\.current\.then\(\(\) => analyzeSketch\(\[rotatedFile\]\)\)/,
    );
  });
});