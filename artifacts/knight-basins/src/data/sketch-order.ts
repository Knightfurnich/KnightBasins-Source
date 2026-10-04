import {
  INSTALLATION_PRICE,
  PRODUCTS,
  STONE_COLORS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  VAT_RATE,
  stoneColorByName,
  stoneSheetUnitPrice,
  type BasinProduct,
  type StoneColor,
} from "./catalog.ts";
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
//
// job-259: a piece carries only what belongs to it -- its stone and the basin models on it. The service charges are the
// job's, decided once over the whole order with Knight Basins' own rules (studioEstimate, the same calculator the studio and
// the server use): basin installation is charged per set and free from 3 sets counted over all pieces; an installed top below
// the minimum area pays the small-job fee once per job (Bangkok and vicinity 5 m2 / 5,000, province 10 m2 / 8,000); a
// customer who collects at the factory pays no service charge at all.

/** Who brings the order to site: we install (the default) or the customer collects at the factory. */
export type SketchFulfilment = "install" | "pickup";
export const DEFAULT_SKETCH_FULFILMENT: SketchFulfilment = "install";
export const SKETCH_FULFILMENTS: ReadonlyArray<{ value: SketchFulfilment; label: string; note: string }> = [
  { value: "install", label: "ให้เราติดตั้ง", note: "คิดค่าดำเนินการตามเงื่อนไขของ Knight Basins" },
  { value: "pickup", label: "ลูกค้ามารับเองที่โรงงาน", note: "ไม่คิดค่าดำเนินการติดตั้งทุกประเภท" },
];
/** Travel, delivery and allowance for a province job are charged by the place, and the system has no rate for them yet. */
export const SKETCH_PROVINCE_TRAVEL_NOTE = "งานต่างจังหวัด: ยังไม่รวมค่าจัดส่ง/ค่าเดินทาง และเบี้ยเลี้ยงตามสถานที่ (ทีมขายจะแจ้งเพิ่ม)";

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
    /** Catalogue basins on this piece (a basin the customer buys elsewhere is not one). */
    basinSets: number;
    basinTotalTHB: number;
    /** Stone + basins of this piece. Service charges are the job's, see SketchOrderQuote. */
    lineTotalTHB: number;
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
  /** The customer collects at the factory (field name shared with the sales bot's price calculator). */
  pickup?: boolean;
};

/** The catalogue basin models chosen on a piece: never empty slots, never a basin the customer buys elsewhere. */
function catalogueBasinSkus(piece: SketchResolvedPiece, products: ReadonlyArray<BasinProduct>): string[] {
  return piece.basinSkus.filter((sku): sku is string => sku !== null && sku !== SKETCH_OWN_BASIN && products.some((product) => product.sku === sku));
}

/**
 * The price of one piece's own stone and basins, or why there is none yet. Nothing is priced until the piece has a valid size
 * AND a stone of its own: "ยังไม่เลือกสีหิน" is never a 0 baht price.
 */
export function quoteSketchPiece(piece: SketchResolvedPiece, context: SketchQuoteContext): SketchPieceQuote {
  const colors = context.stoneColors ?? STONE_COLORS;
  const products = context.products ?? PRODUCTS;
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
    return { status: "ok", orderType: "sheet", areaSqM: piece.areaSqM, sheets, unitPriceTHB, stoneTotalTHB, basinSets: 0, basinTotalTHB: 0, lineTotalTHB: stoneTotalTHB };
  }

  const basinSkus = catalogueBasinSkus(piece, products);
  const estimate = studioEstimate(sketchPieceState(piece, color.code, basinSkus, false), products);
  if (estimate.stoneUnitPriceTHB === null) return { status: "no-price", message: "สีนี้ไม่มีราคารวมติดตั้งในแคตตาล็อก" };
  return {
    status: "ok",
    orderType: "fabrication",
    areaSqM: piece.areaSqM,
    sheets: null,
    unitPriceTHB: estimate.stoneUnitPriceTHB,
    stoneTotalTHB: estimate.stoneTotalTHB,
    basinSets: basinSkus.length,
    basinTotalTHB: estimate.basinSubtotalTHB,
    lineTotalTHB: estimate.stoneTotalTHB + estimate.basinSubtotalTHB,
  };
}

export type SketchOrderQuote = {
  pieces: Array<{ key: string; label: string; quote: SketchPieceQuote }>;
  pricedCount: number;
  allPriced: boolean;
  orderType: SketchOrderType;
  pickup: boolean;
  location: StudioState["location"];
  vat: boolean;
  /** Totals over the priced pieces. */
  areaSqM: number;
  stoneTotalTHB: number;
  basinSets: number;
  basinTotalTHB: number;
  /** Basin installation before the 3-set waiver, the waiver, and what is left to pay. */
  requestedInstallationTHB: number;
  installationDiscountTHB: number;
  installationTHB: number;
  /** The small-job fee, once for the whole job. */
  smallJobFeeTHB: number;
  subtotalTHB: number;
  vatTHB: number;
  totalTHB: number;
};

/**
 * The whole order: each piece's stone and basins at its own colour's rate, then the job's service charges decided once over all
 * of it by the system estimate run on every priced piece together (area summed, basin sets counted across pieces). Collecting
 * at the factory removes every service charge. Sheets carry no service charge.
 */
export function quoteSketchOrder(pieces: ReadonlyArray<SketchResolvedPiece>, context: SketchQuoteContext): SketchOrderQuote {
  const products = context.products ?? PRODUCTS;
  const location = context.location ?? "bangkok-metro";
  const vat = context.vat === true;
  const pickup = context.pickup === true;
  const quoted = pieces.map((piece) => ({ piece, key: piece.key, label: piece.label, quote: quoteSketchPiece(piece, context) }));
  const priced = quoted.flatMap((entry) => (entry.quote.status === "ok" ? [{ piece: entry.piece, quote: entry.quote }] : []));
  const sum = (pick: (quote: Extract<SketchPieceQuote, { status: "ok" }>) => number) => priced.reduce((total, entry) => total + pick(entry.quote), 0);
  const stoneTotalTHB = sum((quote) => quote.stoneTotalTHB);
  const basinTotalTHB = sum((quote) => quote.basinTotalTHB);
  const basinSets = sum((quote) => quote.basinSets);

  let requestedInstallationTHB = 0;
  let installationDiscountTHB = 0;
  let smallJobFeeTHB = 0;
  if (context.orderType === "fabrication" && !pickup && priced.length > 0) {
    // One studio state holding every priced piece and every catalogue basin of the job. Only its service charges are used:
    // they depend on the total area, the number of basin sets and the location, not on which colour each piece is.
    const stoneCode = priced[0]!.piece.stoneCode!;
    const jobState: StudioState = {
      ...sketchPieceState(priced[0]!.piece, stoneCode, priced.flatMap((entry) => catalogueBasinSkus(entry.piece, products)), false),
      pieces: priced.flatMap((entry) => sketchPieceState(entry.piece, stoneCode, [], false).pieces ?? []),
      location,
    };
    const jobEstimate = studioEstimate(jobState, products);
    requestedInstallationTHB = jobEstimate.installationChargeTHB + jobEstimate.installationDiscountTHB;
    installationDiscountTHB = jobEstimate.installationDiscountTHB;
    smallJobFeeTHB = jobEstimate.smallJobFeeTHB;
  }
  const installationTHB = requestedInstallationTHB - installationDiscountTHB;
  const subtotalTHB = stoneTotalTHB + basinTotalTHB + installationTHB + smallJobFeeTHB;
  const vatTHB = vat ? Math.round(subtotalTHB * VAT_RATE) : 0;
  return {
    pieces: quoted.map(({ key, label, quote }) => ({ key, label, quote })),
    pricedCount: priced.length,
    allPriced: quoted.length > 0 && priced.length === quoted.length,
    orderType: context.orderType,
    pickup,
    location,
    vat,
    areaSqM: priced.reduce((total, entry) => total + entry.quote.areaSqM, 0),
    stoneTotalTHB,
    basinSets,
    basinTotalTHB,
    requestedInstallationTHB,
    installationDiscountTHB,
    installationTHB,
    smallJobFeeTHB,
    subtotalTHB,
    vatTHB,
    totalTHB: subtotalTHB + vatTHB,
  };
}

/** A piece is ready to send when its sizes are valid and it has a stone (and, for sheets, a sheet count). */
export function sketchPieceReady(piece: SketchResolvedPiece, orderType: SketchOrderType): boolean {
  return piece.sizeValid && piece.stoneCode !== null && (orderType !== "sheet" || piece.sheetsWarning === null);
}

/** The job totals as stored in studioData.sketchOrder.totals. */
export function sketchOrderTotals(quote: SketchOrderQuote) {
  return {
    areaSqM: quote.areaSqM,
    stoneTotalTHB: quote.stoneTotalTHB,
    basinSets: quote.basinSets,
    basinTotalTHB: quote.basinTotalTHB,
    requestedInstallationTHB: quote.requestedInstallationTHB,
    installationDiscountTHB: quote.installationDiscountTHB,
    installationTHB: quote.installationTHB,
    smallJobFeeTHB: quote.smallJobFeeTHB,
    subtotalTHB: quote.subtotalTHB,
    vatTHB: quote.vatTHB,
    totalTHB: quote.totalTHB,
  };
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
  const fulfilment = SKETCH_FULFILMENTS.find((item) => item.value === (quote.pickup ? "pickup" : "install"))!;
  return {
    orderType: context.orderType,
    orderTypeLabel: orderType.label,
    priceUnit: orderType.unitLabel,
    pickup: quote.pickup,
    fulfilment: fulfilment.value,
    fulfilmentLabel: fulfilment.label,
    location: quote.location,
    vat: quote.vat,
    totalTHB: quote.totalTHB,
    totals: sketchOrderTotals(quote),
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

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * The pieces and the order settings a saved studioData.sketchOrder describes, so that the server can price the order again from
 * the customer's confirmed sizes and picks with its own catalogue. Null when there is no usable snapshot. Never throws.
 */
export function sketchOrderFromSnapshot(snapshot: unknown): { pieces: SketchResolvedPiece[]; orderType: SketchOrderType; pickup: boolean; location: StudioState["location"]; vat: boolean } | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const order = snapshot as Record<string, unknown>;
  if (!Array.isArray(order["pieces"]) || order["pieces"].length === 0) return null;
  const orderType: SketchOrderType = order["orderType"] === "sheet" ? "sheet" : "fabrication";
  const pieces = (order["pieces"] as unknown[]).map((value, index) => {
    const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const panels = Array.isArray(raw["panels"]) ? raw["panels"] as unknown[] : [];
    const cutouts = Array.isArray(raw["cutouts"]) ? raw["cutouts"] as unknown[] : [];
    const label = typeof raw["label"] === "string" ? raw["label"] : `ชิ้นงาน ${index + 1}`;
    const pieceBase: SketchPieceBase = {
      key: `piece-${index + 1}`,
      label,
      lengthMm: numberOrNull(raw["lengthMm"]),
      depthMm: numberOrNull(raw["depthMm"]),
      panels: panels.map((panelValue, panelIndex) => {
        const panel = panelValue && typeof panelValue === "object" ? panelValue as Record<string, unknown> : {};
        return { index: panelIndex + 1, label: typeof panel["label"] === "string" ? panel["label"] : `แผ่น ${panelIndex + 1}`, lengthMm: numberOrNull(panel["lengthMm"]), depthMm: numberOrNull(panel["depthMm"]) };
      }),
      basinCutouts: cutouts.length,
    };
    const basinSkus = cutouts.map((cutoutValue) => {
      const cutout = cutoutValue && typeof cutoutValue === "object" ? cutoutValue as Record<string, unknown> : {};
      if (cutout["ownBasin"] === true) return SKETCH_OWN_BASIN;
      return typeof cutout["sku"] === "string" ? cutout["sku"] : null;
    });
    const sheets = numberOrNull(raw["sheets"]);
    return resolveSketchPiece(pieceBase, {
      stoneCode: typeof raw["stoneCode"] === "string" && raw["stoneCode"] ? raw["stoneCode"] : null,
      basinSkus,
      sheetsText: sheets === null ? "" : String(sheets),
    });
  });
  return {
    pieces,
    orderType,
    pickup: order["pickup"] === true,
    location: order["location"] === "province" ? "province" : "bangkok-metro",
    vat: order["vat"] === true,
  };
}

export type SketchNotificationItem = {
  kind: "stone" | "basin" | "service";
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceTHB: number;
  totalTHB: number;
  workQuantity: number;
  workUnit: string;
  dimensions?: string;
  cutoutDimensions?: string;
};

/**
 * The lines and totals the sales notification reads (studioData.notification): one stone line per piece at its own rate, its
 * basins, then the job's service charges once. The keys are the ones the notification reader expects (subtotal, vatAmount,
 * total), and the total is the order total, so the screen, the notification and the saved quote show one number.
 */
export function sketchOrderNotification(
  pieces: ReadonlyArray<SketchResolvedPiece>,
  context: SketchQuoteContext,
  quote: SketchOrderQuote = quoteSketchOrder(pieces, context),
): { items: SketchNotificationItem[]; vat: boolean; subtotal: number; vatAmount: number; total: number } {
  const colors = context.stoneColors ?? STONE_COLORS;
  const products = context.products ?? PRODUCTS;
  const items: SketchNotificationItem[] = [];
  pieces.forEach((piece, index) => {
    const pieceQuote = quote.pieces[index]?.quote;
    if (!piece.stoneCode || pieceQuote?.status !== "ok") return;
    const stone = stoneColorByName(piece.stoneCode, colors);
    if (pieceQuote.orderType === "sheet") {
      const sheets = pieceQuote.sheets ?? 0;
      items.push({ kind: "stone", code: stone.code, description: `แผ่นหินสังเคราะห์มาตรฐาน ${stone.name || stone.code} · ${piece.label}`, quantity: sheets, unit: "แผ่น", unitPriceTHB: pieceQuote.unitPriceTHB, totalTHB: pieceQuote.stoneTotalTHB, workQuantity: sheets, workUnit: "แผ่น" });
      return;
    }
    const area = Number(pieceQuote.areaSqM.toFixed(4));
    items.push({ kind: "stone", code: stone.code, description: `ท็อปเคาน์เตอร์หินสังเคราะห์ ${stone.name || stone.code} · ${piece.label}`, quantity: area, unit: "ตร.ม.", unitPriceTHB: pieceQuote.unitPriceTHB, totalTHB: pieceQuote.stoneTotalTHB, workQuantity: area, workUnit: "ตร.ม." });
    // A basin the customer buys themselves has no line at all: no model, no basin price.
    for (const sku of catalogueBasinSkus(piece, products)) {
      const product = products.find((item) => item.sku === sku)!;
      items.push({ kind: "basin", code: product.sku, description: product.colorName, quantity: 1, unit: "ชุด", unitPriceTHB: product.priceTHB, totalTHB: product.priceTHB, workQuantity: 1, workUnit: "ชุด", dimensions: product.dimensions, cutoutDimensions: sketchBasinCutout(product).label });
    }
  });
  if (quote.requestedInstallationTHB > 0) {
    const free = quote.installationDiscountTHB > 0;
    items.push({
      kind: "service",
      code: "INSTALL-BASIN",
      description: free ? `ค่าบริการติดตั้งอ่างล้างหน้า (ฟรี — สั่ง ${quote.basinSets} ชุด ตั้งแต่ 3 ชุดขึ้นไป)` : "ค่าบริการติดตั้งอ่างล้างหน้า",
      quantity: quote.basinSets,
      unit: "จุด",
      unitPriceTHB: free ? 0 : INSTALLATION_PRICE,
      totalTHB: quote.installationTHB,
      workQuantity: quote.basinSets,
      workUnit: "จุด",
    });
  }
  if (quote.smallJobFeeTHB > 0) {
    const minimum = quote.location === "province" ? STONE_INSTALLED_MIN_PROVINCE_SQM : STONE_INSTALLED_MIN_BANGKOK_SQM;
    items.push({
      kind: "service",
      code: "SMALL-JOB-FEE",
      description: `ค่าดำเนินการงานพื้นที่เล็ก (พื้นที่รวมทั้งงานไม่ถึง ${minimum} ตร.ม. · ${quote.location === "province" ? "ต่างจังหวัด" : "กรุงเทพฯ/ปริมณฑล"} · คิดครั้งเดียวต่องาน)`,
      quantity: 1,
      unit: "งาน",
      unitPriceTHB: quote.smallJobFeeTHB,
      totalTHB: quote.smallJobFeeTHB,
      workQuantity: 1,
      workUnit: "งาน",
    });
  }
  return { items, vat: quote.vat, subtotal: quote.subtotalTHB, vatAmount: quote.vatTHB, total: quote.totalTHB };
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
