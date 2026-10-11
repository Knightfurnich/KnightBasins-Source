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

describe("withBasinMedia main photos of KF029 and KF030 (job 444-C)", () => {
  const rooms: Array<[string, string]> = [
    ["KF029", "https://knightbasins.com/api/uploads/catalog-mua0uv6t-6faac953cb2afa8f.jpg?v=mua0uv6t"],
    ["KF030", "https://knightbasins.com/api/uploads/catalog-mua0v6co-ad9c127a613b9d23.jpg?v=mua0v6co"],
  ];

  it("each serves its own HD picture, untouched (no crop, no resize parameter) instead of the staged room", () => {
    for (const [sku, room] of rooms) {
      const out = withBasinMedia({ sku, imageUrl: room }).imageUrl;
      assert.equal(out, `https://knightbasins.com/kb/images/basin-hd/${sku}.jpg`);
      assert.ok(!/[?&#]/.test(out), `${sku}: the URL carries no crop/resize parameter`);
    }
  });

  it("the two rooms are not swapped across models, and a newer upload wins", () => {
    assert.equal(withBasinMedia({ sku: "KF029", imageUrl: rooms[1][1] }).imageUrl, rooms[1][1]);
    assert.equal(withBasinMedia({ sku: "KF030", imageUrl: rooms[0][1] }).imageUrl, rooms[0][1]);
    const fresh = "https://knightbasins.com/api/uploads/catalog-zzzzzzzz-0123456789abcdef.jpg?v=zzzzzzzz";
    for (const [sku] of rooms) assert.equal(withBasinMedia({ sku, imageUrl: fresh }).imageUrl, fresh);
  });

  it("leaves price, size, name, code, gallery, quote photo and video as they were, and the models still in the list (no hiding)", () => {
    for (const [sku, room] of rooms) {
      const row = {
        sku, colorCode: "X", colorName: "Y", priceTHB: 16000, dimensions: "400 × 400 × 1000 mm", active: true, sortOrder: 28,
        imageUrl: room, galleryImageUrls: ["g1", "g2"], quoteImageUrl: "q", videoUrl: "https://knightbasins.com/v.mp4",
      };
      const out = withBasinMedia(row);
      assert.deepEqual({ ...out, imageUrl: room }, { ...row, uploadedVideoUrl: row.videoUrl });
    }
  });

  it("the other models keep the photo they have (KF025 / KF028 stay for the owner to confirm)", () => {
    const kf025 = "https://knightbasins.com/api/uploads/catalog-mua0tb10-a06f476e710be0cc.jpg?v=mua0tb10";
    const kf028 = "https://knightbasins.com/api/uploads/catalog-mua0uhjm-25c5ca095e67a8cf.jpg?v=mua0uhjm";
    assert.equal(withBasinMedia({ sku: "KF025", imageUrl: kf025 }).imageUrl, kf025);
    assert.equal(withBasinMedia({ sku: "KF028", imageUrl: kf028 }).imageUrl, kf028);
  });
});
