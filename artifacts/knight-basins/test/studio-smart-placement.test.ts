/**
 * Smart basin placement when the counter shape changes (job-209).
 *
 * PR #166 stopped the Studio from deleting the customer's basin on a shape change; this pins
 * the rest of the behaviour: a basin that is still fine stays where it is, a basin that has to
 * move keeps its relative position and the safety clearance, basins never overlap or vanish,
 * and the customer is told what happened. The decision logic is pure (studio-model.ts), so
 * these tests run the real functions, not source text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createStudioExportModel } from "../src/data/studio-export.ts";
import {
  applyCustomShapeToState,
  basinPlacementOverlapWarnings,
  basinPlacementsViolatingEdgeClearance,
  buildCustomShapePiece,
  calculateBasinCoordinates,
  placementCutSize,
  reanchorPlacementsToPiece,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type StudioPiece,
  type StudioPreset,
  type StudioState,
} from "../src/data/studio-model.ts";

const EDGES = { top: "normal", right: "normal", bottom: "normal", left: "normal" } as const;
const panels = (...sizes: Array<[widthMm: number, depthMm: number]>) =>
  sizes.map(([widthMm, depthMm]) => ({ widthMm, depthMm, edges: { ...EDGES } }));
const piece = (preset: StudioPreset, ...sizes: Array<[number, number]>): StudioPiece => ({
  ...buildCustomShapePiece("piece-1", preset, panels(...sizes)),
  name: "ชิ้นงาน 1",
});

// KF003-class basin: stored 350 wide x 500 deep, so 350 x 500 as horizontal and 500 x 350 once rotated.
const basin = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF003",
  pieceId: "piece-1",
  sheetId: "piece-1-1",
  xMm: 725,
  yMm: 100,
  widthMm: 350,
  depthMm: 500,
  ...overrides,
});

const stateOf = (counter: StudioPiece, basinPlacements: BasinPlacement[]): StudioState => ({
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 700, runAMm: 1800, runBMm: 0, runCMm: 0 },
  pieces: [counter],
  activePieceId: counter.id,
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 0,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010"],
  activeStone: "BW010",
  basinSkus: ["KF003"],
  basinPlacements,
});

const violations = (counter: StudioPiece, placements: BasinPlacement[]) =>
  basinPlacementsViolatingEdgeClearance(stateOf(counter, placements));

describe("reanchorPlacementsToPiece (job-209)", () => {
  it("leaves a basin exactly where it is when it is still valid in the new shape (I -> L right, 700 mm deep)", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("l-right", [1800, 700], [1000, 700]);
    const result = reanchorPlacementsToPiece([basin()], before, after);
    assert.equal(result.placements.length, 1);
    assert.equal(result.placements[0]!.xMm, 725);
    assert.equal(result.placements[0]!.yMm, 100);
    assert.ok(after.rectangles.some((rectangle) => rectangle.id === result.placements[0]!.sheetId));
    assert.deepEqual(result.notices, []);
    assert.deepEqual(violations(after, result.placements), []);
  });

  it("moves a basin whose sheet shrank to the same relative spot, inside the safety clearance, and says so", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("l-right", [1000, 700], [1000, 700]);
    const result = reanchorPlacementsToPiece([basin({ xMm: 1300 })], before, after);
    const moved = result.placements[0]!;
    assert.equal(moved.xMm, 1000 - 350 - STUDIO_BASIN_SAFETY_MARGIN_MM, "kept as far right as the clearance allows");
    assert.equal(moved.yMm, 100);
    assert.deepEqual(result.notices, [{ placementId: "basin-1", sku: "KF003", kind: "moved" }]);
    assert.deepEqual(violations(after, result.placements), []);
  });

  it("never deletes a basin that met the clearance before but cannot now: it is kept, centred, and reported no-fit", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("i", [1800, 560]);
    const result = reanchorPlacementsToPiece([basin()], before, after);
    assert.equal(result.placements.length, 1);
    assert.equal(result.placements[0]!.id, "basin-1");
    assert.equal(result.placements[0]!.yMm, 30, "centred on the roomiest sheet: (560 - 500) / 2");
    assert.deepEqual(result.notices, [{ placementId: "basin-1", sku: "KF003", kind: "no-fit" }]);
  });

  it("does not move or report a basin that already broke the clearance before the change (500 deep on a 600 counter)", () => {
    const before = piece("i", [1800, 600]);
    const after = piece("l-right", [1800, 600], [1000, 600]);
    const original = basin({ yMm: 50 });
    assert.equal(violations(before, [original]).length, 1, "precondition: it already violates the clearance");
    const result = reanchorPlacementsToPiece([original], before, after);
    assert.equal(result.placements[0]!.xMm, 725);
    assert.equal(result.placements[0]!.yMm, 50);
    assert.deepEqual(result.notices, []);
  });

  it("spreads basins that would land on top of each other and keeps both", () => {
    const before = piece("l-right", [1800, 700], [1000, 700]);
    const leg = before.rectangles[1]!;
    const onBackRun = basin({ id: "basin-a", xMm: 725, yMm: 100 });
    const onLeg = basin({ id: "basin-b", sheetId: leg.id, xMm: leg.xMm + 100, yMm: leg.yMm + 100 });
    const after = piece("i", [1800, 700]);
    const result = reanchorPlacementsToPiece([onBackRun, onLeg], before, after);
    assert.deepEqual(result.placements.map((placement) => placement.id), ["basin-a", "basin-b"]);
    assert.deepEqual(basinPlacementOverlapWarnings({ basinPlacements: result.placements }), []);
    assert.deepEqual(violations(after, result.placements), []);
    assert.ok(result.notices.some((notice) => notice.placementId === "basin-b"));
  });

  it("keeps basins that cannot all fit and reports the overlap instead of dropping one", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("i", [700, 700]);
    const result = reanchorPlacementsToPiece(
      [basin({ id: "basin-a", xMm: 100 }), basin({ id: "basin-b", xMm: 1300 })],
      before,
      after,
    );
    assert.equal(result.placements.length, 2);
    assert.ok(result.notices.some((notice) => notice.kind === "overlap"));
  });

  it("keeps a rotated basin's rotation, ids and footprint (500 x 350 once rotated)", () => {
    const before = piece("i", [1800, 600]);
    const after = piece("i", [800, 600]);
    const rotated = basin({ rotation: 90, orientation: "vertical", xMm: 650, yMm: 125 });
    const result = reanchorPlacementsToPiece([rotated], before, after);
    const placement = result.placements[0]!;
    assert.equal(placement.rotation, 90);
    assert.equal(placement.orientation, "vertical");
    assert.equal(placement.widthMm, 350);
    assert.equal(placement.depthMm, 500);
    assert.deepEqual(placementCutSize(placement), { widthMm: 500, heightMm: 350 });
    assert.equal(placement.xMm, 150, "the cut-out's centre keeps its relative position (middle of the sheet): 800 / 2 - 500 / 2");
    assert.deepEqual(violations(after, result.placements), []);
  });

  it("treats a legacy draft that only has orientation: vertical the same way", () => {
    const before = piece("i", [1800, 600]);
    const after = piece("i", [800, 600]);
    const legacy = basin({ orientation: "vertical", xMm: 650, yMm: 125 });
    const placement = reanchorPlacementsToPiece([legacy], before, after).placements[0]!;
    assert.deepEqual(placementCutSize(placement), { widthMm: 500, heightMm: 350 });
    assert.deepEqual(violations(after, [placement]), []);
  });

  it("keeps anchor/offset placements consistent with their coordinates", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("i", [1000, 700]);
    const anchored = basin({ xMm: 1300, anchor: "top-right", offsetXMm: 150, offsetYMm: 100 });
    const placement = reanchorPlacementsToPiece([anchored], before, after).placements[0]!;
    const sheet = after.rectangles.find((rectangle) => rectangle.id === placement.sheetId)!;
    assert.deepEqual(calculateBasinCoordinates(sheet, placement), { xMm: placement.xMm, yMm: placement.yMm });
  });

  it("keeps an unknown-size basin and only repairs its sheet reference; other pieces are untouched", () => {
    const before = piece("i", [1800, 700]);
    const after = piece("i", [1000, 700]);
    const unknown = basin({ id: "unknown", sheetId: "piece-1-gone", widthMm: null, depthMm: null });
    const elsewhere = basin({ id: "other-piece", pieceId: "piece-2", xMm: 1300 });
    const result = reanchorPlacementsToPiece([unknown, elsewhere], before, after);
    assert.equal(result.placements[0]!.sheetId, "piece-1-1");
    assert.equal(result.placements[0]!.widthMm, null);
    assert.equal(result.placements[1], elsewhere, "a placement of another piece is returned as the same object");
    assert.deepEqual(result.notices, []);
  });
});

describe("applyCustomShapeToState (job-209)", () => {
  it("carries the basin over when the shape changes I -> L right, and never filters placements away", () => {
    const counter = piece("i", [1800, 700]);
    const { state, notices } = applyCustomShapeToState(stateOf(counter, [basin()]), "piece-1", "l-right", panels([1800, 700], [1000, 700]));
    assert.equal(state.shape, "L");
    assert.equal(state.basinPlacements.length, 1);
    assert.equal(state.basinPlacements[0]!.id, "basin-1");
    assert.equal(state.activePieceId, "piece-1");
    assert.equal(state.pieces![0]!.rectangles.length, 2);
    assert.deepEqual(notices, []);
  });

  it("keeps the placements untouched (same array) when the geometry did not change", () => {
    const counter = piece("i", [1800, 700]);
    const start = stateOf(counter, [basin()]);
    const { state, notices } = applyCustomShapeToState(start, "piece-1", "i", panels([1800, 700]));
    assert.equal(state.basinPlacements, start.basinPlacements);
    assert.deepEqual(notices, []);
  });

  it("returns the same state when the target piece does not exist", () => {
    const start = stateOf(piece("i", [1800, 700]), [basin()]);
    const { state, notices } = applyCustomShapeToState(start, "missing", "l-right", panels([1800, 700], [1000, 700]));
    assert.equal(state, start);
    assert.deepEqual(notices, []);
  });

  it("round-trips I -> L right -> U -> I with the basin kept and inside the clearance each time", () => {
    let current = stateOf(piece("i", [1800, 700]), [basin()]);
    for (const [preset, sizes] of [
      ["l-right", [[1800, 700], [1000, 700]]],
      ["u", [[1800, 700], [1000, 700], [1000, 700]]],
      ["i", [[1800, 700]]],
    ] as const) {
      current = applyCustomShapeToState(current, "piece-1", preset, panels(...(sizes as unknown as Array<[number, number]>))).state;
      assert.equal(current.basinPlacements.length, 1, `basin lost after switching to ${preset}`);
      assert.deepEqual(basinPlacementsViolatingEdgeClearance(current), [], `clearance broken after ${preset}`);
    }
  });
});

describe("downstream consumers see the re-anchored basin (job-209)", () => {
  it("the DXF export model uses the rotated footprint of a re-anchored basin", () => {
    const counter = piece("i", [1800, 600]);
    const start = stateOf(counter, [basin({ rotation: 90, orientation: "vertical", xMm: 650, yMm: 125 })]);
    const { state } = applyCustomShapeToState(start, "piece-1", "l-right", panels([800, 600], [600, 900]));
    const placement = state.basinPlacements[0]!;
    const exported = createStudioExportModel(state).basins[0]!;
    const cut = placementCutSize(placement);
    assert.equal(exported.widthMm, cut.widthMm);
    assert.equal(exported.heightMm, cut.heightMm);
    assert.deepEqual(cut, { widthMm: 500, heightMm: 350 });
  });
});

describe("StudioPage wiring (job-209)", () => {
  const source = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
  const applyBody = (() => {
    const start = source.indexOf("const applyCustomShape = () => {");
    const end = source.indexOf("onApplied({", start);
    assert.ok(start >= 0 && end > start, "applyCustomShape should still exist");
    return source.slice(start, end);
  })();

  it("applyCustomShape delegates to applyCustomShapeToState and never filters placements", () => {
    assert.match(applyBody, /applyCustomShapeToState\(state,\s*targetPiece\.id,\s*preset,\s*shapePanels\)/);
    assert.doesNotMatch(applyBody, /basinPlacements\.filter\(/);
  });

  it("offers an undo for the shape change and a notice for moved basins", () => {
    assert.match(source, /data-testid="button-studio-shape-undo"/);
    assert.match(source, /data-testid="status-studio-shape-change-notice"/);
    assert.match(source, /role="status"/);
    assert.match(source, /key=\{shapePanelVersion\}/, "undo remounts the shape panel so it shows the restored shape");
    assert.match(source, /setShapePanelVersion\(\(version\) => version \+ 1\)/);
  });

  it("both remove-basin buttons go through removeBasinPlacementWithUndo (no silent delete)", () => {
    assert.equal((source.match(/removeBasinPlacementWithUndo\(placement, setState\)/g) ?? []).length, 2);
    assert.match(source, /data-testid="button-studio-basin-remove-undo"/);
    assert.match(
      source,
      /basinPlacements:\s*current\.basinPlacements\.filter\(\(item\)\s*=>\s*item\.id !== placement\.id\)/,
      "only the explicit remove path may delete a placement",
    );
  });

  it("does not hard-code the clearance and does not use the legacy orientation setter", () => {
    const model = readFileSync(new URL("../src/data/studio-model.ts", import.meta.url), "utf8");
    const reanchor = model.slice(model.indexOf("export function reanchorPlacementsToPiece"), model.indexOf("export function applyCustomShapeToState"));
    assert.match(reanchor, /STUDIO_BASIN_SAFETY_MARGIN_MM/);
    assert.doesNotMatch(reanchor, /\b100\b/);
    assert.doesNotMatch(reanchor, /setBasinPlacementOrientation/);
  });
});
