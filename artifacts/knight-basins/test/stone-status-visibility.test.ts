import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ALL_STONE_COLORS,
  PRODUCTS,
  STONE_COLORS,
  findStoneColor,
  isStoneVisible,
  stoneColorsForMode,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  type CatalogStoneRecord,
  type StoneStatus,
} from "../src/data/catalog.ts";

// job-277: the owner ruled on 7 Oct 2026 that the database is the truth about which stones are on sale —
// "ปิดจริง เอาตามข้อมูลหลัก". src/data/stone-status.json is generated from production by David's read-only script
// (68 visible / 12 hidden over 80 codes) and is the source the storefront must follow. These locks cover three things:
//
//   B2 — the list the app shows is exactly the visible set, and hiding never means deleting.
//   C  — a real code beats an alias, so "VW342" is Aria Whisper at 12,000 a sqm, not the closed V342 at 9,500.
//   runtime — the catalogue that arrives from /api/catalog goes through the same filter, not just the built-in list.

const statusFile = JSON.parse(
  readFileSync(new URL("../src/data/stone-status.json", import.meta.url), "utf8"),
) as { colours: StoneStatus[] };
const visibleByFile = statusFile.colours.filter((entry) => entry.visible).map((entry) => entry.code);
const hiddenByFile = statusFile.colours.filter((entry) => !entry.visible).map((entry) => entry.code);

const shown = STONE_COLORS.map((color) => color.code);
const diff = (left: string[], right: string[]) => left.filter((code) => !right.includes(code));

describe("stone status decides what the storefront shows (job-277 B2)", () => {
  it("the status file is the shape this job was written against", () => {
    assert.equal(statusFile.colours.length, 80, "one row per code");
    assert.equal(visibleByFile.length, 68, "visible count");
    assert.equal(hiddenByFile.length, 12, "hidden count");
    assert.deepEqual(
      hiddenByFile.slice().sort(),
      ["BL461", "CT970", "CT981", "GG884(N)", "KZ695", "OM391", "RC469", "SL531", "V342", "VD126", "VL155", "WW001"].sort(),
      "the closed codes are the twelve the owner named",
    );
  });

  it("shown list equals visible rows of stone-status.json — both directions, no drift", () => {
    assert.equal(shown.length, 68, `the app must show exactly 68 stones, got ${shown.length}`);
    assert.deepEqual(diff(shown, visibleByFile), [], "shown stones the database has closed");
    assert.deepEqual(diff(visibleByFile, shown), [], "visible stones the app refuses to show");
    assert.equal(shown.filter((code) => !isStoneVisible(code)).length, 0);
  });

  it("Aria Whisper is back and every closed stone is off the page, in both order modes", () => {
    assert.ok(shown.includes("VW342"), "VW342 was in the database all along and had no row of its own");
    for (const code of hiddenByFile) assert.equal(shown.includes(code), false, `${code} must not be shown`);
    // the sheet view and the installed view share the one list the page renders — same filter, so both lose the twelve
    assert.deepEqual(
      STONE_COLORS.filter((color) => color.code === "V342" || color.code === "VW342").map((color) => color.code),
      ["VW342"],
      "of the two Whisper stones only the one the database sells reaches the page",
    );
    assert.equal(STONE_COLORS.filter((color) => color.sheetPriceTHB !== null).length, 64, "sixty-four stones have a sheet price");
    assert.equal(STONE_COLORS.filter((color) => color.installedPriceTHB !== null).length, 65, "sixty-five are sold installed");
  });

  it("closing a stone hides it, it does not delete it: a reopen stays a one-line database change", () => {
    assert.equal(ALL_STONE_COLORS.length, 80, "the catalogue still carries every row, open or closed");
    for (const code of hiddenByFile) {
      assert.ok(ALL_STONE_COLORS.some((color) => color.code === code), `${code} must remain in the source table`);
    }
    assert.equal(ALL_STONE_COLORS.length - STONE_COLORS.length, hiddenByFile.length);
  });

  it("every code the app knows is known to the status file too", () => {
    // isStoneVisible() fails open for an unknown code so a fresh stone cannot vanish before the file is regenerated.
    // That only stays safe while the two sets line up — this is the half of that bargain the file alone cannot say.
    const unknown = ALL_STONE_COLORS.map((color) => color.code).filter((code) => !statusFile.colours.some((entry) => entry.code === code));
    assert.deepEqual(unknown, [], "codes in the catalogue but not in stone-status.json — ask David to regenerate it");
  });

  it("the catalogue loaded from the API is filtered the same way as the built-in one", () => {
    const record = (code: string, name: string, price: number): CatalogStoneRecord => ({ code, name, tone: "#888888", pricePerSqmTHB: price, basePriceTHB: price });
    // Aria Whisper (open) + Whisper (closed): the API sends both, only the open one may reach a picker.
    const installed = [record("VW342", "Aria Whisper", 12000), record("V342", "Whisper", 9500), record("MU010", "Evermoin Ultra Bright", 7500)];
    const fromApi = stoneColorsForMode(installed, [], "installed");
    assert.deepEqual(fromApi.map((color) => color.code), ["VW342", "MU010"]);
    assert.equal(fromApi.some((color) => color.code === "V342"), false);
  });
});

describe("a real code beats an alias (job-277 C)", () => {
  it("VW342 resolves to Aria Whisper at 12,000 a square metre, not to the closed Whisper at 9,500", () => {
    const stone = findStoneColor("VW342");
    assert.equal(stone?.code, "VW342");
    assert.equal(stone?.name, "Aria Whisper");
    assert.equal(stone?.installedPriceTHB, 12000);
    assert.equal(stoneInstalledUnitPrice("VW342"), 12000, "the number a quote would print");
    assert.equal(stoneSheetUnitPrice("VW342", 1), null, "it has no sheet price");
    assert.equal(findStoneColor("Aria Whisper")?.code, "VW342");
    assert.equal(findStoneColor("VW 342")?.code, "VW342");
  });

  it("the closed V342 resolves to nothing rather than borrowing its sibling", () => {
    assert.equal(findStoneColor("V342"), undefined);
    assert.equal(findStoneColor("V 342"), undefined);
    assert.equal(findStoneColor("Whisper"), undefined);
  });

  it("ordering rule on its own: an alias on the first row cannot steal the second row's code", () => {
    // Same shape as the live collision, but with both stones open, so this keeps guarding after a reopen.
    const both = [
      { code: "V342", name: "Whisper", tone: "#d9d1c2", sheetPriceTHB: 12000, installedPriceTHB: 9500, documentCodes: ["VW342", "VW 342"] },
      { code: "VW342", name: "Aria Whisper", tone: "#d9d1c2", sheetPriceTHB: null, installedPriceTHB: 12000, documentCodes: ["VW 342"] },
    ];
    assert.equal(findStoneColor("VW342", both)?.code, "VW342");
    assert.equal(findStoneColor("VW 342", both)?.code, "VW342");
    assert.equal(findStoneColor("v-w-342", both)?.code, "VW342", "punctuation still does not matter");
    assert.equal(findStoneColor("V342", both)?.code, "V342", "and the other stone is still reachable by its own code");
    assert.equal(findStoneColor("Aria Whisper", both)?.code, "VW342", "a name still finds its stone");
  });

  it("job-260's approved spellings still price as their group", () => {
    assert.equal(stoneSheetUnitPrice("QS 822N", 1), 8500);
    assert.equal(stoneSheetUnitPrice("QS822N", 10), 8300);
    assert.equal(stoneSheetUnitPrice("QS822 N", 50), 8075);
    assert.equal(stoneInstalledUnitPrice("BR 816"), 9500);
    assert.equal(stoneInstalledUnitPrice("WH122"), 9500);
  });
});

describe("closed stones reach nobody: no row, no price, no lookup (job 429-C D)", () => {
  const closed = ALL_STONE_COLORS.filter((color) => !isStoneVisible(color.code));

  it("every closed code is a built-in row the storefront list drops, and none of them is in the live catalogue shape", () => {
    assert.equal(closed.length, 12);
    assert.deepEqual(closed.map((color) => color.code).sort(), hiddenByFile.slice().sort());
    for (const color of closed) assert.equal(STONE_COLORS.includes(color), false, color.code);
  });

  it("a closed stone cannot be found by its code, its name or any spelling it carries, and is never priced", () => {
    for (const color of closed) {
      for (const identifier of [color.code, color.name, ...color.documentCodes]) {
        const found = findStoneColor(identifier);
        // An alias may legitimately point at the OPEN sibling (V342's "VW342"); it must never resolve to the closed row.
        assert.ok(found === undefined || (found.code !== color.code && isStoneVisible(found.code)), `${color.code} found by "${identifier}"`);
      }
      assert.equal(stoneSheetUnitPrice(color.code, 1), null, `${color.code} must not have a sheet price`);
      assert.equal(stoneSheetUnitPrice(color.code, 50), null, `${color.code} must not have a 50+ sheet price`);
      assert.equal(stoneInstalledUnitPrice(color.code), null, `${color.code} must not have an installed price`);
    }
  });

  it("no basin on the shelf is built on a closed stone, and every basin's stone is open", () => {
    for (const product of PRODUCTS) {
      assert.equal(isStoneVisible(product.colorCode), true, `${product.sku} uses closed stone ${product.colorCode}`);
      assert.ok(findStoneColor(product.colorCode), `${product.sku}: ${product.colorCode} is not in the storefront list`);
    }
  });
});

describe("one name per colour code (job 429-C C)", () => {
  const nameOf = (code: string) => ALL_STONE_COLORS.find((color) => color.code === code)?.name;

  it("the four codes the owner corrected carry the Galet spelling, in the stone list and on the basins that use them", () => {
    assert.deepEqual(
      ["GC714", "GE118", "GG884", "GI017"].map(nameOf),
      ["Galet Crystals", "Galet Ebony", "Galet Grey", "Galet Ice"],
    );
    assert.equal(nameOf("GG884(N)"), "Galet Grey (N)");
    assert.equal(PRODUCTS.find((p) => p.sku === "KF015")?.colorName, "Galet Grey");
    assert.equal(PRODUCTS.find((p) => p.sku === "KF018")?.colorName, "Galet Ice");
    assert.ok(!ALL_STONE_COLORS.some((color) => /Glalet/.test(color.name)), "no built-in name still says Glalet");
    assert.ok(!PRODUCTS.some((product) => /Glalet/.test(product.colorName)), "no basin still says Glalet");
  });

  it("every basin names its stone the way the stone list does", () => {
    for (const product of PRODUCTS) {
      assert.equal(product.colorName, nameOf(product.colorCode), `${product.sku}: ${product.colorName} vs the stone list`);
    }
  });

  it("the old spelling and the code still find the stone, so nobody searching the way they used to gets 'not found'", () => {
    const expected: Array<[string, string]> = [["GC714", "Glalet Crystals"], ["GE118", "Glalet Ebony"], ["GG884", "Glalet Grey"], ["GI017", "Glalet Ice"]];
    for (const [code, oldName] of expected) {
      assert.equal(findStoneColor(code)?.code, code, `${code} by code`);
      assert.equal(findStoneColor(oldName)?.code, code, `${code} by the old name "${oldName}"`);
      assert.equal(findStoneColor(nameOf(code)!)?.code, code, `${code} by the new name`);
    }
  });

  it("the other names stay as they were: Honey Jade keeps its old typos as aliases, and the two awaiting a ruling are untouched", () => {
    assert.equal(nameOf("HJ524M"), "Honey Jade");
    assert.equal(findStoneColor("Honer Jade")?.code, "HJ524M");
    assert.equal(nameOf("MU010"), "Evermoin Ultra Bright");
    assert.equal(nameOf("VD175"), "Dandelion");
  });
});
