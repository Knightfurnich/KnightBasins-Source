import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addBasinToQuote,
  basinProductFromCatalog,
  isFreestandingPillarProduct,
  PILLAR_PRODUCT_LABEL,
  PILLAR_PRODUCT_PURCHASE_NOTE,
  productCategoryLabel,
  productQuoteDescription,
  productSpecLabel,
  PRODUCTS,
  studioCutoutBasinProducts,
} from "../src/data/catalog.ts";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const studioSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
const pillarSkus = ["KF029", "KF030"];

test("the catalog keeps both ready-made pillar sets at 16,000 THB and labels them accurately", () => {
  for (const sku of pillarSkus) {
    const product = PRODUCTS.find((candidate) => candidate.sku === sku);
    assert.ok(product, `${sku} remains in the main catalog`);
    assert.equal(product.priceTHB, 16000);
    // job 441-B: the database files both sets under category "storage" and sends the wording itself
    assert.equal(product.category, "storage");
    assert.equal(product.categoryLabel, undefined, "the built-in rows carry the machine category only - no wording invented in code");
    assert.equal(isFreestandingPillarProduct(product), true);
    // no wording from the API yet => the copy this repo has carried since job-279
    assert.equal(productCategoryLabel(product), PILLAR_PRODUCT_LABEL);
    // once the API answers, its text wins verbatim (job 440-C sends categoryLabel per row)
    const apiRow = basinProductFromCatalog({ ...product, category: "storage", categoryLabel: "เสาวางของตั้งพื้น" } as never);
    assert.equal(productCategoryLabel(apiRow), "เสาวางของตั้งพื้น", "the card prints what the database says");
    assert.equal(productSpecLabel(product), PILLAR_PRODUCT_PURCHASE_NOTE);
    assert.match(productQuoteDescription(product), /เสาวางของตั้งพื้น \(ชุดสำเร็จรูป\).*ชุดสำเร็จรูป ไม่ต้องเจาะเคาน์เตอร์/);
    assert.doesNotMatch(productCategoryLabel(product), /ทรงสูง/, "a pillar set is never sold as a tall basin");
  }
});

test("2D Studio excludes the freestanding pillar sets and dimensionless tall products", () => {
  const options = studioCutoutBasinProducts(PRODUCTS);
  assert.equal(options.some((product) => pillarSkus.includes(product.sku)), false);
  assert.ok(options.some((product) => product.sku === "KF028"), "dimensioned tall basins remain available");

  const dimensionlessFreestandingBasin = {
    ...PRODUCTS.find((product) => product.sku === "KF028")!,
    sku: "KF099",
    basinDimensions: undefined,
  };
  assert.equal(isFreestandingPillarProduct(dimensionlessFreestandingBasin), true);
  assert.equal(studioCutoutBasinProducts([...PRODUCTS, dimensionlessFreestandingBasin]).some((product) => product.sku === "KF099"), false);

  const dimensionedBasin = PRODUCTS.find((product) => product.sku === "KF028")!;
  assert.equal(isFreestandingPillarProduct(dimensionedBasin), false);

  const dimensionlessCounterBasin = {
    ...dimensionlessFreestandingBasin,
    sku: "KF098",
    category: "counter basin",
  };
  assert.equal(isFreestandingPillarProduct(dimensionlessCounterBasin), false);

  // job 441-B: a pillar row the built-in list has never heard of is still detected from the database category
  const unknownStorageRow = { sku: "KF031", colorCode: "ZZ001", colorName: "New Pillar", priceTHB: 16000, category: "storage", dimensions: "400 × 400 × 1000 mm", basinDimensions: undefined, imageTone: "#717779" };
  assert.equal(isFreestandingPillarProduct(unknownStorageRow), true);
  assert.equal(studioCutoutBasinProducts([...PRODUCTS, unknownStorageRow]).some((p) => p.sku === "KF031"), false);
});

test("the catalogue index gives every row its own chip instead of folding pillars into \"ทรงสูง\" (441-B)", () => {
  assert.match(appSource, /const categoryWordings = useMemo/);
  assert.match(appSource, /categoryLabel\(item\.name, categoryWordings\)/, "chip text follows the API wording");
  assert.match(appSource, /const uncovered = \[\.\.\.new Set\(products\.map\(\(product\) => product\.category\)\)\]/, "a category the list omits still gets a chip");
  assert.match(appSource, /\]?\s*\[\.\.\.persistedCategories, \.\.\.uncovered\]/);
  assert.doesNotMatch(appSource, /persistedCategories\.length\) return persistedCategories;\n    return/, "no silent drop of uncovered rows");
});

test("Studio uses the filtered catalog, blocks pillar placements, and explains direct pillar links", () => {
  assert.match(studioSource, /studioCutoutBasinProducts\(basinProducts\)/);
  assert.match(studioSource, /basinProducts: studioBasinProducts/);
  assert.match(studioSource, /if \(isFreestandingPillarProduct\(product\)\) return state;/);
  assert.match(studioSource, /isFreestandingPillarProduct\(product\) \|\| !state\.basinSkus\.includes\(sku\)/);
  assert.match(studioSource, /if \(!canvas \|\| !piece \|\| !product \|\| isFreestandingPillarProduct\(product\)\) return false;/);
  assert.match(studioSource, /สินค้านี้เป็นชุดเสาสำเร็จรูปตั้งพื้น ไม่ต้องเจาะเคาน์เตอร์ สามารถสั่งซื้อเป็นชุดสำเร็จรูปได้ทันที/);
  assert.match(studioSource, /data-testid="button-request-pillar-quote"/);
  assert.match(studioSource, /onRequestPillarQuote\(requestedPillarProduct\.sku\)/);
});

test("storefront and quote UI render pillar-specific product labels and descriptions", () => {
  assert.match(appSource, /productCategoryLabel\(product\)/);
  assert.match(appSource, /productSpecLabel\(product\)/);
  assert.match(appSource, /productQuoteDescription\(product\)/);
  assert.match(appSource, /label-product-category-\$\{sku\}/);
  assert.match(appSource, /productCategoryLabel\(product\)\} · \$\{productSpecLabel\(product\)\}/);
});

test("ready-made sets can be added from the storefront and remain ordered on the quote page", () => {
  const emptyCart = addBasinToQuote([], "KF029");
  assert.deepEqual(emptyCart, [{ sku: "KF029", quantity: 1, installationSelected: false }]);
  assert.deepEqual(addBasinToQuote(emptyCart, "KF030"), [
    { sku: "KF029", quantity: 1, installationSelected: false },
    { sku: "KF030", quantity: 1, installationSelected: false },
  ]);
  assert.deepEqual(addBasinToQuote(emptyCart, "KF029"), [
    { sku: "KF029", quantity: 2, installationSelected: false },
  ]);

  assert.match(appSource, /onRequestQuote\(\[sku\]\)/);
  assert.match(appSource, /onRequestQuote=\{requestQuote\}/);
  assert.match(appSource, /skus\.forEach\(addToQuote\);[\s\S]*?setLocation\("\/quote"\);/);
  assert.match(appSource, /formatTHB\(product\.priceTHB \* line\.quantity\)/);
});