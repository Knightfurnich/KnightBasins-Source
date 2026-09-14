import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDxf, createStudioExportModel, STUDIO_EXPORT_LAYERS, STUDIO_EXPORT_NOTE, studioPrintTitle } from "../src/data/studio-export.ts";
import type { StudioState } from "../src/data/studio-model.ts";

const state = (shape: StudioState["shape"]): StudioState => ({
  mode: "studio",
  shape,
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 1000 },
  backsplash: { enabled: false, heightMm: 100 },
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [{ id: "known", sku: "KF001", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
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

function dxfEntityByLayer(dxf: string, type: string, layer: string) {
  const entity = dxfEntities(dxf).find(
    (candidate) => candidate.type === type && dxfGroupValues(candidate, "8").includes(layer),
  );
  assert.ok(entity, `expected a ${type} entity on ${layer}`);
  return entity;
}

test("export model uses the shared I, L, and U counter geometry", () => {
  assert.deepEqual(createStudioExportModel(state("I")).outline, [
    { xMm: 0, yMm: 0 }, { xMm: 1800, yMm: 0 }, { xMm: 1800, yMm: 600 }, { xMm: 0, yMm: 600 },
  ]);
  assert.equal(createStudioExportModel(state("L")).outline.length, 6);
  assert.equal(createStudioExportModel(state("U")).outline.length, 8);
  assert.deepEqual(createStudioExportModel(state("U")).basins[0], {
    sku: "KF001", xMm: 50, yMm: 50, widthMm: 500, heightMm: 500, label: "500 × 500 mm", unknownDimensions: false,
    dxfLabel: "500 x 500 mm",
  });
});

test("DXF has millimetre units, exact A/B/C footprint coordinates, six layers, and an ASCII NOTE", () => {
  const dxf = createStudioDxf(state("U"));
  assert.match(dxf, /\$INSUNITS\n70\n4/);
  assert.deepEqual(
    dxfEntities(dxf)
      .filter((entity) => entity.type === "LAYER")
      .map((entity) => dxfGroupValues(entity, "2")[0]),
    [...STUDIO_EXPORT_LAYERS],
  );

  const outline = dxfEntityByLayer(dxf, "LWPOLYLINE", "COUNTER_OUTLINE");
  const xValues = dxfGroupValues(outline, "10").map(Number);
  const yValues = dxfGroupValues(outline, "20").map(Number);
  assert.deepEqual(
    xValues.map((xMm, index) => ({ xMm, yMm: yValues[index] })),
    [
      { xMm: 0, yMm: 0 },
      { xMm: 1800, yMm: 0 },
      { xMm: 1800, yMm: 1000 },
      { xMm: 1200, yMm: 1000 },
      { xMm: 1200, yMm: 600 },
      { xMm: 600, yMm: 600 },
      { xMm: 600, yMm: 1200 },
      { xMm: 0, yMm: 1200 },
    ],
  );

  const noteTexts = dxfEntities(dxf)
    .filter((entity) => entity.type === "TEXT" && dxfGroupValues(entity, "8").includes("NOTE"))
    .flatMap((entity) => dxfGroupValues(entity, "1"));
  assert.deepEqual(noteTexts, [STUDIO_EXPORT_NOTE]);
  assert.ok(noteTexts.every((text) => /^[\x00-\x7F]*$/.test(text)));
});

test("unknown basin dimensions never create a BASIN_HOLES rectangle", () => {
  const unknown = { ...state("U"), basinPlacements: [{ id: "unknown", sku: "KF029", xMm: 400, yMm: 50, widthMm: null, depthMm: null }] };
  const dxf = createStudioDxf(unknown);
  assert.equal((dxf.match(/\n8\nBASIN_HOLES\n/g) ?? []).length, 0);
  assert.match(dxf, /CUTOUT SIZE NOT SPECIFIED IN CATALOG/);
  assert.doesNotMatch(dxf, /[^\x00-\x7F]/);
  assert.match(createStudioExportModel(unknown).basins[0].label, /ไม่ระบุ/);
});

test("print titles are safe and meaningful for current and saved Studio layouts", () => {
  assert.equal(studioPrintTitle("studio-layout", "I"), "KF-Basins-studio-layout-I");
  assert.equal(studioPrintTitle("QT/2026 001", "U"), "KF-Basins-QT-2026-001-U");
});