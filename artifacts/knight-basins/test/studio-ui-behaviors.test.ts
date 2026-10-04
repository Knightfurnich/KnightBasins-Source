import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

function sourceBetween(start: string, end: string) {
  const startIndex = studioPageSource.indexOf(start);
  const endIndex = studioPageSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return studioPageSource.slice(startIndex, endIndex);
}

test("Studio share links include the first slab width and depth", () => {
  const shareLink = sourceBetween("const copyStudioShareLinkToClipboard", "const exportFiles");
  assert.match(shareLink, /url\.searchParams\.set\("width",\s*String\(Math\.round\(firstRectangle\.widthMm\)\)\)/);
  assert.match(shareLink, /url\.searchParams\.set\("depth",\s*String\(Math\.round\(firstRectangle\.lengthMm\)\)\)/);
});

test("Undo and Redo flush the pending debounced Studio snapshot first", () => {
  const historyHook = sourceBetween("function useUndoableStudioState", "function restrictStudioDiscountForMode");
  assert.match(historyHook, /const flushPendingSnapshot = useCallback\(\(\) =>/);
  assert.match(historyHook, /pendingTimerRef\.current = window\.setTimeout\(flushPendingSnapshot,\s*STUDIO_HISTORY_DEBOUNCE_MS\)/);
  assert.match(historyHook, /const undo = useCallback\(\(\) => \{\s*flushPendingSnapshot\(\)/);
  assert.match(historyHook, /const redo = useCallback\(\(\) => \{\s*flushPendingSnapshot\(\)/);
  assert.match(historyHook, /canUndo:\s*indexRef\.current > 0 \|\| pendingSnapshotRef\.current !== null/);
});

test("Sketch analysis confidence uses Thai low, medium, and high labels", () => {
  assert.match(studioPageSource, /confidencePercent >= 80 \? "สูง" : confidencePercent >= 50 \? "ปานกลาง" : "ต่ำ"/);
  assert.match(studioPageSource, /ความมั่นใจ: \{confidence\}/);
});

test("Studio PNG sharing stays disabled until the layout is export-ready", () => {
  assert.match(
    studioPageSource,
    /<button type="button" className="button button--accent" disabled=\{!exportReady\} onClick=\{\(\) => void exportFiles\("png"\)\} data-testid="button-share-studio-png">/,
  );
});

test("deleting a non-active workpiece preserves the active workpiece", () => {
  const canvasRemoval = sourceBetween(
    "const removePiece = (pieceId: string) =>",
    "return <section className=\"studio-panel studio-canvas-panel\">",
  );
  assert.match(
    canvasRemoval,
    /const nextActiveId = remaining\.some\(\(remainingPiece\) => remainingPiece\.id === current\.activePieceId\)\s*\?\s*current\.activePieceId\s*:\s*remaining\[0\]\?\.id \?\? ""/,
    "removing another piece must not change the active piece ID",
  );
});

test("legacy Studio drafts without saved pieces restore a clean slab and show a Thai notice", () => {
  const restore = sourceBetween("function restoreStudioDraftState", "function linkedLeadStudioState");
  assert.match(restore, /const hasSavedPieces = savedPieces !== null/);
  assert.match(restore, /buildWizardPiece\([\s\S]*?"i",\s*\[dimensions\.runAMm\],\s*dimensions\.depthMm/);
  assert.match(restore, /const shape = hasSavedPieces[\s\S]*?:\s*"I"/);
  assert.match(restore, /basinPlacements:\s*hasSavedPieces \? placements : \[\]/);
  assert.ok(studioPageSource.includes("แบบร่างเก่าไม่มีข้อมูลชิ้นงาน จึงเริ่มผังใหม่จากแผ่นหลัก กรุณาจัดวางชิ้นงานอีกครั้ง"));
});