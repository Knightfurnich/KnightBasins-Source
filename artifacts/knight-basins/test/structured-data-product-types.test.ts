import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PRODUCTS, basinProductFromCatalog, isFreestandingPillarProduct } from "../src/data/catalog.ts";
import { buildBasinProductsJsonLd } from "../src/data/structured-data.ts";

/**
 * job 441-B ข้อ C — the structured data must stop announcing the two freestanding shelf sets
 * (KF029 / KF030) as wash basins. Google and every AI crawler read this blob; the sentence used to
 * start with "อ่างล้างหน้าหินสังเคราะห์" for all 30 rows, whatever the category said.
 * The kind is now `productCategoryLabel`, i.e. the API's `categoryLabel` when the catalogue sends one.
 */

const graph = (products: never[]) => (buildBasinProductsJsonLd(products) as { "@graph": Array<Record<string, string>> })["@graph"];
const apiRow = (over: Record<string, unknown>) =>
  basinProductFromCatalog({
    sku: "KF029", colorCode: "EG595", colorName: "Metallic Galaxy", priceTHB: 16000,
    category: "storage", dimensions: "400 × 400 × 1000 mm", basinDimensions: null, imageTone: "#717779",
    categoryLabel: "เสาวางของตั้งพื้น", ...over,
  } as never);

describe("JSON-LD publishes the catalogue's own category (441-B C)", () => {
  it("never calls a shelf set a wash basin, for the built-in rows and the API rows alike", () => {
    const pillars = PRODUCTS.filter((product) => isFreestandingPillarProduct(product));
    assert.ok(pillars.length >= 2, "KF029 and KF030 must still be in the catalogue");
    for (const node of graph(pillars)) {
      assert.doesNotMatch(node.description, /อ่างล้างหน้า/, `${node.sku} is published as a basin`);
      assert.doesNotMatch(node.description, /ขนาดเคาน์เตอร์/, `${node.sku} is not measured as a counter`);
      assert.match(node.description, /เสาวางของตั้งพื้น/);
      assert.equal(node.category, "เสาวางของตั้งพื้น (ชุดสำเร็จรูป)");
    }
    const fromApi = graph([apiRow({}) as never]);
    assert.equal(fromApi[0].category, "เสาวางของตั้งพื้น", "the API wording is printed verbatim");
    assert.doesNotMatch(fromApi[0].description, /อ่างล้างหน้า/);
  });

  it("keeps a real counter basin described as one, size and hole included", () => {
    const [node] = graph([PRODUCTS.find((product) => product.sku === "KF003")!] as never);
    assert.match(node.description, /เคาน์เตอร์/);
    assert.match(node.description, /ขนาดรวม 600 × 800 × 200 mm/);
    assert.match(node.description, /หลุมอ่าง 350 × 500 × 130 mm/);
    assert.equal(node.offers !== undefined, true, "price still ships (this job must not touch money)");
  });

  it("the category word is never invented in our own source", () => {
    for (const file of ["src/data/catalog.ts", "src/data/structured-data.ts", "src/App.tsx"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /ที่วางของ/, `${file} hard-codes a category wording`);
    }
    const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    assert.match(appSource, /wording\.set\(product\.category, productCategoryLabel\(product\)\)/,
      "chip and card resolve the wording through the same helper");
  });
});
