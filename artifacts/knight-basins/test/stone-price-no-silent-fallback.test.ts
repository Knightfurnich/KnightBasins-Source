import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STONE_COLORS,
  UNKNOWN_STONE_TONE,
  findStoneColor,
  isUnknownStone,
  stoneColorByName,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  unknownStone,
} from "../src/data/catalog.ts";

// job-278: `stoneColorByName` used to end in `?? colors[0]`, and both price helpers went through it. An identifier
// that resolves to nothing — a typo, or a stone the database closed after job 277 such as V342 — was silently priced
// as the first row of the catalogue: Bright White, 7,500 a square metre, 5,900 a sheet. One square metre of Aria
// Whisper quoted that way is 4,500 baht short, and the paper carried no warning.
// What must hold now: unknown stays unknown, and a code the customer actually typed still prices exactly as before.

const GHOST_CODES = ["V342", "QS288", "BW10", "NA016", "WW001", "ZZZ999", "", "   "];

describe("an unknown stone code is never priced as another stone (job-278 ก)", () => {
  it("no price helper borrows the first row any more", () => {
    const firstRow = STONE_COLORS[0];
    for (const identifier of GHOST_CODES) {
      assert.equal(isUnknownStone(identifier), true, `${JSON.stringify(identifier)} must stay unknown`);
      assert.equal(stoneInstalledUnitPrice(identifier), null, `${JSON.stringify(identifier)} installed price`);
      for (const quantity of [1, 10, 50]) {
        assert.equal(stoneSheetUnitPrice(identifier, quantity), null, `${JSON.stringify(identifier)} @${quantity}`);
      }
      const borrowed = [firstRow.installedPriceTHB, firstRow.sheetPriceTHB];
      assert.equal(borrowed.includes(stoneInstalledUnitPrice(identifier)), false, "never the first row's price");
    }
  });

  it("the display lookup still returns a record, and it describes the identifier instead of a different stone", () => {
    const unknown = stoneColorByName("QQQ123");
    assert.equal(findStoneColor("QQQ123"), undefined);
    assert.equal(unknown.code, "QQQ123");
    assert.equal(unknown.name, "QQQ123");
    assert.notEqual(unknown.name, STONE_COLORS[0].name, "must not wear Bright White's name");
    assert.equal(unknown.sheetPriceTHB, null);
    assert.equal(unknown.installedPriceTHB, null);
    assert.equal(unknown.tone, UNKNOWN_STONE_TONE);
    assert.equal(stoneColorByName("").name, "ยังไม่ได้เลือกสีหิน", "nothing chosen reads as nothing chosen");
    assert.equal(unknownStone(" AB 12 ").code, "AB 12", "surrounding spaces are trimmed, nothing is invented");
  });
});

describe("a code the customer typed still prices as it always did (job-278 B)", () => {
  it("every shown stone keeps its own installed and sheet price", () => {
    for (const color of STONE_COLORS) {
      assert.equal(stoneInstalledUnitPrice(color.code), color.installedPriceTHB, `${color.code} installed`);
      assert.equal(stoneSheetUnitPrice(color.code, 1), color.sheetPriceTHB, `${color.code} sheet`);
    }
  });

  it("the numbers the owner confirmed by hand", () => {
    assert.equal(stoneInstalledUnitPrice("VW342"), 12000, "Aria Whisper, restored in job 277");
    assert.equal(stoneSheetUnitPrice("QS822N", 1), 8500);
    assert.equal(stoneSheetUnitPrice("QS822N", 10), 8300);
    assert.equal(stoneSheetUnitPrice("QS822N", 50), 8075);
    assert.equal(stoneSheetUnitPrice("BW010", 10), 5900, "the flat-price exception still has no volume discount");
    assert.equal(stoneSheetUnitPrice("BW010", 50), 5900);
    assert.equal(stoneSheetUnitPrice("NW013", 50), 4900);
    assert.equal(stoneSheetUnitPrice("VC110", 50), 11400, "12,000 - 5% for a stone that is not excluded");
    assert.equal(stoneInstalledUnitPrice("VD175"), null, "a known stone with no installed rate stays null, as before");
    assert.equal(stoneSheetUnitPrice("NB091", 1), null, "a known stone with no sheet rate stays null, as before");
  });

  it("aliases and punctuation still resolve to the same price as the canonical code", () => {
    const cases: Array<[string, string]> = [
      ["QS 822N", "QS822N"], ["QS822 N", "QS822N"], ["BR 816", "BR816O"], ["BR8160", "BR816O"],
      ["WH122", "WH112"], ["MU 010", "MU010"], ["VW 342", "VW342"], ["Aria Whisper", "VW342"],
    ];
    for (const [spelling, canonical] of cases) {
      assert.equal(stoneInstalledUnitPrice(spelling), stoneInstalledUnitPrice(canonical), `${spelling} installed`);
      assert.equal(stoneSheetUnitPrice(spelling, 12), stoneSheetUnitPrice(canonical, 12), `${spelling} @12`);
      assert.equal(stoneColorByName(spelling).code, canonical, `${spelling} names ${canonical}`);
    }
  });

  it("the pricing order runs codes before aliases, so a sibling cannot be borrowed", () => {
    const both = [
      { code: "V342", name: "Whisper", tone: "#d9d1c2", sheetPriceTHB: 12000, installedPriceTHB: 9500, documentCodes: ["VW342", "VW 342"] },
      { code: "VW342", name: "Aria Whisper", tone: "#d9d1c2", sheetPriceTHB: null, installedPriceTHB: 12000, documentCodes: ["VW 342"] },
    ];
    assert.equal(stoneInstalledUnitPrice("VW342", both), 12000);
    assert.equal(stoneInstalledUnitPrice("V342", both), 9500, "the other stone stays reachable by its own code");
    assert.equal(stoneInstalledUnitPrice("nope", both), null);
    assert.equal(stoneColorByName("nope", both).name, "nope", "and never resolves to Whisper or Aria Whisper");
  });
});
