export type BasinCategory = "counter basin" | "tall vertical washbasin" | (string & {});

export type BasinProduct = {
  sku: string;
  colorCode: string;
  colorName: string;
  priceTHB: number;
  category: string;
  dimensions: string;
  basinDimensions?: string;
  imageTone: string;
  imageUrl?: string;
  videoUrl?: string;
};

export type QuoteBasinLine = {
  sku: string;
  quantity: number;
  installationSelected: boolean;
};

export type StoneConfig = {
  enabled: boolean;
  mode: "whole-sheet" | "installed";
  color: string;
  quantity: number;
  widthCm: number;
  lengthCm: number;
  areaSqM: number;
  unitPrice: number;
  installationPrice: number;
};

export type CustomerDetails = {
  name: string;
  company: string;
  taxId: string;
  phone: string;
  email: string;
  purchasingDepartment: string;
  address: string;
  project: string;
  site: string;
  notes: string;
};

export const INSTALLATION_PRICE = 5000;
export const VAT_RATE = 0.07;
export const STONE_SHEET_SIZE = "0.76 × 3.60 m";
export const STONE_SHEET_THICKNESS = "หนา 12 mm";
export const STONE_GLUE_PRICE = 500;
export const STONE_INSTALLED_MIN_BANGKOK_SQM = 5;
export const STONE_INSTALLED_MIN_PROVINCE_SQM = 10;
export const STONE_SMALL_JOB_BANGKOK_FEE = 5000;
export const STONE_SMALL_JOB_PROVINCE_FEE = 8000;

export type StoneColor = {
  name: string;
  code: string;
  tone: string;
  sheetPriceTHB: number | null;
  installedPriceTHB: number | null;
  documentCodes: string[];
  imageUrl?: string;
};

/**
 * The two attached price documents use slightly different spellings for a few
 * products. The canonical code is the one used by the installed-price catalog;
 * documentCodes keeps the source spelling searchable without merging products
 * whose codes are genuinely different (for example NB091 and NB091F).
 *
 * A null price means that the source document does not list that exact code.
 * Showing it as unavailable is safer than silently inventing a price.
 */
const stoneCatalogRows: Array<[string, string, number | null, number | null, string, string[]?]> = [
  ["BW010", "Bright White", 5900, 7500, "#f5f3eb"],
  ["MU010", "Evermoin Ultra Bright", 7500, 7500, "#fbfaf4", ["MU 010", "Evermion Ultra Bright"]],
  ["EG501", "Glaring White", 9000, 8500, "#dfe5e8", ["EG 501"]],
  ["AL645", "Aspen Lily", 9000, 8500, "#f5f0e9", ["AL 645"]],
  ["AS610", "Aspen Snow", 9000, 8500, "#e8e9e5", ["AS 610"]],
  ["SO423", "Sanded Onyx", 9000, 8500, "#343736", ["SO 423"]],
  ["SH428", "Sanded Heron", 9000, 8500, "#a4aaa6", ["SH 428"]],
  ["SG420", "Sanded Grey", 9000, 8500, "#b7bbb3", ["SG 420"]],
  ["SI414", "Sanded Icicle", 9000, 8500, "#f1f0eb", ["SI 414"]],
  ["SS440", "Sanded Sahara", 9000, 8500, "#c7c3b8", ["SS 440"]],
  ["SC457", "Sanded Chestnut", 9000, 8500, "#806f64", ["SC 457"]],
  ["SV430", "Sanded Vermillion", 9000, 8500, "#a8957f", ["SV 430"]],
  ["EG595", "Metallic Galaxy", 9500, 8500, "#1c1d1a", ["EG 595"]],
  ["NT970", "Bologna Terrazzo", 9000, 8500, "#e8e7dc", ["NT 970"]],
  ["PS820", "Pebble Saratoga", 9500, 8500, "#d2cec7", ["PS 820"]],
  ["QS288", "Quarry Starred", 9500, null, "#52565e", ["QS 288"]],
  ["VC110", "Cotton White", 12000, 9500, "#f7f8f3", ["VC 110", "Supreme Cotton White"]],
  ["VL343", "Latte Cream", 12000, 9500, "#eee6db", ["VL 343", "Supreme Latte Cream"]],
  ["VR322", "Rotor Cloud", 12000, 9500, "#dfe2e5", ["VR 322", "Supreme Rotor Cloud"]],
  ["VO171", "Ocean View", 12000, 9500, "#dedbd1", ["VO 171", "Supreme Ocean View"]],
  ["VF113", "Flux", 12000, 9500, "#bfc2bd", ["VF 113", "Supreme Flux"]],
  ["VL312", "Premiere Largo", 12000, 9500, "#f1f2ef", ["VL 312", "Supreme Largo"]],
  ["VM114", "Morning Sky", 12000, 9500, "#edf1ed", ["VM 114", "Supreme Morning Sky"]],
  ["VF345", "Flat White", 12000, 9500, "#f1ece0", ["VF 345", "Supreme Flat White"]],
  ["VA311", "Arctic White", 12000, 9500, "#e8edf0", ["VA 311", "Supreme Arctic White"]],
  ["VD175", "Dandelion", 12000, null, "#aeb5b5", ["VD 175", "Supreme Dandelion"]],
  ["VV375", "Vivace", 12000, 9500, "#eee9df", ["VV 375", "Aria Vivace"]],
  ["VD382", "Drift", 12000, 9500, "#bbbcb5", ["VD 382", "Aria Drift"]],
  ["VS311", "Shine", 12000, 9500, "#d9dad6", ["VS 311", "Aria Shine"]],
  ["VS351", "Soft", 12000, 9500, "#e8e2d8", ["VS 351", "Aria Soft"]],
  ["VS385", "Slate", 12000, 9500, "#777a78", ["VS 385", "Aria Slate"]],
  ["V342", "Whisper", 12000, 9500, "#d9d1c2", ["VW342", "VW 342"]],
  ["VD345", "Dusk", 12000, 9500, "#d6c5ab", ["VD 345", "Aria Dusk"]],
  ["VV351", "Veil", 12000, 9500, "#e8e1db", ["VV 351", "Aria Veil"]],
  ["PT857", "Pebble Terrain", 9500, 8500, "#7f6249", ["PT 857"]],
  ["NW013", "Neo White", 4900, 7500, "#fbfbf7"],
  ["DU121", "Duese", 7000, 8500, "#c8bcaa"],
  ["NB091F", "Neo Black Facade", 7000, null, "#080a09", ["NB 091F"]],
  ["CW013", "Camellia White", 7000, 7500, "#e5ded2", ["CW 013"]],
  ["E085", "Everest", 8000, 8500, "#d6d7d0", ["E 085"]],
  ["GC714", "Glalet Crystals", 8000, 8500, "#e8eae6"],
  ["GI017", "Glalet Ice", 8000, 8500, "#e1e5e2"],
  ["GG884", "Glalet Grey", 8000, 8500, "#6c7073"],
  ["GG884(N)", "Glalet Grey (N)", 8000, null, "#45494d", ["GG884 (N)"]],
  ["MB025", "Mist Beech", 8000, 8500, "#e1dbcd"],
  ["MC016", "Mist Concrete", 8000, 8500, "#858783"],
  ["GE118", "Glalet Ebony", 8000, 8500, "#252727"],
  ["GT010", "Grigio Terrazzo", 8000, 8500, "#e2e4df", ["Grigio Tarrazzo"]],
  ["CT970", "Chess Terrazzo", 8000, null, "#d8d7d1"],
  ["CT981", "Clay Terrazzo", 8000, null, "#a7a2a8"],
  ["BT010", "Basalt Terrazzo", 8000, 8500, "#292b2b"],
  ["BR816O", "Black River", 9500, 9500, "#101112", ["BR816", "BR 816"]],
  ["KZ802", "Zen Autumn", 9500, 9500, "#b8b0a5"],
  ["KZ802N", "Zen Autumn New", 9500, 9500, "#c5c8c5", ["KZ802(N)", "KZ 802N"]],
  ["MS112", "Mahogany Stone", 9500, 9500, "#9b7659"],
  ["VW213", "Vena White", 9500, 9500, "#f1f1e9"],
  ["RW316", "River White", 9500, 9500, "#e5e5dc"],
  ["CO521M", "Cloud Onyx", 9500, 9500, "#e4e7e2", ["CO 521M"]],
  ["CS532M", "Cascade Slope", 9500, 9500, "#dbeaf8", ["CS 532M"]],
  ["HJ524M", "Honey Jade", 9500, 9500, "#c8b9c0", ["HJ 524M", "Honer Jade", "Honey Jadf"]],
  ["JG532M", "Jade Golddust", 9500, 9500, "#adc69c", ["JG 532M"]],
  ["SW534M", "Starry White", 9500, 9500, "#e8e8e2", ["SW 534M"]],
  ["VW050", "Vene White", 9500, 9500, "#f5f2eb", ["VW 050"]],
  ["WH112", "Witch Hazel", 9500, 9500, "#d0c6b6", ["WH122", "WH 122", "WH 112"]],
  ["WW001", "Wave White", 9500, null, "#e8e7df", ["WW 001"]],
  ["OM391", "Ocean Marble", 9500, null, "#bcb9b1", ["OM 391"]],
  ["BL461", "Bold Lines", 9500, 9500, "#f2eee5", ["BL 461"]],
  ["SL531", "Sandy Lines", 9500, 9500, "#f0eee9", ["SL 531"]],
  ["MM541", "Metallic Marble", 9500, null, "#e8eeea", ["MM 541"]],
  ["ME642", "Mist Egg", 8000, 8500, "#d7d9d3", ["ME 642"]],
  ["AP100", "Apex", 8000, 8500, "#ddd5c4", ["AP 100"]],
  ["NA160", "Navis", 8000, 8500, "#e1e1d8", ["NA 160"]],
  ["RC469", "Rock Cliffs", 12000, 9500, "#e2ded4", ["RC 469"]],
  ["NB091", "Neo Black", null, 8500, "#090a09"],
  ["KZ695", "Zen Grey", null, 8500, "#c8cdd6"],
  ["AI612", "Aspen Iceberg", null, 8500, "#e4e5e0"],
  ["AA625", "Aspen Alder", null, 8500, "#aeb7c2"],
  ["QS822N", "Quarry Starred", null, 8500, "#52565e"],
  ["VL155", "Loam", null, 9500, "#8e7766"],
  ["VD126", "Dawn", null, 9500, "#e1e2dd"],
];

export const STONE_COLORS: StoneColor[] = stoneCatalogRows.map(([code, name, sheetPriceTHB, installedPriceTHB, tone, documentCodes]) => ({
  code,
  name,
  tone,
  sheetPriceTHB,
  installedPriceTHB,
  documentCodes: documentCodes ?? [],
}));

export const stoneColorByName = (identifier: string) => {
  const normalized = identifier.trim().toLowerCase();
  return STONE_COLORS.find((color) =>
    [color.name, color.code, ...color.documentCodes].some((value) => value.toLowerCase() === normalized),
  ) ?? STONE_COLORS[0];
};

export const stoneSheetUnitPrice = (colorIdentifier: string, quantity: number) => {
  const color = stoneColorByName(colorIdentifier);
  if (color.sheetPriceTHB === null) return null;
  const promotionExcluded = ["BW010", "NW013"].includes(color.code);
  if (quantity >= 50 && !promotionExcluded) return Math.round(color.sheetPriceTHB * 0.95);
  if (quantity >= 10 && !promotionExcluded) return Math.max(0, color.sheetPriceTHB - 200);
  return color.sheetPriceTHB;
};

export const stoneInstalledUnitPrice = (colorIdentifier: string) =>
  stoneColorByName(colorIdentifier).installedPriceTHB;

export function toggleBasinSelection(lines: QuoteBasinLine[], sku: string): QuoteBasinLine[] {
  return lines.some((line) => line.sku === sku)
    ? lines.filter((line) => line.sku !== sku)
    : [...lines, { sku, quantity: 1, installationSelected: false }];
}

export function upsertStoneSelection(stones: StoneConfig[], incoming: StoneConfig): StoneConfig[] {
  const next = stones.filter((stone) => stone.color !== incoming.color);
  const unitPrice = incoming.mode === "whole-sheet"
    ? stoneSheetUnitPrice(incoming.color, incoming.quantity)
    : stoneInstalledUnitPrice(incoming.color);
  return [...next, { ...incoming, enabled: true, unitPrice: unitPrice ?? 0, installationPrice: 0 }];
}

export function removeStoneSelection(stones: StoneConfig[], color: string): StoneConfig[] {
  return stones.filter((stone) => stone.color !== color);
}

const counterDims = { dimensions: "600 × 800 × 200 mm", basinDimensions: "350 × 500 × 130 mm" };
const counterWideDims = { dimensions: "600 × 800 × 200 mm", basinDimensions: "400 × 500 × 130 mm" };

export const BASIN_PRODUCTS: BasinProduct[] = [
  ["KF001", "VS311", "Shine", 19000, counterDims],
  ["KF002", "VS351", "Soft", 19000, counterDims],
  ["KF003", "RW316", "River White", 19000, counterDims],
  ["KF004", "VW050", "Wene White", 19000, counterDims],
  ["KF005", "HJ524M", "Honer Jade", 19000, counterDims],
  ["KF006", "RW316", "River White", 19000, counterDims],
  ["KF007", "VL343", "Latte Cream", 19000, counterDims],
  ["KF008", "SI414", "Sanded Icice", 17000, counterDims],
  ["KF009", "NB091", "Neo Black", 17000, counterDims],
  ["KF010", "NA016", "Navis", 17000, counterDims],
  ["KF011", "VD382", "Drift", 19000, counterWideDims],
  ["KF012", "CS522M", "Cascade Slope", 19000, counterWideDims],
  ["KF013", "WR322", "Rotor Cloud", 19000, counterWideDims],
  ["KF014", "EG501", "Glaring White", 17000, counterWideDims],
  ["KF015", "GG884", "Glalet Grey", 20000, counterWideDims],
  ["KF016", "KZ802", "Zen Autumn", 19000, counterWideDims],
  ["KF017", "KZ802N", "Zen Autumn New", 19000, counterWideDims],
  ["KF018", "GI017", "Glalet Ice", 17000, counterWideDims],
].map(([sku, colorCode, colorName, priceTHB, dims], index) => ({
  sku: sku as string,
  colorCode: colorCode as string,
  colorName: colorName as string,
  priceTHB: priceTHB as number,
  category: "counter basin" as BasinCategory,
  dimensions: (dims as typeof counterDims).dimensions,
  basinDimensions: (dims as typeof counterDims).basinDimensions,
  imageTone: ["#dfe4df", "#d2d0c9", "#c6cdc9", "#ece7db", "#9eaa9a", "#d5dad3"][index % 6],
}));

const tallProducts: Array<[string, string, string, number, string, string | undefined]> = [
  ["KF019", "VD345", "Dusk", 24000, "400 × 400 × 850 mm", "350 × 350 × 150 mm"],
  ["KF020", "VS385", "Slate", 24000, "400 × 400 × 850 mm", "350 × 350 × 150 mm"],
  ["KF021", "KZ802N", "Zen Autumn New", 25000, "400 × 400 × 850 mm", "350 × 350 × 150 mm"],
  ["KF022", "NW013", "Neo White", 24000, "400 × 400 × 850 mm", "350 × 350 × 150 mm"],
  ["KF023", "WH112", "Witch Hazel", 26000, "400 × 400 × 850 mm", "Ø350 × 150 mm"],
  ["KF024", "V342", "Whisper", 25000, "400 × 400 × 850 mm", "Ø350 × 150 mm"],
  ["KF025", "NB091", "Neo Black", 24000, "400 × 400 × 850 mm", "Ø350 × 150 mm"],
  ["KF026", "NW013", "Neo White", 24000, "400 × 400 × 850 mm", "Ø350 × 150 mm"],
  ["KF027", "SW534M", "Starry White", 28000, "400 × 600 × 850 mm", "370 × 570 × 150 mm"],
  ["KF028", "VV351", "Veil", 32000, "400 × 600 × 850 mm", "370 × 570 × 150 mm"],
  ["KF029", "EG595", "Metallic Galaxy", 16000, "400 × 400 × 1000 mm", undefined],
  ["KF030", "GT010", "Grigio Terrazzo", 16000, "400 × 400 × 1000 mm", undefined],
];

export const TALL_PRODUCTS: BasinProduct[] = tallProducts.map(([sku, colorCode, colorName, priceTHB, dimensions, basinDimensions], index) => ({
  sku, colorCode, colorName, priceTHB,
  category: "tall vertical washbasin",
  dimensions, basinDimensions,
  imageTone: ["#717779", "#dfe0d7", "#a59b84", "#e6e2d5", "#4d5050", "#cac9c0"][index % 6],
}));

export const PRODUCTS = [...BASIN_PRODUCTS, ...TALL_PRODUCTS];
export const productBySku = (sku: string) => PRODUCTS.find((product) => product.sku === sku);

export function filterBasinProducts(products: BasinProduct[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return products;
  return products.filter((product) => [
    product.sku,
    product.colorCode,
    product.colorName,
    product.category,
  ].join(" ").toLocaleLowerCase().includes(normalizedQuery));
}

export function basinProductFromCatalog(item: {
  sku: string;
  colorCode: string;
  colorName: string;
  priceTHB: number;
  category: string;
  dimensions: string;
  basinDimensions?: string | null;
  imageTone: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}): BasinProduct {
  return {
    sku: item.sku,
    colorCode: item.colorCode,
    colorName: item.colorName,
    priceTHB: item.priceTHB,
    category: item.category as BasinCategory,
    dimensions: item.dimensions,
    basinDimensions: item.basinDimensions ?? undefined,
    imageTone: item.imageTone,
    imageUrl: item.imageUrl?.trim() || undefined,
    videoUrl: item.videoUrl ?? undefined,
  };
}

export const formatTHB = (amount: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amount);