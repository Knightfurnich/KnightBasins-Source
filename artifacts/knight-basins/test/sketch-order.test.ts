import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASIN_PRODUCTS, PRODUCTS, STONE_COLORS, TALL_PRODUCTS, stoneColorByName, stoneInstalledUnitPrice, stoneSheetUnitPrice } from "../src/data/catalog.ts";
import {
  DEFAULT_SKETCH_FULFILMENT,
  DEFAULT_SKETCH_ORDER_TYPE,
  SKETCH_FULFILMENTS,
  SKETCH_BASIN_NOT_IN_CATALOG,
  SKETCH_NO_STONE_MESSAGE,
  SKETCH_OWN_BASIN,
  SKETCH_OWN_BASIN_NO_SIZE_NOTE,
  SKETCH_OWN_BASIN_WARNING,
  cleanOwnBasinSize,
  parseSketchMm,
  quoteSketchOrder,
  quoteSketchPiece,
  resolveSketchPiece,
  sketchBasinChoices,
  sketchBasinCutout,
  sketchOrderFromSnapshot,
  sketchOrderNotification,
  sketchOrderSnapshot,
  sketchPieceReady,
  sketchStoneChoices,
  type SketchPieceBase,
} from "../src/data/sketch-order.ts";

// job-256: the customer-facing rules of the /sketch order flow, tested on the pure functions the page is built from.

const fabricationStone = STONE_COLORS.find((color) => color.installedPriceTHB !== null && color.sheetPriceTHB !== null)!;
const base: SketchPieceBase = {
  key: "f1-0",
  label: "ชิ้นงาน 1",
  lengthMm: 1700,
  depthMm: 600,
  panels: [],
  basinCutouts: 1,
};
const withPanels: SketchPieceBase = {
  ...base,
  key: "f1-1",
  label: "ชิ้นงาน 2",
  panels: [
    { index: 1, label: "ด้านหลัง", lengthMm: 2200, depthMm: 700 },
    { index: 2, label: "ด้านข้าง", lengthMm: 1300, depthMm: 800 },
  ],
};

describe("(ก) editing a size changes the area", () => {
  it("shows the area of the size the AI read, then the area of the size the customer typed", () => {
    assert.equal(resolveSketchPiece(base).areaSqM, 1.02);
    assert.equal(resolveSketchPiece(base, { lengthText: "2000" }).areaSqM, 1.2);
    assert.equal(resolveSketchPiece(base, { lengthText: "2000", depthText: "650" }).areaSqM, 1.3);
  });

  it("a piece with panels is measured by its panels: editing one panel moves the area", () => {
    const before = resolveSketchPiece(withPanels);
    assert.ok(Math.abs(before.areaSqM! - (2.2 * 0.7 + 1.3 * 0.8)) < 1e-9);
    const after = resolveSketchPiece(withPanels, { panels: { 2: { lengthText: "1500" } } });
    assert.ok(Math.abs(after.areaSqM! - (2.2 * 0.7 + 1.5 * 0.8)) < 1e-9);
    assert.ok(after.areaSqM! > before.areaSqM!);
  });

  it("the edited value, not the AI value, is what the price is built from", () => {
    const context = { orderType: "fabrication" as const };
    const edited = resolveSketchPiece(base, { lengthText: "3000", stoneCode: fabricationStone.code });
    const original = resolveSketchPiece(base, { stoneCode: fabricationStone.code });
    const editedQuote = quoteSketchPiece(edited, context);
    const originalQuote = quoteSketchPiece(original, context);
    assert.equal(editedQuote.status, "ok");
    assert.equal(originalQuote.status, "ok");
    if (editedQuote.status === "ok" && originalQuote.status === "ok") {
      assert.equal(editedQuote.areaSqM, 1.8);
      assert.ok(editedQuote.stoneTotalTHB > originalQuote.stoneTotalTHB);
    }
  });
});

describe("(ข) no stone yet: no price", () => {
  it("says ยังไม่เลือกสีหิน and carries no amount at all", () => {
    const quote = quoteSketchPiece(resolveSketchPiece(base), { orderType: "fabrication" });
    assert.deepEqual(quote, { status: "no-stone", message: SKETCH_NO_STONE_MESSAGE });
    assert.equal(SKETCH_NO_STONE_MESSAGE, "ยังไม่เลือกสีหิน");
    assert.equal("totalTHB" in quote, false);
  });

  it("the order total counts only the pieces that have a stone", () => {
    const pieces = [resolveSketchPiece(base, { stoneCode: fabricationStone.code }), resolveSketchPiece(withPanels)];
    const quote = quoteSketchOrder(pieces, { orderType: "fabrication" });
    assert.equal(quote.pricedCount, 1);
    assert.equal(quote.allPriced, false);
    assert.equal(quote.pieces[1]?.quote.status, "no-stone");
  });

  it("a piece is not ready to send until it has a stone", () => {
    assert.equal(sketchPieceReady(resolveSketchPiece(base), "fabrication"), false);
    assert.equal(sketchPieceReady(resolveSketchPiece(base, { stoneCode: fabricationStone.code }), "fabrication"), true);
  });
});

describe("(ค) a stone per piece, and each piece is priced by its own stone", () => {
  it("two pieces with different stones get different prices from the system calculator", () => {
    const cheap = STONE_COLORS.filter((color) => color.installedPriceTHB !== null).sort((a, b) => a.installedPriceTHB! - b.installedPriceTHB!)[0]!;
    const dear = STONE_COLORS.filter((color) => color.installedPriceTHB !== null).sort((a, b) => b.installedPriceTHB! - a.installedPriceTHB!)[0]!;
    assert.notEqual(cheap.installedPriceTHB, dear.installedPriceTHB);
    const same = { ...base, basinCutouts: 0 };
    const pieces = [
      resolveSketchPiece({ ...same, key: "a", label: "ชิ้นงาน A" }, { stoneCode: cheap.code }),
      resolveSketchPiece({ ...same, key: "b", label: "ชิ้นงาน B" }, { stoneCode: dear.code }),
    ];
    const quote = quoteSketchOrder(pieces, { orderType: "fabrication" });
    const [first, second] = quote.pieces.map((entry) => entry.quote);
    assert.equal(first?.status, "ok");
    assert.equal(second?.status, "ok");
    if (first?.status === "ok" && second?.status === "ok") {
      assert.equal(first.unitPriceTHB, stoneInstalledUnitPrice(cheap.code));
      assert.equal(second.unitPriceTHB, stoneInstalledUnitPrice(dear.code));
      assert.ok(second.stoneTotalTHB > first.stoneTotalTHB);
      assert.equal(quote.stoneTotalTHB, first.stoneTotalTHB + second.stoneTotalTHB);
    }
    assert.equal(quote.allPriced, true);
  });

  it("picking a stone for one piece leaves the other piece without a price", () => {
    const quote = quoteSketchOrder(
      [resolveSketchPiece({ ...base, key: "a" }, { stoneCode: fabricationStone.code }), resolveSketchPiece({ ...base, key: "b" })],
      { orderType: "fabrication" },
    );
    assert.equal(quote.pieces[0]?.quote.status, "ok");
    assert.equal(quote.pieces[1]?.quote.status, "no-stone");
  });
});

describe("(ง) a bad value warns and never throws", () => {
  const bad = ["", "   ", "abc", "12.5", "-300", "0", "1e3", "٣٠٠", "99999999999999999999", "10001"];
  for (const text of bad) {
    it(`"${text}" is refused with a warning`, () => {
      assert.equal(parseSketchMm(text), null);
      const piece = resolveSketchPiece(base, { lengthText: text, stoneCode: fabricationStone.code });
      assert.ok(piece.lengthWarning, "a warning shows under the box");
      assert.equal(piece.areaSqM, null);
      assert.equal(piece.sizeValid, false);
      let quote;
      assert.doesNotThrow(() => { quote = quoteSketchPiece(piece, { orderType: "fabrication" }); });
      assert.equal((quote as unknown as { status: string }).status, "invalid");
      assert.equal(sketchPieceReady(piece, "fabrication"), false);
    });
  }

  it("a bad panel size warns on that panel and blocks the piece, without a price or a throw", () => {
    const piece = resolveSketchPiece(withPanels, { panels: { 1: { depthText: "seven" } }, stoneCode: fabricationStone.code });
    assert.ok(piece.panels[0]?.depthWarning);
    assert.equal(piece.panels[1]?.depthWarning, null);
    assert.equal(piece.areaSqM, null);
    assert.equal(quoteSketchPiece(piece, { orderType: "fabrication" }).status, "invalid");
  });

  it("whole numbers are accepted, including with spaces around them", () => {
    assert.equal(parseSketchMm(" 1700 "), 1700);
    assert.equal(parseSketchMm("1"), 1);
    assert.equal(parseSketchMm("10000"), 10000);
  });
});

describe("(จ) a basin per cut-out, with the real cut-out size", () => {
  it("offers KF001 to KF030, all thirty", () => {
    const choices = sketchBasinChoices(PRODUCTS);
    assert.equal(choices.length, 30);
    assert.equal(choices[0]?.sku, "KF001");
    assert.equal(choices[29]?.sku, "KF030");
    assert.deepEqual(choices.map((product) => product.sku), Array.from({ length: 30 }, (_, index) => `KF${String(index + 1).padStart(3, "0")}`));
    assert.equal(BASIN_PRODUCTS.length + TALL_PRODUCTS.length, 30);
  });

  it("a rectangular bowl uses the catalogue's own size (KF001 350 x 500 x 130, KF011 400 x 500 x 130, KF027 370 x 570 x 150)", () => {
    const size = (sku: string) => sketchBasinCutout(PRODUCTS.find((product) => product.sku === sku)!);
    assert.deepEqual(size("KF001"), { label: "350x500x130", specified: true, round: false, widthMm: 350, depthMm: 500, bowlDepthMm: 130 });
    assert.equal(size("KF011").label, "400x500x130");
    assert.equal(size("KF027").label, "370x570x150");
    assert.equal(size("KF019").label, "350x350x150");
  });

  it("a round bowl is written Ø350x150, never D350x150 (KF023 to KF026)", () => {
    for (const sku of ["KF023", "KF024", "KF025", "KF026"]) {
      const product = PRODUCTS.find((item) => item.sku === sku)!;
      assert.match(product.basinDimensions ?? "", /Ø/, `${sku} is round in the catalogue`);
      const cutout = sketchBasinCutout(product);
      assert.equal(cutout.label, "Ø350x150");
      assert.ok(cutout.label.startsWith("Ø"));
      assert.doesNotMatch(cutout.label, /^D\d/);
      assert.equal(cutout.round, true);
      assert.equal(cutout.widthMm, 350);
      assert.equal(cutout.depthMm, 350);
      assert.equal(cutout.bowlDepthMm, 150);
    }
  });

  it("only the Ø sign makes a bowl round: a catalogue string written with D is read as a rectangle, not guessed round", () => {
    assert.equal(sketchBasinCutout({ basinDimensions: "D350 × 150 mm" }).round, false);
    assert.equal(sketchBasinCutout({ basinDimensions: "ø300 × 120 mm" }).label, "Ø300x120");
  });

  it("KF029 and KF030 have no bowl size in the catalogue and are shown as แคตตาล็อกไม่ระบุ, with no numbers", () => {
    for (const sku of ["KF029", "KF030"]) {
      const cutout = sketchBasinCutout(PRODUCTS.find((product) => product.sku === sku)!);
      assert.equal(cutout.label, SKETCH_BASIN_NOT_IN_CATALOG);
      assert.equal(SKETCH_BASIN_NOT_IN_CATALOG, "แคตตาล็อกไม่ระบุ");
      assert.equal(cutout.specified, false);
      assert.equal(cutout.widthMm, null);
      assert.equal(cutout.depthMm, null);
      assert.equal(cutout.bowlDepthMm, null);
    }
  });

  it("the chosen basin and its cut-out size go to the sales team in the order snapshot, one entry per cut-out", () => {
    const piece = resolveSketchPiece({ ...base, basinCutouts: 3 }, { stoneCode: fabricationStone.code, basinSkus: ["KF023", "KF029", null] });
    assert.equal(piece.basinSkus.length, 3);
    const snapshot = sketchOrderSnapshot([piece], { orderType: "fabrication" }) as { pieces: Array<{ cutouts: Array<Record<string, unknown>> }> };
    const cutouts = snapshot.pieces[0]!.cutouts;
    assert.equal(cutouts[0]?.sku, "KF023");
    assert.equal(cutouts[0]?.size, "Ø350x150");
    assert.equal(cutouts[0]?.round, true);
    assert.equal(cutouts[1]?.sku, "KF029");
    assert.equal(cutouts[1]?.size, "แคตตาล็อกไม่ระบุ");
    assert.equal(cutouts[1]?.widthMm, null);
    assert.equal(cutouts[2]?.sku, null);
  });

  it("a basin picked for a piece is priced into that piece by the system estimate (its installation is the job's, job-259)", () => {
    const without = quoteSketchPiece(resolveSketchPiece({ ...base, basinCutouts: 1 }, { stoneCode: fabricationStone.code }), { orderType: "fabrication" });
    const picked = quoteSketchPiece(resolveSketchPiece({ ...base, basinCutouts: 1 }, { stoneCode: fabricationStone.code, basinSkus: ["KF001"] }), { orderType: "fabrication" });
    assert.equal(without.status, "ok");
    assert.equal(picked.status, "ok");
    if (without.status === "ok" && picked.status === "ok") {
      assert.equal(without.basinTotalTHB, 0);
      assert.equal(picked.basinTotalTHB, PRODUCTS.find((product) => product.sku === "KF001")!.priceTHB);
      assert.ok(picked.lineTotalTHB > without.lineTotalTHB);
      assert.equal(picked.basinSets, 1);
    }
  });
});

describe("(ฉ) order type: installed top by default, standard sheets as the second choice", () => {
  it("starts as installed (fabrication, THB per square metre)", () => {
    assert.equal(DEFAULT_SKETCH_ORDER_TYPE, "fabrication");
  });

  it("the colour list follows the order type: sheets and installed tops each list exactly the colours that have a price of that type (this catalogue: 64 sheet, 65 installed)", () => {
    const installed = sketchStoneChoices("fabrication");
    const sheets = sketchStoneChoices("sheet");
    // job-277: STONE_COLORS is now the stones the database sells, so the count moved from 73/71 to 64/65 — 9 closed
    // codes carried a sheet price and 4 more carried only a sheet price, while Aria Whisper (VW342) came back with an
    // installed rate of 12,000. The work order's "74 sheet colours" prediction still does not hold for this checkout.
    assert.equal(sheets.length, STONE_COLORS.filter((color) => color.sheetPriceTHB !== null).length);
    assert.equal(sheets.length, 64);
    assert.equal(installed.length, 65);
    assert.ok(installed.every((color) => color.installedPriceTHB !== null));
    assert.ok(sheets.every((color) => color.sheetPriceTHB !== null));
    assert.ok(installed.length !== sheets.length);
  });

  it("an installed top is priced per square metre from the area", () => {
    const quote = quoteSketchPiece(resolveSketchPiece({ ...base, basinCutouts: 0 }, { stoneCode: fabricationStone.code }), { orderType: "fabrication" });
    assert.equal(quote.status, "ok");
    if (quote.status === "ok") {
      assert.equal(quote.sheets, null);
      assert.equal(quote.unitPriceTHB, fabricationStone.installedPriceTHB);
      assert.equal(quote.areaSqM, 1.02);
    }
  });

  it("switching to standard sheets prices per sheet from the sheet count, not from the area", () => {
    const code = fabricationStone.code;
    const one = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: code, sheetsText: "1" }), { orderType: "sheet" });
    const three = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: code, sheetsText: "3" }), { orderType: "sheet" });
    const bigger = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: code, sheetsText: "3", lengthText: "5000" }), { orderType: "sheet" });
    assert.equal(one.status, "ok");
    assert.equal(three.status, "ok");
    assert.equal(bigger.status, "ok");
    if (one.status === "ok" && three.status === "ok" && bigger.status === "ok") {
      assert.equal(one.unitPriceTHB, stoneSheetUnitPrice(code, 1));
      assert.equal(one.stoneTotalTHB, fabricationStone.sheetPriceTHB);
      assert.equal(three.sheets, 3);
      assert.equal(three.unitPriceTHB, stoneSheetUnitPrice(code, 3));
      assert.equal(three.lineTotalTHB, three.unitPriceTHB * 3);
      assert.equal(bigger.lineTotalTHB, three.lineTotalTHB, "the size does not change a per-sheet price");
      assert.notEqual(one.unitPriceTHB, fabricationStone.installedPriceTHB, "per sheet, not per square metre");
    }
  });

  it("ten sheets or more get the system's volume price", () => {
    const code = STONE_COLORS.find((color) => color.sheetPriceTHB !== null && !["BW010", "NW013"].includes(color.code))!.code;
    const ten = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: code, sheetsText: "10" }), { orderType: "sheet" });
    assert.equal(ten.status, "ok");
    if (ten.status === "ok") assert.equal(ten.unitPriceTHB, stoneSheetUnitPrice(code, 10));
    assert.ok(stoneSheetUnitPrice(code, 10)! < stoneSheetUnitPrice(code, 1)!);
  });

  it("a bad sheet count warns and gives no price", () => {
    for (const text of ["", "0", "1.5", "x", "1000"]) {
      const quote = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: fabricationStone.code, sheetsText: text }), { orderType: "sheet" });
      assert.equal(quote.status, "invalid", text);
    }
    assert.equal(sketchPieceReady(resolveSketchPiece(base, { stoneCode: fabricationStone.code, sheetsText: "0" }), "sheet"), false);
  });

  it("a colour that has no price for the chosen type gets no price (not 0)", () => {
    const installedOnly = STONE_COLORS.find((color) => color.sheetPriceTHB === null && color.installedPriceTHB !== null);
    if (installedOnly) {
      const quote = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: installedOnly.code }), { orderType: "sheet" });
      assert.equal(quote.status, "no-price");
    }
    const sheetOnly = STONE_COLORS.find((color) => color.installedPriceTHB === null && color.sheetPriceTHB !== null);
    assert.ok(sheetOnly, "the catalogue has colours sold only as sheets");
    const quote = quoteSketchPiece(resolveSketchPiece(base, { stoneCode: sheetOnly.code }), { orderType: "fabrication" });
    assert.equal(quote.status, "no-price");
    assert.equal(stoneColorByName(sheetOnly.code).installedPriceTHB, null);
  });

  it("the order snapshot records the type, the sheet count and the confirmed sizes", () => {
    const piece = resolveSketchPiece(base, { stoneCode: fabricationStone.code, sheetsText: "4", lengthText: "1800" });
    const snapshot = sketchOrderSnapshot([piece], { orderType: "sheet" }) as { orderType: string; pieces: Array<{ sheets: number; lengthMm: number; stoneCode: string }> };
    assert.equal(snapshot.orderType, "sheet");
    assert.equal(snapshot.pieces[0]?.sheets, 4);
    assert.equal(snapshot.pieces[0]?.lengthMm, 1800);
    assert.equal(snapshot.pieces[0]?.stoneCode, fabricationStone.code);
  });
});

describe("(ญ) the customer buys the basin elsewhere", () => {
  const context = { orderType: "fabrication" as const };
  const ownSnapshot = (ownBasinSizes: Record<number, string>) => {
    const piece = resolveSketchPiece({ ...base, basinCutouts: 1 }, { stoneCode: fabricationStone.code, basinSkus: [SKETCH_OWN_BASIN], ownBasinSizes });
    return { piece, snapshot: sketchOrderSnapshot([piece], context) as { totalTHB: number; pieces: Array<{ cutouts: Array<Record<string, unknown>> }> } };
  };

  it("a quote can be issued whether or not a hole size is typed: the piece is ready and priced both ways", () => {
    for (const sizes of [{}, { 0: "350x500" }, { 0: "   " }]) {
      const { piece } = ownSnapshot(sizes);
      assert.equal(sketchPieceReady(piece, "fabrication"), true);
      assert.equal(quoteSketchPiece(piece, context).status, "ok");
    }
  });

  it("no basin price and no installation charge is added for a basin the customer buys themselves", () => {
    const { piece } = ownSnapshot({ 0: "350x500" });
    const quote = quoteSketchOrder([piece], context);
    const noBasinAtAll = quoteSketchOrder([resolveSketchPiece({ ...base, basinCutouts: 0 }, { stoneCode: fabricationStone.code })], context);
    assert.equal(quote.allPriced, true);
    assert.equal(quote.basinTotalTHB, 0);
    assert.equal(quote.basinSets, 0);
    assert.equal(quote.requestedInstallationTHB, 0);
    assert.equal(quote.installationTHB, 0);
    assert.equal(quote.totalTHB, noBasinAtAll.totalTHB);
  });

  it("a size typed becomes the hole size and carries the warning that it must match the customer's own basin", () => {
    const { snapshot } = ownSnapshot({ 0: " 350  x 500 " });
    const cutout = snapshot.pieces[0]!.cutouts[0]!;
    assert.equal(cutout.ownBasin, true);
    assert.equal(cutout.sku, null);
    assert.equal(cutout.size, "350 x 500");
    assert.equal(cutout.note, SKETCH_OWN_BASIN_WARNING);
    assert.equal(SKETCH_OWN_BASIN_WARNING, "ต้องตรงกับอ่างที่ลูกค้าซื้อมาเอง");
  });

  it("no size typed: the note is ยังไม่ระบุขนาดหลุมเจาะ (ยืนยันก่อนผลิต) and nothing is invented", () => {
    for (const sizes of [{}, { 0: "" }, { 0: "   " }]) {
      const cutout = ownSnapshot(sizes).snapshot.pieces[0]!.cutouts[0]!;
      assert.equal(cutout.size, null);
      assert.equal(cutout.note, SKETCH_OWN_BASIN_NO_SIZE_NOTE);
      assert.equal(cutout.widthMm, undefined);
    }
    assert.equal(SKETCH_OWN_BASIN_NO_SIZE_NOTE, "ยังไม่ระบุขนาดหลุมเจาะ (ยืนยันก่อนผลิต)");
  });

  it("the hole size is optional text: whatever is typed gives no error, no warning field and no throw", () => {
    for (const text of ["abc", "-5", "12.5", "<script>", "x".repeat(500), " "]) {
      assert.doesNotThrow(() => cleanOwnBasinSize(text));
      const { piece } = ownSnapshot({ 0: text });
      assert.equal(sketchPieceReady(piece, "fabrication"), true);
    }
    assert.ok((cleanOwnBasinSize("x".repeat(500)) ?? "").length <= 60);
    assert.doesNotMatch(cleanOwnBasinSize("a<b>c") ?? "", /[<>]/);
  });

  it("mixing: one catalogue basin and one of the customer's own: only the catalogue one is priced", () => {
    const piece = resolveSketchPiece({ ...base, basinCutouts: 2 }, { stoneCode: fabricationStone.code, basinSkus: ["KF001", SKETCH_OWN_BASIN] });
    const quote = quoteSketchPiece(piece, context);
    assert.equal(quote.status, "ok");
    if (quote.status === "ok") assert.equal(quote.basinTotalTHB, PRODUCTS.find((product) => product.sku === "KF001")!.priceTHB);
  });

  it("an own-basin quote can also be a sheet order (no basin in the sheet price either way)", () => {
    const piece = resolveSketchPiece({ ...base, basinCutouts: 1 }, { stoneCode: fabricationStone.code, basinSkus: [SKETCH_OWN_BASIN], sheetsText: "2" });
    assert.equal(quoteSketchPiece(piece, { orderType: "sheet" }).status, "ok");
  });
});

// job-259: the order is priced as one job. Each piece at its own colour's rate; the service charges once over the whole order
// (Knight Basins' conditions as the owner confirmed them on 4 Oct 2026); collecting at the factory removes them.
describe("job-259: one job, not one price per piece", () => {
  const installed = STONE_COLORS.filter((color) => color.installedPriceTHB !== null);
  const stoneA = installed[0]!;
  const stoneB = installed.find((color) => color.installedPriceTHB !== stoneA.installedPriceTHB)!;
  const fab = { orderType: "fabrication" as const };
  /** A rectangular piece of `lengthMm` x `depthMm` with the given stone and basin models. */
  const piece = (key: string, lengthMm: number, depthMm: number, stoneCode: string, basinSkus: string[] = []) =>
    resolveSketchPiece({ key, label: `ชิ้นงาน ${key}`, lengthMm, depthMm, panels: [], basinCutouts: basinSkus.length }, { stoneCode, basinSkus });
  const serviceLines = (items: Array<{ code: string }>, code: string) => items.filter((item) => item.code === code);

  it("(ก) two pieces of 2 m2 each (4 m2 in all, Bangkok): the small-job fee is ฿5,000 once, not ฿10,000", () => {
    const pieces = [piece("A", 2000, 1000, stoneA.code), piece("B", 2000, 1000, stoneA.code)];
    const quote = quoteSketchOrder(pieces, { ...fab, location: "bangkok-metro" });
    assert.equal(quote.areaSqM, 4);
    assert.equal(quote.smallJobFeeTHB, 5000);
    assert.equal(quote.totalTHB, quote.stoneTotalTHB + 5000);
    const notification = sketchOrderNotification(pieces, { ...fab, location: "bangkok-metro" });
    assert.equal(serviceLines(notification.items, "SMALL-JOB-FEE").length, 1);
    assert.equal(serviceLines(notification.items, "SMALL-JOB-FEE")[0]!.totalTHB, 5000);
  });

  it("(ก) the minimum is the whole job's area: 3 m2 + 3 m2 = 6 m2 in Bangkok pays no small-job fee", () => {
    const quote = quoteSketchOrder([piece("A", 3000, 1000, stoneA.code), piece("B", 3000, 1000, stoneA.code)], fab);
    assert.equal(quote.areaSqM, 6);
    assert.equal(quote.smallJobFeeTHB, 0);
  });

  it("(ก) province: 10 m2 minimum, ฿8,000 once below it (8 m2 over two pieces), nothing at 10 m2", () => {
    const below = quoteSketchOrder([piece("A", 4000, 1000, stoneA.code), piece("B", 4000, 1000, stoneA.code)], { ...fab, location: "province" });
    assert.equal(below.smallJobFeeTHB, 8000);
    const at = quoteSketchOrder([piece("A", 5000, 1000, stoneA.code), piece("B", 5000, 1000, stoneA.code)], { ...fab, location: "province" });
    assert.equal(at.smallJobFeeTHB, 0);
  });

  it("(ข) three basin sets spread over three pieces: installation is free (counted over the whole job)", () => {
    const pieces = [piece("A", 2000, 600, stoneA.code, ["KF001"]), piece("B", 2000, 600, stoneA.code, ["KF002"]), piece("C", 2000, 600, stoneA.code, ["KF003"])];
    const quote = quoteSketchOrder(pieces, fab);
    assert.equal(quote.basinSets, 3);
    assert.equal(quote.requestedInstallationTHB, 15000);
    assert.equal(quote.installationDiscountTHB, 15000);
    assert.equal(quote.installationTHB, 0);
    const line = serviceLines(sketchOrderNotification(pieces, fab).items, "INSTALL-BASIN");
    assert.equal(line.length, 1);
    assert.equal(line[0]!.totalTHB, 0);
  });

  it("(ข2) two basin sets over two pieces: ฿5,000 a set = ฿10,000", () => {
    const quote = quoteSketchOrder([piece("A", 2000, 600, stoneA.code, ["KF001"]), piece("B", 2000, 600, stoneA.code, ["KF002"])], fab);
    assert.equal(quote.basinSets, 2);
    assert.equal(quote.installationTHB, 10000);
    assert.equal(quote.installationDiscountTHB, 0);
  });

  it("(ค) two pieces in two colours: each piece at its own colour's rate, and the order adds them up", () => {
    const a = piece("A", 3000, 1000, stoneA.code);
    const b = piece("B", 3000, 1000, stoneB.code);
    const quote = quoteSketchOrder([a, b], fab);
    const [first, second] = quote.pieces.map((entry) => entry.quote);
    assert.ok(first?.status === "ok" && second?.status === "ok");
    if (first?.status === "ok" && second?.status === "ok") {
      assert.equal(first.stoneTotalTHB, Math.round(3 * stoneInstalledUnitPrice(stoneA.code)!));
      assert.equal(second.stoneTotalTHB, Math.round(3 * stoneInstalledUnitPrice(stoneB.code)!));
      assert.equal(quote.stoneTotalTHB, first.stoneTotalTHB + second.stoneTotalTHB);
      assert.equal(quote.totalTHB, first.lineTotalTHB + second.lineTotalTHB + quote.installationTHB + quote.smallJobFeeTHB + quote.vatTHB);
    }
  });

  it("(ง) the notification carries the order's own total under the keys the sales message reads (subtotal / vatAmount / total)", () => {
    const pieces = [piece("A", 2000, 600, stoneA.code, ["KF001"]), piece("B", 1500, 600, stoneB.code, ["KF002", "KF003"])];
    for (const vat of [false, true]) {
      const context = { ...fab, vat };
      const quote = quoteSketchOrder(pieces, context);
      const notification = sketchOrderNotification(pieces, context);
      assert.equal(notification.total, quote.totalTHB);
      assert.equal(notification.subtotal, quote.subtotalTHB);
      assert.equal(notification.vatAmount, quote.vatTHB);
      assert.equal(notification.items.reduce((sum, item) => sum + item.totalTHB, 0), quote.subtotalTHB, "the lines add up to the subtotal");
      const snapshot = sketchOrderSnapshot(pieces, context) as { totalTHB: number; totals: { totalTHB: number } };
      assert.equal(snapshot.totalTHB, quote.totalTHB);
      assert.equal(snapshot.totals.totalTHB, quote.totalTHB);
      if (vat) assert.equal(quote.vatTHB, Math.round(quote.subtotalTHB * 0.07));
    }
  });

  it("(ง) the saved snapshot prices back to the same total (what the server does with it)", () => {
    const pieces = [
      piece("A", 2400, 650, stoneA.code, ["KF001"]),
      resolveSketchPiece({ ...withPanels, basinCutouts: 2 }, { stoneCode: stoneB.code, basinSkus: ["KF023", SKETCH_OWN_BASIN] }),
    ];
    for (const context of [{ ...fab, vat: true }, { ...fab, location: "province" as const }, { ...fab, pickup: true }]) {
      const snapshot = sketchOrderSnapshot(pieces, context);
      const order = sketchOrderFromSnapshot(snapshot)!;
      const again = quoteSketchOrder(order.pieces, { orderType: order.orderType, location: order.location, vat: order.vat, pickup: order.pickup });
      assert.equal(again.totalTHB, quoteSketchOrder(pieces, context).totalTHB, JSON.stringify(context));
    }
    assert.equal(sketchOrderFromSnapshot(null), null);
    assert.equal(sketchOrderFromSnapshot({ pieces: [] }), null);
    assert.doesNotThrow(() => sketchOrderFromSnapshot({ pieces: [null, 5, { cutouts: [null] }] }));
  });

  it("(จ) collecting at the factory: no basin installation and no small-job fee; the stone and the basins are still priced", () => {
    const pieces = [piece("A", 1500, 600, stoneA.code, ["KF001"]), piece("B", 1000, 600, stoneB.code, ["KF002"])];
    const installedQuote = quoteSketchOrder(pieces, fab);
    const pickup = quoteSketchOrder(pieces, { ...fab, pickup: true });
    assert.equal(installedQuote.installationTHB, 10000);
    assert.equal(installedQuote.smallJobFeeTHB, 5000);
    assert.equal(pickup.pickup, true);
    assert.equal(pickup.requestedInstallationTHB, 0);
    assert.equal(pickup.installationTHB, 0);
    assert.equal(pickup.smallJobFeeTHB, 0);
    assert.equal(pickup.basinTotalTHB, installedQuote.basinTotalTHB);
    assert.equal(pickup.stoneTotalTHB, installedQuote.stoneTotalTHB);
    assert.equal(pickup.totalTHB, installedQuote.totalTHB - 10000 - 5000);
    const notification = sketchOrderNotification(pieces, { ...fab, pickup: true });
    assert.equal(notification.items.filter((item) => item.kind === "service").length, 0);
    const snapshot = sketchOrderSnapshot(pieces, { ...fab, pickup: true }) as { pickup: boolean; fulfilment: string; fulfilmentLabel: string };
    assert.equal(snapshot.pickup, true);
    assert.equal(snapshot.fulfilment, "pickup");
    assert.equal(snapshot.fulfilmentLabel, "ลูกค้ามารับเองที่โรงงาน");
  });

  it("(จ) install is the default; the two choices are ให้เราติดตั้ง and ลูกค้ามารับเองที่โรงงาน", () => {
    assert.equal(DEFAULT_SKETCH_FULFILMENT, "install");
    assert.deepEqual(SKETCH_FULFILMENTS.map((item) => [item.value, item.label]), [["install", "ให้เราติดตั้ง"], ["pickup", "ลูกค้ามารับเองที่โรงงาน"]]);
    assert.equal(quoteSketchOrder([piece("A", 1000, 600, stoneA.code)], fab).pickup, false);
  });

  it("standard sheets carry no service charge, whatever the area or the basins", () => {
    const sheetPiece = resolveSketchPiece({ ...base, basinCutouts: 1 }, { stoneCode: fabricationStone.code, basinSkus: ["KF001"], sheetsText: "2" });
    const quote = quoteSketchOrder([sheetPiece], { orderType: "sheet" });
    assert.equal(quote.smallJobFeeTHB, 0);
    assert.equal(quote.installationTHB, 0);
    assert.equal(quote.basinTotalTHB, 0);
    assert.equal(quote.totalTHB, stoneSheetUnitPrice(fabricationStone.code, 2)! * 2);
  });

  it("area is length x depth as typed: no basin hole is taken off and no edge is added", () => {
    const withHole = quoteSketchOrder([piece("A", 2000, 600, stoneA.code, ["KF001"])], fab);
    const without = quoteSketchOrder([piece("A", 2000, 600, stoneA.code)], fab);
    assert.equal(withHole.areaSqM, 1.2);
    assert.equal(withHole.stoneTotalTHB, without.stoneTotalTHB);
    assert.equal(withHole.stoneTotalTHB, Math.round(1.2 * stoneInstalledUnitPrice(stoneA.code)!));
  });
});
