/**
 * Job 459-C (notes of the independent check 457-C, PR #567):
 *
 *  A  a row's `categoryLabel` that is a raw machine id ("storage") must never reach the JSON-LD; the guard is the
 *     ONE shared helper of the data layer (the catalogue chips use the same table), not a third copy.
 *  B  only a counter basin is described as "ขนาดเคาน์เตอร์ ..."; a tall basin or a storage pillar says "ขนาด ...".
 *
 * Nothing that was right may move: KF029/KF030 stay "เสาวางของตั้งพื้น ...", KF003/KF006 keep their exact text, the
 * node count and THB stay.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildBasinProductsJsonLd } from "../src/data/structured-data.ts";
import {
  basinProductFromCatalog,
  COUNTER_CATEGORY,
  customerCategoryLabel,
  isMachineCategoryId,
  PRODUCTS,
  STORAGE_CATEGORY,
  STORAGE_CATEGORY_LABEL,
  type BasinProduct,
} from "../src/data/catalog.ts";
import * as uiFacts from "../src/components/catalogueCategoryFacts.ts";

type Node = { sku: string; description: string; offers: { priceCurrency: string; price: number | string } };
const nodes = (products: ReadonlyArray<BasinProduct>) => buildBasinProductsJsonLd(products)["@graph"] as Node[];
const text = (sku: string, products: ReadonlyArray<BasinProduct> = PRODUCTS) => {
  const node = nodes(products).find((n) => n.sku === sku);
  assert.ok(node, `no node for ${sku}`);
  return node.description;
};
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// the live response captured 11 ต.ค. 69 (30 rows) run through the real mapper, as the page does after the API answers
const snapshot = JSON.parse(read("./fixtures/catalog-basin-rows-441.json")) as { basins: Array<Record<string, unknown>> };
const live = snapshot.basins.map((row) => basinProductFromCatalog(row as never)) as BasinProduct[];

const pillar = PRODUCTS.find((p) => p.sku === "KF029") as BasinProduct;
const RAW_IDS = ["storage", "Storage", "STORAGE ", " counter basin", "Counter Basin", "tall vertical washbasin", "Tall Vertical Washbasin"];

describe("459-C · A · a raw machine id never reaches the JSON-LD", () => {
  for (const raw of RAW_IDS) {
    it(`storage row with categoryLabel ${JSON.stringify(raw)} falls back to the Thai label`, () => {
      const row: BasinProduct = { ...pillar, category: STORAGE_CATEGORY, categoryLabel: raw };
      const description = nodes([row])[0].description;
      assert.ok(description.startsWith(`${STORAGE_CATEGORY_LABEL} Knight Basins รุ่น KF029`), description);
      assert.doesNotMatch(description, /storage|counter basin|tall vertical/i);
      assert.ok(!description.includes("อ่างล้างหน้า"), description);
    });
  }

  it("a real Thai label from the API is still used as sent (trimmed)", () => {
    const row: BasinProduct = { ...pillar, category: STORAGE_CATEGORY, categoryLabel: "  เสาเก็บของ  " };
    assert.ok(nodes([row])[0].description.startsWith("เสาเก็บของ Knight Basins รุ่น KF029"));
  });

  it("empty / blank / missing labels still fall back to the Thai label", () => {
    for (const categoryLabel of [undefined, "", "   "]) {
      const row: BasinProduct = { ...pillar, category: STORAGE_CATEGORY, categoryLabel };
      assert.ok(nodes([row])[0].description.startsWith(`${STORAGE_CATEGORY_LABEL} Knight Basins`));
    }
  });

  it("no description anywhere carries a raw id, even if every row's label is a raw id", () => {
    const dirty = live.map((p) => ({ ...p, categoryLabel: p.category }));
    for (const node of nodes(dirty)) assert.doesNotMatch(node.description, /storage|counter basin|tall vertical/i, node.description);
  });

  it("the guard is the shared data-layer helper, not a copy", () => {
    assert.equal(customerCategoryLabel("storage", "x"), "x");
    assert.equal(customerCategoryLabel(" ใช้ได้ ", "x"), "ใช้ได้");
    assert.equal(customerCategoryLabel(undefined, "x"), "x");
    // the UI module re-exports the very same functions (one table, one rule)
    assert.equal(uiFacts.isMachineCategoryId, isMachineCategoryId);
    assert.ok(isMachineCategoryId("Tall Vertical Washbasin") && !isMachineCategoryId("เสาวางของตั้งพื้น"));
  });

  it("no module keeps its own copy of the machine-id table", () => {
    const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const file of ["../src/components/catalogueCategoryFacts.ts", "../src/data/structured-data.ts", "../src/App.tsx"]) {
      assert.doesNotMatch(code(file), /MACHINE_CATEGORY_WORDING|"tall vertical washbasin":/, `${file} must not own a table`);
    }
    assert.match(code("../src/data/structured-data.ts"), /customerCategoryLabel\(/, "the JSON-LD must call the shared helper");
    assert.match(code("../src/data/catalog.ts"), /MACHINE_CATEGORY_WORDING/, "the table lives in the data layer");
  });
});

describe("459-C · B · only a counter basin says \"ขนาดเคาน์เตอร์\"", () => {
  it("every counter row says it, every other row does not (live rows through the mapper)", () => {
    let counter = 0;
    let other = 0;
    for (const product of live) {
      const description = text(product.sku, live);
      if (product.category === COUNTER_CATEGORY) {
        counter += 1;
        assert.ok(description.includes(`ขนาดเคาน์เตอร์ ${product.dimensions}`), description);
      } else {
        other += 1;
        assert.ok(!description.includes("ขนาดเคาน์เตอร์"), description);
        assert.ok(description.includes(`ขนาด ${product.dimensions}`), description);
      }
    }
    assert.equal(counter, 18);
    assert.equal(other, 12); // 10 tall + 2 storage
  });

  it("the built-in catalogue behaves the same (offline copy)", () => {
    for (const product of PRODUCTS) {
      const hasCounterWord = text(product.sku).includes("ขนาดเคาน์เตอร์");
      assert.equal(hasCounterWord, product.category === COUNTER_CATEGORY && !isPillarLike(product), product.sku);
    }
  });

  it("a tall basin (KF025) is still a wash basin with its bowl, just not 'counter' sized", () => {
    assert.equal(
      text("KF025"),
      "อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น KF025 สี Neo Black (NB091) ขนาด 400 × 400 × 850 mm หลุมอ่าง Ø350 × 150 mm",
    );
  });

  it("a category nobody knows is not described as a counter either", () => {
    const row: BasinProduct = { ...(PRODUCTS.find((p) => p.sku === "KF003") as BasinProduct), category: "wall basin", categoryLabel: undefined };
    assert.ok(!nodes([row])[0].description.includes("ขนาดเคาน์เตอร์"));
    assert.ok(nodes([row])[0].description.includes(`ขนาด ${row.dimensions}`));
  });
});

function isPillarLike(product: BasinProduct): boolean {
  return product.category === STORAGE_CATEGORY;
}

describe("459-C · C · what was right does not move", () => {
  it("KF029 / KF030 keep their exact text", () => {
    assert.equal(text("KF029"), "เสาวางของตั้งพื้น Knight Basins รุ่น KF029 สี Metallic Galaxy (EG595) ขนาด 400 × 400 × 1000 mm");
    assert.equal(text("KF030"), "เสาวางของตั้งพื้น Knight Basins รุ่น KF030 สี Grigio Terrazzo (GT010) ขนาด 400 × 400 × 1000 mm");
  });

  it("KF003 / KF006 keep their exact text", () => {
    assert.equal(
      text("KF003"),
      "อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น KF003 สี River White (RW316) ขนาดเคาน์เตอร์ 600 × 800 × 200 mm หลุมอ่าง 350 × 500 × 130 mm",
    );
    assert.equal(
      text("KF006"),
      "อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น KF006 สี River White (RW316) ขนาดเคาน์เตอร์ 600 × 800 × 200 mm หลุมอ่าง 350 × 500 × 130 mm",
    );
  });

  it("one Product+Offer node per row, THB, price untouched", () => {
    for (const set of [PRODUCTS, live]) {
      const graph = nodes(set);
      assert.equal(graph.length, set.length);
      graph.forEach((node, i) => {
        assert.equal(node.offers.priceCurrency, "THB");
        assert.equal(Number(node.offers.price), set[i].priceTHB);
      });
    }
  });
});
