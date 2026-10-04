import {
  PRODUCTS,
  STONE_COLORS,
  stoneColorByName,
  stoneSheetUnitPrice,
  type BasinProduct,
  type StoneColor,
} from "./catalog.ts";
import { calculateFormalQuoteTotals } from "./quote-utils.ts";
import {
  studioEstimate,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "./studio-model.ts";

// job-256: what the /sketch page (hand-sketch mode) needs to let the customer correct what the AI read, pick a stone and a
// basin per piece, and see a price only once the stone is chosen. Pure functions, no React. Every price comes from the
// system's own calculators: studioEstimate (installed top, THB per m2) or stoneSheetUnitPrice (sheet, THB per sheet).

export const SKETCH_MM_MAX = 10_000;
export const SKETCH_SHEETS_MAX = 999;
export const SKETCH_NO_STONE_MESSAGE = "ยังไม่เลือกสีหิน";
export const SKETCH_BASIN_NOT_IN_CATALOG = "แคตตาล็อกไม่ระบุ";

export type SketchOrderType = "fabrication" | "sheet";

/** A cut-out slot value meaning "the customer buys the basin elsewhere": no KFxxx model, no basin price. */
export const SKETCH_OWN_BASIN = "own";
export const SKETCH_OWN_BASIN_LABEL = "ลูกค้าซื้ออ่างเอง (ไม่ซื้อกับเรา)";
export const SKETCH_OWN_BASIN_WARNING = "ต้องตรงกับอ่างที่ลูกค้าซื้อมาเอง";
export const SKETCH_OWN_BASIN_NO_SIZE_NOTE = "ยังไม่ระบุขนาดหลุมเจาะ (ยืนยันก่อนผลิต)";
const OWN_BASIN_SIZE_MAX_LENGTH = 60;

/** The optional cut-out size a customer typed for their own basin, cleaned up; null when left empty. Never an error. */
export function cleanOwnBasinSize(text: string | undefined): string | null {
  const cleaned = Array.from(text ?? "").map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "<" || char === ">" ? " " : char)).join("").replace(/\s+/g, " ").trim().slice(0, OWN_BASIN_SIZE_MAX_LENGTH);
  return cleaned || null;
}

export const DEFAULT_SKETCH_ORDER_TYPE: SketchOrderType = "fabrication";

export const SKETCH_ORDER_TYPES: ReadonlyArray<{ value: SketchOrderType; label: string; unitLabel: string }> = [
  { value: "fabrication", label: "สั่งทำท็อปครัว/เคาน์เตอร์ (รวมติดตั้ง)", unitLabel: "บาท/ตร.ม." },
  { value: "sheet", label: "ซื้อแผ่นหินมาตรฐาน (สำหรับช่าง/โรงงาน)", unitLabel: "บาท/แผ่น" },
];

/** A whole positive number of millimetres, up to SKETCH_MM_MAX. Anything else (blank, 12.5, -3, 0, "abc", 1e3) is null. */
export function parseSketchMm(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 && value <= SKETCH_MM_MAX ? value : null;
}

/** The warning to show under a size box, or null when the value can be used. */
export function sketchMmWarning(text: string): string | null {
  if (parseSketchMm(text) !== null) return null;
  const trimmed = text.trim();
  if (!trimmed) return "กรุณากรอกขนาด (มม.)";
  if (/^\d+$/.test(trimmed) && Number(trimmed) > SKETCH_MM_MAX) return `ขนาดต้องไม่เกิน ${SKETCH_MM_MAX.toLocaleString("en-US")} มม.`;
  return "ขนาดต้องเป็นจำนวนเต็มบวก (มม.)";
}

export function parseSketchSheets(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 && value <= SKETCH_SHEETS_MAX ? value : null;
}

export function sketchSheetsWarning(text: string): string | null {
  if (parseSketchSheets(text) !== null) return null;
  return text.trim() ? `จำนวนแผ่นต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง ${SKETCH_SHEETS_MAX}` : "กรุณากรอกจำนวนแผ่น";
}

/** The colours that can be picked for an order type: installed tops need an installed price, sheets need a sheet price. */
export function sketchStoneChoices(orderType: SketchOrderType, colors: ReadonlyArray<StoneColor> = STONE_COLORS): StoneColor[] {
  return colors.filter((color) => (orderType === "sheet" ? color.sheetPriceTHB !== null : color.installedPriceTHB !== null));
}

// ---- basins ------------------------------------------------------------------------------------------------------------

export type SketchBasinCutout = {
  /** What to show: "Ø350x150" for a round bowl, "350x500x130" for a rectangular one, "แคตตาล็อกไม่ระบุ" when the catalogue has no size. */
  label: string;
  specified: boolean;
  round: boolean;
  /** Cut-out width, or the diameter of a round bowl. */
  widthMm: number | null;
  /** Cut-out depth; equal to the diameter for a round bowl (a circle is as deep as it is wide in plan view). */
  depthMm: number | null;
  bowlDepthMm: number | null;
};

/**
 * The real cut-out of a catalogue basin (its bowl size). A round bowl is written with the diameter sign "Ø" -- the app tells round
 * from rectangular by that character only, so a label that came out as "D350x150" would be read as a rectangle. A product with no
 * bowl size in the catalogue (KF029, KF030) is "แคตตาล็อกไม่ระบุ", never a guessed number.
 */
export function sketchBasinCutout(product: Pick<BasinProduct, "basinDimensions">): SketchBasinCutout {
  const raw = product.basinDimensions?.trim() ?? "";
  const numbers = raw.match(/\d+/g)?.map(Number) ?? [];
  if (!raw || numbers.length < 2) {
    return { label: SKETCH_BASIN_NOT_IN_CATALOG, specified: false, round: false, widthMm: null, depthMm: null, bowlDepthMm: null };
  }
  const round = /[Øø]/.test(raw);
  if (round) {
    return { label: `Ø${numbers.join("x")}`, specified: true, round: true, widthMm: numbers[0] ?? null, depthMm: numbers[0] ?? null, bowlDepthMm: numbers[1] ?? null };
  }
  return { label: numbers.join("x"), specified: true, round: false, widthMm: numbers[0] ?? null, depthMm: numbers[1] ?? null, bowlDepthMm: numbers[2] ?? null };
}

/** KF001-KF030, in catalogue order. */
export function sketchBasinChoices(products: ReadonlyArray<BasinProduct> = PRODUCTS): BasinProduct[] {
  return products
    .filter((product) => /^KF0(0[1-9]|[12]\d|30)$/.test(product.sku))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

// ---- pieces ------------------------------------------------------------------------------------------------------------

export type SketchPanelBase = { index: number; label: string; lengthMm: number | null; depthMm: number | null };

/** What the AI read for one piece (or the manual default when there is no picture analysis). */
export type SketchPieceBase = {
  key: string;
  label: string;
  lengthMm: number | null;
  depthMm: number | null;
  panels: SketchPanelBase[];
  /** Basin cut-outs the AI found on this piece. */
  basinCutouts: number;
};

/** What the customer changed. Text fields stay as typed so a half-typed or invalid value can be shown and warned about. */
export type SketchPieceEdit = {
  lengthText?: string;
  depthText?: string;
  panels?: Record<number, { lengthText?: string; depthText?: string }>;
  /** undefined = untouched (no stone), null = cleared. */
  stoneCode?: string | null;
  /** One entry per basin cut-out: a KFxxx sku, SKETCH_OWN_BASIN, or null (not chosen yet). */
  basinSkus?: Array<string | null>;
  /** The optional hole size typed for a cut-out whose basin the customer buys themselves, by cut-out index. */
  ownBasinSizes?: Record<number, string>;
  sheetsText?: string;
};

export type SketchResolvedPanel = SketchPanelBase & {
  lengthText: string;
  depthText: string;
  lengthWarning: string | null;
  depthWarning: string | null;
};

export type SketchResolvedPiece = {
  key: string;
  label: string;
  lengthText: string;
  depthText: string;
  lengthWarning: string | null;
  depthWarning: string | null;
  panels: SketchResolvedPanel[];
  /** Square metres, from the panels when there are any, otherwise from the overall size. Null while any size is invalid. */
  areaSqM: number | null;
  stoneCode: string | null;
  basinSkus: Array<string | null>;
  ownBasinSizes: Record<number, string>;
  sheetsText: string;
  sheetsWarning: string | null;
  sizeValid: boolean;
};

const textOf = (value: number | null) => (value === null ? "" : String(value));

export function resolveSketchPiece(base: SketchPieceBase, edit: SketchPieceEdit = {}): SketchResolvedPiece {
  const lengthText = edit.lengthText ?? textOf(base.lengthMm);
  const depthText = edit.depthText ?? textOf(base.depthMm);
  const panels: SketchResolvedPanel[] = base.panels.map((panel) => {
    const panelEdit = edit.panels?.[panel.index];
    const panelLength = panelEdit?.lengthText ?? textOf(panel.lengthMm);
    const panelDepth = panelEdit?.depthText ?? textOf(panel.depthMm);
    return { ...panel, lengthText: panelLength, depthText: panelDepth, lengthWarning: sketchMmWarning(panelLength), depthWarning: sketchMmWarning(panelDepth) };
  });
  const lengthWarning = sketchMmWarning(lengthText);
  const depthWarning = sketchMmWarning(depthText);
  const sizeValid = !lengthWarning && !depthWarning && panels.every((panel) => !panel.lengthWarning && !panel.depthWarning);
  let areaSqM: number | null = null;
  if (sizeValid) {
    const sqMm = panels.length > 0
      ? panels.reduce((sum, panel) => sum + (parseSketchMm(panel.lengthText) ?? 0) * (parseSketchMm(panel.depthText) ?? 0), 0)
      : (parseSketchMm(lengthText) ?? 0) * (parseSketchMm(depthText) ?? 0);
    areaSqM = sqMm / 1_000_000;
  }
  const slotCount = Math.max(base.basinCutouts, edit.basinSkus?.length ?? 0);
  const basinSkus = Array.from({ length: slotCount }, (_, index) => edit.basinSkus?.[index] ?? null);
  const sheetsText = edit.sheetsText ?? "1";
  return {
    key: base.key,
    label: base.label,
    lengthText,
    depthText,
    lengthWarning,
    depthWarning,
    panels,
    areaSqM,
    stoneCode: edit.stoneCode ?? null,
    basinSkus,
    ownBasinSizes: { ...(edit.ownBasinSizes ?? {}) },
    sheetsText,
    sheetsWarning: sketchSheetsWarning(sheetsText),
    sizeValid,
  };
}

// ---- prices ------------------------------------------------------------------------------------------------------------

export type SketchPieceQuote =
  | { status: "no-stone"; message: string }
  | { status: "invalid"; message: string }
  | { status: "no-price"; message: string }
  | {
    status: "ok";
    orderType: SketchOrderType;
    areaSqM: number;
    sheets: number | null;
    unitPriceTHB: number;
    stoneTotalTHB: number;
    basinTotalTHB: number;
    installationTHB: number;
    smallJobFeeTHB: number;
    vatTHB: number;
    totalTHB: number;
  };

function pieceRectangles(piece: SketchResolvedPiece): StudioRectangle[] {
  const sizes = piece.panels.length > 0
    ? piece.panels.map((panel) => ({ id: `${piece.key}-panel-${panel.index}`, label: panel.label, widthMm: parseSketchMm(panel.lengthText) ?? 0, lengthMm: parseSketchMm(panel.depthText) ?? 0 }))
    : [{ id: `${piece.key}-panel-1`, label: undefined, widthMm: parseSketchMm(piece.lengthText) ?? 0, lengthMm: parseSketchMm(piece.depthText) ?? 0 }];
  let xMm = 0;
  return sizes.map((size) => {
    const rectangle: StudioRectangle = { id: size.id, widthMm: size.widthMm, lengthMm: size.lengthMm, xMm, yMm: 0, rotation: 0, ...(size.label ? { label: size.label } : {}) };
    xMm += size.widthMm;
    return rectangle;
  });
}

/** A complete, single-stone studio state for one piece, so the system's own estimate can price it. */
export function sketchPieceState(piece: SketchResolvedPiece, stoneCode: string, basinSkus: string[], vat: boolean): StudioState {
  const studioPiece: StudioPiece = { id: piece.key, name: piece.label, rectangles: pieceRectangles(piece), sideStatuses: {} };
  return {
    mode: "sketch",
    shape: "I",
    dimensions: { depthMm: parseSketchMm(piece.depthText) ?? 0, runAMm: parseSketchMm(piece.lengthText) ?? 0, runBMm: 0, runCMm: 0 },
    pieces: [studioPiece],
    activePieceId: piece.key,
    backsplash: { enabled: false, heightMm: 120 },
    upstandHeightMm: null,
    openEdgePricePerMTHB: null,
    discountTHB: 0,
    location: "bangkok-metro",
    vat,
    quoteFormat: "US",
    stoneColors: [stoneCode],
    activeStone: stoneCode,
    stoneSelectionSource: "user",
    basinSkus,
    basinPlacements: [],
  };
}

export type SketchQuoteContext = {
  orderType: SketchOrderType;
  stoneColors?: ReadonlyArray<StoneColor>;
  products?: ReadonlyArray<BasinProduct>;
  location?: StudioState["location"];
  vat?: boolean;
};

/**
 * The price of one piece, or why there is none yet. Nothing is priced until the piece has a valid size AND a stone of its own:
 * "ยังไม่เลือกสีหิน" is never a 0 baht price.
 */
export function quoteSketchPiece(piece: SketchResolvedPiece, context: SketchQuoteContext): SketchPieceQuote {
  const colors = context.stoneColors ?? STONE_COLORS;
  const products = context.products ?? PRODUCTS;
  const vat = context.vat === true;
  if (!piece.stoneCode) return { status: "no-stone", message: SKETCH_NO_STONE_MESSAGE };
  if (!piece.sizeValid || piece.areaSqM === null) return { status: "invalid", message: "ขนาดยังไม่ถูกต้อง จึงยังไม่คำนวณพื้นที่และราคา" };
  const color = stoneColorByName(piece.stoneCode, colors);
  const choices = sketchStoneChoices(context.orderType, colors);
  if (!choices.some((choice) => choice.code === color.code)) {
    return { status: "no-price", message: "สีนี้ไม่มีราคาสำหรับประเภทการสั่งซื้อที่เลือก" };
  }

  if (context.orderType === "sheet") {
    if (piece.sheetsWarning) return { status: "invalid", message: piece.sheetsWarning };
    const sheets = parseSketchSheets(piece.sheetsText) ?? 0;
    const unitPriceTHB = stoneSheetUnitPrice(color.code, sheets, colors);
    if (unitPriceTHB === null) return { status: "no-price", message: "สีนี้ไม่มีราคาแผ่นในแคตตาล็อก" };
    const stoneTotalTHB = unitPriceTHB * sheets;
    const totals = calculateFormalQuoteTotals({ basinSubtotal: 0, requestedInstallationCharge: 0, basinSets: 0, stoneTotal: stoneTotalTHB, vat });
    return {
      status: "ok",
      orderType: "sheet",
      areaSqM: piece.areaSqM,
      sheets,
      unitPriceTHB,
      stoneTotalTHB,
      basinTotalTHB: 0,
      installationTHB: 0,
      smallJobFeeTHB: 0,
      vatTHB: totals.vatAmount,
      totalTHB: totals.total,
    };
  }

  // A basin the customer buys themselves is never priced: only real catalogue models count.
  const basinSkus = piece.basinSkus.filter((sku): sku is string => sku !== null && sku !== SKETCH_OWN_BASIN);
  const state = { ...sketchPieceState(piece, color.code, basinSkus, vat), location: context.location ?? "bangkok-metro" };
  const estimate = studioEstimate(state, products);
  if (estimate.stoneUnitPriceTHB === null) return { status: "no-price", message: "สีนี้ไม่มีราคารวมติดตั้งในแคตตาล็อก" };
  return {
    status: "ok",
    orderType: "fabrication",
    areaSqM: piece.areaSqM,
    sheets: null,
    unitPriceTHB: estimate.stoneUnitPriceTHB,
    stoneTotalTHB: estimate.stoneTotalTHB,
    basinTotalTHB: estimate.basinSubtotalTHB,
    installationTHB: estimate.installationChargeTHB,
    smallJobFeeTHB: estimate.smallJobFeeTHB,
    vatTHB: estimate.vatAmountTHB,
    totalTHB: estimate.totalTHB,
  };
}

export type SketchOrderQuote = {
  pieces: Array<{ key: string; label: string; quote: SketchPieceQuote }>;
  pricedCount: number;
  allPriced: boolean;
  vatTHB: number;
  totalTHB: number;
};

export function quoteSketchOrder(pieces: ReadonlyArray<SketchResolvedPiece>, context: SketchQuoteContext): SketchOrderQuote {
  const quoted = pieces.map((piece) => ({ key: piece.key, label: piece.label, quote: quoteSketchPiece(piece, context) }));
  const ok = quoted.flatMap((entry) => (entry.quote.status === "ok" ? [entry.quote] : []));
  return {
    pieces: quoted,
    pricedCount: ok.length,
    allPriced: quoted.length > 0 && ok.length === quoted.length,
    vatTHB: ok.reduce((sum, quote) => sum + quote.vatTHB, 0),
    totalTHB: ok.reduce((sum, quote) => sum + quote.totalTHB, 0),
  };
}

/** A piece is ready to send when its sizes are valid and it has a stone (and, for sheets, a sheet count). */
export function sketchPieceReady(piece: SketchResolvedPiece, orderType: SketchOrderType): boolean {
  return piece.sizeValid && piece.stoneCode !== null && (orderType !== "sheet" || piece.sheetsWarning === null);
}

/** Everything the sales team needs about the order, as stored under studioData.sketchOrder. Sizes and picks are the customer's confirmed values. */
export function sketchOrderSnapshot(
  pieces: ReadonlyArray<SketchResolvedPiece>,
  context: SketchQuoteContext,
): Record<string, unknown> {
  const colors = context.stoneColors ?? STONE_COLORS;
  const products = context.products ?? PRODUCTS;
  const quote = quoteSketchOrder(pieces, context);
  const orderType = SKETCH_ORDER_TYPES.find((type) => type.value === context.orderType) ?? SKETCH_ORDER_TYPES[0]!;
  return {
    orderType: context.orderType,
    orderTypeLabel: orderType.label,
    priceUnit: orderType.unitLabel,
    vat: context.vat === true,
    totalTHB: quote.totalTHB,
    allPriced: quote.allPriced,
    pieces: pieces.map((piece, index) => {
      const stone = piece.stoneCode ? stoneColorByName(piece.stoneCode, colors) : null;
      return {
        label: piece.label,
        lengthMm: parseSketchMm(piece.lengthText),
        depthMm: parseSketchMm(piece.depthText),
        areaSqM: piece.areaSqM,
        panels: piece.panels.map((panel) => ({ label: panel.label, lengthMm: parseSketchMm(panel.lengthText), depthMm: parseSketchMm(panel.depthText) })),
        stoneCode: stone?.code ?? null,
        stoneName: stone?.name ?? null,
        sheets: context.orderType === "sheet" ? parseSketchSheets(piece.sheetsText) : null,
        cutouts: piece.basinSkus.map((sku, cutoutIndex) => {
          if (sku === SKETCH_OWN_BASIN) {
            const size = cleanOwnBasinSize(piece.ownBasinSizes[cutoutIndex]);
            return {
              index: cutoutIndex + 1,
              sku: null,
              ownBasin: true,
              size,
              note: size ? SKETCH_OWN_BASIN_WARNING : SKETCH_OWN_BASIN_NO_SIZE_NOTE,
            };
          }
          const product = sku ? products.find((item) => item.sku === sku) : undefined;
          const cutout = product ? sketchBasinCutout(product) : null;
          return { index: cutoutIndex + 1, sku: product?.sku ?? null, ownBasin: false, size: cutout?.label ?? null, ...(cutout ? { widthMm: cutout.widthMm, depthMm: cutout.depthMm, bowlDepthMm: cutout.bowlDepthMm, round: cutout.round } : {}) };
        }),
        quote: quote.pieces[index]?.quote ?? null,
      };
    }),
  };
}

/**
 * The single studio state sent with a sketch request (the shape every lead reader already understands): one piece per sketch piece
 * with the customer's confirmed sizes, the stones and basin models picked. Basins the customer buys themselves are left out.
 */
export function sketchSubmitState(base: StudioState, pieces: ReadonlyArray<SketchResolvedPiece>): StudioState {
  const studioPieces = pieces.flatMap((piece) => sketchPieceState(piece, piece.stoneCode ?? base.activeStone, [], base.vat).pieces ?? []);
  const stoneCodes = [...new Set(pieces.flatMap((piece) => (piece.stoneCode ? [piece.stoneCode] : [])))];
  const first = studioPieces[0]?.rectangles[0];
  return {
    ...base,
    mode: "sketch",
    pieces: studioPieces,
    activePieceId: studioPieces[0]?.id ?? base.activePieceId,
    dimensions: { ...base.dimensions, runAMm: first?.widthMm ?? base.dimensions.runAMm, depthMm: first?.lengthMm ?? base.dimensions.depthMm },
    stoneColors: stoneCodes.length > 0 ? stoneCodes : base.stoneColors,
    activeStone: stoneCodes[0] ?? base.activeStone,
    stoneSelectionSource: "user",
    basinSkus: pieces.flatMap((piece) => piece.basinSkus.filter((sku): sku is string => sku !== null && sku !== SKETCH_OWN_BASIN)),
    basinPlacements: [],
  };
}
