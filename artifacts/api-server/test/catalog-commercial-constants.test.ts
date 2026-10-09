import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  INSTALLATION_PRICE,
  STONE_COLORS,
  STONE_GLUE_PRICE,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
} from "../../knight-basins/src/data/catalog.ts";
import {
  SHEET_DISCOUNT_EXCLUDED_CODES,
  commercialConstants,
  sheetSizeFromStorefront,
  sheetTierPrices,
} from "../src/lib/commercial-constants.ts";

// job-405-C: /api/catalog carries the trade constants the app prices with, in the knowledge-base feed's shape, so the feed
// can be compared with the app one to one. Two layers: the shape, and "the same value" -- the exported figure is the figure
// the calculators and the catalogue seed use, so editing one side alone must fail a test.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// The figures the knowledge-base feed (`pricing.json`, 9 Oct 2026) holds for the blocks the app can vouch for. They are
// pinned here on purpose: changing a trade constant is a business decision, and this test is where it gets noticed so the
// feed and the bot are told. Notes, `sale_types`, `glue_gun`, `basin_stopper`, the delivery window and the night-work rule
// are not in the app and are deliberately absent.
const FEED = {
  vat_percent: 7,
  sheet_size: { w_m: 0.76, h_m: 3.6, thickness_mm: 12, m2: 2.736 },
  discount_excluded_codes: ["BW010", "NW013"],
  rules: [
    { scope: "กทม.+ปริมณฑล", condition: "พื้นที่น้อยกว่า 5 ตร.ม.", charge: 5000, unit: "บาท/งาน" },
    { scope: "ต่างจังหวัด", condition: "พื้นที่น้อยกว่า 10 ตร.ม.", charge: 8000, unit: "บาท/งาน" },
    { scope: "ลูกค้ารับสินค้าเองที่โรงงาน", condition: "-", charge: 0, unit: "ไม่คิดค่าดำเนินการ" },
    { scope: "ค่าเดินทาง + เบี้ยเลี้ยง", condition: "งานต่างจังหวัด", charge: null, unit: "ตามสถานที่" },
  ],
  tiers: [
    { min: 1, max: 9, type: "none" },
    { min: 10, max: 49, type: "per_sheet", amount: 200 },
    { min: 50, max: null, type: "percent", amount: 5 },
  ],
  addons: [
    { id: "glue", label: "กาวหินสังเคราะห์ 250 ML", price: 500, unit: "บาท/หลอด" },
    { id: "basin_install", label: "ค่าดำเนินการติดตั้งชุดอ่าง", price: 5000, unit: "บาท/ชุด" },
  ],
};

describe("commercialConstants: shape", () => {
  const c = commercialConstants();

  it("has the blocks and nothing the app cannot vouch for", () => {
    assert.deepEqual(Object.keys(c).sort(), ["addons", "discount_excluded_codes", "discount_tiers", "installation", "sheet_size", "vat_percent"]);
    assert.deepEqual(Object.keys(c.installation), ["rules"]);
  });

  it("never collides with the catalogue's own keys, so nothing existing is overwritten", () => {
    for (const key of Object.keys(c)) assert.ok(!["basins", "categories", "installedStones", "sheetStones"].includes(key), key);
  });

  it("installation.rules: scope/condition/unit are strings and charge is a number or null", () => {
    assert.ok(c.installation.rules.length >= 1);
    for (const rule of c.installation.rules) {
      assert.deepEqual(Object.keys(rule), ["scope", "condition", "charge", "unit"]);
      assert.equal(typeof rule.scope, "string");
      assert.equal(typeof rule.condition, "string");
      assert.equal(typeof rule.unit, "string");
      assert.ok(rule.charge === null || (Number.isFinite(rule.charge) && rule.charge >= 0), String(rule.charge));
    }
  });

  it("discount_tiers: contiguous from 1, the last is open-ended, amount only where it applies", () => {
    const tiers = c.discount_tiers;
    assert.equal(tiers[0]!.min, 1);
    tiers.forEach((tier, i) => {
      if (i > 0) assert.equal(tier.min, tiers[i - 1]!.max! + 1);
      assert.ok(["none", "per_sheet", "percent"].includes(tier.type));
      assert.equal("amount" in tier, tier.type !== "none");
    });
    assert.equal(tiers.at(-1)!.max, null);
  });

  it("addons: id, label, unit are strings and price is a non-negative number", () => {
    for (const addon of c.addons) {
      assert.equal(typeof addon.id, "string");
      assert.equal(typeof addon.label, "string");
      assert.equal(typeof addon.unit, "string");
      assert.ok(Number.isFinite(addon.price) && addon.price >= 0);
    }
  });

  it("is JSON-safe and does not share state between calls", () => {
    const a = commercialConstants();
    a.discount_excluded_codes.push("ZZZ");
    a.installation.rules.length = 0;
    assert.deepEqual(commercialConstants().discount_excluded_codes, FEED.discount_excluded_codes);
    assert.deepEqual(JSON.parse(JSON.stringify(commercialConstants())), commercialConstants());
  });
});

describe("commercialConstants: agrees with the feed value for value (no number changed by job 405-C)", () => {
  const c = commercialConstants();
  it("vat, sheet size, exclusions", () => {
    assert.equal(c.vat_percent, FEED.vat_percent);
    assert.deepEqual(c.sheet_size, FEED.sheet_size);
    assert.deepEqual(c.discount_excluded_codes, FEED.discount_excluded_codes);
  });
  it("installation rules, discount tiers, add-ons", () => {
    assert.deepEqual(c.installation.rules, FEED.rules);
    assert.deepEqual(c.discount_tiers, FEED.tiers);
    assert.deepEqual(c.addons, FEED.addons);
  });
});

describe("commercialConstants: the SAME value the app prices with", () => {
  const c = commercialConstants();
  const rule = (scope: string) => c.installation.rules.find((r) => r.scope === scope)!;

  it("small-job fees and minimum areas are the storefront constants", () => {
    assert.equal(rule("กทม.+ปริมณฑล").charge, STONE_SMALL_JOB_BANGKOK_FEE);
    assert.equal(rule("ต่างจังหวัด").charge, STONE_SMALL_JOB_PROVINCE_FEE);
    assert.ok(rule("กทม.+ปริมณฑล").condition.includes(String(STONE_INSTALLED_MIN_BANGKOK_SQM)));
    assert.ok(rule("ต่างจังหวัด").condition.includes(String(STONE_INSTALLED_MIN_PROVINCE_SQM)));
  });

  it("add-on prices, VAT and sheet size are the storefront constants", () => {
    assert.equal(c.addons.find((a) => a.id === "glue")!.price, STONE_GLUE_PRICE);
    assert.equal(c.addons.find((a) => a.id === "basin_install")!.price, INSTALLATION_PRICE);
    assert.equal(c.vat_percent, Math.round(VAT_RATE * 100));
    assert.deepEqual(sheetSizeFromStorefront(STONE_SHEET_SIZE, STONE_SHEET_THICKNESS), c.sheet_size);
  });

  it("the discount tiers describe exactly what the catalogue seed computes, for every real sheet price", () => {
    const [, ten, fifty] = c.discount_tiers;
    const bases = STONE_COLORS.flatMap((stone) => (stone.sheetPriceTHB === null ? [] : [{ code: stone.code, base: stone.sheetPriceTHB }]));
    assert.ok(bases.length >= 60, `expected the real catalogue, got ${bases.length}`);
    for (const { code, base } of bases) {
      const seeded = sheetTierPrices(code, base);
      if (c.discount_excluded_codes.includes(code)) {
        assert.deepEqual(seeded, { price10PlusTHB: base, price50PlusTHB: base }, code);
      } else {
        assert.equal(seeded.price10PlusTHB, Math.max(0, base - ten!.amount!), code);
        assert.equal(seeded.price50PlusTHB, Math.round(base * (1 - fifty!.amount! / 100)), code);
      }
    }
  });

  it("sheetTierPrices still equals the expression the seed used before job 405-C", () => {
    for (const { code, sheetPriceTHB } of STONE_COLORS) {
      if (sheetPriceTHB === null) continue;
      const excluded = ["BW010", "NW013"].includes(code);
      assert.deepEqual(sheetTierPrices(code, sheetPriceTHB), {
        price10PlusTHB: excluded ? sheetPriceTHB : Math.max(0, sheetPriceTHB - 200),
        price50PlusTHB: excluded ? sheetPriceTHB : Math.round(sheetPriceTHB * 0.95),
      }, code);
    }
    assert.deepEqual([...SHEET_DISCOUNT_EXCLUDED_CODES], ["BW010", "NW013"]);
  });

  it("sheet size is left out, not guessed, when the storefront strings stop being readable", () => {
    assert.equal(sheetSizeFromStorefront("ขนาดมาตรฐาน", "หนา 12 mm"), undefined);
    assert.equal(sheetSizeFromStorefront("0.76 × 3.60 m", "ไม่ระบุ"), undefined);
  });
});

describe("one source: nobody re-types the figures", () => {
  const exporter = read("../src/lib/commercial-constants.ts");
  const route = read("../src/routes/catalog.ts");

  it("the exporter holds no copy of a fee or a price", () => {
    for (const literal of ["5000", "8000", "5,000", "8,000", "0.07", "= 500", "= 600"]) assert.ok(!exporter.includes(literal), `exporter re-types ${literal}`);
  });

  it("the seed applies the shared function and keeps no private discount maths", () => {
    assert.match(route, /sheetTierPrices\(stone\.code, stone\.sheetPriceTHB\)/);
    assert.ok(!/- 200\)|\* 0\.95\)|\["BW010", "NW013"\]/.test(route), "catalog.ts seed re-types the discount rule");
  });

  it("the endpoint adds the blocks after the catalogue and never replaces a catalogue key", () => {
    assert.match(route, /res\.json\(\{ \.\.\.\(await getCatalogData\(true\)\), \.\.\.commercialConstants\(\) \}\)/);
  });

  it("each storefront constant is declared once, in catalog.ts, and the calculators import it", () => {
    const data = (name: string) => read(`../../knight-basins/src/data/${name}`);
    for (const name of ["STONE_SMALL_JOB_BANGKOK_FEE", "STONE_SMALL_JOB_PROVINCE_FEE", "STONE_GLUE_PRICE", "INSTALLATION_PRICE"]) {
      const declared = ["catalog.ts", "studio-model.ts", "sketch-order.ts", "quote-utils.ts"].filter((file) => new RegExp(`export const ${name}\\b`).test(data(file)));
      assert.deepEqual(declared, ["catalog.ts"], `${name} must be declared only in catalog.ts`);
    }
    assert.match(data("studio-model.ts"), /STONE_SMALL_JOB_BANGKOK_FEE : STONE_SMALL_JOB_PROVINCE_FEE/);
    assert.match(data("sketch-order.ts"), /INSTALLATION_PRICE/);
  });
});
