// The trade constants the app prices with, in the shape the knowledge-base feed (`pricing.json`) uses, so a consumer can
// compare the two one to one. Nothing here is a number of its own: every figure is either imported from the storefront's
// pricing module (the very constants the calculators, the quote and the price guide read) or defined once below and used
// by the code that applies it (the catalogue seed, `sheetTierPrices`). Job 405-C.
//
// What is NOT exported, on purpose: values the app does not price with (the bot's `sale_types`, `glue_gun`,
// `basin_stopper`, the delivery window, tier notes). Exporting copies of those would let the feed "agree" with itself and
// prove nothing. The night-work rule used to be on that list because the app and the feed worded its scope differently;
// the owner ruled on 10 Oct 2026 that it applies in every area (job 429-C), so it is exported like the other fees.

import {
  INSTALLATION_PRICE,
  NIGHT_WORK_END,
  NIGHT_WORK_FEE,
  NIGHT_WORK_START,
  STONE_GLUE_PRICE,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
} from "../../../knight-basins/src/data/catalog.ts";

// ---- Sheet quantity discount (the only definition; the catalogue seed applies it) -------------------------------------
/** Orders of at least this many sheets use the stone's `price10PlusTHB`. */
export const SHEET_DISCOUNT_TIER_1_FROM = 10;
/** ... and at least this many use `price50PlusTHB`. */
export const SHEET_DISCOUNT_TIER_2_FROM = 50;
/** Baht off the base price per sheet from `SHEET_DISCOUNT_TIER_1_FROM` sheets. */
export const SHEET_DISCOUNT_TIER_1_THB_PER_SHEET = 200;
/** Multiplier on the base price from `SHEET_DISCOUNT_TIER_2_FROM` sheets (0.95 = 5% off). */
export const SHEET_DISCOUNT_TIER_2_MULTIPLIER = 0.95;
/** Colours that never get a quantity discount: their 10+/50+ prices equal the base price. */
export const SHEET_DISCOUNT_EXCLUDED_CODES: readonly string[] = ["BW010", "NW013"];

/** The 10+/50+ prices a stone is seeded with. Behaviour is exactly what the seed computed inline before job 405-C. */
export function sheetTierPrices(code: string, basePriceTHB: number): { price10PlusTHB: number; price50PlusTHB: number } {
  if (SHEET_DISCOUNT_EXCLUDED_CODES.includes(code)) return { price10PlusTHB: basePriceTHB, price50PlusTHB: basePriceTHB };
  return {
    price10PlusTHB: Math.max(0, basePriceTHB - SHEET_DISCOUNT_TIER_1_THB_PER_SHEET),
    price50PlusTHB: Math.round(basePriceTHB * SHEET_DISCOUNT_TIER_2_MULTIPLIER),
  };
}

// ---- Exported blocks (same field names and order as the feed) ---------------------------------------------------------
export type InstallationRule = { scope: string; condition: string; charge: number | null; unit: string };
export type DiscountTier = { min: number; max: number | null; type: "none" | "per_sheet" | "percent"; amount?: number };
export type Addon = { id: string; label: string; price: number; unit: string };
export type SheetSize = { w_m: number; h_m: number; thickness_mm: number; m2: number };

export type CommercialConstants = {
  vat_percent: number;
  installation: { rules: InstallationRule[] };
  discount_tiers: DiscountTier[];
  discount_excluded_codes: string[];
  addons: Addon[];
  /** Absent (not guessed) if the storefront's size strings can no longer be read as numbers. */
  sheet_size?: SheetSize;
};

/** "0.76 × 3.60 m" and "หนา 12 mm" are the storefront's display strings; read the numbers out, or return undefined. */
export function sheetSizeFromStorefront(size: string = STONE_SHEET_SIZE, thickness: string = STONE_SHEET_THICKNESS): SheetSize | undefined {
  const dims = /^\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*m\s*$/i.exec(size);
  const thick = /(\d+(?:\.\d+)?)\s*mm/i.exec(thickness);
  if (!dims || !thick) return undefined;
  const w = Number(dims[1]);
  const h = Number(dims[2]);
  return { w_m: w, h_m: h, thickness_mm: Number(thick[1]), m2: Math.round(w * h * 1000) / 1000 };
}

export function commercialConstants(): CommercialConstants {
  const sheetSize = sheetSizeFromStorefront();
  return {
    vat_percent: Math.round(VAT_RATE * 100),
    installation: {
      rules: [
        { scope: "กทม.+ปริมณฑล", condition: `พื้นที่น้อยกว่า ${STONE_INSTALLED_MIN_BANGKOK_SQM} ตร.ม.`, charge: STONE_SMALL_JOB_BANGKOK_FEE, unit: "บาท/งาน" },
        { scope: "ต่างจังหวัด", condition: `พื้นที่น้อยกว่า ${STONE_INSTALLED_MIN_PROVINCE_SQM} ตร.ม.`, charge: STONE_SMALL_JOB_PROVINCE_FEE, unit: "บาท/งาน" },
        // A customer who collects at the factory pays no service charge (SKETCH_FULFILMENTS "pickup"; the calculators add none).
        { scope: "ลูกค้ารับสินค้าเองที่โรงงาน", condition: "-", charge: 0, unit: "ไม่คิดค่าดำเนินการ" },
        { scope: `งานกลางคืน ${NIGHT_WORK_START}-${NIGHT_WORK_END} น.`, condition: "ทุกพื้นที่", charge: NIGHT_WORK_FEE, unit: "บาท/คืน" },
        // The app states it has no rate for province travel and allowance (SKETCH_PROVINCE_TRAVEL_NOTE): no number, by design.
        { scope: "ค่าเดินทาง + เบี้ยเลี้ยง", condition: "งานต่างจังหวัด", charge: null, unit: "ตามสถานที่" },
      ],
    },
    discount_tiers: [
      { min: 1, max: SHEET_DISCOUNT_TIER_1_FROM - 1, type: "none" },
      { min: SHEET_DISCOUNT_TIER_1_FROM, max: SHEET_DISCOUNT_TIER_2_FROM - 1, type: "per_sheet", amount: SHEET_DISCOUNT_TIER_1_THB_PER_SHEET },
      { min: SHEET_DISCOUNT_TIER_2_FROM, max: null, type: "percent", amount: Math.round((1 - SHEET_DISCOUNT_TIER_2_MULTIPLIER) * 100) },
    ],
    discount_excluded_codes: [...SHEET_DISCOUNT_EXCLUDED_CODES],
    addons: [
      { id: "glue", label: "กาวหินสังเคราะห์ 250 ML", price: STONE_GLUE_PRICE, unit: "บาท/หลอด" },
      { id: "basin_install", label: "ค่าดำเนินการติดตั้งชุดอ่าง", price: INSTALLATION_PRICE, unit: "บาท/ชุด" },
    ],
    ...(sheetSize ? { sheet_size: sheetSize } : {}),
  };
}
