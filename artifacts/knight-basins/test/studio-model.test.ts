import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS } from "../src/data/catalog.ts";
import {
  basinDimensionsForProduct,
  backsplashAreaSqM,
  clampBasinPlacementPosition,
  createBasinPlacement,
  counterAreaSqM,
  standardSheetWarning,
  studioEstimate,
  unknownBasinPlacements,
  type StudioState,
} from "../src/data/studio-model.ts";

const baseState: StudioState = {
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  backsplash: { enabled: false, heightMm: 100 },
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [{ id: "basin-1", sku: "KF001", xMm: 100, yMm: 100, widthMm: 500, depthMm: 500 }],
};

test("counter area calculates I, L, and U footprints in square metres", () => {
  assert.equal(counterAreaSqM("I", { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 }), 1.08);
  assert.equal(counterAreaSqM("L", { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 0 }), 1.44);
  assert.equal(counterAreaSqM("U", { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 1000 }), 1.68);
});

test("backsplash adds area without changing counter footprint", () => {
  const dimensions = { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 0 };
  assert.equal(backsplashAreaSqM("L", dimensions, { enabled: true, heightMm: 100 }), 0.3);
  assert.equal(backsplashAreaSqM("L", dimensions, { enabled: false, heightMm: 100 }), 0);
});

test("standard sheet warning catches depth and run overages", () => {
  assert.equal(standardSheetWarning("I", { depthMm: 760, runAMm: 3600, runBMm: 0, runCMm: 0 }), false);
  assert.equal(standardSheetWarning("I", { depthMm: 761, runAMm: 3600, runBMm: 0, runCMm: 0 }), true);
  assert.equal(standardSheetWarning("L", { depthMm: 600, runAMm: 3601, runBMm: 1200, runCMm: 0 }), true);
});

test("studio estimate includes backsplash and basin installation, never a cut-out fee", () => {
  const estimate = studioEstimate({
    ...baseState,
    backsplash: { enabled: true, heightMm: 100 },
  }, PRODUCTS);
  assert.equal(estimate.counterAreaSqM, 1.08);
  assert.equal(estimate.stoneAreaSqM, 1.26);
  assert.equal(estimate.basinSubtotalTHB, 19000);
  assert.equal(estimate.installationChargeTHB, 5000);
  assert.equal(estimate.totalTHB, estimate.stoneTotalTHB + 24000 + 5000);
});

test("studio estimate matches the saved-quote acceptance example", () => {
  const estimate = studioEstimate({
    ...baseState,
    activeStone: "BW010",
    basinSkus: ["KF001"],
    backsplash: { enabled: true, heightMm: 100 },
    basinPlacements: [
      { ...baseState.basinPlacements[0], id: "basin-1", xMm: 70, yMm: 50 },
      { ...baseState.basinPlacements[0], id: "basin-2", xMm: 620, yMm: 50 },
      { ...baseState.basinPlacements[0], id: "basin-3", xMm: 1170, yMm: 50 },
    ],
  }, PRODUCTS);
  assert.equal(estimate.stoneAreaSqM, 1.26);
  assert.equal(estimate.stoneTotalTHB, 9450);
  assert.equal(estimate.basinSubtotalTHB, 57000);
  assert.equal(estimate.installationChargeTHB, 0);
  assert.equal(estimate.smallJobFeeTHB, 5000);
  assert.equal(estimate.totalTHB, 71450);
  assert.equal(estimate.isValid, true);
});

test("unsafe basin placement blocks final studio submission", () => {
  const estimate = studioEstimate({
    ...baseState,
    basinPlacements: [{ ...baseState.basinPlacements[0], xMm: 10 }],
  }, PRODUCTS);
  assert.deepEqual(estimate.unsafePlacements, ["basin-1"]);
  assert.equal(estimate.isValid, false);
});

test("three placed basin sets keep the shortlist limit but waive installation", () => {
  const estimate = studioEstimate({
    ...baseState,
    basinPlacements: [
      { ...baseState.basinPlacements[0], xMm: 70, yMm: 50 },
      { ...baseState.basinPlacements[0], id: "basin-2", xMm: 620, yMm: 50 },
      { ...baseState.basinPlacements[0], id: "basin-3", xMm: 1170, yMm: 50 },
    ],
  }, PRODUCTS);
  assert.equal(estimate.basinSubtotalTHB, 57000);
  assert.equal(estimate.installationChargeTHB, 0);
  assert.equal(estimate.installationDiscountTHB, 15000);
  assert.equal(estimate.isValid, true);
});

test("new basin positions are clamped from the actual drop point", () => {
  const placement = { widthMm: 500, depthMm: 500 };
  assert.deepEqual(
    clampBasinPlacementPosition(placement, 1200, 80, { runAMm: 1800, depthMm: 600 }),
    { xMm: 1200, yMm: 80 },
  );
  assert.notDeepEqual(
    clampBasinPlacementPosition(placement, 100, 100, { runAMm: 1800, depthMm: 600 }),
    clampBasinPlacementPosition(placement, 1200, 80, { runAMm: 1800, depthMm: 600 }),
  );
});

test("catalog products without basin dimensions remain unknown instead of using guessed sizes", () => {
  const product = PRODUCTS.find((item) => item.sku === "KF029");
  assert.ok(product);
  assert.deepEqual(basinDimensionsForProduct(product), { widthMm: null, depthMm: null });
  const placement = createBasinPlacement(product, 0);
  assert.deepEqual({ widthMm: placement.widthMm, depthMm: placement.depthMm }, { widthMm: null, depthMm: null });
  assert.deepEqual(unknownBasinPlacements({ basinPlacements: [placement] }), [placement.id]);
  const estimate = studioEstimate({ ...baseState, basinSkus: ["KF029"], basinPlacements: [placement] }, PRODUCTS);
  assert.deepEqual(estimate.unknownDimensionPlacements, [placement.id]);
  assert.equal(estimate.isValid, false);
});