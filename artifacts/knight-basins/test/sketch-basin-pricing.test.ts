import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "../src/data/catalog.ts";
import {
  studioEstimate,
  type StudioState,
} from "../src/data/studio-model.ts";

function makeSketchState(basinSkus: string[], widthMm = 1800, lengthMm = 600): StudioState {
  return {
    mode: "sketch",
    shape: "I",
    dimensions: { runAMm: widthMm, depthMm: lengthMm, runBMm: 0, runCMm: 0 },
    pieces: [{
      id: "piece-0",
      name: "ชิ้นงาน 1",
      rectangles: [{ id: "r-0", xMm: 0, yMm: 0, widthMm, lengthMm, rotation: 0 }],
      sideStatuses: {},
    }],
    backsplash: { enabled: false, heightMm: 120 },
    upstandHeightMm: null,
    openEdgePricePerMTHB: null,
    discountTHB: 0,
    location: "bangkok-metro",
    vat: false,
    quoteFormat: "US",
    stoneColors: ["NB091"],
    activeStone: "NB091",
    basinSkus,
    basinPlacements: [],
  };
}

test("sketch mode prices selected basins even when not placed on a canvas", () => {
  const state = makeSketchState(["KF025"]);
  const estimate = studioEstimate(state, PRODUCTS);
  
  // KF025 price is 24,000 THB + 5,000 installation
  assert.equal(estimate.basinSubtotalTHB, 24000);
  assert.equal(estimate.installationChargeTHB, 5000);
  assert.ok(estimate.grossSubtotalTHB > 24000);
});

test("sketch mode recalculates area when dimensions are adjusted", () => {
  // Set dimensions to 1.98m x 0.45m
  const state = makeSketchState(["KF025"], 1980, 450);
  const estimate = studioEstimate(state, PRODUCTS);
  
  // 1.98 * 0.45 = 0.891 m²
  assert.equal(estimate.counterAreaSqM.toFixed(3), "0.891");
  // Stone rate for NB091 is 8500 -> 0.891 * 8500 = 7573.5 -> round to 7574
  assert.equal(estimate.stoneTotalTHB, 7574);
  assert.equal(estimate.basinSubtotalTHB, 24000);
});
