import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Regression guards for the "find and fix 2D Studio / Sketch bugs" round.
// Each assertion pins a behaviour that was verified broken against the real
// component before the fix; they are source-level because the repo has no
// component renderer in the test runner (see the other studio-*.test.ts files).

const studioPage = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

test("the share-plan link carries the counter depth, not only the width", () => {
  assert.match(studioPage, /url\.searchParams\.set\("depth", String\(Math\.round\(firstRectangle\.lengthMm\)\)\)/);
  // The reader side has to keep accepting it, or the write would be pointless.
  assert.match(studioPage, /studioSearchParams\.get\("depthMm"\) \?\? studioSearchParams\.get\("depth"\)/);
});

test("undo/redo flush an edit that is still inside the debounce window", () => {
  assert.match(studioPage, /const commitPendingSnapshot = useCallback/);
  // Both undo and redo must flush before moving the history index.
  assert.match(studioPage, /const undo = useCallback\(\(\) => \{\s*commitPendingSnapshot\(\);/);
  assert.match(studioPage, /const redo = useCallback\(\(\) => \{\s*commitPendingSnapshot\(\);/);
  // An edit that has not been committed yet still counts as undoable.
  assert.match(studioPage, /canUndo: indexRef\.current > 0 \|\| pendingSnapshot !== null/);
});

test("the sketch card renders the vision API's confidence level instead of dropping it", () => {
  assert.match(studioPage, /function sketchConfidenceLabel\(/);
  assert.match(studioPage, /const confidence = sketchConfidenceLabel\(analysis\.confidence\);/);
  // A string level must survive parsing; the old Number() coercion turned every
  // "high"/"medium"/"low" into NaN and printed "ยังไม่ระบุ".
  assert.match(studioPage, /confidence: number \| string \| null;/);
});

test("the share PNG button is disabled whenever the other export buttons are", () => {
  assert.match(studioPage, /disabled=\{!exportReady\} onClick=\{\(\) => void exportFiles\("png"\)\} data-testid="button-share-studio-png"/);
});

test("deleting a non-active workpiece keeps the editor on the active one", () => {
  assert.match(studioPage, /const wasActive = \(current\.activePieceId \?\? pieceId\) === pieceId;/);
  assert.match(studioPage, /activePieceId: wasActive \? \(remaining\[0\]\?\.id \?\? ""\) : current\.activePieceId/);
});
