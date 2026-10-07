import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ALL_STONE_COLORS,
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
