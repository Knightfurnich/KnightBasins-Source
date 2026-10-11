/**
 * job 440-C: KF029 and KF030 are floor-standing storage pillars ("เสาวางของตั้งพื้น"), not wash basins (owner ruling,
 * 10-11 Oct 2026). The database still files them under the "tall vertical washbasin" category and the owner rules out
 * writes to production, so the API fixes the type on the way out — like the media and bowl-shape fields.
 *
 * What GET /api/catalog sends for every basin row:
 *  - `category`      machine type. Unchanged for every wash basin ("counter basin", "tall vertical washbasin", or whatever
 *                    custom category the admin made); `"storage"` for KF029 / KF030.
 *  - `categoryLabel` Thai text for the type, ready to print, so the web never types it itself.
 * Price, size, colour, name, code, bowl size (`basinDimensions` stays null for the pillars), order and visibility are never
 * touched, and no row is hidden.
 */
export const STORAGE_CATEGORY = "storage";
export const STORAGE_PILLAR_LABEL = "เสาวางของตั้งพื้น";

const STORAGE_PILLAR_SKUS: ReadonlySet<string> = new Set(["KF029", "KF030"]);

/** The wording the filter buttons already use for the two built-in categories; a custom category is its own name. */
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  "counter basin": "เคาน์เตอร์",
  "tall vertical washbasin": "ทรงสูง",
};

export function isStoragePillarSku(sku: string): boolean {
  return STORAGE_PILLAR_SKUS.has(sku.trim().toUpperCase());
}

export function withBasinProductType<T extends { sku: string; category: string }>(basin: T): T & { categoryLabel: string } {
  if (isStoragePillarSku(basin.sku)) return { ...basin, category: STORAGE_CATEGORY, categoryLabel: STORAGE_PILLAR_LABEL };
  return { ...basin, categoryLabel: CATEGORY_LABELS[basin.category] ?? basin.category };
}
