import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basinProductFromCatalog, filterBasinProducts, PRODUCTS, removeStoneSelection, toggleBasinSelection, upsertStoneSelection, type StoneConfig } from "../src/data/catalog.ts";

describe("storefront basin image mapping", () => {
  it("preserves a saved imageUrl from the active catalog response", () => {
    const product = basinProductFromCatalog({
      sku: "KF001",
      colorCode: "VS311",
      colorName: "Shine",
      priceTHB: 19000,
      category: "counter basin",
      dimensions: "600 × 800 × 200 mm",
      basinDimensions: "350 × 500 × 130 mm",
      imageTone: "#dfe4df",
      imageUrl: "https://uploads.example.test/catalog/catalog-mabc.png?v=mabc",
    });

    assert.equal(product.imageUrl, "https://uploads.example.test/catalog/catalog-mabc.png?v=mabc");
  });

  it("uses the existing basin visual when an image URL is absent", () => {
    const product = basinProductFromCatalog({
      sku: "KF001",
      colorCode: "VS311",
      colorName: "Shine",
      priceTHB: 19000,
      category: "counter basin",
      dimensions: "600 × 800 × 200 mm",
      imageTone: "#dfe4df",
      imageUrl: "  ",
    });

    assert.equal(product.imageUrl, undefined);
    assert.equal(product.imageTone, "#dfe4df");
  });
});

describe("storefront multi-selection state", () => {
  it("toggles basin SKUs without changing existing quantities or duplicating lines", () => {
    const first = toggleBasinSelection([], "KF001");
    const second = toggleBasinSelection(first, "KF002");
    assert.deepEqual(second.map((line) => line.sku), ["KF001", "KF002"]);
    assert.equal(toggleBasinSelection(second, "KF001").length, 1);
    assert.equal(toggleBasinSelection(second, "KF002")[0]?.sku, "KF001");
    assert.equal(toggleBasinSelection(first, "KF001").length, 0);
  });

  it("keeps stone configurations independent while replacing only the edited color", () => {
    const bw: StoneConfig = { enabled: true, mode: "whole-sheet", color: "BW010", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 };
    const nw: StoneConfig = { ...bw, color: "NW013", quantity: 1 };
    const installedBw = { ...bw, mode: "installed" as const, widthCm: 120, lengthCm: 240 };
    const selected = upsertStoneSelection(upsertStoneSelection([], bw), nw);
    const edited = upsertStoneSelection(selected, installedBw);
    assert.deepEqual(edited.map((stone) => stone.color), ["NW013", "BW010"]);
    assert.equal(edited.find((stone) => stone.color === "NW013")?.quantity, 1);
    assert.equal(edited.find((stone) => stone.color === "BW010")?.mode, "installed");
    assert.equal(edited.find((stone) => stone.color === "BW010")?.unitPrice, 7500);
  });

  it("removes only the requested stone color", () => {
    const bw: StoneConfig = { enabled: true, mode: "whole-sheet", color: "BW010", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 };
    const nw: StoneConfig = { ...bw, color: "NW013" };
    const selected = removeStoneSelection([bw, nw], "BW010");
    assert.deepEqual(selected, [nw]);
  });

  it("studio basin search reaches every catalog model", () => {
    assert.equal(filterBasinProducts(PRODUCTS, "").length, 30);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF029").map((product) => product.sku), ["KF029"]);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF030").map((product) => product.sku), ["KF030"]);
  });
});