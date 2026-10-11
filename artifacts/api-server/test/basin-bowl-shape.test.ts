import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bowlShapeFields, withBasinBowlShape, CHECKED_BOWL_SKUS } from "../src/lib/basin-bowl-shape.ts";
import { BASIN_BOWL_SHAPES, PRODUCTS } from "../../knight-basins/src/data/catalog.ts";

// job 438-C: KF003 and KF006 share stone, outside size, bowl size and price; only the bowl differs.
// The field names Boy (439-B) reads on the card: bowlShape · bowlShapeLabel · bowlOverflowHole.
describe("bowl shape fields sent by GET /api/catalog (job 438-C)", () => {
  it("KF003 is a rounded-rectangle bowl with no overflow hole", () => {
    assert.deepEqual(bowlShapeFields("KF003"), {
      bowlShape: "rounded-rectangle",
      bowlShapeLabel: "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น",
      bowlOverflowHole: false,
    });
  });

  it("KF006 is an oval bowl with an overflow hole", () => {
    assert.deepEqual(bowlShapeFields("KF006"), {
      bowlShape: "oval",
      bowlShapeLabel: "หลุมวงรี มีรูน้ำล้น",
      bowlOverflowHole: true,
    });
  });

  it("no other model gets a guessed value: every one of the 30 answers null", () => {
    const others = PRODUCTS.filter((p) => p.sku !== "KF003" && p.sku !== "KF006");
    assert.equal(others.length, 28);
    for (const { sku } of others) {
      assert.deepEqual(bowlShapeFields(sku), { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null }, sku);
    }
    assert.deepEqual([...CHECKED_BOWL_SKUS].sort(), ["KF003", "KF006"]);
  });

  it("only adds the three keys: price, size, colour, name, code, order and media of the row are untouched", () => {
    const row = {
      sku: "KF003", colorCode: "RW316", colorName: "River White", priceTHB: 19000, dimensions: "600 × 800 × 200 mm",
      basinDimensions: "350 × 500 × 130 mm", sortOrder: 2, active: true, imageUrl: "x", galleryImageUrls: ["y"],
    };
    const out = withBasinBowlShape(row);
    const { bowlShape, bowlShapeLabel, bowlOverflowHole, ...rest } = out;
    assert.deepEqual(rest, row);
    assert.equal(bowlShape, "rounded-rectangle");
    assert.ok(bowlShapeLabel && bowlOverflowHole === false);
  });

  it("the sku is matched case- and space-insensitively, like the rest of the catalogue helpers", () => {
    assert.equal(bowlShapeFields(" kf006 ").bowlShape, "oval");
  });

  it("the route sends it: getCatalogData wraps every basin (read from the source)", () => {
    const source = readFileSync(new URL("../src/routes/catalog.ts", import.meta.url), "utf8");
    assert.match(source, /basins: basins\.map\(\(basin\) => withBasinBowlShape\(withBasinCategory\(withBasinMedia\(basin\), categories\)\)\)/);
  });

  it("the built-in copy in the web bundle says the same, and has nothing for other models", () => {
    for (const sku of ["KF003", "KF006"]) {
      const fromApi = bowlShapeFields(sku);
      assert.deepEqual(BASIN_BOWL_SHAPES[sku], fromApi, sku);
      const product = PRODUCTS.find((p) => p.sku === sku)!;
      assert.equal(product.bowlShape, fromApi.bowlShape);
      assert.equal(product.bowlShapeLabel, fromApi.bowlShapeLabel);
      assert.equal(product.bowlOverflowHole, fromApi.bowlOverflowHole);
    }
    assert.deepEqual(Object.keys(BASIN_BOWL_SHAPES).sort(), ["KF003", "KF006"]);
    for (const product of PRODUCTS.filter((p) => p.sku !== "KF003" && p.sku !== "KF006")) {
      assert.equal(product.bowlShape, undefined, product.sku);
      assert.equal(product.bowlShapeLabel, undefined, product.sku);
    }
  });
});
