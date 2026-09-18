import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS } from "../src/data/catalog.ts";
import {
  basinDimensionsForProduct,
  basinPlacementOverlapWarnings,
  centerBasinPlacementPosition,
  compareStudioCatalog,
  createBasinPlacement,
  createStudioCatalogContext,
  distributeBasinPlacementPositions,
  disconnectedRectangleIds,
  placementCrossesPanelJoint,
  pieceOverlapWarnings,
  pieceBounds,
  snapStudioRectanglePosition,
  studioAreaSqM,
  studioBasinCatalogEntries,
  studioEdgeTotals,
  studioEstimate,
  studioPieceJoints,
  studioRectangleSize,
  studioStateDimensionsValid,
  studioSubmissionValidationMessage,
  touchingRectangleKeys,
  unknownBasinPlacements,
  resolveStudioCatalogChange,
  replaceStudioBasin,
  removeStudioBasin,
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

test("9,500 stone rates hand off to sales instead of entering automatic totals", () => {
  const estimate = studioEstimate(baseState({ activeStone: "MU010" }), PRODUCTS);
  assert.equal(estimate.sheetCutPriceWarning, false);
  const sheetCutEstimate = studioEstimate(baseState({ activeStone: "BR816O" }), PRODUCTS);
  assert.equal(sheetCutEstimate.stoneUnitPriceTHB, 9500);
  assert.equal(sheetCutEstimate.stoneTotalTHB, 0);
  assert.match(sheetCutEstimate.warnings.join(" "), /แผ่นตัด/);
});

test("submission no longer mentions an edge-clearance rule", () => {
  const estimate = studioEstimate(baseState({ basinPlacements: [] }), PRODUCTS);
  const message = studioSubmissionValidationMessage({ ...baseState(), basinPlacements: [] }, estimate);
  assert.equal(message, "ยังไม่ได้วางอ่างบนผัง กรุณาลากอ่างที่เลือกมาวางบนผัง");
  assert.doesNotMatch(message, /50/);
});

test("empty stone and basin shortlists remain valid without adding automatic selections", () => {
  const state = baseState({ stoneColors: [], activeStone: "", basinSkus: [], basinPlacements: [] });
  const estimate = studioEstimate(state, PRODUCTS);

  assert.equal(estimate.stoneUnitPriceTHB, null);
  assert.equal(estimate.stoneTotalTHB, 0);
  assert.equal(estimate.basinSubtotalTHB, 0);
  assert.equal(estimate.isValid, true);
  assert.equal(studioSubmissionValidationMessage(state, estimate), null);
});

test("catalog products without basin dimensions remain unknown", () => {
  const product = PRODUCTS.find((item) => item.sku === "KF029");
  assert.ok(product);
  const placement = createBasinPlacement(product, 0, "piece-1");
  assert.deepEqual(basinDimensionsForProduct(product), { widthMm: null, depthMm: null });
  assert.deepEqual({ widthMm: placement.widthMm, depthMm: placement.depthMm, xMm: placement.xMm, yMm: placement.yMm }, { widthMm: null, depthMm: null, xMm: 0, yMm: 0 });
  assert.deepEqual(unknownBasinPlacements({ basinPlacements: [placement] }), [placement.id]);
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
  assert.deepEqual(replaced.basinPlacements[0], { ...placement, sku: "KF003", widthMm: 350, depthMm: 500 });
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