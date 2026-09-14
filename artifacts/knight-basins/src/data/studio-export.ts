import { productBySku } from "./catalog.ts";
import {
  counterBounds,
  counterClearanceRegions,
  counterDimensionsValid,
  counterRegions,
  type CounterRegion,
  type CounterShape,
  type StudioDimensions,
  type StudioState,
} from "./studio-model.ts";

export const STUDIO_EXPORT_LAYERS = [
  "COUNTER_OUTLINE",
  "CLEARANCE_50",
  "BASIN_HOLES",
  "BASIN_LABELS",
  "DIMENSIONS",
  "NOTE",
] as const;

export const STUDIO_EXPORT_NOTE = "REFERENCE DRAWING ONLY - NOT FOR PRODUCTION OR CNC. VERIFY ON SITE BEFORE FABRICATION.";
export const STUDIO_PRINT_NOTE = "แบบอ้างอิงเพื่อการนำเสนอ ไม่ใช่แบบผลิตหรือแบบ CNC — ต้องตรวจสอบหน้างานก่อนผลิต";
const PLACEHOLDER_LABEL_BOX = { widthMm: 180, heightMm: 70 };

export type StudioExportPoint = { xMm: number; yMm: number };
export type StudioExportRectangle = StudioExportPoint & { widthMm: number; heightMm: number };
export type StudioExportDimension = {
  label: "A" | "B" | "C" | "ลึก";
  valueMm: number;
  start: StudioExportPoint;
  end: StudioExportPoint;
  text: StudioExportPoint;
};
export type StudioExportBasin = {
  sku: string;
  xMm: number;
  yMm: number;
  widthMm: number | null;
  heightMm: number | null;
  label: string;
  dxfLabel: string;
  unknownDimensions: boolean;
};

export type StudioExportModel = {
  shape: CounterShape;
  dimensions: StudioDimensions;
  bounds: { widthMm: number; heightMm: number };
  outline: StudioExportPoint[];
  counterRegions: CounterRegion[];
  clearanceRegions: CounterRegion[];
  basins: StudioExportBasin[];
  dimensionsAnnotations: StudioExportDimension[];
  note: string;
};

function positive(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Returns the single outline used by the Studio canvas and DXF. Regions remain
 * available separately for clearance because their overlap is intentional.
 */
export function counterOutlinePoints(shape: CounterShape, dimensions: StudioDimensions): StudioExportPoint[] {
  const depth = positive(dimensions.depthMm);
  const runA = positive(dimensions.runAMm);
  const runB = positive(dimensions.runBMm);
  const runC = positive(dimensions.runCMm);
  if (shape === "I") return [{ xMm: 0, yMm: 0 }, { xMm: runA, yMm: 0 }, { xMm: runA, yMm: depth }, { xMm: 0, yMm: depth }];
  if (shape === "L") {
    return [
      { xMm: 0, yMm: 0 }, { xMm: runA, yMm: 0 }, { xMm: runA, yMm: depth },
      { xMm: Math.min(depth, runA), yMm: depth }, { xMm: Math.min(depth, runA), yMm: runB }, { xMm: 0, yMm: runB },
    ];
  }
  const left = Math.min(depth, runA);
  const right = Math.max(left, runA - depth);
  return [
    { xMm: 0, yMm: 0 }, { xMm: runA, yMm: 0 }, { xMm: runA, yMm: runC },
    { xMm: right, yMm: runC }, { xMm: right, yMm: depth }, { xMm: left, yMm: depth },
    { xMm: left, yMm: runB }, { xMm: 0, yMm: runB },
  ];
}

function dimensionAnnotations(shape: CounterShape, dimensions: StudioDimensions, bounds: { widthMm: number; heightMm: number }) {
  const offset = Math.max(80, Math.min(180, Math.round(Math.max(dimensions.depthMm, 1) * 0.2)));
  const annotations: StudioExportDimension[] = [
    { label: "A", valueMm: dimensions.runAMm, start: { xMm: 0, yMm: -offset }, end: { xMm: dimensions.runAMm, yMm: -offset }, text: { xMm: dimensions.runAMm / 2, yMm: -offset - 25 } },
    { label: "ลึก", valueMm: dimensions.depthMm, start: { xMm: -offset, yMm: 0 }, end: { xMm: -offset, yMm: dimensions.depthMm }, text: { xMm: -offset - 25, yMm: dimensions.depthMm / 2 } },
  ];
  if (shape !== "I") annotations.push({ label: "B", valueMm: dimensions.runBMm, start: { xMm: -offset, yMm: 0 }, end: { xMm: -offset, yMm: dimensions.runBMm }, text: { xMm: -offset - 25, yMm: dimensions.runBMm / 2 } });
  if (shape === "U") annotations.push({ label: "C", valueMm: dimensions.runCMm, start: { xMm: bounds.widthMm + offset, yMm: 0 }, end: { xMm: bounds.widthMm + offset, yMm: dimensions.runCMm }, text: { xMm: bounds.widthMm + offset + 25, yMm: dimensions.runCMm / 2 } });
  return annotations;
}

export function createStudioExportModel(state: Pick<StudioState, "shape" | "dimensions" | "basinPlacements">): StudioExportModel {
  const bounds = counterBounds(state.shape, state.dimensions);
  return {
    shape: state.shape,
    dimensions: state.dimensions,
    bounds,
    outline: counterOutlinePoints(state.shape, state.dimensions),
    counterRegions: counterRegions(state.shape, state.dimensions),
    clearanceRegions: counterClearanceRegions(state.shape, state.dimensions),
    basins: state.basinPlacements.map((placement) => {
      const product = productBySku(placement.sku);
      const unknownDimensions = placement.widthMm === null || placement.depthMm === null;
      return {
        sku: placement.sku,
        xMm: placement.xMm,
        yMm: placement.yMm,
        widthMm: placement.widthMm,
        heightMm: placement.depthMm,
        label: unknownDimensions ? "แคตตาล็อกไม่ระบุขนาดหลุม" : `${placement.widthMm} × ${placement.depthMm} mm`,
        dxfLabel: unknownDimensions ? "CUTOUT SIZE NOT SPECIFIED IN CATALOG" : `${placement.widthMm} x ${placement.depthMm} mm`,
        unknownDimensions,
      };
    }),
    dimensionsAnnotations: dimensionAnnotations(state.shape, state.dimensions, bounds),
    note: STUDIO_EXPORT_NOTE,
  };
}

export function studioExportDimensionsValid(state: Pick<StudioState, "shape" | "dimensions">) {
  return counterDimensionsValid(state.shape, state.dimensions);
}

function dxfNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function dxfText(value: string) {
  return value.replace(/\r?\n/g, " ").replace(/\\/g, "\\\\");
}

function dxfLine(layer: string, start: StudioExportPoint, end: StudioExportPoint) {
  return ["0", "LINE", "8", layer, "10", dxfNumber(start.xMm), "20", dxfNumber(start.yMm), "30", "0", "11", dxfNumber(end.xMm), "21", dxfNumber(end.yMm), "31", "0"].join("\n");
}

function dxfPolyline(layer: string, points: StudioExportPoint[], closed = false) {
  return ["0", "LWPOLYLINE", "8", layer, "90", String(points.length), "70", closed ? "1" : "0", ...points.flatMap((point) => ["10", dxfNumber(point.xMm), "20", dxfNumber(point.yMm)])].join("\n");
}

function dxfRectangle(layer: string, rectangle: StudioExportRectangle, closed = true) {
  return dxfPolyline(layer, [
    { xMm: rectangle.xMm, yMm: rectangle.yMm },
    { xMm: rectangle.xMm + rectangle.widthMm, yMm: rectangle.yMm },
    { xMm: rectangle.xMm + rectangle.widthMm, yMm: rectangle.yMm + rectangle.heightMm },
    { xMm: rectangle.xMm, yMm: rectangle.yMm + rectangle.heightMm },
  ], closed);
}

function dxfTextEntity(layer: string, value: string, position: StudioExportPoint, heightMm: number) {
  return ["0", "TEXT", "8", layer, "10", dxfNumber(position.xMm), "20", dxfNumber(position.yMm), "30", "0", "40", dxfNumber(heightMm), "1", dxfText(value), "7", "Standard"].join("\n");
}

function dxfHeader() {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1015",
    "9", "$INSUNITS", "70", "4",
    "9", "$MEASUREMENT", "70", "1",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LTYPE", "70", "2",
    "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0",
    "0", "LTYPE", "2", "DASHED", "70", "0", "3", "Dashed line", "72", "65", "73", "2", "40", "12", "49", "6", "49", "-6",
    "0", "ENDTAB",
    "0", "TABLE", "2", "LAYER", "70", String(STUDIO_EXPORT_LAYERS.length),
    ...STUDIO_EXPORT_LAYERS.flatMap((layer) => ["0", "LAYER", "2", layer, "70", "0", "62", "7", "6", layer === "CLEARANCE_50" ? "DASHED" : "CONTINUOUS"]),
    "0", "ENDTAB",
    "0", "ENDSEC",
  ].join("\n");
}

export function createStudioDxf(state: Pick<StudioState, "shape" | "dimensions" | "basinPlacements">) {
  const model = createStudioExportModel(state);
  const entities: string[] = [dxfPolyline("COUNTER_OUTLINE", model.outline, true)];
  model.clearanceRegions.forEach((region) => entities.push(dxfRectangle("CLEARANCE_50", region)));
  model.basins.forEach((basin) => {
    if (!basin.unknownDimensions && basin.widthMm !== null && basin.heightMm !== null) {
      entities.push(dxfRectangle("BASIN_HOLES", { xMm: basin.xMm, yMm: basin.yMm, widthMm: basin.widthMm, heightMm: basin.heightMm }));
      entities.push(dxfTextEntity("BASIN_LABELS", basin.sku, { xMm: basin.xMm, yMm: basin.yMm + basin.heightMm + 35 }, 28));
      entities.push(dxfTextEntity("BASIN_LABELS", basin.dxfLabel, { xMm: basin.xMm, yMm: basin.yMm - 35 }, 18));
    } else {
      entities.push(dxfRectangle("BASIN_LABELS", { ...basin, ...PLACEHOLDER_LABEL_BOX }));
      entities.push(dxfTextEntity("BASIN_LABELS", basin.sku, { xMm: basin.xMm, yMm: basin.yMm + PLACEHOLDER_LABEL_BOX.heightMm + 35 }, 28));
      entities.push(dxfTextEntity("BASIN_LABELS", basin.dxfLabel, { xMm: basin.xMm, yMm: basin.yMm - 35 }, 18));
    }
  });
  model.dimensionsAnnotations.forEach((dimension) => {
    entities.push(dxfLine("DIMENSIONS", dimension.start, dimension.end));
    entities.push(dxfTextEntity("DIMENSIONS", `${dimension.label === "ลึก" ? "DEPTH" : dimension.label} ${dimension.valueMm} mm`, dimension.text, 22));
  });
  entities.push(dxfTextEntity("NOTE", model.note, { xMm: 0, yMm: model.bounds.heightMm + 240 }, 24));
  return `${dxfHeader()}\n0\nSECTION\n2\nENTITIES\n${entities.join("\n")}\n0\nENDSEC\n0\nEOF\n`;
}

export function studioPrintTitle(value: string, shape: CounterShape) {
  const safe = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "studio-layout";
  return `KF-Basins-${safe}-${shape}`;
}

export function printStudioLayout(title: string) {
  if (typeof window === "undefined") return;
  const printClass = "studio-print-mode";
  const previousTitle = document.title;
  const cleanup = () => {
    document.body.classList.remove(printClass);
    document.title = previousTitle;
  };
  document.title = title;
  document.body.classList.add(printClass);
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 1000);
  }, 0);
}

export function safeStudioExportName(value: string, shape: CounterShape, extension: "dxf" | "pdf") {
  const safe = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "studio-layout";
  return `${safe}-${shape}.${extension}`;
}

export async function downloadStudioDxf(state: Pick<StudioState, "shape" | "dimensions" | "basinPlacements">, name: string) {
  const blob = new Blob([createStudioDxf(state)], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeStudioExportName(name, state.shape, "dxf");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}