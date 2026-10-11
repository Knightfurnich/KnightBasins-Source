import { isFreestandingPillarProduct, STORAGE_CATEGORY_LABEL, type BasinProduct } from "../data/catalog.ts";

/**
 * job 441-B — the row-level category facts of the storefront.
 *
 * ownership split the boss/เดวิด ruled on 11 ต.ค. 69: the *static* copy in
 * `src/data/catalog.ts` (the pillar rows' `category`, and `BASIN_BOWL_SHAPES`) belongs to job
 * 451-C (ชัย); the UI is job 441-B (บอย). So this module never reads the static tables — it keeps
 * what `GET /api/catalog` said per row, in memory, and the catalogue index renders from that.
 *
 * Why a cache instead of reading the fields off `BasinProduct`:
 * `basinProductFromCatalog()` rebuilds its object from an explicit field list and has never
 * carried `categoryLabel`, so once the mapper runs the row-level Thai wording is gone. Editing
 * that mapper is 451-C's file, so the UI keeps its own copy of what it was told. When 451-C adds
 * the field to the model, `catalogCategoryLabel()` picks the model's own value next and this
 * cache can be deleted without changing a call site.
 *
 * The facts are built fresh per catalogue load and handed down as a value (`Map`), never kept in a
 * module-level cache: an earlier draft cached them and the memo over `products` (a stable array
 * identity, mutated in place by the loader) then rendered the shelf chip with the built-in wording
 * instead of the database's - measured in the browser on 11 ต.ค. 69.
 *
 * Rule that must not break: no data => no wording. Nothing here invents a category name; the
 * fallback is `productCategoryLabel()`, which lives in the data layer.
 */

export type CatalogueRowFacts = {
  category: string | null;
  categoryLabel: string | null;
};

export type CatalogueFacts = ReadonlyMap<string, CatalogueRowFacts>;

/** Empty facts = the state before the catalogue has answered. */
export const EMPTY_CATALOGUE_FACTS: CatalogueFacts = new Map();

/** Rebuilt on every load, so a value the database removes really disappears. */
export function indexCatalogueRowFacts(rows: unknown): CatalogueFacts {
  const facts = new Map<string, CatalogueRowFacts>();
  if (!Array.isArray(rows)) return facts;
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const sku = typeof record.sku === "string" ? record.sku.trim().toUpperCase() : "";
    if (!sku) continue;
    const category = typeof record.category === "string" && record.category.trim() ? record.category.trim() : null;
    const categoryLabel = typeof record.categoryLabel === "string" && record.categoryLabel.trim() ? record.categoryLabel.trim() : null;
    if (!category && !categoryLabel) continue;
    facts.set(sku, { category, categoryLabel });
  }
  return facts;
}

export function catalogueRowFacts(sku: string | undefined | null, facts: CatalogueFacts): CatalogueRowFacts | null {
  if (!sku) return null;
  return facts.get(sku.trim().toUpperCase()) ?? null;
}

/**
 * The machine category the database files the ready-made shelf sets under today
 * (`GET /api/catalog` 11 ต.ค. 69: KF029 / KF030 → `category: "storage"`, see
 * `test/fixtures/catalog-basin-rows-441.json`). Used only as the fallback when no row facts exist.
 */
export const SHELF_SET_ROW_CATEGORY = "storage";

/** Which chip a product belongs to — the database's value first, the model's only as fallback. */
export function catalogueGroupValue(product: BasinProduct, facts: CatalogueFacts): string {
  const fromRow = catalogueRowFacts(product.sku, facts)?.category;
  if (fromRow) return fromRow;
  // Before the catalogue answers (the prerendered HTML a crawler reads first) the built-in copy can
  // still file a shelf set under `tall vertical washbasin`. `isFreestandingPillarProduct` is the data
  // layer's own predicate, so splitting the group here adds no category claim of our own.
  if (isFreestandingPillarProduct(product)) return SHELF_SET_ROW_CATEGORY;
  return product.category;
}

/**
 * job 441-B v2 / C2 — machine category ids are not wording. The three the catalogue files rows
 * under are mapped to the Thai text the data layer / API already uses; nothing is invented here.
 */
const MACHINE_CATEGORY_WORDING: Readonly<Record<string, string>> = {
  "counter basin": "เคาน์เตอร์",
  "tall vertical washbasin": "ทรงสูง",
  [SHELF_SET_ROW_CATEGORY]: STORAGE_CATEGORY_LABEL,
};

const THAI_LETTER = /[฀-๿]/;

function knownWording(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MACHINE_CATEGORY_WORDING, key) ? MACHINE_CATEGORY_WORDING[key] : undefined;
}

/** True for the raw ids (`storage`, `counter basin`, `tall vertical washbasin`) in any letter case. */
export function isMachineCategoryId(text: string): boolean {
  return knownWording(text) !== undefined;
}

/**
 * The wording a customer may read for a category *name* that has no product under it: the Thai
 * text of a known id, or the name itself when it is already Thai. Anything else (an English-only
 * name nobody translated) is `null` - the caller hides it instead of printing the raw word.
 */
export function customerCategoryWording(name: string): string | null {
  return knownWording(name) ?? (THAI_LETTER.test(name) ? name.trim() : null);
}

/**
 * The Thai chip/card wording: `categoryLabel` from the row, else the data layer's own label.
 * A label that is just a raw machine id is not wording (C2) and is replaced by its Thai text.
 */
export function catalogueGroupLabel(
  product: BasinProduct,
  fallback: (product: BasinProduct) => string,
  facts: CatalogueFacts,
): string {
  const fromRow = catalogueRowFacts(product.sku, facts)?.categoryLabel;
  if (fromRow && !isMachineCategoryId(fromRow)) return fromRow;
  const fromModel = fallback(product);
  return knownWording(fromModel) ?? knownWording(fromRow ?? "") ?? fromModel;
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
 * Chips for the catalogue index, grouped by the row-level category and counted over the products
 * actually being shown. `tableNames` is the `categories` list the API sends — it can be shorter
 * than reality (today it has no `storage`), so groups the table omits are appended from the rows
 * instead of being silently folded into "ทรงสูง".
 */
export function buildCatalogueChips(
  products: ReadonlyArray<BasinProduct>,
  tableNames: ReadonlyArray<string>,
  fallback: (product: BasinProduct) => string,
  facts: CatalogueFacts,
): CatalogueChip[] {
  const grouped = new Map<string, BasinProduct[]>();
  for (const product of products) {
    const value = catalogueGroupValue(product, facts);
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
    const label = members.length ? catalogueGroupLabel(members[0], fallback, facts) : customerCategoryWording(value);
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
  return chips;
}
