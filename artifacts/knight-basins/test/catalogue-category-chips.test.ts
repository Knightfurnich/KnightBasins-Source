import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { basinProductFromCatalog, productCategoryLabel, type BasinProduct } from "../src/data/catalog.ts";
import {
  buildCatalogueChips,
  catalogueGroupLabel,
  catalogueGroupValue,
  catalogueRowFacts,
  EMPTY_CATALOGUE_FACTS,
  indexCatalogueRowFacts,
  SHELF_SET_ROW_CATEGORY,
  type CatalogueFacts,
} from "../src/components/catalogueCategoryFacts.ts";

/**
 * job 441-B (UI side) — the catalogue index must show what `GET /api/catalog` says per row.
 *
 * `test/fixtures/catalog-basin-rows-441.json` is the live response captured 11 ต.ค. 69: 30 basins,
 * `categoryLabel` present on all 30, and KF029 / KF030 filed under the machine category `storage`
 * with the wording "เสาวางของตั้งพื้น" — while the same response's category *table* lists only
 * `counter basin` and `tall vertical washbasin`. That gap is the bug: the shelf sets were counted
 * inside "ทรงสูง" (12 instead of 10) and had no chip of their own.
 *
 * The static copy in `src/data/catalog.ts` (`BASIN_BOWL_SHAPES`, the pillar rows' own `category`)
 * is job 451-C's to fix, so every assertion here holds whichever way that file goes.
 */

const snapshot = JSON.parse(
  readFileSync(new URL("./fixtures/catalog-basin-rows-441.json", import.meta.url), "utf8"),
) as { categories: string[]; basins: Array<Record<string, unknown>> };

const apiRows = snapshot.basins;
const tableCategories = snapshot.categories;
const models = apiRows.map((row) => basinProductFromCatalog(row as never)) as BasinProduct[];
const pillar = models.find((model) => model.sku === "KF029")!;
const counter = models.find((model) => model.sku === "KF003")!;

const FACTS: CatalogueFacts = indexCatalogueRowFacts(apiRows);
const chipsWith = (facts: CatalogueFacts) => buildCatalogueChips(models, tableCategories, productCategoryLabel, facts);
assert.equal(FACTS.size, apiRows.length, "every live row carries a category value or label");

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

describe("chips follow the row-level category (441-B ข้อ A + B)", () => {
  it("before the catalogue loads nothing comes from the index — the data layer's label is used", () => {
    assert.equal(catalogueRowFacts("KF029", EMPTY_CATALOGUE_FACTS), null, "no facts before the catalogue answers");
    const chips = chipsWith(EMPTY_CATALOGUE_FACTS);
    assert.deepEqual(chips.map((chip) => chip.value).slice(0, tableCategories.length), [...tableCategories],
      "the category table still leads the order");
    const storage = chips.find((chip) => chip.value === "storage")!;
    assert.equal(storage.label, productCategoryLabel(pillar),
      "without row facts the wording is the data layer's own, invented by nobody here");
    assert.notEqual(storage.label, "เสาวางของตั้งพื้น", "the API text is not present before the API has spoken");
  });

  it("after the load, the shelf sets get their own chip using the API's wording", () => {
        const storage = buildCatalogueChips(models, tableCategories, productCategoryLabel, FACTS).find((chip) => chip.value === "storage");
    assert.ok(storage, "the response files KF029/KF030 under storage even though the category table omits it");
    assert.equal(storage.label, "เสาวางของตั้งพื้น", "verbatim categoryLabel - not text we wrote");
    assert.equal(storage.count, 2);
    assert.equal(storage.fromRowsOnly, true);
    assert.equal(catalogueGroupLabel(pillar, productCategoryLabel, FACTS), "เสาวางของตั้งพื้น");
    assert.notEqual(catalogueGroupLabel(pillar, productCategoryLabel, FACTS), "ทรงสูง", "the pill must stop calling a shelf a tall basin");
  });

  it("the counts stop folding the shelf sets into the tall group", () => {
        const counts = new Map(buildCatalogueChips(models, tableCategories, productCategoryLabel, FACTS).map((chip) => [chip.value, chip.count]));
    assert.equal(counts.get("counter basin"), 18);
    assert.equal(counts.get("tall vertical washbasin"), 10, "10 real tall basins, not 12 with the shelves added");
    assert.equal(counts.get("storage"), 2);
    assert.equal([...counts.values()].reduce((a, b) => a + b, 0), models.length, "each row lands in exactly one chip");
    assert.equal(catalogueGroupValue(pillar, FACTS), "storage");
    assert.equal(catalogueGroupValue(counter, FACTS), "counter basin");
  });

  it("a row the API stops labelling falls back to the data layer, never to a guess", () => {
        assert.equal(catalogueGroupLabel(counter, productCategoryLabel, FACTS), "เคาน์เตอร์");
    const noLabel = indexCatalogueRowFacts([{ sku: "KF003", category: "counter basin", categoryLabel: null }]);
    assert.equal(catalogueRowFacts("KF003", noLabel)?.categoryLabel, null, "a row that sends no wording stores none");
    assert.equal(catalogueGroupValue(counter, noLabel), "counter basin", "the machine value still arrives");
    assert.equal(catalogueGroupLabel(counter, productCategoryLabel, noLabel), productCategoryLabel(counter), "fallback is the data layer's label");
  });

  it("a failed or dirty load yields no facts, so nothing stale can stay on screen", () => {
    assert.equal(indexCatalogueRowFacts(undefined).size, 0, "a load that returns nothing indexes nothing");
    assert.equal(indexCatalogueRowFacts(null).size, 0);
    assert.equal(indexCatalogueRowFacts("[]").size, 0, "a string is not a row list");
    const dirty = indexCatalogueRowFacts([{ sku: "KF029", categoryLabel: "   " }, { categoryLabel: "x" }, null, 7, " KF030 "]);
    assert.equal(dirty.size, 0, "whitespace and non-object rows are not data");
    // the value identity changes per response, which is what makes React repaint
    assert.notEqual(indexCatalogueRowFacts(apiRows), indexCatalogueRowFacts(apiRows));
  });

  it("splits the shelf sets out of the tall chip even before the API answers", () => {
    // this is the state a crawler reads first (the prerendered HTML, built from the data layer's copy)
    const preLoad = chipsWith(EMPTY_CATALOGUE_FACTS);
    const counts = new Map(preLoad.map((chip) => [chip.value, chip.count]));
    assert.equal(counts.get("tall vertical washbasin"), 10, "10 tall basins, not 12 with the shelf sets folded in");
    assert.equal(counts.get(SHELF_SET_ROW_CATEGORY), 2);
    assert.equal([...counts.values()].reduce((a, b) => a + b, 0), models.length);
  });

  it("holds up whichever way 451-C takes the static copy", () => {
        const staticCategory = pillar.category; // "tall vertical washbasin" today, "storage" after 451-C
    assert.equal(catalogueGroupValue(pillar, FACTS), "storage", "the row wins over the built-in value");
    assert.equal(catalogueGroupLabel(pillar, productCategoryLabel, FACTS), "เสาวางของตั้งพื้น");
    assert.ok(["storage", "tall vertical washbasin"].includes(staticCategory), "test fixture sanity only");
  });
});

describe("the UI does not read the static bowl-shape table (441-B ข้อ C)", () => {
  for (const rel of ["../src/components/catalogueCategoryFacts.ts", "../src/App.tsx", "../src/components/StudioPage.tsx"]) {
    it(`${rel.replace("../", "")} has no live reference to BASIN_BOWL_SHAPES`, () => {
      const code = codeOnly(rel);
      assert.ok(code.length > 0 || !existsSync(new URL(rel, import.meta.url)));
      assert.doesNotMatch(code, /BASIN_BOWL_SHAPES/, "only the data layer (451-C) may touch that table");
    });
  }

  it("the shelf pill prints the row's wording and the cache is rebuilt on every load", () => {
    const app = codeOnly("../src/App.tsx");
    assert.match(app, /catalogueRowFacts\(sku, facts\)\?\.category === "storage"/, "storage rows count as shelf sets from the API");
    assert.match(app, /label-product-category-\$\{sku\}`\}>{catalogueGroupLabel\(product, productCategoryLabel, facts\)/, "the pill prints the row-level wording");
    assert.match(app, /indexCatalogueRowFacts\(remoteCatalog\?\.basins\)/, "facts are rebuilt from the same response as the catalogue");
    assert.doesNotMatch(app, /const factsBySku|new Map\(\)[\s\S]{0,40}factsBySku/, "no module-level cache may come back - it went stale in the browser");
    assert.match(app, /<HomePage[\s\S]{0,240}facts=\{catalogueFacts\}/, "the facts are passed in as props, so a new response repaints");
    assert.match(app, /catalogueGroupValue\(product, facts\) === category/, "chip filtering uses the row category");
    assert.match(app, /catalogueGroupValue\(product, facts\), catalogueGroupLabel\(product, productCategoryLabel, facts\)\]\.join\(" "\)/,
      "the database wording is searchable, so typing เสา finds KF029/KF030");
  });
});

describe("no raw machine id reaches the customer, in any mode (441-B v2 C2)", () => {
  const RAW_IDS = ["storage", "counter basin", "tall vertical washbasin"];
  const isRaw = (text: string) => RAW_IDS.some((id) => text.toLowerCase().includes(id));

  const worlds: Array<[string, CatalogueFacts, ReadonlyArray<string>, ReadonlyArray<BasinProduct>]> = [
    ["before the API answers", EMPTY_CATALOGUE_FACTS, [], models],
    ["offline, table known but facts missing", EMPTY_CATALOGUE_FACTS, tableCategories, models],
    ["API answered", FACTS, tableCategories, models],
    ["API answered, table lists all three ids", FACTS, [...tableCategories, "storage"], models],
    ["API answered but no product is shown", FACTS, [...tableCategories, "storage"], []],
    ["no facts and no product", EMPTY_CATALOGUE_FACTS, [...tableCategories, "storage"], []],
  ];

  for (const [name, facts, table, products] of worlds) {
    it(`chips: ${name}`, () => {
      const chips = buildCatalogueChips(products, table, productCategoryLabel, facts);
      for (const chip of chips) {
        assert.ok(chip.label.trim(), `empty label for ${chip.value}`);
        assert.ok(!isRaw(chip.label), `raw id printed on a chip: "${chip.label}" (${chip.value})`);
      }
    });
  }

  it("an empty group is shown in Thai, not by its id", () => {
    const labels = new Map(buildCatalogueChips([], ["counter basin", "tall vertical washbasin", "storage"], productCategoryLabel, EMPTY_CATALOGUE_FACTS).map((chip) => [chip.value, chip.label]));
    assert.equal(labels.get("counter basin"), "เคาน์เตอร์");
    assert.equal(labels.get("tall vertical washbasin"), "ทรงสูง");
    assert.equal(labels.get("storage"), "เสาวางของตั้งพื้น");
  });

  it("an English-only name nobody translated gets no chip; a Thai name keeps its own", () => {
    const chips = buildCatalogueChips([], ["wall basin", "อ่างติดผนัง", "Storage"], productCategoryLabel, EMPTY_CATALOGUE_FACTS);
    assert.deepEqual(chips.map((chip) => chip.value), ["อ่างติดผนัง", "Storage"], "wall basin is hidden; Storage maps to its Thai wording");
    assert.equal(chips[0].label, "อ่างติดผนัง");
    assert.equal(chips[1].label, "เสาวางของตั้งพื้น");
  });

  it("a row whose label is the raw id is not trusted as wording", () => {
    const dirty = indexCatalogueRowFacts([{ sku: "KF029", category: "storage", categoryLabel: "storage" }]);
    const label = catalogueGroupLabel(pillar, productCategoryLabel, dirty);
    assert.ok(!isRaw(label), `got "${label}"`);
    assert.equal(label, "เสาวางของตั้งพื้น");
    const rawCounter = indexCatalogueRowFacts([{ sku: "KF003", category: "counter basin", categoryLabel: "Counter Basin" }]);
    assert.equal(catalogueGroupLabel(counter, productCategoryLabel, rawCounter), "เคาน์เตอร์");
  });

  it("every card pill that shows wording is Thai (all 30 live rows, both worlds)", () => {
    for (const facts of [EMPTY_CATALOGUE_FACTS, FACTS]) {
      for (const model of models) {
        const text = catalogueGroupLabel(model, productCategoryLabel, facts);
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
