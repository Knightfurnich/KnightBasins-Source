import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

/**
 * job 439-B: a basin card may show a bowl shape only when the catalogue says so.
 * 438-C (Chai) ships `bowlShapeLabel` (display text) plus machine fields
 * `bowlShape` / `bowlOverflowHole` that must never be printed raw. These tests
 * lock both halves: text comes from data, and no data means no line.
 */
const appUrl = new URL("../src/App.tsx", import.meta.url);
const appSource = await readFile(appUrl, "utf8");
const { basinProductFromCatalog, PRODUCTS } = await import("../src/data/catalog.ts");

const appAst = ts.createSourceFile(fileURLToPath(appUrl), appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const wanted = new Set(["bowlShapeFromModel", "bowlShapeText"]);

function loadHelpers() {
  const fns = appAst.statements.filter(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && Boolean(st.name) && wanted.has(st.name!.text),
  );
  assert.equal(fns.length, wanted.size, "App.tsx must keep every bowl-shape helper as a plain function declaration");
  const keysDecl = /const BOWL_SHAPE_KEYS = (\[[^\]]*\]) as const;/.exec(appSource)![1];
  const body = fns.map((fn) => appSource.slice(fn.getStart(appAst), fn.end).replace("export function", "function")).join("\n");
  const compiled = ts.transpileModule(
    `const BOWL_SHAPE_KEYS = ${keysDecl};\n${body}\nreturn { bowlShapeFromModel, bowlShapeText };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(compiled)() as {
    bowlShapeFromModel: (row: unknown) => string;
    bowlShapeText: (product: unknown) => string;
  };
}

const { bowlShapeFromModel, bowlShapeText } = loadHelpers();
const basinRow = (over: Record<string, unknown>) => ({
  sku: "KF003", colorCode: "RW316", colorName: "River White", priceTHB: 19000,
  category: "counter basin", dimensions: "600 × 800 × 200 mm", imageTone: "#c6cdc9", ...over,
});

/** 438-C's contract, used here as *test fixtures* only. */
const TEST_LABEL_A = "TEST-LABEL-A";
const TEST_LABEL_B = "TEST-LABEL-B";

describe("the label comes from the catalogue, never from us (439-B A)", () => {
  it("reads bowlShapeLabel verbatim and trims it", () => {
    assert.equal(bowlShapeFromModel({ sku: "KF003", bowlShapeLabel: TEST_LABEL_A }), TEST_LABEL_A);
    assert.equal(bowlShapeFromModel({ bowlShapeLabel: `  ${TEST_LABEL_B}  ` }), TEST_LABEL_B);
  });

  it("prints none of the machine fields", () => {
    assert.equal(bowlShapeFromModel({ sku: "KF003", bowlShape: "rounded-rectangle" }), "", "the enum must not leak as copy");
    assert.equal(bowlShapeFromModel({ sku: "KF003", bowlOverflowHole: true }), "");
    assert.equal(bowlShapeFromModel({ sku: "KF003", bowlShape: "oval", bowlOverflowHole: false }), "");
  });

  it("nothing at all when the row has no label", () => {
    assert.equal(bowlShapeFromModel({ sku: "KF021", bowlMm: "350 × 500 × 130 mm" }), "");
    assert.equal(bowlShapeFromModel({ bowlShapeLabel: "" }), "");
    assert.equal(bowlShapeFromModel({ bowlShapeLabel: "   " }), "", "whitespace is not data");
    assert.equal(bowlShapeFromModel({ bowlShapeLabel: null }), "");
    assert.equal(bowlShapeFromModel(undefined), "");
    assert.equal(bowlShapeFromModel(null), "");
  });

  it("no shape sentence is hard-coded in the app", () => {
    assert.ok(!/หลุมสี่เหลี่ยม|หลุมวงรี|รูปทรงหลุม|ไม่มีรูน้ำล้น/.test(appSource), "App.tsx contains hard-coded bowl-shape wording");
    assert.deepEqual(JSON.parse(keysOfSource()), ["bowlShapeLabel"], "only the catalogue display field is read");
  });
});

function keysOfSource(): string {
  return /const BOWL_SHAPE_KEYS = (\[[^\]]*\]) as const;/.exec(appSource)![1].replace(/\s/g, "");
}

describe("one read path: the API row lands on the product (441-B)", () => {
  it("passes bowlShape / bowlShapeLabel / bowlOverflowHole / categoryLabel through the mapper", () => {
    const mapped = basinProductFromCatalog(basinRow({
      bowlShape: "rounded-rectangle", bowlShapeLabel: `  ${TEST_LABEL_A}  `, bowlOverflowHole: false, categoryLabel: "เคาน์เตอร์",
    }));
    assert.equal(mapped.bowlShape, "rounded-rectangle");
    assert.equal(mapped.bowlShapeLabel, TEST_LABEL_A, "the label is trimmed, not rewritten");
    assert.equal(mapped.bowlOverflowHole, false);
    assert.equal(mapped.categoryLabel, "เคาน์เตอร์");
    assert.equal(bowlShapeText(mapped), TEST_LABEL_A, "the card reads the mapped product with no side cache");
  });

  it("an unmapped or emptied value stays empty — no ghost copy", () => {
    assert.equal(basinProductFromCatalog(basinRow({})).bowlShapeLabel, undefined);
    assert.equal(basinProductFromCatalog(basinRow({ bowlShapeLabel: "   " })).bowlShapeLabel, undefined);
    assert.equal(basinProductFromCatalog(basinRow({ bowlShapeLabel: null })).bowlShapeLabel, undefined);
    assert.equal(bowlShapeText(basinProductFromCatalog(basinRow({ bowlShape: "oval" }))), "", "the enum alone is not copy");
    // a shape the catalogue has never heard of is dropped rather than passed through
    assert.equal(basinProductFromCatalog(basinRow({ bowlShape: "heart", bowlShapeLabel: TEST_LABEL_B })).bowlShape, undefined);
    assert.equal(basinProductFromCatalog(basinRow({ bowlOverflowHole: "yes" })).bowlOverflowHole, null);
    // value disappears on the next load => the same mapper output stops printing it
    assert.equal(bowlShapeText(basinProductFromCatalog(basinRow({ sku: "KF003" }))), "");
  });

  it("the built-in catalogue carries no bowl-shape wording of its own any more", () => {
    assert.equal(PRODUCTS.filter((product) => product.bowlShapeLabel || product.bowlShape).length, 0,
      "BASIN_BOWL_SHAPES was cut: 15 of 25 labels disagreed with the API on 11 Oct 2026");
    const catalogSource = readFileSync(new URL("../src/data/catalog.ts", import.meta.url), "utf8");
    assert.doesNotMatch(catalogSource, /export const BASIN_BOWL_SHAPES/);
  });

  it("the sku cache plumbing must not come back", () => {
    assert.doesNotMatch(appSource, /bowlShapeBySku|syncBowlShapesFromCatalog|bowlShapeForSku/, "two-source plumbing reappeared");
    assert.match(appSource, /remoteCatalog\.basins\.map\(basinProductFromCatalog\)/);
  });
});

describe("the card renders only what the data supports (439-B B)", () => {
  it("is gated on a non-empty label and keeps one stable test id", () => {
    assert.match(appSource, /\{bowlShapeText\(product\) && \(/);
    assert.equal((appSource.match(/data-testid="text-basin-bowl-shape"/g) ?? []).length, 1, "exactly one renderer");
  });

  it("rebuilds the products from the raw rows on every catalogue load", () => {
    assert.match(appSource, /remoteCatalog\.basins\.map\(basinProductFromCatalog\)/, "the API rows are the only catalogue input");
    assert.doesNotMatch(appSource, /syncBowlShapesFromCatalog/);
  });

  it("does not mask overflow to hide a layout problem", () => {
    assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(appSource) && !/body\s*\{[^}]*overflow-x:\s*hidden/.test(appSource));
    assert.match(appSource, /\[overflow-wrap:anywhere\]/, "the label must wrap instead of being clipped -- truncating it hides the very difference 438-C added");
    assert.ok(!/data-testid="text-basin-bowl-shape"[^>]*truncate/.test(appSource) && !/truncate[^"]*"\s+title=\{bowlShapeText/.test(appSource), "no truncate on the shape line");
  });

  it("two API rows make two distinguishable cards (438-C contract, captured 11 Oct 2026)", () => {
    const rows = [
      { sku: "KF003", colorCode: "RW316", colorName: "River White", priceTHB: 19000, category: "counter basin", dimensions: "600 × 800 × 200 mm", imageTone: "#c6cdc9", bowlShape: "rounded-rectangle", bowlShapeLabel: "หลุมสี่เหลี่ยมมุมมน" },
      { sku: "KF006", colorCode: "GS101", colorName: "Grey Storm", priceTHB: 19000, category: "counter basin", dimensions: "600 × 800 × 200 mm", imageTone: "#c6cdc9", bowlShape: "oval", bowlShapeLabel: "หลุมวงรี" },
      { sku: "KF007", colorCode: "XX000", colorName: "No Shape", priceTHB: 19000, category: "counter basin", dimensions: "600 × 800 × 200 mm", imageTone: "#c6cdc9", bowlShape: null, bowlShapeLabel: null },
    ].map((row) => basinProductFromCatalog(row));
    assert.equal(bowlShapeText(rows[0]), "หลุมสี่เหลี่ยมมุมมน");
    assert.equal(bowlShapeText(rows[1]), "หลุมวงรี");
    assert.notEqual(bowlShapeText(rows[0]), bowlShapeText(rows[1]), "KF003 and KF006 must read differently");
    assert.equal(bowlShapeText(rows[2]), "", "a model the catalogue says nothing about prints nothing");
  });
});
