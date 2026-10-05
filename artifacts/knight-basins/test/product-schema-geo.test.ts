/**
 * Job 169 (GEO Product Schema & Clean Specs):
 * - buildBasinProductsJsonLd() must emit a Product+Offer node for every SKU
 *   in the catalog passed to it, sourcing name/sku/price from that catalog
 *   data (never hardcoded) and never fabricating an `image` URL.
 * - ProductCard must expose a per-SKU "copy spec" button that writes to the
 *   clipboard and shows a "copied" confirmation. App.tsx is far too large to
 *   render in this test runner, so this part is asserted via static source
 *   inspection (readFileSync), matching the job's FORBIDDEN clause.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildBasinProductsJsonLd } from "../src/data/structured-data.ts";
import { PRODUCTS, type BasinProduct } from "../src/data/catalog.ts";

type JsonLdProductNode = {
  "@type": string;
  "@id": string;
  name: string;
  sku: string;
  description: string;
  image?: string;
  offers: { "@type": string; price: number; priceCurrency: string; availability: string };
};

describe("buildBasinProductsJsonLd", () => {
  it("emits exactly one Product node per catalog entry (all 30 SKUs)", () => {
    const data = buildBasinProductsJsonLd(PRODUCTS);
    assert.equal(data["@context"], "https://schema.org");
    const graph = data["@graph"] as JsonLdProductNode[];
    assert.equal(PRODUCTS.length, 30, "sanity check: the catalog itself is expected to carry 30 SKUs");
    assert.equal(graph.length, 30);
  });

  it("sources name/sku/price from the catalog data passed in, not a hardcoded value", () => {
    const graph = buildBasinProductsJsonLd(PRODUCTS)["@graph"] as JsonLdProductNode[];
    const kf001Source = PRODUCTS.find((product) => product.sku === "KF001");
    const kf001Node = graph.find((node) => node.sku === "KF001");
    assert.ok(kf001Source && kf001Node);
    assert.equal(kf001Node?.name, `Knight Basins ${kf001Source?.sku}`);
    assert.equal(kf001Node?.offers.price, kf001Source?.priceTHB);

    // Prices differ across the catalog -- confirms we're reading per-product
    // priceTHB rather than emitting one hardcoded number for every SKU.
    const distinctPrices = new Set(graph.map((node) => node.offers.price));
    assert.ok(distinctPrices.size > 1, "expected more than one distinct price across the catalog");
  });

  it("gives every node a complete Product + Offer structure", () => {
    const graph = buildBasinProductsJsonLd(PRODUCTS)["@graph"] as JsonLdProductNode[];
    for (const node of graph) {
      assert.equal(node["@type"], "Product");
      assert.ok(node.sku, "missing sku");
      assert.ok(node.name.includes(node.sku), "name should reference the sku");
      assert.ok(node.description.length > 0, "missing description");
      assert.equal(node.offers["@type"], "Offer");
      assert.equal(typeof node.offers.price, "number");
      assert.equal(node.offers.priceCurrency, "THB");
      assert.equal(node.offers.availability, "https://schema.org/InStock");
    }
  });

  it("never fabricates an image URL for a product that has none", () => {
    const graph = buildBasinProductsJsonLd(PRODUCTS)["@graph"] as JsonLdProductNode[];
    // The static catalog entries carry no imageUrl (it's merged in at runtime
    // from the admin-managed remote catalog) -- the schema must reflect that
    // honestly rather than inventing a placeholder.
    assert.ok(PRODUCTS.every((product) => !product.imageUrl), "test assumption: static PRODUCTS has no imageUrl");
    assert.ok(graph.every((node) => node.image === undefined));
  });

  it("includes an absolute image URL when the product actually has one", () => {
    const withImage: BasinProduct = { ...PRODUCTS[0]!, imageUrl: "/uploads/basins/kf001.webp" };
    const withAbsoluteImage: BasinProduct = { ...PRODUCTS[1]!, imageUrl: "https://cdn.example.com/kf002.webp" };
    const graph = buildBasinProductsJsonLd([withImage, withAbsoluteImage])["@graph"] as JsonLdProductNode[];
    assert.equal(graph[0]?.image, "https://knightbasins.com/uploads/basins/kf001.webp");
    assert.equal(graph[1]?.image, "https://cdn.example.com/kf002.webp");
  });

  it("returns an empty graph for an empty catalog rather than throwing", () => {
    const data = buildBasinProductsJsonLd([]);
    assert.deepEqual(data["@graph"], []);
  });
});

describe("ProductCard copy-spec button (static source inspection)", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  it("renders a per-SKU copy-spec button with the required test id", () => {
    assert.match(appSource, /data-testid=\{`button-copy-spec-\$\{sku\}`\}/);
  });

  it("writes the spec text to the clipboard when clicked", () => {
    assert.match(appSource, /navigator\.clipboard\.writeText\(specText\)/);
    // Built from real catalog fields, not a hardcoded string literal.
    assert.match(appSource, /specText = `\$\{product\.sku\}.*\$\{product\.priceTHB\}|specText = `\$\{product\.sku\}[\s\S]*?formatTHB\(product\.priceTHB\)/);
  });

  it("shows a temporary 'copied' confirmation after the click", () => {
    assert.match(appSource, /setSpecCopied\(true\)/);
    assert.match(appSource, /คัดลอกแล้ว/);
  });

  it("wires the basin product schema into the home route", () => {
    assert.match(appSource, /buildBasinProductsJsonLd\(products\)/);
    assert.match(appSource, /<RouteStructuredData id="basin-products"/);
  });
});
