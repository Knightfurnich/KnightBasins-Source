import assert from "node:assert/strict";
import test from "node:test";
import {
  cycleStudioEdgeStatus,
  clearStudioEdgeStatus,
  setStudioEdgeStatus,
  studioEdgeTotals,
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

test("studioEdgeTotals counts wall-flush+upstand toward Upstand Length, the same amount as a plain upstand on the same edge", () => {
  const upstandTotals = studioEdgeTotals([piece([rectangle("r1")], { "r1:top": "upstand" })]);
  const wallFlushUpstandTotals = studioEdgeTotals([piece([rectangle("r1")], { "r1:top": "wall-flush+upstand" })]);
  assert.ok(upstandTotals.upstandLengthMm > 0, "sanity: a plain upstand contributes a positive length");
  assert.equal(wallFlushUpstandTotals.upstandLengthMm, upstandTotals.upstandLengthMm);
});

test("studioEdgeTotals does not count a plain wall-flush side toward Upstand Length", () => {
  const totals = studioEdgeTotals([piece([rectangle("r1")], { "r1:top": "wall-flush" })]);
  assert.equal(totals.upstandLengthMm, 0);
});

test("studioEdgeTotals does not count wall-flush+upstand toward Open Edge Length", () => {
  const totals = studioEdgeTotals([piece([rectangle("r1")], { "r1:top": "wall-flush+upstand" })]);
  assert.equal(totals.openEdgeLengthMm, 0);
});

test("studioEdgeTotals only counts open-edge sides toward Open Edge Length, even alongside a wall-flush+upstand side", () => {
  const totals = studioEdgeTotals([piece([rectangle("r1")], {
    "r1:top": "open-edge",
    "r1:bottom": "wall-flush+upstand",
  })]);
  assert.ok(totals.openEdgeLengthMm > 0);
  assert.equal(totals.openEdgeLengthMm, totals.upstandLengthMm, "top and bottom of a rectangle have equal length");
});

test("setStudioEdgeStatus sets one side's status without mutating the original piece", () => {
  const original = piece();
  const updated = setStudioEdgeStatus(original, "r1", "top", "upstand");
  assert.equal(updated.sideStatuses["r1:top"], "upstand");
  assert.equal(original.sideStatuses["r1:top"], undefined, "original piece must be untouched");
  assert.notEqual(updated, original, "returns a new piece object");
});

test("setStudioEdgeStatus can set wall-flush+upstand directly", () => {
  const updated = setStudioEdgeStatus(piece(), "r1", "left", "wall-flush+upstand");
  assert.equal(updated.sideStatuses["r1:left"], "wall-flush+upstand");
});

test("clearStudioEdgeStatus resets a side back to normal", () => {
  const withUpstand = setStudioEdgeStatus(piece(), "r1", "right", "wall-flush+upstand");
  const cleared = clearStudioEdgeStatus(withUpstand, "r1", "right");
  assert.equal(cleared.sideStatuses["r1:right"], "normal");
});

test("clearStudioEdgeStatus leaves other sides untouched", () => {
  const withTwo = setStudioEdgeStatus(setStudioEdgeStatus(piece(), "r1", "top", "upstand"), "r1", "bottom", "open-edge");
  const cleared = clearStudioEdgeStatus(withTwo, "r1", "top");
  assert.equal(cleared.sideStatuses["r1:top"], "normal");
  assert.equal(cleared.sideStatuses["r1:bottom"], "open-edge");
});

test("cycleStudioEdgeStatus follows the fixed cycle: normal -> upstand -> wall-flush -> wall-flush+upstand -> open-edge -> normal", () => {
  assert.equal(cycleStudioEdgeStatus("normal"), "upstand");
  assert.equal(cycleStudioEdgeStatus("upstand"), "wall-flush");
  assert.equal(cycleStudioEdgeStatus("wall-flush"), "wall-flush+upstand");
  assert.equal(cycleStudioEdgeStatus("wall-flush+upstand"), "open-edge");
  assert.equal(cycleStudioEdgeStatus("open-edge"), "normal");
});

test("studioSideStatusLabel returns the correct Thai label for every status", () => {
  assert.equal(studioSideStatusLabel("upstand"), "ติดบัว");
  assert.equal(studioSideStatusLabel("open-edge"), "ขอบเปิด");
  assert.equal(studioSideStatusLabel("wall-flush"), "ชิดผนัง");
  assert.equal(studioSideStatusLabel("wall-flush+upstand"), "ชิดผนัง+ติดบัว ║▲");
  assert.equal(studioSideStatusLabel("normal"), "ปกติ");
});
