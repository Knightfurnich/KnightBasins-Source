import assert from "node:assert/strict";
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
const appAst = ts.createSourceFile(fileURLToPath(appUrl), appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const wanted = new Set(["bowlShapeFromModel", "syncBowlShapesFromCatalog", "bowlShapeForSku", "bowlShapeText"]);

function loadHelpers() {
  const fns = appAst.statements.filter(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && Boolean(st.name) && wanted.has(st.name!.text),
  );
  assert.equal(fns.length, wanted.size, "App.tsx must keep every bowl-shape helper as a plain function declaration");
  const keysDecl = /const BOWL_SHAPE_KEYS = (\[[^\]]*\]) as const;/.exec(appSource)![1];
  const body = fns.map((fn) => appSource.slice(fn.getStart(appAst), fn.end).replace("export function", "function")).join("\n");
  const compiled = ts.transpileModule(
    `const BOWL_SHAPE_KEYS = ${keysDecl};\nconst bowlShapeBySku = new Map();\n${body}\nreturn { bowlShapeFromModel, syncBowlShapesFromCatalog, bowlShapeForSku, bowlShapeText };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(compiled)() as {
    bowlShapeFromModel: (row: unknown) => string;
    syncBowlShapesFromCatalog: (rows: unknown) => void;
    bowlShapeForSku: (sku: string) => string;
    bowlShapeText: (product: unknown) => string;
  };
}

const { bowlShapeFromModel, syncBowlShapesFromCatalog, bowlShapeForSku, bowlShapeText } = loadHelpers();

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

describe("both data paths are honoured (439-B A + plumbing)", () => {
  it("uses the label already present on the card model (built-in catalogue copy)", () => {
    syncBowlShapesFromCatalog([]);
    assert.equal(bowlShapeText({ sku: "KF003", bowlShapeLabel: TEST_LABEL_A }), TEST_LABEL_A);
  });

  it("falls back to the raw /api/catalog rows, because basinProductFromCatalog drops unknown columns", () => {
    syncBowlShapesFromCatalog([
      { sku: "KF003", bowlShape: "rounded-rectangle", bowlShapeLabel: TEST_LABEL_A, bowlOverflowHole: false },
      { sku: "KF006", bowlShape: "oval", bowlShapeLabel: TEST_LABEL_B, bowlOverflowHole: true },
      { sku: "KF021", bowlMm: "350 × 500 × 130 mm" },
    ]);
    // the mapped card model a customer gets has no label field at all -> cache covers it
    assert.equal(bowlShapeText({ sku: "KF003" }), TEST_LABEL_A);
    assert.equal(bowlShapeText({ sku: "KF006" }), TEST_LABEL_B);
    assert.notEqual(bowlShapeText({ sku: "KF003" }), bowlShapeText({ sku: "KF006" }), "KF003/KF006 must read differently");
    assert.equal(bowlShapeText({ sku: "KF021" }), "", "a model without the field shows nothing");
    assert.equal(bowlShapeText({ sku: "ZZ999" }), "", "unknown sku shows nothing");
    assert.equal(bowlShapeForSku("KF003"), TEST_LABEL_A);
  });

  it("resync clears stale labels; a failed load does not invent any", () => {
    syncBowlShapesFromCatalog([{ sku: "KF003", bowlShapeLabel: TEST_LABEL_A }]);
    assert.equal(bowlShapeForSku("KF003"), TEST_LABEL_A);
    syncBowlShapesFromCatalog([{ sku: "KF003" }]);
    assert.equal(bowlShapeForSku("KF003"), "", "no ghost text after the value disappears");
    syncBowlShapesFromCatalog(undefined);
    assert.equal(bowlShapeForSku("KF003"), "");
    assert.equal(bowlShapeText({ sku: "KF003" }), "");
  });

  it("the model wins over the cache (same source of truth, one answer)", () => {
    syncBowlShapesFromCatalog([{ sku: "KF003", bowlShapeLabel: TEST_LABEL_A }]);
    assert.equal(bowlShapeText({ sku: "KF003", bowlShapeLabel: TEST_LABEL_B }), TEST_LABEL_B);
  });
});

describe("the card renders only what the data supports (439-B B)", () => {
  it("is gated on a non-empty label and keeps one stable test id", () => {
    assert.match(appSource, /\{bowlShapeText\(product\) && \(/);
    assert.equal((appSource.match(/data-testid="text-basin-bowl-shape"/g) ?? []).length, 1, "exactly one renderer");
  });

  it("feeds the cache from the raw rows on every catalogue load", () => {
    assert.match(appSource, /syncBowlShapesFromCatalog\(remoteCatalog\.basins\);/);
    assert.match(appSource, /remoteCatalog\.basins\.map\(basinProductFromCatalog\)/, "Chai's mapper is untouched");
  });

  it("does not mask overflow to hide a layout problem", () => {
    assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(appSource) && !/body\s*\{[^}]*overflow-x:\s*hidden/.test(appSource));
    assert.match(appSource, /\[overflow-wrap:anywhere\]/, "the label must wrap instead of being clipped -- truncating it hides the very difference 438-C added");
    assert.ok(!/data-testid="text-basin-bowl-shape"[^>]*truncate/.test(appSource) && !/truncate[^"]*"\s+title=\{bowlShapeText/.test(appSource), "no truncate on the shape line");
  });

  it("the shipped catalogue really carries two different labels", async () => {
    const catalog = await readFile(new URL("../src/data/catalog.ts", import.meta.url), "utf8");
    const kf003 = /KF003: \{[^}]*bowlShapeLabel: "([^"]+)"/.exec(catalog)?.[1];
    const kf006 = /KF006: \{[^}]*bowlShapeLabel: "([^"]+)"/.exec(catalog)?.[1];
    assert.ok(kf003 && kf006, "438-C labels missing from the built-in catalogue copy");
    assert.notEqual(kf003, kf006, "the catalogue must make the two models distinguishable");
    assert.equal(bowlShapeText({ sku: "KF027", bowlShapeLabel: undefined }), "", "and still nothing for unchecked models");
  });
});
