import assert from "node:assert/strict";
import test from "node:test";
import {
  basinPlacementOverlapWarnings,
  calculateBasinCoordinates,
  calculateBasinOffsets,
  clampBasinPlacementPosition,
  clampPlacementToSheet,
  createBasinPlacement,
  normalizePlacements,
  placementCutSize,
  placementSheetWarnings,
  placementTargetWarnings,
  rotatePlacement,
  type BasinAnchor,
  type BasinPlacement,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";
import { PRODUCTS } from "../src/data/catalog.ts";

const rectangle = (id: string, overrides: Partial<StudioRectangle> = {}): StudioRectangle => ({
  id,
  widthMm: 1000,
  lengthMm: 600,
  xMm: 0,
  yMm: 0,
  rotation: 0,
  ...overrides,
});

const piece = (rectangles: StudioRectangle[], overrides: Partial<StudioPiece> = {}): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses: {},
  ...overrides,
});

const basePlacement = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF001",
  pieceId: "piece-1",
  sheetId: "r1",
  anchor: "top-left",
  offsetXMm: 0,
  offsetYMm: 0,
  rotation: 0,
  xMm: 0,
  yMm: 0,
  widthMm: 500,
  depthMm: 400,
  ...overrides,
});

const baseState = (overrides: Partial<StudioState> = {}): StudioState => ({
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1000, runBMm: 0, runCMm: 0 },
  pieces: [piece([rectangle("r1", { widthMm: 1800 })])],
  activePieceId: "piece-1",
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 0,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [],
  ...overrides,
});

test("placementCutSize swaps width/depth on rotation and stays unknown when dimensions are null", () => {
  assert.deepEqual(placementCutSize({ widthMm: 500, depthMm: 400, rotation: 0 }), { widthMm: 500, heightMm: 400 });
  assert.deepEqual(placementCutSize({ widthMm: 500, depthMm: 400, rotation: 90 }), { widthMm: 400, heightMm: 500 });
  assert.deepEqual(placementCutSize({ widthMm: null, depthMm: null, rotation: 0 }), { widthMm: null, heightMm: null });
});

test("distance from sheet edges for all 5 anchor types", () => {
  const sheet = rectangle("r1", { widthMm: 1500, lengthMm: 800 });
  const placement = { widthMm: 500, depthMm: 300, rotation: 0 as const };

  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "top-left", offsetXMm: 20, offsetYMm: 30 }),
    { xMm: 20, yMm: 30 },
  );
  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "top-right", offsetXMm: 20, offsetYMm: 30 }),
    { xMm: 1500 - 500 - 20, yMm: 30 },
  );
  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "bottom-left", offsetXMm: 20, offsetYMm: 30 }),
    { xMm: 20, yMm: 800 - 300 - 30 },
  );
  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "bottom-right", offsetXMm: 20, offsetYMm: 30 }),
    { xMm: 1500 - 500 - 20, yMm: 800 - 300 - 30 },
  );
  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "center", offsetXMm: 0, offsetYMm: 0 }),
    { xMm: (1500 - 500) / 2, yMm: (800 - 300) / 2 },
  );
  assert.deepEqual(
    calculateBasinCoordinates(sheet, { ...placement, anchor: "center", offsetXMm: 10, offsetYMm: -5 }),
    { xMm: (1500 - 500) / 2 + 10, yMm: (800 - 300) / 2 - 5 },
  );

  // calculateBasinOffsets is the exact inverse for every anchor.
  (["top-left", "top-right", "bottom-left", "bottom-right", "center"] as BasinAnchor[]).forEach((anchor) => {
    const coords = calculateBasinCoordinates(sheet, { ...placement, anchor, offsetXMm: 20, offsetYMm: 30 });
    assert.deepEqual(calculateBasinOffsets(sheet, placement, coords, anchor), { offsetXMm: 20, offsetYMm: 30 });
  });
});

test("edge offset is measured against sheetId, not the bounding box of the whole L/U piece", () => {
  // An L-shaped piece: a wide leg "a" and a narrower leg "b" stacked below it.
  const layout = piece([
    rectangle("a", { widthMm: 1800, lengthMm: 600 }),
    rectangle("b", { xMm: 0, yMm: 600, widthMm: 600, lengthMm: 900 }),
  ]);
  const placement = basePlacement({ sheetId: "b", anchor: "top-left", offsetXMm: 50, offsetYMm: 40, widthMm: 300, depthMm: 300, rotation: 0 });
  const sheetB = layout.rectangles[1];
  const coords = calculateBasinCoordinates(sheetB, placement);
  // Offsets are relative to sheet "b"'s own top-left (0, 600), not the piece bounding box (0, 0).
  assert.deepEqual(coords, { xMm: sheetB.xMm + 50, yMm: sheetB.yMm + 40 });
  assert.notDeepEqual(coords, { xMm: 50, yMm: 40 });
});

test("normalizePlacements selects the correct host sheet on a multi-rectangle L/U piece", () => {
  const layout = piece([
    rectangle("a", { widthMm: 1800, lengthMm: 600 }),
    rectangle("b", { xMm: 0, yMm: 600, widthMm: 600, lengthMm: 900 }),
  ]);
  const state = baseState({
    pieces: [layout],
    basinPlacements: [
      // Legacy placement (no pieceId/sheetId): geometry sits inside rectangle "b".
      { id: "legacy-in-b", sku: "KF001", xMm: 100, yMm: 700, widthMm: 300, depthMm: 300 },
    ],
  });
  const [normalized] = normalizePlacements(state);
  assert.equal(normalized.pieceId, "piece-1");
  assert.equal(normalized.sheetId, "b");
  assert.equal(normalized.anchor, "top-left");
  assert.equal(normalized.rotation, 0);
});

test("rotation 0 <-> 90 preserves the edge distance to sheetId", () => {
  const sheet = rectangle("r1", { widthMm: 1500, lengthMm: 800 });
  const layout = piece([sheet]);
  const placement = basePlacement({
    sheetId: "r1",
    anchor: "top-right",
    offsetXMm: 40,
    offsetYMm: 25,
    widthMm: 500,
    depthMm: 300,
    rotation: 0,
  });
  const initialCoords = calculateBasinCoordinates(sheet, placement);
  assert.deepEqual(initialCoords, { xMm: 1500 - 500 - 40, yMm: 25 });

  const rotated = rotatePlacement(placement, layout);
  assert.equal(rotated.rotation, 90);
  assert.equal(rotated.anchor, "top-right");
  assert.equal(rotated.offsetXMm, 40);
  assert.equal(rotated.offsetYMm, 25);
  // After rotating, the cut footprint swaps to 300x500 but the distance from
  // the right/top sheet edges (the anchor's reference edges) is unchanged.
  assert.deepEqual(calculateBasinCoordinates(sheet, rotated), { xMm: 1500 - 300 - 40, yMm: 25 });
  assert.equal(rotated.xMm, 1500 - 300 - 40);
  assert.equal(rotated.yMm, 25);

  const rotatedBack = rotatePlacement(rotated, layout);
  assert.equal(rotatedBack.rotation, 0);
  assert.deepEqual({ xMm: rotatedBack.xMm, yMm: rotatedBack.yMm }, initialCoords);
});

test("rotatePlacement without a resolvable sheet still toggles rotation without crashing", () => {
  const layout = piece([rectangle("r1")]);
  const placement = basePlacement({ sheetId: "missing-sheet", rotation: 0 });
  const rotated = rotatePlacement(placement, layout);
  assert.equal(rotated.rotation, 90);
  assert.equal(rotated.xMm, placement.xMm);
  assert.equal(rotated.yMm, placement.yMm);
});

test("placementSheetWarnings flags missing piece, missing sheet, and out-of-bounds basins", () => {
  const layout = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]);

  assert.deepEqual(
    placementSheetWarnings(basePlacement({ sheetId: "r1" }), undefined),
    [`ไม่พบชิ้นงานสำหรับอ่าง basin-1`],
  );

  assert.deepEqual(
    placementSheetWarnings(basePlacement({ sheetId: "does-not-exist" }), layout),
    [`ไม่พบแผ่นเป้าหมายสำหรับอ่าง basin-1`],
  );

  const outOfBounds = basePlacement({ sheetId: "r1", anchor: "top-left", offsetXMm: 900, offsetYMm: 0, widthMm: 500, depthMm: 300 });
  assert.deepEqual(placementSheetWarnings(outOfBounds, layout), [`อ่าง basin-1 เกินขอบเขตแผ่น r1`]);

  const inBounds = basePlacement({ sheetId: "r1", anchor: "top-left", offsetXMm: 100, offsetYMm: 100, widthMm: 500, depthMm: 300 });
  assert.deepEqual(placementSheetWarnings(inBounds, layout), []);

  // Unknown dimensions never trigger a bounds warning.
  const unknown = basePlacement({ sheetId: "r1", widthMm: null, depthMm: null });
  assert.deepEqual(placementSheetWarnings(unknown, layout), []);
});

test("v1 migration fills pieceId from pieces[0] only for legacy placements, never for new data", () => {
  const layout = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]);
  const otherPiece = piece([rectangle("r2", { widthMm: 1000, lengthMm: 600 })], { id: "piece-2", name: "ชิ้นงาน 2" });

  const state = baseState({
    pieces: [layout, otherPiece],
    basinPlacements: [
      // Legacy v1 draft: pieceId was never recorded at all.
      { id: "legacy-basin", sku: "KF001", xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 },
      // New-model placement: pieceId is explicitly set but stale/unresolvable.
      { id: "new-basin", sku: "KF001", pieceId: "piece-gone", xMm: 100, yMm: 100, widthMm: 300, depthMm: 300 },
    ],
  });

  const [legacy, fresh] = normalizePlacements(state);
  assert.equal(legacy.pieceId, "piece-1", "legacy placement without pieceId falls back to pieces[0]");
  assert.equal(fresh.pieceId, "piece-gone", "placement that already names a pieceId is never redirected to pieces[0]");

  const freshPiece = state.pieces?.find((candidate) => candidate.id === fresh.pieceId);
  assert.equal(freshPiece, undefined);
  assert.deepEqual(placementSheetWarnings(fresh, freshPiece), [`ไม่พบชิ้นงานสำหรับอ่าง ${fresh.id}`]);
});

test("normalizePlacements keeps explicit offsets and defaults rotation/anchor", () => {
  const layout = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]);
  const state = baseState({
    pieces: [layout],
    basinPlacements: [
      { id: "explicit", sku: "KF001", pieceId: "piece-1", sheetId: "r1", offsetXMm: 15, offsetYMm: 20, xMm: 0, yMm: 0, widthMm: 300, depthMm: 300 },
    ],
  });
  const [normalized] = normalizePlacements(state);
  assert.equal(normalized.anchor, "top-left");
  assert.equal(normalized.rotation, 0);
  assert.equal(normalized.offsetXMm, 15);
  assert.equal(normalized.offsetYMm, 20);
});

test("createBasinPlacement accepts sheetId and anchor when provided", () => {
  const product = PRODUCTS.find((item) => item.sku === "KF001");
  assert.ok(product);
  const placement = createBasinPlacement(product, 0, "piece-1", "r1", "center");
  assert.equal(placement.pieceId, "piece-1");
  assert.equal(placement.sheetId, "r1");
  assert.equal(placement.anchor, "center");
  assert.equal(placement.offsetXMm, 0);
  assert.equal(placement.offsetYMm, 0);
  assert.equal(placement.rotation, 0);

  const withoutSheet = createBasinPlacement(product, 1, "piece-1");
  assert.equal(withoutSheet.sheetId, undefined);
  assert.equal(withoutSheet.anchor, "top-left");
});

test("placementTargetWarnings enforces pieceId + sheetId on new placements (not legacy)", () => {
  const layout = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]);
  const pieces = [layout];

  // New placement with both targets resolvable -> clean.
  assert.deepEqual(
    placementTargetWarnings(basePlacement({ pieceId: "piece-1", sheetId: "r1" }), pieces),
    [],
  );

  // New placement missing the sheet the user picked -> reported, never guessed.
  assert.deepEqual(
    placementTargetWarnings(basePlacement({ pieceId: "piece-1", sheetId: undefined }), pieces),
    [`อ่าง basin-1 ไม่ได้ระบุแผ่น (sheetId)`],
  );

  // New placement naming a piece that no longer exists -> reported, and NOT
  // redirected to pieces[0].
  assert.deepEqual(
    placementTargetWarnings(basePlacement({ pieceId: "piece-gone", sheetId: "r1" }), pieces),
    [`ไม่พบชิ้นงานสำหรับอ่าง basin-1`],
  );

  // New placement naming a sheet that is not inside the named piece.
  assert.deepEqual(
    placementTargetWarnings(basePlacement({ pieceId: "piece-1", sheetId: "r-gone" }), pieces),
    [`ไม่พบแผ่นเป้าหมายสำหรับอ่าง basin-1`],
  );

  // createBasinPlacement without a sheet is intentionally incomplete until WO-3
  // passes the picked sheet, and the contract check is what catches it.
  const product = PRODUCTS.find((item) => item.sku === "KF001");
  assert.ok(product);
  const created = createBasinPlacement(product, 0, "piece-1");
  assert.equal(created.pieceId, "piece-1");
  assert.deepEqual(
    placementTargetWarnings(created, pieces),
    [`อ่าง ${created.id} ไม่ได้ระบุแผ่น (sheetId)`],
  );
});

test("placementSheetWarnings distinguishes a missing sheetId from an unknown sheetId", () => {
  const layout = piece([rectangle("r1", { widthMm: 1000, lengthMm: 600 })]);
  assert.deepEqual(
    placementSheetWarnings(basePlacement({ sheetId: undefined }), layout),
    [`ไม่ได้ระบุแผ่นเป้าหมายสำหรับอ่าง basin-1`],
  );
  assert.deepEqual(
    placementSheetWarnings(basePlacement({ sheetId: "r-gone" }), layout),
    [`ไม่พบแผ่นเป้าหมายสำหรับอ่าง basin-1`],
  );
});

test("clampPlacementToSheet clamps against the placement's own piece, never the first piece", () => {
  // Piece 1 occupies x 0..1000 ; piece 2 occupies x 2000..3000.
  const layout1 = piece([rectangle("r1", { xMm: 0, yMm: 0, widthMm: 1000, lengthMm: 600 })], { id: "piece-1" });
  const layout2 = piece([rectangle("r2", { xMm: 2000, yMm: 0, widthMm: 1000, lengthMm: 600 })], { id: "piece-2" });
  const onPiece2 = basePlacement({ pieceId: "piece-2", sheetId: "r2", widthMm: 400, depthMm: 300 });

  // Dragging towards x=0 must stop at piece 2's own left edge (2000), not at
  // piece 1's — the old first-piece helper would have returned 0 here.
  assert.deepEqual(clampPlacementToSheet(onPiece2, layout2, 0, 0), { xMm: 2000, yMm: 0 });

  // Dragging past the far edge stops at piece 2's own right edge (3000 - 400).
  assert.deepEqual(clampPlacementToSheet(onPiece2, layout2, 9999, 9999), { xMm: 2600, yMm: 300 });

  // Inside the sheet is left alone (rounded).
  assert.deepEqual(clampPlacementToSheet(onPiece2, layout2, 2100, 100), { xMm: 2100, yMm: 100 });

  // Unresolvable piece -> coordinates pass through untouched.
  assert.deepEqual(clampPlacementToSheet(onPiece2, undefined, 123, 456), { xMm: 123, yMm: 456 });

  // Rotation is respected: 400x300 rotated to 90 becomes 300x400.
  const rotated = { ...onPiece2, rotation: 90 as const };
  assert.deepEqual(clampPlacementToSheet(rotated, layout2, 9999, 9999), { xMm: 2700, yMm: 200 });

  // The legacy helper is retained but only ever sees the first piece.
  assert.deepEqual(
    clampBasinPlacementPosition({ widthMm: 400, depthMm: 300 }, 0, 0, { depthMm: 600, runAMm: 1000, runBMm: 0, runCMm: 0 }, "I"),
    { xMm: 0, yMm: 0 },
  );
});

test("overlapping basins on the same piece are flagged, while basins on different pieces are safe", () => {
  const sheet = rectangle("r1", { widthMm: 1200, lengthMm: 800 });
  const layout1 = piece([sheet], { id: "piece-1" });
  const layout2 = piece([sheet], { id: "piece-2" });

  const basinA = basePlacement({ id: "b1", pieceId: "piece-1", sheetId: "r1", anchor: "top-left", offsetXMm: 50, offsetYMm: 50, widthMm: 400, depthMm: 300 });
  const coordsA = calculateBasinCoordinates(sheet, basinA);
  const placementA = { ...basinA, ...coordsA };

  // Basin B on the same piece overlapping with Basin A
  const basinB = basePlacement({ id: "b2", pieceId: "piece-1", sheetId: "r1", anchor: "top-left", offsetXMm: 200, offsetYMm: 100, widthMm: 400, depthMm: 300 });
  const coordsB = calculateBasinCoordinates(sheet, basinB);
  const placementB = { ...basinB, ...coordsB };

  const stateSamePiece = baseState({ pieces: [layout1], basinPlacements: [placementA, placementB] });
  assert.deepEqual(basinPlacementOverlapWarnings(stateSamePiece), ["b1:b2"]);

  // Basin C on a DIFFERENT piece at the exact same relative coordinates
  const basinC = basePlacement({ id: "b3", pieceId: "piece-2", sheetId: "r1", anchor: "top-left", offsetXMm: 50, offsetYMm: 50, widthMm: 400, depthMm: 300 });
  const coordsC = calculateBasinCoordinates(sheet, basinC);
  const placementC = { ...basinC, ...coordsC };

  const stateDifferentPieces = baseState({ pieces: [layout1, layout2], basinPlacements: [placementA, placementC] });
  assert.deepEqual(basinPlacementOverlapWarnings(stateDifferentPieces), []);
});

