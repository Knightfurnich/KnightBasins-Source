/**
 * The 1-7 basin position picker on an upright leg (job-223).
 *
 * On the main sheet of a counter the seven levels run left to right (job-210). On the leg of an L or U - a sheet
 * taller than it is wide - they run top to bottom: level 1 is STUDIO_BASIN_SAFETY_MARGIN_MM from the top edge, 4 the
 * middle, 7 STUDIO_BASIN_SAFETY_MARGIN_MM from the bottom edge. The decision logic is pure (studio-model.ts) and is
 * run for real here; the inspector wording is checked in the StudioPage source.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PRODUCTS } from "../src/data/catalog.ts";
import {
  applyCustomShapeToState,
  basinDimensionsForProduct,
  basinLevelCoordinate,
  basinPositionAxis,
  basinPositionRangeY,
  basinXForPositionLevel,
  basinYForPositionLevel,
  buildCustomShapePiece,
  calculateBasinCoordinates,
  placementCutSize,
  placementMeetsBasinEdgeClearance,
  positionPlacementAtLevel,
  STUDIO_BASIN_POSITION_LEVELS,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type BasinPositionLevel,
  type StudioPiece,
  type StudioPreset,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";

const studioPage = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
const studioModelSource = readFileSync(new URL("../src/data/studio-model.ts", import.meta.url), "utf8");

const MARGIN = STUDIO_BASIN_SAFETY_MARGIN_MM;
const EDGES = { top: "normal", right: "normal", bottom: "normal", left: "normal" } as const;
const counter = (preset: StudioPreset, ...sizes: Array<[widthMm: number, depthMm: number]>): StudioPiece => ({
  ...buildCustomShapePiece("piece-1", preset, sizes.map(([widthMm, depthMm]) => ({ widthMm, depthMm, edges: { ...EDGES } }))),
  name: "ชิ้นงาน 1",
});
const sheetOf = (widthMm: number, lengthMm: number, xMm = 0, yMm = 0, rotation: 0 | 90 = 0): StudioRectangle => ({ id: "sheet-1", widthMm, lengthMm, xMm, yMm, rotation });

// KF003 stored 350 wide x 500 deep: 350 x 500 on the plan unturned, 500 x 350 turned.
const basin = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF003",
  pieceId: "piece-1",
  sheetId: "piece-1-2",
  xMm: 130,
  yMm: 900,
  widthMm: 350,
  depthMm: 500,
  rotation: 0,
  orientation: "horizontal",
  ...overrides,
});

const stateOf = (piece: StudioPiece, basinPlacements: BasinPlacement[]): StudioState => ({
  mode: "studio",
  shape: "L",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 0 },
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
});

/** An L whose back run is 1800 x 600 and whose left leg is 600 x 1200, hanging from y = 600. */
const lShape = counter("l-left", [1800, 600], [600, 1200]);
const mainSheet = lShape.rectangles[0]!;
const leg = lShape.rectangles[1]!;

describe("which axis the seven levels run along", () => {
  it("left to right on the main sheet, top to bottom on an upright leg", () => {
    assert.equal(basinPositionAxis(mainSheet), "x");
    assert.equal(basinPositionAxis(leg), "y");
    for (const rectangle of counter("u", [1500, 600], [600, 1200], [600, 1200]).rectangles.slice(1)) assert.equal(basinPositionAxis(rectangle), "y");
  });

  it("a square sheet and a sheet exactly as tall as it is wide keep the old left-to-right behaviour", () => {
    assert.equal(basinPositionAxis(sheetOf(600, 600)), "x");
    assert.equal(basinPositionAxis(sheetOf(800, 799)), "x");
    assert.equal(basinPositionAxis(sheetOf(800, 801)), "y");
  });

  it("a sheet that is rotated 90 degrees is judged by the shape it actually occupies", () => {
    assert.equal(basinPositionAxis(sheetOf(600, 1800, 0, 0, 90)), "x", "stored 600 x 1800, lying down: 1800 wide on the plan");
    assert.equal(basinPositionAxis(sheetOf(1800, 600, 0, 0, 90)), "y");
  });
});

describe("levels 1-7 on an upright leg (L-shape, leg 600 x 1200)", () => {
  const placedAt = (level: BasinPositionLevel, overrides: Partial<BasinPlacement> = {}) => positionPlacementAtLevel(basin(overrides), lShape, level);

  it("yMm runs from exactly 100 mm below the leg's top edge to exactly 100 mm above its bottom edge, in six equal steps", () => {
    assert.equal(MARGIN, 100);
    const ys = STUDIO_BASIN_POSITION_LEVELS.map((level) => placedAt(level).yMm);
    // the leg spans y 600..1800; the 500 mm tall cut-out may start between 700 and 1200
    assert.equal(ys[0], leg.yMm + MARGIN);
    assert.equal(ys[6], leg.yMm + leg.lengthMm - 500 - MARGIN);
    assert.equal(ys[3], (700 + 1200) / 2);
    assert.deepEqual(ys, [700, 783, 867, 950, 1033, 1117, 1200]);
    assert.deepEqual(ys, [...ys].sort((first, second) => first - second));
  });

  it("every level keeps at least 100 mm to the top and bottom edge, and the basin remembers its level", () => {
    for (const level of STUDIO_BASIN_POSITION_LEVELS) {
      const placed = placedAt(level);
      const top = placed.yMm - leg.yMm;
      const bottom = leg.yMm + leg.lengthMm - (placed.yMm + 500);
      assert.ok(top >= MARGIN && bottom >= MARGIN, `level ${level}: ${top} mm from the top, ${bottom} mm from the bottom`);
      assert.equal(placementMeetsBasinEdgeClearance(placed, leg, MARGIN), true, `level ${level}`);
      assert.equal(placed.positionLevel, level);
      assert.equal(placed.sheetId, "piece-1-2");
    }
  });

  it("the level only moves y: x stays put when it is already inside the clearance, and is pulled inside when it is not", () => {
    assert.equal(placedAt(5, { xMm: 120 }).xMm, 120);
    assert.equal(placedAt(5, { xMm: 0 }).xMm, MARGIN, "flush against the left edge is pulled to 100 mm");
    assert.equal(placedAt(5, { xMm: 250 }).xMm, 600 - 350 - MARGIN, "flush against the right edge is pulled to 100 mm");
  });

  it("a turned basin is measured turned: 500 wide needs the whole leg width, so only y is clamped", () => {
    const turned = basin({ rotation: 90, orientation: "vertical", xMm: 60 });
    assert.deepEqual(placementCutSize(turned), { widthMm: 500, heightMm: 350 });
    const ys = STUDIO_BASIN_POSITION_LEVELS.map((level) => positionPlacementAtLevel(turned, lShape, level).yMm);
    assert.equal(ys[0], leg.yMm + MARGIN);
    assert.equal(ys[6], leg.yMm + leg.lengthMm - 350 - MARGIN);
    assert.equal(positionPlacementAtLevel(turned, lShape, 4).xMm, 60, "a leg too narrow for the clearance keeps the basin's x");
  });

  it("offsets reproduce the coordinates for every anchor", () => {
    for (const anchor of ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const) {
      for (const level of STUDIO_BASIN_POSITION_LEVELS) {
        const placed = placedAt(level, { anchor, offsetXMm: 0, offsetYMm: 0 });
        const coordinates = calculateBasinCoordinates(leg, placed);
        assert.equal(Math.round(coordinates.xMm), placed.xMm, `${anchor} level ${level}: x`);
        assert.equal(Math.round(coordinates.yMm), placed.yMm, `${anchor} level ${level}: y`);
      }
    }
  });

  it("a leg too short for the clearance centres the basin instead, and an unknown size is left alone", () => {
    const shortLeg = sheetOf(600, 650, 0, 600);
    assert.equal(basinPositionRangeY(shortLeg, basin(), MARGIN), null);
    for (const level of STUDIO_BASIN_POSITION_LEVELS) assert.equal(basinYForPositionLevel(shortLeg, basin(), level, MARGIN), 600 + (650 - 500) / 2);
    assert.equal(basinYForPositionLevel(leg, basin({ widthMm: null, depthMm: null }), 4, MARGIN), null);
    assert.equal(basinLevelCoordinate(leg, basin({ widthMm: null, depthMm: null }), 4, MARGIN), null);
    const unknown = positionPlacementAtLevel(basin({ widthMm: null, depthMm: null, yMm: 777 }), lShape, 6);
    assert.deepEqual([unknown.yMm, unknown.positionLevel], [777, 6]);
  });

  it("all 28 catalog basins with a known size keep 100 mm top and bottom at every level, on legs of 1200, 1500 and 2400 mm", () => {
    let checked = 0;
    for (const product of PRODUCTS) {
      const size = basinDimensionsForProduct(product);
      if (size.widthMm === null || size.depthMm === null) continue;
      for (const rotation of [0, 90] as const) {
        for (const legLength of [1200, 1500, 2400]) {
          const piece = counter("l-left", [1800, 600], [600, legLength]);
          const targetLeg = piece.rectangles[1]!;
          const placement = basin({ sku: product.sku, ...size, rotation, orientation: rotation === 90 ? "vertical" : "horizontal", xMm: 100 });
          const cut = placementCutSize(placement);
          for (const level of STUDIO_BASIN_POSITION_LEVELS) {
            const placed = positionPlacementAtLevel(placement, piece, level);
            const top = placed.yMm - targetLeg.yMm;
            const bottom = targetLeg.yMm + targetLeg.lengthMm - (placed.yMm + cut.heightMm!);
            assert.ok(top >= MARGIN - 0.01 && bottom >= MARGIN - 0.01, `${product.sku} r${rotation} leg ${legLength} level ${level}: top ${top}, bottom ${bottom}`);
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked >= 28 * 2 * 3 * 7, `only ${checked} combinations checked`);
  });
});

describe("the main sheet is unchanged (job-210 behaviour)", () => {
  it("on the horizontal main sheet the levels still move x and leave y alone", () => {
    const onMain = basin({ sheetId: "piece-1-1", widthMm: 350, depthMm: 350, xMm: 400, yMm: 130 }); // 350 deep: y may sit anywhere from 100 to 150
    for (const level of STUDIO_BASIN_POSITION_LEVELS) {
      const placed = positionPlacementAtLevel(onMain, lShape, level);
      assert.equal(placed.xMm, basinXForPositionLevel(mainSheet, onMain, level, MARGIN), `level ${level}`);
      assert.equal(placed.yMm, 130, `level ${level}: y is untouched`);
    }
    assert.equal(positionPlacementAtLevel(onMain, lShape, 1).xMm, MARGIN);
    assert.equal(positionPlacementAtLevel(onMain, lShape, 7).xMm, 1800 - 350 - MARGIN);
  });

  it("a plain I counter behaves as before", () => {
    const flat = counter("i", [1800, 600]);
    const placed = positionPlacementAtLevel(basin({ sheetId: "piece-1-1", yMm: 100 }), flat, 7);
    assert.equal(placed.xMm, 1800 - 350 - MARGIN);
    assert.equal(placed.yMm, 100);
  });
});

describe("a basin on a leg keeps its level through shape changes (I <-> L)", () => {
  const panels = (...sizes: Array<[number, number]>) => sizes.map(([widthMm, depthMm]) => ({ widthMm, depthMm, edges: { ...EDGES } }));
  const only = (state: StudioState) => state.basinPlacements[0]!;

  it("a longer leg moves the basin to the same level on the new leg, along y only", () => {
    const onLeg = positionPlacementAtLevel(basin(), lShape, 7);
    assert.equal(onLeg.yMm, 1200);
    const result = applyCustomShapeToState(stateOf(lShape, [onLeg]), "piece-1", "l-left", panels([1800, 600], [600, 1500]));
    const moved = only(result.state);
    assert.equal(moved.sheetId, "piece-1-2");
    assert.equal(moved.yMm, 600 + 1500 - 500 - MARGIN);
    assert.equal(moved.xMm, onLeg.xMm, "the cross axis is not touched");
    assert.equal(moved.positionLevel, 7);
    assert.deepEqual(result.notices.map((notice) => notice.kind), ["moved"]);
  });

  it("a shorter leg keeps level 1 exactly 100 mm from the top and level 4 in the middle", () => {
    const one = applyCustomShapeToState(stateOf(lShape, [positionPlacementAtLevel(basin(), lShape, 1)]), "piece-1", "l-left", panels([1800, 600], [600, 900]));
    assert.equal(only(one.state).yMm, 600 + MARGIN);
    const four = applyCustomShapeToState(stateOf(lShape, [positionPlacementAtLevel(basin(), lShape, 4)]), "piece-1", "l-left", panels([1800, 600], [600, 900]));
    assert.equal(only(four.state).yMm, 600 + (900 - 500) / 2);
    assert.equal(only(four.state).positionLevel, 4);
  });

  it("L -> I -> L: the basin goes to the main sheet (the leg is gone), keeps its level along x there, and still has it afterwards", () => {
    // 350 x 350 so that it also fits the 600 mm deep main sheet with the full clearance
    const onLeg = positionPlacementAtLevel(basin({ widthMm: 350, depthMm: 350 }), lShape, 6);
    const toI = applyCustomShapeToState(stateOf(lShape, [onLeg]), "piece-1", "i", panels([1800, 600])).state;
    const onMainNow = only(toI);
    assert.equal(onMainNow.sheetId, "piece-1-1");
    assert.equal(onMainNow.positionLevel, 6);
    const flat = counter("i", [1800, 600]);
    assert.equal(onMainNow.xMm, basinXForPositionLevel(flat.rectangles[0]!, onMainNow, 6, MARGIN));
    const backToL = applyCustomShapeToState(toI, "piece-1", "l-left", panels([1800, 600], [600, 1200])).state;
    assert.equal(only(backToL).sheetId, "piece-1-1");
    assert.equal(only(backToL).positionLevel, 6);
    assert.equal(placementMeetsBasinEdgeClearance(only(backToL), backToL.pieces![0]!.rectangles[0]!, MARGIN), true);
  });

  it("I -> L with the basin on the main sheet: the main sheet is still horizontal, so x keeps following the level", () => {
    const flat = counter("i", [1800, 600]);
    const start = positionPlacementAtLevel(basin({ sheetId: "piece-1-1", yMm: 125 }), flat, 7);
    const result = applyCustomShapeToState(stateOf(flat, [start]), "piece-1", "l-left", panels([2400, 600], [600, 1200]));
    assert.equal(only(result.state).xMm, 2400 - 350 - MARGIN);
    assert.equal(only(result.state).positionLevel, 7);
  });

  it("reflowing onto an L-right leg works the same way", () => {
    const lRight = counter("l-right", [1800, 600], [600, 1200]);
    const rightLeg = lRight.rectangles[1]!;
    const onLeg = positionPlacementAtLevel(basin({ xMm: rightLeg.xMm + 130 }), lRight, 7);
    assert.equal(onLeg.yMm, rightLeg.yMm + rightLeg.lengthMm - 500 - MARGIN);
    const result = applyCustomShapeToState(stateOf(lRight, [onLeg]), "piece-1", "l-right", panels([1800, 600], [600, 1000]));
    const moved = only(result.state);
    const newLeg = result.state.pieces![0]!.rectangles[1]!;
    assert.equal(moved.yMm, newLeg.yMm + 1000 - 500 - MARGIN);
    assert.equal(placementMeetsBasinEdgeClearance(moved, newLeg, MARGIN), true);
  });
});

describe("the inspector explains the direction", () => {
  const block = studioPage.slice(studioPage.indexOf('<div className="mt-2 grid gap-1.5" role="group"'), studioPage.indexOf("studio-helper\">ระยะ X / Y"));

  it("works the axis out from the selected placement's own sheet with the model's basinPositionAxis", () => {
    assert.match(studioPage, /const selectedSheet = selectedPlacement \? piece\.rectangles\.find\(\(rectangle\) => rectangle\.id === selectedPlacement\.sheetId\) : undefined;/);
    assert.match(studioPage, /const levelAxis = selectedSheet \? basinPositionAxis\(selectedSheet\) : "x";/);
    assert.match(studioPage, /^\s+basinPositionAxis,$/m);
  });

  it("on an upright leg shows the top-to-bottom legend, heading, hint and button labels", () => {
    assert.match(block, /levelAxis === "y" && <span className="text-xs text-muted-foreground" data-testid=\{`text-placement-level-direction-\$\{selectedPlacement\.id\}`\}>บนสุด ◄--- กึ่งกลาง ---► ล่างสุด<\/span>/);
    assert.match(block, /levelAxis === "y" \? "ตำแหน่งอ่าง 7 ระดับ \(บน → ล่าง\)" : "ตำแหน่งอ่าง 7 ระดับ \(ซ้าย → ขวา\)"/);
    assert.match(block, /<>1 = ชิดบน · 4 = กึ่งกลาง · 7 = ชิดล่าง · เว้นขอบแผ่น \{STUDIO_BASIN_SAFETY_MARGIN_MM\} มม\. ทุกระดับ<\/>/);
    assert.match(block, /levelAxis === "y" \? " ชิดบนสุด" : " ชิดซ้ายสุด"/);
    assert.match(block, /levelAxis === "y" \? " ชิดล่างสุด" : " ชิดขวาสุด"/);
    assert.match(block, /data-axis=\{levelAxis\}/);
  });

  it("on the main sheet the wording is exactly what it was", () => {
    assert.match(block, /<>1 = ชิดซ้าย · 4 = กึ่งกลาง · 7 = ชิดขวา · เว้นขอบแผ่น \{STUDIO_BASIN_SAFETY_MARGIN_MM\} มม\. ทุกระดับ<\/>/);
    assert.match(block, /aria-label=\{levelAxis === "y" \? "ตำแหน่งอ่างบน–ล่าง 7 ระดับ" : "ตำแหน่งอ่างซ้าย–ขวา 7 ระดับ"\}/);
  });

  it("the buttons still call the same snap function, so the same code serves both axes", () => {
    assert.match(studioPage, /updatePlacement\(\(placement\) => positionPlacementAtLevel\(placement, piece, level, STUDIO_BASIN_SAFETY_MARGIN_MM\)\)/);
  });

  it("is styled with utility classes only (index.css is not touched)", () => {
    assert.doesNotMatch(block, /className="studio-/);
  });
});

describe("no hard-coded clearance in the new code", () => {
  it("the vertical-axis helpers take the margin from STUDIO_BASIN_SAFETY_MARGIN_MM / a marginMm parameter, never a literal 100", () => {
    const start = studioModelSource.indexOf("export function basinPositionRangeY(");
    const end = studioModelSource.indexOf("export function fitPlacementOrientationToSheet");
    assert.ok(start > 0 && end > start);
    const code = studioModelSource.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /\b100\b/);
    assert.match(code, /marginMm: number = STUDIO_BASIN_SAFETY_MARGIN_MM/);
  });
});
