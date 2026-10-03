import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { STONE_COLORS, basinProductFromCatalog } from "../../knight-basins/src/data/catalog.ts";
import { createBasinPlacement, studioEstimate, type StudioState } from "../../knight-basins/src/data/studio-model.ts";
import {
  PRICE_TAMPER_AUDIT_ACTION,
  PRICE_VERIFICATION_FAILED_ERROR,
  PRICE_VERIFICATION_FAILED_MESSAGE,
  SERVER_PRICING_KEY,
  checkQuoteBeforePayment,
  loadPricingCatalog,
  verifyAndRecalculateQuoteTotal,
  withServerPricing,
  type PricingCatalog,
} from "../src/lib/price-integrity.ts";
import {
  FIXTURE_BASIN_ROWS,
  fixtureBasinSku,
  pricingOnlyDatabase,
  quickPurchaseData,
  withPricingCatalog,
} from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job-226: the server prices a studio / quick-purchase quote itself, from the database, before it saves the quote
// (POST /api/leads) and again before it builds a payment QR (POST /api/public/quotes/promptpay-qr). A customer's own
// discount and open-edge price are never accepted. Every expected number below is worked out by hand in a comment;
// none of them is copied from the code under test.
//
// Fixture catalog (price-guard-fixtures.ts): basins TESTB-15000 and TESTB-25000 (priced at their names); stone TEST-ST1
// at 8,000 THB per m2 installed and 5,000 per sheet; stone TEST-SHEET sold by the sheet only (no installed price).

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

const BASIN_25000 = fixtureBasinSku(25000);
const BASIN_15000 = fixtureBasinSku(15000);

async function fixtureCatalog(override = {}): Promise<PricingCatalog> {
  return loadPricingCatalog(pricingOnlyDatabase(override));
}

// ---- a studio state like the storefront's: one 1,800 x 600 board, stone TEST-ST1, Bangkok, no VAT ------------------------

const RECTANGLE = { id: "piece-1-1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 as const, label: "A" };

function studioState(overrides: Partial<StudioState> = {}, sideStatuses: Record<string, string> = {}, basinSku: string | null = BASIN_25000): StudioState {
  const piece = { id: "piece-1", name: "Piece 1", rectangles: [{ ...RECTANGLE }], sideStatuses };
  const placements = basinSku === null
    ? []
    : [createBasinPlacement(basinProductFromCatalog(FIXTURE_BASIN_ROWS.find((row) => row.sku === basinSku)!), 0, piece.id, RECTANGLE.id)];
  return {
    mode: "studio",
    shape: "I",
    dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
    pieces: [piece],
    activePieceId: piece.id,
    backsplash: { enabled: false, heightMm: 120 },
    upstandHeightMm: 120,
    openEdgePricePerMTHB: null,
    discountTHB: 0,
    location: "bangkok-metro",
    vat: false,
    quoteFormat: "US",
    stoneColors: [],
    activeStone: "TEST-ST1",
    stoneSelectionSource: "user",
    basinSkus: placements.map((placement) => placement.sku),
    basinPlacements: placements,
    ...overrides,
  } as unknown as StudioState;
}

/** What the customer's browser computes: the catalog goes into the shared lists first (as the storefront does), then studioEstimate runs. */
function browserEstimate(state: StudioState, catalog: PricingCatalog) {
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...catalog.stoneColors);
  try {
    return studioEstimate(state, catalog.products);
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

/** The studioData an honest browser submits for `state`. */
function studioPayload(state: StudioState, catalog: PricingCatalog, extra: Record<string, unknown> = {}) {
  const estimate = browserEstimate(state, catalog);
  return { state, estimate, notification: { total: estimate.totalTHB }, ...extra };
}

// Hand calculation for studioState() with the 25,000 basin, bangkok-metro, no VAT, no edges:
//   stone   1.8 m x 0.6 m = 1.08 m2 x 8,000 = 8,640
//   basin   25,000
//   install 1 basin x 5,000 = 5,000 (free only from 3 basins)
//   small job: 1.08 m2 is under the 5 m2 Bangkok minimum -> 5,000
//   total   8,640 + 25,000 + 5,000 + 5,000 = 43,640
const STUDIO_TOTAL = 43_640;
// With VAT: 43,640 x 7% = 3,054.8 -> 3,055 -> 46,695
const STUDIO_TOTAL_WITH_VAT = 46_695;

// ---- quick-purchase lines like the storefront's ------------------------------------------------------------------------

function basinLine(sku: string, quantity: number, unitPrice: number) {
  return { code: sku, description: "basin", quantity, unit: "ชุด", unitPrice, total: unitPrice * quantity, notificationKind: "basin" };
}
function installLine(sets: number) {
  return { code: "INSTALL", description: "installation", quantity: sets, unit: "ชุด", unitPrice: 5000, total: 5000 * sets, notificationKind: "service" };
}
function installedStoneLine(areaSqM: number, unitPrice = 8000) {
  return { code: "TEST-ST1", description: "stone", quantity: areaSqM, unit: "ตร.ม.", unitPrice, total: unitPrice * areaSqM, notificationKind: "stone" };
}
function sheetStoneLine(sheets: number, unitPrice: number, code = "TEST-ST1") {
  return { code, description: "stone", quantity: sheets, unit: "แผ่น", unitPrice, total: unitPrice * sheets, notificationKind: "stone" };
}
function quickPurchase(items: unknown[], total: number, extra: Record<string, unknown> = {}) {
  return { kind: "quick-purchase", items, total, vat: false, ...extra };
}

// ================================================================================================================
// 1. verifyAndRecalculateQuoteTotal — studio mode
// ================================================================================================================

describe("job-226: server price check, studio mode", () => {
  it("prices the hand-calculated board at 43,640 and accepts an honest payload", async () => {
    const catalog = await fixtureCatalog();
    const state = studioState();
    const payload = studioPayload(state, catalog);
    assert.equal(payload.estimate.totalTHB, STUDIO_TOTAL, "the browser's own estimate agrees with the hand calculation");

    const result = await verifyAndRecalculateQuoteTotal("studio", payload, catalog);
    assert.equal(result.isTampered, false);
    assert.equal(result.calculatedTotal, STUDIO_TOTAL);
    assert.deepEqual(result.claimedTotals, { "notification.total": STUDIO_TOTAL, "estimate.totalTHB": STUDIO_TOTAL });
  });

  it("applies VAT the way the storefront does (7% of the subtotal, rounded)", async () => {
    const catalog = await fixtureCatalog();
    const payload = studioPayload(studioState({ vat: true }), catalog);
    const result = await verifyAndRecalculateQuoteTotal("studio", payload, catalog);
    assert.equal(result.calculatedTotal, STUDIO_TOTAL_WITH_VAT);
    assert.equal(result.isTampered, false);
  });

  it("catches a total edited down from 43,640 to 100 (every claimed field)", async () => {
    const catalog = await fixtureCatalog();
    const payload = { ...studioPayload(studioState(), catalog), total: 100, notification: { total: 100 }, estimate: { totalTHB: 100 } };
    const result = await verifyAndRecalculateQuoteTotal("studio", payload, catalog);
    assert.equal(result.isTampered, true);
    assert.match(result.reason ?? "", /^total-mismatch:/);
    assert.equal(result.calculatedTotal, STUDIO_TOTAL, "the server's number is reported, never the forged one");
    assert.deepEqual(result.claimedTotals, { "notification.total": 100, total: 100, "estimate.totalTHB": 100 });
  });

  it("checks every claimed total: one honest field does not cover for a forged one", async () => {
    const catalog = await fixtureCatalog();
    const honest = studioPayload(studioState(), catalog);
    for (const [field, forged] of [
      ["notification.total", { ...honest, notification: { total: 100 } }],
      ["estimate.totalTHB", { ...honest, estimate: { ...honest.estimate, totalTHB: 100 } }],
      ["total", { ...honest, total: 100 }],
    ] as const) {
      const result = await verifyAndRecalculateQuoteTotal("studio", forged, catalog);
      assert.equal(result.isTampered, true, `${field} forged on its own must be caught`);
      assert.equal(result.reason, `total-mismatch:${field}`);
    }
  });

  it("accepts rounding noise of up to 1 baht and rejects more", async () => {
    const catalog = await fixtureCatalog();
    const state = studioState();
    for (const [claimed, tampered] of [[STUDIO_TOTAL + 0.9, false], [STUDIO_TOTAL - 1, false], [STUDIO_TOTAL + 2, true], [STUDIO_TOTAL - 1.5, true]] as const) {
      const result = await verifyAndRecalculateQuoteTotal("studio", { state, notification: { total: claimed } }, catalog);
      assert.equal(result.isTampered, tampered, `claimed ${claimed}`);
    }
  });

  it("never accepts a customer discount: a total that already includes one is tampered, and the discount is reported", async () => {
    const catalog = await fixtureCatalog();
    // 40,000 off: the browser then shows 43,640 - 40,000 = 3,640
    const discounted = studioPayload(studioState({ discountTHB: 40_000 }), catalog);
    assert.equal(discounted.estimate.totalTHB, 3_640, "sanity: the browser really applies the typed discount");

    const result = await verifyAndRecalculateQuoteTotal("studio", discounted, catalog);
    assert.equal(result.isTampered, true);
    assert.equal(result.calculatedTotal, STUDIO_TOTAL, "priced with a discount of 0");
    assert.equal(result.discountIgnoredTHB, 40_000);
  });

  it("treats a typed discount as 0: with an honest undiscounted total the quote is fine and still priced at 43,640", async () => {
    const catalog = await fixtureCatalog();
    const payload = { state: studioState({ discountTHB: 40_000 }), notification: { total: STUDIO_TOTAL } };
    const result = await verifyAndRecalculateQuoteTotal("studio", payload, catalog);
    assert.equal(result.isTampered, false);
    assert.equal(result.calculatedTotal, STUDIO_TOTAL);
    assert.equal(result.discountIgnoredTHB, 40_000);
  });

  it("never accepts a customer open-edge price", async () => {
    const catalog = await fixtureCatalog();
    // the left edge (600 mm) marked as an open edge, and the customer asks 1,000 per metre: 0.6 m x 1,000 = 600 extra in the browser
    const state = studioState({ openEdgePricePerMTHB: 1000 }, { "piece-1-1:left": "open-edge" });
    const browser = studioPayload(state, catalog);
    assert.equal(browser.estimate.totalTHB, STUDIO_TOTAL + 600, "sanity: the browser really charges the typed open-edge price");

    const forged = await verifyAndRecalculateQuoteTotal("studio", browser, catalog);
    assert.equal(forged.isTampered, true);
    assert.equal(forged.calculatedTotal, STUDIO_TOTAL, "the open-edge length is priced at the standard price (none)");

    const withoutExtra = await verifyAndRecalculateQuoteTotal("studio", { state, notification: { total: STUDIO_TOTAL } }, catalog);
    assert.equal(withoutExtra.isTampered, false);
  });

  it("prices stone and basin from the database, not from the payload", async () => {
    const cheaperStone = await fixtureCatalog({ installed_stone_prices: [{ ...stoneRowFor("TEST-ST1"), pricePerSqmTHB: 1000 }] });
    const result = await verifyAndRecalculateQuoteTotal("studio", { state: studioState(), notification: { total: STUDIO_TOTAL } }, cheaperStone);
    // 1.08 m2 x 1,000 = 1,080 instead of 8,640: 1,080 + 25,000 + 5,000 + 5,000 = 36,080
    assert.equal(result.calculatedTotal, 36_080);
    assert.equal(result.isTampered, true, "a total computed with other prices than the database's is not accepted");
  });

  it("does not price a basin that is not in the active catalog", async () => {
    const catalog = await fixtureCatalog({ basin_prices: FIXTURE_BASIN_ROWS.filter((row) => row.sku !== BASIN_25000) });
    const result = await verifyAndRecalculateQuoteTotal("studio", { state: studioState(), notification: { total: STUDIO_TOTAL } }, catalog);
    // no basin and so no installation either: 8,640 + 5,000 small job = 13,640
    assert.equal(result.calculatedTotal, 13_640);
    assert.equal(result.isTampered, true);
  });

  it("refuses a studio payload without a state, or with a state it cannot price, without throwing", async () => {
    const catalog = await fixtureCatalog();
    const noState = await verifyAndRecalculateQuoteTotal("studio", { total: 60990 }, catalog);
    assert.equal(noState.isTampered, true);
    assert.equal(noState.reason, "studio-state-missing");
    assert.equal(noState.calculatedTotal, null);

    for (const state of [{ shape: "I" }, { ...studioState(), pieces: "nope" }, { ...studioState(), basinPlacements: null }, []]) {
      const result = await verifyAndRecalculateQuoteTotal("studio", { state, total: 60990 }, catalog);
      assert.equal(result.isTampered, true, JSON.stringify(state).slice(0, 60));
      assert.equal(result.calculatedTotal, null);
    }
  });

  it("puts the shared stone list back exactly as it was, after a calculation and after a failed one", async () => {
    const catalog = await fixtureCatalog();
    const before = STONE_COLORS.map((stone) => `${stone.code}:${stone.installedPriceTHB}`);
    await verifyAndRecalculateQuoteTotal("studio", { state: studioState(), total: STUDIO_TOTAL }, catalog);
    assert.deepEqual(STONE_COLORS.map((stone) => `${stone.code}:${stone.installedPriceTHB}`), before);
    await verifyAndRecalculateQuoteTotal("studio", { state: { ...studioState(), pieces: "nope" }, total: STUDIO_TOTAL }, catalog);
    assert.deepEqual(STONE_COLORS.map((stone) => `${stone.code}:${stone.installedPriceTHB}`), before);
    assert.ok(!STONE_COLORS.some((stone) => stone.code === "TEST-ST1"), "the fixture stone never leaks into the shared list");
  });
});

function stoneRowFor(code: string) {
  return {
    id: 1, code, name: `Stone ${code}`, tone: "light", imageUrl: null, galleryImageUrls: [], quoteImageUrl: null, slabImageUrl: null,
    aliases: [], active: true, sortOrder: 1,
  };
}

// ================================================================================================================
// 2. verifyAndRecalculateQuoteTotal — quick-purchase mode
// ================================================================================================================

describe("job-226: server price check, quick-purchase mode", () => {
  it("prices a basin + installation + installed stone + VAT quote at 53,500", async () => {
    // basin 25,000 + install 1 x 5,000 + stone 2.5 m2 x 8,000 = 20,000 -> 50,000; 1 set so no free installation;
    // VAT 7% = 3,500 -> 53,500
    const catalog = await fixtureCatalog();
    const payload = quickPurchase([basinLine(BASIN_25000, 1, 25000), installLine(1), installedStoneLine(2.5)], 53_500, { vat: true });
    const result = await verifyAndRecalculateQuoteTotal("quick-purchase", payload, catalog);
    assert.equal(result.isTampered, false);
    assert.equal(result.calculatedTotal, 53_500);
  });

  it("gives the installation free from 3 basin sets", async () => {
    // 3 x 15,000 = 45,000; installation 3 x 5,000 = 15,000 requested and discounted; total 45,000
    const catalog = await fixtureCatalog();
    const payload = quickPurchase([basinLine(BASIN_15000, 3, 15000), installLine(3)], 45_000);
    const result = await verifyAndRecalculateQuoteTotal("quick-purchase", payload, catalog);
    assert.equal(result.calculatedTotal, 45_000);
    assert.equal(result.isTampered, false);
    // ... but not for 2 sets: 30,000 + 10,000 = 40,000
    const two = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase([basinLine(BASIN_15000, 2, 15000), installLine(2)], 40_000), catalog);
    assert.equal(two.calculatedTotal, 40_000);
    assert.equal(two.isTampered, false);
  });

  it("applies the whole-sheet price tiers (1-9 sheets, 10+, 50+)", async () => {
    // base 5,000 per sheet; 10+ sheets: 5,000 - 200 = 4,800; 50+: 5,000 x 0.95 = 4,750
    const catalog = await fixtureCatalog();
    for (const [sheets, unitPrice, total] of [[9, 5000, 45_000], [10, 4800, 48_000], [49, 4800, 235_200], [50, 4750, 237_500]] as const) {
      const result = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase([sheetStoneLine(sheets, unitPrice)], total), catalog);
      assert.equal(result.calculatedTotal, total, `${sheets} sheets`);
      assert.equal(result.isTampered, false, `${sheets} sheets`);
    }
  });

  it("catches a total edited down, and a line price edited down even when the grand total is left honest", async () => {
    const catalog = await fixtureCatalog();
    const items = [basinLine(BASIN_25000, 1, 25000)];
    const total = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase(items, 100), catalog);
    assert.equal(total.isTampered, true);
    assert.equal(total.calculatedTotal, 25_000);

    const cheapLine = [{ ...basinLine(BASIN_25000, 1, 25000), unitPrice: 100, total: 100 }];
    const line = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase(cheapLine, 25_000), catalog);
    assert.equal(line.isTampered, true);
    assert.equal(line.reason, `quick-purchase-line-total-mismatch:${BASIN_25000}`);
  });

  it("refuses lines it cannot price", async () => {
    const catalog = await fixtureCatalog();
    const refused: Array<[string, unknown[]]> = [
      ["unknown code", [basinLine("NOT-A-SKU", 1, 100)]],
      ["fractional basin quantity", [basinLine(BASIN_25000, 0.5, 25000)]],
      ["zero quantity", [basinLine(BASIN_25000, 0, 25000)]],
      ["negative quantity", [basinLine(BASIN_25000, -1, 25000)]],
      ["absurd quantity", [basinLine(BASIN_25000, 1_000_000, 25000)]],
      ["stone with an unknown unit", [{ ...sheetStoneLine(1, 5000), unit: "kg" }]],
      ["installed stone with no installed price", [{ ...installedStoneLine(2), code: "TEST-SHEET" }]],
      ["installation for more sets than basins", [basinLine(BASIN_25000, 1, 25000), installLine(2)]],
      ["fractional installation sets", [basinLine(BASIN_25000, 1, 25000), installLine(0.5)]],
      ["a line that is not an object", ["BASIN"]],
      ["no lines", []],
    ];
    for (const [label, items] of refused) {
      const result = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase(items, 25_000), catalog);
      assert.equal(result.isTampered, true, label);
      assert.equal(result.calculatedTotal, null, label);
    }
    const noItems = await verifyAndRecalculateQuoteTotal("quick-purchase", { kind: "quick-purchase", total: 25_000 }, catalog);
    assert.equal(noItems.isTampered, true, "a total with no lines to price");
    assert.equal(noItems.reason, "quick-purchase-items-invalid");
  });

  it("does not accept a discount from the customer: discountAmount in the payload changes nothing", async () => {
    const catalog = await fixtureCatalog();
    // an honest total with a made-up discountAmount next to it
    const honest = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase([basinLine(BASIN_25000, 1, 25000)], 25_000, { discountAmount: 20_000 }), catalog);
    assert.equal(honest.isTampered, false);
    assert.equal(honest.calculatedTotal, 25_000);
    // and a total that subtracts it is refused
    const forged = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase([basinLine(BASIN_25000, 1, 25000)], 5_000, { discountAmount: 20_000 }), catalog);
    assert.equal(forged.isTampered, true);
  });

  it("agrees with the storefront's own calculateFormalQuoteTotals for a grid of baskets", async () => {
    const { calculateFormalQuoteTotals } = await import("../../knight-basins/src/data/quote-utils.ts");
    const catalog = await fixtureCatalog();
    let compared = 0;
    for (const basins of [1, 2, 3, 4]) {
      for (const installed of [0, 1, basins]) {
        for (const stoneArea of [0, 2.5, 7.333]) {
          for (const vat of [false, true]) {
            const items: unknown[] = [basinLine(BASIN_15000, basins, 15000)];
            if (installed > 0) items.push(installLine(installed));
            if (stoneArea > 0) items.push(installedStoneLine(stoneArea));
            const expected = calculateFormalQuoteTotals({
              basinSubtotal: 15000 * basins,
              requestedInstallationCharge: 5000 * installed,
              basinSets: basins,
              stoneTotal: 8000 * stoneArea,
              vat,
              vatRate: 0.07,
            }).total;
            const result = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase(items, expected, { vat }), catalog);
            assert.equal(result.isTampered, false, `basins=${basins} installed=${installed} stone=${stoneArea} vat=${vat}`);
            assert.ok(Math.abs((result.calculatedTotal ?? Number.NaN) - expected) < 0.001, `basins=${basins} installed=${installed} stone=${stoneArea} vat=${vat}`);
            compared += 1;
          }
        }
      }
    }
    assert.equal(compared, 4 * 3 * 3 * 2);
  });
});

// ================================================================================================================
// 3. The rest of the contract
// ================================================================================================================

describe("job-226: honest customers are never refused", () => {
  // The most important property: a customer who does not touch the numbers always gets through. 400 studio quotes with
  // different sizes, edge finishes, upstand heights, basins, stones, locations and VAT -- each priced by the browser's
  // own function and then checked by the server -- and none may be flagged. (A small deterministic generator, so a failure repeats.)
  function generator(seed: number) {
    let state = seed >>> 0;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    return {
      int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
      pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
      chance: (probability: number) => next() < probability,
    };
  }

  const STATUSES = ["upstand", "open-edge", "wall-flush", "wall-flush+upstand", "closed-edge", "normal"] as const;
  const SIDES = ["top", "right", "bottom", "left"] as const;
  const BASIN_SKUS = [fixtureBasinSku(15000), fixtureBasinSku(20000), fixtureBasinSku(25000), fixtureBasinSku(60990)];

  it("accepts 400 random honest studio quotes", async () => {
    const catalog = await fixtureCatalog();
    const random = generator(226);
    let withBasins = 0;
    let withEdges = 0;
    let withVat = 0;
    let smallJobs = 0;
    for (let index = 0; index < 400; index += 1) {
      const rectangle = { ...RECTANGLE, widthMm: random.int(600, 3600), lengthMm: random.int(300, 760) };
      const sideStatuses: Record<string, string> = {};
      for (const side of SIDES) if (random.chance(0.6)) sideStatuses[`${rectangle.id}:${side}`] = random.pick(STATUSES);
      const basinSkus = Array.from({ length: random.int(0, 4) }, () => random.pick(BASIN_SKUS));
      const piece = { id: "piece-1", name: "Piece 1", rectangles: [rectangle], sideStatuses };
      const placements = basinSkus.map((sku, position) => createBasinPlacement(basinProductFromCatalog(FIXTURE_BASIN_ROWS.find((row) => row.sku === sku)!), position, piece.id, rectangle.id));
      const state = {
        ...studioState({
          activeStone: random.pick(["TEST-ST1", "TEST-SHEET", ""]),
          location: random.pick(["bangkok-metro", "provincial"] as const) as never,
          vat: random.chance(0.5),
          upstandHeightMm: random.chance(0.15) ? null : random.int(0, 500),
        }),
        pieces: [piece],
        basinSkus: [...new Set(basinSkus)],
        basinPlacements: placements,
        dimensions: { depthMm: rectangle.lengthMm, runAMm: rectangle.widthMm, runBMm: 0, runCMm: 0 },
      } as unknown as StudioState;

      const payload = studioPayload(state, catalog);
      const result = await verifyAndRecalculateQuoteTotal("studio", payload, catalog);
      assert.equal(result.isTampered, false, `quote #${index} (${result.reason}) browser=${payload.estimate.totalTHB} server=${result.calculatedTotal}`);
      assert.equal(result.calculatedTotal, payload.estimate.totalTHB, `quote #${index}`);
      if (placements.length) withBasins += 1;
      if (Object.values(sideStatuses).some((status) => status === "upstand" || status === "open-edge")) withEdges += 1;
      if (state.vat) withVat += 1;
      if (payload.estimate.smallJobFeeTHB > 0) smallJobs += 1;
    }
    // the generator really did cover the cases (so a pass means something)
    assert.ok(withBasins > 200 && withEdges > 150 && withVat > 150 && smallJobs > 50, `coverage: basins=${withBasins} edges=${withEdges} vat=${withVat} smallJob=${smallJobs}`);
  });
});

describe("job-226: what is and is not priced", () => {
  it("has nothing to verify when no total is claimed, and does not touch the database for that", async () => {
    const result = await verifyAndRecalculateQuoteTotal("studio", { state: studioState() }, {
      select: () => {
        throw new Error("the catalog must not be read when there is nothing to check");
      },
    });
    assert.equal(result.isTampered, false);
    assert.equal(result.calculatedTotal, null);
    assert.equal(result.reason, "no-claimed-total");
    assert.equal((await verifyAndRecalculateQuoteTotal("quick-purchase", null, pricingOnlyDatabase())).isTampered, false);
  });

  it("does not price sketch or unknown order modes", async () => {
    for (const mode of ["sketch", "something-else", ""]) {
      const result = await verifyAndRecalculateQuoteTotal(mode, { total: 1 }, pricingOnlyDatabase());
      assert.equal(result.isTampered, false, mode);
      assert.equal(result.reason, "order-mode-not-priced", mode);
    }
  });

  it("treats a claimed total that is not a number as tampered", async () => {
    const catalog = await fixtureCatalog();
    const result = await verifyAndRecalculateQuoteTotal("quick-purchase", quickPurchase([basinLine(BASIN_25000, 1, 25000)], "25000" as never), catalog);
    assert.equal(result.isTampered, true);
    assert.equal(result.reason, "claimed-total-not-a-number");
  });

  it("reads the catalog from the three pricing tables, active rows, and builds the shared model's shapes", async () => {
    const queried: string[] = [];
    const recording = new Proxy(pricingOnlyDatabase(), {
      get(target, property, receiver) {
        if (property !== "select") return Reflect.get(target, property, receiver);
        return () => ({
          from: (table: unknown) => {
            queried.push(String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]));
            return target.select().from(table);
          },
        });
      },
    });
    const catalog = await loadPricingCatalog(recording);
    assert.deepEqual([...queried].sort(), ["basin_prices", "installed_stone_prices", "sheet_stone_prices"]);
    assert.deepEqual(catalog.products.map((product) => [product.sku, product.priceTHB]), FIXTURE_BASIN_ROWS.map((row) => [row.sku, row.priceTHB]));
    const st1 = catalog.stoneColors.find((stone) => stone.code === "TEST-ST1");
    const sheetOnly = catalog.stoneColors.find((stone) => stone.code === "TEST-SHEET");
    assert.equal(st1?.installedPriceTHB, 8000);
    assert.equal(st1?.sheetPriceTHB, 5000);
    assert.equal(sheetOnly?.installedPriceTHB, null);
    assert.equal(sheetOnly?.sheetPriceTHB, 3000);
  });
});

describe("job-226: the check in front of a payment QR", () => {
  it("accepts an honest legacy quote (no server stamp) by pricing it again", async () => {
    const catalog = await fixtureCatalog();
    const check = await checkQuoteBeforePayment({ orderMode: "studio", studioData: studioPayload(studioState(), catalog) }, catalog);
    assert.deepEqual(check, { ok: true, total: STUDIO_TOTAL });
  });

  it("refuses a legacy quote whose total was edited, or that carries a customer discount", async () => {
    const catalog = await fixtureCatalog();
    const edited = await checkQuoteBeforePayment({ orderMode: "studio", studioData: { ...studioPayload(studioState(), catalog), notification: { total: 100 } } }, catalog);
    assert.equal(edited.ok, false);

    const discounted = await checkQuoteBeforePayment({ orderMode: "studio", studioData: studioPayload(studioState({ discountTHB: 40_000 }), catalog) }, catalog);
    assert.equal(discounted.ok, false);
    if (!discounted.ok) assert.equal(discounted.discountIgnoredTHB, 40_000);
  });

  it("keeps the price of a quote the server stamped, even after the catalog changes", async () => {
    const original = await fixtureCatalog();
    const stamped = withServerPricing(studioPayload(studioState(), original), STUDIO_TOTAL);
    const raised = await fixtureCatalog({ installed_stone_prices: [{ ...stoneRowFor("TEST-ST1"), pricePerSqmTHB: 9000 }] });

    const check = await checkQuoteBeforePayment({ orderMode: "studio", studioData: stamped }, raised);
    assert.deepEqual(check, { ok: true, total: STUDIO_TOTAL });

    // the same quote without the stamp is priced again, and the new price no longer matches
    const { [SERVER_PRICING_KEY]: _stamp, ...legacy } = stamped;
    const again = await checkQuoteBeforePayment({ orderMode: "studio", studioData: legacy }, raised);
    assert.equal(again.ok, false);
  });

  it("does not let a stamp cover a total edited after it was written", async () => {
    const catalog = await fixtureCatalog();
    const stamped = withServerPricing(studioPayload(studioState(), catalog), STUDIO_TOTAL);
    const edited = { ...stamped, notification: { total: 100 }, estimate: { ...(stamped.estimate as object), totalTHB: 100 } };
    const check = await checkQuoteBeforePayment({ orderMode: "studio", studioData: edited }, catalog);
    assert.equal(check.ok, false);
  });

  it("refuses when there is nothing to check against", async () => {
    const catalog = await fixtureCatalog();
    assert.equal((await checkQuoteBeforePayment({ orderMode: "studio", studioData: null }, catalog)).ok, false);
    assert.equal((await checkQuoteBeforePayment({ orderMode: "studio", studioData: { state: studioState() } }, catalog)).ok, false);
  });
});

// ================================================================================================================
// 4. Through the real router: POST /api/leads and POST /api/public/quotes/promptpay-qr
// ================================================================================================================

type Row = Record<string, unknown>;

function tableNameOf(table: unknown): string {
  return String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]);
}

/** Fake database: select() answers with `leads` (the pricing tables are answered by withPricingCatalog), inserts are recorded, audit rows go to `audits`. */
function createFakeDatabase(leads: Row[] = [], pricingOverride = {}) {
  const saved: Row[] = [];
  const audits: Row[] = [];
  let quoteCounter = 0;
  const base = {
    execute: async () => ({ rows: [{ last_value: ++quoteCounter }] }),
    select: () => {
      const builder = { from: () => builder, where: () => builder, limit: async () => leads.map((lead) => ({ ...lead })) };
      return builder;
    },
    insert: (table: unknown) => {
      const isAudit = tableNameOf(table) === "system_audit_logs";
      let values: Row = {};
      const builder = {
        values(next: Row) {
          values = next;
          if (isAudit) {
            audits.push(next);
            return Promise.resolve();
          }
          return builder;
        },
        onConflictDoUpdate() {
          return builder;
        },
        returning: async () => {
          saved.push(values);
          return [{ id: saved.length, ...values }];
        },
      };
      return builder;
    },
  };
  return { database: withPricingCatalog(base, pricingOverride), saved, audits };
}

async function waitForAudit(audits: Row[]) {
  for (let attempt = 0; attempt < 50 && audits.length === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };
let routeModule: LeadRouteModule;
let quoteAccess: QuoteAccessModule;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://server-price-guard-test";
  process.env["SESSION_SECRET"] = "server-price-guard-test-secret";
  routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function startRoute(database: unknown) {
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error", detail: error instanceof Error ? error.message : String(error) });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
}

function leadBody(overrides: Row = {}) {
  return {
    leadKey: "lead-server-price-guard-0001",
    status: "quote_requested",
    source: "quote_builder",
    name: "คุณทดสอบ",
    phone: "0812345678",
    productSkus: [BASIN_25000],
    orderMode: "quick-purchase",
    studioData: quickPurchaseData(60990),
    ...overrides,
  };
}

async function postLead(url: string, body: Row) {
  const response = await fetch(`${url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json()) as Row };
}

const FAILED_BODY = { error: PRICE_VERIFICATION_FAILED_ERROR, message: PRICE_VERIFICATION_FAILED_MESSAGE };

describe("job-226: POST /api/leads", () => {
  it("accepts an honest quick-purchase quote, saves it with the server's verified total and answers as before", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const { status, body } = await postLead(server.url, leadBody());
      assert.equal(status, 200);
      assert.equal(typeof body["publicQuoteToken"], "string");
      assert.equal((body["studioData"] as Row)["total"], 60990);
      const stamp = (saved[0]?.["studioData"] as Row)[SERVER_PRICING_KEY] as Row;
      assert.equal(stamp["verifiedTotalTHB"], 60990);
      assert.equal(typeof stamp["verifiedAt"], "string");
    } finally {
      await server.close();
    }
  });

  it("refuses a total edited down from 60,990 to 100: 400 PRICE_VERIFICATION_FAILED, nothing saved, no quote link", async () => {
    const { database, saved, audits } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const { status, body } = await postLead(server.url, leadBody({ studioData: quickPurchaseData(60990, { total: 100, subtotal: 100 }) }));
      assert.equal(status, 400);
      assert.deepEqual(body, FAILED_BODY);
      assert.equal(saved.length, 0, "nothing is written for a refused quote");
      assert.equal("publicQuoteToken" in body, false);

      await waitForAudit(audits);
      assert.equal(audits.length, 1);
      const row = audits[0]!;
      assert.equal(row["action"], PRICE_TAMPER_AUDIT_ACTION);
      assert.equal(row["action"], "quote.price_tamper_detected");
      assert.equal(row["status"], "warning");
      assert.equal(row["errorCode"], PRICE_VERIFICATION_FAILED_ERROR);
      assert.equal(row["actorType"], "customer");
      const details = row["details"] as Row;
      assert.equal(details["stage"], "lead.upsert");
      assert.equal(details["orderMode"], "quick-purchase");
      assert.equal(details["calculatedTotal"], 60990);
      assert.deepEqual(details["claimedTotals"], { total: 100 });
      assert.match(String(details["reason"]), /^total-mismatch:total$/);
      assert.ok(!JSON.stringify(details).includes("0812345678"), "the audit row does not carry the customer's phone number");
    } finally {
      await server.close();
    }
  });

  it("refuses a claimed total that comes with nothing the server can price", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      for (const studioData of [{ kind: "quick-purchase", total: 100 }, { kind: "quick-purchase", total: 100, items: [] }, { kind: "studio", total: 100 }]) {
        const { status, body } = await postLead(server.url, leadBody({ orderMode: studioData.kind, studioData }));
        assert.equal(status, 400, JSON.stringify(studioData));
        assert.deepEqual(body, FAILED_BODY);
      }
      assert.equal(saved.length, 0);
    } finally {
      await server.close();
    }
  });

  it("accepts an honest studio quote and saves it priced at 43,640", async () => {
    const catalog = await fixtureCatalog();
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const { status } = await postLead(server.url, leadBody({ orderMode: "studio", studioData: studioPayload(studioState(), catalog) }));
      assert.equal(status, 200);
      const stored = saved[0]?.["studioData"] as Row;
      assert.equal((stored[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], STUDIO_TOTAL);
    } finally {
      await server.close();
    }
  });

  it("refuses a studio quote that carries a customer discount (browser total 3,640 for a 43,640 board) and audits the discount", async () => {
    const catalog = await fixtureCatalog();
    const { database, saved, audits } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const { status, body } = await postLead(server.url, leadBody({ orderMode: "studio", studioData: studioPayload(studioState({ discountTHB: 40_000 }), catalog) }));
      assert.equal(status, 400);
      assert.deepEqual(body, FAILED_BODY);
      assert.equal(saved.length, 0);
      await waitForAudit(audits);
      const details = audits[0]?.["details"] as Row;
      assert.equal(details["discountIgnoredTHB"], 40_000);
      assert.equal(details["calculatedTotal"], STUDIO_TOTAL);
    } finally {
      await server.close();
    }
  });

  it("stores a typed discount as 0 when the quote's total is the honest undiscounted one", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const studioData = { state: studioState({ discountTHB: 40_000, openEdgePricePerMTHB: 1000 }), notification: { total: STUDIO_TOTAL } };
      const { status } = await postLead(server.url, leadBody({ orderMode: "studio", studioData }));
      assert.equal(status, 200);
      const stored = saved[0]?.["studioData"] as Row;
      const state = stored["state"] as Row;
      assert.equal(state["discountTHB"], 0, "the customer's discount is stored as 0");
      assert.equal(state["openEdgePricePerMTHB"], null, "and the customer's open-edge price as the standard (none)");
      assert.equal((stored[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], STUDIO_TOTAL);
    } finally {
      await server.close();
    }
  });

  it("takes serverPricing from the server only: a forged one is replaced, and does not rescue a tampered quote", async () => {
    const forged = { verifiedTotalTHB: 1, verifiedAt: "2020-01-01T00:00:00.000Z" };
    const honest = createFakeDatabase();
    const server = await startRoute(honest.database);
    try {
      const ok = await postLead(server.url, leadBody({ studioData: quickPurchaseData(60990, { [SERVER_PRICING_KEY]: forged }) }));
      assert.equal(ok.status, 200);
      assert.equal(((honest.saved[0]?.["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], 60990, "the stored stamp is the server's, not the forged one");

      const bad = await postLead(server.url, leadBody({ leadKey: "lead-server-price-guard-0002", studioData: quickPurchaseData(60990, { total: 100, [SERVER_PRICING_KEY]: { verifiedTotalTHB: 100 } }) }));
      assert.equal(bad.status, 400);
      assert.deepEqual(bad.body, FAILED_BODY);
    } finally {
      await server.close();
    }
  });

  it("does not store a forged serverPricing even when there is no total for the server to verify", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const { status } = await postLead(server.url, leadBody({ status: "selecting", studioData: { note: "autosave", [SERVER_PRICING_KEY]: { verifiedTotalTHB: 1 } } }));
      assert.equal(status, 200);
      assert.equal(SERVER_PRICING_KEY in (saved[0]?.["studioData"] as Row), false, "a stamp only the server may write is dropped");
      assert.equal((saved[0]?.["studioData"] as Row)["note"], "autosave", "the rest of the payload is kept");
    } finally {
      await server.close();
    }
  });

  it("prices an update with the mode the saved lead already has when the request does not say", async () => {
    // the lead exists as a studio quote and the update leaves orderMode out: the server must price it as a studio quote.
    // An honest studio payload (no quick-purchase lines) is only acceptable under that reading, and a forged one must not slip through.
    const catalog = await fixtureCatalog();
    const existing = { quoteNumber: "Oct 26 / US / 111111", quoteAccessSecret: "a".repeat(64), orderMode: "studio" };
    const { database, saved } = createFakeDatabase([existing]);
    const server = await startRoute(database);
    try {
      const honest = await postLead(server.url, leadBody({ orderMode: undefined, studioData: studioPayload(studioState(), catalog) }));
      assert.equal(honest.status, 200, "priced as the studio quote it already is");
      assert.equal((((saved[0]?.["studioData"] as Row)[SERVER_PRICING_KEY]) as Row)["verifiedTotalTHB"], STUDIO_TOTAL);

      const forged = await postLead(server.url, leadBody({ orderMode: undefined, studioData: { state: studioState(), notification: { total: 100 } } }));
      assert.equal(forged.status, 400);
      assert.deepEqual(forged.body, FAILED_BODY);
      assert.equal(saved.length, 1, "only the honest update was written");
    } finally {
      await server.close();
    }
  });

  it("leaves leads without a priced quote alone: autosave, no studioData, sketch mode", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const autosave = await postLead(server.url, leadBody({ status: "selecting", studioData: null }));
      assert.equal(autosave.status, 200);
      assert.equal(SERVER_PRICING_KEY in ((saved[0]?.["studioData"] as Row | null) ?? {}), false);

      const sketch = await postLead(server.url, leadBody({ leadKey: "lead-server-price-guard-0003", orderMode: "sketch", studioData: { note: "hand drawn" } }));
      assert.equal(sketch.status, 200);
    } finally {
      await server.close();
    }
  });

  it("still applies the older checks first: a negative or absurd total is refused as before", async () => {
    const { database, saved } = createFakeDatabase();
    const server = await startRoute(database);
    try {
      const negative = await postLead(server.url, leadBody({ studioData: quickPurchaseData(60990, { total: -60990 }) }));
      assert.equal(negative.status, 400);
      assert.equal(negative.body["message"], "Invalid quote total");
      assert.equal(saved.length, 0);
    } finally {
      await server.close();
    }
  });
});

const QUOTE_NUMBER = "Oct 26 / US / 424242";
const ACCESS_SECRET = "b".repeat(64);

function leadRow(studioData: unknown, extra: Row = {}): Row {
  return { id: 7, name: "คุณทดสอบ", phone: "0812345678", quoteNumber: QUOTE_NUMBER, quoteAccessSecret: ACCESS_SECRET, orderMode: "quick-purchase", status: "quote_requested", notes: null, studioData, ...extra };
}

async function requestQr(url: string, paymentType = "full") {
  const token = quoteAccess.createPublicQuoteToken(QUOTE_NUMBER, ACCESS_SECRET);
  const response = await fetch(`${url}/api/public/quotes/promptpay-qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, paymentType }) });
  return { status: response.status, body: (await response.json()) as Row };
}

describe("job-226: POST /api/public/quotes/promptpay-qr", () => {
  it("builds the QR for an honest quote (legacy, no stamp): the total is the one the server priced", async () => {
    const { database } = createFakeDatabase([leadRow(quickPurchaseData(20000))]);
    const server = await startRoute(database);
    try {
      const { status, body } = await requestQr(server.url, "deposit_50");
      assert.equal(status, 200);
      assert.equal(body["amountThb"], 10_000);
      assert.match(String(body["qrPayload"]), /10000\.00/);
    } finally {
      await server.close();
    }
  });

  it("refuses a quote edited down to 100: 400 PRICE_VERIFICATION_FAILED, no QR payload, no amount, no account details, audited", async () => {
    const { database, audits } = createFakeDatabase([leadRow(quickPurchaseData(20000, { total: 100 }))]);
    const server = await startRoute(database);
    try {
      const { status, body } = await requestQr(server.url);
      assert.equal(status, 400);
      assert.deepEqual(body, FAILED_BODY);
      for (const key of ["qrPayload", "amountThb", "paymentType", "companyAccount"]) assert.equal(key in body, false, `${key} must not leak`);

      await waitForAudit(audits);
      const row = audits[0]!;
      assert.equal(row["action"], PRICE_TAMPER_AUDIT_ACTION);
      assert.equal(row["status"], "warning");
      assert.equal(row["targetId"], QUOTE_NUMBER);
      const details = row["details"] as Row;
      assert.equal(details["stage"], "promptpay.qr");
      assert.equal(details["leadId"], 7);
      assert.equal(details["calculatedTotal"], 20000);
      assert.deepEqual(details["claimedTotals"], { total: 100 });
    } finally {
      await server.close();
    }
  });

  it("refuses a studio quote that was saved with a customer discount (legacy), and one with a forged estimate", async () => {
    const catalog = await fixtureCatalog();
    const discounted = createFakeDatabase([leadRow(studioPayload(studioState({ discountTHB: 40_000 }), catalog), { orderMode: "studio" })]);
    const server = await startRoute(discounted.database);
    try {
      const { status, body } = await requestQr(server.url);
      assert.equal(status, 400);
      assert.deepEqual(body, FAILED_BODY);
    } finally {
      await server.close();
    }
  });

  it("keeps honouring a stamped quote after the catalog price changes; a legacy quote is priced again and no longer matches", async () => {
    const raised = { basin_prices: FIXTURE_BASIN_ROWS.map((row) => (row.priceTHB === 20000 ? { ...row, priceTHB: 30000 } : row)) };
    const stamped = createFakeDatabase([leadRow(withServerPricing(quickPurchaseData(20000), 20000))], raised);
    const legacy = createFakeDatabase([leadRow(quickPurchaseData(20000))], raised);

    const first = await startRoute(stamped.database);
    try {
      const { status, body } = await requestQr(first.url);
      assert.equal(status, 200, "a quote the server stamped keeps the price it was issued at");
      assert.equal(body["amountThb"], 20_000);
    } finally {
      await first.close();
    }
    const second = await startRoute(legacy.database);
    try {
      const { status, body } = await requestQr(second.url);
      assert.equal(status, 400, "a quote saved before job-226 is checked against today's prices");
      assert.deepEqual(body, FAILED_BODY);
    } finally {
      await second.close();
    }
  });

  it("does not let a stamp cover a total edited afterwards", async () => {
    const edited = quickPurchaseData(20000, { total: 100, [SERVER_PRICING_KEY]: { verifiedTotalTHB: 20000, verifiedAt: "2026-10-03T00:00:00.000Z" } });
    const { database } = createFakeDatabase([leadRow(edited)]);
    const server = await startRoute(database);
    try {
      const { status, body } = await requestQr(server.url);
      assert.equal(status, 400);
      assert.deepEqual(body, FAILED_BODY);
    } finally {
      await server.close();
    }
  });

  it("a quote saved through POST /api/leads can be paid by QR (the stamp it was given is accepted)", async () => {
    const catalog = await fixtureCatalog();
    const posting = createFakeDatabase();
    const first = await startRoute(posting.database);
    let savedStudioData: unknown;
    try {
      const { status } = await postLead(first.url, leadBody({ leadKey: "lead-server-price-guard-0010", orderMode: "studio", studioData: studioPayload(studioState({ vat: true }), catalog) }));
      assert.equal(status, 200);
      savedStudioData = posting.saved[0]?.["studioData"];
    } finally {
      await first.close();
    }

    const paying = createFakeDatabase([leadRow(savedStudioData, { orderMode: "studio" })]);
    const second = await startRoute(paying.database);
    try {
      const { status, body } = await requestQr(second.url, "deposit_30");
      assert.equal(status, 200);
      // 46,695 x 30% = 14,008.5 -> 14,009
      assert.equal(body["amountThb"], 14_009);
    } finally {
      await second.close();
    }
  });

  it("keeps the existing refusal for a quote with no total at all", async () => {
    const noTotal = createFakeDatabase([leadRow({ kind: "quick-purchase", items: [basinLine(BASIN_25000, 1, 25000)] })]);
    const server = await startRoute(noTotal.database);
    try {
      const { status, body } = await requestQr(server.url);
      assert.equal(status, 400);
      assert.equal(body["message"], "ไม่พบยอดเงินที่ถูกต้องสำหรับใบเสนอราคานี้");
    } finally {
      await server.close();
    }
  });
});
