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

describe("withBasinMedia main photo of KF003 (job 437-C)", () => {
  const kitchen = "https://knightbasins.com/api/uploads/catalog-mua05rff-0a5b2aa03a5e73f7.jpg?v=mua05rff";
  const hd = "https://knightbasins.com/kb/images/basin-hd/KF003.jpg";

  it("serves the basin's own picture instead of the kitchen photo the row still holds", () => {
    assert.equal(withBasinMedia({ sku: "KF003", imageUrl: kitchen }).imageUrl, hd);
  });

  it("also does it for the legacy host spelling of the same upload", () => {
    assert.equal(withBasinMedia({ sku: "KF003", imageUrl: kitchen.replace("knightbasins.com", "knightbasins.srv1964473.hstgr.cloud") }).imageUrl, hd);
  });

  it("an upload the admin saves later wins, and other models keep their own photo, even the same file on another model", () => {
    const fresh = "https://knightbasins.com/api/uploads/catalog-zzzzzzzz-0123456789abcdef.jpg?v=zzzzzzzz";
    assert.equal(withBasinMedia({ sku: "KF003", imageUrl: fresh }).imageUrl, fresh);
    assert.equal(withBasinMedia({ sku: "KF006", imageUrl: kitchen }).imageUrl, kitchen);
    assert.equal(withBasinMedia({ sku: "KF025", imageUrl: "https://knightbasins.com/api/uploads/catalog-mua0tb10-a06f476e710be0cc.jpg?v=mua0tb10" }).imageUrl, "https://knightbasins.com/api/uploads/catalog-mua0tb10-a06f476e710be0cc.jpg?v=mua0tb10");
  });

  it("leaves price, size, name, code, gallery, quote photo and video of KF003 as they were", () => {
    const row = {
      sku: "KF003", colorCode: "RW316", colorName: "River White", priceTHB: 19000, dimensions: "600 × 800 × 200 mm",
      imageUrl: kitchen, galleryImageUrls: [hd], quoteImageUrl: hd, videoUrl: "https://knightbasins.com/api/uploads/catalog-muh6ly7h-85010e44762048c6.mp4?v=muh6ly7h",
    };
    const out = withBasinMedia(row);
    assert.deepEqual({ ...out, imageUrl: row.imageUrl }, { ...row, uploadedVideoUrl: row.videoUrl });
  });
});
