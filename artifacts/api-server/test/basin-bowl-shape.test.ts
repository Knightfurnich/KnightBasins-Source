import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bowlShapeFields, withBasinBowlShape, CHECKED_BOWL_SKUS } from "../src/lib/basin-bowl-shape.ts";
import { BASIN_BOWL_SHAPES, PRODUCTS } from "../../knight-basins/src/data/catalog.ts";

type Survey = {
  surveyed: Array<{ sku: string; bowlShape: string; note: string; hdUrl: string; mainUrl: string }>;
  unclear: Array<{ sku: string; reason: string }>;
  notBasins: Array<{ sku: string }>;
};
const survey = JSON.parse(readFileSync(new URL("./fixtures/bowl-shape-survey.json", import.meta.url), "utf8")) as Survey;

// job 438-C: KF003 and KF006 share stone, outside size, bowl size and price; only the bowl differs.
// job 445-C revision 2: shape only. The overflow hole is a made-to-order option, not a spec — no label mentions it and
// `bowlOverflowHole` is an always-null key kept for the contract. Boy reads `bowlShapeLabel` on the card.
describe("bowl shape fields sent by GET /api/catalog (job 438-C)", () => {
  it("KF003 is a rounded-rectangle bowl", () => {
    assert.deepEqual(bowlShapeFields("KF003"), {
      bowlShape: "rounded-rectangle",
      bowlShapeLabel: "หลุมสี่เหลี่ยมมุมมน",
      bowlOverflowHole: null,
    });
  });

  it("KF006 is an oval bowl, and the two labels differ so the cards can be told apart", () => {
    assert.deepEqual(bowlShapeFields("KF006"), { bowlShape: "oval", bowlShapeLabel: "หลุมวงรี", bowlOverflowHole: null });
    assert.notEqual(bowlShapeFields("KF003").bowlShapeLabel, bowlShapeFields("KF006").bowlShapeLabel);
  });

  it("only the surveyed models carry a value; unclear pictures and the two non-basins stay null — nothing is guessed (job 442-C)", () => {
    const surveyed = survey.surveyed.map((row) => row.sku).sort();
    assert.deepEqual([...CHECKED_BOWL_SKUS].sort(), surveyed);
    const allNull = { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null };
    for (const { sku } of survey.unclear) assert.deepEqual(bowlShapeFields(sku), allNull, `${sku} (picture not clear)`);
    for (const { sku } of survey.notBasins) assert.deepEqual(bowlShapeFields(sku), allNull, `${sku} (not a wash basin)`);
    assert.deepEqual(survey.notBasins.map((row) => row.sku), ["KF029", "KF030"]);
    // every one of the 30 models is accounted for exactly once
    const all = [...surveyed, ...survey.unclear.map((r) => r.sku), ...survey.notBasins.map((r) => r.sku)].sort();
    assert.deepEqual(all, PRODUCTS.map((p) => p.sku).sort());
  });

  it("every surveyed value equals the survey table, the label is built from the shape alone, and no label mentions the overflow hole", () => {
    for (const row of survey.surveyed) {
      const out = bowlShapeFields(row.sku);
      assert.equal(out.bowlShape, row.bowlShape, `${row.sku} shape`);
      assert.ok(out.bowlShapeLabel && out.bowlShapeLabel.startsWith("หลุม"), `${row.sku} label`);
      assert.ok(!/รูน้ำล้น/.test(out.bowlShapeLabel!), `${row.sku}: the label must not say anything about an overflow hole`);
      assert.equal(out.bowlOverflowHole, null, `${row.sku}: bowlOverflowHole is always null`);
      assert.match(row.hdUrl, new RegExp(`/kb/images/basin-hd/${row.sku}\.jpg$`));
      assert.ok(row.note.length >= 5, `${row.sku} has a note`);
    }
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
    assert.ok(bowlShapeLabel && bowlOverflowHole === null);
  });

  it("the sku is matched case- and space-insensitively, like the rest of the catalogue helpers", () => {
    assert.equal(bowlShapeFields(" kf006 ").bowlShape, "oval");
  });

  it("the route sends it: getCatalogData wraps every basin (read from the source)", () => {
    const source = readFileSync(new URL("../src/routes/catalog.ts", import.meta.url), "utf8");
    assert.match(source, /basins: basins\.map\(\(basin\) => withBasinBowlShape\(withBasinCategory\(withBasinMedia\(basin\), categories\)\)\)/);
  });

  it("the built-in copy in the web bundle says the same for every model, and has nothing for the others", () => {
    assert.deepEqual(Object.keys(BASIN_BOWL_SHAPES).sort(), [...CHECKED_BOWL_SKUS].sort());
    for (const product of PRODUCTS) {
      const fromApi = bowlShapeFields(product.sku);
      if (fromApi.bowlShape === null) {
        assert.equal(product.bowlShape, undefined, product.sku);
        assert.equal(product.bowlShapeLabel, undefined, product.sku);
        assert.equal(BASIN_BOWL_SHAPES[product.sku], undefined, product.sku);
      } else {
        assert.deepEqual(BASIN_BOWL_SHAPES[product.sku], fromApi, product.sku);
        assert.equal(product.bowlShape, fromApi.bowlShape, product.sku);
        assert.equal(product.bowlShapeLabel, fromApi.bowlShapeLabel, product.sku);
        assert.equal(product.bowlOverflowHole ?? null, null, product.sku);
        assert.ok(!/รูน้ำล้น/.test(product.bowlShapeLabel ?? ""), `${product.sku}: the built-in label does not mention the overflow hole`);
      }
    }
  });
});
