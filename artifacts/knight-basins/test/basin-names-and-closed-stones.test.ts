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

describe("a basin on a closed stone is not for sale (job-279 B)", () => {
  it("KF024 is the only affected model, and it is withheld with a reason that names the stone", () => {
    const withheld = PRODUCTS.filter((product) => !isBasinSellable(product));
    assert.deepEqual(withheld.map((product) => product.sku), ["KF024"]);
    assert.equal(bySku("KF024").colorCode, "V342", "still bound to Whisper — the row was not re-pointed");
    assert.equal(STONE_COLORS.some((color) => color.code === "V342"), false, "the database closed it in job 277");
    assert.equal(basinHiddenReason(bySku("KF024")), "สี V342 ถูกปิดในฐานข้อมูล");
    assert.equal(basinHiddenReason(bySku("KF001")), null, "a sellable basin carries no warning");
  });

  it("both pickers drop it, and searching for it finds nothing", () => {
    assert.equal(filterBasinProducts(PRODUCTS, "").some((p) => p.sku === "KF024"), false);
    assert.equal(studioCutoutBasinProducts(PRODUCTS).some((p) => p.sku === "KF024"), false);
    assert.equal(sellableBasinProducts(PRODUCTS).length, PRODUCTS.length - 1);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF024").map((p) => p.sku), []);
    assert.equal(sellableBasinProducts(BASIN_PRODUCTS).length, BASIN_PRODUCTS.length, "no counter basin lost its stone");
    assert.equal(sellableBasinProducts(TALL_PRODUCTS).length, TALL_PRODUCTS.length - 1);
    assert.equal(PRODUCTS.length, 30, "hidden is not deleted: every model is still in the source list");
  });

  it("it is never priced as some other stone", () => {
    const stone = bySku("KF024").colorCode;
    assert.equal(stoneInstalledUnitPrice(stone), null, "no Bright White rate standing in for a closed stone");
    assert.equal(stoneSheetUnitPrice(stone, 1), null);
    assert.notEqual(stoneInstalledUnitPrice(stone), stoneInstalledUnitPrice("BW010"), "must not stand in for the first row");
    for (const sku of ["KF004", "KF005", "KF008", "KF001", "KF028"]) {
      const product = bySku(sku);
      assert.equal(isBasinSellable(product), true, `${sku} still sells`);
      assert.equal(stoneInstalledUnitPrice(product.colorCode), stoneOf(product)?.installedPriceTHB ?? null, `${sku} stone rate`);
    }
  });
});
