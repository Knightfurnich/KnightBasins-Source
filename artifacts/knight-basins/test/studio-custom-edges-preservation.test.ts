import assert from "node:assert/strict";
import test from "node:test";
import {
  clearStudioEdgeStatus,
  isStudioPieceCustomized,
  preserveCustomEdgesOnShapeChange,
  setStudioEdgeStatus,
  type SideStatus,
  type StudioPiece,
} from "../src/data/studio-model.ts";

const rectangle = (id: string, overrides: Partial<StudioPiece["rectangles"][number]> = {}) => ({
  id,
  widthMm: 1000,
  lengthMm: 600,
  xMm: 0,
  yMm: 0,
  rotation: 0 as const,
  ...overrides,
});

const piece = (rectangles = [rectangle("r1")], sideStatuses: Record<string, SideStatus> = {}): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses,
});

// r1 at (0, 0) size 1000x600, r2 at (1000, 0) size 600x600 -- r1:right/r2:left is the joint between them.
const twoRectanglePiece = (sideStatuses: Record<string, SideStatus> = {}) =>
  piece(
    [rectangle("r1", { xMm: 0, yMm: 0, widthMm: 1000, lengthMm: 600 }), rectangle("r2", { xMm: 1000, yMm: 0, widthMm: 600, lengthMm: 600 })],
    sideStatuses,
  );

test("setStudioEdgeStatus marks the piece hasCustomEdges", () => {
  const updated = setStudioEdgeStatus(piece(), "r1", "top", "upstand");
  assert.equal(isStudioPieceCustomized(updated), true);
});

test("a fresh piece is not customized", () => {
  assert.equal(isStudioPieceCustomized(piece()), false);
});

test("clearStudioEdgeStatus also marks the piece hasCustomEdges", () => {
  const cleared = clearStudioEdgeStatus(piece(), "r1", "top");
  assert.equal(isStudioPieceCustomized(cleared), true);
});

test("preserveCustomEdgesOnShapeChange keeps a customer's edge finishes when the shape changes size", () => {
  const previousPiece = setStudioEdgeStatus(piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]), "r1", "top", "upstand");
  const nextPiece = piece([rectangle("r1", { widthMm: 1500, lengthMm: 600 })]); // same rectangle id, resized -- auto-map would default this back to "normal"
  const preserved = preserveCustomEdgesOnShapeChange(previousPiece, nextPiece);
  assert.equal(preserved.sideStatuses["r1:top"], "upstand", "customer's upstand choice must not be reset to the auto-mapped default");
  assert.equal(isStudioPieceCustomized(preserved), true);
});

test("preserveCustomEdgesOnShapeChange only carries a status onto a rectangle that still exists in the new shape", () => {
  const previousPiece = twoRectanglePiece({ "r1:top": "upstand", "r2:top": "open-edge" });
  const customizedPrevious = setStudioEdgeStatus(previousPiece, "r1", "top", "upstand"); // marks hasCustomEdges
  const nextPiece = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]); // r2 removed by the shape change
  const preserved = preserveCustomEdgesOnShapeChange(customizedPrevious, nextPiece);
  assert.equal(preserved.sideStatuses["r1:top"], "upstand");
  assert.equal(preserved.sideStatuses["r2:top"], undefined, "a status for a rectangle that no longer exists must not be carried over");
});

test("preserveCustomEdgesOnShapeChange leaves the new piece's auto-mapped defaults untouched when the previous piece was never customized", () => {
  const previousPiece = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })], { "r1:top": "wall-flush" });
  const nextPiece = piece([rectangle("r1", { widthMm: 1500, lengthMm: 600 })], { "r1:top": "normal" });
  const preserved = preserveCustomEdgesOnShapeChange(previousPiece, nextPiece);
  assert.equal(preserved, nextPiece, "an uncustomized piece is returned as-is so the caller's auto-map defaults stand");
});

test("setStudioEdgeStatus refuses to set a status on a joint (exposedLengthMm === 0)", () => {
  const original = twoRectanglePiece();
  const updated = setStudioEdgeStatus(original, "r1", "right", "upstand");
  assert.equal(updated, original, "the piece must be returned unchanged for a joint side");
  assert.equal(updated.sideStatuses["r1:right"], undefined);
  assert.equal(isStudioPieceCustomized(updated), false);
});

test("clearStudioEdgeStatus also refuses to touch a joint side", () => {
  const original = twoRectanglePiece();
  const cleared = clearStudioEdgeStatus(original, "r2", "left");
  assert.equal(cleared, original);
});

test("setStudioEdgeStatus still works normally on the exposed sides of a multi-rectangle piece", () => {
  const original = twoRectanglePiece();
  const updated = setStudioEdgeStatus(original, "r1", "top", "upstand");
  assert.equal(updated.sideStatuses["r1:top"], "upstand");
  assert.equal(isStudioPieceCustomized(updated), true);
});
