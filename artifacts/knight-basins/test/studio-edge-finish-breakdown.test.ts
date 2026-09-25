import assert from "node:assert/strict";
import test from "node:test";
import {
  studioEdgeFinishBreakdown,
  studioEdgeFinishSummary,
  studioSideStatusLabel,
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

test("studioEdgeFinishBreakdown excludes a joint side (exposedLengthMm === 0)", () => {
  // r1 has 4 sides but its "right" is the joint with r2; r2 has 4 sides but its "left" is that same joint.
  // So of the 8 raw rectangle sides, only 6 are actually exposed to the room.
  const breakdown = studioEdgeFinishBreakdown(twoRectanglePiece());
  assert.equal(breakdown.length, 6, "the 2 joint sides (r1:right, r2:left) must be filtered out");
  assert.ok(breakdown.every((entry) => entry.lengthMm > 0), "every remaining entry must have a positive exposed length");
});

test("studioEdgeFinishBreakdown's statusLabel for wall-flush+upstand matches studioSideStatusLabel", () => {
  const p = piece([rectangle("r1")], { "r1:top": "wall-flush+upstand" });
  const breakdown = studioEdgeFinishBreakdown(p);
  const top = breakdown.find((entry) => entry.side === "top");
  assert.equal(top?.statusLabel, "ชิดผนัง+ติดบัว ║▲");
  assert.equal(top?.statusLabel, studioSideStatusLabel("wall-flush+upstand"));
});

test("studioEdgeFinishBreakdown keeps a 'normal' side in the list", () => {
  const breakdown = studioEdgeFinishBreakdown(piece());
  const top = breakdown.find((entry) => entry.side === "top");
  assert.equal(top?.status, "normal");
  assert.equal(top?.statusLabel, "ปกติ");
});

test("studioEdgeFinishSummary reports correct lengths sorted top / right / bottom / left", () => {
  const p = piece([rectangle("r1", { widthMm: 1500, lengthMm: 600 })], {
    "r1:top": "upstand",
    "r1:left": "wall-flush",
    "r1:bottom": "open-edge",
  });
  const summary = studioEdgeFinishSummary(p);
  assert.equal(summary, "ขอบ: บน ติดบัว 1.50 ม. · ขวา ปกติ 0.60 ม. · ล่าง ขอบเปิด 1.50 ม. · ซ้าย ชิดผนัง 0.60 ม.");
});

test("studioEdgeFinishSummary returns an empty string when the piece has no exposed side", () => {
  const emptyPiece = piece([]);
  assert.equal(studioEdgeFinishSummary(emptyPiece), "");
  assert.deepEqual(studioEdgeFinishBreakdown(emptyPiece), []);
});
