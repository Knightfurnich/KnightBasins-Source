import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDxf, createStudioPngSvg, STUDIO_EXPORT_LAYERS } from "../src/data/studio-export.ts";
import type { StudioState } from "../src/data/studio-model.ts";

type ExportState = Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">;

const state = (): ExportState => ({
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  pieces: [
    {
      id: "piece-a",
      name: "ชิ้นงาน A",
      rectangles: [{ id: "a1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 }],
      sideStatuses: { "a1:top": "wall-flush+upstand" },
    },
  ],
  basinPlacements: [],
});

test("STUDIO_EXPORT_LAYERS includes WALL_FLUSH_UPSTAND", () => {
  assert.ok(STUDIO_EXPORT_LAYERS.includes("WALL_FLUSH_UPSTAND" as (typeof STUDIO_EXPORT_LAYERS)[number]));
});

test("createStudioDxf exports the WALL_FLUSH_UPSTAND layer for a wall-flush+upstand edge", () => {
  const dxf = createStudioDxf(state());
  assert.match(dxf, /\n8\nWALL_FLUSH_UPSTAND\n/);
});

test("createStudioDxf never emits WALL_FLUSH_UPSTAND geometry when no edge uses that status", () => {
  const withoutWallFlushUpstand = createStudioDxf({
    ...state(),
    pieces: [{ id: "piece-a", name: "ชิ้นงาน A", rectangles: [{ id: "a1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 }], sideStatuses: {} }],
  });
  assert.doesNotMatch(withoutWallFlushUpstand, /\n8\nWALL_FLUSH_UPSTAND\n/);
});

test("createStudioPngSvg uses the purple #7c3aed color for a wall-flush+upstand edge", () => {
  const svg = createStudioPngSvg(state());
  assert.match(svg, /stroke="#7c3aed"/);
});

test("createStudioPngSvg includes the per-side edge finish summary text", () => {
  const svg = createStudioPngSvg(state());
  assert.match(svg, /ขอบ: บน ชิดผนัง\+ติดบัว/);
});

test("createStudioPngSvg omits the edge summary line entirely when the piece has no exposed side", () => {
  const svg = createStudioPngSvg({ ...state(), pieces: [{ id: "piece-a", name: "ชิ้นงาน A", rectangles: [], sideStatuses: {} }] });
  assert.doesNotMatch(svg, /^\s*<text x="0" y="-4"/m);
});
