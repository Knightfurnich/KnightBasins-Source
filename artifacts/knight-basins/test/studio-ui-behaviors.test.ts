import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

function sourceBetween(start: string, end: string) {
  const startIndex = studioPageSource.indexOf(start);
  const endIndex = studioPageSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return studioPageSource.slice(startIndex, endIndex);
}

function executeStudioFunctions(...functionNames: string[]) {
  const sourceFile = ts.createSourceFile(
    "StudioPage.tsx",
    studioPageSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = functionNames.map((functionName) => {
    const declaration = sourceFile.statements.find((statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
    );
    assert.ok(declaration, `Missing function to execute: ${functionName}`);
    return declaration.getText(sourceFile);
  });
  const javascript = ts.transpileModule(declarations.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const sandbox: { functions?: Record<string, (value: unknown) => unknown> } = {};
  runInNewContext(`${javascript}\nfunctions = { ${functionNames.join(", ")} };`, sandbox);
  assert.ok(sandbox.functions);
  return sandbox.functions;
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

test("Sketch confidence parser maps categorical API values and preserves numeric confidence", () => {
  const { parseSketchAnalysis, normalizeSketchConfidence, formatSketchConfidence } = executeStudioFunctions(
    "sketchAnalysisRecord",
    "parseSketchShape",
    "positiveSketchDimension",
    "normalizeSketchConfidence",
    "parseSketchAnalysis",
    "formatSketchConfidence",
  );
  const payload = { items: [
    { confidence: "high" },
    { confidence: "medium" },
    { confidence: "low" },
  ] };
  for (const [index, apiValue, thaiLabel] of [
    [0, "high", "สูง"],
    [1, "medium", "ปานกลาง"],
    [2, "low", "ต่ำ"],
  ] as const) {
    const analysis = parseSketchAnalysis(payload, index);
    assert.equal(analysis.confidence, apiValue);
    assert.equal(formatSketchConfidence(analysis.confidence), thaiLabel);
  }
  const highValueWithSpaces = parseSketchAnalysis({ items: [{ confidence: " HIGH " }] });
  assert.equal(highValueWithSpaces.confidence, "high");
  assert.equal(formatSketchConfidence(highValueWithSpaces.confidence), "สูง");
  for (const [apiValue, thaiLabel] of [
    ["สูง", "สูง"],
    ["ปานกลาง", "ปานกลาง"],
    ["ต่ำ", "ต่ำ"],
  ] as const) {
    const analysis = parseSketchAnalysis({ confidence: apiValue });
    assert.equal(formatSketchConfidence(analysis.confidence), thaiLabel);
  }
  assert.equal(
    formatSketchConfidence(parseSketchAnalysis({ confidence: 0.9 }).confidence),
    "สูง (90%)",
  );
  assert.equal(
    formatSketchConfidence(parseSketchAnalysis({ confidence: 0.64 }).confidence),
    "ปานกลาง (64%)",
  );
  assert.equal(
    formatSketchConfidence(parseSketchAnalysis({ confidence: 0.2 }).confidence),
    "ต่ำ (20%)",
  );
  assert.equal(
    formatSketchConfidence(parseSketchAnalysis({ confidence: "0.75" }).confidence),
    "ปานกลาง (75%)",
  );
  assert.ok(studioPageSource.includes("formatSketchConfidence(analysis.confidence)"));
});

test("legacy autosave drafts without saved pieces restore a clean slab and show the Thai notice", () => {
  const resumeDraft = sourceBetween("const resumeDraft = () =>", "const startNewDraft = () =>");
  assert.match(resumeDraft, /studioDraftPiecesFromEdges\(\{\s*pieces:\s*savedState\.pieces\s*\}\)/);
  assert.match(resumeDraft, /if \(hasSavedPieces\)[\s\S]*?setAssembledStudioRoute\(studioRouteKey\)/);
  assert.match(resumeDraft, /restoreStudioDraftState\(current,\s*draftNotice\.state/);
  assert.match(resumeDraft, /setAssembledStudioRoute\(null\)/);
  assert.match(resumeDraft, /แบบร่างเก่าไม่มีข้อมูลชิ้นงาน จึงเริ่มผังใหม่จากแผ่นหลัก กรุณาจัดวางชิ้นงานอีกครั้ง/);
});

test("remote legacy drafts restore a clean slab and show the Thai notice", () => {
  const remoteLoad = sourceBetween("void customFetch<unknown>(`/api/studio/draft/", "return () => {");
  assert.match(remoteLoad, /if \(hasSavedPieces\) \{\s*setDraftResult\("เปิดแบบร่างจากลิงก์แล้ว"\)/);
  assert.match(remoteLoad, /แบบร่างเก่าไม่มีข้อมูลชิ้นงาน จึงเริ่มผังใหม่จากแผ่นหลัก กรุณาจัดวางชิ้นงานอีกครั้ง/);
});

test("restoring an assembled draft unlocks its estimate, export, and send actions", () => {
  const resumeDraft = sourceBetween("const resumeDraft = () =>", "const startNewDraft = () =>");
  const remoteRestore = sourceBetween("function restoreStudioDraftState", "function linkedLeadStudioState");
  assert.ok(resumeDraft.includes("setAssembledStudioRoute(studioRouteKey)"));
  assert.ok(studioPageSource.includes("if (hasSavedPieces) setAssembledStudioRoute(studioRouteKey)"));
  assert.match(studioPageSource, /const exportReady = mode === "studio" && studioLayoutApplied/);
  assert.ok(studioPageSource.includes("data-testid=\"studio-estimate-not-ready\""));
  assert.ok(remoteRestore.includes("basinPlacements: hasSavedPieces ? placements : []"));
});

test("sketch attachments are analyzed in one multipart request and failures retain their causes", () => {
  const analyzeSketch = sourceBetween("const analyzeSketch = async", "const rotateSketchAtIndex");
  assert.match(analyzeSketch, /const requestedFiles = files\.filter/);
  assert.match(analyzeSketch, /filesToSend\.forEach\(\(file\) => formData\.append\("file", file\)\)/);
  assert.equal((analyzeSketch.match(/fetch\("\/api\/sketch\/analyze"/g) ?? []).length, 1);
  assert.match(analyzeSketch, /parseSketchAnalysis\(payload,\s*index\)/);
  assert.match(analyzeSketch, /MAX_SKETCH_ANALYSIS_FILE_BYTES/);
  assert.match(analyzeSketch, /sketchAnalysisFailureMessage\("network"\)/);
  assert.match(analyzeSketch, /sketchAnalysisFailureMessage\("rate-limit"\)/);
  assert.match(analyzeSketch, /fileTooLargeMessage/);
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