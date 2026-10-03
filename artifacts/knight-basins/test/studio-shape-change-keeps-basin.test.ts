/**
 * Guards the Studio shape-change path against silently deleting the customer's
 * basin (job-208).
 *
 * Reported on production: opening /studio?basin=KF003 shows the basin on the
 * straight run, but switching the counter to "L ขวา" and pressing
 * "ประกอบผังลงกระดาน" made the basin disappear. Root cause: applyCustomShape
 * treated any geometry change as a reason to drop every placement of the piece
 * (`basinPlacements.filter(...)`), which silently removes the cut-out from the
 * quotation, the saved draft and the workshop plan.
 *
 * These are static source assertions (the same pattern as the other Studio UI
 * guards in this folder): they pin the behaviour so the deleting branch cannot
 * come back without a deliberate change here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildCustomShapePiece, clampPlacementToSheet, placementFitsStudioPiece } from "../src/data/studio-model.ts";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

/** The body of applyCustomShape, from its declaration up to the closing of setState. */
function applyCustomShapeBody(): string {
  const start = studioPageSource.indexOf("const applyCustomShape = () => {");
  assert.ok(start >= 0, "applyCustomShape should still exist in StudioPage.tsx");
  const end = studioPageSource.indexOf("onApplied();", start);
  assert.ok(end > start, "applyCustomShape should still call onApplied()");
  return studioPageSource.slice(start, end);
}

describe("studio shape change keeps the basin (job-208)", () => {
  it("does not filter basin placements out of the changed piece", () => {
    const body = applyCustomShapeBody();
    assert.doesNotMatch(
      body,
      /basinPlacements:\s*geometryChanged\s*\?\s*current\.basinPlacements\.filter\(/s,
      "the geometry-changed branch must never delete placements",
    );
    assert.doesNotMatch(
      body,
      /basinPlacements\.filter\(\(placement\)\s*=>\s*\(placement\.pieceId\s*\?\?\s*currentPiece\.id\)\s*!==\s*currentPiece\.id\)/s,
      "the old drop-this-piece's-basins filter must not return",
    );
  });

  it("re-anchors the placements into the rebuilt piece with the sheet-aware clamp", () => {
    const body = applyCustomShapeBody();
    assert.match(
      body,
      /clampPlacementToSheet\(placement,\s*builtPiece,\s*placement\.xMm,\s*placement\.yMm\)/,
      "placements must be re-clamped against the rebuilt piece",
    );
    assert.match(body, /current\.basinPlacements\.map\(/, "placements must be mapped (kept), not filtered away");
  });

  it("keeps a placement whose sheet id no longer exists by pointing it at the first sheet", () => {
    const body = applyCustomShapeBody();
    assert.match(
      body,
      /sheetStillExists\s*=\s*builtPiece\.rectangles\.some\(/,
      "the rebuilt piece's sheet ids must be checked",
    );
    assert.match(
      body,
      /sheetId:\s*sheetStillExists\s*\?\s*placement\.sheetId\s*:\s*builtPiece\.rectangles\[0\]\?\.id/,
      "a stale sheet id must fall back to the piece's first sheet instead of dropping the basin",
    );
  });

  it("still updates the counter shape and the active piece", () => {
    const body = applyCustomShapeBody();
    assert.match(body, /shape:\s*preset === "i" \? "I" : preset === "u" \? "U" : "L"/, "shape must still be set from the preset");
    assert.match(body, /activePieceId:\s*builtPiece\.id/, "the rebuilt piece must still become active");
  });

  it("renders basin placements in the plan and flags the ones that do not fit", () => {
    assert.match(
      studioPageSource,
      /studio-placement--invalid/,
      "placements that no longer fit must be flagged visually, not removed",
    );
    assert.match(
      studioPageSource,
      /basinPlacements:\s*current\.basinPlacements\.filter\(\(item\)\s*=>\s*item\.id !== placement\.id\)/,
      "only the explicit remove button may delete a placement",
    );
  });
});

/**
 * Behavioural half of the same guard: replay the exact sequence the customer hit
 * (straight run with a basin -> switch to L ขวา) against the real model helpers
 * and assert the basin survives and lands inside the rebuilt piece.
 */
describe("studio shape change keeps the basin — behaviour (job-208)", () => {
  const PANELS_STRAIGHT = [{ widthMm: 1000, depthMm: 600, edges: { top: "normal", right: "normal", bottom: "normal", left: "normal" } }];
  const PANELS_L = [
    { widthMm: 1200, depthMm: 600, edges: { top: "normal", right: "normal", bottom: "normal", left: "normal" } },
    { widthMm: 600, depthMm: 600, edges: { top: "normal", right: "normal", bottom: "normal", left: "normal" } },
    { widthMm: 600, depthMm: 600, edges: { top: "normal", right: "normal", bottom: "normal", left: "normal" } },
  ] as const;

  // KF003-class round basin: the cut-out is the placement's width/depth in mm.
  const basin = {
    id: "basin-1",
    sku: "KF003",
    pieceId: "piece-1",
    sheetId: "piece-1-1",
    xMm: 300,
    yMm: 120,
    widthMm: 400,
    depthMm: 400,
  };

  it("the rebuilt L piece is a different geometry (so the old code deleted the basin here)", () => {
    const straight = buildCustomShapePiece("piece-1", "i", PANELS_STRAIGHT as never);
    const lRight = buildCustomShapePiece("piece-1", "l-right", PANELS_L as never);
    assert.equal(straight.rectangles.length, 1);
    assert.equal(lRight.rectangles.length, 3, "L-right is built from three rectangles");
    assert.notEqual(straight.preset, lRight.preset, "this is exactly the geometry change that used to drop the basin");
    assert.ok(lRight.rectangles.some((rectangle) => rectangle.id === basin.sheetId), "the basin's sheet id still resolves in the rebuilt piece");
  });

  it("re-anchoring keeps the basin inside the rebuilt piece", () => {
    const lRight = buildCustomShapePiece("piece-1", "l-right", PANELS_L as never);
    const clamped = clampPlacementToSheet(basin as never, lRight, basin.xMm, basin.yMm);
    const reanchored = { ...basin, ...clamped };

    assert.ok(Number.isFinite(reanchored.xMm) && Number.isFinite(reanchored.yMm), "the re-anchored position must be a real number");
    assert.ok(
      placementFitsStudioPiece(lRight, reanchored as never),
      "after re-anchoring the basin must sit inside one of the rebuilt piece's sheets",
    );
    assert.equal(reanchored.id, "basin-1", "the basin itself must be the same placement, not a new one");
    assert.equal(reanchored.sku, "KF003", "the basin SKU must survive the shape change");
  });

  it("a basin that cannot fit is still kept (flagged, not deleted)", () => {
    const lRight = buildCustomShapePiece("piece-1", "l-right", PANELS_L as never);
    // A basin wider than every sheet: the clamp must still return a position, and the
    // caller keeps the placement so the warning path can flag it.
    const huge = { ...basin, id: "basin-huge", widthMm: 5000, depthMm: 5000, xMm: 0, yMm: 0 };
    const clamped = clampPlacementToSheet(huge as never, lRight, huge.xMm, huge.yMm);
    assert.ok(Number.isFinite(clamped.xMm) && Number.isFinite(clamped.yMm), "an oversized basin still gets a usable position");
    assert.equal(
      placementFitsStudioPiece(lRight, { ...huge, ...clamped } as never),
      false,
      "an oversized basin does not fit -- which is why the caller must flag it rather than drop it",
    );
  });
});
