import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, stoneInstalledUnitPrice } from "../src/data/catalog.ts";
import {
  basinDimensionsForProduct,
  basinPlacementOrientation,
  calculateBasinCoordinates,
  calculateBasinOffsets,
  placementFitsStudioPiece,
  basinPlacementOverlapWarnings,
  applyStudioSizePreset,
  centerBasinPlacementPosition,
  compareStudioCatalog,
  createBasinPlacement,
  createStudioBasinPlacement,
  createStudioCatalogContext,
  distributeBasinPlacementPositions,
  disconnectedRectangleIds,
  placementCrossesPanelJoint,
  pieceOverlapWarnings,
  pieceBounds,
  placementCutSize,
  reflowStudioRectangles,
  snapStudioRectanglePosition,
  studioAreaSqM,
  studioDefaultStoneCode,
  studioBasinCatalogEntries,
  studioEdgeTotals,
  studioEstimate,
  studioPieceJoints,
  studioRectangleSize,
  studioPieces,
  studioStateDimensionsValid,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  STUDIO_COUNTER_PRESETS,
  STUDIO_INITIAL_BOARD_LENGTH_MM,
  STUDIO_INITIAL_BOARD_WIDTH_MM,
  standardSheetWarning,
  studioSubmissionValidationMessage,
  touchingRectangleKeys,
  unknownBasinPlacements,
  resolveMatchingStoneForBasin,
  resolveStudioCatalogChange,
  replaceStudioBasin,
  removeStudioBasin,
  setBasinPlacementOrientation,
  type StudioPiece,
  type StudioState,
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

const piece = (rectangles = [rectangle("r1")], sideStatuses: Record<string, "upstand" | "open-edge" | "wall-flush" | "normal"> = {}): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses,
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
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [{ id: "basin-1", sku: "KF001", pieceId: "piece-1", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
  ...overrides,
});

test("rectangle layouts calculate additive area and preserve stepped/notched geometry", () => {
  const pieces = [piece([rectangle("a", { widthMm: 1800 }), rectangle("b", { xMm: 1800, yMm: 0, widthMm: 600, lengthMm: 400 }), rectangle("c", { xMm: 1800, yMm: 400, widthMm: 400, lengthMm: 500 })])];
  assert.equal(studioAreaSqM(pieces), 1.52);
  assert.deepEqual(pieceBounds(pieces[0]), { widthMm: 2400, heightMm: 900 });
  assert.deepEqual(studioRectangleSize(rectangle("rotated", { rotation: 90, widthMm: 400, lengthMm: 900 })), { widthMm: 900, heightMm: 400 });
});

test("a fresh 1800 × 600 board (the real counter size) estimates 1.08 square metres and does not warn about sheet size", () => {
  assert.equal(STUDIO_INITIAL_BOARD_WIDTH_MM, 1800);
  assert.equal(STUDIO_INITIAL_BOARD_LENGTH_MM, 600);

  const freshBoard: StudioState = {
    ...baseState(),
    dimensions: {
      depthMm: STUDIO_INITIAL_BOARD_LENGTH_MM,
      runAMm: STUDIO_INITIAL_BOARD_WIDTH_MM,
      runBMm: 0,
      runCMm: 0,
    },
    pieces: [{
      ...piece(),
      rectangles: [{
        ...rectangle("fresh-board"),
        widthMm: STUDIO_INITIAL_BOARD_WIDTH_MM,
        lengthMm: STUDIO_INITIAL_BOARD_LENGTH_MM,
      }],
    }],
    basinPlacements: [],
  };
  const estimate = studioEstimate(freshBoard, PRODUCTS);

  assert.equal(estimate.counterAreaSqM, 1.08);
  assert.equal(estimate.standardSheetWarning, false, "1800×600 is within the standard slab size (run <= 3600, depth <= 760), unlike the old 5000×5000 placeholder");
  assert.equal(standardSheetWarning("I", freshBoard.dimensions), false);
  const legacyFallback = studioPieces({ ...freshBoard, pieces: undefined });
  assert.deepEqual(legacyFallback[0]?.rectangles[0], {
    id: "legacy-a",
    widthMm: 1800,
    lengthMm: 600,
    xMm: 0,
    yMm: 0,
    rotation: 0,
  });
});

test("Studio defaults the counter stone to the first basin color", () => {
  assert.equal(studioDefaultStoneCode(["KF001"], PRODUCTS), "VS311");
  assert.equal(studioDefaultStoneCode(["KF002"], PRODUCTS), "VS351");
  // job-278: with no basin placed there is no stone to default to. This used to answer "BW010", because the lookup
  // ended in `?? colors[0]` and silently handed the board Bright White — a stone nobody had chosen, at its price.
  assert.equal(studioDefaultStoneCode([], PRODUCTS), "");
});

test("a basin color missing from the catalogue is kept as itself, not swapped for another stone", () => {
  // job-278 rewrote this case. It used to expect "SO423": the first row of whatever catalogue was passed in. That
  // fallback is exactly the silent mispricing the work order closes, and swapping a customer's stone for an
  // unrelated one is not a decision the code may make. The code is returned unchanged, so the price helpers answer
  // null and the studio says "no price" instead of quoting Bright White/Sanded Onyx by accident.
  const onlySandedOnyx = [
    { code: "SO423", name: "Sanded Onyx", tone: "#343736", sheetPriceTHB: 9000, installedPriceTHB: 8500, documentCodes: [] },
  ];
  assert.equal(studioDefaultStoneCode(["KF001"], PRODUCTS, onlySandedOnyx), "VS311");
  assert.equal(stoneInstalledUnitPrice("VS311", onlySandedOnyx), null);
});

test("overlapping rectangles warn but are still counted additively", () => {
  const layout = piece([rectangle("a"), rectangle("b", { xMm: 500, yMm: 100 })]);
  assert.deepEqual(pieceOverlapWarnings(layout), ["a:b"]);
  assert.equal(studioAreaSqM([layout]), 1.2);
  assert.equal(studioEstimate(baseState({ pieces: [layout] }), PRODUCTS).isValid, false);
});

test("touching edges create joints, snap within tolerance, and exclude shared length from edge totals", () => {
  const layout = piece([
    rectangle("a", { widthMm: 1000 }),
    rectangle("b", { xMm: 1000, widthMm: 800 }),
  ], {
    "a:right": "wall-flush",
    "b:left": "wall-flush",
    "a:bottom": "upstand",
    "a:top": "open-edge",
  });
  assert.deepEqual(studioPieceJoints(layout).map((joint) => joint.lengthMm), [600]);
  assert.deepEqual(touchingRectangleKeys(layout, "a", "right"), ["a:right", "b:left"]);
  assert.deepEqual(snapStudioRectanglePosition(layout, "b", 1008, 2), { xMm: 1000, yMm: 0 });
  const totals = studioEdgeTotals([layout]);
  assert.equal(totals.upstandLengthMm, 1000);
  assert.equal(totals.openEdgeLengthMm, 1000);
});

test("basins crossing a panel joint are blocked while basins inside one panel remain safe", () => {
  const layout = piece([
    rectangle("a", { widthMm: 1000 }),
    rectangle("b", { xMm: 1000, widthMm: 800 }),
  ]);
  const crossing = { xMm: 800, yMm: 100, widthMm: 500, depthMm: 300 };
  assert.equal(placementCrossesPanelJoint(layout, crossing), true);
  assert.equal(placementCrossesPanelJoint(layout, { ...crossing, xMm: 100 }), false);
  const estimate = studioEstimate(baseState({
    pieces: [layout],
    basinPlacements: [{ id: "basin-1", sku: "KF001", pieceId: "piece-1", ...crossing }],
  }), PRODUCTS);
  assert.deepEqual(estimate.crossJointPlacements, ["basin-1"]);
  assert.equal(estimate.isValid, false);
  assert.equal(
    studioSubmissionValidationMessage({ ...baseState(), pieces: [layout], basinPlacements: [{ id: "basin-1", sku: "KF001", pieceId: "piece-1", ...crossing }] }, estimate),
    "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว",
  );
});

test("overlapping basins are blocked while basins that only touch remain safe", () => {
  const overlapping = baseState({
    basinPlacements: [
      { id: "basin-1", sku: "KF001", pieceId: "piece-1", xMm: 100, yMm: 50, widthMm: 500, depthMm: 500 },
      { id: "basin-2", sku: "KF002", pieceId: "piece-1", xMm: 500, yMm: 50, widthMm: 500, depthMm: 500 },
    ],
    basinSkus: ["KF001", "KF002"],
  });
  assert.deepEqual(basinPlacementOverlapWarnings(overlapping), ["basin-1:basin-2"]);
  const estimate = studioEstimate(overlapping, PRODUCTS);
  assert.deepEqual(estimate.basinOverlapWarnings, ["basin-1:basin-2"]);
  assert.equal(estimate.isValid, false);
  assert.equal(studioSubmissionValidationMessage(overlapping, estimate), "มีอ่างวางซ้อนทับกัน กรุณาขยับอ่างให้อยู่ห่างกัน");

  const touching = {
    ...overlapping,
    basinPlacements: overlapping.basinPlacements.map((placement, index) => ({ ...placement, xMm: index * 500 })),
  };
  assert.deepEqual(basinPlacementOverlapWarnings(touching), []);
});

test("rectangles in one workpiece must form one connected component", () => {
  const layout = piece([
    rectangle("a"),
    rectangle("b", { xMm: 1200 }),
  ]);
  assert.deepEqual(disconnectedRectangleIds(layout), ["b"]);
  const estimate = studioEstimate(baseState({ pieces: [layout] }), PRODUCTS);
  assert.deepEqual(estimate.disconnectedRectangles, ["ชิ้นงาน 1: b"]);
  assert.equal(estimate.isValid, false);
  assert.equal(
    studioSubmissionValidationMessage({ ...baseState(), pieces: [layout] }, estimate),
    "สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน",
  );
});

test("new model enforces one to three pieces and one to six valid rectangles", () => {
  assert.equal(studioStateDimensionsValid(baseState()), true);
  assert.equal(studioStateDimensionsValid(baseState({ pieces: [] })), false);
  assert.equal(studioStateDimensionsValid(baseState({ pieces: Array.from({ length: 4 }, (_, index) => ({ ...piece(), id: `piece-${index}` })) })), false);
  assert.equal(studioStateDimensionsValid(baseState({ pieces: [piece(Array.from({ length: 7 }, (_, index) => rectangle(`r${index}`)))] })), false);
  assert.equal(studioStateDimensionsValid(baseState({ pieces: [piece([rectangle("bad", { widthMm: 0 })])] })), false);
});

test("estimate prices upstand and open edge, applies discount before VAT, and rounds line items", () => {
  const state = baseState({
    pieces: [piece([rectangle("r1", { widthMm: 1001, lengthMm: 600 })], { "r1:top": "upstand", "r1:right": "open-edge" })],
    basinPlacements: [{ id: "basin-1", sku: "KF001", pieceId: "piece-1", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
    openEdgePricePerMTHB: 123.45,
    discountTHB: 1000,
    vat: true,
  });
  const estimate = studioEstimate(state, PRODUCTS);
  assert.equal(estimate.counterAreaSqM, 0.6006);
  assert.equal(estimate.upstandLengthM, 1.001);
  assert.equal(estimate.openEdgeLengthM, 0.6);
  assert.equal(estimate.upstandTotalTHB, 901);
  assert.equal(estimate.openEdgeTotalTHB, 74);
  assert.equal(estimate.discountTHB, 1000);
  assert.equal(estimate.vatAmountTHB, Math.round(estimate.subtotalTHB * 0.07));
  assert.equal(estimate.totalTHB, estimate.subtotalTHB + estimate.vatAmountTHB);
});

test("blank upstand and open-edge prices warn without silently charging", () => {
  const estimate = studioEstimate(baseState({
    pieces: [piece([rectangle("r1")], { "r1:top": "upstand", "r1:right": "open-edge" })],
    upstandHeightMm: null,
    openEdgePricePerMTHB: null,
  }), PRODUCTS);
  assert.equal(estimate.upstandTotalTHB, 0);
  assert.equal(estimate.openEdgeTotalTHB, 0);
  assert.equal(estimate.upstandHeightMissing, true);
  assert.equal(estimate.openEdgePriceMissing, true);
  assert.match(estimate.warnings.join(" "), /ความสูงบัว/);
  assert.match(estimate.warnings.join(" "), /ราคาขอบเปิด/);
});

test("open-edge price rejects negative values and more than two decimals", () => {
  const estimate = studioEstimate(baseState({ openEdgePricePerMTHB: 12.345 }), PRODUCTS);
  assert.equal(estimate.openEdgePriceInvalid, true);
  assert.equal(estimate.isValid, false);
  assert.match(estimate.warnings.join(" "), /ทศนิยมไม่เกิน 2/);
});

test("upstand height is limited to 0–500 mm", () => {
  const negative = studioEstimate(baseState({ upstandHeightMm: -1 }), PRODUCTS);
  assert.equal(negative.upstandHeightInvalid, true);
  assert.equal(negative.isValid, false);
  assert.equal(studioSubmissionValidationMessage(baseState({ upstandHeightMm: -1 }), negative), "ความสูงบัวต้องอยู่ระหว่าง 0–500 มม.");

  const maximum = studioEstimate(baseState({ upstandHeightMm: 500 }), PRODUCTS);
  assert.equal(maximum.upstandHeightInvalid, false);
  assert.equal(maximum.isValid, true);

  const overMaximum = studioEstimate(baseState({ upstandHeightMm: 501 }), PRODUCTS);
  assert.equal(overMaximum.upstandHeightInvalid, true);
  assert.equal(overMaximum.isValid, false);
});

test("discount validation rejects negative and over-total values before submission", () => {
  const negative = studioEstimate(baseState({ discountTHB: -1 }), PRODUCTS);
  assert.equal(negative.discountInvalid, true);
  assert.equal(negative.isValid, false);
  assert.match(negative.warnings.join(" "), /ส่วนลดต้องไม่ติดลบ/);
  assert.equal(studioSubmissionValidationMessage(baseState({ discountTHB: -1 }), negative), "ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด");

  const overTotal = studioEstimate(baseState({ discountTHB: 999999 }), PRODUCTS);
  assert.equal(overTotal.discountInvalid, true);
  assert.equal(overTotal.isValid, false);
  assert.equal(studioSubmissionValidationMessage(baseState({ discountTHB: 999999 }), overTotal), "ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด");

  const eligible = studioEstimate(baseState({ discountTHB: 0 }), PRODUCTS).grossSubtotalTHB;
  const maximum = studioEstimate(baseState({ discountTHB: eligible }), PRODUCTS);
  assert.equal(maximum.discountInvalid, false);
});

test("9,500 stone rates compute real totals from the actual area, the same as every other rate", () => {
  const notMarble = studioEstimate(baseState({ activeStone: "MU010" }), PRODUCTS);
  assert.equal(notMarble.sheetCutPriceWarning, false);

  const marbleEstimate = studioEstimate(baseState({ activeStone: "BR816O" }), PRODUCTS);
  assert.equal(marbleEstimate.stoneUnitPriceTHB, 9500);
  assert.equal(marbleEstimate.stoneAreaSqM, 1.08);
  assert.equal(marbleEstimate.stoneTotalTHB, 10260, "1.08 sqm x 9,500 THB/sqm");
  assert.ok(marbleEstimate.stoneTotalTHB > 0);
  assert.equal(marbleEstimate.sheetCutPriceWarning, false);
  assert.doesNotMatch(marbleEstimate.warnings.join(" "), /แผ่นตัด/);

  // upstandTotalTHB must also compute for a 9,500-rate stone, not just stoneTotalTHB.
  const withUpstand = studioEstimate(baseState({
    activeStone: "VS311",
    pieces: [piece([rectangle("r1", { widthMm: 1800 })], { "r1:top": "upstand" })],
    upstandHeightMm: 100,
  }), PRODUCTS);
  assert.equal(withUpstand.stoneUnitPriceTHB, 9500);
  assert.equal(withUpstand.upstandAreaSqM, 0.18);
  assert.equal(withUpstand.upstandTotalTHB, 1710, "0.18 sqm x 9,500 THB/sqm");
  assert.equal(withUpstand.stoneTotalTHB, 11970, "(1.08 + 0.18) sqm x 9,500 THB/sqm");
  assert.doesNotMatch(withUpstand.warnings.join(" "), /แผ่นตัด/);
});

test("a shortlisted-but-unplaced basin never blocks submission or gets priced in", () => {
  const stoneOnlyState = baseState({ basinPlacements: [] });
  const estimate = studioEstimate(stoneOnlyState, PRODUCTS);
  const message = studioSubmissionValidationMessage(stoneOnlyState, estimate);
  assert.equal(message, null);
  // KF001 is still in basinSkus (shortlisted) but never placed — a stone-only
  // order must not silently carry its cost into the submitted total.
  assert.equal(estimate.basinSubtotalTHB, 0);
  assert.equal(estimate.installationChargeTHB, 0);

  const placedEstimate = studioEstimate(baseState(), PRODUCTS);
  assert.ok(placedEstimate.basinSubtotalTHB > 0);
});

test("catalog products without basin dimensions remain unknown", () => {
  const product = PRODUCTS.find((item) => item.sku === "KF029");
  assert.ok(product);
  const placement = createBasinPlacement(product, 0, "piece-1");
  assert.deepEqual(basinDimensionsForProduct(product), { widthMm: null, depthMm: null });
  assert.deepEqual({ widthMm: placement.widthMm, depthMm: placement.depthMm, xMm: placement.xMm, yMm: placement.yMm }, { widthMm: null, depthMm: null, xMm: 0, yMm: 0 });
  assert.deepEqual(unknownBasinPlacements({ basinPlacements: [placement] }), [placement.id]);
});

test("createStudioBasinPlacement centers a basin exactly on X and keeps >= 100mm clearance on every edge", () => {
  const sheet = { id: "sheet-1", widthMm: 1800, lengthMm: 900 };
  const product = PRODUCTS.find((item) => item.sku === "KF001");
  assert.ok(product);
  const catalogSize = basinDimensionsForProduct(product);
  assert.ok(catalogSize.widthMm !== null && catalogSize.depthMm !== null);

  const centered = createStudioBasinPlacement("KF001", sheet, "piece-1", "center");
  assert.equal(centered.sku, "KF001");
  assert.equal(centered.pieceId, "piece-1");
  assert.equal(centered.sheetId, "sheet-1");
  assert.equal(centered.widthMm, catalogSize.widthMm);
  assert.equal(centered.depthMm, catalogSize.depthMm);

  const cut = placementCutSize(centered);
  const leftClearance = centered.xMm;
  const rightClearance = sheet.widthMm - (centered.xMm + (cut.widthMm ?? 0));
  assert.equal(leftClearance, rightClearance, "equal clearance on the left and right edges means the basin is exactly centered on X");
  assert.equal(centered.xMm, Math.round((sheet.widthMm - (cut.widthMm ?? 0)) / 2));

  for (const align of ["center", "left", "right"] as const) {
    const placement = createStudioBasinPlacement("KF001", sheet, "piece-1", align);
    const size = placementCutSize(placement);
    const widthMm = size.widthMm ?? 0;
    const heightMm = size.heightMm ?? 0;
    assert.ok(placement.xMm >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${align}: left clearance`);
    assert.ok(sheet.widthMm - (placement.xMm + widthMm) >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${align}: right clearance`);
    assert.ok(placement.yMm >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${align}: top clearance`);
    assert.ok(sheet.lengthMm - (placement.yMm + heightMm) >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${align}: bottom clearance`);
  }
});

test("createStudioBasinPlacement flush-aligns left/right with exactly the safety margin, and defaults to \"center\"", () => {
  const sheet = { id: "sheet-2", widthMm: 1800, lengthMm: 900 };
  const left = createStudioBasinPlacement("KF001", sheet, "piece-1", "left");
  const right = createStudioBasinPlacement("KF001", sheet, "piece-1", "right");
  const defaulted = createStudioBasinPlacement("KF001", sheet, "piece-1");
  const centered = createStudioBasinPlacement("KF001", sheet, "piece-1", "center");

  assert.equal(left.xMm, STUDIO_BASIN_SAFETY_MARGIN_MM);
  const rightCut = placementCutSize(right);
  assert.equal(right.xMm + (rightCut.widthMm ?? 0), sheet.widthMm - STUDIO_BASIN_SAFETY_MARGIN_MM);

  const { id: _defaultedId, ...defaultedRest } = defaulted;
  const { id: _centeredId, ...centeredRest } = centered;
  assert.deepEqual(defaultedRest, centeredRest, "align defaults to \"center\" when omitted");
});

test("createStudioBasinPlacement stays fully inside the sheet even when 100mm can't fit on both sides", () => {
  const tightSheet = { id: "sheet-3", widthMm: STUDIO_INITIAL_BOARD_WIDTH_MM, lengthMm: STUDIO_INITIAL_BOARD_LENGTH_MM };
  const placement = createStudioBasinPlacement("KF001", tightSheet, "piece-1", "center");
  const cutSize = placementCutSize(placement);
  assert.ok(placement.yMm >= 0);
  assert.ok(placement.yMm + (cutSize.heightMm ?? 0) <= tightSheet.lengthMm, "the cutout stays inside the sheet's own bounds even on the real, tighter 1800x600 counter");
});

test("STUDIO_COUNTER_PRESETS lists exactly the 4 quick-pick counter widths", () => {
  assert.deepEqual(STUDIO_COUNTER_PRESETS, [
    { id: "1200", label: "1.20 ม.", widthMm: 1200, depthMm: 600 },
    { id: "1500", label: "1.50 ม.", widthMm: 1500, depthMm: 600 },
    { id: "1800", label: "1.80 ม.", widthMm: 1800, depthMm: 600 },
    { id: "2000", label: "2.00 ม.", widthMm: 2000, depthMm: 600 },
  ]);
});

test("applyStudioSizePreset resizes the main sheet to 1200x600 and re-centers the basin with >= 100mm clearance", () => {
  const preset = STUDIO_COUNTER_PRESETS.find((candidate) => candidate.id === "1200");
  assert.ok(preset);
  const resized = applyStudioSizePreset(baseState(), preset.widthMm, preset.depthMm);

  assert.equal(resized.dimensions.runAMm, 1200);
  assert.equal(resized.dimensions.depthMm, 600);
  assert.deepEqual(resized.pieces?.[0]?.rectangles[0], {
    id: "r1",
    widthMm: 1200,
    lengthMm: 600,
    xMm: 0,
    yMm: 0,
    rotation: 0,
  });

  const basin = resized.basinPlacements.find((placement) => placement.id === "basin-1");
  assert.ok(basin);
  const cutWidthMm = placementCutSize(basin).widthMm ?? 0;
  assert.equal(basin.xMm, Math.round((1200 - cutWidthMm) / 2), "re-centered on the new 1200mm width");
  assert.equal(basin.yMm, 50, "only X is repositioned, Y is left as-is");
  assert.ok(basin.xMm >= STUDIO_BASIN_SAFETY_MARGIN_MM, "left clearance");
  assert.ok(1200 - (basin.xMm + cutWidthMm) >= STUDIO_BASIN_SAFETY_MARGIN_MM, "right clearance");
});

test("applyStudioSizePreset keeps every preset's re-centered basin >= 100mm from both edges", () => {
  for (const preset of STUDIO_COUNTER_PRESETS) {
    const resized = applyStudioSizePreset(baseState(), preset.widthMm, preset.depthMm);
    const basin = resized.basinPlacements.find((placement) => placement.id === "basin-1");
    assert.ok(basin, preset.id);
    const cutWidthMm = placementCutSize(basin).widthMm ?? 0;
    assert.ok(basin.xMm >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${preset.id}: left clearance`);
    assert.ok(preset.widthMm - (basin.xMm + cutWidthMm) >= STUDIO_BASIN_SAFETY_MARGIN_MM, `${preset.id}: right clearance`);
  }
});

test("applyStudioSizePreset clamps into the margin instead of an inverted range when the new width is too tight for both sides", () => {
  const resized = applyStudioSizePreset(baseState(), 650, 600);
  const basin = resized.basinPlacements.find((placement) => placement.id === "basin-1");
  assert.ok(basin);
  const cutWidthMm = placementCutSize(basin).widthMm ?? 0;
  assert.ok(basin.xMm >= 0);
  assert.ok(basin.xMm + cutWidthMm <= 650, "the cutout still stays fully inside the resized sheet even though 100mm can't fit on both sides");
});

test("applyStudioSizePreset only re-centers basins on the main piece's first sheet, and only updates dimensions on a legacy (pieces-less) state", () => {
  const otherPieceBasin = { id: "basin-2", sku: "KF001", pieceId: "piece-2", xMm: 10, yMm: 10, widthMm: 500, depthMm: 500 };
  const unknownSizeBasin = { id: "basin-3", sku: "KF029", pieceId: "piece-1", xMm: 900, yMm: 10, widthMm: null, depthMm: null };
  const state = baseState({ basinPlacements: [...baseState().basinPlacements, otherPieceBasin, unknownSizeBasin] });
  const resized = applyStudioSizePreset(state, 1200, 600);
  assert.deepEqual(resized.basinPlacements.find((placement) => placement.id === "basin-2"), otherPieceBasin, "a basin on a different piece is left untouched");
  assert.deepEqual(resized.basinPlacements.find((placement) => placement.id === "basin-3"), unknownSizeBasin, "a basin with unresolved dimensions is left untouched");

  const legacyState = baseState({ pieces: undefined });
  const resizedLegacy = applyStudioSizePreset(legacyState, 1200, 600);
  assert.equal(resizedLegacy.dimensions.runAMm, 1200);
  assert.equal(resizedLegacy.pieces, undefined);
  assert.deepEqual(resizedLegacy.basinPlacements, legacyState.basinPlacements, "no pieces means nothing to re-center against");
});

test("basin orientation swaps the real cutout footprint and defaults legacy placements to horizontal", () => {
  const legacyPlacement = { id: "basin-orientation", sku: "KF001", xMm: 0, yMm: 0, widthMm: 500, depthMm: 350 };
  assert.equal(basinPlacementOrientation(legacyPlacement), "horizontal");
  const vertical = setBasinPlacementOrientation(legacyPlacement, "vertical");
  assert.deepEqual(vertical, { ...legacyPlacement, widthMm: 350, depthMm: 500, orientation: "vertical", rotation: 90 });
  assert.deepEqual(setBasinPlacementOrientation(vertical, "horizontal"), { ...legacyPlacement, orientation: "horizontal", rotation: 0 });
});

test("catalog context identifies removed and updated selected basins after a draft is saved", () => {
  const savedAt = "2026-09-15T04:00:00.000Z";
  const context = createStudioCatalogContext(baseState({ basinSkus: ["KF001", "KF002"] }), PRODUCTS, savedAt);
  const changedProducts = PRODUCTS
    .filter((product) => product.sku !== "KF001")
    .map((product) => product.sku === "KF002" ? { ...product, colorName: "Updated basin" } : product);
  const comparison = compareStudioCatalog(context, changedProducts);

  assert.equal(context.savedAt, savedAt);
  assert.equal(comparison.catalogUpdated, true);
  assert.deepEqual(comparison.changes.map((change) => ({ sku: change.sku, kind: change.kind })), [
    { sku: "KF001", kind: "removed" },
    { sku: "KF002", kind: "updated" },
  ]);
  assert.deepEqual(comparison.changes[1]?.changedFields, ["colorName"]);
});

test("catalog changes can be resolved without losing their audit context", () => {
  const context = createStudioCatalogContext(baseState({ basinSkus: ["KF001"] }), PRODUCTS, "2026-09-15T04:00:00.000Z");
  const changedProducts = PRODUCTS.filter((product) => product.sku !== "KF001");
  const resolvedContext = resolveStudioCatalogChange(context, "KF001");
  const comparison = compareStudioCatalog(resolvedContext, changedProducts);

  assert.deepEqual(resolvedContext.resolvedSkus, ["KF001"]);
  assert.deepEqual(comparison.changes, []);
  assert.deepEqual(comparison.resolvedChanges.map((change) => ({ sku: change.sku, kind: change.kind })), [{ sku: "KF001", kind: "removed" }]);
});

test("stale basin entries stay inspectable while replacement preserves placement coordinates", () => {
  const placement = { id: "basin-stale", sku: "KF001", pieceId: "piece-1", xMm: 320, yMm: 140, widthMm: 500, depthMm: 500 };
  const state = baseState({ basinSkus: ["KF001", "KF002"], basinPlacements: [placement] });
  const entries = studioBasinCatalogEntries(state, PRODUCTS.filter((product) => product.sku !== "KF001"));
  assert.equal(entries[0].product, undefined);
  assert.equal(entries[0].placementCount, 1);
  assert.equal(entries[1].product?.sku, "KF002");

  const replacement = PRODUCTS.find((product) => product.sku === "KF003");
  assert.ok(replacement);
  const replaced = replaceStudioBasin(state, "KF001", replacement);
  assert.deepEqual(replaced.basinSkus, ["KF003", "KF002"]);
  assert.deepEqual(replaced.basinPlacements[0], {
    ...placement,
    sku: "KF003",
    widthMm: 350,
    depthMm: 500,
    orientation: "horizontal",
  });
  const removed = removeStudioBasin(state, "KF001");
  assert.deepEqual(removed.basinSkus, ["KF002"]);
  assert.equal(removed.basinPlacements.length, 0);

  const staleEstimate = studioEstimate(baseState(), PRODUCTS.filter((product) => product.sku !== "KF001"));
  assert.deepEqual(staleEstimate.inactiveBasinSkus, ["KF001"]);
  assert.equal(staleEstimate.isValid, false);
  assert.equal(studioSubmissionValidationMessage(baseState(), staleEstimate), "มีอ่างที่ไม่เปิดใช้งานในแบบร่าง กรุณาเปลี่ยนรุ่นหรือนำออกก่อนส่งคำขอ");
});

test("centers a basin inside the rectangle that owns it", () => {
  const layout = piece([rectangle("r1", { widthMm: 1500, lengthMm: 600 })]);
  assert.deepEqual(centerBasinPlacementPosition(layout, {
    id: "basin-1",
    sku: "KF001",
    xMm: 0,
    yMm: 0,
    widthMm: 500,
    depthMm: 500,
  }), { xMm: 500, yMm: 50 });
});

test("distributes two basins with equal left, middle, and right gaps", () => {
  const layout = piece([rectangle("r1", { widthMm: 1500, lengthMm: 600 })]);
  assert.deepEqual(distributeBasinPlacementPositions(layout, [
    { id: "basin-1", widthMm: 500, depthMm: 500, xMm: 0, yMm: 0 },
    { id: "basin-2", widthMm: 400, depthMm: 400, xMm: 0, yMm: 0 },
  ]), [
    { id: "basin-1", xMm: 200, yMm: 50 },
    { id: "basin-2", xMm: 900, yMm: 50 },
  ]);
});
// A U layout: back run (1500 × 600) with a left leg and a right leg hanging off
// its bottom edge. The right leg is flush with the piece's right edge at x = 900.
const uShape = () => [
  rectangle("back", { widthMm: 1500, lengthMm: 600, xMm: 0, yMm: 0 }),
  rectangle("left-leg", { widthMm: 600, lengthMm: 1200, xMm: 0, yMm: 600 }),
  rectangle("right-leg", { widthMm: 600, lengthMm: 1200, xMm: 900, yMm: 600 }),
];
const withSize = (rectangles: StudioPiece["rectangles"], id: string, size: { widthMm?: number; lengthMm?: number }) =>
  rectangles.map((item) => item.id === id ? { ...item, ...size } : item);

test("resizing the U shape's right leg keeps it flush with the piece's right edge", () => {
  const before = uShape();
  const after = reflowStudioRectangles(before, withSize(before, "right-leg", { widthMm: 400 }));
  const rightLeg = after.find((item) => item.id === "right-leg")!;
  assert.equal(rightLeg.widthMm, 400);
  assert.equal(rightLeg.xMm, 1100, "left edge must move out so the right edge stays at 1500");
  assert.equal(rightLeg.xMm + rightLeg.widthMm, 1500);
});

test("widening the U shape's back run carries the right leg with it", () => {
  const before = uShape();
  const after = reflowStudioRectangles(before, withSize(before, "back", { widthMm: 1800 }));
  const rightLeg = after.find((item) => item.id === "right-leg")!;
  assert.equal(rightLeg.xMm, 1200);
  assert.equal(after.find((item) => item.id === "left-leg")!.xMm, 0, "the left leg stays on the left edge");
});

test("resizing a left leg grows it outward instead of dragging it off the left edge", () => {
  const before = uShape();
  const after = reflowStudioRectangles(before, withSize(before, "left-leg", { widthMm: 800 }));
  const leftLeg = after.find((item) => item.id === "left-leg")!;
  assert.equal(leftLeg.xMm, 0);
  assert.equal(after.find((item) => item.id === "right-leg")!.xMm, 900, "the right leg is untouched");
});

test("deepening the back run drops both legs to its new bottom edge", () => {
  const before = uShape();
  const after = reflowStudioRectangles(before, withSize(before, "back", { lengthMm: 500 }));
  assert.equal(after.find((item) => item.id === "left-leg")!.yMm, 500);
  assert.equal(after.find((item) => item.id === "right-leg")!.yMm, 500);
});

test("a leg someone parked away from the back run's bottom edge keeps its own y", () => {
  const before = uShape().map((item) => item.id === "right-leg" ? { ...item, yMm: 401 } : item);
  const after = reflowStudioRectangles(before, withSize(before, "back", { lengthMm: 500 }));
  assert.equal(after.find((item) => item.id === "right-leg")!.yMm, 401);
});

test("a single panel piece is never reflowed", () => {
  const before = [rectangle("only", { widthMm: 1500, lengthMm: 600 })];
  const after = reflowStudioRectangles(before, withSize(before, "only", { widthMm: 900 }));
  assert.deepEqual(after, withSize(before, "only", { widthMm: 900 }));
});

test("two panels side by side on the same row keep the positions they were given", () => {
  const before = [
    rectangle("run-a", { widthMm: 1500, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("run-b", { widthMm: 600, lengthMm: 600, xMm: 1500, yMm: 0 }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "run-a", { widthMm: 1800 }));
  assert.equal(after.find((item) => item.id === "run-b")!.xMm, 1500);
});

test("resizing panel 1 (back run) width in U shape reflows panel 3 to remain flush to right edge", () => {
  const before = [
    rectangle("wizard-leg-0", { widthMm: 1500, lengthMm: 600, xMm: 0, yMm: 0, label: "แผ่นที่ 1" }),
    rectangle("wizard-leg-1", { widthMm: 600, lengthMm: 1200, xMm: 0, yMm: 600, label: "แผ่นที่ 2" }),
    rectangle("wizard-leg-2", { widthMm: 400, lengthMm: 1200, xMm: 1100, yMm: 600, label: "แผ่นที่ 3" }),
  ];
  // Widen panel 1 to 2000
  const after = reflowStudioRectangles(before, withSize(before, "wizard-leg-0", { widthMm: 2000 }), "u");
  const p3 = after.find((r) => r.id === "wizard-leg-2")!;
  assert.equal(p3.xMm, 1600, "2000 - 400 = 1600");
  assert.equal(p3.xMm + p3.widthMm, 2000);
});

test("deepening panel 1 in U shape drops both leg 2 and leg 3 to the new depth", () => {
  const before = [
    rectangle("wizard-leg-0", { widthMm: 1500, lengthMm: 600, xMm: 0, yMm: 0, label: "แผ่นที่ 1" }),
    rectangle("wizard-leg-1", { widthMm: 600, lengthMm: 1200, xMm: 0, yMm: 600, label: "แผ่นที่ 2" }),
    rectangle("wizard-leg-2", { widthMm: 600, lengthMm: 1200, xMm: 900, yMm: 600, label: "แผ่นที่ 3" }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "wizard-leg-0", { lengthMm: 750 }), "u");
  assert.equal(after.find((r) => r.id === "wizard-leg-1")!.yMm, 750);
  assert.equal(after.find((r) => r.id === "wizard-leg-2")!.yMm, 750);
});

test("attachTo right/start moves the child flush against the parent's right edge when the parent resizes", () => {
  const before = [
    rectangle("panel-a", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("panel-b", { widthMm: 500, lengthMm: 600, xMm: 1000, yMm: 0, attachTo: { rectangleId: "panel-a", edge: "right" } }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "panel-a", { widthMm: 1400 }));
  const panelB = after.find((r) => r.id === "panel-b")!;
  assert.equal(panelB.xMm, 1400);
  assert.equal(panelB.yMm, 0);
});

test("attachTo left keeps the child flush against the parent's left edge when the child itself resizes", () => {
  const before = [
    rectangle("panel-a", { widthMm: 1000, lengthMm: 600, xMm: 800, yMm: 0 }),
    rectangle("panel-b", { widthMm: 400, lengthMm: 600, xMm: 400, yMm: 0, attachTo: { rectangleId: "panel-a", edge: "left" } }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "panel-b", { widthMm: 600 }));
  const panelB = after.find((r) => r.id === "panel-b")!;
  assert.equal(panelB.xMm, 200, "800 - 600 = 200");
  assert.equal(panelB.xMm + panelB.widthMm, 800, "right edge stays flush with the parent's left edge");
});

test("attachTo bottom moves the child down when the parent's depth grows", () => {
  const before = [
    rectangle("panel-a", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("panel-b", { widthMm: 1000, lengthMm: 500, xMm: 0, yMm: 600, attachTo: { rectangleId: "panel-a", edge: "bottom" } }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "panel-a", { lengthMm: 900 }));
  assert.equal(after.find((r) => r.id === "panel-b")!.yMm, 900);
});

test("attachTo top places the child above the parent, a direction the old heuristic could never produce", () => {
  const before = [
    rectangle("panel-a", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 500 }),
    rectangle("panel-b", { widthMm: 1000, lengthMm: 300, xMm: 0, yMm: 200, attachTo: { rectangleId: "panel-a", edge: "top" } }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "panel-b", { lengthMm: 350 }));
  const panelB = after.find((r) => r.id === "panel-b")!;
  assert.equal(panelB.yMm, 150, "500 - 350 = 150");
  assert.equal(panelB.yMm + panelB.lengthMm, 500, "bottom edge stays flush with the parent's top edge");
});

test("attachTo align start/center/end position the cross-axis correctly for a right attachment", () => {
  const before = [
    rectangle("parent", { widthMm: 1000, lengthMm: 1200, xMm: 0, yMm: 0 }),
    rectangle("child-start", { widthMm: 400, lengthMm: 300, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge: "right", align: "start" } }),
    rectangle("child-center", { widthMm: 400, lengthMm: 300, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge: "right", align: "center" } }),
    rectangle("child-end", { widthMm: 400, lengthMm: 300, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge: "right", align: "end" } }),
  ];
  const after = reflowStudioRectangles(before, before);
  assert.equal(after.find((r) => r.id === "child-start")!.yMm, 0);
  assert.equal(after.find((r) => r.id === "child-center")!.yMm, 450, "(1200 - 300) / 2 = 450");
  assert.equal(after.find((r) => r.id === "child-end")!.yMm, 900, "1200 - 300 = 900");
});

test("attachTo omitting align defaults to start", () => {
  const before = [
    rectangle("parent", { widthMm: 1000, lengthMm: 1200, xMm: 0, yMm: 0 }),
    rectangle("child", { widthMm: 400, lengthMm: 300, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge: "right" } }),
  ];
  const after = reflowStudioRectangles(before, before);
  assert.equal(after.find((r) => r.id === "child")!.yMm, 0);
});

test("attachTo chains resolve through multiple levels when the root resizes", () => {
  const before = [
    rectangle("root", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("mid", { widthMm: 500, lengthMm: 600, xMm: 1000, yMm: 0, attachTo: { rectangleId: "root", edge: "right" } }),
    rectangle("leaf", { widthMm: 300, lengthMm: 600, xMm: 1500, yMm: 0, attachTo: { rectangleId: "mid", edge: "right" } }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "root", { widthMm: 1400 }));
  assert.equal(after.find((r) => r.id === "mid")!.xMm, 1400);
  assert.equal(after.find((r) => r.id === "leaf")!.xMm, 1900, "1400 + 500 = 1900");
});

test("attachTo leaves rectangles without their own attachTo untouched in a mixed piece", () => {
  const before = [
    rectangle("root", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("child", { widthMm: 400, lengthMm: 600, xMm: 1000, yMm: 0, attachTo: { rectangleId: "root", edge: "right" } }),
    rectangle("free", { widthMm: 200, lengthMm: 200, xMm: 5000, yMm: 5000 }),
  ];
  const after = reflowStudioRectangles(before, withSize(before, "root", { widthMm: 1200 }));
  assert.equal(after.find((r) => r.id === "child")!.xMm, 1200);
  const free = after.find((r) => r.id === "free")!;
  assert.equal(free.xMm, 5000);
  assert.equal(free.yMm, 5000);
});

test("attachTo pointing at a missing rectangle id keeps the orphaned rectangle at its own position", () => {
  const before = [
    rectangle("root", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("orphan", { widthMm: 300, lengthMm: 300, xMm: 777, yMm: 888, attachTo: { rectangleId: "does-not-exist", edge: "right" } }),
  ];
  const after = reflowStudioRectangles(before, before);
  const orphan = after.find((r) => r.id === "orphan")!;
  assert.equal(orphan.xMm, 777);
  assert.equal(orphan.yMm, 888);
});

test("attachTo cycles resolve without throwing or hanging", () => {
  const before = [
    rectangle("a", { widthMm: 500, lengthMm: 500, xMm: 0, yMm: 0, attachTo: { rectangleId: "b", edge: "right" } }),
    rectangle("b", { widthMm: 500, lengthMm: 500, xMm: 500, yMm: 0, attachTo: { rectangleId: "a", edge: "right" } }),
  ];
  assert.doesNotThrow(() => reflowStudioRectangles(before, before));
  assert.equal(reflowStudioRectangles(before, before).length, 2);
});

test("attachTo is opt-in: a piece where no rectangle uses it still takes the legacy U/L heuristic path", () => {
  const before = uShape();
  const after = reflowStudioRectangles(before, withSize(before, "right-leg", { widthMm: 400 }));
  const rightLeg = after.find((item) => item.id === "right-leg")!;
  assert.equal(rightLeg.xMm, 1100, "unchanged legacy behaviour: right leg stays flush with the piece's right edge");
});

test("resolveMatchingStoneForBasin matches a basin's own colorCode against the stone catalog", () => {
  assert.equal(resolveMatchingStoneForBasin("KF001"), "VS311");
  assert.equal(resolveMatchingStoneForBasin("KF009"), "NB091");
  assert.equal(resolveMatchingStoneForBasin("no-such-sku"), null);
});

test("studioEstimate auto-matches the placed basin's stone color when none is chosen yet", () => {
  const state = baseState({
    activeStone: "",
    stoneColors: [],
    basinSkus: ["KF009"],
    basinPlacements: [{ id: "basin-1", sku: "KF009", pieceId: "piece-1", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
  });
  const estimate = studioEstimate(state, PRODUCTS);
  assert.equal(estimate.stoneUnitPriceTHB, 8500, "NB091 (auto-matched from KF009) installs at 8,500 THB/sqm");
  assert.equal(
    estimate.stoneTotalTHB,
    studioEstimate({ ...state, activeStone: "NB091" }, PRODUCTS).stoneTotalTHB,
    "auto-matching must price identically to the user picking NB091 themselves",
  );
});

test("studioEstimate never overrides a stone color the user already picked", () => {
  const state = baseState({
    activeStone: "BW010",
    basinSkus: ["KF009"],
    basinPlacements: [{ id: "basin-1", sku: "KF009", pieceId: "piece-1", xMm: 50, yMm: 50, widthMm: 500, depthMm: 500 }],
  });
  const estimate = studioEstimate(state, PRODUCTS);
  assert.notEqual(estimate.stoneUnitPriceTHB, 8500, "a user-picked stone (BW010) must win over the basin's own color (NB091)");
});

// job-241: replacing a basin model must not undo the rotation, and shrinking the board must move the drawn position.

const basinProducts = PRODUCTS.filter((product) => {
  const size = basinDimensionsForProduct(product);
  return size.widthMm !== null && size.depthMm !== null;
});
const turned = (overrides: Partial<StudioState["basinPlacements"][number]> = {}): StudioState["basinPlacements"][number] => ({
  id: "basin-turned",
  sku: "KF003",
  pieceId: "piece-1",
  xMm: 300,
  yMm: 125,
  widthMm: 350,
  depthMm: 500,
  rotation: 90,
  orientation: "vertical",
  ...overrides,
});

test("replaceStudioBasin keeps a turned (vertical) KF003 at a 500 x 350 cut-out when the model is replaced", () => {
  const state = baseState({ basinSkus: ["KF003"], basinPlacements: [turned()] });
  assert.deepEqual(placementCutSize(state.basinPlacements[0]!), { widthMm: 500, heightMm: 350 });

  const replacement = PRODUCTS.find((product) => product.sku === "KF003")!;
  const replaced = replaceStudioBasin(state, "KF003", replacement).basinPlacements[0]!;

  assert.deepEqual(placementCutSize(replaced), { widthMm: 500, heightMm: 350 }, "the footprint must not flip to 350 x 500");
  assert.equal(replaced.rotation, 90);
  assert.equal(basinPlacementOrientation(replaced), "vertical");
  // the stored size is the basin's own, not a pre-swapped one
  assert.deepEqual([replaced.widthMm, replaced.depthMm], [350, 500]);
});

test("replaceStudioBasin: for every model the cut-out of a turned basin is the model's depth x width, and of an unturned one width x depth", () => {
  assert.ok(basinProducts.length > 3, "the catalog should provide several basin sizes to check");
  for (const product of basinProducts) {
    const own = basinDimensionsForProduct(product);
    for (const turnedBasin of [true, false]) {
      const placement = turnedBasin
        ? turned({ sku: "KF001", widthMm: 500, depthMm: 500 })
        : { id: "basin-flat", sku: "KF001", pieceId: "piece-1", xMm: 300, yMm: 125, widthMm: 500, depthMm: 500, rotation: 0 as const, orientation: "horizontal" as const };
      const replaced = replaceStudioBasin(baseState({ basinSkus: ["KF001"], basinPlacements: [placement] }), "KF001", product).basinPlacements[0]!;
      assert.deepEqual(
        placementCutSize(replaced),
        turnedBasin ? { widthMm: own.depthMm, heightMm: own.widthMm } : { widthMm: own.widthMm, heightMm: own.depthMm },
        `${product.sku} ${turnedBasin ? "turned" : "unturned"}`,
      );
      assert.equal(replaced.sku, product.sku);
    }
  }
});

test("replaceStudioBasin: swapping to another model and back leaves a turned basin with the same cut-out", () => {
  const original = baseState({ basinSkus: ["KF003"], basinPlacements: [turned()] });
  const kf001 = PRODUCTS.find((product) => product.sku === "KF001")!;
  const kf003 = PRODUCTS.find((product) => product.sku === "KF003")!;
  const there = replaceStudioBasin(original, "KF003", kf001);
  const back = replaceStudioBasin(there, "KF001", kf003);
  assert.deepEqual(placementCutSize(back.basinPlacements[0]!), placementCutSize(original.basinPlacements[0]!));
  assert.deepEqual(back.basinPlacements[0], original.basinPlacements[0]);
});

test("replaceStudioBasin: a turned KF003 that fits the 600 mm counter with 100 mm clearance still fits after the model is replaced", () => {
  const layout = piece([rectangle("r1", { widthMm: 1800, lengthMm: 600 })]);
  const state = baseState({ pieces: [layout], basinSkus: ["KF003"], basinPlacements: [turned({ yMm: 125 })] });
  assert.equal(placementFitsStudioPiece(layout, state.basinPlacements[0]!), true);
  const replaced = replaceStudioBasin(state, "KF003", PRODUCTS.find((product) => product.sku === "KF003")!).basinPlacements[0]!;
  // 125 + 350 = 475, inside 600 - 100; the flipped 350 x 500 footprint (125 + 500 = 625) would hang off the sheet
  assert.equal(placementFitsStudioPiece(layout, replaced), true);
});

test("replaceStudioBasin only touches the placements of the replaced SKU", () => {
  const other = { id: "basin-other", sku: "KF002", pieceId: "piece-1", xMm: 900, yMm: 60, widthMm: 400, depthMm: 400 };
  const state = baseState({ basinSkus: ["KF003", "KF002"], basinPlacements: [turned(), other] });
  const replaced = replaceStudioBasin(state, "KF003", PRODUCTS.find((product) => product.sku === "KF001")!);
  assert.deepEqual(replaced.basinPlacements[1], other);
});

const SHEET_1800 = rectangle("r1", { widthMm: 1800, lengthMm: 600 });
const anchoredBasin = (anchor: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center", xMm: number, yMm: number) => {
  const placement = { id: `basin-${anchor}`, sku: "KF001", pieceId: "piece-1", sheetId: "r1", xMm, yMm, widthMm: 500, depthMm: 350, rotation: 0 as const, orientation: "horizontal" as const, anchor };
  return { ...placement, ...calculateBasinOffsets(SHEET_1800, placement, { xMm, yMm }, anchor) };
};

test("applyStudioSizePreset: shrinking 1800 -> 400 moves the drawn position with xMm (offsetXMm 725 -> 100, drawn at x=100, not x=725)", () => {
  const basin = anchoredBasin("top-left", 725, 125);
  assert.equal(basin.offsetXMm, 725);
  const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800])], basinPlacements: [basin] }), 400, 600);
  const result = resized.basinPlacements[0]!;
  const newSheet = resized.pieces![0]!.rectangles[0]!;

  assert.equal(result.xMm, 100);
  assert.equal(result.offsetXMm, 100);
  assert.deepEqual(calculateBasinCoordinates(newSheet, result), { xMm: 100, yMm: 125 }, "what the canvas draws");
  assert.notEqual(calculateBasinCoordinates(newSheet, result).xMm, 725);
});

test("applyStudioSizePreset: for every anchor the position the canvas draws equals xMm/yMm after the board is resized", () => {
  for (const anchor of ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const) {
    for (const [width, depth] of [[1200, 600], [400, 600], [2400, 700], [900, 500]]) {
      const basin = anchoredBasin(anchor, 725, 125);
      const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800])], basinPlacements: [basin] }), width!, depth);
      const result = resized.basinPlacements[0]!;
      const drawn = calculateBasinCoordinates(resized.pieces![0]!.rectangles[0]!, result);
      assert.deepEqual(drawn, { xMm: result.xMm, yMm: result.yMm }, `${anchor} ${width}x${depth}`);
      assert.equal(result.yMm, 125, `${anchor} ${width}x${depth}: only X is re-centred`);
    }
  }
});

test("applyStudioSizePreset: enlarging the board also keeps the drawn position equal to xMm", () => {
  const basin = anchoredBasin("top-left", 100, 125);
  const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800])], basinPlacements: [basin] }), 2400, 600);
  const result = resized.basinPlacements[0]!;
  assert.equal(result.xMm, 950, "(2400 - 500) / 2");
  assert.deepEqual(calculateBasinCoordinates(resized.pieces![0]!.rectangles[0]!, result), { xMm: 950, yMm: 125 });
});

test("applyStudioSizePreset: a turned basin is re-centred by its turned footprint and its drawn position follows", () => {
  const base = turned({ sheetId: "r1", xMm: 725, yMm: 125 });
  const placement = { ...base, anchor: "top-left" as const, ...calculateBasinOffsets(SHEET_1800, base, { xMm: 725, yMm: 125 }, "top-left") };
  const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800])], basinSkus: ["KF003"], basinPlacements: [placement] }), 1200, 600);
  const result = resized.basinPlacements[0]!;
  assert.equal(result.xMm, 350, "(1200 - 500) / 2 with the 500 mm turned footprint");
  assert.deepEqual(calculateBasinCoordinates(resized.pieces![0]!.rectangles[0]!, result), { xMm: 350, yMm: 125 });
});

test("applyStudioSizePreset leaves a basin that never had offsets without any (nothing to keep in step)", () => {
  const plain = { id: "basin-plain", sku: "KF001", pieceId: "piece-1", xMm: 725, yMm: 125, widthMm: 500, depthMm: 350 };
  const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800])], basinPlacements: [plain] }), 400, 600);
  const result = resized.basinPlacements[0]!;
  assert.equal(result.xMm, 100);
  assert.equal("offsetXMm" in result, false);
  assert.equal("offsetYMm" in result, false);
  assert.equal("anchor" in result, false);
});

test("applyStudioSizePreset does not move basins on another sheet, and keeps a level-snapped basin consistent with its offsets", () => {
  const otherSheet = rectangle("r2", { xMm: 0, yMm: 700, widthMm: 1800, lengthMm: 600 });
  const elsewhere = { ...anchoredBasin("top-left", 725, 125), id: "basin-elsewhere", sheetId: "r2", yMm: 800 };
  const levelBase = { ...anchoredBasin("top-left", 725, 125), id: "basin-level", positionLevel: 7 as const };
  const resized = applyStudioSizePreset(baseState({ pieces: [piece([SHEET_1800, otherSheet])], basinPlacements: [elsewhere, levelBase] }), 1200, 600);
  assert.deepEqual(resized.basinPlacements[0], elsewhere);
  const level = resized.basinPlacements[1]!;
  assert.deepEqual(calculateBasinCoordinates(resized.pieces![0]!.rectangles[0]!, level), { xMm: level.xMm, yMm: level.yMm });
});
