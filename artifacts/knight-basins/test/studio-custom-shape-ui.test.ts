import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
const studioModelSource = readFileSync(new URL("../src/data/studio-model.ts", import.meta.url), "utf8");

test("custom shape panel removes the standard counter-size preset UI", () => {
  assert.doesNotMatch(studioPageSource, /studio-size-presets|STUDIO_COUNTER_PRESETS/);
});

test("custom shape panel exposes per-piece length and depth fields", () => {
  assert.ok(studioPageSource.includes("data-testid={`input-piece-${index}-length`}"));
  assert.ok(studioPageSource.includes("data-testid={`input-piece-${index}-depth`}"));
});

test("each physical edge has a selector and panel joints are locked", () => {
  assert.ok(studioPageSource.includes("data-testid={`select-edge-${index}-${testSide}`}"));
  assert.ok(studioPageSource.includes('value: "upstand", label: "ติดบัว ▲"'));
  assert.ok(studioPageSource.includes('value: "wall-flush", label: "ชิดผนัง ║"'));
  assert.ok(studioPageSource.includes('value: "wall-flush+upstand", label: "ชิดผนัง + ติดบัว ║▲"'));
  assert.ok(studioPageSource.includes('value: "open-edge", label: "ขอบเปิด ⊗"'));
  assert.ok(studioPageSource.includes("disabled={isLocked}"));
  assert.ok(studioPageSource.includes("🔗 รอยต่อชนแผ่น"));
});

test("the apply action assembles and commits the selected custom shape", () => {
  assert.ok(studioPageSource.includes('data-testid="button-apply-custom-shape"'));
  // job-209 moved the piece rebuild out of StudioPage: the page hands the panels to applyCustomShapeToState.
  assert.match(studioPageSource, /applyCustomShapeToState\(state,\s*targetPiece\.id,\s*preset,\s*shapePanels\)/);
  assert.match(studioModelSource, /buildCustomShapePiece\(currentPiece\.id,\s*preset,\s*panels\)/);
  assert.ok(studioPageSource.includes("onClick={applyCustomShape}"));
});