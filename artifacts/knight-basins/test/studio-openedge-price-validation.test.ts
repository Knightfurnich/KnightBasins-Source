import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STONE_COLORS } from "../src/data/catalog.ts";
import { studioEstimate, type StudioState } from "../src/data/studio-model.ts";

// The open-edge price per metre must be a non-negative number with at most 2 decimals. The check used to be
// `Math.round(price * 100) !== price`, which is true for every price except 0 (150 * 100 = 15000, not 150), so a
// quote with any open-edge price was flagged invalid, could not be saved, and showed a warning that said the price
// had too many decimals. The check is now `Math.round(price * 100) / 100 !== price`.

const RECTANGLE = { id: "piece-1-1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 as const, label: "A" };

/** A single 1.8 x 0.6 m board in Bangkok with the left edge (600 mm) marked as an open edge. */
function studioState(openEdgePricePerMTHB: number | null | undefined): StudioState {
  const piece = { id: "piece-1", name: "Piece 1", rectangles: [{ ...RECTANGLE }], sideStatuses: { "piece-1-1:left": "open-edge" } };
  return {
    mode: "studio",
    shape: "I",
    dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
    pieces: [piece],
    activePieceId: piece.id,
    backsplash: { enabled: false, heightMm: 120 },
    upstandHeightMm: 120,
    openEdgePricePerMTHB,
    discountTHB: 0,
    location: "bangkok-metro",
    vat: false,
    quoteFormat: "US",
    stoneColors: [],
    activeStone: STONE_COLORS[0]!.code,
    stoneSelectionSource: "user",
    basinSkus: [],
    basinPlacements: [],
  } as unknown as StudioState;
}

const estimateFor = (price: number | null | undefined) => studioEstimate(studioState(price), []);
const invalid = (price: number | null | undefined) => estimateFor(price).openEdgePriceInvalid;
const INVALID_PRICE_WARNING = "ราคาขอบเปิดต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง";

describe("job-230: open-edge price validation", () => {
  it("accepts whole-number prices (150 is valid, as are 1, 1000 and 99999)", () => {
    for (const price of [1, 150, 1000, 99_999]) assert.equal(invalid(price), false, `price ${price}`);
  });

  it("accepts prices with one or two decimals (150.5, 150.50, 0.01, 99.99, 1234.56)", () => {
    for (const price of [0.5, 150.5, 150.5, 0.01, 99.99, 1234.56]) assert.equal(invalid(price), false, `price ${price}`);
  });

  it("accepts the prices whose decimal part is awkward in floating point (0.07, 150.55, 1.15, 19.99, 8.3)", () => {
    // 150.55 * 100 is 15055.000000000002 in floating point; the rounding step is what makes these pass
    for (const price of [0.07, 150.55, 1.15, 19.99, 8.3, 0.29, 4.35]) assert.equal(invalid(price), false, `price ${price}`);
  });

  it("accepts 0 (a free open edge) and 'not set'", () => {
    assert.equal(invalid(0), false);
    assert.equal(invalid(null), false);
    assert.equal(invalid(undefined), false);
  });

  it("refuses a third decimal (150.555, 0.001, 1.005, 99.999)", () => {
    for (const price of [150.555, 0.001, 1.005, 99.999]) assert.equal(invalid(price), true, `price ${price}`);
  });

  it("refuses a negative price (-10, -0.01, -150.55)", () => {
    for (const price of [-10, -0.01, -150.55]) assert.equal(invalid(price), true, `price ${price}`);
  });

  it("refuses a price that is not a finite number", () => {
    for (const price of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) assert.equal(invalid(price), true, `price ${price}`);
  });

  it("never flags a price with at most 2 decimals, across every amount from 0.00 to 2,000.00", () => {
    // A hand-picked list can miss a floating-point corner: walk every satang.
    const wrong: number[] = [];
    for (let cents = 0; cents <= 200_000; cents += 1) {
      const price = Number((cents / 100).toFixed(2));
      if (invalid(price)) wrong.push(price);
    }
    // compare counts, not arrays: with the old check 200,000 prices are flagged and a diff of that size would hide the message
    assert.equal(wrong.length, 0, `${wrong.length} valid prices were flagged, first: ${wrong.slice(0, 5).join(", ")}`);
  });

  it("flags every price that really has a third decimal, across 0.001 to 20.000", () => {
    const missed: number[] = [];
    for (let thousandths = 1; thousandths <= 20_000; thousandths += 1) {
      if (thousandths % 10 === 0) continue; // that is a 2-decimal price
      const price = Number((thousandths / 1000).toFixed(3));
      if (!invalid(price)) missed.push(price);
    }
    assert.equal(missed.length, 0, `${missed.length} three-decimal prices were not flagged, first: ${missed.slice(0, 5).join(", ")}`);
  });
});

describe("job-230: a quote with an open-edge price can be saved", () => {
  it("is valid and charges the open edge: 0.6 m at 150 per metre = 90", () => {
    const estimate = estimateFor(150);
    assert.equal(estimate.openEdgePriceInvalid, false);
    assert.equal(estimate.openEdgeLengthM, 0.6);
    assert.equal(estimate.openEdgeUnitPriceTHB, 150);
    assert.equal(estimate.openEdgeTotalTHB, 90, "0.6 m x 150 = 90");
    assert.equal(estimate.isValid, true, "isValid is what lets the studio page save or submit the quote");
    assert.ok(!estimate.warnings.includes(INVALID_PRICE_WARNING), "and no 'too many decimals' warning is shown");
  });

  it("rounds the charge to whole baht the same way as before: 0.6 m at 150.50 = 90.3 -> 90", () => {
    const estimate = estimateFor(150.5);
    assert.equal(estimate.openEdgePriceInvalid, false);
    assert.equal(estimate.openEdgeTotalTHB, 90);
    assert.equal(estimate.isValid, true);
  });

  it("still refuses to save a quote whose open-edge price is wrong, and says why", () => {
    for (const price of [150.555, -10]) {
      const estimate = estimateFor(price);
      assert.equal(estimate.openEdgePriceInvalid, true, `price ${price}`);
      assert.equal(estimate.isValid, false, `price ${price}`);
      assert.ok(estimate.warnings.includes(INVALID_PRICE_WARNING), `price ${price}`);
    }
  });

  it("does not change the rest of the quote: the total with a valid price is the total without it plus the open-edge charge", () => {
    const without = estimateFor(null);
    const withPrice = estimateFor(150);
    assert.equal(withPrice.totalTHB - without.totalTHB, 90);
    assert.equal(withPrice.stoneTotalTHB, without.stoneTotalTHB);
    assert.equal(withPrice.discountInvalid, without.discountInvalid);
  });
});
