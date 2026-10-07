import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_STONE_COLORS,
  BASIN_PRODUCTS,
  PRODUCTS,
  STONE_COLORS,
  TALL_PRODUCTS,
  basinHiddenReason,
  filterBasinProducts,
  isBasinSellable,
  sellableBasinProducts,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  studioCutoutBasinProducts,
  type BasinProduct,
} from "../src/data/catalog.ts";

// job-279, from the owner's two rulings on 7 Oct 2026:
//   "ชื่ออ่างยึดตามแคตตาล็อก"  — a basin is named after the stone it ships in, nowhere else.
//   "ยึดตาม database หลัก ว่าซ่อนหรือไม่ซ่อน ถ้าไม่ซ่อนก็คือขาย" — a closed stone sells nothing, and a basin is sold with its stone.
// David corrected the database (basin_prices) the same day; this file is the app half of that: names line up, and the
// one basin whose stone is closed (KF024 on V342 Whisper) leaves the shelf without being repriced onto another stone.

const bySku = (sku: string) => PRODUCTS.find((product: BasinProduct) => product.sku === sku)!;
const stoneOf = (product: BasinProduct) => ALL_STONE_COLORS.find((color) => color.code === product.colorCode);

describe("basin names follow the stone catalogue (job-279 A)", () => {
  it("every basin whose stone exists is named exactly as that stone", () => {
    const mismatches = PRODUCTS.flatMap((product) => {
      const stone = stoneOf(product);
      return stone && stone.name !== product.colorName
        ? [`${product.sku}: "${product.colorName}" vs catalogue "${stone.name}" (${product.colorCode})`]
        : [];
    });
    assert.deepEqual(mismatches, [], `basin names must be the catalogue's words: ${mismatches.join(" · ")}`);
  });

  it("the three names the owner ruled on, one by one", () => {
    assert.equal(bySku("KF004").colorName, "Vene White");
    assert.equal(bySku("KF005").colorName, "Honey Jade");
    assert.equal(bySku("KF008").colorName, "Sanded Icicle");
    // the codes stay untouched next to them — job 276 fixed those, this job must not move them again
    assert.deepEqual([bySku("KF004"), bySku("KF005"), bySku("KF008")].map((p) => p.colorCode), ["VW050", "HJ524M", "SI414"]);
  });

  it("the old misspellings are gone from the basin rows", () => {
    const stale = ["Wene White", "Honer Jade", "Sanded Icice"];
    const names = PRODUCTS.map((product) => product.colorName);
    assert.deepEqual(names.filter((name) => stale.includes(name)), []);
  });

  it("a name change never dragged a price or a size with it", () => {
    assert.deepEqual([bySku("KF004"), bySku("KF005"), bySku("KF008")].map((p) => p.priceTHB), [19000, 19000, 17000]);
    assert.equal(bySku("KF004").dimensions, "600 × 800 × 200 mm");
    assert.equal(bySku("KF008").basinDimensions, "350 × 500 × 130 mm");
  });
});

describe("a basin on a closed stone is not for sale (job-279 B, owner ruling applied)", () => {
  it("every basin in the catalogue ships a stone that is on sale", () => {
    // The owner ruled that KF024 keeps its shelf — its row was never hidden — and the database moved it from the
    // closed V342 onto VW342 "Aria Whisper". So no real model is withheld today, and the rule below still stands
    // for the next stone that gets closed.
    const withheld = PRODUCTS.filter((product) => !isBasinSellable(product));
    assert.deepEqual(withheld.map((product) => product.sku), []);
    assert.equal(bySku("KF024").colorCode, "VW342", "the model ships the Whisper stone that is still sold");
    assert.equal(bySku("KF024").colorName, "Aria Whisper");
    assert.equal(basinHiddenReason(bySku("KF024")), null, "nothing withheld, nothing to explain");
    assert.equal(filterBasinProducts(PRODUCTS, "").length, 30);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF024").map((p) => p.sku), ["KF024"]);
    assert.equal(studioCutoutBasinProducts(PRODUCTS).some((product) => product.sku === "KF024"), true);
    assert.equal(sellableBasinProducts(PRODUCTS).length, PRODUCTS.length);
  });

  it("the rule still withholds a basin whose stone is closed — proved on a synthetic model", () => {
    // No live model is affected, which is exactly why the mechanism needs its own fixture: if this ever stops
    // working, nothing in the shipped catalogue would notice. V342 is the closed stone from job 277.
    const closedStoneBasin: BasinProduct = { ...bySku("KF024"), sku: "KF999", colorCode: "V342", colorName: "Whisper" };
    assert.equal(isBasinSellable(closedStoneBasin), false);
    assert.equal(basinHiddenReason(closedStoneBasin), "สี V342 ถูกปิดในฐานข้อมูล");
    assert.deepEqual(sellableBasinProducts([closedStoneBasin, bySku("KF001")]).map((p) => p.sku), ["KF001"]);
    assert.deepEqual(filterBasinProducts([closedStoneBasin, bySku("KF001")], "KF999").map((p) => p.sku), []);
    assert.deepEqual(studioCutoutBasinProducts([closedStoneBasin, bySku("KF001")]).map((p) => p.sku), ["KF001"]);
    // and an unknown code is not sellable either: nobody can stand behind a stone that does not exist
    assert.equal(isBasinSellable({ ...closedStoneBasin, colorCode: "ZZZ999" }), false);
    assert.equal(basinHiddenReason({ ...closedStoneBasin, colorCode: "ZZZ999" }), "แคตตาล็อกไม่มีสี ZZZ999 ของอ่างรุ่นนี้");
  });

  it("a withheld basin is never priced as some other stone", () => {
    assert.equal(stoneInstalledUnitPrice("V342"), null, "no Bright White rate standing in for a closed stone");
    assert.equal(stoneSheetUnitPrice("V342", 1), null);
    assert.notEqual(stoneInstalledUnitPrice("V342"), stoneInstalledUnitPrice("BW010"), "must not stand in for the first row");
    for (const sku of ["KF004", "KF005", "KF008", "KF001", "KF024"]) {
      const product = bySku(sku);
      assert.equal(isBasinSellable(product), true, `${sku} still sells`);
      assert.equal(stoneInstalledUnitPrice(product.colorCode), stoneOf(product)?.installedPriceTHB ?? null, `${sku} stone rate`);
    }
  });
});
