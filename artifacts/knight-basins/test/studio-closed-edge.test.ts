import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomShapePiece,
  isStudioPieceCustomized,
  studioPieceEdges,
  studioSideStatusLabel,
  type SideStatus,
} from "../src/data/studio-model.ts";

const NORMAL_EDGES: Record<"top" | "right" | "bottom" | "left", SideStatus> = {
  top: "normal",
  right: "normal",
  bottom: "normal",
  left: "normal",
};

test("closed-edge has the label 'ขอบปิด ⊞'", () => {
  assert.equal(studioSideStatusLabel("closed-edge"), "ขอบปิด ⊞");
});

test("buildCustomShapePiece: 'i' shape builds exactly 1 panel with the requested dimensions and edges", () => {
  const piece = buildCustomShapePiece("p1", "i", [
    { widthMm: 1800, depthMm: 600, edges: { top: "upstand", right: "open-edge", bottom: "normal", left: "closed-edge" } },
  ]);
  assert.equal(piece.rectangles.length, 1);
  assert.equal(piece.rectangles[0]?.widthMm, 1800);
  assert.equal(piece.rectangles[0]?.lengthMm, 600);
  const rectangleId = piece.rectangles[0]!.id;
  assert.equal(piece.sideStatuses[`${rectangleId}:top`], "upstand");
  assert.equal(piece.sideStatuses[`${rectangleId}:right`], "open-edge");
  assert.equal(piece.sideStatuses[`${rectangleId}:bottom`], "normal");
  assert.equal(piece.sideStatuses[`${rectangleId}:left`], "closed-edge");
  assert.equal(isStudioPieceCustomized(piece), true);
});

test("buildCustomShapePiece: 'l-left' shape builds exactly 2 panels, leg dropping from the back run's left edge", () => {
  const piece = buildCustomShapePiece("p2", "l-left", [
    { widthMm: 1800, depthMm: 600, edges: NORMAL_EDGES },
    { widthMm: 600, depthMm: 1200, edges: { ...NORMAL_EDGES, top: "upstand", left: "closed-edge" } },
  ]);
  assert.equal(piece.rectangles.length, 2);
  const [backRun, leg] = piece.rectangles;
  assert.equal(backRun?.xMm, 0);
  assert.equal(backRun?.yMm, 0);
  assert.equal(leg?.xMm, 0);
  assert.equal(leg?.yMm, 600, "leg must drop from the back run's bottom (depth 600)");

  // The leg's top edge is fully covered by the back run (the joint) -- exposedLengthMm must be 0.
  const legTopEdge = studioPieceEdges(piece).find((edge) => edge.rectangleId === leg!.id && edge.side === "top");
  assert.equal(legTopEdge?.exposedLengthMm, 0);

  // A joint side must never carry the caller's requested status ("upstand" was asked for above).
  assert.equal(piece.sideStatuses[`${leg!.id}:top`], undefined, "the joint side must be locked, not set to upstand");
  // A genuinely exposed side on the same panel keeps its requested status.
  assert.equal(piece.sideStatuses[`${leg!.id}:left`], "closed-edge");
  assert.equal(isStudioPieceCustomized(piece), true);
});

test("buildCustomShapePiece: 'l-right' shape drops its leg flush with the back run's right edge", () => {
  const piece = buildCustomShapePiece("p3", "l-right", [
    { widthMm: 1800, depthMm: 600, edges: NORMAL_EDGES },
    { widthMm: 600, depthMm: 1200, edges: { ...NORMAL_EDGES, top: "open-edge", right: "upstand" } },
  ]);
  const [backRun, leg] = piece.rectangles;
  assert.equal(leg?.xMm, 1200, "leg's right edge must align with the back run's right edge (1800 - 600)");
  assert.equal(leg?.yMm, backRun!.lengthMm);

  const legTopEdge = studioPieceEdges(piece).find((edge) => edge.rectangleId === leg!.id && edge.side === "top");
  assert.equal(legTopEdge?.exposedLengthMm, 0);
  assert.equal(piece.sideStatuses[`${leg!.id}:top`], undefined, "the joint side must be locked, not set to open-edge");
  assert.equal(piece.sideStatuses[`${leg!.id}:right`], "upstand");
});

test("buildCustomShapePiece: 'u' shape builds exactly 3 panels, both legs dropping from the back run", () => {
  const piece = buildCustomShapePiece("p4", "u", [
    { widthMm: 1500, depthMm: 600, edges: NORMAL_EDGES },
    { widthMm: 600, depthMm: 1200, edges: { ...NORMAL_EDGES, top: "upstand", left: "closed-edge" } },
    { widthMm: 600, depthMm: 1200, edges: { ...NORMAL_EDGES, top: "upstand", right: "closed-edge" } },
  ]);
  assert.equal(piece.rectangles.length, 3);
  const [backRun, leftLeg, rightLeg] = piece.rectangles;
  assert.equal(leftLeg?.xMm, 0);
  assert.equal(leftLeg?.yMm, 600);
  assert.equal(rightLeg?.xMm, 900, "right leg must sit flush with the back run's right edge (1500 - 600)");
  assert.equal(rightLeg?.yMm, 600);
  assert.equal(backRun?.rotation, 0);

  const edges = studioPieceEdges(piece);
  const leftLegTop = edges.find((edge) => edge.rectangleId === leftLeg!.id && edge.side === "top");
  const rightLegTop = edges.find((edge) => edge.rectangleId === rightLeg!.id && edge.side === "top");
  assert.equal(leftLegTop?.exposedLengthMm, 0);
  assert.equal(rightLegTop?.exposedLengthMm, 0);

  // Both legs asked for "upstand" on their joint side; both must be locked out.
  assert.equal(piece.sideStatuses[`${leftLeg!.id}:top`], undefined);
  assert.equal(piece.sideStatuses[`${rightLeg!.id}:top`], undefined);
  // Their genuinely exposed sides still take the requested finish.
  assert.equal(piece.sideStatuses[`${leftLeg!.id}:left`], "closed-edge");
  assert.equal(piece.sideStatuses[`${rightLeg!.id}:right`], "closed-edge");

  // The back run's own bottom is only PARTIALLY covered by the two legs (a 300mm gap
  // remains between them), so it is not a full joint and keeps whatever status it was given.
  const backRunBottom = edges.find((edge) => edge.rectangleId === backRun!.id && edge.side === "bottom");
  assert.ok(backRunBottom && backRunBottom.exposedLengthMm > 0, "back run's bottom is not fully covered by the two legs");
});
