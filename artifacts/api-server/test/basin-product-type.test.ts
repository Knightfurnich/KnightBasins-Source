import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { STORAGE_CATEGORY, STORAGE_PILLAR_LABEL, isStoragePillarSku, withBasinProductType } from "../src/lib/basin-product-type.ts";
import { shoppingReply } from "../src/lib/support-guest-answers.ts";

// job 440-C: KF029 / KF030 are floor-standing storage pillars, not wash basins. The rows the API reads from the database
// still say "tall vertical washbasin" for them; the API fixes the type on the way out. `category` + `categoryLabel` are the
// names Boy (441-B) reads. The 30 rows below are the app's own values, taken 11 Oct 2026 (price, size, bowl size, colour).

type Row = { sku: string; colorCode: string; colorName: string; priceTHB: number; category: string; dimensions: string; basinDimensions: string | null };
const snapshot = JSON.parse(readFileSync(new URL("../../knight-basins/test/fixtures/app-catalog-snapshot.json", import.meta.url), "utf8")) as { basins: Row[] };
const source = readFileSync(new URL("../src/routes/catalog.ts", import.meta.url), "utf8");
const rows = snapshot.basins;

describe("KF029 / KF030 are storage pillars (job 440-C)", () => {
  it("the starting point is what the owner described: only these two have no bowl size, and the database files them as basins", () => {
    assert.equal(rows.length, 30);
    const noBowl = rows.filter((row) => !row.basinDimensions).map((row) => row.sku).sort();
    assert.deepEqual(noBowl, ["KF029", "KF030"]);
    for (const row of rows.filter((r) => noBowl.includes(r.sku))) assert.equal(row.category, "tall vertical washbasin");
  });

  it("both models come out as storage with a Thai label from the data, and nothing else about them moves", () => {
    for (const sku of ["KF029", "KF030"]) {
      const before = rows.find((row) => row.sku === sku)!;
      const after = withBasinProductType(before);
      assert.equal(after.category, STORAGE_CATEGORY);
      assert.equal(after.categoryLabel, STORAGE_PILLAR_LABEL);
      assert.equal(after.categoryLabel, "เสาวางของตั้งพื้น");
      assert.deepEqual({ ...after, category: before.category, categoryLabel: undefined }, { ...before, categoryLabel: undefined }, `${sku}: price, size, colour, name, code and bowl size are untouched`);
      assert.equal(after.priceTHB, 16000);
      assert.equal(after.dimensions, "400 × 400 × 1000 mm");
      assert.equal(after.basinDimensions, null, "no bowl size is invented");
    }
  });

  it("every other model keeps its category and gets a label: 28 wash basins, none of them storage", () => {
    const others = rows.filter((row) => !isStoragePillarSku(row.sku));
    assert.equal(others.length, 28);
    for (const row of others) {
      const after = withBasinProductType(row);
      assert.equal(after.category, row.category, row.sku);
      assert.deepEqual({ ...after, categoryLabel: undefined }, { ...row, categoryLabel: undefined }, `${row.sku} is otherwise identical`);
      assert.equal(after.categoryLabel, row.category === "counter basin" ? "เคาน์เตอร์" : "ทรงสูง", row.sku);
    }
  });

  it("the counters Boy needs come out as 18 counter, 10 tall and 2 storage (it was 18 / 12)", () => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const { category } = withBasinProductType(row);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    assert.deepEqual([...counts.entries()].sort(), [["counter basin", 18], ["storage", 2], ["tall vertical washbasin", 10]]);
  });

  it("a custom category the admin made keeps its own name as the label, and no row is dropped or hidden", () => {
    assert.deepEqual(withBasinProductType({ sku: "KF099", category: "ชุดพิเศษ" }), { sku: "KF099", category: "ชุดพิเศษ", categoryLabel: "ชุดพิเศษ" });
    assert.equal(rows.map(withBasinProductType).length, 30);
  });

  it("the sku is matched case- and space-insensitively", () => {
    assert.equal(withBasinProductType({ sku: " kf029 ", category: "tall vertical washbasin" }).category, STORAGE_CATEGORY);
  });

  it("the route sends it, after the category is read from the database (read from the source)", () => {
    assert.match(source, /withBasinProductType\(withBasinCategory\(withBasinMedia\(basin\), categories\)\)/);
  });

  it("the visitor assistant no longer counts the pillars as 'อ่างตั้งพื้น' (price range, wording), and still sells them as a product row", () => {
    const base = rows.map(withBasinProductType);
    const reply = shoppingReply("อยากได้ชุดอ่างล้างหน้า", { basins: base, installedStones: [], sheetStones: [] });
    const standing = base.filter((row) => row.category !== "counter basin" && row.category !== STORAGE_CATEGORY).map((row) => row.priceTHB);
    const baht = (value: number) => value.toLocaleString("th-TH");
    assert.ok(reply.includes(`อ่างตั้งพื้น ${baht(Math.min(...standing))}–${baht(Math.max(...standing))}`), reply);
    assert.ok(Math.min(...standing) > 16000, "the 16,000 pillars are not the cheapest 'standing basin' any more");
    const before = shoppingReply("อยากได้ชุดอ่างล้างหน้า", { basins: rows, installedStones: [], sheetStones: [] });
    assert.ok(before.includes("อ่างตั้งพื้น 16,000"), "before the change the pillars set the low end of the standing-basin price");
  });
});
