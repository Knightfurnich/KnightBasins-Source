import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BASIN_OVERFLOW_NOTE, BOWL_SHAPES, catalogOrderNotes, seedBowlShapeFields, withBasinBowlShape } from "../src/lib/basin-bowl-shape.ts";
import { PRODUCTS } from "../../knight-basins/src/data/catalog.ts";

// job 447-C (item C): the overflow hole is a made-to-order option, not a spec of a model. The only place the subject is
// named is ONE catalogue-level line the API sends as `basinOverflowNote` (Boy reads that field in 448-B). No card label says
// "with" or "without". The wording below is the owner's, approved 11 Oct 2026 — change it only on their say.

const APPROVED_NOTE = "อ่างทุกรุ่นสั่งทำได้ทั้งแบบมีและไม่มีรูน้ำล้น (ปกติโรงงานทำให้แบบไม่มี) — ถ้าต้องการแบบมี แจ้งทีมขายได้";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("basinOverflowNote (job 447-C item C)", () => {
  it("is exactly the wording the owner approved, one line", () => {
    assert.equal(BASIN_OVERFLOW_NOTE, APPROVED_NOTE);
    assert.ok(!BASIN_OVERFLOW_NOTE.includes("\n"));
  });

  it("is sent under the field name Boy reads, and nothing else is added", () => {
    assert.deepEqual(catalogOrderNotes(), { basinOverflowNote: APPROVED_NOTE });
    assert.deepEqual(Object.keys(catalogOrderNotes()), ["basinOverflowNote"]);
  });

  it("GET /api/catalog spreads it next to the rows and the trade constants, after both (read from the source)", () => {
    const route = read("../src/routes/catalog.ts");
    assert.match(route, /res\.json\(\{ \.\.\.\(await getCatalogData\(true\)\), \.\.\.commercialConstants\(\), \.\.\.catalogOrderNotes\(\) \}\);/);
    assert.match(route, /import \{ catalogOrderNotes, withBasinBowlShape \} from "\.\.\/lib\/basin-bowl-shape";/);
  });

  it("the phrase 'รูน้ำล้น' appears in the shape code only inside the note, so no card label can carry it", () => {
    const lib = read("../src/lib/basin-bowl-shape.ts");
    const lines = lib.split("\n").filter((line) => line.includes("รูน้ำล้น"));
    assert.equal(lines.length, 1, lines.join("\n"));
    assert.ok(lines[0]!.includes("BASIN_OVERFLOW_NOTE"), "the one line is the note itself");
  });

  it("no shape label — for any shape, any seeded model or any database value — mentions the overflow hole, and bowlOverflowHole stays null", () => {
    for (const shape of BOWL_SHAPES) {
      const out = withBasinBowlShape({ sku: "KF007", bowlShape: shape });
      assert.ok(!/น้ำล้น/.test(out.bowlShapeLabel ?? ""), shape);
      assert.equal(out.bowlOverflowHole, null, shape);
    }
    for (const product of PRODUCTS) {
      const seed = seedBowlShapeFields(product.sku);
      assert.ok(!/น้ำล้น/.test(seed.bowlShapeLabel ?? ""), product.sku);
      assert.equal(seed.bowlOverflowHole, null, product.sku);
    }
  });

  it("the note does not make any card say 'with' or 'without': it names no model and no shape", () => {
    assert.ok(!/KF\d{3}/.test(BASIN_OVERFLOW_NOTE));
    for (const shape of BOWL_SHAPES) assert.ok(!BASIN_OVERFLOW_NOTE.includes(shape));
    assert.ok(!/ไม่มีรูน้ำล้น\s*$/.test(BASIN_OVERFLOW_NOTE), "it does not end by declaring a model has no hole");
  });
});
