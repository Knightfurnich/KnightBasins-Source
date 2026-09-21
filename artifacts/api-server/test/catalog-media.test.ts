import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withBasinMedia } from "../src/lib/catalog-media.ts";

describe("withBasinMedia gallery normalization", () => {
  it("trims and drops blank gallery entries", () => {
    const basin = withBasinMedia({
      sku: "KF001",
      imageUrl: "https://uploads.example.test/catalog/catalog-main.png",
      galleryImageUrls: [" https://uploads.example.test/catalog/install-1.png ", "", "  ", "https://uploads.example.test/catalog/install-2.png"],
    });

    assert.deepEqual(basin.galleryImageUrls, [
      "https://uploads.example.test/catalog/install-1.png",
      "https://uploads.example.test/catalog/install-2.png",
    ]);
  });

  it("defaults to an empty gallery when the column is missing or not an array", () => {
    assert.deepEqual(withBasinMedia({ sku: "KF001" }).galleryImageUrls, []);
    assert.deepEqual(
      withBasinMedia({ sku: "KF001", galleryImageUrls: null } as { sku: string; galleryImageUrls: null }).galleryImageUrls,
      [],
    );
  });
});

describe("withBasinMedia quote image normalization", () => {
  it("trims a saved quote image URL", () => {
    const basin = withBasinMedia({
      sku: "KF001",
      imageUrl: "https://uploads.example.test/catalog/catalog-main.png",
      quoteImageUrl: " https://uploads.example.test/catalog/install-2.png ",
    });

    assert.equal(basin.quoteImageUrl, "https://uploads.example.test/catalog/install-2.png");
  });

  it("keeps the quote image null (no pin) rather than resolving a fallback", () => {
    assert.equal(withBasinMedia({ sku: "KF001" }).quoteImageUrl, null);
    assert.equal(
      withBasinMedia({ sku: "KF001", quoteImageUrl: null } as { sku: string; quoteImageUrl: null }).quoteImageUrl,
      null,
    );
    assert.equal(withBasinMedia({ sku: "KF001", quoteImageUrl: "   " }).quoteImageUrl, null);
  });
});
