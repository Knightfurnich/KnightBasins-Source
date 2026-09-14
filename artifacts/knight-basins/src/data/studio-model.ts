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
  widthMm: number;
  depthMm: number;
};

export type StudioState = {
  mode: StudioOrderMode;
  shape: CounterShape;
  dimensions: StudioDimensions;
  backsplash: BacksplashConfig;
  location: StudioLocation;
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
  totalTHB: number;
  standardSheetWarning: boolean;
  standardSheetMessage: string;
  unsafePlacements: string[];
  isValid: boolean;
};

export const STUDIO_EDGE_CLEARANCE_MM = 50;
export const STUDIO_MAX_STONE_COLORS = 3;
export const STUDIO_MIN_STONE_COLORS = 2;
export const STUDIO_MAX_BASINS = 2;
export const STUDIO_MIN_BASINS = 1;

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

function basinSize(product?: BasinProduct) {
  const values = product?.basinDimensions?.match(/\d+/g)?.map(Number) ?? [];
  return { widthMm: values[0] || 500, depthMm: values[1] || 500 };
}

export function unsafeBasinPlacements(
  state: Pick<StudioState, "shape" | "dimensions" | "basinPlacements">,
) {
  const maxX = Math.max(0, state.dimensions.runAMm);
  const maxY = Math.max(0, state.dimensions.depthMm);
  return state.basinPlacements
    .filter((placement) =>
      placement.xMm < STUDIO_EDGE_CLEARANCE_MM ||
      placement.yMm < STUDIO_EDGE_CLEARANCE_MM ||
      placement.xMm + placement.widthMm > maxX - STUDIO_EDGE_CLEARANCE_MM ||
      placement.yMm + placement.depthMm > maxY - STUDIO_EDGE_CLEARANCE_MM,
    )
    .map((placement) => placement.id);
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
  const unsafe = unsafeBasinPlacements(state);
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
    totalTHB: stoneTotal + basinSubtotal + installationCharge + smallJobFee,
    standardSheetWarning: sheetWarning,
    standardSheetMessage,
    unsafePlacements: unsafe,
    isValid: state.stoneColors.length >= STUDIO_MIN_STONE_COLORS &&
      state.stoneColors.length <= STUDIO_MAX_STONE_COLORS &&
      state.basinSkus.length >= STUDIO_MIN_BASINS &&
      state.basinSkus.length <= STUDIO_MAX_BASINS &&
      state.basinPlacements.length >= state.basinSkus.length &&
      price !== null &&
      !unsafe.length &&
      state.dimensions.depthMm > 0 &&
      usableRuns(state.shape, state.dimensions).every((run) => run > 0),
  };
}

export function createBasinPlacement(product: BasinProduct, index: number): BasinPlacement {
  const size = basinSize(product);
  return { id: `${product.sku}-${index}-${Date.now()}`, sku: product.sku, xMm: 70, yMm: 70, ...size };
}

export function studioStoneName(code: string) {
  return stoneColorByName(code).name;
}