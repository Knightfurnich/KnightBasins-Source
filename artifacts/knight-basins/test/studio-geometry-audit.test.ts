import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBasinCoordinates,
  placementCrossesPanelJoint,
  placementCutSize,
  placementFitsStudioPiece,
  reflowStudioRectangles,
  studioRectangleSize,
  type BasinPlacement,
  type StudioPiece,
  type StudioRectangle,
} from "../src/data/studio-model.ts";
import { createStudioDxf, createStudioExportModel, createStudioPngSvg } from "../src/data/studio-export.ts";

const rectangle = (id: string, overrides: Partial<StudioRectangle> = {}): StudioRectangle => ({
  id,
  widthMm: 1000,
  lengthMm: 600,
  xMm: 0,
  yMm: 0,
  rotation: 0,
  ...overrides,
});

const piece = (rectangles: StudioRectangle[], sideStatuses: StudioPiece["sideStatuses"] = {}): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses,
});

const basin = (overrides: Partial<BasinPlacement> = {}): BasinPlacement => ({
  id: "basin-1",
  sku: "KF001",
  pieceId: "piece-1",
  xMm: 0,
  yMm: 0,
  widthMm: 500,
  depthMm: 400,
  rotation: 0,
  ...overrides,
});

/** Gap in mm between a resolved child and its parent, measured along the attached edge only. */
function attachmentGapMm(parent: StudioRectangle, child: StudioRectangle, edge: "left" | "right" | "top" | "bottom") {
  const parentSize = studioRectangleSize(parent);
  const childSize = studioRectangleSize(child);
  if (edge === "right") return child.xMm - (parent.xMm + parentSize.widthMm);
  if (edge === "left") return parent.xMm - (child.xMm + childSize.widthMm);
  if (edge === "bottom") return child.yMm - (parent.yMm + parentSize.heightMm);
  return parent.yMm - (child.yMm + childSize.heightMm);
}

// ===========================================================================
// 1. Attachment: child must stay flush (0mm gap) to its parent on every edge
//    and every align, through resize AND translation (move) of the parent,
//    including a rotated parent/child.
// ===========================================================================

test("audit 1: every edge stays flush at 0mm after the parent is both resized and moved in the same step", () => {
  const edges: Array<"left" | "right" | "top" | "bottom"> = ["left", "right", "top", "bottom"];
  for (const edge of edges) {
    const before = [
      rectangle("parent", { widthMm: 1000, lengthMm: 600, xMm: 200, yMm: 200 }),
      rectangle("child", { widthMm: 400, lengthMm: 300, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge } }),
    ];
    // Resize AND translate the parent in the same reflow call.
    const after = reflowStudioRectangles(before, before.map((r) =>
      r.id === "parent" ? { ...r, widthMm: 1500, lengthMm: 900, xMm: 700, yMm: 550 } : r));
    const parent = after.find((r) => r.id === "parent")!;
    const child = after.find((r) => r.id === "child")!;
    assert.equal(attachmentGapMm(parent, child, edge), 0, `${edge}: gap must be exactly 0mm after resize+move`);
  }
});

test("audit 1: start/center/end align stay exact (no rounding drift) for all four edges", () => {
  const edges: Array<"left" | "right" | "top" | "bottom"> = ["left", "right", "top", "bottom"];
  const aligns: Array<"start" | "center" | "end"> = ["start", "center", "end"];
  for (const edge of edges) {
    for (const align of aligns) {
      const before = [
        rectangle("parent", { widthMm: 1001, lengthMm: 601, xMm: 0, yMm: 0 }),
        rectangle("child", { widthMm: 333, lengthMm: 199, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge, align } }),
      ];
      const after = reflowStudioRectangles(before, before);
      const parent = after.find((r) => r.id === "parent")!;
      const child = after.find((r) => r.id === "child")!;
      assert.equal(attachmentGapMm(parent, child, edge), 0, `${edge}/${align}: primary-axis gap must be 0mm`);
      assert.ok(Number.isFinite(child.xMm) && Number.isFinite(child.yMm), `${edge}/${align}: position must be finite`);
    }
  }
});

test("audit 1: attachment stays flush when the parent itself is rotated 90 degrees", () => {
  const before = [
    // 1200 x 500 physically after rotation (widthMm/lengthMm swap).
    rectangle("parent", { widthMm: 500, lengthMm: 1200, xMm: 0, yMm: 0, rotation: 90 }),
    rectangle("child", { widthMm: 300, lengthMm: 400, xMm: 0, yMm: 0, attachTo: { rectangleId: "parent", edge: "right", align: "center" } }),
  ];
  const after = reflowStudioRectangles(before, before);
  const parent = after.find((r) => r.id === "parent")!;
  const child = after.find((r) => r.id === "child")!;
  const parentSize = studioRectangleSize(parent);
  assert.equal(parentSize.widthMm, 1200, "rotation swaps width/length for geometry purposes");
  assert.equal(attachmentGapMm(parent, child, "right"), 0);
  assert.equal(child.yMm, (parentSize.heightMm - studioRectangleSize(child).heightMm) / 2, "center align on the cross axis");
});

test("audit 1: a three-level attachment chain (root -> mid -> leaf) stays flush end-to-end after the root moves", () => {
  const before = [
    rectangle("root", { widthMm: 800, lengthMm: 500, xMm: 100, yMm: 100 }),
    rectangle("mid", { widthMm: 400, lengthMm: 500, xMm: 900, yMm: 100, attachTo: { rectangleId: "root", edge: "right" } }),
    rectangle("leaf", { widthMm: 300, lengthMm: 200, xMm: 1300, yMm: 100, attachTo: { rectangleId: "mid", edge: "right", align: "end" } }),
  ];
  const after = reflowStudioRectangles(before, before.map((r) => (r.id === "root" ? { ...r, xMm: 400, yMm: 250 } : r)));
  const root = after.find((r) => r.id === "root")!;
  const mid = after.find((r) => r.id === "mid")!;
  const leaf = after.find((r) => r.id === "leaf")!;
  assert.equal(attachmentGapMm(root, mid, "right"), 0);
  assert.equal(attachmentGapMm(mid, leaf, "right"), 0);
  assert.equal(mid.xMm, 1200, "400 + 800 = 1200");
  assert.equal(leaf.xMm, 1600, "1200 + 400 = 1600");
});

// ===========================================================================
// 2. Cycle protection: circular attachTo chains must never hang or throw, and
//    must always resolve to finite, defined coordinates.
// ===========================================================================

test("audit 2: a direct two-node cycle (A<->B) resolves to finite coordinates without throwing", () => {
  const before = [
    rectangle("a", { widthMm: 500, lengthMm: 500, xMm: 0, yMm: 0, attachTo: { rectangleId: "b", edge: "right" } }),
    rectangle("b", { widthMm: 500, lengthMm: 500, xMm: 500, yMm: 0, attachTo: { rectangleId: "a", edge: "right" } }),
  ];
  let after: StudioRectangle[] = [];
  assert.doesNotThrow(() => { after = reflowStudioRectangles(before, before); });
  assert.equal(after.length, 2);
  for (const r of after) {
    assert.ok(Number.isFinite(r.xMm), `${r.id}.xMm must be finite`);
    assert.ok(Number.isFinite(r.yMm), `${r.id}.yMm must be finite`);
  }
});

test("audit 2: a three-node cycle (A->B->C->A) terminates and returns finite coordinates for all three", () => {
  const before = [
    rectangle("a", { widthMm: 400, lengthMm: 400, xMm: 0, yMm: 0, attachTo: { rectangleId: "c", edge: "right" } }),
    rectangle("b", { widthMm: 400, lengthMm: 400, xMm: 400, yMm: 0, attachTo: { rectangleId: "a", edge: "right" } }),
    rectangle("c", { widthMm: 400, lengthMm: 400, xMm: 800, yMm: 0, attachTo: { rectangleId: "b", edge: "right" } }),
  ];
  const started = Date.now();
  const after = reflowStudioRectangles(before, before);
  assert.ok(Date.now() - started < 1000, "must resolve well under a second, proving no infinite loop");
  assert.equal(after.length, 3);
  for (const r of after) {
    assert.ok(Number.isFinite(r.xMm), `${r.id}.xMm must be finite`);
    assert.ok(Number.isFinite(r.yMm), `${r.id}.yMm must be finite`);
  }
});

test("audit 2: a rectangle attached to itself resolves to a finite fallback instead of recursing forever", () => {
  const before = [
    rectangle("root", { widthMm: 600, lengthMm: 400, xMm: 0, yMm: 0 }),
    rectangle("self", { widthMm: 300, lengthMm: 300, xMm: 1234, yMm: 567, attachTo: { rectangleId: "self", edge: "right" } }),
  ];
  const after = reflowStudioRectangles(before, before);
  const self = after.find((r) => r.id === "self")!;
  assert.ok(Number.isFinite(self.xMm) && Number.isFinite(self.yMm));
  // The solver detects "self" is already being resolved and falls back to its raw
  // (1234, 567) position for that inner reference, then positions the outer "self"
  // one step to the right of that raw fallback (1234 + 300 = 1534). It never
  // literally freezes at its own original position, but it does terminate
  // deterministically with finite numbers -- which is the actual safety contract.
  assert.equal(self.xMm, 1534, "1234 + widthMm(300) = 1534, resolved via the raw fallback of its own inner reference");
  assert.equal(self.yMm, 567);
});

test("audit 2: cycles remain stable and deterministic across repeated resolves (no drift, no crash on repeat calls)", () => {
  const before = [
    rectangle("a", { widthMm: 500, lengthMm: 500, xMm: 0, yMm: 0, attachTo: { rectangleId: "b", edge: "bottom" } }),
    rectangle("b", { widthMm: 500, lengthMm: 500, xMm: 0, yMm: 500, attachTo: { rectangleId: "a", edge: "bottom" } }),
  ];
  const first = reflowStudioRectangles(before, before);
  const second = reflowStudioRectangles(before, before);
  assert.deepEqual(first, second, "resolving the same cyclic input twice must produce the same result");
});

// ===========================================================================
// 3. Basin cutout safety: within panel bounds, safety margin from the panel
//    edge, and never straddling a panel-to-panel joint.
// ===========================================================================

test("audit 3: a basin fully inside a single panel is reported as fitting and not crossing a joint", () => {
  const sheet = piece([rectangle("sheet-1", { widthMm: 1000, lengthMm: 600 })]);
  const placement = basin({ xMm: 100, yMm: 100, widthMm: 400, depthMm: 300, sheetId: "sheet-1" });
  assert.equal(placementFitsStudioPiece(sheet, placement), true);
  assert.equal(placementCrossesPanelJoint(sheet, placement), false);
});

test("audit 3: a basin extending past the panel's right or bottom edge is reported as not fitting", () => {
  const sheet = piece([rectangle("sheet-1", { widthMm: 1000, lengthMm: 600 })]);
  const overRight = basin({ xMm: 700, yMm: 100, widthMm: 400, depthMm: 300 });
  const overBottom = basin({ xMm: 100, yMm: 400, widthMm: 300, depthMm: 300 });
  assert.equal(placementFitsStudioPiece(sheet, overRight), false, "700 + 400 = 1100 > 1000");
  assert.equal(placementFitsStudioPiece(sheet, overBottom), false, "400 + 300 = 700 > 600");
});

test("audit 3: a basin extending past the panel's left or top edge (negative offset) is reported as not fitting", () => {
  const sheet = piece([rectangle("sheet-1", { widthMm: 1000, lengthMm: 600, xMm: 200, yMm: 200 })]);
  const overLeft = basin({ xMm: 100, yMm: 300, widthMm: 300, depthMm: 200 });
  const overTop = basin({ xMm: 300, yMm: 100, widthMm: 300, depthMm: 200 });
  assert.equal(placementFitsStudioPiece(sheet, overLeft), false);
  assert.equal(placementFitsStudioPiece(sheet, overTop), false);
});

test("audit 3: a basin straddling the joint between two adjacent panels is flagged as crossing, even though it fits within the combined footprint", () => {
  const twoPanels = piece([
    rectangle("left", { widthMm: 600, lengthMm: 600, xMm: 0, yMm: 0 }),
    rectangle("right", { widthMm: 600, lengthMm: 600, xMm: 600, yMm: 0 }),
  ]);
  const straddling = basin({ xMm: 500, yMm: 200, widthMm: 200, depthMm: 200 });
  assert.equal(placementCrossesPanelJoint(twoPanels, straddling), true);
  const wellWithinLeft = basin({ xMm: 50, yMm: 200, widthMm: 200, depthMm: 200 });
  assert.equal(placementCrossesPanelJoint(twoPanels, wellWithinLeft), false);
});

test("audit 3 FINDING: a cutout flush against the panel edge (0mm clearance) currently passes the fit check — no dedicated safety-margin distance exists yet", () => {
  // This documents current behavior rather than asserting a business rule: there is
  // no `marginMm`/clearance constant anywhere in studio-model.ts today (verified by
  // grep across studio-model.ts, studio-export.ts, and StudioPage.tsx). Only
  // STUDIO_EPSILON_MM (0.01mm) exists, which is a floating-point tolerance, not a
  // real fabrication safety margin. A basin cut exactly to a panel's edge is
  // structurally risky (the stone can crack at a 0mm-clearance cutout) but is
  // reported as "fits" today. Flagging this to David rather than inventing a
  // margin value myself, since the correct clearance (e.g. 20mm/30mm/50mm) is a
  // fabrication/engineering decision, not something to guess in an audit.
  const sheet = piece([rectangle("sheet-1", { widthMm: 1000, lengthMm: 600 })]);
  const flushToRightEdge = basin({ xMm: 600, yMm: 100, widthMm: 400, depthMm: 300 }); // 600 + 400 = 1000, exactly the edge
  assert.equal(placementFitsStudioPiece(sheet, flushToRightEdge), true, "0mm clearance from the edge is currently accepted as safe");
});

// ===========================================================================
// 4. DXF/SVG export coordinates must match the 2D canvas coordinates exactly.
//    (Canvas rendering itself lives in StudioPage.tsx: BasinPlacementMarker
//    resolves `sheet && offsetXMm/offsetYMm !== undefined ? calculateBasinCoordinates(sheet, placement) : {xMm, yMm}`
//    -- createStudioExportModel below uses the identical condition and function.)
// ===========================================================================

function stateFor(pieces: StudioPiece[], basinPlacements: BasinPlacement[] = []) {
  return { pieces, shape: "I" as const, dimensions: { depthMm: 600, runAMm: 1000, runBMm: 0, runCMm: 0 }, basinPlacements };
}

test("audit 4: exported piece rectangle coordinates equal the raw canvas rectangle geometry (respecting rotation)", () => {
  const rectA = rectangle("a", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 });
  const rectB = rectangle("b", { widthMm: 400, lengthMm: 900, xMm: 1000, yMm: 0, rotation: 90 });
  const state = stateFor([piece([rectA, rectB])]);
  const model = createStudioExportModel(state);
  const exportedA = model.pieces[0].rectangles.find((r) => r.rectangleId === "a")!;
  const exportedB = model.pieces[0].rectangles.find((r) => r.rectangleId === "b")!;
  assert.deepEqual({ xMm: exportedA.xMm, yMm: exportedA.yMm, widthMm: exportedA.widthMm, heightMm: exportedA.heightMm }, { xMm: 0, yMm: 0, widthMm: 1000, heightMm: 600 });
  const canvasSizeB = studioRectangleSize(rectB);
  assert.deepEqual({ xMm: exportedB.xMm, yMm: exportedB.yMm, widthMm: exportedB.widthMm, heightMm: exportedB.heightMm }, { xMm: 1000, yMm: 0, widthMm: canvasSizeB.widthMm, heightMm: canvasSizeB.heightMm });
});

test("audit 4: exported basin coordinates match calculateBasinCoordinates when a sheet+offsets are defined, exactly like the canvas marker does", () => {
  const sheet = rectangle("sheet-1", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 });
  const placement = basin({ sheetId: "sheet-1", anchor: "center", offsetXMm: 0, offsetYMm: 0, widthMm: 400, depthMm: 300 });
  const state = stateFor([piece([sheet])], [placement]);
  const model = createStudioExportModel(state);
  const exportedBasin = model.basins.find((b) => b.sku === placement.sku)!;
  const canvasCoordinates = calculateBasinCoordinates(sheet, placement); // what BasinPlacementMarker computes on screen
  assert.equal(exportedBasin.xMm, canvasCoordinates.xMm);
  assert.equal(exportedBasin.yMm, canvasCoordinates.yMm);
});

test("audit 4: exported basin coordinates fall back to raw placement.xMm/yMm when offsets are undefined, exactly like the canvas marker does", () => {
  const sheet = rectangle("sheet-1", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 });
  const placement = basin({ sheetId: "sheet-1", xMm: 321, yMm: 654, offsetXMm: undefined, offsetYMm: undefined });
  const state = stateFor([piece([sheet])], [placement]);
  const model = createStudioExportModel(state);
  const exportedBasin = model.basins.find((b) => b.sku === placement.sku)!;
  assert.equal(exportedBasin.xMm, 321);
  assert.equal(exportedBasin.yMm, 654);
});

test("audit 4: the generated DXF's PIECE_OUTLINE and BASIN_HOLES entities carry the exact same coordinates as the export model", () => {
  const sheet = rectangle("sheet-1", { widthMm: 1000, lengthMm: 600, xMm: 0, yMm: 0 });
  const placement = basin({ sheetId: "sheet-1", xMm: 200, yMm: 150, widthMm: 300, depthMm: 200 });
  const state = stateFor([piece([sheet])], [placement]);
  const model = createStudioExportModel(state);
  const dxf = createStudioDxf(state);
  const entities = parseDxfEntities(dxf);

  const outline = entities.find((entity) => entity.type === "LWPOLYLINE" && entity.layer === "PIECE_OUTLINE")!;
  assert.ok(outline, "DXF must contain a PIECE_OUTLINE polyline");
  const outlineXs = outline.points.map((point) => point.x);
  const outlineYs = outline.points.map((point) => point.y);
  assert.equal(Math.min(...outlineXs), 0);
  assert.equal(Math.max(...outlineXs), 1000);
  assert.equal(Math.min(...outlineYs), model.pieces[0].offsetY, "piece offsetY is the DXF-space origin for this piece");
  assert.equal(Math.max(...outlineYs), model.pieces[0].offsetY + 600);

  const cutout = entities.find((entity) => entity.type === "LWPOLYLINE" && entity.layer === "BASIN_HOLES")!;
  assert.ok(cutout, "DXF must contain a BASIN_HOLES polyline for a known-dimension basin");
  const cutoutXs = cutout.points.map((point) => point.x);
  const cutoutYs = cutout.points.map((point) => point.y);
  assert.equal(Math.min(...cutoutXs), 200);
  assert.equal(Math.max(...cutoutXs), 500, "200 + 300 = 500");
  assert.equal(Math.min(...cutoutYs), model.pieces[0].offsetY + 150);
  assert.equal(Math.max(...cutoutYs), model.pieces[0].offsetY + 350, "150 + 200 = 350");
});

test("audit 4: stacked pieces in the DXF never overlap and each piece's own coordinates stay canvas-relative within its own band", () => {
  const state = stateFor([
    piece([rectangle("p1-sheet", { widthMm: 1000, lengthMm: 600 })]),
    { ...piece([rectangle("p2-sheet", { widthMm: 800, lengthMm: 500 })]), id: "piece-2" },
  ]);
  const model = createStudioExportModel(state);
  assert.equal(model.pieces[0].offsetY, 0, "first piece is never shifted");
  assert.ok(model.pieces[1].offsetY >= model.pieces[0].bounds.heightMm, "second piece must start at or after the first piece's bottom edge (no overlap)");
  // Within its own band, the second piece's rectangle keeps its own raw canvas xMm/yMm (0,0), independent of offsetY.
  assert.equal(model.pieces[1].rectangles[0].xMm, 0);
  assert.equal(model.pieces[1].rectangles[0].yMm, 0);
});

test("audit 4: the generated SVG rect coordinates for the piece outline and the basin cutout match the export model exactly", () => {
  const sheet = rectangle("sheet-1", { widthMm: 1000, lengthMm: 600, xMm: 50, yMm: 25 });
  const placement = basin({ sheetId: "sheet-1", xMm: 250, yMm: 175, widthMm: 300, depthMm: 200 });
  const state = stateFor([piece([sheet])], [placement]);
  const model = createStudioExportModel(state);
  const svg = createStudioPngSvg(state);

  const rectMatches = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) }));

  const exportedRect = model.pieces[0].rectangles[0];
  assert.ok(
    rectMatches.some((rect) => rect.x === exportedRect.xMm && rect.y === exportedRect.yMm && rect.width === exportedRect.widthMm && rect.height === exportedRect.heightMm),
    "SVG must contain a <rect> at the exact model coordinates for the piece outline",
  );

  const exportedBasin = model.basins[0];
  assert.ok(
    rectMatches.some((rect) => rect.x === exportedBasin.xMm && rect.y === exportedBasin.yMm && rect.width === exportedBasin.widthMm && rect.height === exportedBasin.heightMm),
    "SVG must contain a <rect> at the exact model coordinates for the basin cutout",
  );
});

type DxfEntity = { type: string; layer: string; points: Array<{ x: number; y: number }> };

/** Minimal DXF group-code reader: enough to recover LINE/LWPOLYLINE/TEXT entity points for assertions. */
function parseDxfEntities(dxf: string): DxfEntity[] {
  const lines = dxf.split("\n");
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i], lines[i + 1]]);

  const entities: DxfEntity[] = [];
  let current: DxfEntity | null = null;
  let pendingX: number | null = null;

  for (const [code, value] of pairs) {
    if (code === "0") {
      if (current) entities.push(current);
      current = value === "LINE" || value === "LWPOLYLINE" || value === "TEXT" ? { type: value, layer: "", points: [] } : null;
      pendingX = null;
      continue;
    }
    if (!current) continue;
    if (code === "8") current.layer = value;
    if (code === "10" || code === "11") pendingX = Number(value);
    if ((code === "20" || code === "21") && pendingX !== null) {
      current.points.push({ x: pendingX, y: Number(value) });
      pendingX = null;
    }
  }
  if (current) entities.push(current);
  return entities;
}
