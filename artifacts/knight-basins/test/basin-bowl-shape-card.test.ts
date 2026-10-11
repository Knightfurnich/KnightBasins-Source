import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

/**
 * job 439-B: the basin card may only show a bowl shape that the catalogue
 * supplies (job 438-C). Today that field does not exist anywhere, so the correct
 * behaviour is *no extra line* -- these tests lock both halves of that rule.
 */
const appUrl = new URL("../src/App.tsx", import.meta.url);
const appSource = await readFile(appUrl, "utf8");
const appAst = ts.createSourceFile(fileURLToPath(appUrl), appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const wanted = new Set(["bowlShapeLabel", "syncBowlShapesFromCatalog", "bowlShapeForSku"]);
function loadAccessor() {
  const fns = appAst.statements.filter(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && Boolean(st.name) && wanted.has(st.name!.text),
  );
  assert.equal(fns.length, wanted.size, "App.tsx must keep the bowl-shape helpers as plain function declarations");
  const keysDecl = /const BOWL_SHAPE_KEYS = (\[[^\]]*\]) as const;/.exec(appSource)![1];
  const body = fns.map((fn) => appSource.slice(fn.getStart(appAst), fn.end).replace("export function", "function")).join("\n");
  const compiled = ts.transpileModule(`const BOWL_SHAPE_KEYS = ${keysDecl};\nconst bowlShapeBySku = new Map<string, string>();\n${body}\nreturn { bowlShapeLabel, syncBowlShapesFromCatalog, bowlShapeForSku };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(compiled)() as {
    bowlShapeLabel: (product: unknown) => string;
    syncBowlShapesFromCatalog: (rows: unknown) => void;
    bowlShapeForSku: (sku: string) => string;
  };
}
const { bowlShapeLabel, syncBowlShapesFromCatalog, bowlShapeForSku } = loadAccessor();

describe("bowl shape comes from the catalogue, never from us (439-B A)", () => {
  it("returns the catalogue wording verbatim (test fixtures only)", () => {
    // these two literals are *test data* standing in for 438-C, not app copy
    assert.equal(bowlShapeLabel({ bowlShapeText: "TEST-SQUARE-ROUND" }), "TEST-SQUARE-ROUND");
    assert.equal(bowlShapeLabel({ bowlShape: "TEST-OVAL" }), "TEST-OVAL");
    assert.equal(bowlShapeLabel({ bowlShapeText: "  TEST-TRIM  " }), "TEST-TRIM", "trim, do not pad");
  });

  it("returns nothing when the data does not carry the field", () => {
    assert.equal(bowlShapeLabel({ sku: "KF003", bowlMm: "350 × 500 × 130 mm" }), "", "no invented shape");
    assert.equal(bowlShapeLabel({ bowlShapeText: "" }), "");
    assert.equal(bowlShapeLabel({ bowlShapeText: "   " }), "", "whitespace is not data");
    assert.equal(bowlShapeLabel({ bowlShapeText: null }), "");
    assert.equal(bowlShapeLabel(undefined), "");
    assert.equal(bowlShapeLabel(null), "");
  });

  it("reads the shape off the raw catalogue rows and keys it by sku", () => {
    syncBowlShapesFromCatalog([
      { sku: "KF003", bowlMm: "350 × 500 × 130 mm", bowlShapeText: "TEST-SQUARE-M" },
      { sku: "KF006", bowlMm: "350 × 500 × 130 mm", bowlShapeText: "TEST-OVAL-M" },
      { sku: "KF021", bowlMm: "350 × 500 × 130 mm" },
    ]);
    assert.equal(bowlShapeForSku("KF003"), "TEST-SQUARE-M");
    assert.equal(bowlShapeForSku("KF006"), "TEST-OVAL-M");
    assert.notEqual(bowlShapeForSku("KF003"), bowlShapeForSku("KF006"), "KF003/KF006 must read differently");
    assert.equal(bowlShapeForSku("KF021"), "", "a row without the column shows nothing");
    assert.equal(bowlShapeForSku("ZZ999"), "", "unknown sku shows nothing");
  });

  it("resyncing with a shape-free catalogue clears stale labels", () => {
    syncBowlShapesFromCatalog([{ sku: "KF003", bowlShapeText: "TEST-SQUARE-M" }]);
    assert.equal(bowlShapeForSku("KF003"), "TEST-SQUARE-M");
    syncBowlShapesFromCatalog([{ sku: "KF003", bowlMm: "350 × 500 × 130 mm" }]);
    assert.equal(bowlShapeForSku("KF003"), "", "no ghost text after the field disappears");
    syncBowlShapesFromCatalog(undefined);
    assert.equal(bowlShapeForSku("KF003"), "", "a failed catalogue load must not leave shapes behind");
  });

  it("two models with different catalogue values produce two different labels", () => {
    const a = bowlShapeLabel({ bowlShapeText: "TEST-A" });
    const b = bowlShapeLabel({ bowlShapeText: "TEST-B" });
    assert.notEqual(a, b, "a single-value renderer would silently pass this suite");
  });
});

describe("the card only renders what data supports (439-B B + F)", () => {
  it("is gated on a truthy label and carries a stable test id", () => {
    assert.match(appSource, /\{bowlShapeForSku\(product\.sku\) && \(/);
    assert.match(appSource, /syncBowlShapesFromCatalog\(remoteCatalog\.basins\);/, "must feed the raw rows, not the mapped models");
    assert.match(appSource, /remoteCatalog\.basins\.map\(basinProductFromCatalog\)/, "the mapped card models stay Chai\"s — we do not change them here")
    // never unmounted/garbled by a page-level overflow mask
    assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(appSource) && !/body\s*\{[^}]*overflow-x:\s*hidden/.test(appSource));
  });

  it("no shape sentence is hard-coded anywhere in src", async () => {
    const files = ["src/App.tsx", "src/pages/PortfolioPage.tsx"];
    for (const f of files) {
      const src = await readFile(new URL("../" + f, import.meta.url), "utf8");
      assert.ok(!/หลุมสี่เหลี่ยม|หลุมวงรี|รูปทรงหลุม|ไม่มีรูน้ำล้น/.test(src), `${f} contains hardcoded bowl-shape wording`);
    }
  });

  it("438-C has not landed yet, so the live catalogue keys stay shape-free", async () => {
    // The guard fails the day Chai ships the field -- rename the accessor input then,
    // which is the intended signal to flip the UI on.
    const apiCatalog = process.env["PRODUCT_SHAPES_JSON"];
    if (!apiCatalog) {
      const data = await readFile(new URL("../src/data/catalog-data.ts", import.meta.url), "utf8").catch(() => "");
      if (data) assert.ok(!/bowlShape/i.test(data), "catalogue already carries a shape field — wire it and delete this guard");
      assert.equal(bowlShapeLabel({}), "");
      return;
    }
    const rows = JSON.parse(apiCatalog) as Array<Record<string, unknown>>;
    const withShape = rows.filter((r) => bowlShapeLabel(r));
    assert.ok(withShape.length > 0, "PRODUCT_SHAPES_JSON given but nothing renders");
  });
});
