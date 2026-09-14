import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDxf, createStudioExportModel, STUDIO_EXPORT_LAYERS, STUDIO_EXPORT_NOTE, studioPrintTitle } from "../src/data/studio-export.ts";
import type { StudioState } from "../src/data/studio-model.ts";

const state = (overrides: Partial<StudioState> = {}): StudioState => ({
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  pieces: [
    {
      id: "piece-a",
      name: "ชิ้นงาน A",
      rectangles: [
        { id: "a1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 },
        { id: "a2", widthMm: 600, lengthMm: 400, xMm: 1800, yMm: 0, rotation: 0 },
      ],
      sideStatuses: { "a1:top": "upstand", "a2:right": "open-edge" },
    },
    {
      id: "piece-b",
      name: "ชิ้นงาน B",
      rectangles: [{ id: "b1", widthMm: 900, lengthMm: 500, xMm: 0, yMm: 0, rotation: 90 }],
      sideStatuses: { "b1:left": "wall-flush" },
    },
  ],
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 0,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [{ id: "known", sku: "KF001", pieceId: "piece-a", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
  ...overrides,
});

type DxfEntity = { type: string; groups: Array<[string, string]> };

function dxfEntities(dxf: string): DxfEntity[] {
  const lines = dxf.trim().split(/\r?\n/);
  const entities: DxfEntity[] = [];
  let current: DxfEntity | undefined;
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = lines[index];
    const value = lines[index + 1];
    if (code === "0") {
      if (current) entities.push(current);
      current = { type: value, groups: [] };
    } else {
      current?.groups.push([code, value]);
    }
  }
  if (current) entities.push(current);
  return entities;
}

function dxfGroupValues(entity: DxfEntity, code: string) {
  return entity.groups.filter(([groupCode]) => groupCode === code).map(([, value]) => value);
}

test("export model keeps every piece, rectangle, rotation, basin, and edge status", () => {
  const model = createStudioExportModel(state());
  assert.equal(model.pieceCount, 2);
  assert.equal(model.rectangleCount, 3);
  assert.equal(model.pieces[1].rectangles[0].widthMm, 500);
  assert.equal(model.pieces[0].edges.find((edge) => edge.key === "a1:top")?.status, "upstand");
  assert.equal(model.basins[0].pieceId, "piece-a");
});

test("DXF uses millimetre units and the exact v2 layer set without clearance geometry", () => {
  const dxf = createStudioDxf(state());
  assert.match(dxf, /\$INSUNITS\n70\n4/);
  assert.deepEqual(
    dxfEntities(dxf).filter((entity) => entity.type === "LAYER").map((entity) => dxfGroupValues(entity, "2")[0]),
    [...STUDIO_EXPORT_LAYERS],
  );
  assert.match(dxf, /\n8\nPIECE_OUTLINE\n/);
  assert.match(dxf, /\n8\nUPSTAND\n/);
  assert.match(dxf, /\n8\nOPEN_EDGE\n/);
  assert.match(dxf, /\n8\nWALL_FLUSH\n/);
  assert.match(dxf, /VERIFY 90 DEGREE/);
  assert.match(dxf, new RegExp(STUDIO_EXPORT_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(dxf, /CLEARANCE|50 mm|COUNTER_OUTLINE/);
  assert.match(dxf, /PIECE 1/);
  assert.doesNotMatch(dxf, /\?/);
  assert.ok(dxfEntities(dxf).some((entity) => entity.type === "LWPOLYLINE" && dxfGroupValues(entity, "8").includes("PIECE_OUTLINE")));
});

test("unknown basin dimensions use an ASCII label and never create a cutout hole", () => {
  const unknown = state({ basinPlacements: [{ id: "unknown", sku: "KF029", pieceId: "piece-a", xMm: 400, yMm: 50, widthMm: null, depthMm: null }] });
  const dxf = createStudioDxf(unknown);
  assert.equal((dxf.match(/\n8\nBASIN_HOLES\n/g) ?? []).length, 0);
  assert.match(dxf, /CUTOUT SIZE NOT SPECIFIED IN CATALOG/);
  assert.doesNotMatch(dxf, /[^\x00-\x7F]/);
  assert.match(createStudioExportModel(unknown).basins[0].label, /ไม่ระบุ/);
});

test("print titles identify piece count and sanitize project names", () => {
  assert.equal(studioPrintTitle("studio-layout", 3), "KF-Basins-studio-layout-3ชิ้น");
  assert.equal(studioPrintTitle("QT/2026 001", 2), "KF-Basins-QT-2026-001-2ชิ้น");
});