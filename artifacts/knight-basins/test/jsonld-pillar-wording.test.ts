/**
 * Job 457-C (last finding of the independent audit 451-R):
 *
 * The Product JSON-LD on the home page used to describe every row as
 * "อ่างล้างหน้าหินสังเคราะห์ … ขนาดเคาน์เตอร์ …", so the two floor-standing storage pillars
 * (KF029 / KF030) were advertised to search engines and AI assistants as wash basins even
 * after `GET /api/catalog` had started sending `category: "storage"` + a Thai `categoryLabel`.
 *
 * The wording is now read from the row itself, so a storage row can never be called a wash
 * basin again. Wash basins must keep exactly the wording they had before.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBasinProductsJsonLd } from "../src/data/structured-data.ts";
import { PRODUCTS, STORAGE_CATEGORY, type BasinProduct } from "../src/data/catalog.ts";

type JsonLdProductNode = {
  "@type": string;
  sku: string;
  description: string;
};

function nodes(products: ReadonlyArray<BasinProduct>): JsonLdProductNode[] {
  return buildBasinProductsJsonLd(products)["@graph"] as JsonLdProductNode[];
}

function descriptionOf(sku: string, products: ReadonlyArray<BasinProduct> = PRODUCTS): string {
  const node = nodes(products).find((entry) => entry.sku === sku);
  assert.ok(node, `expected a Product node for ${sku}`);
  return node.description;
}

describe("job 457-C · Product JSON-LD wording follows the row type", () => {
  it("never calls the storage pillars a wash basin, in the catalogue as shipped", () => {
    for (const sku of ["KF029", "KF030"]) {
      const text = descriptionOf(sku);
      assert.ok(!text.includes("อ่างล้างหน้า"), `${sku} must not be called a wash basin: ${text}`);
      assert.ok(!text.includes("อ่างล้างมือ"), `${sku} must not be called a wash-hand basin: ${text}`);
      assert.ok(text.includes("เสาวางของตั้งพื้น"), `${sku} must carry the Thai storage wording: ${text}`);
      assert.ok(!text.includes("ขนาดเคาน์เตอร์"), `${sku} is not a counter basin: ${text}`);
    }
  });

  it("keeps the row's own categoryLabel from the API when it is present", () => {
    const row: BasinProduct = {
      ...(PRODUCTS.find((p) => p.sku === "KF029") as BasinProduct),
      category: STORAGE_CATEGORY,
      categoryLabel: "ที่วางของ (ทดสอบ)",
    };
    const text = nodes([row])[0].description;
    assert.ok(text.includes("ที่วางของ (ทดสอบ)"), text);
    assert.ok(!text.includes("อ่างล้างหน้า"), text);
  });

  it("falls back to the same Thai label the API sends, and invents nothing", () => {
    const row: BasinProduct = {
      ...(PRODUCTS.find((p) => p.sku === "KF030") as BasinProduct),
      category: STORAGE_CATEGORY,
      categoryLabel: undefined,
    };
    const text = nodes([row])[0].description;
    assert.ok(text.includes("เสาวางของตั้งพื้น"), text);
    assert.ok(!text.includes("อ่างล้างหน้า"), text);
  });

  it("leaves a real wash basin exactly as it was", () => {
    // job 459-C: the counter wording stays for the counter basins (KF003 / KF006); a tall basin (KF025) is still a
    // wash basin but no longer "ขนาดเคาน์เตอร์" - see jsonld-guard-459c.test.ts.
    for (const sku of ["KF003", "KF006"]) {
      const text = descriptionOf(sku);
      assert.ok(text.includes("อ่างล้างหน้าหินสังเคราะห์"), `${sku} must stay a wash basin: ${text}`);
      assert.ok(text.includes("ขนาดเคาน์เตอร์"), `${sku} keeps the counter wording: ${text}`);
      assert.ok(text.includes("Knight Basins"), text);
    }
    const tall = descriptionOf("KF025");
    assert.ok(tall.includes("อ่างล้างหน้าหินสังเคราะห์"), `KF025 must stay a wash basin: ${tall}`);
    // A basin with a bowl size still prints it; the pillars (no bowl) never do.
    assert.ok(descriptionOf("KF003").includes("หลุมอ่าง"), descriptionOf("KF003"));
    assert.ok(!descriptionOf("KF029").includes("หลุมอ่าง"), descriptionOf("KF029"));
  });

  it("still emits one Product+Offer node per row with price and THB", () => {
    const graph = nodes(PRODUCTS);
    assert.equal(graph.length, PRODUCTS.length);
    const offers = buildBasinProductsJsonLd(PRODUCTS)["@graph"] as Array<{ offers: { priceCurrency: string } }>;
    assert.ok(offers.every((node) => node.offers.priceCurrency === "THB"));
  });
});
