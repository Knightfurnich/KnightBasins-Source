import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { basinProductFromCatalog, PRODUCTS, productCategoryLabel, type BasinProduct } from "../src/data/catalog.ts";
import {
  buildCatalogueChips,
  catalogueGroupLabel,
  catalogueGroupValue,
  isShelfSetProduct,
  SHELF_SET_ROW_CATEGORY,
} from "../src/components/catalogueCategoryFacts.ts";

/**
 * jobs 441-B v2 + 454-C - the catalogue index shows what `GET /api/catalog` says per row, and it
 * reads it from the MODEL: `basinProductFromCatalog()` carries `category` + `categoryLabel`, so the
 * UI no longer keeps a per-SKU copy of the raw rows (the 441-B cache is gone).
 *
 * `test/fixtures/catalog-basin-rows-441.json` is the live response captured 11 ต.ค. 69: 30 basins,
 * `categoryLabel` on all 30, KF029 / KF030 filed under `storage` ("เสาวางของตั้งพื้น") while the same
 * response's category *table* lists only `counter basin` and `tall vertical washbasin`.
 */

const snapshot = JSON.parse(
  readFileSync(new URL("./fixtures/catalog-basin-rows-441.json", import.meta.url), "utf8"),
) as { categories: string[]; basins: Array<Record<string, unknown>> };

const apiRows = snapshot.basins;
const tableCategories = snapshot.categories;
/** What the app holds after the API answers. */
const models = apiRows.map((row) => basinProductFromCatalog(row as never)) as BasinProduct[];
/** An API that sends no `categoryLabel` (older deploy / the field removed). */
const unlabelled = apiRows.map((row) => basinProductFromCatalog({ ...row, categoryLabel: null } as never)) as BasinProduct[];
/** The built-in copy: what a crawler and the offline page start from. */
const builtIn = [...PRODUCTS] as BasinProduct[];
const pillar = models.find((model) => model.sku === "KF029")!;
const counter = models.find((model) => model.sku === "KF003")!;

const chipsOf = (products: ReadonlyArray<BasinProduct>, table: ReadonlyArray<string> = tableCategories) =>
  buildCatalogueChips(products, table, productCategoryLabel);

/** Source of a file with comment lines and block comments removed. */
function codeOnly(rel: string): string {
  const path = new URL(rel, import.meta.url);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("the mapper carries the row's category wording (454-C ข้อ A + E)", () => {
  it("every live row keeps its category and categoryLabel in the model", () => {
    assert.equal(models.length, 30);
    for (const [index, model] of models.entries()) {
      const row = apiRows[index] as { category: string; categoryLabel: string };
      assert.equal(model.category, row.category, `${model.sku} category`);
      assert.equal(model.categoryLabel, row.categoryLabel, `${model.sku} categoryLabel`);
      assert.ok(model.categoryLabel, `${model.sku} has wording`);
    }
    assert.equal(pillar.categoryLabel, "เสาวางของตั้งพื้น");
    assert.equal(counter.categoryLabel, "เคาน์เตอร์");
  });

  it("a missing, blank or null label becomes undefined, never a guess", () => {
    const base = { ...apiRows[0] } as Record<string, unknown>;
    for (const value of [undefined, null, "", "   "]) {
      assert.equal(basinProductFromCatalog({ ...base, categoryLabel: value } as never).categoryLabel, undefined);
    }
    assert.equal(basinProductFromCatalog({ ...base, categoryLabel: "  เคาน์เตอร์ " } as never).categoryLabel, "เคาน์เตอร์", "trimmed");
  });

  it("the fields the mapper already carried are unchanged (price, sizes, ids)", () => {
    for (const [index, model] of models.entries()) {
      const row = apiRows[index] as { sku: string; priceTHB: number; dimensions: string; colorCode: string; colorName: string };
      assert.equal(model.sku, row.sku);
      assert.equal(model.priceTHB, row.priceTHB);
      assert.equal(model.dimensions, row.dimensions);
      assert.equal(model.colorCode, row.colorCode);
      assert.equal(model.colorName, row.colorName);
    }
  });

  it("the built-in copy carries the same two fields for every SKU (451-C)", () => {
    for (const product of builtIn) assert.ok(product.categoryLabel, `${product.sku} built-in wording`);
    assert.equal(builtIn.find((p) => p.sku === "KF029")!.categoryLabel, "เสาวางของตั้งพื้น");
    assert.equal(builtIn.find((p) => p.sku === "KF029")!.category, SHELF_SET_ROW_CATEGORY);
  });
});

describe("chips follow the product's category (441-B ข้อ A + B, now from the model)", () => {
  it("the shelf sets get their own chip with the API's wording", () => {
    const storage = chipsOf(models).find((chip) => chip.value === "storage");
    assert.ok(storage, "the response files KF029/KF030 under storage even though the category table omits it");
    assert.equal(storage.label, "เสาวางของตั้งพื้น", "verbatim categoryLabel - not text we wrote");
    assert.equal(storage.count, 2);
    assert.equal(storage.fromRowsOnly, true);
    assert.equal(catalogueGroupLabel(pillar, productCategoryLabel), "เสาวางของตั้งพื้น");
    assert.notEqual(catalogueGroupLabel(pillar, productCategoryLabel), "ทรงสูง", "the pill must not call a shelf a tall basin");
  });

  it("the counts do not fold the shelf sets into the tall group", () => {
    const counts = new Map(chipsOf(models).map((chip) => [chip.value, chip.count]));
    assert.equal(counts.get("counter basin"), 18);
    assert.equal(counts.get("tall vertical washbasin"), 10, "10 real tall basins, not 12 with the shelves added");
    assert.equal(counts.get("storage"), 2);
    assert.equal([...counts.values()].reduce((a, b) => a + b, 0), models.length, "each row lands in exactly one chip");
    assert.equal(catalogueGroupValue(pillar), "storage");
    assert.equal(catalogueGroupValue(counter), "counter basin");
  });

  it("the category table still leads the chip order", () => {
    assert.deepEqual(chipsOf(models).map((chip) => chip.value).slice(0, tableCategories.length), [...tableCategories]);
  });

  it("the built-in copy gives the same chips as the API (before the API answers)", () => {
    // the state a crawler reads first (the prerendered HTML): same groups, same wording, no network
    assert.deepEqual(
      chipsOf(builtIn).map((chip) => `${chip.value}|${chip.label}|${chip.count}`),
      chipsOf(models).map((chip) => `${chip.value}|${chip.label}|${chip.count}`),
    );
  });

  it("a row the API stops labelling falls back to the data layer, never to a guess", () => {
    const bare = unlabelled.find((m) => m.sku === "KF003")!;
    assert.equal(bare.categoryLabel, undefined);
    assert.equal(catalogueGroupValue(bare), "counter basin", "the machine value still arrives");
    assert.equal(catalogueGroupLabel(bare, productCategoryLabel), productCategoryLabel(bare), "fallback is the data layer's label");
  });

  it("a new response is a new array of new models, so React repaints (no stale copy)", () => {
    const again = apiRows.map((row) => basinProductFromCatalog(row as never));
    assert.notEqual(again, models);
    assert.notEqual(again[0], models[0]);
    const relabelled = apiRows.map((row) => basinProductFromCatalog({ ...row, categoryLabel: row.sku === "KF029" ? "ชั้นวางของ" : row.categoryLabel } as never));
    assert.equal(chipsOf(relabelled as BasinProduct[]).find((chip) => chip.value === "storage")!.label, "ชั้นวางของ", "a changed wording shows at once");
  });

  it("a shelf set is recognised from the row's category or the built-in predicate", () => {
    assert.equal(isShelfSetProduct(pillar), true);
    assert.equal(isShelfSetProduct(counter), false);
    assert.equal(isShelfSetProduct({ ...counter, category: "storage" } as BasinProduct), true);
  });
});

describe("the UI keeps no copy of the rows any more (454-C ข้อ B)", () => {
  it("catalogueCategoryFacts.ts has no per-SKU cache or index function", () => {
    const code = codeOnly("../src/components/catalogueCategoryFacts.ts");
    assert.doesNotMatch(code, /indexCatalogueRowFacts|catalogueRowFacts|EMPTY_CATALOGUE_FACTS|CatalogueFacts|new Map<string, CatalogueRowFacts>/);
  });

  it("App.tsx builds no facts and passes none down", () => {
    const app = codeOnly("../src/App.tsx");
    assert.doesNotMatch(app, /catalogueFacts|indexCatalogueRowFacts|catalogueRowFacts|CatalogueFacts|facts=\{/);
    assert.match(app, /catalogueGroupValue\(product\) === category/, "chip filtering uses the product's category");
    assert.match(app, /catalogueGroupValue\(product\), catalogueGroupLabel\(product, productCategoryLabel\)\]\.join\(" "\)/,
      "the wording is searchable, so typing เสา finds KF029/KF030");
  });

  it("the card prints the pill from the very product the list rendered it for", () => {
    const app = codeOnly("../src/App.tsx");
    assert.match(app, /<ProductCard key=\{product\.sku\} sku=\{product\.sku\} product=\{product\}/, "no lookup in the (late-refreshed) PRODUCTS array");
    assert.match(app, /const product = given \?\? productBySku\(sku\)!;/);
    assert.match(app, /const isPillarSet = isShelfSetProduct\(product\);/);
    assert.match(app, /label-product-category-\$\{sku\}`\}>\{catalogueGroupLabel\(product, productCategoryLabel\)/, "the pill prints the model's wording");
  });
});

describe("the UI does not read the static bowl-shape table (441-B ข้อ C)", () => {
  for (const rel of ["../src/components/catalogueCategoryFacts.ts", "../src/App.tsx", "../src/components/StudioPage.tsx"]) {
    it(`${rel.replace("../", "")} has no live reference to BASIN_BOWL_SHAPES`, () => {
      const code = codeOnly(rel);
      assert.ok(code.length > 0 || !existsSync(new URL(rel, import.meta.url)));
      assert.doesNotMatch(code, /BASIN_BOWL_SHAPES/, "only the data layer may touch that table");
    });
  }
});

describe("no raw machine id reaches the customer, in any mode (441-B v2 C2 - still true after 454-C)", () => {
  const RAW_IDS = ["storage", "counter basin", "tall vertical washbasin"];
  const isRaw = (text: string) => RAW_IDS.some((id) => text.toLowerCase().includes(id));
  const withTable = [...tableCategories, "storage"];

  const worlds: Array<[string, ReadonlyArray<BasinProduct>, ReadonlyArray<string>]> = [
    ["before the API answers (built-in copy)", builtIn, []],
    ["offline, table known", builtIn, tableCategories],
    ["API answered", models, tableCategories],
    ["API answered, table lists all three ids", models, withTable],
    ["API answered without any wording", unlabelled, withTable],
    ["API answered but no product is shown", [], withTable],
    ["nothing at all", [], []],
  ];

  for (const [name, products, table] of worlds) {
    it(`chips: ${name}`, () => {
      for (const chip of chipsOf(products, table)) {
        assert.ok(chip.label.trim(), `empty label for ${chip.value}`);
        assert.ok(!isRaw(chip.label), `raw id printed on a chip: "${chip.label}" (${chip.value})`);
      }
    });
  }

  it("an empty group is shown in Thai, not by its id", () => {
    const labels = new Map(chipsOf([], ["counter basin", "tall vertical washbasin", "storage"]).map((chip) => [chip.value, chip.label]));
    assert.equal(labels.get("counter basin"), "เคาน์เตอร์");
    assert.equal(labels.get("tall vertical washbasin"), "ทรงสูง");
    assert.equal(labels.get("storage"), "เสาวางของตั้งพื้น");
  });

  it("an English-only name nobody translated gets no chip; a Thai name keeps its own", () => {
    const chips = chipsOf([], ["wall basin", "อ่างติดผนัง", "Storage"]);
    assert.deepEqual(chips.map((chip) => chip.value), ["อ่างติดผนัง", "Storage"], "wall basin is hidden; Storage maps to its Thai wording");
    assert.equal(chips[0].label, "อ่างติดผนัง");
    assert.equal(chips[1].label, "เสาวางของตั้งพื้น");
  });

  it("an empty duplicate (same id, other letter case) does not add a second identical chip", () => {
    const chips = chipsOf(models, [...tableCategories, "Tall Vertical Washbasin", "STORAGE"]);
    const labels = chips.map((chip) => chip.label);
    assert.equal(new Set(labels).size, labels.length, `duplicate chip wording: ${labels.join(" | ")}`);
    assert.deepEqual(chips.map((chip) => `${chip.label} ${chip.count}`), ["เคาน์เตอร์ 18", "ทรงสูง 10", "เสาวางของตั้งพื้น 2"]);
  });

  it("a model whose label is the raw id is not trusted as wording", () => {
    const dirty = basinProductFromCatalog({ ...apiRows.find((r) => r.sku === "KF029"), categoryLabel: "storage" } as never);
    const label = catalogueGroupLabel(dirty, productCategoryLabel);
    assert.ok(!isRaw(label), `got "${label}"`);
    assert.equal(label, "เสาวางของตั้งพื้น");
    const rawCounter = basinProductFromCatalog({ ...apiRows.find((r) => r.sku === "KF003"), categoryLabel: "Counter Basin" } as never);
    assert.equal(catalogueGroupLabel(rawCounter, productCategoryLabel), "เคาน์เตอร์");
  });

  it("every card pill that shows wording is Thai (all 30 rows, every world)", () => {
    for (const products of [builtIn, models, unlabelled]) {
      for (const model of products) {
        const text = catalogueGroupLabel(model, productCategoryLabel);
        assert.ok(!isRaw(text), `${model.sku}: "${text}"`);
        assert.match(text, /[฀-๿]/, `${model.sku} wording is not Thai`);
      }
    }
  });

  it("App.tsx has no helper that falls back to the raw name, and chips print item.label only", () => {
    const app = codeOnly("../src/App.tsx");
    assert.doesNotMatch(app, /legacyCategoryLabels/, "the `?? name` fallback helper must stay deleted");
    assert.doesNotMatch(app, /function categoryLabel\(/);
    assert.match(app, /\{item\.label\} \{categoryCounts\.get\(item\.value\)/, "the chip text is the resolved wording");
    const tabs = app.slice(app.indexOf('className="filter-tabs'), app.indexOf('className="sort-field"'));
    assert.ok(tabs.includes("catalogueChips.map"), "the chip row is the one built by buildCatalogueChips");
    assert.doesNotMatch(tabs, /[>\s]\{item\.(value|name)\}|categoryLabel\(/, "a chip never prints its id");
  });
});
