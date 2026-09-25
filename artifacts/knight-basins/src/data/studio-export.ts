import {
  counterBounds,
  counterDimensionsValid,
  counterRegions,
  calculateBasinCoordinates,
  placementCutSize,
  studioPieceEdges,
  studioPieceJoints,
  studioPieces,
  studioRectangleSize,
  studioStateDimensionsValid,
  type CounterShape,
  type StudioEdge,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "./studio-model.ts";

export const STUDIO_EXPORT_LAYERS = [
  "PIECE_OUTLINE",
  "PANEL_JOINT",
  "UPSTAND",
  "OPEN_EDGE",
  "WALL_FLUSH",
  "BASIN_HOLES",
  "BASIN_LABELS",
  "DIMENSIONS",
  "NOTE",
] as const;

export const STUDIO_EXPORT_NOTE = "REFERENCE DRAWING ONLY - NOT FOR PRODUCTION OR CNC. VERIFY ON SITE BEFORE FABRICATION.";
export const STUDIO_PRINT_NOTE = "แบบอ้างอิงเพื่อการนำเสนอ ไม่ใช่แบบผลิตหรือแบบ CNC — ต้องตรวจสอบหน้างานก่อนผลิต";
const PLACEHOLDER_LABEL_BOX = { widthMm: 180, heightMm: 70 };
const PIECE_GAP_MM = 450;

export type StudioExportPoint = { xMm: number; yMm: number };
export type StudioExportRectangle = StudioExportPoint & { widthMm: number; heightMm: number; rectangleId: string; pieceId: string };
export type StudioExportBasin = {
  sku: string;
  pieceId: string;
  sheetId?: string;
  xMm: number;
  yMm: number;
  widthMm: number | null;
  heightMm: number | null;
  label: string;
  dxfLabel: string;
  unknownDimensions: boolean;
};

export type StudioExportPiece = {
  piece: StudioPiece;
  bounds: { widthMm: number; heightMm: number };
  rectangles: StudioExportRectangle[];
  edges: StudioEdge[];
  joints: ReturnType<typeof studioPieceJoints>;
  offsetY: number;
};

export type StudioExportModel = {
  pieces: StudioExportPiece[];
  basins: StudioExportBasin[];
  note: string;
  pieceCount: number;
  rectangleCount: number;
  totalAreaSqM: number;
};

function positive(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function dxfNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function dxfText(value: string) {
  return value.replace(/[^\x00-\x7F]/g, "?").replace(/\r?\n/g, " ").replace(/\\/g, "\\\\");
}

function offsetPoint(point: StudioExportPoint, offsetY: number): StudioExportPoint {
  return { xMm: point.xMm, yMm: point.yMm + offsetY };
}

function dxfLine(layer: string, start: StudioExportPoint, end: StudioExportPoint) {
  return ["0", "LINE", "8", layer, "10", dxfNumber(start.xMm), "20", dxfNumber(start.yMm), "30", "0", "11", dxfNumber(end.xMm), "21", dxfNumber(end.yMm), "31", "0"].join("\n");
}

function dxfPolyline(layer: string, points: StudioExportPoint[], closed = false) {
  return ["0", "LWPOLYLINE", "8", layer, "90", String(points.length), "70", closed ? "1" : "0", ...points.flatMap((point) => ["10", dxfNumber(point.xMm), "20", dxfNumber(point.yMm)])].join("\n");
}

function dxfRectangle(layer: string, rectangle: StudioExportRectangle | (StudioExportPoint & { widthMm: number; heightMm: number }), offsetY = 0, closed = true) {
  const points = [
    { xMm: rectangle.xMm, yMm: rectangle.yMm },
    { xMm: rectangle.xMm + rectangle.widthMm, yMm: rectangle.yMm },
    { xMm: rectangle.xMm + rectangle.widthMm, yMm: rectangle.yMm + rectangle.heightMm },
    { xMm: rectangle.xMm, yMm: rectangle.yMm + rectangle.heightMm },
  ].map((point) => offsetPoint(point, offsetY));
  return dxfPolyline(layer, points, closed);
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
    ...STUDIO_EXPORT_LAYERS.flatMap((layer) => ["0", "LAYER", "2", layer, "70", "0", "62", "7", "6", layer === "PANEL_JOINT" ? "DASHED" : "CONTINUOUS"]),
    "0", "ENDTAB",
    "0", "ENDSEC",
  ].join("\n");
}

function edgeLayer(edge: StudioEdge) {
  if (edge.status === "upstand") return "UPSTAND";
  if (edge.status === "open-edge") return "OPEN_EDGE";
  if (edge.status === "wall-flush") return "WALL_FLUSH";
  return null;
}

export function createStudioExportModel(state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">): StudioExportModel {
  const pieces = studioPieces(state);
  let offsetY = 0;
  const exportPieces = pieces.map((piece) => {
    const bounds = piece.rectangles.reduce((current, rectangle) => {
      const size = studioRectangleSize(rectangle);
      return { widthMm: Math.max(current.widthMm, rectangle.xMm + size.widthMm), heightMm: Math.max(current.heightMm, rectangle.yMm + size.heightMm) };
    }, { widthMm: 1, heightMm: 1 });
    const exportPiece: StudioExportPiece = {
      piece,
      bounds,
      rectangles: piece.rectangles.map((rectangle) => {
        const size = studioRectangleSize(rectangle);
        return { pieceId: piece.id, rectangleId: rectangle.id, xMm: rectangle.xMm, yMm: rectangle.yMm, widthMm: size.widthMm, heightMm: size.heightMm };
      }),
      edges: studioPieceEdges(piece),
      joints: studioPieceJoints(piece),
      offsetY,
    };
    offsetY += bounds.heightMm + PIECE_GAP_MM;
    return exportPiece;
  });
  const pieceMap = new Map(exportPieces.map((piece) => [piece.piece.id, piece]));
  const basins = state.basinPlacements.map((placement) => {
    const piece = pieceMap.get(placement.pieceId ?? pieces[0]?.id) ?? exportPieces[0];
    const sheet = piece?.piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId);
    const coordinates = sheet && placement.offsetXMm !== undefined && placement.offsetYMm !== undefined
      ? calculateBasinCoordinates(sheet, placement)
      : { xMm: placement.xMm, yMm: placement.yMm };
    const cutSize = placementCutSize(placement);
    const unknownDimensions = cutSize.widthMm === null || cutSize.heightMm === null;
    const basin = {
      pieceId: piece?.piece.id ?? "",
      sku: placement.sku,
      xMm: coordinates.xMm,
      yMm: coordinates.yMm,
      widthMm: cutSize.widthMm,
      heightMm: cutSize.heightMm,
      label: unknownDimensions ? "แคตตาล็อกไม่ระบุขนาดหลุม" : `${cutSize.widthMm} × ${cutSize.heightMm} mm`,
      dxfLabel: unknownDimensions ? "CUTOUT SIZE NOT SPECIFIED IN CATALOG" : `${cutSize.widthMm} x ${cutSize.heightMm} mm`,
      unknownDimensions,
    };
    return {
      ...basin,
      ...(placement.sheetId ? { sheetId: placement.sheetId } : {}),
    };
  });
  return {
    pieces: exportPieces,
    basins,
    note: STUDIO_EXPORT_NOTE,
    pieceCount: pieces.length,
    rectangleCount: pieces.reduce((sum, piece) => sum + piece.rectangles.length, 0),
    totalAreaSqM: exportPieces.reduce((sum, piece) => sum + piece.rectangles.reduce((area, rectangle) => area + rectangle.widthMm * rectangle.heightMm / 1_000_000, 0), 0),
  };
}

export function studioExportDimensionsValid(state: Pick<StudioState, "pieces" | "shape" | "dimensions">) {
  return state.pieces?.length ? studioStateDimensionsValid(state) : counterDimensionsValid(state.shape, state.dimensions);
}

export function createStudioDxf(state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">) {
  const model = createStudioExportModel(state);
  const entities: string[] = [];
  model.pieces.forEach((piece, pieceIndex) => {
    piece.rectangles.forEach((rectangle) => entities.push(dxfRectangle("PIECE_OUTLINE", rectangle, piece.offsetY)));
    piece.joints.forEach((joint) => {
      entities.push(dxfLine("PANEL_JOINT", offsetPoint(joint.first.start, piece.offsetY), offsetPoint(joint.first.end, piece.offsetY)));
      entities.push(dxfTextEntity("NOTE", "PANEL JOINT - VERIFY 90 DEGREE", offsetPoint(joint.first.start, piece.offsetY + 35), 18));
    });
    piece.edges.forEach((edge) => {
      const layer = edgeLayer(edge);
      if (layer && edge.exposedLengthMm > 0) entities.push(dxfLine(layer, offsetPoint(edge.start, piece.offsetY), offsetPoint(edge.end, piece.offsetY)));
    });
    piece.rectangles.forEach((rectangle) => {
      entities.push(dxfTextEntity("DIMENSIONS", `${rectangle.widthMm} x ${rectangle.heightMm} mm`, offsetPoint({ xMm: rectangle.xMm + rectangle.widthMm / 2, yMm: rectangle.yMm + 24 }, piece.offsetY), 18));
    });
    entities.push(dxfTextEntity("NOTE", `PIECE ${pieceIndex + 1}`, offsetPoint({ xMm: 0, yMm: -45 }, piece.offsetY), 24));
  });
  const pieceMap = new Map(model.pieces.map((piece) => [piece.piece.id, piece]));
  model.basins.forEach((basin) => {
    const piece = pieceMap.get(basin.pieceId);
    const offsetY = piece?.offsetY ?? 0;
    if (!basin.unknownDimensions && basin.widthMm !== null && basin.heightMm !== null) {
      entities.push(dxfRectangle("BASIN_HOLES", { xMm: basin.xMm, yMm: basin.yMm, widthMm: basin.widthMm, heightMm: basin.heightMm }, offsetY));
    } else {
      entities.push(dxfRectangle("BASIN_LABELS", { xMm: basin.xMm, yMm: basin.yMm, ...PLACEHOLDER_LABEL_BOX }, offsetY));
    }
    entities.push(dxfTextEntity("BASIN_LABELS", basin.sku, offsetPoint({ xMm: basin.xMm, yMm: basin.yMm + (basin.heightMm ?? PLACEHOLDER_LABEL_BOX.heightMm) + 35 }, offsetY), 28));
    entities.push(dxfTextEntity("BASIN_LABELS", basin.dxfLabel, offsetPoint({ xMm: basin.xMm, yMm: basin.yMm - 35 }, offsetY), 18));
  });
  const exportBottom = model.pieces.reduce((max, piece) => Math.max(max, piece.offsetY + piece.bounds.heightMm), 0);
  entities.push(dxfTextEntity("NOTE", model.note, { xMm: 0, yMm: exportBottom + 100 }, 24));
  return `${dxfHeader()}\n0\nSECTION\n2\nENTITIES\n${entities.join("\n")}\n0\nENDSEC\n0\nEOF\n`;
}

export function studioPrintTitle(value: string, pieceCountOrShape: number | CounterShape) {
  const safe = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "studio-layout";
  return typeof pieceCountOrShape === "number"
    ? `KF-Basins-${safe}-${pieceCountOrShape}ชิ้น`
    : `KF-Basins-${safe}-${pieceCountOrShape}`;
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

export function safeStudioExportName(value: string, pieceCount: number, extension: "dxf" | "pdf" | "png") {
  const safe = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "studio-layout";
  return `${safe}-${pieceCount}ชิ้น.${extension}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function svgColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function toneInk(tone: string) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(tone.slice(offset + 1, offset + 3), 16));
  const luminance = channels.reduce((sum, channel) => {
    const normalized = channel / 255;
    return sum + (normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4);
  }, 0);
  return luminance < 0.42 ? "#ffffff" : "#17324a";
}

export function createStudioPngSvg(
  state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">,
  stoneTone?: string,
) {
  const model = createStudioExportModel(state);
  const tone = svgColor(stoneTone, "#dce8ed");
  const ink = toneInk(tone);
  const padding = 90;
  const headerHeight = 92;
  const contentWidth = Math.max(1, ...model.pieces.map((piece) => piece.bounds.widthMm));
  const contentHeight = Math.max(1, ...model.pieces.map((piece) => piece.offsetY + piece.bounds.heightMm));
  const width = contentWidth + padding * 2;
  const height = contentHeight + padding * 2 + headerHeight;
  const edgeColors: Record<string, string> = {
    upstand: "#b26b00",
    "open-edge": "#bd3f38",
    "wall-flush": "#526b7a",
  };
  const pieceMarkup = model.pieces.map((piece, pieceIndex) => {
    const originY = padding + headerHeight + piece.offsetY;
    const rectangles = piece.rectangles.map((rectangle) => `
      <rect x="${rectangle.xMm}" y="${rectangle.yMm}" width="${rectangle.widthMm}" height="${rectangle.heightMm}" rx="8" fill="${tone}" stroke="${ink}" stroke-opacity=".56" stroke-width="7"/>
      <text x="${rectangle.xMm + rectangle.widthMm / 2}" y="${rectangle.yMm + rectangle.heightMm / 2}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="28" font-weight="700">${rectangle.widthMm} × ${rectangle.heightMm} mm</text>
    `).join("");
    const joints = piece.joints.map((joint) => `
      <line x1="${joint.first.start.xMm}" y1="${joint.first.start.yMm}" x2="${joint.first.end.xMm}" y2="${joint.first.end.yMm}" stroke="${ink}" stroke-width="10" stroke-dasharray="24 16" stroke-linecap="round"/>
    `).join("");
    const edges = piece.edges.filter((edge) => edge.status !== "normal" && edge.exposedLengthMm > 0).map((edge) => `
      <line x1="${edge.start.xMm}" y1="${edge.start.yMm}" x2="${edge.end.xMm}" y2="${edge.end.yMm}" stroke="${edgeColors[edge.status] ?? "#526b7a"}" stroke-width="12" stroke-linecap="round"/>
      <text x="${(edge.start.xMm + edge.end.xMm) / 2}" y="${(edge.start.yMm + edge.end.yMm) / 2}" fill="${edgeColors[edge.status] ?? "#526b7a"}" font-size="20" font-weight="700">${escapeSvg(studioSideStatusLabelForExport(edge.status))}</text>
    `).join("");
    const basins = model.basins.filter((basin) => basin.pieceId === piece.piece.id).map((basin) => {
      const basinWidth = basin.widthMm ?? 180;
      const basinHeight = basin.heightMm ?? 70;
      const label = basin.unknownDimensions ? `${basin.sku} · ขนาดหลุมไม่ระบุ` : `${basin.sku} · ${basin.widthMm} × ${basin.heightMm} mm`;
      return `
        <rect x="${basin.xMm}" y="${basin.yMm}" width="${basinWidth}" height="${basinHeight}" rx="10" fill="#ffffff" fill-opacity=".92" stroke="#17324a" stroke-width="7" ${basin.unknownDimensions ? 'stroke-dasharray="18 12"' : ""}/>
        <text x="${basin.xMm + basinWidth / 2}" y="${basin.yMm + basinHeight / 2}" text-anchor="middle" dominant-baseline="middle" fill="#17324a" font-size="20" font-weight="700">${escapeSvg(label)}</text>
      `;
    }).join("");
    return `
      <g transform="translate(${padding} ${originY})">
        <text x="0" y="-28" fill="#17324a" font-size="28" font-weight="700">${escapeSvg(piece.piece.name || `ชิ้นงาน ${pieceIndex + 1}`)}</text>
        ${rectangles}${joints}${edges}${basins}
      </g>
    `;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f7fafb"/>
    <text x="${padding}" y="${padding - 34}" fill="#17324a" font-size="34" font-weight="700">Knight Basins · Studio 2D</text>
    <text x="${padding}" y="${padding + 8}" fill="#526b7a" font-size="20">สีหิน: ${escapeSvg(stoneTone || "catalog fallback")} · ${model.pieceCount} ชิ้นงาน · ${model.rectangleCount} แผ่น</text>
    ${pieceMarkup}
    <text x="${padding}" y="${height - 34}" fill="#526b7a" font-size="18">${escapeSvg(STUDIO_PRINT_NOTE)} · หน่วยมิลลิเมตร</text>
  </svg>`;
}

function studioSideStatusLabelForExport(status: StudioEdge["status"]) {
  return { upstand: "ติดบัว", "open-edge": "ขอบเปิด", "wall-flush": "ชิดผนัง", "wall-flush+upstand": "ชิดผนัง+ติดบัว ║▲", normal: "" }[status];
}

export async function downloadStudioPng(
  state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">,
  name: string,
  stoneTone?: string,
) {
  if (typeof window === "undefined" || typeof document === "undefined") throw new Error("PNG export is only available in a browser");
  const svg = createStudioPngSvg(state, stoneTone);
  const image = new Image();
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("สร้างภาพ PNG ไม่สำเร็จ กรุณาลองอีกครั้ง"));
    image.src = source;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการสร้างภาพ PNG");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("สร้างไฟล์ PNG ไม่สำเร็จ กรุณาลองอีกครั้ง");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeStudioExportName(name, studioPieces(state).length, "png");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadStudioDxf(state: Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements">, name: string) {
  const blob = new Blob([createStudioDxf(state)], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeStudioExportName(name, studioPieces(state).length, "dxf");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}