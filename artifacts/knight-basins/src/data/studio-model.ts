import {
  INSTALLATION_PRICE,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  STONE_SHEET_SIZE,
  stoneColorByName,
  stoneInstalledUnitPrice,
  type BasinProduct,
} from "./catalog.ts";

export type StudioOrderMode = "quick-purchase" | "studio" | "sketch";
/** Kept for reading old I/L/U quote snapshots only. New Studio layouts use rectangles. */
export type CounterShape = "I" | "L" | "U";
export type StudioLocation = "bangkok-metro" | "province";
export type StudioQuoteFormat = "US" | "OF";
export type SideStatus = "upstand" | "open-edge" | "wall-flush" | "normal";
export type RectangleRotation = 0 | 90;

export type StudioDimensions = {
  depthMm: number;
  runAMm: number;
  runBMm: number;
  runCMm: number;
};

export type StudioRectangle = {
  id: string;
  widthMm: number;
  lengthMm: number;
  xMm: number;
  yMm: number;
  rotation: RectangleRotation;
  label?: string;
};

export type StudioPiece = {
  id: string;
  name: string;
  rectangles: StudioRectangle[];
  sideStatuses: Record<string, SideStatus>;
};

export type BacksplashConfig = {
  enabled: boolean;
  heightMm: number;
};

export type BasinPlacement = {
  id: string;
  sku: string;
  pieceId?: string;
  xMm: number;
  yMm: number;
  widthMm: number | null;
  depthMm: number | null;
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
export const STUDIO_MAX_STONE_COLORS = 3;
export const STUDIO_MIN_STONE_COLORS = 2;
export const STUDIO_MAX_BASINS = 2;
export const STUDIO_MIN_BASINS = 1;
export const STUDIO_SNAP_DISTANCE_MM = 12;
const STUDIO_EPSILON_MM = 0.01;

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
    if (edge.status === "upstand") totals.upstandLengthMm += edge.exposedLengthMm;
    if (edge.status === "open-edge") totals.openEdgeLengthMm += edge.exposedLengthMm;
    return totals;
  }, { upstandLengthMm: 0, openEdgeLengthMm: 0 });
}

export function studioSideStatusLabel(status: SideStatus) {
  return {
    upstand: "ติดบัว",
    "open-edge": "ขอบเปิด",
    "wall-flush": "ชิดผนัง",
    normal: "ปกติ",
  }[status];
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

function placementFitsRectangle(placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">, rectangle: StudioRectangle) {
  if (placement.widthMm === null || placement.depthMm === null) return true;
  const size = studioRectangleSize(rectangle);
  return placement.xMm >= rectangle.xMm - STUDIO_EPSILON_MM &&
    placement.yMm >= rectangle.yMm - STUDIO_EPSILON_MM &&
    placement.xMm + placement.widthMm <= rectangle.xMm + size.widthMm + STUDIO_EPSILON_MM &&
    placement.yMm + placement.depthMm <= rectangle.yMm + size.heightMm + STUDIO_EPSILON_MM;
}

export function placementFitsStudioPiece(piece: StudioPiece, placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">) {
  return piece.rectangles.some((rectangle) => placementFitsRectangle(placement, rectangle));
}

export function placementCrossesPanelJoint(
  piece: StudioPiece,
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">,
) {
  if (placement.widthMm === null || placement.depthMm === null) return false;
  const basin = { xMm: placement.xMm, yMm: placement.yMm, widthMm: placement.widthMm, heightMm: placement.depthMm };
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
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">,
) {
  return placementFitsStudioPiece(studioPieces({ shape, dimensions })[0], placement);
}

export function unsafeBasinPlacements(state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">) {
  return state.basinPlacements
    .filter((placement) => placement.widthMm !== null && placement.depthMm !== null)
    .filter((placement) => !placementFitsStudioPiece(studioPieceById(state, placement.pieceId), placement))
    .map((placement) => placement.id);
}

export function unknownBasinPlacements(state: Pick<StudioState, "basinPlacements">) {
  return state.basinPlacements
    .filter((placement) => placement.widthMm === null || placement.depthMm === null)
    .map((placement) => placement.id);
}

export function clampBasinPlacementPosition(
  placement: Pick<BasinPlacement, "widthMm" | "depthMm">,
  xMm: number,
  yMm: number,
  dimensions: StudioDimensions,
  shape: CounterShape = "I",
) {
  const piece = studioPieces({ shape, dimensions })[0];
  const widthMm = placement.widthMm ?? 0;
  const depthMm = placement.depthMm ?? 0;
  const candidates = piece.rectangles.map((rectangle) => {
    const size = studioRectangleSize(rectangle);
    return {
      xMm: Math.max(rectangle.xMm, Math.min(rectangle.xMm + size.widthMm - widthMm, xMm)),
      yMm: Math.max(rectangle.yMm, Math.min(rectangle.yMm + size.heightMm - depthMm, yMm)),
    };
  }).filter((candidate) => Number.isFinite(candidate.xMm) && Number.isFinite(candidate.yMm));
  return candidates[0] ?? { xMm: Math.max(0, xMm), yMm: Math.max(0, yMm) };
}

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

export function studioEstimate(state: StudioState, products: BasinProduct[]): StudioEstimate {
  const pieces = legacyStudioStatePieces(state);
  const rectangles = pieces.flatMap((piece) => piece.rectangles);
  const isNewLayout = state.pieces !== undefined;
  const counterArea = isNewLayout ? studioAreaSqM(pieces) : counterAreaSqM(state.shape, state.dimensions);
  const edgeTotals = isNewLayout ? studioEdgeTotals(pieces) : { upstandLengthMm: 0, openEdgeLengthMm: 0 };
  const upstandHeight = state.upstandHeightMm ?? (isNewLayout ? null : state.backsplash.enabled ? state.backsplash.heightMm : null);
  const upstandArea = upstandHeight !== null && Number.isFinite(upstandHeight) && upstandHeight > 0
    ? edgeTotals.upstandLengthMm * upstandHeight / 1_000_000
    : 0;
  const backsplashArea = isNewLayout ? 0 : backsplashAreaSqM(state.shape, state.dimensions, state.backsplash);
  const stoneArea = counterArea + upstandArea + backsplashArea;
  const price = stoneInstalledUnitPrice(state.activeStone);
  const sheetCutPriceWarning = price === 9500;
  const stoneTotal = price === null || sheetCutPriceWarning ? 0 : roundBaht(counterArea * price) + roundBaht((upstandArea + backsplashArea) * price);
  const upstandTotal = price === null || sheetCutPriceWarning ? 0 : roundBaht(upstandArea * price);
  const basinSetSkus = state.basinPlacements.length ? state.basinPlacements.map((placement) => placement.sku) : state.basinSkus;
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
    ...(sheetCutPriceWarning ? ["สีลายหินอ่อนคิดตามแผ่นตัด ทีมขายจะคิดให้"] : []),
    ...(upstandHeightMissing ? ["ยังไม่ได้ระบุความสูงบัว จึงยังไม่คิดเงินบัว"] : []),
    ...(openEdgePriceMissing ? ["ยังไม่ได้ระบุราคาขอบเปิดต่อเมตร"] : []),
     ...(openEdgePriceInvalid ? ["ราคาขอบเปิดต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง"] : []),
     ...(discountInvalid ? ["ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด"] : []),
    ...(overlapWarnings.length ? ["มีสี่เหลี่ยมซ้อนกัน พื้นที่ยังคิดตามแผ่นเต็มแต่ต้องตรวจสอบแบบ"] : []),
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
    overlapWarnings,
    unsafePlacements: unsafe,
    crossJointPlacements,
    unknownDimensionPlacements: unknownDimensions,
    disconnectedRectangles,
    discountInvalid,
    warnings,
    isValid: state.stoneColors.length >= STUDIO_MIN_STONE_COLORS &&
      state.stoneColors.length <= STUDIO_MAX_STONE_COLORS &&
      state.basinSkus.length >= STUDIO_MIN_BASINS &&
      state.basinSkus.length <= STUDIO_MAX_BASINS &&
      state.basinPlacements.length >= state.basinSkus.length &&
      price !== null &&
      !openEdgePriceInvalid &&
      !discountInvalid &&
      !overlapWarnings.length &&
      !disconnectedRectangles.length &&
      !crossJointPlacements.length &&
      !unsafe.length &&
      !unknownDimensions.length &&
      studioStateDimensionsValid(state),
  };
}

export function studioSubmissionValidationMessage(
  state: StudioState,
  estimate: Pick<StudioEstimate, "isValid" | "unknownDimensionPlacements" | "unsafePlacements" | "overlapWarnings" | "openEdgePriceInvalid" | "crossJointPlacements" | "disconnectedRectangles" | "discountInvalid">,
) {
  const placedSkus = new Set(state.basinPlacements.map((placement) => placement.sku));
  const hasMissingSelectedBasin = state.basinSkus.some((sku) => !placedSkus.has(sku));
  if (state.basinPlacements.length === 0) return "ยังไม่ได้วางอ่างบนผัง กรุณาลากอ่างที่เลือกมาวางบนผัง";
  if (state.basinPlacements.length < state.basinSkus.length || hasMissingSelectedBasin) return `ยังวางอ่างไม่ครบทุกแบบที่เลือก (เลือก ${state.basinSkus.length} รุ่น · วางแล้ว ${state.basinPlacements.length} ตัว) กรุณาลากอ่างที่เลือกวางบนผังให้ครบ`;
  if (estimate.unknownDimensionPlacements.length > 0) return "รุ่นที่เลือกยังไม่ระบุขนาดหลุม ต้องยืนยันขนาดกับทีมขายก่อนส่งคำขอ";
  if (estimate.overlapWarnings.length > 0) return "มีสี่เหลี่ยมซ้อนกัน กรุณาขยับแผ่นให้ไม่ซ้อนกันก่อนส่งคำขอ";
  if (estimate.disconnectedRectangles.length > 0) return "สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน";
  if (estimate.crossJointPlacements.length > 0) return "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว";
  if (estimate.unsafePlacements.length > 0) return "กรุณาวางอ่างให้อยู่ภายในสี่เหลี่ยมของชิ้นงาน";
  if (estimate.openEdgePriceInvalid) return "ราคาขอบเปิดติดลบไม่ได้";
  if (estimate.discountInvalid) return "ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด";
  if (!estimate.isValid) return "กรุณาตรวจสอบจำนวนชิ้นงาน จำนวนแผ่น ขนาดแผ่น และข้อมูลวัสดุก่อนส่งคำขอ";
  return null;
}

export function createBasinPlacement(product: BasinProduct, index: number, pieceId?: string): BasinPlacement {
  const size = basinDimensionsForProduct(product);
  return { id: `${product.sku}-${index}-${Date.now()}`, sku: product.sku, pieceId, xMm: 0, yMm: 0, ...size };
}

export function studioStoneName(code: string) {
  return stoneColorByName(code).name;
}