import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_STONE_COLORS, BASIN_PRODUCTS, PRODUCTS, TALL_PRODUCTS, type BasinProduct, type StoneColor } from "../src/data/catalog.ts";

// job-276: the basin rows are hand-written, so a colour code can drift into a transposed spelling that never existed
// in the database (KF010 shipped a digit-swapped variant of NA160, KF012 and KF013 the same way against CS532M and VR322).
// A dead code does not crash anything: the studio still shows the basin, but the stone lookup behind it
// resolves to nothing, so the price and texture of that colour silently disappear from a quote.
// Two locks, both reading the shipped catalogue only — no fixture data, no network.
//
// Locked against the whole catalogue (ALL_STONE_COLORS), not the storefront list: a basin may legitimately name a stone
// the database has closed for now — that is job-277's D1 case (KF024 on V342), reported for the owner to rule on.
// "The code is real" and "the code may be sold" are two different locks; stone-status-visibility.test.ts holds the second.

const codes = ALL_STONE_COLORS.map((color: StoneColor) => color.code);

describe("catalogue stone codes (job-276)", () => {
  it("B1 no stone code is listed twice in the colour catalogue", () => {
    const seen = new Map<string, number>();
    for (const code of codes) seen.set(code, (seen.get(code) ?? 0) + 1);
    const duplicated = [...seen].filter(([, count]) => count > 1).map(([code, count]) => `${code} ×${count}`);
    assert.deepEqual(duplicated, [], `the colour catalogue must hold one row per code: ${duplicated.join(", ")}`);
    assert.equal(seen.size, codes.length, "unique code count must equal row count");
  });

  it("B2 every basin product points at a stone code that exists", () => {
    const known = new Set(codes);
    const orphans = (Object.entries({ BASIN_PRODUCTS, TALL_PRODUCTS }) as Array<[string, ReadonlyArray<BasinProduct>]>).flatMap(
      ([list, products]) =>
        products
          .filter((product) => !known.has(product.colorCode))
          .map((product) => `${list} ${product.sku} → "${product.colorCode}" (${product.colorName})`),
    );
    assert.deepEqual(orphans, [], `basin rows referencing a stone code that is not in the catalogue: ${orphans.join(" · ")}`);
    assert.ok(PRODUCTS.length > 0, "the basin list itself must not be empty, or B2 proves nothing");
  });
});
