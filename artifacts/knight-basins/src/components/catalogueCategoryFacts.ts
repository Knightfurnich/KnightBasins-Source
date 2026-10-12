import {
  customerCategoryWording,
  isFreestandingPillarProduct,
  isMachineCategoryId,
  knownCategoryWording,
  STORAGE_CATEGORY,
  type BasinProduct,
} from "../data/catalog.ts";

/**
 * Catalogue index grouping (chips, card pill, search) - jobs 441-B v2 and 454-C.
 *
 * Source of truth: the model itself. `basinProductFromCatalog()` carries `category` and
 * `categoryLabel` of the `GET /api/catalog` row since job 454-C, and the built-in copy carries the
 * same two fields (job 451-C), so nothing here keeps a per-SKU copy of what the API said.
 * (Before 454-C the mapper dropped `categoryLabel`, and this module held a Map of the raw rows.)
 *
 * Rule that must not break: no data => no wording. Nothing here invents a category name; the
 * fallback is `productCategoryLabel()`, which lives in the data layer.
 */

/** The machine category the database files the ready-made shelf sets under (KF029 / KF030). */
export const SHELF_SET_ROW_CATEGORY = STORAGE_CATEGORY;

/** Which chip a product belongs to: its own category. */
export function catalogueGroupValue(product: BasinProduct): string {
  return product.category;
}

// job 459-C: the machine-id table and its helpers moved to the data layer (src/data/catalog.ts) so the JSON-LD shares
// them; they are re-exported here so every existing import keeps working and the behaviour is unchanged.
export { isMachineCategoryId, customerCategoryWording };

/**
 * The Thai chip/card wording: the model's `categoryLabel`, else the data layer's own label.
 * A label that is just a raw machine id is not wording (C2) and is replaced by its Thai text.
 */
export function catalogueGroupLabel(
  product: BasinProduct,
  fallback: (product: BasinProduct) => string,
): string {
  const fromModel = product.categoryLabel?.trim();
  if (fromModel && !isMachineCategoryId(fromModel)) return fromModel;
  const fallbackText = fallback(product);
  return knownCategoryWording(fallbackText) ?? knownCategoryWording(fromModel ?? "") ?? fallbackText;
}

/** A shelf set: a row filed under `storage`, or one the built-in predicate names. */
export function isShelfSetProduct(product: BasinProduct): boolean {
  return product.category === SHELF_SET_ROW_CATEGORY || isFreestandingPillarProduct(product);
}

export type CatalogueChip = {
  /** Stable machine value used for filtering. */
  value: string;
  /** Wording shown on the chip (never invented here). */
  label: string;
  count: number;
  /** True when the category table did not list this group (a row-level category, e.g. storage). */
  fromRowsOnly: boolean;
};

/**
 * Chips for the catalogue index, grouped by the product's category and counted over the products
 * actually being shown. `tableNames` is the `categories` list the API sends - it can be shorter
 * than reality (today it has no `storage`), so groups the table omits are appended from the rows
 * instead of being silently folded into "ทรงสูง".
 */
export function buildCatalogueChips(
  products: ReadonlyArray<BasinProduct>,
  tableNames: ReadonlyArray<string>,
  fallback: (product: BasinProduct) => string,
): CatalogueChip[] {
  const grouped = new Map<string, BasinProduct[]>();
  for (const product of products) {
    const value = catalogueGroupValue(product);
    const list = grouped.get(value);
    if (list) list.push(product);
    else grouped.set(value, [product]);
  }
  const chips: CatalogueChip[] = [];
  const seen = new Set<string>();
  const push = (value: string, fromRowsOnly: boolean) => {
    if (seen.has(value)) return;
    const members = grouped.get(value) ?? [];
    seen.add(value);
    // C2: a group with no product used to print its raw id. It now prints Thai wording, or no chip.
    const label = members.length ? catalogueGroupLabel(members[0], fallback) : customerCategoryWording(value);
    if (!label) return;
    chips.push({
      value,
      label,
      count: members.length,
      fromRowsOnly,
    });
  };
  for (const name of tableNames) push(name, false);
  for (const value of grouped.keys()) push(value, true);
  // C2: an empty group whose Thai wording another chip already carries (the same id in another
  // letter case) would only print a second "ทรงสูง 0" - drop it.
  const shown = new Set(chips.filter((chip) => chip.count > 0).map((chip) => chip.label));
  return chips.filter((chip) => chip.count > 0 || !shown.has(chip.label));
}
