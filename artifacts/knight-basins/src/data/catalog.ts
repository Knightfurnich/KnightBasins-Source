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
  galleryImageUrls?: string[];
  quoteImageUrl?: string;
  topViewImageUrl?: string;
  videoUrl?: string;
};

export const PILLAR_PRODUCT_SKUS = ["KF029", "KF030"] as const;
export const PILLAR_PRODUCT_LABEL = "เสาวางของตั้งพื้น (ชุดสำเร็จรูป)";
export const PILLAR_PRODUCT_PURCHASE_NOTE = "ชุดสำเร็จรูป ไม่ต้องเจาะเคาน์เตอร์";

const pillarProductSkuSet = new Set<string>(PILLAR_PRODUCT_SKUS);

export function isFreestandingPillarProduct(
  product: Pick<BasinProduct, "sku" | "category" | "basinDimensions">,
): boolean {
  return pillarProductSkuSet.has(product.sku.toUpperCase())
    || (product.category === "tall vertical washbasin" && !product.basinDimensions?.trim());
}

export function studioCutoutBasinProducts(products: ReadonlyArray<BasinProduct>): BasinProduct[] {
  return products.filter((product) => !isFreestandingPillarProduct(product));
}

export function productCategoryLabel(product: BasinProduct): string {
  if (isFreestandingPillarProduct(product)) return PILLAR_PRODUCT_LABEL;
  return product.category === "counter basin" ? "เคาน์เตอร์" : "ทรงสูง";
}

export function productSpecLabel(product: BasinProduct): string {
  if (isFreestandingPillarProduct(product)) return PILLAR_PRODUCT_PURCHASE_NOTE;
  return product.basinDimensions ? `หลุมอ่าง ${product.basinDimensions}` : "งานทรงสูง";
}

export function productQuoteDescription(product: BasinProduct): string {
  if (isFreestandingPillarProduct(product)) {
    return `${product.colorName} · ${PILLAR_PRODUCT_LABEL} · ${PILLAR_PRODUCT_PURCHASE_NOTE} · ${product.dimensions}`;
  }
  return `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}`;
}

export type QuoteBasinLine = {
  sku: string;
  quantity: number;
  installationSelected: boolean;
};

export function addBasinToQuote(lines: ReadonlyArray<QuoteBasinLine>, sku: string): QuoteBasinLine[] {
  const existing = lines.find((line) => line.sku === sku);
  return existing
    ? lines.map((line) => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line)
    : [...lines, { sku, quantity: 1, installationSelected: false }];
}

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
  taxName: string;
  taxBranch: string;
  taxAddress: string;
  phone: string;
  lineContact: string;
  email: string;
  purchasingDepartment: string;
  address: string;
  project: string;
  site: string;
  preferredContact: "line" | "phone" | "email" | "";
  customerRole: "homeowner" | "architect-interior" | "contractor" | "";
  propertyType: "house-townhome" | "condo" | "commercial" | "";
  condoFloor: string;
  expectedInstallationDate: string;
  notes: string;
};

export const CUSTOMER_CONTACT_OPTIONS = [
  { value: "line", label: "LINE" },
  { value: "phone", label: "โทรศัพท์" },
  { value: "email", label: "อีเมล" },
] as const;

export const CUSTOMER_ROLE_OPTIONS = [
  { value: "homeowner", label: "เจ้าของบ้าน / ผู้ใช้งาน" },
  { value: "architect-interior", label: "สถาปนิก / อินทีเรีย" },
  { value: "contractor", label: "ผู้รับเหมา / ช่าง" },
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  { value: "house-townhome", label: "บ้านเดี่ยว / ทาวน์โฮม" },
  { value: "condo", label: "คอนโดมิเนียม" },
  { value: "commercial", label: "อาคารพาณิชย์ / สำนักงาน" },
] as const;

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
  galleryImageUrls?: string[];
  quoteImageUrl?: string;
  slabImageUrl?: string;
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
  ["BR816O", "Black River", 9500, 9500, "#101112", ["BR816", "BR 816", "BR8160", "BR 8160"]],
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
  ["QS822N", "Quarry Starred", 8500, 8500, "#52565e", ["QS 822N"]],
  ["VL155", "Loam", null, 9500, "#8e7766"],
  ["VD126", "Dawn", null, 9500, "#e1e2dd"],
  // job-277: the database has sold this stone all along (installed 12,000 per sqm, no sheet price), but the catalogue
  // never carried its own row, so no customer could pick it. Its two spellings that name the closed V342 stone are
  // deliberately not listed here — a code belongs to one stone.
  ["VW342", "Aria Whisper", null, 12000, "#d9d1c2", ["VW 342"]],
];

const stoneCatalogColours: StoneColor[] = stoneCatalogRows.map(([code, name, sheetPriceTHB, installedPriceTHB, tone, documentCodes]) => ({
  code,
  name,
  tone,
  sheetPriceTHB,
  installedPriceTHB,
  documentCodes: documentCodes ?? [],
}));

/**
 * job-277: the database decides whether a stone is on sale. `stone-status.json` is generated from production by
 * David's read-only script — one row per code, `visible` true when either price table still keeps the stone active.
 * Nothing is deleted here: a closed stone stays in the table above so reopening it is a one-line database change,
 * it simply stops reaching the storefront. A code the status file has never heard of stays visible, so a stone the
 * database adds before the file is regenerated cannot disappear in silence; the lock in
 * `test/stone-status-visibility.test.ts` is what shouts when the two lists drift apart.
 */
import stoneStatusFile from "./stone-status.json" with { type: "json" };

export type StoneStatus = {
  code: string;
  name: string;
  activeInstalled: boolean | null;
  activeSheet: boolean | null;
  visible: boolean;
};

const stoneStatusByCode = new Map<string, StoneStatus>(
  (stoneStatusFile.colours as StoneStatus[]).map((status) => [status.code, status]),
);

export const stoneStatusForCode = (code: string): StoneStatus | undefined => stoneStatusByCode.get(code);

export function isStoneVisible(code: string): boolean {
  return stoneStatusByCode.get(code)?.visible ?? true;
}

/** The stones the app may show: the catalogue minus every code the database closed. */
export const STONE_COLORS: StoneColor[] = stoneCatalogColours.filter((color) => isStoneVisible(color.code));

/**
 * Every row, closed stones included. Nothing that renders a picker may use this — it exists so an audit, an admin
 * screen or a test can still name a stone the storefront stopped offering (and reopen it without digging through git).
 */
export const ALL_STONE_COLORS: StoneColor[] = stoneCatalogColours;

export type CatalogStoneRecord = {
  code: string;
  name: string;
  tone: string;
  aliases?: string[] | null;
  imageUrl?: string | null;
  galleryImageUrls?: string[] | null;
  quoteImageUrl?: string | null;
  slabImageUrl?: string | null;
  pricePerSqmTHB?: number | null;
  basePriceTHB?: number | null;
};

export function stoneColorsFromCatalog(
  installedStones: ReadonlyArray<CatalogStoneRecord>,
  sheetStones: ReadonlyArray<CatalogStoneRecord>,
): StoneColor[] {
  const installedByCode = new Map(installedStones.map((stone) => [stone.code, stone]));
  const sheetByCode = new Map(sheetStones.map((stone) => [stone.code, stone]));
  const codes = [...new Set([...installedByCode.keys(), ...sheetByCode.keys()])].filter(isStoneVisible);

  return codes.map((code) => {
    const installed = installedByCode.get(code);
    const sheet = sheetByCode.get(code);
    const source = installed ?? sheet!;
    const installedGalleryImageUrls = installed?.galleryImageUrls?.map((url) => url.trim()).filter(Boolean);
    const sheetGalleryImageUrls = sheet?.galleryImageUrls?.map((url) => url.trim()).filter(Boolean);
    const galleryImageUrls = installedGalleryImageUrls?.length
      ? installedGalleryImageUrls
      : sheetGalleryImageUrls?.length
        ? sheetGalleryImageUrls
        : undefined;
    const quoteImageUrl = installed?.quoteImageUrl?.trim() || sheet?.quoteImageUrl?.trim() || undefined;
    const slabImageUrl = installed?.slabImageUrl?.trim() || sheet?.slabImageUrl?.trim() || undefined;
    return {
      code,
      name: source.name,
      tone: source.tone,
      sheetPriceTHB: sheet?.basePriceTHB ?? null,
      installedPriceTHB: installed?.pricePerSqmTHB ?? null,
      documentCodes: [...new Set([...(installed?.aliases ?? []), ...(sheet?.aliases ?? [])])],
      imageUrl: installed?.imageUrl?.trim() || sheet?.imageUrl?.trim() || undefined,
      ...(galleryImageUrls ? { galleryImageUrls } : {}),
      ...(quoteImageUrl ? { quoteImageUrl } : {}),
      ...(slabImageUrl ? { slabImageUrl } : {}),
    };
  });
}

export function stoneColorsForMode(
  installedStones: ReadonlyArray<CatalogStoneRecord>,
  sheetStones: ReadonlyArray<CatalogStoneRecord>,
  mode: StoneConfig["mode"],
) {
  return mode === "whole-sheet"
    ? stoneColorsFromCatalog([], sheetStones)
    : stoneColorsFromCatalog(installedStones, []);
}

export type StoneSelectionReconciliation = {
  active: StoneConfig[];
  hidden: StoneConfig[];
};

/**
 * job-260: a stone code or name in the form used to compare spellings: lower case with every character that is not a letter
 * or a digit taken out (spaces, brackets, dashes, dots), so "QS822N", "QS822 N", "QS 822N" and "QS-822(N)" compare equal.
 * Letters and digits themselves are never changed or dropped: there is no O-for-0 rule and no trailing letter is cut, so
 * KZ802 and KZ802N stay two different stones. Thai vowel and tone marks count as letters and are kept.
 */
export function stoneIdentifierKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

function stoneIdentifiers(color: StoneColor): string[] {
  return [color.name, color.code, ...color.documentCodes];
}

/**
 * The stone an identifier (code, name or an approved alias from the catalogue's aliases) names, or undefined.
 *
 * job-277: a real code always beats an alias, so the lookup runs in four passes and never mixes the layers:
 *   1. a code equal to the identifier as typed
 *   2. a code equal to the identifier once spaces and punctuation are gone
 *   3. a name or an alias equal to the identifier as typed
 *   4. a name or an alias equal to that same reduced form
 * Before this, one scan over the rows let a stone whose alias list carried another stone's code win over the stone
 * that owns the code: "VW342" returned V342 Whisper at 9,500 a sqm instead of VW342 Aria Whisper at 12,000.
 * Job 260's rules are untouched: spaces, brackets, dashes and dots never matter, while letters and digits always do
 * (no O-for-0, no dropping a trailing N), and a spelling that matches as typed is still preferred over a reduced one.
 */
export function findStoneColor(identifier: string, colors: ReadonlyArray<StoneColor> = STONE_COLORS): StoneColor | undefined {
  const exact = identifier.trim().toLowerCase();
  const key = stoneIdentifierKey(identifier);
  const byCode = (match: (entry: string) => boolean) => colors.find((color) => match(color.code));
  const byNameOrAlias = (match: (entry: string) => boolean) =>
    colors.find((color) => match(color.name) || color.documentCodes.some(match));
  return byCode((code) => code.trim().toLowerCase() === exact)
    ?? (key ? byCode((code) => stoneIdentifierKey(code) === key) : undefined)
    ?? byNameOrAlias((value) => value.trim().toLowerCase() === exact)
    ?? (key ? byNameOrAlias((value) => stoneIdentifierKey(value) === key) : undefined);
}

export function stoneColorMatchesSelection(color: StoneColor, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (stoneIdentifiers(color).some((value) => value.trim().toLowerCase() === normalized)) return true;
  const key = stoneIdentifierKey(identifier);
  return key.length > 0 && stoneIdentifiers(color).some((value) => stoneIdentifierKey(value) === key);
}

/** Search box: a stone matches when its name, code or an alias contains the query, as typed or ignoring spaces and punctuation. */
export function stoneColorMatchesQuery(color: StoneColor, query: string) {
  const typed = query.trim().toLowerCase();
  if (!typed) return true;
  if (stoneIdentifiers(color).some((value) => value.toLowerCase().includes(typed))) return true;
  const key = stoneIdentifierKey(query);
  return key.length > 0 && stoneIdentifiers(color).some((value) => stoneIdentifierKey(value).includes(key));
}

/**
 * Reconcile persisted selections against the active catalog for each order mode.
 * A selection stays intact when its record is still active so in-progress
 * dimensions and quantities survive a catalog refresh. Hidden records are
 * returned separately so the UI can explain what changed before removing them.
 */
export function reconcileStoneSelections(
  stones: ReadonlyArray<StoneConfig>,
  colorsByMode: {
    "whole-sheet": ReadonlyArray<StoneColor>;
    installed: ReadonlyArray<StoneColor>;
  },
): StoneSelectionReconciliation {
  return stones.reduce<StoneSelectionReconciliation>((result, stone) => {
    const colors = colorsByMode[stone.mode];
    const matchedColor = findStoneColor(stone.color, colors);
    if (matchedColor) {
      // Persist the canonical catalog code. Older local-storage records can
      // contain a document alias; keeping that alias makes the UI treat a
      // removed code as a different selection and can make it appear again.
      result.active.push({ ...stone, color: matchedColor.code });
    } else {
      result.hidden.push(stone);
    }
    return result;
  }, { active: [], hidden: [] });
}

/**
 * job-278: a stone the catalogue does not know stays unknown. Until now every lookup ended in `?? colors[0]`, so an
 * unrecognised code — a typo, or a stone the database has since closed such as V342 after job 277 — quietly became
 * the first row of the catalogue: Bright White, 7,500 a square metre, 5,900 a sheet. A quote came out looking
 * complete while naming and pricing a stone nobody asked for (1 sqm of Aria Whisper quoted as Bright White is
 * 4,500 baht short). Three rules now hold instead:
 *   · a price helper returns null when it cannot name the stone, which every caller already treats as "no price"
 *     (App.tsx `stoneTotal`/`isInvalidStone`, StudioEstimate `stoneUnitPriceTHB`, `quoteSketchPiece` → "no-price");
 *   · the display helper still never returns undefined — thirty render sites read `.name`/`.tone` on it — but what it
 *     returns for an unknown identifier describes that identifier back, never another stone's identity;
 *   · `isUnknownStone()` is the explicit check for a caller that wants to say "ไม่รู้จักสีนี้" itself.
 */
export const UNKNOWN_STONE_TONE = "#e6e6e3";

/** The placeholder record for an identifier the catalogue cannot resolve. It carries no price on purpose. */
export function unknownStone(identifier: string): StoneColor {
  const code = identifier.trim();
  return { code, name: code || "ยังไม่ได้เลือกสีหิน", tone: UNKNOWN_STONE_TONE, sheetPriceTHB: null, installedPriceTHB: null, documentCodes: [] };
}

export function isUnknownStone(identifier: string, colors: ReadonlyArray<StoneColor> = STONE_COLORS): boolean {
  return findStoneColor(identifier, colors) === undefined;
}

export const stoneColorByName = (
  identifier: string,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
) => findStoneColor(identifier, colors) ?? unknownStone(identifier);

export const stoneSheetUnitPrice = (
  colorIdentifier: string,
  quantity: number,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
) => {
  const color = findStoneColor(colorIdentifier, colors);
  if (!color || color.sheetPriceTHB === null) return null;
  const promotionExcluded = ["BW010", "NW013"].includes(color.code);
  if (quantity >= 50 && !promotionExcluded) return Math.round(color.sheetPriceTHB * 0.95);
  if (quantity >= 10 && !promotionExcluded) return Math.max(0, color.sheetPriceTHB - 200);
  return color.sheetPriceTHB;
};

export const stoneInstalledUnitPrice = (
  colorIdentifier: string,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
) => findStoneColor(colorIdentifier, colors)?.installedPriceTHB ?? null;

export function toggleBasinSelection(lines: QuoteBasinLine[], sku: string): QuoteBasinLine[] {
  return lines.some((line) => line.sku === sku)
    ? lines.filter((line) => line.sku !== sku)
    : [...lines, { sku, quantity: 1, installationSelected: false }];
}

export function upsertStoneSelection(
  stones: StoneConfig[],
  incoming: StoneConfig,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
): StoneConfig[] {
  const incomingColor = colors.find((color) => stoneColorMatchesSelection(color, incoming.color));
  const next = stones.filter((stone) =>
    stone.color !== incoming.color
    && !(stone.mode === incoming.mode && incomingColor && stoneColorMatchesSelection(incomingColor, stone.color)),
  );
  const unitPrice = incoming.mode === "whole-sheet"
    ? stoneSheetUnitPrice(incoming.color, incoming.quantity, colors)
    : stoneInstalledUnitPrice(incoming.color, colors);
  return [...next, {
    ...incoming,
    color: incomingColor?.code ?? incoming.color,
    enabled: true,
    unitPrice: unitPrice ?? 0,
    installationPrice: 0,
  }];
}

export function removeStoneSelection(
  stones: StoneConfig[],
  color: string,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
): StoneConfig[] {
  const selectedColor = colors.find((candidate) => stoneColorMatchesSelection(candidate, color));
  return stones.filter((stone) =>
    stone.color !== color
    && !(selectedColor && stoneColorMatchesSelection(selectedColor, stone.color)),
  );
}

export function toggleStoneSelection(
  stones: StoneConfig[],
  color: string,
  createSelection: StoneConfig,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
): StoneConfig[] {
  const selectedColor = colors.find((candidate) => stoneColorMatchesSelection(candidate, color));
  const selected = stones.some((stone) =>
    stone.color === color || (selectedColor && stoneColorMatchesSelection(selectedColor, stone.color)),
  );
  return selected
    ? removeStoneSelection(stones, color, colors)
    : upsertStoneSelection(stones, createSelection, colors);
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
  ["KF010", "NA160", "Navis", 17000, counterDims],
  ["KF011", "VD382", "Drift", 19000, counterWideDims],
  ["KF012", "CS532M", "Cascade Slope", 19000, counterWideDims],
  ["KF013", "VR322", "Rotor Cloud", 19000, counterWideDims],
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

export function filterBasinProducts(products: ReadonlyArray<BasinProduct>, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return products;
  return products.filter((product) => [
    product.sku,
    product.colorCode,
    product.colorName,
    product.category,
  ].join(" ").toLocaleLowerCase().includes(normalizedQuery));
}

export function compareBasinProductSkus(left: BasinProduct, right: BasinProduct) {
  return left.sku.localeCompare(right.sku, "en", { numeric: true, sensitivity: "base" })
    || left.colorName.localeCompare(right.colorName, "th", { numeric: true, sensitivity: "base" });
}

export function sortBasinProductsBySku(products: ReadonlyArray<BasinProduct>) {
  return [...products].sort(compareBasinProductSkus);
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
  galleryImageUrls?: string[] | null;
  quoteImageUrl?: string | null;
  topViewImageUrl?: string | null;
  videoUrl?: string | null;
}): BasinProduct {
  const galleryImageUrls = (item.galleryImageUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));
  const imageUrl = item.imageUrl?.trim() || undefined;
  return {
    sku: item.sku,
    colorCode: item.colorCode,
    colorName: item.colorName,
    priceTHB: item.priceTHB,
    category: item.category as BasinCategory,
    dimensions: item.dimensions,
    basinDimensions: item.basinDimensions ?? undefined,
    imageTone: item.imageTone,
    imageUrl,
    galleryImageUrls: galleryImageUrls.length ? galleryImageUrls : undefined,
    quoteImageUrl: item.quoteImageUrl?.trim() || imageUrl,
    topViewImageUrl: item.topViewImageUrl?.trim() || undefined,
    videoUrl: item.videoUrl ?? undefined,
  };
}

export const formatTHB = (amount: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amount);