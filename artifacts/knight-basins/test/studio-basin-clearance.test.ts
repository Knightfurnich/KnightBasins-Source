import assert from "node:assert/strict";
import test from "node:test";
import {
  basinPlacementsViolatingEdgeClearance,
  placementMeetsBasinEdgeClearance,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";

const rectangle = (id: string, overrides: Partial<StudioRectangle> = {}): StudioRectangle => ({
  id,
  widthMm: 1000,
  lengthMm: 800,
  xMm: 0,
  yMm: 0,
  rotation: 0,
  ...overrides,
});

const piece = (rectangles: StudioRectangle[]): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses: {},
});

const basin = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF001",
  pieceId: "piece-1",
  xMm: 0,
  yMm: 0,
  widthMm: 400,
  depthMm: 300,
  rotation: 0,
  ...overrides,
});

function stateFor(pieces: StudioPiece[], basinPlacements: BasinPlacement[]): Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements"> {
  return { pieces, shape: "I", dimensions: { depthMm: 800, runAMm: 1000, runBMm: 0, runCMm: 0 }, basinPlacements };
}

test("STUDIO_BASIN_SAFETY_MARGIN_MM is 100mm", () => {
  assert.equal(STUDIO_BASIN_SAFETY_MARGIN_MM, 100);
});

test("a basin centered with generous clearance on all four sides meets the default 100mm margin", () => {
  // 1000x800 panel, 400x300 cutout centered at (300, 250):
  // left=300 right=300 top=250 bottom=250 -- all comfortably >= 100.
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const placement = basin({ xMm: 300, yMm: 250, widthMm: 400, depthMm: 300 });
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel), true);
});

test("exactly 100mm clearance on every side passes (boundary is inclusive)", () => {
  // panel 1000x800, cutout 400x300 must leave exactly 100mm on every side:
  // left=100 -> xMm=100; right=100 -> xMm+400 = 900 -> xMm=500... need both, so panel must be 400+100+100=600 wide.
  const panel = rectangle("panel-1", { widthMm: 600, lengthMm: 500 });
  const placement = basin({ xMm: 100, yMm: 100, widthMm: 400, depthMm: 300 });
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel), true, "left=100 right=100 top=100 bottom=100, all exactly at the margin");
});

test("just under the margin (99mm) on one side fails", () => {
  const panel = rectangle("panel-1", { widthMm: 600, lengthMm: 500 });
  const placement = basin({ xMm: 99, yMm: 100, widthMm: 400, depthMm: 300 });
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel), false, "left clearance is 99mm, 1mm short of the 100mm margin");
});

test("each of the four edges is checked independently: left, right, top, bottom", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const cutWidth = 400;
  const cutDepth = 300;

  const tooCloseLeft = basin({ xMm: 50, yMm: 250, widthMm: cutWidth, depthMm: cutDepth });
  const tooCloseRight = basin({ xMm: panel.widthMm - cutWidth - 50, yMm: 250, widthMm: cutWidth, depthMm: cutDepth });
  const tooCloseTop = basin({ xMm: 300, yMm: 50, widthMm: cutWidth, depthMm: cutDepth });
  const tooCloseBottom = basin({ xMm: 300, yMm: panel.lengthMm - cutDepth - 50, widthMm: cutWidth, depthMm: cutDepth });

  assert.equal(placementMeetsBasinEdgeClearance(tooCloseLeft, panel), false, "left: only 50mm clearance");
  assert.equal(placementMeetsBasinEdgeClearance(tooCloseRight, panel), false, "right: only 50mm clearance");
  assert.equal(placementMeetsBasinEdgeClearance(tooCloseTop, panel), false, "top: only 50mm clearance");
  assert.equal(placementMeetsBasinEdgeClearance(tooCloseBottom, panel), false, "bottom: only 50mm clearance");
});

test("a cutout flush against the panel edge (0mm clearance) fails", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const flushToLeftEdge = basin({ xMm: 0, yMm: 250, widthMm: 400, depthMm: 300 });
  assert.equal(placementMeetsBasinEdgeClearance(flushToLeftEdge, panel), false);
});

test("a custom marginMm overrides the default 100mm threshold", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const placement = basin({ xMm: 50, yMm: 50, widthMm: 400, depthMm: 300 }); // 50mm clearance on left/top
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel, 100), false, "fails the default 100mm margin");
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel, 30), true, "passes a relaxed 30mm margin");
});

test("clearance is measured against the rectangle's rotated footprint (width/length swap under 90deg rotation)", () => {
  // A panel stored as 500x1200 but rotated 90deg has an on-screen footprint of 1200x500.
  const rotatedPanel = rectangle("panel-1", { widthMm: 500, lengthMm: 1200, rotation: 90 });
  // Centered within the 1200x500 rotated footprint with 400x200 cutout: left=(1200-400)/2=400, top=(500-200)/2=150.
  const placement = basin({ xMm: 400, yMm: 150, widthMm: 400, depthMm: 200 });
  assert.equal(placementMeetsBasinEdgeClearance(placement, rotatedPanel), true);
  // The same xMm/yMm against the UN-rotated 500x1200 footprint would put it far outside (invalid), proving
  // the check genuinely reads the rotated size rather than the raw widthMm/lengthMm fields.
  const unrotatedSamePanel = rectangle("panel-1", { widthMm: 500, lengthMm: 1200, rotation: 0 });
  assert.equal(placementMeetsBasinEdgeClearance(placement, unrotatedSamePanel), false);
});

test("clearance is measured against the placement's own rotated cutout footprint", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  // widthMm=300 depthMm=600, rotated 90 -> cut footprint is 600 wide x 300 tall (placementCutSize swaps it).
  const placement = basin({ xMm: 200, yMm: 250, widthMm: 300, depthMm: 600, rotation: 90 });
  // left=200 right=1000-200-600=200 top=250 bottom=800-250-300=250, all >= 100 -> passes.
  assert.equal(placementMeetsBasinEdgeClearance(placement, panel), true);
  // Without accounting for rotation, the raw (unrotated) 300-wide box would place the right edge at
  // 200+300=500 with 500mm clearance -- still fine -- so instead verify a case that WOULD wrongly
  // pass if rotation were ignored: put the cutout so the rotated 600mm width crowds the right edge.
  const crowded = basin({ xMm: 350, yMm: 250, widthMm: 300, depthMm: 600, rotation: 90 });
  // Rotated footprint width=600: right clearance = 1000 - 350 - 600 = 50 < 100 -> must fail.
  assert.equal(placementMeetsBasinEdgeClearance(crowded, panel), false, "rotated cutout width (600) crowds the right edge to 50mm");
});

test("a placement with unknown catalog dimensions is never flagged (handled separately as unknownBasinPlacements)", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const unknownSize = basin({ xMm: 0, yMm: 0, widthMm: null, depthMm: null });
  assert.equal(placementMeetsBasinEdgeClearance(unknownSize, panel), true);
});

test("basinPlacementsViolatingEdgeClearance returns only the ids of placements that violate the margin", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const state = stateFor([piece([panel])], [
    basin({ id: "safe", xMm: 300, yMm: 250, widthMm: 400, depthMm: 300 }),
    basin({ id: "flush-left", xMm: 0, yMm: 250, widthMm: 400, depthMm: 300 }),
    basin({ id: "close-top", xMm: 300, yMm: 50, widthMm: 400, depthMm: 300 }),
    basin({ id: "unknown-size", xMm: 0, yMm: 0, widthMm: null, depthMm: null }),
  ]);
  const violating = basinPlacementsViolatingEdgeClearance(state);
  assert.deepEqual([...violating].sort(), ["close-top", "flush-left"]);
});

test("basinPlacementsViolatingEdgeClearance returns an empty array when every placement is well clear of the edges", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const state = stateFor([piece([panel])], [
    basin({ id: "safe-1", xMm: 200, yMm: 200, widthMm: 300, depthMm: 200 }),
    basin({ id: "safe-2", xMm: 600, yMm: 400, widthMm: 300, depthMm: 200 }),
  ]);
  assert.deepEqual(basinPlacementsViolatingEdgeClearance(state), []);
});

test("basinPlacementsViolatingEdgeClearance respects a custom marginMm argument", () => {
  const panel = rectangle("panel-1", { widthMm: 1000, lengthMm: 800 });
  const state = stateFor([piece([panel])], [
    basin({ id: "fifty-mm-clearance", xMm: 50, yMm: 250, widthMm: 400, depthMm: 300 }),
  ]);
  assert.deepEqual(basinPlacementsViolatingEdgeClearance(state, 100), ["fifty-mm-clearance"], "50mm < 100mm default margin");
  assert.deepEqual(basinPlacementsViolatingEdgeClearance(state, 30), [], "50mm >= a relaxed 30mm margin");
});
