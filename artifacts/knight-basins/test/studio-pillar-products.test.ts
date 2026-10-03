import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addBasinToQuote,
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
    assert.equal(product.category, "tall vertical washbasin");
    assert.equal(isFreestandingPillarProduct(product), true);
    assert.equal(productCategoryLabel(product), PILLAR_PRODUCT_LABEL);
    assert.equal(productSpecLabel(product), PILLAR_PRODUCT_PURCHASE_NOTE);
    assert.match(productQuoteDescription(product), /เสาวางของตั้งพื้น \(ชุดสำเร็จรูป\).*ชุดสำเร็จรูป ไม่ต้องเจาะเคาน์เตอร์/);
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