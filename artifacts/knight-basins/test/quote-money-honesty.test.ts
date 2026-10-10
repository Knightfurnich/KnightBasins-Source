import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import {
  STONE_COLORS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
} from "../src/data/catalog.ts";
import { fileURLToPath } from "node:url";

/**
 * job 430-B: a stone-only quote must be issuable, the /stone estimate must not be
 * lower than what the customer is actually charged, and the index must say what a
 * price is per (ชุด) plus the VAT condition.
 * The money helpers are extracted straight out of App.tsx (same technique as
 * portfolio-inquiry-search.test.ts) so the arithmetic itself is asserted, not just
 * the strings.
 */
const appUrl = new URL("../src/App.tsx", import.meta.url);
const appSource = await readFile(appUrl, "utf8");
const appAst = ts.createSourceFile(fileURLToPath(appUrl), appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const helperNames = ["stoneAreaSqM", "stoneUnitPrice", "stoneTotal", "stoneSmallJobFeeTHB", "stoneEstimate"] as const;

function loadMoneyHelpers() {
  const wanted = new Set<string>(helperNames);
  const picked = appAst.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && Boolean(statement.name) && wanted.has(statement.name!.text),
  );
  assert.equal(picked.length, wanted.size, "App.tsx must keep every money helper as a plain function declaration");
  const body = picked
    .map((fn) => appSource.slice(fn.getStart(appAst), fn.end).replace(/^(export\s+)?(async\s+)?function/, "function"))
    .join("\n");
  const compiled = ts.transpileModule(`${body}\nreturn { stoneSmallJobFeeTHB, stoneEstimate };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  // The helpers' own inputs come from the single source of truth (src/data/catalog.ts)
  // so this test can never drift from the numbers the storefront announces.
  return new Function(
    "STONE_COLORS", "stoneSheetUnitPrice", "stoneInstalledUnitPrice",
    "STONE_INSTALLED_MIN_BANGKOK_SQM", "STONE_INSTALLED_MIN_PROVINCE_SQM",
    "STONE_SMALL_JOB_BANGKOK_FEE", "STONE_SMALL_JOB_PROVINCE_FEE",
    compiled,
  )(
    STONE_COLORS, stoneSheetUnitPrice, stoneInstalledUnitPrice,
    STONE_INSTALLED_MIN_BANGKOK_SQM, STONE_INSTALLED_MIN_PROVINCE_SQM,
    STONE_SMALL_JOB_BANGKOK_FEE, STONE_SMALL_JOB_PROVINCE_FEE,
  ) as {
    stoneSmallJobFeeTHB: (areaSqM: number, site: "bangkok" | "province", mode: "whole-sheet" | "installed") => number;
    stoneEstimate: (stone: unknown, colors: unknown, site: "bangkok" | "province") => { materialTHB: number; smallJobFeeTHB: number; totalTHB: number };
  };
}

const { stoneSmallJobFeeTHB, stoneEstimate } = loadMoneyHelpers();
const BW010_INSTALLED = STONE_COLORS.find((c) => c.code === "BW010")!.installedPriceTHB!;
const installed = (widthCm: number, lengthCm: number, colorName = "Bright White") => ({
  enabled: true, mode: "installed" as const, color: colorName, widthCm, lengthCm, quantity: 1, cutout: "none",
});
const sheetStone = { enabled: true, mode: "whole-sheet" as const, color: "Bright White", widthCm: 100, lengthCm: 100, quantity: 2, cutout: "none" };

describe("installed estimate never under-quotes the small-job fee (430-B B)", () => {
  it("charges the announced fee only below the site minimum", () => {
    assert.equal(stoneSmallJobFeeTHB(0.72, "bangkok", "installed"), STONE_SMALL_JOB_BANGKOK_FEE, "0.72 m² in BKK is below 5 m² -> +5,000");
    assert.equal(stoneSmallJobFeeTHB(0.72, "province", "installed"), STONE_SMALL_JOB_PROVINCE_FEE, "province keeps its own 8,000 fee");
    assert.equal(stoneSmallJobFeeTHB(5, "bangkok", "installed"), 0, "exactly at the minimum -> no fee");
    assert.equal(stoneSmallJobFeeTHB(9.9, "province", "installed"), 8000, "9.9 m² is still below the 10 m² province minimum");
    assert.equal(stoneSmallJobFeeTHB(10, "province", "installed"), 0);
  });

  it("above the minimum adds nothing, and a whole-sheet order never carries an install fee", () => {
    assert.equal(stoneSmallJobFeeTHB(12, "bangkok", "installed"), 0);
    assert.equal(stoneSmallJobFeeTHB(1, "province", "whole-sheet"), 0, "no installation in a raw-sheet sale");
    assert.equal(stoneSmallJobFeeTHB(Number.NaN, "bangkok", "installed"), 0, "unreadable area must not invent a fee");
  });

  it("the estimate card total is material + fee, never material alone", () => {
    const breakdown = stoneEstimate(installed(60, 120), undefined, "bangkok");
    assert.equal(breakdown.materialTHB, BW010_INSTALLED * 0.72);
    assert.equal(breakdown.smallJobFeeTHB, 5000);
    assert.equal(breakdown.totalTHB, BW010_INSTALLED * 0.72 + STONE_SMALL_JOB_BANGKOK_FEE, "the number shown must be the number the customer pays");
    assert.ok(breakdown.totalTHB > breakdown.materialTHB);
    const big = stoneEstimate(installed(300, 400), undefined, "bangkok");
    assert.equal(big.smallJobFeeTHB, 0);
    assert.equal(big.totalTHB, big.materialTHB);
    const province = stoneEstimate(installed(60, 120), undefined, "province");
    assert.equal(province.smallJobFeeTHB, STONE_SMALL_JOB_PROVINCE_FEE);
    assert.equal(stoneEstimate(sheetStone, undefined, "province").smallJobFeeTHB, 0);
  });
});

describe("a stone-only quote is issuable (430-B A)", () => {
  it("canGenerate accepts stones without basins instead of cart.length alone", () => {
    assert.match(appSource, /const hasQuoteLines = cart\.length > 0 \|\| quoteStoneLines\.length > 0;/);
    assert.match(appSource, /!hasInvalidStone && hasQuoteLines;/);
    assert.doesNotMatch(appSource, /!hasInvalidStone && cart\.length > 0;/, "the old basin-only gate must be gone");
  });

  it("the warning names what is actually missing and no longer says 'add a product' for a stone customer", () => {
    assert.match(appSource, /\{!hasQuoteLines && <p className="summary-warning" data-testid="status-quote-cart-validation">/);
    assert.match(appSource, /ยังไม่มีรายการในใบเสนอราคา/);
    assert.match(appSource, /ดูใบเสนอราคา” จากหน้าหินสังเคราะห์/);
    assert.equal((appSource.match(/status-quote-cart-validation/g) ?? []).length, 1, "exactly one empty-quote warning, driven by hasQuoteLines");
    assert.ok(!appSource.includes("เพิ่มสินค้าอย่างน้อย 1 รายการก่อนออกใบเสนอราคา"), "the old basin-only wording must be gone");
  });

  it("stone lines still reach the printable document (so an empty-basin quote is not blank)", () => {
    assert.match(appSource, /stones\.forEach\(\(stone\) => \{[\s\S]{0,900}?formalItems\.push\(\{[\s\S]*?unit: stone\.mode === "whole-sheet" \? "แผ่น" : "ตร\.ม\."/);
  });
});

describe("index prices carry unit + VAT condition (430-B C)", () => {
  it("one VAT label derived from the same rate the quote maths uses", () => {
    assert.match(appSource, /export const VAT_PERCENT_LABEL = `\$\{Math\.round\(VAT_RATE \* 100\)\}%`;/);
    assert.equal(/VAT_PERCENT_LABEL = `/.test(appSource), true);
    assert.match(appSource, /ยังไม่รวม VAT \{VAT_PERCENT_LABEL\}/);
    assert.equal((appSource.match(/data-testid="text-price-terms-note"/g) ?? []).length, 1);
    assert.ok(VAT_RATE === 0.07, "the shared rate is what backs the label");
    assert.ok((appSource.match(/data-testid="text-price-terms-note"/g) ?? []).length === 1);
  });

  it("every basin card states the price is per set", () => {
    assert.match(appSource, /<strong className="product-price">\{formatTHB\(product\.priceTHB\)\}<small className="product-price-unit"> \/ ชุด<\/small><\/strong>/);
  });
});

describe("no forbidden shortcuts (430-B E)", () => {
  it("does not hide the problem with overflow-x or by hiding the button", () => {
    assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(appSource));
    assert.ok(!/body\s*\{[^}]*overflow-x:\s*hidden/.test(appSource));
    const button = /<button className="button button--accent full-width" onClick=\{generateQuote\} data-testid="button-generate-quote"/;
    assert.match(appSource, button, "the formal quote button stays visible and is the thing that validates");
    assert.doesNotMatch(appSource, /disabled=\{[^}]*!canGenerate[^}]*\}\s*data-testid="button-generate-quote"/, "no disabled blind alley");
  });
  it("no hand-typed small-job fee literals in App.tsx", () => {
    for (const literal of ["5400", "= 5000", "= 8000"]) {
      assert.ok(!appSource.includes(literal), `fee/price literals must stay in the constants module: found ${literal}`);
    }
  });
});
