import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const studioPageSource = readFileSync(path.join(testDirectory, "../src/components/StudioPage.tsx"), "utf8");
const styleSource = readFileSync(path.join(testDirectory, "../src/index.css"), "utf8");

test("sketch analysis supports workpieces, panels, cutouts and edge labels", () => {
  assert.match(studioPageSource, /function parseSketchWorkpiece/);
  assert.match(studioPageSource, /workpieceCount/);
  assert.match(studioPageSource, /studio-sketch-workpiece-card/);
  assert.match(studioPageSource, /studio-sketch-panel-badge/);
  assert.match(studioPageSource, /studio-sketch-edge-badge/);
  assert.match(studioPageSource, /studio-sketch-cutout-note/);
  assert.match(studioPageSource, /คิดราคาเต็มผืน ไม่หักช่องเจาะ/);

  for (const [status, label] of [
    ["upstand", "ติดบัว ▲"],
    ["wall-flush", "ชิดผนัง ║"],
    ["open-edge", "ขอบเปิด ⊗"],
    ["closed-edge", "ขอบปิด ⊞"],
  ]) {
    assert.ok(studioPageSource.includes(`if (status === "${status}") return "${label}"`));
  }
});

test("sketch bridge submits the lead and opens Studio with all requested query values", () => {
  assert.match(studioPageSource, /data-testid="button-submit-sketch-lead"/);
  assert.match(studioPageSource, /data-testid="button-bridge-to-studio"/);
  assert.match(studioPageSource, /setLocation\(`\/studio\?\$\{params\.toString\(\)\}`\)/);
  for (const key of ["shape", "runAMm", "depthMm", "stoneColor", "basinSku"]) {
    assert.ok(studioPageSource.includes(`params.set("${key}"`), `bridge query includes ${key}`);
  }
  assert.match(studioPageSource, /studioSearchParams\.get\("runAMm"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("depthMm"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("stoneColor"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("basinSku"\)/);
});

test("bridge buttons stay stacked on mobile without replacing the legacy submit target", () => {
  assert.match(studioPageSource, /data-testid="button-submit-sketch"/);
  assert.match(styleSource, /\.studio-sketch-button-pair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});