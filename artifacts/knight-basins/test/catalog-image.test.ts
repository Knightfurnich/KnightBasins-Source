import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toggleAdminItemActive } from "../src/admin/adminArchive.ts";
import { basinProductFromCatalog, basinCutoutUrl, basinSourceImageUrl, filterBasinProducts, PRODUCTS, reconcileStoneSelections, removeStoneSelection, sortBasinProductsBySku, stoneColorsForMode, stoneColorsFromCatalog, toggleBasinSelection, toggleStoneSelection, upsertStoneSelection, type StoneConfig } from "../src/data/catalog.ts";

describe("storefront basin image mapping", () => {
  it("preserves a saved imageUrl from the active catalog response", () => {
    const product = basinProductFromCatalog({
      sku: "KF001",
      colorCode: "VS311",
      colorName: "Shine",
      priceTHB: 19000,
      category: "counter basin",
      dimensions: "600 × 800 × 200 mm",
      basinDimensions: "350 × 500 × 130 mm",
      imageTone: "#dfe4df",
      imageUrl: "https://uploads.example.test/catalog/catalog-mabc.png?v=mabc",
    });

    assert.equal(product.imageUrl, "https://uploads.example.test/catalog/catalog-mabc.png?v=mabc");
  });

  it("uses the existing basin visual when an image URL is absent", () => {
    const product = basinProductFromCatalog({
      sku: "KF001",
      colorCode: "VS311",
      colorName: "Shine",
      priceTHB: 19000,
      category: "counter basin",
      dimensions: "600 × 800 × 200 mm",
      imageTone: "#dfe4df",
      imageUrl: "  ",
    });

    assert.equal(product.imageUrl, basinCutoutUrl("KF001"));
    assert.equal(product.sourceImageUrl, basinSourceImageUrl("KF001"));
    assert.equal(product.imageTone, "#dfe4df");
  });

  it("maps canonical catalog JPGs to cutouts while preserving the source fallback", () => {
    const product = basinProductFromCatalog({
      sku: "KF029",
      colorCode: "EG595",
      colorName: "Metallic Galaxy",
      priceTHB: 16000,
      category: "tall vertical washbasin",
      dimensions: "400 × 400 × 1000 mm",
      imageTone: "#4d5050",
      imageUrl: "https://api.example.test/kb/images/basin-hd/KF029.jpg",
    });

    assert.equal(product.imageUrl, basinCutoutUrl("KF029"));
    assert.equal(product.sourceImageUrl, basinSourceImageUrl("KF029"));
  });

  it("makes every built-in basin use a cutout and a JPG fallback", () => {
    assert.equal(PRODUCTS.length, 30);
    for (const product of PRODUCTS) {
      assert.equal(product.imageUrl, basinCutoutUrl(product.sku));
      assert.equal(product.sourceImageUrl, basinSourceImageUrl(product.sku));
    }
  });
});

describe("storefront multi-selection state", () => {
  it("toggles basin SKUs without changing existing quantities or duplicating lines", () => {
    const first = toggleBasinSelection([], "KF001");
    const second = toggleBasinSelection(first, "KF002");
    assert.deepEqual(second.map((line) => line.sku), ["KF001", "KF002"]);
    assert.equal(toggleBasinSelection(second, "KF001").length, 1);
    assert.equal(toggleBasinSelection(second, "KF002")[0]?.sku, "KF001");
    assert.equal(toggleBasinSelection(first, "KF001").length, 0);
  });

  it("keeps stone configurations independent while replacing only the edited color", () => {
    const bw: StoneConfig = { enabled: true, mode: "whole-sheet", color: "BW010", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 };
    const nw: StoneConfig = { ...bw, color: "NW013", quantity: 1 };
    const installedBw = { ...bw, mode: "installed" as const, widthCm: 120, lengthCm: 240 };
    const selected = upsertStoneSelection(upsertStoneSelection([], bw), nw);
    const edited = upsertStoneSelection(selected, installedBw);
    assert.deepEqual(edited.map((stone) => stone.color), ["NW013", "BW010"]);
    assert.equal(edited.find((stone) => stone.color === "NW013")?.quantity, 1);
    assert.equal(edited.find((stone) => stone.color === "BW010")?.mode, "installed");
    assert.equal(edited.find((stone) => stone.color === "BW010")?.unitPrice, 7500);
  });

  it("removes only the requested stone color", () => {
    const bw: StoneConfig = { enabled: true, mode: "whole-sheet", color: "BW010", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 };
    const nw: StoneConfig = { ...bw, color: "NW013" };
    const selected = removeStoneSelection([bw, nw], "BW010");
    assert.deepEqual(selected, [nw]);
  });

  it("can deselect the last stone without creating a replacement selection", () => {
    const bw: StoneConfig = { enabled: true, mode: "whole-sheet", color: "BW010", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 };
    assert.deepEqual(toggleStoneSelection([bw], "BW010", bw), []);
  });

  it("maps the latest catalog image and prices into selectable stone colors", () => {
    const colors = stoneColorsFromCatalog(
      [{ code: "MU010", name: "Evermoin Ultra Bright", tone: "#fff", aliases: ["MU 010"], pricePerSqmTHB: 8100, imageUrl: "https://cdn.example.test/mu-installed.png" }],
      [{ code: "MU010", name: "Evermoin Ultra Bright", tone: "#fff", aliases: ["MU 010"], basePriceTHB: 7600, imageUrl: "https://cdn.example.test/mu-sheet.png" }],
    );
    assert.deepEqual(colors, [{
      code: "MU010",
      name: "Evermoin Ultra Bright",
      tone: "#fff",
      sheetPriceTHB: 7600,
      installedPriceTHB: 8100,
      documentCodes: ["MU 010"],
      imageUrl: "https://cdn.example.test/mu-installed.png",
    }]);
  });

  it("keeps sheet and installed selections isolated by order mode", () => {
    type ActiveCatalogStone = {
      active: boolean;
      code: string;
      name: string;
      tone: string;
      pricePerSqmTHB?: number;
      basePriceTHB?: number;
    };
    let installed: ActiveCatalogStone[] = [
      { active: true, code: "INSTALLED", name: "Installed only", tone: "#111", pricePerSqmTHB: 8500 },
      { active: true, code: "BOTH", name: "Both", tone: "#222", pricePerSqmTHB: 9000 },
    ];
    let sheet: ActiveCatalogStone[] = [
      { active: true, code: "SHEET", name: "Sheet only", tone: "#333", basePriceTHB: 7000 },
      { active: true, code: "BOTH", name: "Both", tone: "#222", basePriceTHB: 6500 },
    ];
    const refetchCustomerModes = () => ({
      installed: stoneColorsForMode(
        installed.filter((stone) => stone.active),
        sheet.filter((stone) => stone.active),
        "installed",
      ).map((color) => color.code),
      wholeSheet: stoneColorsForMode(
        installed.filter((stone) => stone.active),
        sheet.filter((stone) => stone.active),
        "whole-sheet",
      ).map((color) => color.code),
    });

    assert.deepEqual(refetchCustomerModes(), {
      installed: ["INSTALLED", "BOTH"],
      wholeSheet: ["SHEET", "BOTH"],
    });

    sheet = [sheet[0], toggleAdminItemActive(sheet[1])];
    assert.deepEqual(refetchCustomerModes(), {
      installed: ["INSTALLED", "BOTH"],
      wholeSheet: ["SHEET"],
    });

    sheet = [sheet[0], toggleAdminItemActive(sheet[1])];
    installed = [installed[0], toggleAdminItemActive(installed[1])];
    assert.deepEqual(refetchCustomerModes(), {
      installed: ["INSTALLED"],
      wholeSheet: ["SHEET", "BOTH"],
    });

    installed = [installed[0], toggleAdminItemActive(installed[1])];
    assert.deepEqual(refetchCustomerModes(), {
      installed: ["INSTALLED", "BOTH"],
      wholeSheet: ["SHEET", "BOTH"],
    });
  });

  it("preserves active mode-specific selections and reports hidden records", () => {
    const selected: StoneConfig[] = [
      { enabled: true, mode: "whole-sheet", color: "SHEET", quantity: 4, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 },
      { enabled: true, mode: "installed", color: "BOTH", quantity: 1, widthCm: 120, lengthCm: 240, areaSqM: 2.88, unitPrice: 0, installationPrice: 0 },
      { enabled: true, mode: "whole-sheet", color: "HIDDEN", quantity: 2, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: 0, installationPrice: 0 },
    ];
    const result = reconcileStoneSelections(selected, {
      "whole-sheet": [{ code: "SHEET", name: "Sheet", tone: "#fff", sheetPriceTHB: 7000, installedPriceTHB: null, documentCodes: [] }],
      installed: [{ code: "BOTH", name: "Both", tone: "#222", sheetPriceTHB: null, installedPriceTHB: 9000, documentCodes: [] }],
    });

    assert.deepEqual(result.active, [selected[0], selected[1]]);
    assert.deepEqual(result.hidden, [selected[2]]);
  });

  it("studio basin search reaches every catalog model", () => {
    assert.equal(filterBasinProducts(PRODUCTS, "").length, 30);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF029").map((product) => product.sku), ["KF029"]);
    assert.deepEqual(filterBasinProducts(PRODUCTS, "KF030").map((product) => product.sku), ["KF030"]);
  });

  it("sorts active models naturally, including future SKUs outside the original range", () => {
    const models = ["KF031", "KF002", "AB10", "AB2"].map((sku) => basinProductFromCatalog({
      sku,
      colorCode: `CODE-${sku}`,
      colorName: sku,
      priceTHB: 19000,
      category: "counter basin",
      dimensions: "600 × 800 × 200 mm",
      imageTone: "#dfe4df",
    }));

    assert.deepEqual(sortBasinProductsBySku(models).map((product) => product.sku), ["AB2", "AB10", "KF002", "KF031"]);
  });
});