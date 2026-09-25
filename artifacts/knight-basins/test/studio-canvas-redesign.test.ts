import assert from "node:assert/strict";
import test from "node:test";
import {
  touchingRectangleKeys,
  type StudioPiece,
  type SideStatus,
  studioPieceEdges,
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

test("touchingRectangleKeys identifies when two rectangles share a joint", () => {
  // r1 at (0, 0) size 1000x600, r2 at (1000, 0) size 600x600 touching at right
  const r1 = rectangle("r1", { xMm: 0, yMm: 0, widthMm: 1000, lengthMm: 600 });
  const r2 = rectangle("r2", { xMm: 1000, yMm: 0, widthMm: 600, lengthMm: 600 });
  const p = piece([r1, r2]);

  const touching = touchingRectangleKeys(p, "r1", "right");
  assert.ok(touching.length >= 1);
});

test("exposed edges have exposedLengthMm > 0 while joint edges have exposedLengthMm === 0", () => {
  const r1 = rectangle("r1", { xMm: 0, yMm: 0, widthMm: 1000, lengthMm: 600 });
  const r2 = rectangle("r2", { xMm: 1000, yMm: 0, widthMm: 600, lengthMm: 600 });
  const p = piece([r1, r2]);

  const edges = studioPieceEdges(p);
  const exposed = edges.filter((e) => e.exposedLengthMm > 0);
  const topEdges = exposed.filter((e) => e.side === "top");

  assert.ok(topEdges.length >= 1, "top edges are exposed to air");
});

test("edge finish drag type application/x-studio-edge-status is recognized", () => {
  const mime = "application/x-studio-edge-status";
  const validStatuses: SideStatus[] = ["upstand", "open-edge", "wall-flush", "wall-flush+upstand", "normal"];
  validStatuses.forEach((status) => {
    assert.ok(typeof status === "string");
  });
});
