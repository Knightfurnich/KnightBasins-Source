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
export type CounterShape = "I" | "L" | "U";
export type StudioLocation = "bangkok-metro" | "province";
export type StudioQuoteFormat = "US" | "OF";

export type StudioDimensions = {
  depthMm: number;
  runAMm: number;
  runBMm: number;
  runCMm: number;
};

export type BacksplashConfig = {
  enabled: boolean;
  heightMm: number;
};

export type BasinPlacement = {
  id: string;
  sku: string;
  xMm: number;
  yMm: number;
  widthMm: number | null;
  depthMm: number | null;
};

export type StudioState = {
  mode: StudioOrderMode;
  shape: CounterShape;
  dimensions: StudioDimensions;
  backsplash: BacksplashConfig;
  location: StudioLocation;
  vat: boolean;
  quoteFormat: StudioQuoteFormat;
  stoneColors: string[];
  activeStone: string;
  basinSkus: string[];
  basinPlacements: BasinPlacement[];
};

export type StudioEstimate = {
  counterAreaSqM: number;
  backsplashAreaSqM: number;
  stoneAreaSqM: number;
  stoneUnitPriceTHB: number | null;
  stoneTotalTHB: number;
  basinSubtotalTHB: number;
  installationChargeTHB: number;
  installationDiscountTHB: number;
  smallJobFeeTHB: number;
  subtotalTHB: number;
  vatAmountTHB: number;
  totalTHB: number;
  standardSheetWarning: boolean;
  standardSheetMessage: string;
  unsafePlacements: string[];
  unknownDimensionPlacements: string[];
  isValid: boolean;
};

export const STUDIO_EDGE_CLEARANCE_MM = 50;
const STUDIO_CLEARANCE_EPSILON_MM = 0.01;
export const STUDIO_SNAP_DISTANCE_MM = 5;
export const STUDIO_MAX_STONE_COLORS = 3;
export const STUDIO_MIN_STONE_COLORS = 2;
export const STUDIO_MAX_BASINS = 2;
export const STUDIO_MIN_BASINS = 1;

export type CounterRegion = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export function counterBounds(shape: CounterShape, dimensions: StudioDimensions) {
  const depth = Math.max(0, dimensions.depthMm);
  return {
    widthMm: Math.max(0, dimensions.runAMm),
    heightMm: shape === "I"
      ? depth
      : Math.max(depth, dimensions.runBMm, shape === "U" ? dimensions.runCMm : 0),
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
  if (shape === "U") {
    regions.push({
      xMm: Math.max(0, runA - depth),
      yMm: 0,
      widthMm: depth,
      heightMm: runC,
    });
  }
  return regions;
}

function dimensionPercent(valueMm: number, totalMm: number) {
  return `${Math.max(0, Math.min(100, (valueMm / Math.max(1, totalMm)) * 100))}%`;
}

export function counterClipPath(shape: CounterShape, dimensions: StudioDimensions) {
  const bounds = counterBounds(shape, dimensions);
  if (shape === "I") return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";

  const depth = Math.max(0, dimensions.depthMm);
  const leftLegWidth = Math.min(depth, bounds.widthMm);
  const topLegHeight = dimensionPercent(depth, bounds.heightMm);
  const leftLegEdge = dimensionPercent(leftLegWidth, bounds.widthMm);

  if (shape === "L") {
    return `polygon(0 0, 100% 0, 100% ${topLegHeight}, ${leftLegEdge} ${topLegHeight}, ${leftLegEdge} 100%, 0 100%)`;
  }

  const rightLegEdge = dimensionPercent(Math.max(0, bounds.widthMm - leftLegWidth), bounds.widthMm);
  const leftLegBottom = dimensionPercent(Math.max(depth, dimensions.runBMm), bounds.heightMm);
  const rightLegBottom = dimensionPercent(Math.max(depth, dimensions.runCMm), bounds.heightMm);
  return `polygon(0 0, 100% 0, 100% ${rightLegBottom}, ${rightLegEdge} ${rightLegBottom}, ${rightLegEdge} ${topLegHeight}, ${leftLegEdge} ${topLegHeight}, ${leftLegEdge} ${leftLegBottom}, 0 ${leftLegBottom})`;
}

export function counterClearanceRegions(shape: CounterShape, dimensions: StudioDimensions) {
  return counterRegions(shape, dimensions)
    .map((region) => ({
      xMm: region.xMm + STUDIO_EDGE_CLEARANCE_MM,
      yMm: region.yMm + STUDIO_EDGE_CLEARANCE_MM,
      widthMm: region.widthMm - STUDIO_EDGE_CLEARANCE_MM * 2,
      heightMm: region.heightMm - STUDIO_EDGE_CLEARANCE_MM * 2,
    }))
    .filter((region) => region.widthMm > 0 && region.heightMm > 0);
}

function displayMm(value: number) {
  return Math.round(value).toLocaleString("th-TH");
}

export function counterShapeLabel(shape: CounterShape, dimensions: StudioDimensions) {
  if (shape === "I") return `I-SHAPE · ${displayMm(dimensions.runAMm)} × ${displayMm(dimensions.depthMm)} mm`;
  if (shape === "L") {
    return `L-SHAPE · A ${displayMm(dimensions.runAMm)} × B ${displayMm(dimensions.runBMm)} × ลึก ${displayMm(dimensions.depthMm)} mm`;
  }
  return `U-SHAPE · A ${displayMm(dimensions.runAMm)} × B ${displayMm(dimensions.runBMm)} × C ${displayMm(dimensions.runCMm)} × ลึก ${displayMm(dimensions.depthMm)} mm`;
}

function placementFitsRegion(
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">,
  region: CounterRegion,
) {
  return placement.widthMm !== null &&
    placement.depthMm !== null &&
    placement.xMm >= region.xMm - STUDIO_CLEARANCE_EPSILON_MM &&
    placement.yMm >= region.yMm - STUDIO_CLEARANCE_EPSILON_MM &&
    placement.xMm + placement.widthMm <= region.xMm + region.widthMm + STUDIO_CLEARANCE_EPSILON_MM &&
    placement.yMm + placement.depthMm <= region.yMm + region.heightMm + STUDIO_CLEARANCE_EPSILON_MM;
}

export function placementFitsCounterShape(
  shape: CounterShape,
  dimensions: StudioDimensions,
  placement: Pick<BasinPlacement, "xMm" | "yMm" | "widthMm" | "depthMm">,
  clearance = true,
) {
  const regions = clearance ? counterClearanceRegions(shape, dimensions) : counterRegions(shape, dimensions);
  return regions.some((region) => placementFitsRegion(placement, region));
}

function usableRuns(shape: CounterShape, dimensions: StudioDimensions) {
  const runs = [dimensions.runAMm];
  if (shape === "L" || shape === "U") runs.push(dimensions.runBMm);
  if (shape === "U") runs.push(dimensions.runCMm);
  return runs;
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
  return (totalRunMm * backsplash.heightMm) / 1_000_000;
}

export function standardSheetWarning(shape: CounterShape, dimensions: StudioDimensions) {
  const runs = usableRuns(shape, dimensions);
  return runs.some((run) => run > 3600) || dimensions.depthMm > 760;
}

export function basinDimensionsForProduct(product?: BasinProduct) {
  const values = product?.basinDimensions?.match(/\d+/g)?.map(Number) ?? [];
  return { widthMm: values[0] ?? null, depthMm: values[1] ?? null };
}

export function unsafeBasinPlacements(
  state: Pick<StudioState, "shape" | "dimensions" | "basinPlacements">,
) {
  return state.basinPlacements
    .filter((placement) =>
      placement.widthMm !== null &&
      placement.depthMm !== null &&
      !placementFitsCounterShape(state.shape, state.dimensions, placement),
    )
    .map((placement) => placement.id);
}

export function unknownBasinPlacements(
  state: Pick<StudioState, "basinPlacements">,
) {
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
  const widthMm = placement.widthMm ?? 0;
  const depthMm = placement.depthMm ?? 0;
  const regions = counterRegions(shape, dimensions)
    .map((region) => ({
      ...region,
      widthMm: region.widthMm - widthMm,
      heightMm: region.heightMm - depthMm,
    }))
    .filter((region) => region.widthMm >= 0 && region.heightMm >= 0);
  const candidates = regions.map((region) => ({
    xMm: Math.max(region.xMm, Math.min(region.xMm + region.widthMm, xMm)),
    yMm: Math.max(region.yMm, Math.min(region.yMm + region.heightMm, yMm)),
  }));
  if (!candidates.length) {
    const bounds = counterBounds(shape, dimensions);
    return {
      xMm: Math.max(0, Math.min(bounds.widthMm - widthMm, xMm)),
      yMm: Math.max(0, Math.min(bounds.heightMm - depthMm, yMm)),
    };
  }
  return candidates.reduce((closest, candidate) => {
    const closestDistance = (closest.xMm - xMm) ** 2 + (closest.yMm - yMm) ** 2;
    const candidateDistance = (candidate.xMm - xMm) ** 2 + (candidate.yMm - yMm) ** 2;
    return candidateDistance < closestDistance ? candidate : closest;
  });
}

function snapNearClearance(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) return value;
  if (Math.abs(value - minimum) <= STUDIO_SNAP_DISTANCE_MM) return minimum;
  if (Math.abs(value - maximum) <= STUDIO_SNAP_DISTANCE_MM) return maximum;
  return value;
}

export function snapBasinPlacementPosition(
  placement: Pick<BasinPlacement, "widthMm" | "depthMm">,
  xMm: number,
  yMm: number,
  dimensions: StudioDimensions,
  shape: CounterShape = "I",
) {
  const clamped = clampBasinPlacementPosition(placement, xMm, yMm, dimensions, shape);
  const clearanceRegions = counterClearanceRegions(shape, dimensions);
  const matchingRegion = clearanceRegions.find((region) =>
    placement.widthMm !== null &&
    placement.depthMm !== null &&
    clamped.xMm >= region.xMm - STUDIO_SNAP_DISTANCE_MM &&
    clamped.xMm <= region.xMm + region.widthMm - placement.widthMm + STUDIO_SNAP_DISTANCE_MM &&
    clamped.yMm >= region.yMm - STUDIO_SNAP_DISTANCE_MM &&
    clamped.yMm <= region.yMm + region.heightMm - placement.depthMm + STUDIO_SNAP_DISTANCE_MM,
  );
  if (!matchingRegion) return clamped;
  const maxX = matchingRegion.xMm + matchingRegion.widthMm - (placement.widthMm ?? 0);
  const maxY = matchingRegion.yMm + matchingRegion.heightMm - (placement.depthMm ?? 0);
  return {
    xMm: placement.widthMm === null
      ? clamped.xMm
      : snapNearClearance(clamped.xMm, matchingRegion.xMm, maxX),
    yMm: placement.depthMm === null
      ? clamped.yMm
      : snapNearClearance(clamped.yMm, matchingRegion.yMm, maxY),
  };
}

export function studioEstimate(
  state: StudioState,
  products: BasinProduct[],
): StudioEstimate {
  const counterArea = counterAreaSqM(state.shape, state.dimensions);
  const backsplashArea = backsplashAreaSqM(state.shape, state.dimensions, state.backsplash);
  const stoneArea = counterArea + backsplashArea;
  const price = stoneInstalledUnitPrice(state.activeStone);
  const stoneTotal = price === null ? 0 : Math.round(stoneArea * price);
  const basinSetSkus = state.basinPlacements.length ? state.basinPlacements.map((placement) => placement.sku) : state.basinSkus;
  const basins = basinSetSkus.map((sku) => products.find((product) => product.sku === sku)).filter(Boolean) as BasinProduct[];
  const basinSubtotal = basins.reduce((sum, product) => sum + product.priceTHB, 0);
  const requestedInstallation = basins.length * INSTALLATION_PRICE;
  const installationDiscount = basins.length >= 3 ? requestedInstallation : 0;
  const installationCharge = requestedInstallation - installationDiscount;
  const minimumArea = state.location === "bangkok-metro" ? STONE_INSTALLED_MIN_BANGKOK_SQM : STONE_INSTALLED_MIN_PROVINCE_SQM;
  const smallJobFee = price !== null && stoneArea > 0 && stoneArea < minimumArea
    ? state.location === "bangkok-metro" ? STONE_SMALL_JOB_BANGKOK_FEE : STONE_SMALL_JOB_PROVINCE_FEE
    : 0;
  const subtotal = stoneTotal + basinSubtotal + installationCharge + smallJobFee;
  const vatAmount = state.vat ? Math.round(subtotal * 0.07) : 0;
  const unsafe = unsafeBasinPlacements(state);
  const unknownDimensions = unknownBasinPlacements(state);
  const sheetWarning = standardSheetWarning(state.shape, state.dimensions);
  const standardSheetMessage = sheetWarning
    ? `บางช่วงยาวหรือมีความลึกเกินแผ่นมาตรฐาน ${STONE_SHEET_SIZE} ต้องตรวจสอบการต่อแผ่นกับทีมขาย`
    : "";
  return {
    counterAreaSqM: counterArea,
    backsplashAreaSqM: backsplashArea,
    stoneAreaSqM: stoneArea,
    stoneUnitPriceTHB: price,
    stoneTotalTHB: stoneTotal,
    basinSubtotalTHB: basinSubtotal,
    installationChargeTHB: installationCharge,
    installationDiscountTHB: installationDiscount,
    smallJobFeeTHB: smallJobFee,
    subtotalTHB: subtotal,
    vatAmountTHB: vatAmount,
    totalTHB: subtotal + vatAmount,
    standardSheetWarning: sheetWarning,
    standardSheetMessage,
    unsafePlacements: unsafe,
    unknownDimensionPlacements: unknownDimensions,
    isValid: state.stoneColors.length >= STUDIO_MIN_STONE_COLORS &&
      state.stoneColors.length <= STUDIO_MAX_STONE_COLORS &&
      state.basinSkus.length >= STUDIO_MIN_BASINS &&
      state.basinSkus.length <= STUDIO_MAX_BASINS &&
      state.basinPlacements.length >= state.basinSkus.length &&
      price !== null &&
      !unsafe.length &&
      !unknownDimensions.length &&
      state.dimensions.depthMm > 0 &&
      usableRuns(state.shape, state.dimensions).every((run) => run > 0),
  };
}

export function studioSubmissionValidationMessage(
  state: StudioState,
  estimate: Pick<StudioEstimate, "isValid" | "unknownDimensionPlacements" | "unsafePlacements">,
) {
  const placedSkus = new Set(state.basinPlacements.map((placement) => placement.sku));
  const hasMissingSelectedBasin = state.basinSkus.some((sku) => !placedSkus.has(sku));
  const hasInvalidCounterDimensions = [state.dimensions.depthMm, state.dimensions.runAMm]
    .concat(state.shape === "I" ? [] : state.dimensions.runBMm)
    .concat(state.shape === "U" ? state.dimensions.runCMm : [])
    .some((value) => !Number.isFinite(value) || value <= 0);

  if (state.basinPlacements.length === 0) {
    return "ยังไม่ได้วางอ่างบนผัง กรุณาลากอ่างที่เลือกไปวางบนผัง";
  }
  if (state.basinPlacements.length < state.basinSkus.length || hasMissingSelectedBasin) {
    return `ยังวางอ่างไม่ครบทุกแบบที่เลือก (เลือก ${state.basinSkus.length} รุ่น · วางแล้ว ${state.basinPlacements.length} ตัว) กรุณาลากอ่างที่เลือกวางบนผังให้ครบ`;
  }
  if (estimate.unknownDimensionPlacements.length > 0) {
    return "รุ่นที่เลือกยังไม่ระบุขนาดหลุม ต้องยืนยันขนาดกับทีมขายก่อนส่งคำขอ";
  }
  if (estimate.unsafePlacements.length > 0) {
    return "กรุณาขยับอ่างให้ขอบอยู่บนเส้น 50 mm ได้พอดี หากพื้นที่ไม่พอ ให้เพิ่มความลึกเคาน์เตอร์ เช่น 700 mm ก่อนส่งคำขอ";
  }
  if (hasInvalidCounterDimensions) {
    return "ขนาดเคาน์เตอร์ไม่ถูกต้อง กรุณาตรวจสอบความลึกและความยาวของเคาน์เตอร์ให้มากกว่า 0 mm";
  }
  if (!estimate.isValid) {
    return "กรุณาตรวจสอบข้อมูลแบบและวัสดุก่อนส่งคำขอ";
  }
  return null;
}

export function createBasinPlacement(product: BasinProduct, index: number): BasinPlacement {
  const size = basinDimensionsForProduct(product);
  return { id: `${product.sku}-${index}-${Date.now()}`, sku: product.sku, xMm: STUDIO_EDGE_CLEARANCE_MM, yMm: STUDIO_EDGE_CLEARANCE_MM, ...size };
}

export function studioStoneName(code: string) {
  return stoneColorByName(code).name;
}