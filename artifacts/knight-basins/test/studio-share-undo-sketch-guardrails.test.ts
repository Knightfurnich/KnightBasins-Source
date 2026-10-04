import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Job 242-F guardrails.
//
// These are static source-inspection tests (the convention used across this
// suite for UI fixes — see studio-draft-resume-ui.test.ts): importing a full
// React page component into the Node test runner is not supported, so each
// assertion pins the exact behaviour the fix must keep in StudioPage.tsx.
const studioPageSource = readFileSync(
  new URL("../src/components/StudioPage.tsx", import.meta.url),
  "utf8",
);

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = studioPageSource.indexOf(startMarker);
  assert.notEqual(start, -1, `expected to find "${startMarker}"`);
  const end = studioPageSource.indexOf(endMarker, start);
  assert.notEqual(end, -1, `expected to find "${endMarker}" after "${startMarker}"`);
  return studioPageSource.slice(start, end);
}

test("1. the layout share link carries depth, not just width", () => {
  const shareLink = sliceBetween(
    "const copyStudioShareLinkToClipboard = async () => {",
    "const exportFiles = async (format:",
  );

  assert.match(shareLink, /url\.searchParams\.set\("width", String\(Math\.round\(firstRectangle\.widthMm\)\)\)/);
  assert.match(
    shareLink,
    /url\.searchParams\.set\("depth", String\(Math\.round\(firstRectangle\.lengthMm\)\)\)/,
    "the share link must include a depth parameter or it reopens at the default 600 mm",
  );
  // The reader already accepts depthMm/depth, so the writer must match it.
  assert.match(studioPageSource, /studioSearchParams\.get\("depthMm"\) \?\? studioSearchParams\.get\("depth"\)/);
});

test("2. undo keeps pending (uncommitted) edits as their own step", () => {
  const history = sliceBetween(
    "function useUndoableStudioState(",
    "export function restrictStudioDiscountForMode",
  );

  assert.match(history, /pendingRef/, "a pending snapshot ref is required to keep the waiting edit");
  assert.match(history, /const flushPending = useCallback\(\(\) => \{/);
  assert.match(history, /flushPending\(\);\s*\n\s*if \(indexRef\.current <= 0\)/, "undo must flush the pending edit before moving the index");
  assert.match(
    history,
    /canUndo = indexRef\.current > 0 \|\| \(pendingRef\.current !== null && pendingRef\.current !== committedHead\)/,
    "an uncommitted edit must count as undoable",
  );
  assert.match(
    history,
    /if \(pendingRef\.current !== null && pendingRef\.current !== historyRef\.current\[indexRef\.current\]\) \{\s*\n\s*commit\(pendingRef\.current\)/,
    "a new edit must commit the previous waiting edit so the middle step is never lost",
  );
});

test("3. the sketch confidence card accepts word values and never shows NaN", () => {
  assert.match(studioPageSource, /type SketchConfidence = number \| SketchConfidenceWord \| null;/);
  const normalizer = sliceBetween(
    "function normalizeSketchConfidenceWord(",
    "function isLegacyStudioDraftState(",
  );
  assert.match(normalizer, /case "high":/);
  assert.match(normalizer, /case "medium":/);
  assert.match(normalizer, /case "low":/);

  const parser = sliceBetween("const rawConfidence = result.confidence;", "const rawNotes = result.notes;");
  assert.match(parser, /normalizeSketchConfidenceWord\(rawConfidence\)/, "word confidence must be normalised before the numeric fallback");
  assert.match(parser, /Number\.isFinite\(Number\(rawConfidence\)\)/, "numeric 0-1 confidence must still be supported");

  assert.match(
    studioPageSource,
    /typeof analysis\.confidence === "string"\s*\n\s*\?\s*sketchConfidenceLabel\(analysis\.confidence\)/,
    "the card must render the word (สูง/ปานกลาง/ต่ำ) instead of Math.round on a string",
  );
});

test("4. the share PNG button is disabled while export is not ready", () => {
  assert.match(
    studioPageSource,
    /className="button button--accent" disabled=\{!exportReady\} onClick=\{\(\) => void exportFiles\("png"\)\} data-testid="button-share-studio-png"/,
  );
});

test("5. deleting a background workpiece tab keeps the active workpiece", () => {
  const removePiece = sliceBetween(
    "const removePiece = (pieceId: string) => {",
    "return <section className=\"studio-panel studio-canvas-panel\">",
  );

  assert.match(
    removePiece,
    /current\.activePieceId && remaining\.some\(\(p\) => p\.id === current\.activePieceId\)\s*\n\s*\?\s*current\.activePieceId\s*\n\s*:\s*remaining\[0\]\?\.id \?\? ""/,
    "activePieceId must only fall back when the deleted piece was the active one",
  );
});

test("6. old-format drafts start fresh with a Thai notice instead of a broken layout", () => {
  assert.match(studioPageSource, /function isLegacyStudioDraftState\(value: unknown\): boolean \{/);
  const reader = sliceBetween("function readLinkedDraft() {", "function studioDataRecord(");
  assert.match(reader, /const legacy = decodedState !== null && isLegacyStudioDraftState\(decodedState\);/);
  assert.match(reader, /state: legacy \? null : decodedState,/);
  assert.match(reader, /legacy,/);
  assert.match(
    studioPageSource,
    /linkedDraft\.token && linkedDraft\.legacy\s*\n\s*\?\s*"แบบร่างนี้เป็นรูปแบบเก่า \(ก่อนระบบชิ้นงาน\) ระบบเริ่มผังใหม่ให้แล้ว กรุณาออกแบบใหม่"/,
  );
});
