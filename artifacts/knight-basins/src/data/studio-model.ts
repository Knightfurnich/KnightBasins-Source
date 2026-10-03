import {
  INSTALLATION_PRICE,
  PRODUCTS,
  STONE_COLORS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  STONE_SHEET_SIZE,
  stoneColorByName,
  stoneInstalledUnitPrice,
  type BasinProduct,
  type StoneColor,
} from "./catalog.ts";

export type StudioOrderMode = "quick-purchase" | "studio" | "sketch";
/** Kept for reading old I/L/U quote snapshots only. New Studio layouts use rectangles. */
export type CounterShape = "I" | "L" | "U";
export type StudioLocation = "bangkok-metro" | "province";
export type StudioQuoteFormat = "US" | "OF";
export type SideStatus = "upstand" | "open-edge" | "wall-flush" | "wall-flush+upstand" | "closed-edge" | "normal";
export type StudioSide = "top" | "right" | "bottom" | "left";
export type RectangleRotation = 0 | 90;
export type BasinOrientation = "horizontal" | "vertical";
export type BasinAnchor = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export type StudioDimensions = {
  depthMm: number;
  runAMm: number;
  runBMm: number;
  runCMm: number;
};

export type StudioAttachmentEdge = "left" | "right" | "top" | "bottom";
export type StudioAttachmentAlign = "start" | "center" | "end";
export type StudioAttachment = {
  rectangleId: string;
  edge: StudioAttachmentEdge;
  align?: StudioAttachmentAlign;
};

export type StudioRectangle = {
  id: string;
  widthMm: number;
  lengthMm: number;
  xMm: number;
  yMm: number;
  rotation: RectangleRotation;
  label?: string;
  /**
   * Declarative alternative to hand-placing xMm/yMm: reflowStudioRectangles derives this
   * rectangle's position from the named parent rectangle every time either one is resized.
   * xMm/yMm remain the source of truth for rendering/export; attachTo only drives the solver.
   */
  attachTo?: StudioAttachment;
};

export type StudioPreset = "i" | "l-left" | "l-right" | "u";

export type StudioPiece = {
  id: string;
  name: string;
  rectangles: StudioRectangle[];
  sideStatuses: Record<string, SideStatus>;
  preset?: StudioPreset;
  /** Explicit X/Y edits or drags opt this piece out of legacy preset reflow heuristics. */
  manualLayout?: boolean;
  /** Set once the customer has edited an edge finish by hand; guards against auto-reset defaults overwriting their choice. */
  hasCustomEdges?: boolean;
};

export type BacksplashConfig = {
  enabled: boolean;
  heightMm: number;
};

export type BasinPlacement = {
  id: string;
  sku: string;
  pieceId?: string;
  /** rectangleId of the target sheet/panel within the piece that edge offsets are measured from. */
  sheetId?: string;
  anchor?: BasinAnchor;
  offsetXMm?: number;
  offsetYMm?: number;
  rotation?: RectangleRotation;
  xMm: number;
  yMm: number;
  widthMm: number | null;
  depthMm: number | null;
  /** Optional for backwards compatibility with saved drafts created before basin orientation existed. */
  orientation?: BasinOrientation;
};

export type StudioBasinCatalogEntry = {
  sku: string;
  product?: BasinProduct;
  placementCount: number;
};

export type StudioCatalogItemSnapshot = {
  sku: string;
  colorName?: string;
  priceTHB?: number;
  category?: string;
  dimensions?: string;
  basinDimensions?: string;
};

export type StudioCatalogContext = {
  savedAt: string;
  revision: string;
  basinItems: StudioCatalogItemSnapshot[];
  resolvedSkus?: string[];
};

export type StudioCatalogChange = {
  sku: string;
  kind: "removed" | "updated";
  saved: StudioCatalogItemSnapshot;
  current?: StudioCatalogItemSnapshot;
  changedFields: StudioCatalogField[];
};

export type StudioCatalogField = "colorName" | "priceTHB" | "category" | "dimensions" | "basinDimensions";

export type StudioCatalogComparison = {
  catalogUpdated: boolean;
  changes: StudioCatalogChange[];
  resolvedChanges: StudioCatalogChange[];
};

export type StudioState = {
  mode: StudioOrderMode;
  /** Legacy fields remain optional at runtime so old saved quotes can render. */
  shape: CounterShape;
  dimensions: StudioDimensions;
  pieces?: StudioPiece[];
  activePieceId?: string;
  backsplash: BacksplashConfig;
  upstandHeightMm?: number | null;
  openEdgePricePerMTHB?: number | null;
  discountTHB?: number;
  location: StudioLocation;
  vat: boolean;
  quoteFormat: StudioQuoteFormat;
  stoneColors: string[];
  activeStone: string;
  /** Tracks whether the current stone is an automatic basin-matched default or a customer choice. */
  stoneSelectionSource?: "default" | "user";
  basinSkus: string[];
  basinPlacements: BasinPlacement[];
};

export type StudioEstimate = {
  pieceCount: number;
  rectangleCount: number;
  counterAreaSqM: number;
  backsplashAreaSqM: number;
  upstandAreaSqM: number;
  upstandLengthM: number;
  openEdgeLengthM: number;
  stoneAreaSqM: number;
  stoneUnitPriceTHB: number | null;
  stoneTotalTHB: number;
  upstandTotalTHB: number;
  openEdgeUnitPriceTHB: number | null;
  openEdgeTotalTHB: number;
  basinSubtotalTHB: number;
  installationChargeTHB: number;
  installationDiscountTHB: number;
  discountTHB: number;
  smallJobFeeTHB: number;
  grossSubtotalTHB: number;
  subtotalTHB: number;
  vatAmountTHB: number;
  totalTHB: number;
  standardSheetWarning: boolean;
  standardSheetMessage: string;
  sheetCutPriceWarning: boolean;
  upstandHeightMissing: boolean;
  openEdgePriceMissing: boolean;
  openEdgePriceInvalid: boolean;
  upstandHeightInvalid: boolean;
  basinOverlapWarnings: string[];
  inactiveBasinSkus: string[];
  overlapWarnings: string[];
  unsafePlacements: string[];
  crossJointPlacements: string[];
  unknownDimensionPlacements: string[];
  disconnectedRectangles: string[];
  discountInvalid: boolean;
  warnings: string[];
  isValid: boolean;
};

export const STUDIO_MAX_PIECES = 3;
export const STUDIO_MAX_RECTANGLES = 6;
export const STUDIO_SNAP_DISTANCE_MM = 12;
/** Dimensions used only when a brand-new Studio drawing board is created. */
export const STUDIO_INITIAL_BOARD_WIDTH_MM = 1800;
export const STUDIO_INITIAL_BOARD_LENGTH_MM = 600;
/** Existing continuation-panel defaults used by “add rectangle/piece”. */
export const STUDIO_ADDITIONAL_RECTANGLE_WIDTH_MM = 1800;
export const STUDIO_ADDITIONAL_RECTANGLE_LENGTH_MM = 600;
const STUDIO_EPSILON_MM = 0.01;
/**
 * Minimum clearance a basin cutout must keep from every edge of its stone
 * panel so the cut doesn't crack the slab. This is a fabrication safety
 * margin, distinct from STUDIO_EPSILON_MM (a floating-point tolerance).
 */
export const STUDIO_BASIN_SAFETY_MARGIN_MM = 100;

export interface StudioCounterPreset {
  id: string;
  label: string;
  widthMm: number;
  depthMm: number;
}

/** Quick-pick counter run lengths offered next to the freeform width input. */
export const STUDIO_COUNTER_PRESETS: ReadonlyArray<StudioCounterPreset> = [
  { id: "1200", label: "1.20 ม.", widthMm: 1200, depthMm: 600 },
  { id: "1500", label: "1.50 ม.", widthMm: 1500, depthMm: 600 },
  { id: "1800", label: "1.80 ม.", widthMm: 1800, depthMm: 600 },
  { id: "2000", label: "2.00 ม.", widthMm: 2000, depthMm: 600 },
];

export function studioDefaultStoneCode(
  basinSkus: ReadonlyArray<string>,
  basinProducts: ReadonlyArray<BasinProduct>,
  stoneColors: ReadonlyArray<StoneColor> = STONE_COLORS,
) {
  const firstBasin = basinSkus
    .map((sku) => basinProducts.find((product) => product.sku === sku))
    .find((product): product is BasinProduct => Boolean(product));
  return stoneColorByName(firstBasin?.colorCode ?? "", stoneColors).code;
}

export type CounterRegion = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type StudioRectangleSize = {
  widthMm: number;
  heightMm: number;
};

export type StudioEdge = {
  pieceId: string;
  rectangleId: string;
  side: "top" | "right" | "bottom" | "left";
  key: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  lengthMm: number;
  exposedLengthMm: number;
  status: SideStatus;
};

export type StudioEdgeJoint = {
  first: StudioEdge;
  second: StudioEdge;
  lengthMm: number;
};

export function sideStatusKey(rectangleId: string, side: StudioEdge["side"]) {
  return `${rectangleId}:${side}`;
}

export function studioRectangleSize(rectangle: StudioRectangle): StudioRectangleSize {
  return rectangle.rotation === 90
    ? { widthMm: rectangle.lengthMm, heightMm: rectangle.widthMm }
    : { widthMm: rectangle.widthMm, heightMm: rectangle.lengthMm };
}

export function studioRectangleAreaSqM(rectangle: Pick<StudioRectangle, "widthMm" | "lengthMm">) {
  return Math.max(0, rectangle.widthMm) * Math.max(0, rectangle.lengthMm) / 1_000_000;
}

export function pieceBounds(piece: StudioPiece) {
  return piece.rectangles.reduce((bounds, rectangle) => {
    const size = studioRectangleSize(rectangle);
    return {
      widthMm: Math.max(bounds.widthMm, rectangle.xMm + size.widthMm),
      heightMm: Math.max(bounds.heightMm, rectangle.yMm + size.heightMm),
    };
  }, { widthMm: 1, heightMm: 1 });
}

export function studioPieceAreaSqM(piece: StudioPiece) {
  return piece.rectangles.reduce((sum, rectangle) => sum + studioRectangleAreaSqM(rectangle), 0);
}

export function studioAreaSqM(pieces: StudioPiece[]) {
  return pieces.reduce((sum, piece) => sum + studioPieceAreaSqM(piece), 0);
}

export function rectangleOverlaps(first: StudioRectangle, second: StudioRectangle) {
  const a = studioRectangleSize(first);
  const b = studioRectangleSize(second);
  const overlapWidth = Math.min(first.xMm + a.widthMm, second.xMm + b.widthMm) - Math.max(first.xMm, second.xMm);
  const overlapHeight = Math.min(first.yMm + a.heightMm, second.yMm + b.heightMm) - Math.max(first.yMm, second.yMm);
  return overlapWidth > STUDIO_EPSILON_MM && overlapHeight > STUDIO_EPSILON_MM;
}

export function pieceOverlapWarnings(piece: StudioPiece) {
  const warnings: string[] = [];
  for (let firstIndex = 0; firstIndex < piece.rectangles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < piece.rectangles.length; secondIndex += 1) {
      const first = piece.rectangles[firstIndex];
      const second = piece.rectangles[secondIndex];
      if (rectangleOverlaps(first, second)) warnings.push(`${first.id}:${second.id}`);
    }
  }
  return warnings;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function rawRectangleEdges(piece: StudioPiece, rectangle: StudioRectangle): StudioEdge[] {
  const size = studioRectangleSize(rectangle);
  const x = rectangle.xMm;
  const y = rectangle.yMm;
  const status = (side: StudioEdge["side"]) => piece.sideStatuses[sideStatusKey(rectangle.id, side)] ?? "normal";
  return [
    { pieceId: piece.id, rectangleId: rectangle.id, side: "top", key: sideStatusKey(rectangle.id, "top"), start: { xMm: x, yMm: y }, end: { xMm: x + size.widthMm, yMm: y }, lengthMm: size.widthMm, exposedLengthMm: size.widthMm, status: status("top") },
    { pieceId: piece.id, rectangleId: rectangle.id, side: "right", key: sideStatusKey(rectangle.id, "right"), start: { xMm: x + size.widthMm, yMm: y }, end: { xMm: x + size.widthMm, yMm: y + size.heightMm }, lengthMm: size.heightMm, exposedLengthMm: size.heightMm, status: status("right") },
    { pieceId: piece.id, rectangleId: rectangle.id, side: "bottom", key: sideStatusKey(rectangle.id, "bottom"), start: { xMm: x, yMm: y + size.heightMm }, end: { xMm: x + size.widthMm, yMm: y + size.heightMm }, lengthMm: size.widthMm, exposedLengthMm: size.widthMm, status: status("bottom") },
    { pieceId: piece.id, rectangleId: rectangle.id, side: "left", key: sideStatusKey(rectangle.id, "left"), start: { xMm: x, yMm: y }, end: { xMm: x, yMm: y + size.heightMm }, lengthMm: size.heightMm, exposedLengthMm: size.heightMm, status: status("left") },
  ];
}

function opposingSides(first: StudioEdge, second: StudioEdge) {
  return (first.side === "left" && second.side === "right") ||
    (first.side === "right" && second.side === "left") ||
    (first.side === "top" && second.side === "bottom") ||
    (first.side === "bottom" && second.side === "top");
}

function sharedLength(first: StudioEdge, second: StudioEdge) {
  if (!opposingSides(first, second)) return 0;
  if (first.side === "left" || first.side === "right") {
    if (Math.abs(first.start.xMm - second.start.xMm) > STUDIO_EPSILON_MM) return 0;
    return rangesOverlap(first.start.yMm, first.end.yMm, second.start.yMm, second.end.yMm);
  }
  if (Math.abs(first.start.yMm - second.start.yMm) > STUDIO_EPSILON_MM) return 0;
  return rangesOverlap(first.start.xMm, first.end.xMm, second.start.xMm, second.end.xMm);
}

export function studioPieceEdges(piece: StudioPiece) {
  const edges = piece.rectangles.flatMap((rectangle) => rawRectangleEdges(piece, rectangle));
  return edges.map((edge) => ({
    ...edge,
    exposedLengthMm: Math.max(0, edge.lengthMm - edges.reduce((sum, other) => sum + (other.rectangleId === edge.rectangleId ? 0 : sharedLength(edge, other)), 0)),
  }));
}

export function studioPieceJoints(piece: StudioPiece): StudioEdgeJoint[] {
  const edges = studioPieceEdges(piece);
  const joints: StudioEdgeJoint[] = [];
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const lengthMm = sharedLength(edges[firstIndex], edges[secondIndex]);
      if (lengthMm > STUDIO_EPSILON_MM) joints.push({ first: edges[firstIndex], second: edges[secondIndex], lengthMm });
    }
  }
  return joints;
}

function rectangleIntersectionArea(
  first: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  second: { xMm: number; yMm: number; widthMm: number; heightMm: number },
) {
  const width = Math.min(first.xMm + first.widthMm, second.xMm + second.widthMm) - Math.max(first.xMm, second.xMm);
  const height = Math.min(first.yMm + first.heightMm, second.yMm + second.heightMm) - Math.max(first.yMm, second.yMm);
  return width > STUDIO_EPSILON_MM && height > STUDIO_EPSILON_MM ? width * height : 0;
}

export function studioPieceConnectivity(piece: StudioPiece) {
  const connected = new Map<string, Set<string>>();
  piece.rectangles.forEach((rectangle) => connected.set(rectangle.id, new Set([rectangle.id])));
  studioPieceJoints(piece).forEach((joint) => {
    const first = connected.get(joint.first.rectangleId);
    const second = connected.get(joint.second.rectangleId);
    if (!first || !second) return;
    const merged = new Set([...first, ...second]);
    merged.forEach((rectangleId) => connected.set(rectangleId, merged));
  });
  const components: string[][] = [];
  const seen = new Set<string>();
  piece.rectangles.forEach((rectangle) => {
    if (seen.has(rectangle.id)) return;
    const component = [...(connected.get(rectangle.id) ?? [rectangle.id])];
    component.forEach((rectangleId) => seen.add(rectangleId));
    components.push(component);
  });
  return components;
}

export function disconnectedRectangleIds(piece: StudioPiece) {
  const components = studioPieceConnectivity(piece);
  if (components.length <= 1) return [];
  const connectedToFirst = new Set(components[0]);
  return piece.rectangles
    .map((rectangle) => rectangle.id)
    .filter((rectangleId) => !connectedToFirst.has(rectangleId));
}

export function studioEdgeTotals(pieces: StudioPiece[]) {
  return pieces.flatMap(studioPieceEdges).reduce((totals, edge) => {
    // wall-flush+upstand still gets a physical upstand strip installed against
    // the wall, so it counts toward Upstand Length the same as a plain upstand.
    if (edge.status === "upstand" || edge.status === "wall-flush+upstand") totals.upstandLengthMm += edge.exposedLengthMm;
    if (edge.status === "open-edge") totals.openEdgeLengthMm += edge.exposedLengthMm;
    return totals;
  }, { upstandLengthMm: 0, openEdgeLengthMm: 0 });
}

export function studioSideStatusLabel(status: SideStatus) {
  return {
    upstand: "ติดบัว",
    "open-edge": "ขอบเปิด",
    "wall-flush": "ชิดผนัง",
    "wall-flush+upstand": "ชิดผนัง+ติดบัว ║▲",
    "closed-edge": "ขอบปิด ⊞",
    normal: "ปกติ",
  }[status];
}

/**
 * Directly sets one rectangle edge's finish status (immutable update).
 * A joint between two rectangles (exposedLengthMm === 0) can never carry a finish
 * status — it isn't exposed to the room, so charging or marking it would be wrong —
 * so the piece is returned unchanged when the target edge is a joint.
 * Marks the piece hasCustomEdges so later shape changes preserve this choice
 * instead of resetting it back to the auto-mapped default.
 */
export function setStudioEdgeStatus(piece: StudioPiece, rectangleId: string, side: StudioSide, status: SideStatus): StudioPiece {
  const edge = studioPieceEdges(piece).find((candidate) => candidate.rectangleId === rectangleId && candidate.side === side);
  if (edge && edge.exposedLengthMm <= STUDIO_EPSILON_MM) return piece;
  return {
    ...piece,
    hasCustomEdges: true,
    sideStatuses: { ...piece.sideStatuses, [sideStatusKey(rectangleId, side)]: status },
  };
}

/** Resets one rectangle edge back to "normal" (no upstand/open-edge/wall-flush). */
export function clearStudioEdgeStatus(piece: StudioPiece, rectangleId: string, side: StudioSide): StudioPiece {
  return setStudioEdgeStatus(piece, rectangleId, side, "normal");
}

/** True once the customer has edited at least one edge finish by hand. */
export function isStudioPieceCustomized(piece: StudioPiece): boolean {
  return piece.hasCustomEdges === true;
}

/**
 * Carries a customer's hand-edited edge finishes across a shape/dimension change
 * instead of letting the auto-mapped defaults silently overwrite them.
 * Edge statuses are matched by rectangle id (stable across resizes for a given
 * preset — e.g. "legacy-a"/"legacy-b"/"legacy-c") and side, so a status only
 * carries over onto a rectangle that still exists in the new shape.
 * When the previous piece was never customized, the new piece's own auto-mapped
 * defaults are left untouched.
 */
export function preserveCustomEdgesOnShapeChange(previousPiece: StudioPiece, nextPiece: StudioPiece): StudioPiece {
  if (!isStudioPieceCustomized(previousPiece)) return nextPiece;
  const nextRectangleIds = new Set(nextPiece.rectangles.map((rectangle) => rectangle.id));
  const sideStatuses = { ...nextPiece.sideStatuses };
  for (const [key, status] of Object.entries(previousPiece.sideStatuses)) {
    const separator = key.lastIndexOf(":");
    const rectangleId = separator < 0 ? key : key.slice(0, separator);
    if (nextRectangleIds.has(rectangleId)) sideStatuses[key] = status;
  }
  return { ...nextPiece, hasCustomEdges: true, sideStatuses };
}

export type StudioCustomShapePanel = {
  widthMm: number;
  depthMm: number;
  edges: Record<StudioSide, SideStatus>;
};

/**
 * Assembles a StudioPiece from real panel dimensions and per-side edge
 * finishes, for a "build my exact shape" flow instead of starting from a
 * generic preset and resizing it afterward.
 *
 * `panels` supplies one entry per rectangle in build order: 1 for "i", 2 for
 * "l-left"/"l-right" (back run, then leg), 3 for "u" (back run, left leg,
 * right leg). Panel positioning mirrors reflowStudioRectangles' conventions
 * for these same presets (l-left drops its leg from the back run's left
 * edge, l-right from its right edge, u drops both legs and pushes the right
 * one flush with the back run's right edge).
 *
 * Every edge status is applied through setStudioEdgeStatus, so a joint
 * between two panels (exposedLengthMm === 0) is silently left alone even if
 * the caller asked for a finish there -- the same guard Task 66 added, reused
 * rather than re-implemented. hasCustomEdges ends up true because at least
 * one real (non-joint) edge always exists on a piece built this way.
 */
export function buildCustomShapePiece(pieceId: string, shape: StudioPreset, panels: StudioCustomShapePanel[]): StudioPiece {
  const rectangles: StudioRectangle[] = panels.map((panel, index) => ({
    id: `${pieceId}-${index + 1}`,
    widthMm: panel.widthMm,
    lengthMm: panel.depthMm,
    xMm: 0,
    yMm: 0,
    rotation: 0,
  }));

  const backRun = rectangles[0];
  const leftLeg = rectangles[1];
  const rightLeg = rectangles[2];
  if (backRun && leftLeg && (shape === "l-left" || shape === "u")) {
    leftLeg.xMm = backRun.xMm;
    leftLeg.yMm = backRun.yMm + backRun.lengthMm;
  }
  if (backRun && shape === "l-right" && leftLeg) {
    leftLeg.xMm = Math.max(0, backRun.xMm + backRun.widthMm - leftLeg.widthMm);
    leftLeg.yMm = backRun.yMm + backRun.lengthMm;
  }
  if (backRun && leftLeg && rightLeg && shape === "u") {
    rightLeg.xMm = Math.max(backRun.xMm + leftLeg.widthMm, backRun.xMm + backRun.widthMm - rightLeg.widthMm);
    rightLeg.yMm = backRun.yMm + backRun.lengthMm;
  }

  let piece: StudioPiece = {
    id: pieceId,
    name: `ชิ้นงาน ${pieceId}`,
    rectangles,
    sideStatuses: {},
    preset: shape,
  };
  panels.forEach((panel, index) => {
    const rectangleId = rectangles[index]!.id;
    (["top", "right", "bottom", "left"] as const).forEach((side) => {
      piece = setStudioEdgeStatus(piece, rectangleId, side, panel.edges[side]);
    });
  });
  return piece;
}

const STUDIO_EDGE_STATUS_CYCLE: readonly SideStatus[] = ["normal", "upstand", "wall-flush", "wall-flush+upstand", "open-edge"];

/** Advances one status to the next in the fixed cycle the edge-status toggle
 * button steps through: normal -> upstand -> wall-flush -> wall-flush+upstand
 * -> open-edge -> normal. */
export function cycleStudioEdgeStatus(current: SideStatus): SideStatus {
  const index = STUDIO_EDGE_STATUS_CYCLE.indexOf(current);
  const nextIndex = (index + 1) % STUDIO_EDGE_STATUS_CYCLE.length;
  return STUDIO_EDGE_STATUS_CYCLE[nextIndex]!;
}

export function studioSideStatuses(piece: StudioPiece, rectangleId: string) {
  return (["top", "right", "bottom", "left"] as const).map((side) => ({
    side,
    key: sideStatusKey(rectangleId, side),
    label: side === "top" ? "บน" : side === "right" ? "ขวา" : side === "bottom" ? "ล่าง" : "ซ้าย",
    status: piece.sideStatuses[sideStatusKey(rectangleId, side)] ?? "normal",
  }));
}

export function touchingRectangleKeys(piece: StudioPiece, rectangleId: string, side: StudioEdge["side"]) {
  const edge = studioPieceEdges(piece).find((candidate) => candidate.rectangleId === rectangleId && candidate.side === side);
  if (!edge) return [sideStatusKey(rectangleId, side)];
  return studioPieceEdges(piece)
    .filter((candidate) => candidate.key === edge.key || sharedLength(edge, candidate) > STUDIO_EPSILON_MM)
    .map((candidate) => candidate.key);
}

const STUDIO_SIDE_ORDER: readonly StudioSide[] = ["top", "right", "bottom", "left"];

function studioSideLabel(side: StudioSide) {
  return side === "top" ? "บน" : side === "right" ? "ขวา" : side === "bottom" ? "ล่าง" : "ซ้าย";
}

export type StudioEdgeFinishEntry = {
  side: StudioSide;
  sideLabel: string;
  status: SideStatus;
  statusLabel: string;
  lengthMm: number;
};

/**
 * Per-side edge finish list for the factory work order: which side needs an
 * upstand, wall-flush, open edge, or is a plain "normal" edge, and how long.
 * A joint between two rectangles (exposedLengthMm === 0) is never a real edge
 * the workshop needs to finish, so it never appears here. Sorted top / right /
 * bottom / left so the printed sheet reads in a predictable order.
 */
export function studioEdgeFinishBreakdown(piece: StudioPiece): StudioEdgeFinishEntry[] {
  return studioPieceEdges(piece)
    .filter((edge) => edge.exposedLengthMm > STUDIO_EPSILON_MM)
    .map((edge) => ({
      side: edge.side,
      sideLabel: studioSideLabel(edge.side),
      status: edge.status,
      statusLabel: studioSideStatusLabel(edge.status),
      lengthMm: edge.exposedLengthMm,
    }))
    .sort((first, second) => STUDIO_SIDE_ORDER.indexOf(first.side) - STUDIO_SIDE_ORDER.indexOf(second.side));
}

/**
 * One Thai-language line summarizing studioEdgeFinishBreakdown for the factory
 * work order's description field, e.g. "ขอบ: บน ติดบัว 1.50 ม. · ซ้าย ชิดผนัง 0.60 ม."
 * Pure function -- no DOM/React access, safe to call from print/export code too.
 */
export function studioEdgeFinishSummary(piece: StudioPiece): string {
  const breakdown = studioEdgeFinishBreakdown(piece);
  if (breakdown.length === 0) return "";
  const parts = breakdown.map((entry) => `${entry.sideLabel} ${entry.statusLabel} ${(entry.lengthMm / 1000).toFixed(2)} ม.`);
  return `ขอบ: ${parts.join(" · ")}`;
}

export function snapStudioRectanglePosition(piece: StudioPiece, rectangleId: string, xMm: number, yMm: number) {
  const moving = piece.rectangles.find((rectangle) => rectangle.id === rectangleId);
  if (!moving) return { xMm, yMm };
  const movingSize = studioRectangleSize(moving);
  let nextX = xMm;
  let nextY = yMm;
  piece.rectangles.filter((rectangle) => rectangle.id !== rectangleId).forEach((other) => {
    const otherSize = studioRectangleSize(other);
    const xCandidates = [other.xMm - movingSize.widthMm, other.xMm + otherSize.widthMm];
    const yCandidates = [other.yMm - movingSize.heightMm, other.yMm + otherSize.heightMm];
    xCandidates.forEach((candidate) => { if (Math.abs(nextX - candidate) <= STUDIO_SNAP_DISTANCE_MM) nextX = candidate; });
    yCandidates.forEach((candidate) => { if (Math.abs(nextY - candidate) <= STUDIO_SNAP_DISTANCE_MM) nextY = candidate; });
    if (Math.abs(nextX - other.xMm) <= STUDIO_SNAP_DISTANCE_MM) nextX = other.xMm;
    if (Math.abs(nextY - other.yMm) <= STUDIO_SNAP_DISTANCE_MM) nextY = other.yMm;
  });
  return { xMm: Math.max(0, Math.round(nextX)), yMm: Math.max(0, Math.round(nextY)) };
}

export function studioPieces(state: Pick<StudioState, "pieces" | "shape" | "dimensions">): StudioPiece[] {
  if (state.pieces !== undefined) return state.pieces;
  const depth = Math.max(0, state.dimensions.depthMm);
  const runA = Math.max(0, state.dimensions.runAMm);
  const runB = Math.max(0, state.dimensions.runBMm);
  const runC = Math.max(0, state.dimensions.runCMm);
  const legacyRectangles: StudioRectangle[] = [
    { id: "legacy-a", widthMm: runA, lengthMm: depth, xMm: 0, yMm: 0, rotation: 0 },
  ];
  if (state.shape !== "I") legacyRectangles.push({ id: "legacy-b", widthMm: depth, lengthMm: runB, xMm: 0, yMm: 0, rotation: 0 });
  if (state.shape === "U") legacyRectangles.push({ id: "legacy-c", widthMm: depth, lengthMm: runC, xMm: Math.max(0, runA - depth), yMm: 0, rotation: 0 });
  return [{ id: "legacy-piece-1", name: "ชิ้นงาน 1", rectangles: legacyRectangles, sideStatuses: {} }];
}

function mirroredSide(side: StudioEdge["side"]): StudioEdge["side"] {
  if (side === "left") return "right";
  if (side === "right") return "left";
  return side;
}

function mirroredRectangleLabel(label: string | undefined) {
  if (label === "แผ่นซ้าย") return "แผ่นขวา";
  if (label === "แผ่นขวา") return "แผ่นซ้าย";
  return label;
}

function mirroredPieceName(name: string) {
  if (name.includes("ซ้าย")) return name.replaceAll("ซ้าย", "ขวา");
  if (name.includes("ขวา")) return name.replaceAll("ขวา", "ซ้าย");
  return name;
}

function resolveAttachedPosition(
  parent: StudioRectangle,
  child: StudioRectangle,
  attachment: StudioAttachment,
): { xMm: number; yMm: number } {
  const parentSize = studioRectangleSize(parent);
  const childSize = studioRectangleSize(child);
  const align = attachment.align ?? "start";

  if (attachment.edge === "right" || attachment.edge === "left") {
    const xMm = attachment.edge === "right" ? parent.xMm + parentSize.widthMm : parent.xMm - childSize.widthMm;
    const yMm = align === "end"
      ? parent.yMm + parentSize.heightMm - childSize.heightMm
      : align === "center"
        ? parent.yMm + (parentSize.heightMm - childSize.heightMm) / 2
        : parent.yMm;
    return { xMm: Math.round(xMm), yMm: Math.round(yMm) };
  }

  const yMm = attachment.edge === "bottom" ? parent.yMm + parentSize.heightMm : parent.yMm - childSize.heightMm;
  const xMm = align === "end"
    ? parent.xMm + parentSize.widthMm - childSize.widthMm
    : align === "center"
      ? parent.xMm + (parentSize.widthMm - childSize.widthMm) / 2
      : parent.xMm;
  return { xMm: Math.round(xMm), yMm: Math.round(yMm) };
}

/**
 * Resolves every rectangle's position from its attachTo chain (declarative, direction-agnostic).
 * Rectangles without attachTo are roots and pass through unchanged. A parent that cannot be
 * found, or a chain that cycles back on itself, leaves that rectangle at its own xMm/yMm instead
 * of throwing, since a stale attachTo (e.g. pointing at a deleted rectangle) should never crash
 * the studio.
 */
function resolveAttachedRectangles(rectangles: StudioRectangle[]): StudioRectangle[] {
  const byId = new Map(rectangles.map((rectangle) => [rectangle.id, rectangle]));
  const resolved = new Map<string, StudioRectangle>();
  const resolving = new Set<string>();

  function resolve(id: string): StudioRectangle {
    const cached = resolved.get(id);
    if (cached) return cached;
    const rectangle = byId.get(id);
    if (!rectangle) throw new Error(`reflowStudioRectangles: unknown rectangle id "${id}"`);

    if (!rectangle.attachTo || resolving.has(id)) {
      resolved.set(id, rectangle);
      return rectangle;
    }
    const parent = byId.get(rectangle.attachTo.rectangleId);
    if (!parent) {
      resolved.set(id, rectangle);
      return rectangle;
    }
    resolving.add(id);
    const resolvedParent = resolve(parent.id);
    resolving.delete(id);
    const next = { ...rectangle, ...resolveAttachedPosition(resolvedParent, rectangle, rectangle.attachTo) };
    resolved.set(id, next);
    return next;
  }

  return rectangles.map((rectangle) => resolve(rectangle.id));
}

/**
 * Keeps a U / L layout attached while one of its panels is resized.
 *
 * Resizing a panel through the numeric fields only changes that panel's own
 * size, so a right leg used to tear away from the back run and overlap it once
 * its width changed. Panels that sit flush to the piece's right edge are
 * re-anchored to that edge here, and side legs drop to the new bottom of the
 * back run when the back run's depth changes.
 *
 * For U shapes, panel 1 (back run) anchors panel 2 (left leg) to its left edge
 * and panel 3 (right leg) to its right edge. When panel 1's width or depth changes,
 * both legs immediately follow without gaps or overlaps.
 */
export function reflowStudioRectangles(
  before: StudioRectangle[],
  after: StudioRectangle[],
  preset?: StudioPreset,
): StudioRectangle[] {
  if (before.length !== after.length || before.length < 2) return after;

  // Declarative attachments take over the whole reflow for this call; rectangles with no
  // attachTo pass through unchanged. Pieces that never use attachTo (all existing drafts)
  // never reach this branch, so the legacy heuristics below stay 100% unaffected.
  if (after.some((rectangle) => rectangle.attachTo)) {
    return resolveAttachedRectangles(after);
  }

  const widthOf = (rectangle: StudioRectangle) => studioRectangleSize(rectangle).widthMm;
  const heightOf = (rectangle: StudioRectangle) => studioRectangleSize(rectangle).heightMm;

  // 1. Dedicated U-shape geometry reflow
  const isU = preset === "u" || (
    after.length === 3 &&
    (after.some((r) => r.id === "wizard-leg-0") || after.some((r) => r.label?.includes("แผ่นที่ 1") || r.label?.includes("แผ่นหลัก"))) &&
    (after.some((r) => r.id === "wizard-leg-2") || after.some((r) => r.label?.includes("แผ่นที่ 3")))
  );
  if (isU) {
    const backRun = after.find((r) => r.id === "wizard-leg-0" || r.label?.includes("แผ่นที่ 1") || r.label?.includes("แผ่นหลัก") || r.yMm === 0) ?? after[0];
    const leftLeg = after.find((r) => r.id === "wizard-leg-1" || (r.id !== backRun.id && r.xMm === 0)) ?? after[1];
    const rightLeg = after.find((r) => r.id !== backRun.id && r.id !== leftLeg.id) ?? after[2];

    const backWidth = widthOf(backRun);
    const backDepth = heightOf(backRun);
    const leftWidth = widthOf(leftLeg);
    const rightWidth = widthOf(rightLeg);

    return after.map((r) => {
      if (r.id === backRun.id) return r;
      if (r.id === leftLeg.id) {
        return {
          ...r,
          xMm: backRun.xMm,
          yMm: backRun.yMm + backDepth,
        };
      }
      if (r.id === rightLeg.id) {
        return {
          ...r,
          xMm: Math.max(backRun.xMm + leftWidth, backRun.xMm + backWidth - rightWidth),
          yMm: backRun.yMm + backDepth,
        };
      }
      return r;
    });
  }

  // 2. Dedicated L-shape geometry reflow
  const isLLeft = preset === "l-left" || (after.length === 2 && after[1].yMm > 0 && after[1].xMm === 0);
  if (isLLeft) {
    const backRun = after[0];
    const leg = after[1];
    const backDepth = heightOf(backRun);
    return after.map((r) => (r.id === leg.id ? { ...r, xMm: backRun.xMm, yMm: backRun.yMm + backDepth } : r));
  }

  const isLRight = preset === "l-right" || (after.length === 2 && after[1].yMm > 0 && after[1].xMm > 0);
  if (isLRight) {
    const backRun = after[0];
    const leg = after[1];
    const backWidth = widthOf(backRun);
    const backDepth = heightOf(backRun);
    const legWidth = widthOf(leg);
    return after.map((r) => (r.id === leg.id ? { ...r, xMm: Math.max(0, backRun.xMm + backWidth - legWidth), yMm: backRun.yMm + backDepth } : r));
  }

  // 3. General fallback for custom shapes
  const rightEdgeOf = (rectangles: StudioRectangle[]) =>
    rectangles.reduce((edge, rectangle) => Math.max(edge, rectangle.xMm + widthOf(rectangle)), 0);
  const topEdge = before.reduce((min, rectangle) => Math.min(min, rectangle.yMm), Number.POSITIVE_INFINITY);
  const backRun = before.filter((rectangle) => Math.abs(rectangle.yMm - topEdge) <= STUDIO_EPSILON_MM);
  const legs = before.filter((rectangle) => rectangle.yMm > topEdge + STUDIO_EPSILON_MM);
  if (backRun.length !== 1 || legs.length === 0) return after;

  const beforeRightEdge = rightEdgeOf(before);
  const rightAnchored = new Set(legs
    .filter((leg) => leg.xMm > STUDIO_EPSILON_MM && Math.abs(leg.xMm + widthOf(leg) - beforeRightEdge) <= STUDIO_EPSILON_MM)
    .map((leg) => leg.id));
  const beforeBackRunBottom = backRun[0].yMm + heightOf(backRun[0]);
  const afterBackRun = after.find((rectangle) => rectangle.id === backRun[0].id);
  const afterBackRunBottom = afterBackRun ? afterBackRun.yMm + heightOf(afterBackRun) : beforeBackRunBottom;
  const backRunDepthChanged = Math.abs(beforeBackRunBottom - afterBackRunBottom) > STUDIO_EPSILON_MM;
  const dropAnchored = new Set(legs
    .filter((leg) => Math.abs(leg.yMm - beforeBackRunBottom) <= STUDIO_EPSILON_MM)
    .map((leg) => leg.id));

  if (rightAnchored.size === 0 && !backRunDepthChanged) return after;

  const rightEdge = rightEdgeOf(after.filter((rectangle) => !rightAnchored.has(rectangle.id)));
  return after.map((rectangle) => {
    let next = rectangle;
    if (rightAnchored.has(rectangle.id)) next = { ...next, xMm: Math.max(0, rightEdge - widthOf(next)) };
    if (backRunDepthChanged && dropAnchored.has(rectangle.id)) next = { ...next, yMm: afterBackRunBottom };
    return next;
  });
}

/**
 * Mirror the shared rectangle model horizontally. This is intentionally
 * geometry-level so the canvas, edge totals, basin safety, and exports all
 * observe the same L layout after switching sides.
 */
export function mirrorStudioPiece(piece: StudioPiece): StudioPiece {
  const bounds = pieceBounds(piece);
  const rectangles = piece.rectangles.map((rectangle) => {
    const size = studioRectangleSize(rectangle);
    return {
      ...rectangle,
      xMm: Math.max(0, bounds.widthMm - rectangle.xMm - size.widthMm),
      label: mirroredRectangleLabel(rectangle.label),
    };
  });
  const sideStatuses = Object.fromEntries(
    Object.entries(piece.sideStatuses).map(([key, status]) => {
      const separator = key.lastIndexOf(":");
      if (separator < 0) return [key, status];
      const rectangleId = key.slice(0, separator);
      const side = key.slice(separator + 1) as StudioEdge["side"];
      return [sideStatusKey(rectangleId, mirroredSide(side)), status];
    }),
  );
  return { ...piece, name: mirroredPieceName(piece.name), rectangles, sideStatuses };
}

export function mirrorStudioLState(state: StudioState): StudioState {
  if (state.shape !== "L" || !state.pieces?.length) return state;
  const piece = state.pieces[0];
  const bounds = pieceBounds(piece);
  return {
    ...state,
    pieces: [mirrorStudioPiece(piece), ...state.pieces.slice(1)],
    basinPlacements: state.basinPlacements.map((placement) => {
      if ((placement.pieceId ?? piece.id) !== piece.id) return placement;
       const widthMm = placementCutSize(placement).widthMm ?? 0;
      return {
        ...placement,
        xMm: Math.max(0, Math.round(bounds.widthMm - placement.xMm - widthMm)),
      };
    }),
  };
}

export function studioPieceById(state: Pick<StudioState, "pieces" | "shape" | "dimensions">, pieceId?: string) {
  const pieces = studioPieces(state);
  return pieces.find((piece) => piece.id === pieceId) ?? pieces[0];
}

export function studioStateDimensionsValid(state: Pick<StudioState, "pieces" | "shape" | "dimensions">) {
  const pieces = studioPieces(state);
  return pieces.length >= 1 &&
    pieces.length <= STUDIO_MAX_PIECES &&
    pieces.every((piece) =>
      piece.rectangles.length >= 1 &&
      piece.rectangles.length <= STUDIO_MAX_RECTANGLES &&
      piece.rectangles.every((rectangle) =>
        Number.isFinite(rectangle.widthMm) &&
        Number.isFinite(rectangle.lengthMm) &&
        rectangle.widthMm > 0 &&
        rectangle.lengthMm > 0 &&
        Number.isFinite(rectangle.xMm) &&
        Number.isFinite(rectangle.yMm) &&
        rectangle.xMm >= 0 &&
        rectangle.yMm >= 0,
      ),
    ) &&
    (state.pieces === undefined || !pieces.some((piece) => disconnectedRectangleIds(piece).length > 0));
}

export function basinDimensionsForProduct(product?: BasinProduct) {
  const values = product?.basinDimensions?.match(/\d+/g)?.map(Number) ?? [];
  return { widthMm: values[0] ?? null, depthMm: values[1] ?? null };
}

export function basinPlacementOrientation(placement: Pick<BasinPlacement, "orientation" | "rotation">): BasinOrientation {
  return placement.orientation ?? (placement.rotation === 90 ? "vertical" : "horizontal");
}

export function basinPlacementDimensions(
  dimensions: Pick<BasinPlacement, "widthMm" | "depthMm">,
  orientation: BasinOrientation = "horizontal",
) {
  if (orientation === "vertical") {
    return { widthMm: dimensions.depthMm, depthMm: dimensions.widthMm };
  }
  return { widthMm: dimensions.widthMm, depthMm: dimensions.depthMm };
}

export function setBasinPlacementOrientation(
  placement: BasinPlacement,
  orientation: BasinOrientation,
): BasinPlacement {
  const current = basinPlacementOrientation(placement);
  const dimensions = current === orientation
    ? { widthMm: placement.widthMm, depthMm: placement.depthMm }
    : basinPlacementDimensions(placement, "vertical");
  return { ...placement, ...dimensions, orientation, rotation: orientation === "vertical" ? 90 : 0 };
}

export function studioBasinCatalogEntries(state: Pick<StudioState, "basinSkus" | "basinPlacements">, products: ReadonlyArray<BasinProduct>): StudioBasinCatalogEntry[] {
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  return state.basinSkus.map((sku) => ({
    sku,
    product: productsBySku.get(sku),
    placementCount: state.basinPlacements.filter((placement) => placement.sku === sku).length,
  }));
}

function studioCatalogItemSnapshot(product: BasinProduct): StudioCatalogItemSnapshot {
  return {
    sku: product.sku,
    colorName: product.colorName,
    priceTHB: product.priceTHB,
    category: product.category,
    dimensions: product.dimensions,
    basinDimensions: product.basinDimensions,
  };
}

function studioCatalogFingerprint(products: ReadonlyArray<BasinProduct>) {
  const source = [...products]
    .sort((first, second) => first.sku.localeCompare(second.sku))
    .map((product) => JSON.stringify(studioCatalogItemSnapshot(product)))
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `basins-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function studioCatalogRevision(products: ReadonlyArray<BasinProduct>) {
  return studioCatalogFingerprint(products);
}

export function createStudioCatalogContext(
  state: Pick<StudioState, "basinSkus">,
  products: ReadonlyArray<BasinProduct>,
  savedAt = new Date().toISOString(),
): StudioCatalogContext {
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  return {
    savedAt,
    revision: studioCatalogFingerprint(products),
    basinItems: state.basinSkus.map((sku) => {
      const product = productsBySku.get(sku);
      return product ? studioCatalogItemSnapshot(product) : { sku };
    }),
  };
}

export function compareStudioCatalog(
  context: StudioCatalogContext,
  products: ReadonlyArray<BasinProduct>,
): StudioCatalogComparison {
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const resolvedSkus = new Set(context.resolvedSkus ?? []);
  const allChanges: StudioCatalogChange[] = context.basinItems.flatMap<StudioCatalogChange>((saved) => {
    const product = productsBySku.get(saved.sku);
    if (!product) return [{ sku: saved.sku, kind: "removed" as const, saved, changedFields: [] }];
    const current = studioCatalogItemSnapshot(product);
    const changedFields = (["colorName", "priceTHB", "category", "dimensions", "basinDimensions"] as StudioCatalogField[])
      .filter((field) => saved[field] !== current[field]);
    return changedFields.length === 0
      ? []
      : [{ sku: saved.sku, kind: "updated" as const, saved, current, changedFields }];
  });
  return {
    catalogUpdated: context.revision !== studioCatalogFingerprint(products),
    changes: allChanges.filter((change) => !resolvedSkus.has(change.sku)),
    resolvedChanges: allChanges.filter((change) => resolvedSkus.has(change.sku)),
  };
}

export function resolveStudioCatalogChange(context: StudioCatalogContext, sku: string): StudioCatalogContext {
  if (!context.basinItems.some((item) => item.sku === sku)) return context;
  return {
    ...context,
    resolvedSkus: [...new Set([...(context.resolvedSkus ?? []), sku])],
  };
}

export function replaceStudioBasin(state: StudioState, previousSku: string, product: BasinProduct): StudioState {
  const size = basinDimensionsForProduct(product);
  return {
    ...state,
    basinSkus: state.basinSkus.map((sku) => sku === previousSku ? product.sku : sku),
    basinPlacements: state.basinPlacements.map((placement) => placement.sku === previousSku
      ? {
        ...placement,
        sku: product.sku,
        ...basinPlacementDimensions(size, basinPlacementOrientation(placement)),
        orientation: basinPlacementOrientation(placement),
      }
      : placement),
  };
}

export function removeStudioBasin(state: StudioState, sku: string): StudioState {
  return {
    ...state,
    basinSkus: state.basinSkus.filter((item) => item !== sku),
    basinPlacements: state.basinPlacements.filter((placement) => placement.sku !== sku),
  };
}

function placementFitsRectangle(
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotation" | "orientation">,
  rectangle: StudioRectangle,
) {
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null) return true;
  const size = studioRectangleSize(rectangle);
  return placement.xMm >= rectangle.xMm - STUDIO_EPSILON_MM &&
    placement.yMm >= rectangle.yMm - STUDIO_EPSILON_MM &&
    placement.xMm + cutSize.widthMm <= rectangle.xMm + size.widthMm + STUDIO_EPSILON_MM &&
    placement.yMm + cutSize.heightMm <= rectangle.yMm + size.heightMm + STUDIO_EPSILON_MM;
}

export function placementFitsStudioPiece(
  piece: StudioPiece,
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotation" | "orientation">,
) {
  return piece.rectangles.some((rectangle) => placementFitsRectangle(placement, rectangle));
}

function placementHostRectangle(
  piece: StudioPiece,
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "xMm" | "yMm" | "rotation" | "orientation">,
) {
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null) return piece.rectangles[0];
  const placementWidth = cutSize.widthMm;
  const placementDepth = cutSize.heightMm;
  return piece.rectangles.find((rectangle) => placementFitsRectangle(placement, rectangle))
    ?? piece.rectangles.reduce((best, rectangle) => {
      const bestSize = studioRectangleSize(best);
      const size = studioRectangleSize(rectangle);
      const bestScore = Math.min(bestSize.widthMm - placementWidth, bestSize.heightMm - placementDepth);
      const score = Math.min(size.widthMm - placementWidth, size.heightMm - placementDepth);
      return score > bestScore ? rectangle : best;
    }, piece.rectangles[0]);
}

function clampPlacementAxis(start: number, available: number, size: number, center: number) {
  if (size >= available) return start;
  return Math.max(start, Math.min(start + available - size, center));
}

export function centerBasinPlacementPosition(
  piece: StudioPiece,
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "xMm" | "yMm" | "rotation" | "orientation">,
) {
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null || !piece.rectangles.length) {
    return { xMm: placement.xMm, yMm: placement.yMm };
  }
  const rectangle = placementHostRectangle(piece, placement);
  const size = studioRectangleSize(rectangle);
  return {
    xMm: Math.round(clampPlacementAxis(rectangle.xMm, size.widthMm, cutSize.widthMm, rectangle.xMm + (size.widthMm - cutSize.widthMm) / 2)),
    yMm: Math.round(clampPlacementAxis(rectangle.yMm, size.heightMm, cutSize.heightMm, rectangle.yMm + (size.heightMm - cutSize.heightMm) / 2)),
  };
}

export function distributeBasinPlacementPositions(
  piece: StudioPiece,
  placements: Array<Pick<BasinPlacement, "id" | "widthMm" | "depthMm" | "xMm" | "yMm" | "rotation" | "orientation">>,
) {
  if (placements.length !== 2 || !piece.rectangles.length || placements.some((placement) => placementCutSize(placement).widthMm === null || placementCutSize(placement).heightMm === null)) {
    return placements.map((placement) => ({ id: placement.id, xMm: placement.xMm, yMm: placement.yMm }));
  }
  const first = placements[0];
  const second = placements[1];
  const firstSize = placementCutSize(first);
  const secondSize = placementCutSize(second);
  const host = piece.rectangles.find((rectangle) => {
    const size = studioRectangleSize(rectangle);
    return (firstSize.widthMm ?? 0) + (secondSize.widthMm ?? 0) <= size.widthMm &&
      Math.max(firstSize.heightMm ?? 0, secondSize.heightMm ?? 0) <= size.heightMm;
  }) ?? placementHostRectangle(piece, first);
  const size = studioRectangleSize(host);
  const totalWidth = (firstSize.widthMm ?? 0) + (secondSize.widthMm ?? 0);
  const gap = Math.max(0, Math.round((size.widthMm - totalWidth) / 3));
  const totalHeight = Math.max(firstSize.heightMm ?? 0, secondSize.heightMm ?? 0);
  const yMm = Math.round(host.yMm + Math.max(0, (size.heightMm - totalHeight) / 2));
  return [
    { id: first.id, xMm: Math.round(host.xMm + gap), yMm },
    { id: second.id, xMm: Math.round(host.xMm + gap + (firstSize.widthMm ?? 0) + gap), yMm },
  ];
}

export type PlacementReanchorNotice = {
  placementId: string;
  sku: string;
  /**
   * moved: kept and repositioned inside the new shape.
   * overlap: kept, but still touches another basin.
   * no-fit: too large for any sheet of the new shape (kept, centred on the best sheet).
   */
  kind: "moved" | "overlap" | "no-fit";
};

const REANCHOR_NOTICE_PRIORITY: Record<PlacementReanchorNotice["kind"], number> = { moved: 1, overlap: 2, "no-fit": 3 };

/**
 * Carries the basins of `oldPiece` over to `newPiece` after the counter shape was rebuilt.
 *
 * - A basin is never dropped, whatever the new shape.
 * - A basin whose current position is still valid on a sheet of the new piece (inside it,
 *   with STUDIO_BASIN_SAFETY_MARGIN_MM of clearance) is left exactly where it is. So is a basin
 *   that already broke the clearance before the change, as long as it still sits inside a sheet.
 * - Otherwise it keeps its relative position (where its centre sat as a fraction of its old
 *   sheet) on a sheet that can hold it with the clearance, clamped to that clearance.
 * - Basins that end up touching on the same sheet are spread evenly along its longer side.
 * - A basin that met the clearance before but cannot on any sheet of the new shape is kept,
 *   centred on the roomiest sheet, and reported as "no-fit". Notices only describe what the
 *   shape change did; a basin that was already out of rule is not reported again.
 *
 * Footprints always come from placementCutSize (rotation already applied); width, depth,
 * rotation, orientation, id and sku are never changed. Placements of other pieces are untouched.
 */
export function reanchorPlacementsToPiece(
  placements: ReadonlyArray<BasinPlacement>,
  oldPiece: StudioPiece,
  newPiece: StudioPiece,
  marginMm: number = STUDIO_BASIN_SAFETY_MARGIN_MM,
): { placements: BasinPlacement[]; notices: PlacementReanchorNotice[] } {
  const noticeKinds = new Map<string, PlacementReanchorNotice["kind"]>();
  const notify = (id: string, kind: PlacementReanchorNotice["kind"]) => {
    const existing = noticeKinds.get(id);
    if (!existing || REANCHOR_NOTICE_PRIORITY[kind] > REANCHOR_NOTICE_PRIORITY[existing]) noticeKinds.set(id, kind);
  };
  const withPosition = (placement: BasinPlacement, sheet: StudioRectangle, xMm: number, yMm: number): BasinPlacement => {
    const next: BasinPlacement = { ...placement, sheetId: sheet.id, xMm, yMm };
    if (placement.offsetXMm === undefined || placement.offsetYMm === undefined) return next;
    return { ...next, ...calculateBasinOffsets(sheet, next, { xMm, yMm }, placement.anchor ?? "top-left") };
  };
  const axisPosition = (start: number, length: number, cutLength: number, centreFraction: number) => {
    const low = start + marginMm;
    const high = start + length - cutLength - marginMm;
    if (high < low) return Math.round(start + (length - cutLength) / 2);
    return Math.round(Math.min(high, Math.max(low, start + centreFraction * length - cutLength / 2)));
  };
  const fitsWithMargin = (rectangle: StudioRectangle, cutWidthMm: number, cutHeightMm: number) => {
    const size = studioRectangleSize(rectangle);
    return cutWidthMm + 2 * marginMm <= size.widthMm + STUDIO_EPSILON_MM && cutHeightMm + 2 * marginMm <= size.heightMm + STUDIO_EPSILON_MM;
  };

  const moved = new Map<string, BasinPlacement>();
  const hosts = new Map<string, StudioRectangle>();
  for (const placement of placements) {
    if ((placement.pieceId ?? oldPiece.id) !== oldPiece.id) continue;
    const firstSheet = newPiece.rectangles[0];
    if (!firstSheet) continue;
    const sameIdSheet = newPiece.rectangles.find((rectangle) => rectangle.id === placement.sheetId);
    const cut = placementCutSize(placement);
    if (cut.widthMm === null || cut.heightMm === null) {
      moved.set(placement.id, { ...placement, sheetId: (sameIdSheet ?? firstSheet).id });
      continue;
    }
    const cutWidthMm = cut.widthMm;
    const cutHeightMm = cut.heightMm;

    const oldSheet = oldPiece.rectangles.find((rectangle) => rectangle.id === placement.sheetId)
      ?? placementHostRectangle(oldPiece, placement);
    const oldCoordinates = oldSheet && placement.offsetXMm !== undefined && placement.offsetYMm !== undefined
      ? calculateBasinCoordinates(oldSheet, placement)
      : { xMm: placement.xMm, yMm: placement.yMm };

    // 1. Still fine exactly where it is? Then do not touch it. A basin that already broke the
    //    clearance rule before the change (e.g. a 500 mm deep cut-out on a 600 mm counter) is also
    //    left alone while it still sits inside a sheet: the validation message already covers it
    //    and moving it would not make it compliant.
    const probe = { ...placement, xMm: oldCoordinates.xMm, yMm: oldCoordinates.yMm };
    const validBefore = oldPiece.rectangles.some((rectangle) => placementMeetsBasinEdgeClearance(probe, rectangle, marginMm));
    const stillValidOn = newPiece.rectangles.find((rectangle) => placementFitsRectangle(probe, rectangle)
      && (!validBefore || placementMeetsBasinEdgeClearance(probe, rectangle, marginMm)));
    if (stillValidOn) {
      hosts.set(placement.id, stillValidOn);
      moved.set(placement.id, withPosition(placement, stillValidOn, oldCoordinates.xMm, oldCoordinates.yMm));
      continue;
    }

    // 2. Pick the sheet: its own if it can hold the basin with clearance, else the first that can.
    const candidates = sameIdSheet
      ? [sameIdSheet, ...newPiece.rectangles.filter((rectangle) => rectangle !== sameIdSheet)]
      : newPiece.rectangles;
    const roomy = candidates.find((rectangle) => fitsWithMargin(rectangle, cutWidthMm, cutHeightMm));
    const target = roomy ?? candidates.reduce((best, rectangle) => {
      const bestSize = studioRectangleSize(best);
      const size = studioRectangleSize(rectangle);
      const bestSlack = Math.min(bestSize.widthMm - cutWidthMm, bestSize.heightMm - cutHeightMm);
      return Math.min(size.widthMm - cutWidthMm, size.heightMm - cutHeightMm) > bestSlack ? rectangle : best;
    }, candidates[0]!);

    // 3. Same relative position (centre as a fraction of the old sheet), kept inside the clearance.
    const oldSize = oldSheet ? studioRectangleSize(oldSheet) : null;
    const fraction = (value: number, start: number, length: number | undefined) =>
      length && length > 0 ? Math.min(1, Math.max(0, (value - start) / length)) : 0.5;
    const centreX = fraction(oldCoordinates.xMm + cutWidthMm / 2, oldSheet?.xMm ?? 0, oldSize?.widthMm);
    const centreY = fraction(oldCoordinates.yMm + cutHeightMm / 2, oldSheet?.yMm ?? 0, oldSize?.heightMm);
    const targetSize = studioRectangleSize(target);
    const xMm = axisPosition(target.xMm, targetSize.widthMm, cutWidthMm, centreX);
    const yMm = axisPosition(target.yMm, targetSize.heightMm, cutHeightMm, centreY);

    hosts.set(placement.id, target);
    moved.set(placement.id, withPosition(placement, target, xMm, yMm));
    if (!roomy && validBefore) notify(placement.id, "no-fit");
    else if (target.id !== placement.sheetId || Math.abs(xMm - oldCoordinates.xMm) > 1 || Math.abs(yMm - oldCoordinates.yMm) > 1) notify(placement.id, "moved");
  }

  // 4. Basins that now touch each other on one sheet are spread evenly along the sheet's longer side.
  const bySheet = new Map<string, BasinPlacement[]>();
  for (const [id, placement] of moved) {
    const host = hosts.get(id);
    if (!host) continue;
    bySheet.set(host.id, [...(bySheet.get(host.id) ?? []), placement]);
  }
  const touching = (members: BasinPlacement[]) => members.filter((first, index) =>
    members.some((second, otherIndex) => otherIndex !== index && basinPlacementIntersection(first, second) > 0));
  for (const [sheetId, members] of bySheet) {
    if (members.length < 2 || touching(members).length === 0) continue;
    const sheet = newPiece.rectangles.find((rectangle) => rectangle.id === sheetId)!;
    const size = studioRectangleSize(sheet);
    const alongX = size.widthMm >= size.heightMm;
    const ordered = [...members].sort((first, second) => (alongX ? first.xMm - second.xMm : first.yMm - second.yMm));
    const spread = ordered.map((placement, index) => {
      const cut = placementCutSize(placement);
      const fractionAlong = (index + 1) / (ordered.length + 1);
      return alongX
        ? withPosition(placement, sheet, axisPosition(sheet.xMm, size.widthMm, cut.widthMm ?? 0, fractionAlong), placement.yMm)
        : withPosition(placement, sheet, placement.xMm, axisPosition(sheet.yMm, size.heightMm, cut.heightMm ?? 0, fractionAlong));
    });
    for (const placement of spread) {
      moved.set(placement.id, placement);
      notify(placement.id, "moved");
    }
    for (const placement of touching(spread)) notify(placement.id, "overlap");
  }

  const bySku = new Map(placements.map((placement) => [placement.id, placement.sku]));
  return {
    placements: placements.map((placement) => moved.get(placement.id) ?? placement),
    notices: [...noticeKinds].map(([placementId, kind]) => ({ placementId, sku: bySku.get(placementId) ?? "", kind })),
  };
}

/**
 * The whole "apply the custom shape" step as one pure function: rebuilds the target piece
 * from the panels and, when its geometry changed, carries the basins over with
 * reanchorPlacementsToPiece instead of dropping them.
 */
export function applyCustomShapeToState(
  current: StudioState,
  targetPieceId: string,
  preset: StudioPreset,
  panels: StudioCustomShapePanel[],
): { state: StudioState; notices: PlacementReanchorNotice[] } {
  const currentPieces = studioPieces(current);
  const currentPiece = currentPieces.find((piece) => piece.id === targetPieceId);
  if (!currentPiece) return { state: current, notices: [] };

  const builtPiece: StudioPiece = {
    ...buildCustomShapePiece(currentPiece.id, preset, panels),
    name: currentPiece.name,
  };
  const geometryChanged = currentPiece.preset !== preset ||
    currentPiece.rectangles.length !== builtPiece.rectangles.length ||
    builtPiece.rectangles.some((rectangle, index) => {
      const previous = currentPiece.rectangles[index];
      return !previous ||
        previous.widthMm !== rectangle.widthMm ||
        previous.lengthMm !== rectangle.lengthMm ||
        previous.xMm !== rectangle.xMm ||
        previous.yMm !== rectangle.yMm ||
        previous.rotation !== rectangle.rotation;
    });
  const reanchored = geometryChanged ? reanchorPlacementsToPiece(current.basinPlacements, currentPiece, builtPiece) : null;

  return {
    state: {
      ...current,
      shape: preset === "i" ? "I" : preset === "u" ? "U" : "L",
      pieces: currentPieces.map((piece) => piece.id === currentPiece.id ? builtPiece : piece),
      activePieceId: builtPiece.id,
      basinPlacements: reanchored ? reanchored.placements : current.basinPlacements,
    },
    notices: reanchored?.notices ?? [],
  };
}

export function placementCrossesPanelJoint(
  piece: StudioPiece,
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotation" | "orientation">,
) {
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null) return false;
  const basin = { xMm: placement.xMm, yMm: placement.yMm, widthMm: cutSize.widthMm, heightMm: cutSize.heightMm };
  return studioPieceJoints(piece).some((joint) => {
    const first = piece.rectangles.find((rectangle) => rectangle.id === joint.first.rectangleId);
    const second = piece.rectangles.find((rectangle) => rectangle.id === joint.second.rectangleId);
    if (!first || !second) return false;
    const firstSize = studioRectangleSize(first);
    const secondSize = studioRectangleSize(second);
    return rectangleIntersectionArea(basin, { xMm: first.xMm, yMm: first.yMm, widthMm: firstSize.widthMm, heightMm: firstSize.heightMm }) > 0 &&
      rectangleIntersectionArea(basin, { xMm: second.xMm, yMm: second.yMm, widthMm: secondSize.widthMm, heightMm: secondSize.heightMm }) > 0;
  });
}

export function placementFitsCounterShape(
  shape: CounterShape,
  dimensions: StudioDimensions,
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotation" | "orientation">,
) {
  return placementFitsStudioPiece(studioPieces({ shape, dimensions })[0], placement);
}

export function unsafeBasinPlacements(state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">) {
  return state.basinPlacements
    .filter((placement) => placement.widthMm !== null && placement.depthMm !== null)
    .filter((placement) => !placementFitsStudioPiece(studioPieceById(state, placement.pieceId), placement))
    .map((placement) => placement.id);
}

/**
 * True when the placement's cutout keeps at least `marginMm` of clearance from
 * every edge (left, right, top, bottom) of the given rectangle. Unknown-size
 * placements (widthMm/depthMm not yet resolved from the catalog) always pass
 * here, matching placementFitsRectangle's convention -- they're already
 * tracked separately as unknownBasinPlacements.
 */
export function placementMeetsBasinEdgeClearance(
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm" | "rotation" | "orientation">,
  rectangle: StudioRectangle,
  marginMm: number = STUDIO_BASIN_SAFETY_MARGIN_MM,
): boolean {
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null) return true;
  const size = studioRectangleSize(rectangle);
  const threshold = marginMm - STUDIO_EPSILON_MM;
  const leftClearance = placement.xMm - rectangle.xMm;
  const rightClearance = rectangle.xMm + size.widthMm - (placement.xMm + cutSize.widthMm);
  const topClearance = placement.yMm - rectangle.yMm;
  const bottomClearance = rectangle.yMm + size.heightMm - (placement.yMm + cutSize.heightMm);
  return leftClearance >= threshold &&
    rightClearance >= threshold &&
    topClearance >= threshold &&
    bottomClearance >= threshold;
}

/** ids of every basin placement whose cutout sits closer than marginMm to its panel's edge. */
export function basinPlacementsViolatingEdgeClearance(
  state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">,
  marginMm: number = STUDIO_BASIN_SAFETY_MARGIN_MM,
): string[] {
  return state.basinPlacements
    .filter((placement) => placement.widthMm !== null && placement.depthMm !== null)
    .filter((placement) => {
      const piece = studioPieceById(state, placement.pieceId);
      return !piece.rectangles.some((rectangle) => placementMeetsBasinEdgeClearance(placement, rectangle, marginMm));
    })
    .map((placement) => placement.id);
}

export function unknownBasinPlacements(state: Pick<StudioState, "basinPlacements">) {
  return state.basinPlacements
    .filter((placement) => placement.widthMm === null || placement.depthMm === null)
    .map((placement) => placement.id);
}

function basinPlacementIntersection(first: BasinPlacement, second: BasinPlacement) {
  const firstSize = placementCutSize(first);
  const secondSize = placementCutSize(second);
  if (firstSize.widthMm === null || firstSize.heightMm === null || secondSize.widthMm === null || secondSize.heightMm === null) return 0;
  const width = Math.min(first.xMm + firstSize.widthMm, second.xMm + secondSize.widthMm) - Math.max(first.xMm, second.xMm);
  const depth = Math.min(first.yMm + firstSize.heightMm, second.yMm + secondSize.heightMm) - Math.max(first.yMm, second.yMm);
  return width > STUDIO_EPSILON_MM && depth > STUDIO_EPSILON_MM ? width * depth : 0;
}

export function basinPlacementOverlapWarnings(state: Pick<StudioState, "basinPlacements">) {
  const warnings: string[] = [];
  for (let firstIndex = 0; firstIndex < state.basinPlacements.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < state.basinPlacements.length; secondIndex += 1) {
      const first = state.basinPlacements[firstIndex];
      const second = state.basinPlacements[secondIndex];
      if ((first.pieceId ?? "") !== (second.pieceId ?? "")) continue;
      if (basinPlacementIntersection(first, second) > 0) warnings.push(`${first.id}:${second.id}`);
    }
  }
  return warnings;
}

export function clampBasinPlacementPosition(
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "rotation" | "orientation">,
  xMm: number,
  yMm: number,
  dimensions: StudioDimensions,
  shape: CounterShape = "I",
) {
  const piece = studioPieces({ shape, dimensions })[0];
  const cutSize = placementCutSize(placement);
  const widthMm = cutSize.widthMm ?? 0;
  const depthMm = cutSize.heightMm ?? 0;
  const candidates = piece.rectangles.map((rectangle) => {
    const size = studioRectangleSize(rectangle);
    return {
      xMm: Math.max(rectangle.xMm, Math.min(rectangle.xMm + size.widthMm - widthMm, xMm)),
      yMm: Math.max(rectangle.yMm, Math.min(rectangle.yMm + size.heightMm - depthMm, yMm)),
    };
  }).filter((candidate) => Number.isFinite(candidate.xMm) && Number.isFinite(candidate.yMm));
  return candidates[0] ?? { xMm: Math.max(0, xMm), yMm: Math.max(0, yMm) };
}

/**
 * Piece/sheet-aware clamp. This is the one to use from now on: it resolves the
 * placement's own sheetId inside the placement's own piece, so a basin on the
 * second workpiece is never clamped against the first one.
 */
export function clampPlacementToSheet(
  placement: BasinPlacement,
  piece: StudioPiece | undefined,
  xMm: number,
  yMm: number,
): { xMm: number; yMm: number } {
  if (!piece) return { xMm, yMm };
  const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId)
    ?? placementHostRectangle(piece, placement);
  const cutSize = placementCutSize(placement);
  if (!sheet || cutSize.widthMm === null || cutSize.heightMm === null) return { xMm, yMm };
  const size = studioRectangleSize(sheet);
  return {
    xMm: Math.round(Math.max(sheet.xMm, Math.min(sheet.xMm + size.widthMm - cutSize.widthMm, xMm))),
    yMm: Math.round(Math.max(sheet.yMm, Math.min(sheet.yMm + size.heightMm - cutSize.heightMm, yMm))),
  };
}

/**
 * @deprecated Legacy single-piece helper: it rebuilds the piece from shape +
 * dimensions and can therefore only ever clamp against the FIRST piece. Use
 * `clampPlacementToSheet(placement, piece, x, y)` for any multi-piece layout.
 */
export function snapBasinPlacementPosition(
  placement: Pick<BasinPlacement, "widthMm" | "depthMm">,
  xMm: number,
  yMm: number,
  dimensions: StudioDimensions,
  shape: CounterShape = "I",
) {
  return clampBasinPlacementPosition(placement, xMm, yMm, dimensions, shape);
}

function usableRuns(shape: CounterShape, dimensions: StudioDimensions) {
  const runs = [dimensions.runAMm];
  if (shape === "L" || shape === "U") runs.push(dimensions.runBMm);
  if (shape === "U") runs.push(dimensions.runCMm);
  return runs;
}

/** Legacy helpers retained for old test fixtures and quote snapshots. */
export function counterBounds(shape: CounterShape, dimensions: StudioDimensions) {
  const depth = Math.max(0, dimensions.depthMm);
  return {
    widthMm: Math.max(0, dimensions.runAMm),
    heightMm: shape === "I" ? depth : Math.max(depth, dimensions.runBMm, shape === "U" ? dimensions.runCMm : 0),
  };
}

export function counterRegions(shape: CounterShape, dimensions: StudioDimensions): CounterRegion[] {
  const depth = Math.max(0, dimensions.depthMm);
  const runA = Math.max(0, dimensions.runAMm);
  const runB = Math.max(0, dimensions.runBMm);
  const runC = Math.max(0, dimensions.runCMm);
  if (shape === "I") return [{ xMm: 0, yMm: 0, widthMm: runA, heightMm: depth }];
  const regions: CounterRegion[] = [
    { xMm: 0, yMm: 0, widthMm: runA, heightMm: depth },
    { xMm: 0, yMm: 0, widthMm: depth, heightMm: runB },
  ];
  if (shape === "U") regions.push({ xMm: Math.max(0, runA - depth), yMm: 0, widthMm: depth, heightMm: runC });
  return regions;
}

export function counterClipPath(shape: CounterShape, dimensions: StudioDimensions) {
  const bounds = counterBounds(shape, dimensions);
  if (shape === "I") return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  const depth = Math.max(0, dimensions.depthMm);
  const leftLegWidth = Math.min(depth, bounds.widthMm);
  const topLegHeight = `${Math.max(0, Math.min(100, (depth / Math.max(1, bounds.heightMm)) * 100))}%`;
  const leftLegEdge = `${Math.max(0, Math.min(100, (leftLegWidth / Math.max(1, bounds.widthMm)) * 100))}%`;
  if (shape === "L") return `polygon(0 0, 100% 0, 100% ${topLegHeight}, ${leftLegEdge} ${topLegHeight}, ${leftLegEdge} 100%, 0 100%)`;
  const rightLegEdge = `${Math.max(0, Math.min(100, ((bounds.widthMm - leftLegWidth) / Math.max(1, bounds.widthMm)) * 100))}%`;
  const leftLegBottom = `${Math.max(0, Math.min(100, (Math.max(depth, dimensions.runBMm) / Math.max(1, bounds.heightMm)) * 100))}%`;
  const rightLegBottom = `${Math.max(0, Math.min(100, (Math.max(depth, dimensions.runCMm) / Math.max(1, bounds.heightMm)) * 100))}%`;
  return `polygon(0 0, 100% 0, 100% ${rightLegBottom}, ${rightLegEdge} ${rightLegBottom}, ${rightLegEdge} ${topLegHeight}, ${leftLegEdge} ${topLegHeight}, ${leftLegEdge} ${leftLegBottom}, 0 ${leftLegBottom})`;
}

export function counterShapeLabel(shape: CounterShape, dimensions: StudioDimensions) {
  const display = (value: number) => Math.round(value).toLocaleString("th-TH");
  if (shape === "I") return `I-SHAPE · ${display(dimensions.runAMm)} × ${display(dimensions.depthMm)} mm`;
  if (shape === "L") return `L-SHAPE · A ${display(dimensions.runAMm)} × B ${display(dimensions.runBMm)} × ลึก ${display(dimensions.depthMm)} mm`;
  return `U-SHAPE · A ${display(dimensions.runAMm)} × B ${display(dimensions.runBMm)} × C ${display(dimensions.runCMm)} × ลึก ${display(dimensions.depthMm)} mm`;
}

export function counterAreaSqM(shape: CounterShape, dimensions: StudioDimensions) {
  const depth = Math.max(0, dimensions.depthMm);
  const runs = usableRuns(shape, dimensions).map((run) => Math.max(0, run));
  const overlapCount = shape === "I" ? 0 : shape === "L" ? 1 : 2;
  return Math.max(0, (runs.reduce((sum, run) => sum + run * depth, 0) - overlapCount * depth * depth) / 1_000_000);
}

export function backsplashAreaSqM(shape: CounterShape, dimensions: StudioDimensions, backsplash: BacksplashConfig) {
  if (!backsplash.enabled || backsplash.heightMm <= 0) return 0;
  const totalRunMm = usableRuns(shape, dimensions).reduce((sum, run) => sum + Math.max(0, run), 0);
  return totalRunMm * backsplash.heightMm / 1_000_000;
}

export function standardSheetWarning(shape: CounterShape, dimensions: StudioDimensions) {
  return usableRuns(shape, dimensions).some((run) => run > 3600) || dimensions.depthMm > 760;
}

export function counterDimensionsValid(shape: CounterShape, dimensions: StudioDimensions) {
  const values = [dimensions.depthMm, dimensions.runAMm];
  if (shape !== "I") values.push(dimensions.runBMm);
  if (shape === "U") values.push(dimensions.runCMm);
  return values.every((value) => Number.isFinite(value) && value > 0);
}

function roundBaht(value: number) {
  return Math.round(Math.max(0, value));
}

function legacyStudioStatePieces(state: StudioState) {
  return studioPieces(state);
}

/**
 * Looks up the basin's own colorCode (from its PRODUCTS entry) in
 * STONE_COLORS and returns the matching stone code, or null if the SKU is
 * unknown or its color isn't in the stone catalog.
 */
export function resolveMatchingStoneForBasin(
  sku: string,
  products: ReadonlyArray<BasinProduct> = PRODUCTS,
): string | null {
  const product = products.find((candidate) => candidate.sku === sku);
  if (!product) return null;
  const match = STONE_COLORS.find((color) => color.code === product.colorCode);
  return match ? match.code : null;
}

export function studioEstimate(state: StudioState, products: ReadonlyArray<BasinProduct>): StudioEstimate {
  const pieces = legacyStudioStatePieces(state);
  const rectangles = pieces.flatMap((piece) => piece.rectangles);
  const isNewLayout = state.pieces !== undefined;
  const counterArea = isNewLayout ? studioAreaSqM(pieces) : counterAreaSqM(state.shape, state.dimensions);
  const edgeTotals = isNewLayout ? studioEdgeTotals(pieces) : { upstandLengthMm: 0, openEdgeLengthMm: 0 };
  const upstandHeight = state.upstandHeightMm ?? (isNewLayout ? null : state.backsplash.enabled ? state.backsplash.heightMm : null);
  const upstandHeightInvalid = upstandHeight !== null && (!Number.isFinite(upstandHeight) || upstandHeight < 0 || upstandHeight > 500);
  const upstandArea = upstandHeight !== null && Number.isFinite(upstandHeight) && upstandHeight > 0
    ? edgeTotals.upstandLengthMm * upstandHeight / 1_000_000
    : 0;
  const backsplashArea = isNewLayout ? 0 : backsplashAreaSqM(state.shape, state.dimensions, state.backsplash);
  const stoneArea = counterArea + upstandArea + backsplashArea;
  // A basin placed before any stone color is chosen shouldn't price as "no
  // stone" -- fall back to the color that ships with the first placed basin,
  // same as the storefront's product photos. This never overrides a color
  // the user picked themselves (state.activeStone is only empty pre-choice).
  const resolvedActiveStone = !state.activeStone && state.basinPlacements.length > 0
    ? resolveMatchingStoneForBasin(state.basinPlacements[0].sku, products) ?? state.activeStone
    : state.activeStone;
  const price = stoneInstalledUnitPrice(resolvedActiveStone);
  const sheetCutPriceWarning = false;
  const stoneTotal = price === null ? 0 : roundBaht(counterArea * price) + roundBaht((upstandArea + backsplashArea) * price);
  const upstandTotal = price === null ? 0 : roundBaht(upstandArea * price);
  // Only basins actually placed on the layout are priced or submitted in Studio mode.
  // In sketch mode, there is no 2D canvas, so all basins chosen in state.basinSkus
  // are priced into the estimate along with their installation charge.
  const isSketchMode = state.mode === "sketch";
  const basinSetSkus = isSketchMode && state.basinPlacements.length === 0
    ? state.basinSkus
    : state.basinPlacements.map((placement) => placement.sku);
  const basins = basinSetSkus.map((sku) => products.find((product) => product.sku === sku)).filter(Boolean) as BasinProduct[];
  const basinSubtotal = basins.reduce((sum, product) => sum + roundBaht(product.priceTHB), 0);
  const requestedInstallation = roundBaht(basins.length * INSTALLATION_PRICE);
  const installationDiscount = basins.length >= 3 ? requestedInstallation : 0;
  const installationCharge = requestedInstallation - installationDiscount;
  const openEdgePrice = state.openEdgePricePerMTHB ?? null;
  const openEdgeTotal = openEdgePrice !== null && openEdgePrice >= 0
    ? roundBaht((edgeTotals.openEdgeLengthMm / 1000) * openEdgePrice)
    : 0;
  const minimumArea = state.location === "bangkok-metro" ? STONE_INSTALLED_MIN_BANGKOK_SQM : STONE_INSTALLED_MIN_PROVINCE_SQM;
  const smallJobFee = price !== null && stoneArea > 0 && stoneArea < minimumArea
    ? state.location === "bangkok-metro" ? STONE_SMALL_JOB_BANGKOK_FEE : STONE_SMALL_JOB_PROVINCE_FEE
    : 0;
  const grossSubtotal = stoneTotal + openEdgeTotal + basinSubtotal + requestedInstallation + smallJobFee;
  const rawDiscount = state.discountTHB ?? 0;
  const discountInvalid = !Number.isFinite(rawDiscount) || rawDiscount < 0 || rawDiscount > Math.max(0, grossSubtotal - installationDiscount);
  const discountTHB = Number.isFinite(rawDiscount) ? Math.round(rawDiscount) : 0;
  const appliedDiscountTHB = Math.min(Math.max(0, discountTHB), Math.max(0, grossSubtotal - installationDiscount));
  const subtotal = Math.max(0, grossSubtotal - appliedDiscountTHB - installationDiscount);
  const vatAmount = state.vat ? roundBaht(subtotal * 0.07) : 0;
  const total = subtotal + vatAmount;
  const overlapWarnings = pieces.flatMap((piece) => pieceOverlapWarnings(piece).map((pair) => `${piece.name}: ${pair}`));
  const basinOverlapWarnings = basinPlacementOverlapWarnings(state);
  const inactiveBasinSkus = state.basinSkus.filter((sku) => !products.some((product) => product.sku === sku));
  const disconnectedRectangles = isNewLayout ? pieces.flatMap((piece) => disconnectedRectangleIds(piece).map((id) => `${piece.name}: ${id}`)) : [];
  const unsafe = isNewLayout ? state.basinPlacements.filter((placement) => {
    const piece = studioPieceById(state, placement.pieceId);
    return placement.widthMm !== null &&
      placement.depthMm !== null &&
      !placementFitsStudioPiece(piece, placement) &&
      !placementCrossesPanelJoint(piece, placement);
  }).map((placement) => placement.id) : [];
  const crossJointPlacements = isNewLayout ? state.basinPlacements.filter((placement) => {
    const piece = studioPieceById(state, placement.pieceId);
    return placementCrossesPanelJoint(piece, placement);
  }).map((placement) => placement.id) : [];
  const unknownDimensions = unknownBasinPlacements(state);
  const upstandHeightMissing = isNewLayout && (state.upstandHeightMm === null || state.upstandHeightMm === undefined);
  const openEdgePriceMissing = isNewLayout && edgeTotals.openEdgeLengthMm > 0 && openEdgePrice === null;
  const openEdgePriceInvalid = isNewLayout && openEdgePrice !== null && (!Number.isFinite(openEdgePrice) || openEdgePrice < 0 || Math.round(openEdgePrice * 100) !== openEdgePrice);
  const sheetWarning = isNewLayout
    ? rectangles.some((rectangle) => Math.min(rectangle.widthMm, rectangle.lengthMm) > 760 || Math.max(rectangle.widthMm, rectangle.lengthMm) > 3680)
    : standardSheetWarning(state.shape, state.dimensions);
  const warnings = [
    ...(upstandHeightMissing ? ["ยังไม่ได้ระบุความสูงบัว จึงยังไม่คิดเงินบัว"] : []),
    ...(openEdgePriceMissing ? ["ยังไม่ได้ระบุราคาขอบเปิดต่อเมตร"] : []),
     ...(openEdgePriceInvalid ? ["ราคาขอบเปิดต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง"] : []),
     ...(discountInvalid ? ["ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด"] : []),
     ...(upstandHeightInvalid ? ["ความสูงบัวต้องอยู่ระหว่าง 0–500 มม."] : []),
    ...(overlapWarnings.length ? ["มีสี่เหลี่ยมซ้อนกัน พื้นที่ยังคิดตามแผ่นเต็มแต่ต้องตรวจสอบแบบ"] : []),
     ...(basinOverlapWarnings.length ? ["มีอ่างวางซ้อนทับกัน กรุณาขยับอ่างให้อยู่ห่างกัน"] : []),
     ...(inactiveBasinSkus.length ? [`อ่าง ${inactiveBasinSkus.join(", ")} ไม่เปิดใช้งานแล้ว กรุณาเปลี่ยนรุ่นหรือนำออกจากแบบ`] : []),
     ...(disconnectedRectangles.length ? ["สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน"] : []),
     ...(crossJointPlacements.length ? ["อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว"] : []),
  ];
  return {
    pieceCount: pieces.length,
    rectangleCount: rectangles.length,
    counterAreaSqM: counterArea,
    backsplashAreaSqM: backsplashArea,
    upstandAreaSqM: upstandArea,
    upstandLengthM: edgeTotals.upstandLengthMm / 1000,
    openEdgeLengthM: edgeTotals.openEdgeLengthMm / 1000,
    stoneAreaSqM: stoneArea,
    stoneUnitPriceTHB: price,
    stoneTotalTHB: stoneTotal,
    upstandTotalTHB: upstandTotal,
    openEdgeUnitPriceTHB: openEdgePrice,
    openEdgeTotalTHB: openEdgeTotal,
    basinSubtotalTHB: basinSubtotal,
    installationChargeTHB: installationCharge,
    installationDiscountTHB: installationDiscount,
    discountTHB,
    smallJobFeeTHB: smallJobFee,
    grossSubtotalTHB: grossSubtotal,
    subtotalTHB: subtotal,
    vatAmountTHB: vatAmount,
    totalTHB: total,
    standardSheetWarning: sheetWarning,
    standardSheetMessage: sheetWarning ? `บางแผ่นเกินขนาดมาตรฐาน ${STONE_SHEET_SIZE} ต้องตรวจสอบการต่อแผ่นกับทีมขาย` : "",
    sheetCutPriceWarning,
    upstandHeightMissing,
    openEdgePriceMissing,
    openEdgePriceInvalid,
     upstandHeightInvalid,
     basinOverlapWarnings,
    inactiveBasinSkus,
    overlapWarnings,
    unsafePlacements: unsafe,
    crossJointPlacements,
    unknownDimensionPlacements: unknownDimensions,
    disconnectedRectangles,
    discountInvalid,
    warnings,
    isValid: price !== null &&
      !openEdgePriceInvalid &&
      !upstandHeightInvalid &&
      !discountInvalid &&
      !basinOverlapWarnings.length &&
      !inactiveBasinSkus.length &&
      !overlapWarnings.length &&
      !disconnectedRectangles.length &&
      !crossJointPlacements.length &&
      !unsafe.length &&
      !unknownDimensions.length &&
      studioStateDimensionsValid(state),
  };
}

type StudioSubmissionEstimate = Pick<StudioEstimate, "isValid" | "unknownDimensionPlacements" | "unsafePlacements" | "overlapWarnings" | "openEdgePriceInvalid" | "upstandHeightInvalid" | "basinOverlapWarnings" | "inactiveBasinSkus" | "crossJointPlacements" | "disconnectedRectangles" | "discountInvalid">;

/** Every currently-true validation issue, in the same priority order as
 * studioSubmissionValidationMessage — used for a live "here's everything to
 * fix" summary so a customer doesn't have to submit-fail-fix-repeat one
 * message at a time. */
export function studioSubmissionValidationMessages(state: StudioState, estimate: StudioSubmissionEstimate): string[] {
  const messages: string[] = [];
  // A shortlisted-but-unplaced basin is a comparison, not a commitment — it
  // must never block submitting a stone-only (or stone + install-only)
  // order. The shortlist cards' own "วางบนผัง" button is the nudge to place
  // one, not a hard gate here. See basinSetSkus in studioEstimate.
  if (estimate.unknownDimensionPlacements.length > 0) messages.push("รุ่นที่เลือกยังไม่ระบุขนาดหลุม ต้องยืนยันขนาดกับทีมขายก่อนส่งคำขอ");
  if (estimate.inactiveBasinSkus.length > 0) messages.push("มีอ่างที่ไม่เปิดใช้งานในแบบร่าง กรุณาเปลี่ยนรุ่นหรือนำออกก่อนส่งคำขอ");
  if (estimate.basinOverlapWarnings.length > 0) messages.push("มีอ่างวางซ้อนทับกัน กรุณาขยับอ่างให้อยู่ห่างกัน");
  if (estimate.overlapWarnings.length > 0) messages.push("มีสี่เหลี่ยมซ้อนกัน กรุณาขยับแผ่นให้ไม่ซ้อนกันก่อนส่งคำขอ");
  if (estimate.disconnectedRectangles.length > 0) messages.push("สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน");
  if (estimate.crossJointPlacements.length > 0) messages.push("อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว");
  if (estimate.unsafePlacements.length > 0) messages.push("กรุณาวางอ่างให้อยู่ภายในสี่เหลี่ยมของชิ้นงาน");
  if (estimate.openEdgePriceInvalid) messages.push("ราคาขอบเปิดติดลบไม่ได้");
  if (estimate.upstandHeightInvalid) messages.push("ความสูงบัวต้องอยู่ระหว่าง 0–500 มม.");
  if (estimate.discountInvalid) messages.push("ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด");
  if (!estimate.isValid && messages.length === 0) messages.push("กรุณาตรวจสอบจำนวนชิ้นงาน จำนวนแผ่น ขนาดแผ่น และข้อมูลวัสดุก่อนส่งคำขอ");
  return messages;
}

export function studioSubmissionValidationMessage(state: StudioState, estimate: StudioSubmissionEstimate) {
  return studioSubmissionValidationMessages(state, estimate)[0] ?? null;
}

/**
 * Contract check for NEW placements: pieceId must resolve, and sheetId must be
 * present and resolve inside that piece. Legacy v1 drafts are exempt — they go
 * through `normalizePlacements` first, which fills both from the saved geometry.
 */
export function placementTargetWarnings(
  placement: BasinPlacement,
  pieces: ReadonlyArray<StudioPiece>,
): string[] {
  if (!placement.pieceId) return [`อ่าง ${placement.id} ไม่ได้ระบุชิ้นงาน (pieceId)`];
  const piece = pieces.find((candidate) => candidate.id === placement.pieceId);
  if (!piece) return [`ไม่พบชิ้นงานสำหรับอ่าง ${placement.id}`];
  if (!placement.sheetId) return [`อ่าง ${placement.id} ไม่ได้ระบุแผ่น (sheetId)`];
  if (!piece.rectangles.some((rectangle) => rectangle.id === placement.sheetId)) {
    return [`ไม่พบแผ่นเป้าหมายสำหรับอ่าง ${placement.id}`];
  }
  return [];
}

/**
 * Builds a NEW placement. `pieceId` is required — new data must always name its
 * workpiece. `sheetId` is required by the placement contract too and must be the
 * sheet the user picked (WO-3 passes it); until a caller supplies it, the
 * placement is intentionally incomplete and `placementTargetWarnings` reports it.
 */
export function createBasinPlacement(
  product: BasinProduct,
  index: number,
  pieceId: string,
  sheetId?: string,
  anchor: BasinAnchor = "top-left",
): BasinPlacement {
  const size = basinDimensionsForProduct(product);
  return {
    id: `${product.sku}-${index}-${Date.now()}`,
    sku: product.sku,
    pieceId,
    sheetId,
    anchor,
    offsetXMm: 0,
    offsetYMm: 0,
    rotation: 0,
    xMm: 0,
    yMm: 0,
    ...size,
    orientation: "horizontal",
  };
}

/**
 * Quick-add helper: places a basin on a freshly-created sheet (which has no
 * xMm/yMm of its own yet, unlike a StudioRectangle already sitting in a
 * piece) by SKU alone, auto-centering it or flush-aligning it left/right
 * while always keeping at least STUDIO_BASIN_SAFETY_MARGIN_MM of clearance
 * from every edge. xMm/yMm follow the same top-left-corner convention as
 * every other BasinPlacement in this file (see placementCutSize,
 * placementMeetsBasinEdgeClearance) -- centering therefore subtracts half
 * the basin's own cut size, the same way calculateBasinCoordinates' "center"
 * case does.
 */
export function createStudioBasinPlacement(
  sku: string,
  sheet: { id: string; widthMm: number; lengthMm: number },
  pieceId: string,
  align: "center" | "left" | "right" = "center",
): BasinPlacement {
  const product = PRODUCTS.find((item) => item.sku === sku);
  const size = basinDimensionsForProduct(product);
  const cutWidthMm = size.widthMm ?? 0;
  const cutDepthMm = size.depthMm ?? 0;
  const margin = STUDIO_BASIN_SAFETY_MARGIN_MM;

  // Clamps a coordinate so the cutout keeps `margin` clearance from both
  // edges along that axis. When the sheet is too small to fit the cutout
  // with `margin` on both sides, this falls back to `margin` from the low
  // edge instead of producing an inverted (max < min) range.
  const clampAxis = (valueMm: number, sheetSizeMm: number, cutSizeMm: number) => {
    const maxMm = Math.max(margin, sheetSizeMm - cutSizeMm - margin);
    return Math.round(Math.min(Math.max(valueMm, margin), maxMm));
  };

  const xMm = align === "left"
    ? clampAxis(margin, sheet.widthMm, cutWidthMm)
    : align === "right"
      ? clampAxis(sheet.widthMm - cutWidthMm - margin, sheet.widthMm, cutWidthMm)
      : clampAxis((sheet.widthMm - cutWidthMm) / 2, sheet.widthMm, cutWidthMm);
  const yMm = clampAxis((sheet.lengthMm - cutDepthMm) / 2, sheet.lengthMm, cutDepthMm);

  return {
    id: `${sku}-${sheet.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sku,
    pieceId,
    sheetId: sheet.id,
    anchor: "top-left",
    xMm,
    yMm,
    widthMm: size.widthMm,
    depthMm: size.depthMm,
    rotation: 0,
    orientation: "horizontal",
  };
}

/**
 * Resizes the main sheet (the first rectangle of the first piece) to a new
 * width/depth -- e.g. from STUDIO_COUNTER_PRESETS or a freeform width input
 * -- and re-centers every basin placed on that sheet along X so it never
 * sits closer than STUDIO_BASIN_SAFETY_MARGIN_MM to either edge of the
 * resized sheet. Legacy states (no `pieces`) only get their `dimensions`
 * updated, matching how the rest of this file treats that representation.
 * Basins on any OTHER sheet, or in any other piece, are left untouched.
 */
export function applyStudioSizePreset(
  state: StudioState,
  widthMm: number,
  depthMm: number = 600,
): StudioState {
  const dimensions = { ...state.dimensions, runAMm: widthMm, depthMm };
  const mainPiece = state.pieces?.[0];
  const mainSheet = mainPiece?.rectangles[0];
  if (!mainPiece || !mainSheet) return { ...state, dimensions };

  const resizedSheet: StudioRectangle = { ...mainSheet, widthMm, lengthMm: depthMm };
  const pieces = state.pieces!.map((piece, pieceIndex) =>
    pieceIndex !== 0
      ? piece
      : { ...piece, rectangles: piece.rectangles.map((rectangle, rectangleIndex) => rectangleIndex === 0 ? resizedSheet : rectangle) },
  );

  const margin = STUDIO_BASIN_SAFETY_MARGIN_MM;
  const clampToMargin = (valueMm: number, sheetWidthMm: number, cutWidthMm: number) => {
    const maxMm = Math.max(margin, sheetWidthMm - cutWidthMm - margin);
    return Math.round(Math.min(Math.max(valueMm, margin), maxMm));
  };

  const basinPlacements = state.basinPlacements.map((placement) => {
    if ((placement.pieceId ?? mainPiece.id) !== mainPiece.id) return placement;
    const hostSheet = mainPiece.rectangles.find((rectangle) => rectangle.id === placement.sheetId)
      ?? placementHostRectangle(mainPiece, placement);
    if (hostSheet.id !== mainSheet.id) return placement;
    const cutWidthMm = placementCutSize(placement).widthMm;
    if (cutWidthMm === null) return placement;
    return { ...placement, xMm: clampToMargin((widthMm - cutWidthMm) / 2, widthMm, cutWidthMm) };
  });

  return { ...state, dimensions, pieces, basinPlacements };
}

/** Actual cut footprint after applying the basin's own rotation. */
export function placementCutSize(
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "rotation" | "orientation">,
): { widthMm: number | null; heightMm: number | null } {
  if (placement.widthMm === null || placement.widthMm === undefined || placement.depthMm === null || placement.depthMm === undefined) {
    return { widthMm: null, heightMm: null };
  }
  const rotation = placement.rotation ?? (placement.orientation === "vertical" ? 90 : 0);
  return rotation === 90
    ? { widthMm: placement.depthMm, heightMm: placement.widthMm }
    : { widthMm: placement.widthMm, heightMm: placement.depthMm };
}

/** Resolves anchor + edge offsets measured against the selected sheet into xMm/yMm. */
export function calculateBasinCoordinates(
  sheet: StudioRectangle,
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "rotation" | "orientation" | "anchor" | "offsetXMm" | "offsetYMm">,
): { xMm: number; yMm: number } {
  const sheetSize = studioRectangleSize(sheet);
  const cutSize = placementCutSize(placement);
  const widthMm = cutSize.widthMm ?? 0;
  const heightMm = cutSize.heightMm ?? 0;
  const offsetXMm = placement.offsetXMm ?? 0;
  const offsetYMm = placement.offsetYMm ?? 0;
  switch (placement.anchor ?? "top-left") {
    case "top-right":
      return { xMm: sheet.xMm + sheetSize.widthMm - widthMm - offsetXMm, yMm: sheet.yMm + offsetYMm };
    case "bottom-left":
      return { xMm: sheet.xMm + offsetXMm, yMm: sheet.yMm + sheetSize.heightMm - heightMm - offsetYMm };
    case "bottom-right":
      return { xMm: sheet.xMm + sheetSize.widthMm - widthMm - offsetXMm, yMm: sheet.yMm + sheetSize.heightMm - heightMm - offsetYMm };
    case "center":
      return { xMm: sheet.xMm + (sheetSize.widthMm - widthMm) / 2 + offsetXMm, yMm: sheet.yMm + (sheetSize.heightMm - heightMm) / 2 + offsetYMm };
    default:
      return { xMm: sheet.xMm + offsetXMm, yMm: sheet.yMm + offsetYMm };
  }
}

/** Inverse of calculateBasinCoordinates: derives offsets that reproduce coords. */
export function calculateBasinOffsets(
  sheet: StudioRectangle,
  placement: Pick<BasinPlacement, "widthMm" | "depthMm" | "rotation" | "orientation">,
  coords: { xMm: number; yMm: number },
  anchor: BasinAnchor,
): { offsetXMm: number; offsetYMm: number } {
  const sheetSize = studioRectangleSize(sheet);
  const cutSize = placementCutSize(placement);
  const widthMm = cutSize.widthMm ?? 0;
  const heightMm = cutSize.heightMm ?? 0;
  switch (anchor) {
    case "top-right":
      return { offsetXMm: sheet.xMm + sheetSize.widthMm - coords.xMm - widthMm, offsetYMm: coords.yMm - sheet.yMm };
    case "bottom-left":
      return { offsetXMm: coords.xMm - sheet.xMm, offsetYMm: sheet.yMm + sheetSize.heightMm - coords.yMm - heightMm };
    case "bottom-right":
      return {
        offsetXMm: sheet.xMm + sheetSize.widthMm - coords.xMm - widthMm,
        offsetYMm: sheet.yMm + sheetSize.heightMm - coords.yMm - heightMm,
      };
    case "center":
      return {
        offsetXMm: coords.xMm - (sheet.xMm + (sheetSize.widthMm - widthMm) / 2),
        offsetYMm: coords.yMm - (sheet.yMm + (sheetSize.heightMm - heightMm) / 2),
      };
    default:
      return { offsetXMm: coords.xMm - sheet.xMm, offsetYMm: coords.yMm - sheet.yMm };
  }
}

/** Toggles 0 <-> 90, keeping the selected anchor and edge offsets fixed. */
export function rotatePlacement(placement: BasinPlacement, piece: StudioPiece): BasinPlacement {
  const currentRotation = placement.rotation ?? (placement.orientation === "vertical" ? 90 : 0);
  const rotation: RectangleRotation = currentRotation === 90 ? 0 : 90;
  const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId);
  if (!sheet) return { ...placement, rotation, orientation: rotation === 90 ? "vertical" : "horizontal" };
  const coords = calculateBasinCoordinates(sheet, { ...placement, rotation });
  return {
    ...placement,
    rotation,
    orientation: rotation === 90 ? "vertical" : "horizontal",
    xMm: coords.xMm,
    yMm: coords.yMm,
  };
}

/**
 * v1 migration: legacy drafts saved placements without pieceId/sheetId/anchor.
 * Missing pieceId is filled from pieces[0] ONLY when it was never set (legacy).
 * A placement that already names a (possibly stale) pieceId is new-model data
 * and must never silently fall back to pieces[0].
 */
export function normalizePlacements(state: StudioState): BasinPlacement[] {
  const pieces = studioPieces(state);
  return state.basinPlacements.map((placement) => {
    const isLegacyMissingPieceId = placement.pieceId === undefined;
    const pieceId = isLegacyMissingPieceId ? pieces[0]?.id : placement.pieceId;
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    const sheetId = placement.sheetId ?? (piece ? placementHostRectangle(piece, placement)?.id : undefined);
    const sheet = piece?.rectangles.find((rectangle) => rectangle.id === sheetId);
    const anchor = placement.anchor ?? "top-left";
    const rotation = placement.rotation ?? (placement.orientation === "vertical" ? 90 : 0);
    const offsets = placement.offsetXMm !== undefined && placement.offsetYMm !== undefined
      ? { offsetXMm: placement.offsetXMm, offsetYMm: placement.offsetYMm }
      : sheet
        ? calculateBasinOffsets(sheet, { ...placement, rotation }, { xMm: placement.xMm, yMm: placement.yMm }, anchor)
        : { offsetXMm: placement.offsetXMm ?? 0, offsetYMm: placement.offsetYMm ?? 0 };
    const coordinates = sheet && placement.offsetXMm !== undefined && placement.offsetYMm !== undefined
      ? calculateBasinCoordinates(sheet, { ...placement, anchor, rotation, ...offsets })
      : { xMm: placement.xMm, yMm: placement.yMm };
    return {
      ...placement,
      pieceId,
      sheetId,
      anchor,
      rotation,
      orientation: rotation === 90 ? "vertical" : "horizontal",
      offsetXMm: offsets.offsetXMm,
      offsetYMm: offsets.offsetYMm,
      xMm: coordinates.xMm,
      yMm: coordinates.yMm,
    };
  });
}

/** Warns when a placement's piece/sheet cannot be resolved or the cut exceeds its sheet. */
export function placementSheetWarnings(placement: BasinPlacement, piece?: StudioPiece): string[] {
  if (!piece) return [`ไม่พบชิ้นงานสำหรับอ่าง ${placement.id}`];
  if (!placement.sheetId) return [`ไม่ได้ระบุแผ่นเป้าหมายสำหรับอ่าง ${placement.id}`];
  const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId);
  if (!sheet) return [`ไม่พบแผ่นเป้าหมายสำหรับอ่าง ${placement.id}`];
  const cutSize = placementCutSize(placement);
  if (cutSize.widthMm === null || cutSize.heightMm === null) return [];
  const sheetSize = studioRectangleSize(sheet);
  const coords = calculateBasinCoordinates(sheet, placement);
  const exceeds = coords.xMm < sheet.xMm - STUDIO_EPSILON_MM ||
    coords.yMm < sheet.yMm - STUDIO_EPSILON_MM ||
    coords.xMm + cutSize.widthMm > sheet.xMm + sheetSize.widthMm + STUDIO_EPSILON_MM ||
    coords.yMm + cutSize.heightMm > sheet.yMm + sheetSize.heightMm + STUDIO_EPSILON_MM;
  return exceeds ? [`อ่าง ${placement.id} เกินขอบเขตแผ่น ${sheet.id}`] : [];
}

export function studioStoneName(code: string) {
  return stoneColorByName(code).name;
}