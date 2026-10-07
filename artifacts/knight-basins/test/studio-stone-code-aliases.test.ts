import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STONE_COLORS,
  findStoneColor,
  reconcileStoneSelections,
  stoneColorByName,
  stoneColorMatchesQuery,
  stoneColorMatchesSelection,
  stoneColorsFromCatalog,
  stoneIdentifierKey,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  type CatalogStoneRecord,
  type StoneColor,
} from "../src/data/catalog.ts";

// job-260: one stone, many spellings. The approved aliases live in the catalogue (the aliases column, read as documentCodes);
// the comparison has to ignore spaces and punctuation so that "QS822N" finds the stone listed as "QS822 N". Letters and digits
// are never changed: KZ802 and KZ802N are two stones.

/** Rows shaped like the live /api/catalog answer (read on 4 Oct 2026) for the stones this job is about. */
function row(id: number, code: string, name: string, aliases: string[], price: number): CatalogStoneRecord & Record<string, unknown> {
  return { id, code, name, tone: "#888888", aliases, imageUrl: null, galleryImageUrls: [], quoteImageUrl: null, slabImageUrl: null, pricePerSqmTHB: price, basePriceTHB: price };
}
const LIVE_INSTALLED = [
  row(1, "MU010", "Evermoin Ultra Bright", ["MU 010"], 7500),
  row(2, "EG501", "Glaring White", ["EG 501"], 8500),
  row(3, "VW342", "Aria Whisper", ["VW342", "VW 342", "V342", "V 342"], 12000),
  row(4, "BR816O", "Black River", ["BR816", "BR 816", "BR8160", "BR 8160"], 9500),
  row(5, "KZ802", "Zen Autumn", [], 9500),
  row(6, "KZ802N", "Zen Autumn New", ["KZ802(N)", "KZ 802N"], 9500),
  row(7, "WH112", "Witch Hazel", ["WH122", "WH 122", "WH 112", "WH112"], 9500),
];
const LIVE_SHEET = [
  row(1, "MU010", "Evermoin Ultra Bright", ["MU 010"], 7500),
  row(2, "EG501", "Glaring White", ["EG 501"], 9000),
  row(3, "QS822N", "Quarry Starred", ["QS 822 N", "QS822 N", "QS 822N"], 8500),
  row(4, "BR816O", "Black River", ["BR816", "BR 816", "BR8160", "BR 8160"], 9500),
  row(5, "KZ802", "Zen Autumn", [], 9500),
  row(6, "KZ802N", "Zen Autumn New", ["KZ802(N)", "KZ 802N"], 9500),
  row(7, "WH112", "Witch Hazel", ["WH122", "WH 122", "WH 112", "WH112"], 9500),
  row(8, "QS822N", "Quarry Starred", ["QS 822 N", "QS822 N", "QS 822N"], 8500),
];
const live = stoneColorsFromCatalog(LIVE_INSTALLED, LIVE_SHEET);

/** The owner-approved spellings (work order 260), by the code the app shows. */
const GROUPS: Record<string, string[]> = {
  BR816O: ["BR816O", "BR816", "BR 816", "BR8160", "BR 8160"],
  WH112: ["WH112", "WH122", "WH 122", "WH 112"],
  QS822N: ["QS822N", "QS 822N", "QS822 N"],
  MU010: ["MU010", "MU 010"],
  EG501: ["EG501", "EG 501"],
};

/** Runs a price helper the way the app does after loading the live catalogue (the installed rate is read from STONE_COLORS). */
function withCatalog<T>(colors: ReadonlyArray<StoneColor>, calculate: () => T): T {
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...colors);
  try {
    return calculate();
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

describe("(ก) every approved spelling finds the stone the app shows", () => {
  it("live catalogue: BR816O, WH112, QS822N, MU010, EG501 groups", () => {
    for (const [shown, spellings] of Object.entries(GROUPS)) {
      for (const spelling of spellings) {
        assert.equal(findStoneColor(spelling, live)?.code, shown, `${spelling} -> ${shown}`);
        assert.equal(stoneColorByName(spelling, live).code, shown, spelling);
      }
    }
  });

  it("live catalogue: the Whisper group VW342 / VW 342 / V342 / V 342 is one stone", () => {
    for (const spelling of ["VW342", "VW 342", "V342", "V 342", "vw-342", "(V342)"]) {
      assert.equal(findStoneColor(spelling, live)?.code, "VW342", spelling);
    }
  });

  it("the catalogue in the code keeps its own codes and names: BR816O Black River, VW342 Aria Whisper, WH112 Witch Hazel, QS822N Quarry Starred", () => {
    const shown = (spelling: string) => { const color = findStoneColor(spelling, STONE_COLORS); return color && [color.code, color.name]; };
    assert.deepEqual(shown("BR 8160"), ["BR816O", "Black River"]);
    assert.deepEqual(shown("BR8160"), ["BR816O", "Black River"]);
    // job-277 changed the two Whisper lines: V342 is closed in the database, so it is no longer a stone the app can
    // show, and VW342 carries its own row. A code that names the closed stone stays unresolved rather than quietly
    // borrowing the sibling's identity — the owner's ruling was "what the database closes stays closed".
    assert.deepEqual(shown("VW-342"), ["VW342", "Aria Whisper"]);
    assert.deepEqual(shown("VW 342"), ["VW342", "Aria Whisper"]);
    assert.equal(findStoneColor("V 342", STONE_COLORS), undefined);
    assert.equal(findStoneColor("V342", STONE_COLORS), undefined);
    assert.deepEqual(shown("WH 122"), ["WH112", "Witch Hazel"]);
    assert.deepEqual(shown("QS 822N"), ["QS822N", "Quarry Starred"]);
    assert.deepEqual(shown("MU 010"), ["MU010", "Evermoin Ultra Bright"]);
  });

  it("spaces, brackets, dashes, dots and case do not matter; a spelling that matches as typed still wins first", () => {
    for (const spelling of ["qs822n", " QS822N ", "QS-822-N", "QS.822.N", "(QS 822N)", "QS 822N"]) {
      assert.equal(findStoneColor(spelling, live)?.code, "QS822N", JSON.stringify(spelling));
    }
    assert.equal(stoneIdentifierKey("KZ802(N)"), "kz802n");
    assert.equal(stoneIdentifierKey(" BR 816-O "), "br816o");
  });
});

describe("(ข) QS822N is the single Quarry Starred stone (owner decision 6 Oct 2026)", () => {
  it("QS822N / QS 822N / QS822 N all give one entry, QS822N, at 8,500 a sheet", () => {
    // The owner removed QS288 from the catalogue: QS822N is the only code for this stone,
    // its sheet price is 8,500 and it is also sold installed at 8,500 per sqm.
    const found = new Set(["QS822N", "QS 822N", "QS822 N"].map((spelling) => findStoneColor(spelling, live)));
    assert.equal(found.size, 1);
    const [color] = [...found];
    assert.equal(color?.code, "QS822N");
    assert.equal(color?.name, "Quarry Starred");
    for (const spelling of ["QS822N", "QS 822N", "QS822 N"]) {
      assert.equal(stoneSheetUnitPrice(spelling, 1, live), 8500, spelling);
      assert.equal(stoneInstalledUnitPrice(spelling), 8500, spelling);
    }
    assert.equal(live.filter((color) => color.name === "Quarry Starred").length, 1);
  });

  it("prices the sheet tiers the owner confirmed: 8,500 · 8,300 from 10 sheets · 8,075 from 50", () => {
    withCatalog(live, () => {
      assert.equal(stoneSheetUnitPrice("QS822N", 1), 8500);
      assert.equal(stoneSheetUnitPrice("QS822N", 9), 8500);
      assert.equal(stoneSheetUnitPrice("QS822N", 10), 8300);
      assert.equal(stoneSheetUnitPrice("QS822N", 49), 8300);
      assert.equal(stoneSheetUnitPrice("QS822N", 50), 8075);
    });
  });

  it("the old QS288 code is gone: it no longer finds a stone", () => {
    for (const spelling of ["QS288", "QS 288", "qs288"]) {
      assert.equal(findStoneColor(spelling, live), undefined, spelling);
      assert.equal(findStoneColor(spelling, STONE_COLORS), undefined, spelling);
    }
  });

  it("a saved selection written QS822N is kept and stored as QS822N", () => {
    const { active, hidden } = reconcileStoneSelections(
      [{ id: "s1", color: "QS822N", mode: "whole-sheet", sheets: 2 } as never],
      { "whole-sheet": live, installed: live },
    );
    assert.equal(hidden.length, 0);
    assert.equal(active[0]?.color, "QS822N");
    assert.equal(stoneColorMatchesSelection(live.find((color) => color.code === "QS822N")!, "QS822N"), true);
  });

  it("the search box finds QS822N when typing qs822n or qs 822n, and no longer matches qs288", () => {
    const qs = live.find((color) => color.code === "QS822N")!;
    for (const query of ["qs822n", "QS 822N", "822n", "qs 822 n"]) assert.equal(stoneColorMatchesQuery(qs, query), true, query);
    assert.equal(stoneColorMatchesQuery(qs, "qs288"), false);
    assert.equal(stoneColorMatchesQuery(live.find((color) => color.code === "KZ802")!, "kz802n"), false);
  });
});

describe("(ค) WH112 and WH122 are one price", () => {
  it("typing WH112 or WH122 (any spacing) gives the same sheet and installed price", () => {
    withCatalog(live, () => {
      for (const spelling of GROUPS["WH112"]!) {
        assert.equal(stoneSheetUnitPrice(spelling, 1, live), stoneSheetUnitPrice("WH122", 1, live), spelling);
        assert.equal(stoneInstalledUnitPrice(spelling), stoneInstalledUnitPrice("WH122"), spelling);
        assert.equal(stoneInstalledUnitPrice(spelling), 9500, spelling);
      }
    });
  });
});

describe("(ง) the catalogue counts and every alias prices as its group", () => {
  it("the catalogue in the code has 64 colours with a sheet price, and no WR815", () => {
    // job-277: the count follows the database — 9 of the closed codes carried a sheet price, so 73 became 64.
    assert.equal(STONE_COLORS.filter((color) => color.sheetPriceTHB !== null).length, 64);
    assert.equal(STONE_COLORS.some((color) => stoneIdentifiers(color).some((value) => stoneIdentifierKey(value) === "wr815")), false);
  });

  it("every alias, in both contexts (sheet and installed), gives the price of the stone it belongs to", () => {
    for (const colors of [live, STONE_COLORS]) {
      withCatalog(colors, () => {
        for (const color of colors) {
          for (const spelling of [color.code, ...color.documentCodes]) {
            const found = findStoneColor(spelling, colors)!;
            assert.equal(stoneSheetUnitPrice(spelling, 1, colors), found.sheetPriceTHB, `${spelling} sheet`);
            assert.equal(stoneInstalledUnitPrice(spelling), found.installedPriceTHB, `${spelling} installed`);
            if (found.code !== color.code) assert.equal(found.name, color.name, `${spelling} found another stone with another name`);
          }
        }
      });
    }
  });

  it("taking out punctuation does not make two different stones meet, in either catalogue (beyond the shared name Quarry Starred in the code's own list)", () => {
    for (const colors of [live, STONE_COLORS]) {
      const owners = new Map<string, Set<string>>();
      for (const color of colors) {
        for (const value of [color.name, color.code, ...color.documentCodes]) {
          const key = stoneIdentifierKey(value);
          owners.set(key, (owners.get(key) ?? new Set()).add(color.code));
        }
      }
      const shared = [...owners].filter(([, codes]) => codes.size > 1).map(([key, codes]) => `${key}:${[...codes].join("/")}`);
      assert.deepEqual(shared, [], "one code per stone in both catalogues");
    }
  });
});

describe("no catch-all rule: letters and digits are never dropped or swapped", () => {
  it("KZ802 and KZ802N stay two stones, whatever the spacing", () => {
    for (const colors of [live, STONE_COLORS]) {
      assert.equal(findStoneColor("KZ802", colors)?.code, "KZ802");
      assert.equal(findStoneColor("KZ 802", colors)?.code, "KZ802");
      assert.equal(findStoneColor("KZ802N", colors)?.code, "KZ802N");
      assert.equal(findStoneColor("KZ 802 N", colors)?.code, "KZ802N");
      assert.equal(findStoneColor("KZ802(N)", colors)?.code, "KZ802N");
      assert.equal(stoneColorMatchesSelection(colors.find((color) => color.code === "KZ802")!, "KZ802N"), false);
    }
  });

  it("no O-for-0 and no dropped letters: spellings that are not approved find nothing", () => {
    for (const spelling of ["KZ8O2", "BR8l6O", "WH11", "QS822", "QS28", "EG5O1", "MU01O", "Z802N", ""]) {
      assert.equal(findStoneColor(spelling, live), undefined, spelling);
    }
  });
});

function stoneIdentifiers(color: StoneColor) {
  return [color.name, color.code, ...color.documentCodes];
}
