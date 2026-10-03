/**
 * Studio UX, job-210: sizes kept across shape changes, the 7-step basin position picker, a clicked stone
 * becoming the active stone, deeper-than-wide basins starting turned 90 degrees, the saved quote drawing
 * the turned footprint, the live stone list on every colour lookup, and the DXF carrying turned basins.
 *
 * The decision logic lives in pure functions (studio-model.ts) and is run for real below. The React parts
 * (StudioPage.tsx / App.tsx) cannot be rendered in node:test, so the handlers that matter are cut out of
 * the real source and executed (toggleStone, the draft builder, placementAtCoordinates, the placement
 * factory), and the markup is checked as source text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { describe, it } from "node:test";

import { PRODUCTS } from "../src/data/catalog.ts";
import { createStudioDxf, createStudioExportModel } from "../src/data/studio-export.ts";
import {
  applyCustomShapeToState,
  applyStudioSizePreset,
  basinDimensionsForProduct,
  basinPlacementOverlapWarnings,
  basinPlacementsViolatingEdgeClearance,
  basinPositionRangeX,
  basinXForPositionLevel,
  buildCustomShapePiece,
  calculateBasinCoordinates,
  calculateBasinOffsets,
  carryCustomShapeDimensions,
  clampPlacementToSheet,
  createBasinPlacement,
  fitPlacementOrientationToSheet,
  isBasinPositionLevel,
  placementCutSize,
  placementMeetsBasinEdgeClearance,
  positionPlacementAtLevel,
  reanchorPlacementsToPiece,
  rotatePlacement,
  STUDIO_BASIN_POSITION_LEVELS,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type BasinPositionLevel,
  type StudioPiece,
  type StudioPreset,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const studioPage = read("../src/components/StudioPage.tsx");
const appSource = read("../src/App.tsx");

const MARGIN = STUDIO_BASIN_SAFETY_MARGIN_MM;
const EDGES = { top: "normal", right: "normal", bottom: "normal", left: "normal" } as const;
const panels = (...sizes: Array<[widthMm: number, depthMm: number]>) =>
  sizes.map(([widthMm, depthMm]) => ({ widthMm, depthMm, edges: { ...EDGES } }));
const counter = (preset: StudioPreset, ...sizes: Array<[number, number]>): StudioPiece => ({
  ...buildCustomShapePiece("piece-1", preset, panels(...sizes)),
  name: "ชิ้นงาน 1",
});
const sheetOf = (widthMm: number, lengthMm: number, xMm = 0, yMm = 0): StudioRectangle => ({ id: "sheet-1", widthMm, lengthMm, xMm, yMm, rotation: 0 });

// KF003: cut-out stored as 350 wide x 500 deep. Rotation 90 makes the footprint 500 x 350.
const KF003 = { widthMm: 350, depthMm: 500 } as const;
const basin = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF003",
  pieceId: "piece-1",
  sheetId: "piece-1-1",
  xMm: 725,
  yMm: 125,
  ...KF003,
  rotation: 90,
  orientation: "vertical",
  ...overrides,
});

const stateOf = (piece: StudioPiece, basinPlacements: BasinPlacement[], overrides: Partial<StudioState> = {}): StudioState => ({
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  pieces: [piece],
  activePieceId: piece.id,
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 0,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010"],
  activeStone: "BW010",
  basinSkus: ["KF003"],
  basinPlacements,
  ...overrides,
});

const levelX = (sheet: StudioRectangle, placement: BasinPlacement, level: BasinPositionLevel) => basinXForPositionLevel(sheet, placement, level, MARGIN);

describe("7-step snap grid: basinPositionRangeX / basinXForPositionLevel", () => {
  it("offers exactly the levels 1..7", () => {
    assert.deepEqual([...STUDIO_BASIN_POSITION_LEVELS], [1, 2, 3, 4, 5, 6, 7]);
    for (const level of [1, 2, 3, 4, 5, 6, 7]) assert.equal(isBasinPositionLevel(level), true);
    for (const value of [0, 8, 4.5, "4", null, undefined, NaN]) assert.equal(isBasinPositionLevel(value), false);
  });

  it("level 1 is flush left at exactly 100 mm, level 7 flush right at exactly 100 mm, level 4 the middle", () => {
    const sheet = sheetOf(1800, 600);
    const placement = basin({ rotation: 0, orientation: "horizontal", widthMm: 400, depthMm: 300 });
    assert.equal(MARGIN, 100);
    assert.equal(levelX(sheet, placement, 1), 100);
    assert.equal(levelX(sheet, placement, 7), 1800 - 400 - 100);
    assert.equal(levelX(sheet, placement, 4), (1800 - 400) / 2);
    // 1800 - 400 - 2 * 100 = 1200 mm of travel, six equal steps of 200 mm
    assert.deepEqual(STUDIO_BASIN_POSITION_LEVELS.map((level) => levelX(sheet, placement, level)), [100, 300, 500, 700, 900, 1100, 1300]);
  });

  it("the levels are 0%, 16.7%, 33.3%, 50%, 66.7%, 83.3% and 100% of the safe span", () => {
    const sheet = sheetOf(2400, 600);
    const placement = basin({ rotation: 0, orientation: "horizontal", widthMm: 600, depthMm: 300 });
    const range = basinPositionRangeX(sheet, placement, MARGIN)!;
    assert.deepEqual(range, { minXMm: 100, maxXMm: 1700 });
    const fractions = STUDIO_BASIN_POSITION_LEVELS.map((level) => (levelX(sheet, placement, level)! - range.minXMm) / (range.maxXMm - range.minXMm));
    [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].forEach((expected, index) => assert.ok(Math.abs(fractions[index]! - expected) < 0.002, `level ${index + 1}: ${fractions[index]}`));
  });

  it("measures the span with the basin's rotated width (placementCutSize), not the stored one", () => {
    const sheet = sheetOf(1800, 600);
    const rotated = basin(); // 350 x 500 stored, rotation 90 => 500 wide on the plan
    const upright = basin({ rotation: 0, orientation: "horizontal" }); // 350 wide on the plan
    assert.equal(levelX(sheet, rotated, 7), 1800 - 500 - MARGIN);
    assert.equal(levelX(sheet, upright, 7), 1800 - 350 - MARGIN);
    assert.deepEqual(basinPositionRangeX(sheet, rotated, MARGIN), { minXMm: 100, maxXMm: 1200 });
  });

  it("follows a sheet that does not start at x = 0 (a leg of an L)", () => {
    const leg = sheetOf(1000, 600, 800, 600);
    const placement = basin({ rotation: 0, orientation: "horizontal", widthMm: 300, depthMm: 200 });
    assert.equal(levelX(leg, placement, 1), 800 + MARGIN);
    assert.equal(levelX(leg, placement, 7), 800 + 1000 - 300 - MARGIN);
  });

  it("never lets any level break the 100 mm clearance on the left or right, for every real catalog basin on sheets from 700 to 3000 mm", () => {
    let checked = 0;
    for (const product of PRODUCTS) {
      const size = basinDimensionsForProduct(product);
      if (size.widthMm === null || size.depthMm === null) continue;
      for (const rotation of [0, 90] as const) {
        for (const widthMm of [700, 900, 1200, 1800, 2400, 3000]) {
          const sheet = sheetOf(widthMm, 1200);
          const placement = basin({ sku: product.sku, ...size, rotation, orientation: rotation === 90 ? "vertical" : "horizontal" });
          const cut = placementCutSize(placement);
          if (!basinPositionRangeX(sheet, placement, MARGIN)) continue;
          for (const level of STUDIO_BASIN_POSITION_LEVELS) {
            const x = levelX(sheet, placement, level)!;
            assert.ok(x >= MARGIN - 0.01, `${product.sku} r${rotation} on ${widthMm}: level ${level} is ${x} mm from the left`);
            assert.ok(widthMm - (x + cut.widthMm!) >= MARGIN - 0.01, `${product.sku} r${rotation} on ${widthMm}: level ${level} is ${widthMm - (x + cut.widthMm!)} mm from the right`);
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked > 500, `only ${checked} combinations checked`);
  });

  it("centres the basin on a sheet too narrow for the clearance, and has nothing to say for an unknown size", () => {
    const narrow = sheetOf(600, 600);
    const wide = basin({ rotation: 0, orientation: "horizontal", widthMm: 450, depthMm: 300 });
    assert.equal(basinPositionRangeX(narrow, wide, MARGIN), null);
    for (const level of STUDIO_BASIN_POSITION_LEVELS) assert.equal(levelX(narrow, wide, level), 75);
    const unknown = basin({ widthMm: null, depthMm: null });
    assert.equal(basinPositionRangeX(sheetOf(1800, 600), unknown, MARGIN), null);
    assert.equal(levelX(sheetOf(1800, 600), unknown, 4), null);
  });
});

describe("positionPlacementAtLevel", () => {
  const piece = counter("i", [1800, 600]);

  it("moves x to the level, remembers it, and keeps offsets that reproduce the coordinates (every anchor)", () => {
    for (const anchor of ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const) {
      const placed = positionPlacementAtLevel(basin({ anchor, offsetXMm: 0, offsetYMm: 0 }), piece, 7);
      assert.equal(placed.positionLevel, 7);
      assert.equal(placed.xMm, 1800 - 500 - MARGIN, anchor);
      const coordinates = calculateBasinCoordinates(piece.rectangles[0]!, placed);
      assert.equal(Math.round(coordinates.xMm), placed.xMm, `${anchor}: offsets no longer reproduce x`);
      assert.equal(Math.round(coordinates.yMm), placed.yMm, `${anchor}: offsets no longer reproduce y`);
    }
  });

  it("every level lands exactly where basinXForPositionLevel says, and never with less than 100 mm to an edge", () => {
    for (const level of STUDIO_BASIN_POSITION_LEVELS) {
      const placed = positionPlacementAtLevel(basin(), piece, level);
      assert.equal(placed.xMm, levelX(piece.rectangles[0]!, basin(), level));
      assert.equal(placed.positionLevel, level);
      assert.equal(placementMeetsBasinEdgeClearance(placed, piece.rectangles[0]!, MARGIN), true, `level ${level}`);
    }
  });

  it("leaves y alone when it is already inside the clearance and pulls it just inside when it is not", () => {
    assert.equal(positionPlacementAtLevel(basin({ yMm: 140 }), piece, 3).yMm, 140);
    assert.equal(positionPlacementAtLevel(basin({ yMm: 10 }), piece, 3).yMm, MARGIN);
    assert.equal(positionPlacementAtLevel(basin({ yMm: 590 }), piece, 3).yMm, 600 - 350 - MARGIN);
  });

  it("does not touch a basin of unknown size beyond remembering the level", () => {
    const unknown = positionPlacementAtLevel(basin({ widthMm: null, depthMm: null, xMm: 321 }), piece, 6);
    assert.equal(unknown.xMm, 321);
    assert.equal(unknown.positionLevel, 6);
  });

  it("keeps the placement's width, depth, rotation, orientation, sku and id", () => {
    const placed = positionPlacementAtLevel(basin(), piece, 2);
    assert.deepEqual([placed.widthMm, placed.depthMm, placed.rotation, placed.orientation, placed.sku, placed.id], [350, 500, 90, "vertical", "KF003", "basin-1"]);
  });
});

describe("a basin remembers its level through a shape change (I <-> L <-> U)", () => {
  const before = counter("i", [1800, 600]);
  const placedAt = (level: BasinPositionLevel, overrides: Partial<BasinPlacement> = {}) => positionPlacementAtLevel(basin(overrides), before, level);

  it("level 7 on a longer main sheet is recomputed to 100 mm from the new right edge, on the same sheet", () => {
    const start = placedAt(7);
    assert.equal(start.xMm, 1200);
    const result = applyCustomShapeToState(stateOf(before, [start]), "piece-1", "l-left", panels([2400, 600], [600, 1200]));
    const moved = result.state.basinPlacements[0]!;
    assert.equal(moved.sheetId, "piece-1-1");
    assert.equal(moved.xMm, 2400 - 500 - MARGIN);
    assert.equal(moved.positionLevel, 7);
    assert.equal(moved.rotation, 90, "the turned basin stays turned");
    assert.deepEqual([moved.widthMm, moved.depthMm], [350, 500]);
    assert.deepEqual(result.notices.map((notice) => notice.kind), ["moved"]);
    assert.deepEqual(basinPlacementsViolatingEdgeClearance(result.state), []);
  });

  it("level 1 stays 100 mm from the left edge and level 4 stays in the middle when the sheet shrinks (I -> U)", () => {
    const one = applyCustomShapeToState(stateOf(before, [placedAt(1)]), "piece-1", "u", panels([1500, 600], [600, 1200], [600, 1200])).state.basinPlacements[0]!;
    assert.equal(one.xMm, MARGIN);
    const four = applyCustomShapeToState(stateOf(before, [placedAt(4)]), "piece-1", "u", panels([1500, 600], [600, 1200], [600, 1200])).state.basinPlacements[0]!;
    assert.equal(four.xMm, (1500 - 500) / 2);
    assert.equal(four.positionLevel, 4);
  });

  it("goes back to the same level after I -> L -> I (round trip)", () => {
    const start = placedAt(6);
    const toL = applyCustomShapeToState(stateOf(before, [start]), "piece-1", "l-right", panels([2100, 600], [600, 1200])).state;
    const backToI = applyCustomShapeToState(toL, "piece-1", "i", panels([1800, 600])).state.basinPlacements[0]!;
    assert.equal(backToI.positionLevel, 6);
    assert.equal(backToI.xMm, start.xMm);
  });

  it("recomputes the level even when the old position would still have been valid (a wider sheet moves level 4)", () => {
    const start = placedAt(4);
    const widened = applyCustomShapeToState(stateOf(before, [start]), "piece-1", "i", panels([3000, 600])).state.basinPlacements[0]!;
    assert.equal(widened.xMm, (3000 - 500) / 2);
    assert.notEqual(widened.xMm, start.xMm);
  });

  it("a basin that was not snapped keeps the job-209 behaviour (valid position left alone) and gains no level", () => {
    const loose = basin({ xMm: 300 });
    const result = applyCustomShapeToState(stateOf(before, [loose]), "piece-1", "l-left", panels([2400, 600], [600, 1200]));
    assert.equal(result.state.basinPlacements[0]!.xMm, 300);
    assert.equal("positionLevel" in result.state.basinPlacements[0]!, false);
    assert.deepEqual(result.notices, []);
  });

  it("two snapped basins that end up touching are spread apart and no longer claim their level", () => {
    const first = placedAt(2, { id: "a" });
    const second = placedAt(3, { id: "b" });
    const result = applyCustomShapeToState(stateOf(before, [first, second]), "piece-1", "l-left", panels([1800, 600], [600, 1200]));
    for (const placement of result.state.basinPlacements) assert.equal("positionLevel" in placement, false, `${placement.id} kept a level it no longer sits at`);
    assert.deepEqual(basinPlacementOverlapWarnings(result.state), []);
  });

  it("reanchorPlacementsToPiece itself reapplies the level on the sheet that hosts the basin", () => {
    const after = counter("l-left", [2400, 600], [600, 1200]);
    const result = reanchorPlacementsToPiece([placedAt(5)], before, after);
    assert.equal(result.placements[0]!.xMm, levelX(after.rectangles[0]!, basin(), 5));
    assert.equal(result.placements[0]!.positionLevel, 5);
  });

  it("resizing the main sheet with a size preset keeps the level too (and re-centres a basin without one)", () => {
    const state = stateOf(before, [placedAt(7, { id: "snapped" }), basin({ id: "loose", xMm: 100, yMm: 125 })]);
    const resized = applyStudioSizePreset(state, 2400, 600);
    const snapped = resized.basinPlacements.find((placement) => placement.id === "snapped")!;
    const loose = resized.basinPlacements.find((placement) => placement.id === "loose")!;
    assert.equal(snapped.xMm, 2400 - 500 - MARGIN);
    assert.equal(snapped.positionLevel, 7);
    assert.equal(loose.xMm, (2400 - 500) / 2);
    assert.equal("positionLevel" in loose, false);
  });
});

describe("auto-rotate a basin deeper than wide so it keeps the 100 mm margin (fitPlacementOrientationToSheet)", () => {
  const kf003 = PRODUCTS.find((product) => product.sku === "KF003")!;
  const kf003Cut = basinDimensionsForProduct(kf003);

  it("the catalog really lists KF003 as 350 x 500", () => {
    assert.deepEqual(kf003Cut, { widthMm: 350, depthMm: 500 });
  });

  it("turns KF003 90 degrees on a 600 mm deep sheet: stored size untouched, footprint 500 x 350, margin met", () => {
    const sheet = sheetOf(1800, 600);
    const upright = { ...basin(), rotation: 0 as const, orientation: "horizontal" as const };
    assert.equal(placementMeetsBasinEdgeClearance({ ...upright, xMm: 725, yMm: 50 }, sheet, MARGIN), false, "unturned it cannot meet the margin on 600 mm");
    const fitted = fitPlacementOrientationToSheet(upright, sheet, MARGIN);
    assert.equal(fitted.rotation, 90);
    assert.equal(fitted.orientation, "vertical");
    assert.deepEqual([fitted.widthMm, fitted.depthMm], [350, 500], "width/depth must not be swapped (placementCutSize does that)");
    assert.deepEqual(placementCutSize(fitted), { widthMm: 500, heightMm: 350 });
    const centred = positionPlacementAtLevel({ ...fitted, xMm: 0, yMm: 125 }, counter("i", [1800, 600]), 4);
    assert.equal(placementMeetsBasinEdgeClearance(centred, sheet, MARGIN), true);
    assert.equal(centred.yMm, 125, "125 mm of stone at the back and at the front when centred on depth");
    const pulledIn = positionPlacementAtLevel({ ...fitted, xMm: 0, yMm: 0 }, counter("i", [1800, 600]), 4);
    assert.equal(placementMeetsBasinEdgeClearance(pulledIn, sheet, MARGIN), true, "a basin dropped at the very back is pulled inside the margin by the picker");
  });

  it("leaves it alone where it already fits unturned, or where turning does not help", () => {
    const upright = { ...basin(), rotation: 0 as const, orientation: "horizontal" as const };
    assert.equal(fitPlacementOrientationToSheet(upright, sheetOf(1800, 700), MARGIN), upright, "700 mm deep: 500 + 2 x 100 fits as it is");
    assert.equal(fitPlacementOrientationToSheet(upright, sheetOf(1800, 900), MARGIN), upright);
    assert.equal(fitPlacementOrientationToSheet(upright, sheetOf(1800, 400), MARGIN), upright, "400 mm deep: 350 + 200 does not fit either way");
    const tooBig = { ...upright, widthMm: 700, depthMm: 800 };
    assert.equal(fitPlacementOrientationToSheet(tooBig, sheetOf(1800, 600), MARGIN), tooBig);
  });

  it("only ever turns a basin that is deeper than it is wide", () => {
    const sheet = sheetOf(1800, 300);
    for (const [widthMm, depthMm] of [[350, 150], [350, 350]] as const) {
      const placement = { ...basin(), widthMm, depthMm, rotation: 0 as const, orientation: "horizontal" as const };
      assert.equal(fitPlacementOrientationToSheet(placement, sheet, MARGIN), placement, `${widthMm} x ${depthMm}`);
    }
    // A basin wider than deep that does not fit a narrow sheet would fit turned - but the rule is about deep basins only.
    const wideOnNarrowSheet = { ...basin(), widthMm: 500, depthMm: 150, rotation: 0 as const, orientation: "horizontal" as const };
    assert.equal(fitPlacementOrientationToSheet(wideOnNarrowSheet, sheetOf(600, 1000), MARGIN), wideOnNarrowSheet);
    const unknown = basin({ widthMm: null, depthMm: null });
    assert.equal(fitPlacementOrientationToSheet(unknown, sheetOf(1800, 600), MARGIN), unknown);
  });

  it("does not turn it back when it was already turned", () => {
    const turned = basin();
    assert.equal(fitPlacementOrientationToSheet(turned, sheetOf(1800, 600), MARGIN), turned);
  });

  it("all 20 catalog basins that are deeper than wide go from breaking the margin to meeting it on a 600 mm counter", () => {
    const sheet = sheetOf(1800, 600);
    const deeper = PRODUCTS.map((product) => ({ product, size: basinDimensionsForProduct(product) }))
      .filter((entry): entry is { product: typeof entry.product; size: { widthMm: number; depthMm: number } } =>
        entry.size.widthMm !== null && entry.size.depthMm !== null && entry.size.depthMm > entry.size.widthMm);
    assert.equal(deeper.length, 20);
    let brokeBefore = 0;
    for (const { product, size } of deeper) {
      const upright: BasinPlacement = { id: product.sku, sku: product.sku, xMm: 0, yMm: 0, ...size, rotation: 0, orientation: "horizontal" };
      const fitted = positionPlacementAtLevel(fitPlacementOrientationToSheet(upright, sheet, MARGIN), counter("i", [1800, 600]), 4);
      const plainCentre = positionPlacementAtLevel(upright, counter("i", [1800, 600]), 4);
      if (!placementMeetsBasinEdgeClearance(plainCentre, sheet, MARGIN)) brokeBefore += 1;
      assert.equal(fitted.rotation, 90, product.sku);
      assert.equal(placementMeetsBasinEdgeClearance(fitted, sheet, MARGIN), true, `${product.sku} still breaks the margin after turning`);
    }
    assert.equal(brokeBefore, 20, "every one of them broke the margin before the fix");
  });

  it("the StudioPage placement factory applies it when the sheet is known, and is unchanged without one", () => {
    const start = studioPage.indexOf("function isRoundBasinProduct(");
    const end = studioPage.indexOf("function addQueryBasinToStudioState(");
    assert.ok(start >= 0 && end > start);
    const source = stripTypeScriptTypes(studioPage.slice(start, end));
    const create = new Function("createBasinPlacement", "fitPlacementOrientationToSheet", "STUDIO_BASIN_SAFETY_MARGIN_MM", `${source}\nreturn createStudioBasinPlacement;`)(
      createBasinPlacement, fitPlacementOrientationToSheet, STUDIO_BASIN_SAFETY_MARGIN_MM,
    ) as (product: unknown, index: number, pieceId: string, sheetId?: string, sheet?: StudioRectangle) => BasinPlacement;
    const sheet = sheetOf(1800, 600);

    const onSheet = create(kf003, 0, "piece-1", sheet.id, sheet);
    assert.equal(onSheet.rotation, 90);
    assert.equal(onSheet.orientation, "vertical");
    assert.deepEqual([onSheet.widthMm, onSheet.depthMm, onSheet.sheetId], [350, 500, "sheet-1"]);
    assert.deepEqual(placementCutSize(onSheet), { widthMm: 500, heightMm: 350 });

    const noSheet = create(kf003, 0, "piece-1", sheet.id);
    assert.equal(noSheet.rotation, 0);
    assert.equal(create(kf003, 0, "piece-1", undefined, sheet).sheetId, "sheet-1", "the sheet id can come from the sheet itself");
    assert.equal(create(kf003, 0, "piece-1", sheet.id, sheetOf(1800, 800)).rotation, 0, "800 mm deep: no need to turn");
    const wideBasin = PRODUCTS.find((product) => product.sku === "KF023")!;
    assert.equal(create(wideBasin, 0, "piece-1", sheet.id, sheet).rotation, 0, "wider than deep is never turned");
  });

  it("every call that places a new basin on a known sheet passes that sheet", () => {
    const calls = [...studioPage.matchAll(/(?<!function )createStudioBasinPlacement\(([^)]*)\)/g)].map((match) => match[1]!);
    const withSheet = calls.filter((args) => /piece\.id, sheet\.id, sheet$/.test(args.trim()));
    assert.equal(withSheet.length, 4, `expected 4 sheet-aware calls, found: ${calls.join(" | ")}`);
    assert.ok(calls.length - withSheet.length <= 1, "only the legacy editor (no sheet in scope) may call it without one");
  });

  it("a basin turned by the customer after the fact stays what they chose (rotatePlacement toggles, never double-swaps)", () => {
    const piece = counter("i", [1800, 600]);
    const placed = { ...basin(), rotation: 0 as const, orientation: "horizontal" as const, xMm: 725, yMm: 100 };
    const turned = rotatePlacement(placed, piece);
    assert.deepEqual([turned.widthMm, turned.depthMm, turned.rotation], [350, 500, 90]);
    const back = rotatePlacement(turned, piece);
    assert.deepEqual([back.widthMm, back.depthMm, back.rotation], [350, 500, 0]);
  });
});

describe("sizes survive a shape switch (carryCustomShapeDimensions)", () => {
  const stockL = [{ widthMm: 1800, depthMm: 600 }, { widthMm: 600, depthMm: 1200 }];
  const stockU = [{ widthMm: 1500, depthMm: 600 }, { widthMm: 600, depthMm: 1200 }, { widthMm: 600, depthMm: 1200 }];
  const stockI = [{ widthMm: 1800, depthMm: 600 }];

  it("keeps the main panel's length and depth, and gives the leg that depth as its width (I -> L)", () => {
    assert.deepEqual(carryCustomShapeDimensions([{ widthMm: 2400, depthMm: 650 }], stockL), [
      { widthMm: 2400, depthMm: 650 },
      { widthMm: 650, depthMm: 1200 },
    ]);
  });

  it("keeps a leg's run length and gives a second leg the first leg's (L -> U)", () => {
    assert.deepEqual(carryCustomShapeDimensions([{ widthMm: 2000, depthMm: 700 }, { widthMm: 700, depthMm: 1500 }], stockU), [
      { widthMm: 2000, depthMm: 700 },
      { widthMm: 700, depthMm: 1500 },
      { widthMm: 700, depthMm: 1500 },
    ]);
  });

  it("remembers a leg across I in between (L -> I -> L)", () => {
    const remembered = [{ widthMm: 2400, depthMm: 650 }, { widthMm: 650, depthMm: 1500 }];
    assert.deepEqual(carryCustomShapeDimensions(remembered, stockI), [{ widthMm: 2400, depthMm: 650 }]);
    assert.deepEqual(carryCustomShapeDimensions(remembered, stockL)[1], { widthMm: 650, depthMm: 1500 });
  });

  it("falls back to the stock sizes only for what was never entered or is not a valid number", () => {
    assert.deepEqual(carryCustomShapeDimensions([], stockL), stockL);
    for (const bad of [null, 0, -5, 12.5, NaN, Infinity]) {
      assert.deepEqual(carryCustomShapeDimensions([{ widthMm: bad, depthMm: bad }], stockL), stockL, `${bad}`);
    }
    assert.deepEqual(carryCustomShapeDimensions([{ widthMm: 2400, depthMm: null }], stockL)[0], { widthMm: 2400, depthMm: 600 });
    assert.deepEqual(carryCustomShapeDimensions([undefined, { widthMm: 600, depthMm: 900 }], stockL)[1], { widthMm: 600, depthMm: 900 });
    assert.deepEqual(carryCustomShapeDimensions([{ widthMm: 2400, depthMm: 650 }], []), []);
  });

  it("the shape panel uses it instead of resetting to the stock sizes", () => {
    const start = studioPage.indexOf("const selectDraftPreset = (nextPreset: StudioPreset) => {");
    const end = studioPage.indexOf("const defaultDimensions = studioCustomShapeDefaults(preset);", start);
    assert.ok(start >= 0 && end > start);
    const handler = studioPage.slice(start, end);
    assert.match(handler, /carryCustomShapeDimensions\(/);
    assert.doesNotMatch(handler, /setPanelDrafts\(studioCustomShapeDefaults\(nextPreset\)\)/);
    assert.match(handler, /rememberedPanels\.current/);
  });

  it("the draft builder starts from the sheets' real sizes even when no edge was customised", () => {
    const start = studioPage.indexOf("function studioCustomShapePresetForPiece(");
    const end = studioPage.indexOf("function studioCustomShapePanelLabel(");
    assert.ok(start >= 0 && end > start);
    const source = stripTypeScriptTypes(studioPage.slice(start, end));
    const draftsForPiece = new Function(`${source}\nreturn studioCustomShapeDraftsForPiece;`)() as (piece: StudioPiece, preset: StudioPreset) => Array<{ lengthMm: string; depthMm: string; edges: Record<string, string> }>;

    const resized = counter("i", [2400, 650]);
    assert.equal(resized.hasCustomEdges, true, "buildCustomShapePiece marks its pieces as customised, so strip it to mimic a size-chip resize");
    const sizeChipBoard: StudioPiece = { ...resized, hasCustomEdges: false, sideStatuses: {} };
    const drafts = draftsForPiece(sizeChipBoard, "i");
    assert.deepEqual([drafts[0]!.lengthMm, drafts[0]!.depthMm], ["2400", "650"]);
    assert.deepEqual(drafts[0]!.edges, { top: "normal", right: "normal", bottom: "normal", left: "normal" });

    const customised = counter("l-left", [2200, 640], [640, 1100]);
    assert.deepEqual(draftsForPiece(customised, "l-left").map((draft) => [draft.lengthMm, draft.depthMm]), [["2200", "640"], ["640", "1100"]]);
    assert.deepEqual(draftsForPiece(customised, "i").map((draft) => [draft.lengthMm, draft.depthMm]), [["1800", "600"]], "another preset starts from its own stock sizes");
  });
});

describe("a clicked stone becomes the active stone at once (toggleStone)", () => {
  const start = studioPage.indexOf("const toggleStone = (code: string) => setState(");
  const end = studioPage.indexOf("const toggleBasin = ", start);
  assert.ok(start >= 0 && end > start, "toggleStone not found");
  const source = stripTypeScriptTypes(`function build(setState) { ${studioPage.slice(start, end)} return toggleStone; }`);
  const build = new Function(`${source}\nreturn build;`)() as (setState: (update: (current: Partial<StudioState>) => Partial<StudioState>) => void) => (code: string) => void;
  const run = (initial: Partial<StudioState>, ...clicks: string[]) => {
    let state = initial;
    const toggle = build((update) => { state = update(state); });
    clicks.forEach((code) => toggle(code));
    return state;
  };

  it("the first colour clicked is active", () => {
    const state = run({ stoneColors: [], activeStone: "" }, "BW010");
    assert.deepEqual([state.stoneColors, state.activeStone, state.stoneSelectionSource], [["BW010"], "BW010", "user"]);
  });

  it("a second colour clicked takes over as the active one and the first stays on the shortlist", () => {
    const state = run({ stoneColors: ["BW010"], activeStone: "BW010" }, "MU010");
    assert.deepEqual(state.stoneColors, ["BW010", "MU010"]);
    assert.equal(state.activeStone, "MU010");
  });

  it("a colour already on the shortlist but not showing becomes the active one when clicked, and stays selected", () => {
    const state = run({ stoneColors: ["BW010", "MU010"], activeStone: "MU010" }, "BW010");
    assert.deepEqual(state.stoneColors, ["BW010", "MU010"]);
    assert.equal(state.activeStone, "BW010");
  });

  it("clicking the colour that is showing removes it and hands over to the next one", () => {
    const state = run({ stoneColors: ["BW010", "MU010"], activeStone: "MU010" }, "MU010");
    assert.deepEqual(state.stoneColors, ["BW010"]);
    assert.equal(state.activeStone, "BW010");
    assert.equal(run({ stoneColors: ["BW010"], activeStone: "BW010" }, "BW010").activeStone, "");
  });

  it("three clicks in a row always leave the last one active", () => {
    assert.equal(run({ stoneColors: [], activeStone: "" }, "BW010", "MU010", "SO423").activeStone, "SO423");
    assert.deepEqual(run({ stoneColors: [], activeStone: "" }, "BW010", "MU010", "SO423").stoneColors, ["BW010", "MU010", "SO423"]);
  });

  it("the plan, the estimate and the label all read state.activeStone, and the label names the colour on the plan", () => {
    assert.match(studioPage, /const activeStoneColor = stoneColorByName\(state\.activeStone, stoneColors\);\s*const activeStoneTone = activeStoneColor\.tone;/);
    assert.match(studioPage, /data-testid="text-studio-active-stone-label"/);
    assert.match(studioPage, /สีที่แสดงบนผัง: <strong>\{activeStoneColor\.name\} \(\{activeStoneColor\.code\}\)<\/strong>/);
    assert.match(studioPage, /\{state\.activeStone && <p className="[^"]*" data-testid="text-studio-active-stone-label">/);
    assert.match(studioPage, /className=\{`studio-stone-choice [^`]*`\} onClick=\{\(\) => \{ toggleStone\(stone\.code\);/);
  });
});

describe("the 7-step picker in the Studio inspector", () => {
  it("shows buttons 1-7 for the selected basin, pressed state from positionLevel, wired to the real snap function", () => {
    assert.match(studioPage, /STUDIO_BASIN_POSITION_LEVELS\.map\(\(level\) => \{/);
    assert.match(studioPage, /data-testid=\{`button-placement-level-\$\{selectedPlacement\.id\}-\$\{level\}`\}/);
    assert.match(studioPage, /const active = selectedPlacement\.positionLevel === level;/);
    assert.match(studioPage, /aria-pressed=\{active\}/);
    assert.match(studioPage, /onClick=\{\(\) => snapSelectedBasinToLevel\(level\)\}/);
    assert.match(studioPage, /updatePlacement\(\(placement\) => positionPlacementAtLevel\(placement, piece, level, STUDIO_BASIN_SAFETY_MARGIN_MM\)\)/);
    assert.match(studioPage, /disabled=\{selectedPlacement\.widthMm === null \|\| selectedPlacement\.depthMm === null\}/);
  });

  it("explains the three anchor levels and the clearance without hard-coding it", () => {
    assert.match(studioPage, /1 = ชิดซ้าย · 4 = กึ่งกลาง · 7 = ชิดขวา · เว้นขอบแผ่น \{STUDIO_BASIN_SAFETY_MARGIN_MM\} มม\. ทุกระดับ/);
  });

  it("uses Tailwind utility classes only, adding no stylesheet rules (src/index.css is not part of this change)", () => {
    const block = studioPage.slice(studioPage.indexOf('data-testid={`group-placement-level-'), studioPage.indexOf("1 = ชิดซ้าย · 4 = กึ่งกลาง"));
    assert.match(block, /grid grid-cols-7 gap-1/);
    assert.doesNotMatch(block, /className="studio-/);
  });

  it("any other way of moving a basin drops its level (placementAtCoordinates, run for real)", () => {
    const start = studioPage.indexOf("function placementAtCoordinates(");
    const end = studioPage.indexOf("function placementAtAnchorOffset(");
    assert.ok(start >= 0 && end > start);
    const source = stripTypeScriptTypes(studioPage.slice(start, end));
    const placementAtCoordinates = new Function("clampPlacementToSheet", "calculateBasinOffsets", `${source}\nreturn placementAtCoordinates;`)(
      clampPlacementToSheet, calculateBasinOffsets,
    ) as (placement: BasinPlacement, piece: StudioPiece, sheet: StudioRectangle, xMm: number, yMm: number) => BasinPlacement;
    const piece = counter("i", [1800, 600]);
    const snapped = positionPlacementAtLevel(basin(), piece, 3);
    assert.equal(snapped.positionLevel, 3);
    const dragged = placementAtCoordinates(snapped, piece, piece.rectangles[0]!, 900, 125);
    assert.equal("positionLevel" in dragged, false);
    assert.equal(dragged.xMm, 900);
  });

  it("rotating a snapped basin re-applies its level for the new width", () => {
    const block = studioPage.slice(studioPage.indexOf("const rotateSelectedBasin = () => {"), studioPage.indexOf("const snapSelectedBasinToLevel"));
    assert.match(block, /rotatePlacement\(placement, piece\)/);
    assert.match(block, /isBasinPositionLevel\(placement\.positionLevel\) \? positionPlacementAtLevel\(next, piece, placement\.positionLevel\) : next/);
    const piece = counter("i", [1800, 600]);
    const upright = positionPlacementAtLevel(basin({ rotation: 0, orientation: "horizontal", yMm: 100 }), piece, 7);
    assert.equal(upright.xMm, 1800 - 350 - MARGIN);
    const turned = positionPlacementAtLevel(rotatePlacement(upright, piece), piece, 7);
    assert.equal(turned.xMm, 1800 - 500 - MARGIN);
    assert.equal(turned.positionLevel, 7);
  });

  it("never uses the legacy setBasinPlacementOrientation, which swaps width and depth a second time", () => {
    assert.doesNotMatch(studioPage, /setBasinPlacementOrientation/);
    assert.doesNotMatch(appSource, /setBasinPlacementOrientation/);
  });
});

describe("saved quote page and the live stone list", () => {
  /** Every top-level argument list of every call to `name(` in `source`. */
  const callArguments = (source: string, name: string) => {
    const calls: string[][] = [];
    for (let index = source.indexOf(`${name}(`); index >= 0; index = source.indexOf(`${name}(`, index + 1)) {
      if (/[A-Za-z0-9_$.]/.test(source[index - 1] ?? "")) continue;
      let depth = 0;
      let current = "";
      const args: string[] = [];
      for (let cursor = index + name.length; cursor < source.length; cursor += 1) {
        const char = source[cursor]!;
        if (char === "(" || char === "[" || char === "{") { depth += 1; if (depth === 1) continue; }
        if (char === ")" || char === "]" || char === "}") { depth -= 1; if (depth === 0) { args.push(current.trim()); break; } }
        if (char === "," && depth === 1) { args.push(current.trim()); current = ""; continue; }
        current += char;
      }
      calls.push(args);
    }
    return calls;
  };

  it("every stoneColorByName call in StudioPage.tsx and App.tsx passes a colour list, and never the static STONE_COLORS", () => {
    for (const [file, source] of [["StudioPage.tsx", studioPage], ["App.tsx", appSource]] as const) {
      const calls = callArguments(source, "stoneColorByName");
      assert.ok(calls.length >= (file === "App.tsx" ? 8 : 10), `${file}: only ${calls.length} calls found - parser broken?`);
      calls.forEach((args) => {
        assert.equal(args.length, 2, `${file}: stoneColorByName(${args.join(", ")}) has no colour list`);
        assert.notEqual(args[1], "STONE_COLORS", `${file}: stoneColorByName(${args.join(", ")}) falls back to the static list`);
      });
    }
  });

  it("the call parser itself sees one-argument calls", () => {
    assert.deepEqual(callArguments("a(stoneColorByName(x), stoneColorByName(y, z))", "stoneColorByName"), [["x"], ["y", "z"]]);
  });

  it("the saved quote page receives the live list from the storefront and hands it to the layout snapshot", () => {
    assert.match(appSource, /<Route path="\/quote\/view"><SavedQuotePage stoneColors=\{catalogStoneColors\.all\} \/><\/Route>/);
    assert.match(appSource, /function SavedQuotePage\(\{ stoneColors \}: \{ stoneColors: ReadonlyArray<StoneColor> \}\) \{/);
    assert.match(appSource, /<StudioLayoutSnapshot state=\{state\} quoteNumber=\{savedQuoteNumber\} stoneColors=\{stoneColors\} \/>/);
    assert.match(appSource, /function StudioLayoutSnapshot\(\{ state, quoteNumber, stoneColors \}/);
  });

  it("the saved plan sizes each basin box with placementCutSize, not the raw stored width and depth", () => {
    const snapshot = appSource.slice(appSource.indexOf("function StudioLayoutSnapshot("), appSource.indexOf("function PaymentSlipUpload("));
    assert.match(snapshot, /const cutSize = placementCutSize\(placement\);/);
    assert.match(snapshot, /\(\(cutSize\.widthMm \?\? 0\) \/ Math\.max\(1, bounds\.widthMm\)\) \* 100/);
    assert.match(snapshot, /\(\(cutSize\.heightMm \?\? 0\) \/ Math\.max\(1, bounds\.heightMm\)\) \* 100/);
    assert.doesNotMatch(snapshot, /placement\.widthMm \?\? 0\) \/ Math\.max/);
    assert.doesNotMatch(snapshot, /placement\.depthMm \?\? 0\) \/ Math\.max/);
    assert.match(appSource, /import \{ pieceBounds, placementCutSize, /);
  });

  it("a turned KF003 is drawn 500 wide and 350 tall on a 1800 x 600 sheet (the arithmetic of that markup)", () => {
    const piece = counter("i", [1800, 600]);
    const turned = positionPlacementAtLevel(basin(), piece, 4);
    const cut = placementCutSize(turned);
    assert.equal(((cut.widthMm ?? 0) / 1800) * 100, (500 / 1800) * 100);
    assert.equal(((cut.heightMm ?? 0) / 600) * 100, (350 / 600) * 100);
    assert.notEqual(((turned.widthMm ?? 0) / 1800) * 100, ((cut.widthMm ?? 0) / 1800) * 100, "the old markup would have drawn it 350 wide");
  });
});

describe("DXF export of turned and snapped basins", () => {
  const basinHoles = (dxf: string) => {
    const polylines = dxf.split("\n0\nLWPOLYLINE\n").slice(1).filter((chunk) => chunk.startsWith("8\nBASIN_HOLES\n"));
    return polylines.map((chunk) => {
      const lines = chunk.split("\n");
      const count = Number(lines[lines.indexOf("90") + 1]);
      const xs: number[] = [];
      const ys: number[] = [];
      // header "8 / layer / 90 / count / 70 / closed", then `count` pairs of "10 x 20 y"; later entities are not ours
      for (let index = lines.indexOf("70") + 2, vertex = 0; vertex < count; vertex += 1, index += 4) {
        xs.push(Number(lines[index + 1]));
        ys.push(Number(lines[index + 3]));
      }
      return { xMm: Math.min(...xs), yMm: Math.min(...ys), widthMm: Math.max(...xs) - Math.min(...xs), heightMm: Math.max(...ys) - Math.min(...ys) };
    });
  };
  const piece = counter("i", [1800, 600]);

  it("writes a 90-degree-turned KF003 as a 500 x 350 hole at its position (not 350 x 500)", () => {
    const state = stateOf(piece, [basin({ xMm: 725, yMm: 125 })]);
    const [hole] = basinHoles(createStudioDxf(state));
    assert.deepEqual(hole, { xMm: 725, yMm: 125, widthMm: 500, heightMm: 350 });
    assert.match(createStudioDxf(state), /500 x 350 mm/);
    assert.doesNotMatch(createStudioDxf(state), /350 x 500 mm/);
    const model = createStudioExportModel(state).basins[0]!;
    assert.deepEqual([model.widthMm, model.heightMm, model.xMm, model.yMm], [500, 350, 725, 125]);
  });

  it("the same basin unturned is 350 x 500, so the rotation is what decides the hole", () => {
    const [hole] = basinHoles(createStudioDxf(stateOf(piece, [basin({ rotation: 0, orientation: "horizontal", yMm: 50 })])));
    assert.deepEqual([hole!.widthMm, hole!.heightMm], [350, 500]);
  });

  it("a basin snapped to each of the seven levels is exported at exactly that x, 100 mm in from the sheet edges at the ends", () => {
    const xs = STUDIO_BASIN_POSITION_LEVELS.map((level) => {
      const snapped = positionPlacementAtLevel(basin({ anchor: "top-left", offsetXMm: 0, offsetYMm: 0 }), piece, level);
      const [hole] = basinHoles(createStudioDxf(stateOf(piece, [snapped])));
      assert.equal(hole!.xMm, snapped.xMm, `level ${level}`);
      assert.deepEqual([hole!.widthMm, hole!.heightMm], [500, 350]);
      return hole!.xMm;
    });
    assert.equal(xs[0], MARGIN);
    assert.equal(xs[6], 1800 - 500 - MARGIN);
    assert.equal(xs[3], (1800 - 500) / 2);
    assert.deepEqual(xs, [...xs].sort((first, second) => first - second));
  });

  it("exports an anchored (offset based) turned basin at the coordinates its offsets describe", () => {
    const anchored = positionPlacementAtLevel(basin({ anchor: "top-right", offsetXMm: 0, offsetYMm: 0 }), piece, 6);
    assert.equal(anchored.anchor, "top-right");
    const [hole] = basinHoles(createStudioDxf(stateOf(piece, [anchored])));
    const expected = calculateBasinCoordinates(piece.rectangles[0]!, anchored);
    assert.deepEqual([hole!.xMm, hole!.yMm, hole!.widthMm, hole!.heightMm], [Math.round(expected.xMm * 100) / 100, Math.round(expected.yMm * 100) / 100, 500, 350]);
  });

  it("keeps a turned basin on a leg of an L at the leg's coordinates", () => {
    const lPiece = counter("l-left", [2400, 600], [600, 1200]);
    const onLeg = positionPlacementAtLevel(basin({ sheetId: "piece-1-2", xMm: 0, yMm: 700 }), lPiece, 1);
    const [hole] = basinHoles(createStudioDxf(stateOf(lPiece, [onLeg], { shape: "L" })));
    assert.deepEqual([hole!.xMm, hole!.widthMm, hole!.heightMm], [onLeg.xMm, 500, 350]);
    assert.ok(hole!.yMm >= 600 + MARGIN - 0.01, "inside the leg, not the main sheet");
  });
});
