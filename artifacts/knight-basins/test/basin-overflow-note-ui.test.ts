import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

/**
 * job 448-B — the catalogue-level overflow-hole note.
 *
 * The point of these tests is the negative: the customer-facing code must not own the sentence.
 * Only `GET /api/catalog` may say it (job 447-C ข้อ C, `basinOverflowNote`), so if the catalogue
 * says nothing, the page has to say nothing too. The wording boss approved on 11 Oct 2026 is
 * deliberately never written in this repo's source, so nothing here quotes it either.
 */
const componentUrl = new URL("../src/components/BasinOverflowNote.tsx", import.meta.url);
const componentSource = readFileSync(componentUrl, "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const ast = ts.createSourceFile(fileURLToPath(componentUrl), componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function loadReader() {
  const fns = ast.statements.filter(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && Boolean(st.name) && st.name!.text === "overflowNoteFromCatalog",
  );
  assert.equal(fns.length, 1, "the reader must stay one plain function declaration");
  const body = componentSource.slice(fns[0].getStart(ast), fns[0].end).replace("export function", "function");
  const keyDecl = /export const BASIN_OVERFLOW_NOTE_KEY = ("[^"]+");/.exec(componentSource)![1];
  const compiled = ts.transpileModule(
    `const BASIN_OVERFLOW_NOTE_KEY = ${keyDecl};\n${body}\nreturn { overflowNoteFromCatalog };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return (new Function(compiled)() as { overflowNoteFromCatalog: (catalog: unknown) => string }).overflowNoteFromCatalog;
}

const readNote = loadReader();
const NOTE_MARKERS = /รูน้ำล้น|สั่งได้ทั้งมีและไม่มี|แจ้งทีมขาย/;

describe("the sentence is the catalogue's, never ours (448-B E)", () => {
  it("returns exactly what the API sent, trimmed", () => {
    assert.equal(readNote({ basinOverflowNote: "  ข้อความจากแคตตาล็อก  " }), "ข้อความจากแคตตาล็อก");
  });

  it("says nothing when the catalogue says nothing — no substitute copy", () => {
    assert.equal(readNote({}), "", "missing key");
    assert.equal(readNote({ basinOverflowNote: null }), "");
    assert.equal(readNote({ basinOverflowNote: 123 }), "", "a number is not copy");
    assert.equal(readNote({ basinOverflowNote: "   " }), "", "whitespace is not data");
    assert.equal(readNote(undefined), "");
    assert.equal(readNote(null), "");
    assert.equal(readNote("basinOverflowNote"), "", "only an object carries the note");
  });

  it("no customer-facing source file contains the approved wording", () => {
    assert.doesNotMatch(componentSource, NOTE_MARKERS, "BasinOverflowNote.tsx prints the sentence itself");
    assert.doesNotMatch(appSource, NOTE_MARKERS, "App.tsx prints the sentence itself");
    const pages = ["src/components/StudioPage.tsx", "src/components/SalesGuide.tsx", "src/components/QuickFAQ.tsx"];
    for (const file of pages) {
      assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), NOTE_MARKERS, `${file} prints it`);
    }
    assert.equal((componentSource.match(/BASIN_OVERFLOW_NOTE_KEY = "basinOverflowNote"/g) ?? []).length, 1, "the field name lives in one place");
  });
});

describe("one line at the basin index, hidden when there is no note (448-B A + B)", () => {
  it("renders a single accessible note node and returns null when empty", () => {
    assert.match(componentSource, /if \(!note\) return null;/);
    assert.equal((componentSource.match(/data-testid="text-basin-overflow-note"/g) ?? []).length, 1, "exactly one renderer");
    assert.match(componentSource, /role="note"/);
  });

  it("is placed with the basin list, fed by the raw catalogue payload", () => {
    assert.match(appSource, /<BasinOverflowNote catalog=\{catalog\} \/>\s*\{filtered\.length \? <section className="product-grid">/,
      "the note sits directly above the basin cards");
    assert.match(appSource, /<HomePage[^>]*products=\{activeBasinProducts\} catalog=\{remoteCatalog\}/, "the untouched API object is threaded in");
    assert.equal((appSource.match(/<BasinOverflowNote/g) ?? []).length, 1, "one line per page, not one per card");
  });

  it("keeps the per-model shape line gated on catalogue data (job B)", () => {
    assert.match(appSource, /\{bowlShapeText\(product\) && \(/, "card still shows bowl shape only when the catalogue sends a label");
    assert.doesNotMatch(appSource, /bowlOverflowHole[\s\S]{0,80}(มีรู|ไม่มีรู)/, "no per-model overflow claim built from the boolean");
  });

  it("is a wrapping line, never a clipped or masked one (job D)", () => {
    assert.match(componentSource, /\[overflow-wrap:anywhere\]/);
    assert.doesNotMatch(componentSource, /truncate|line-clamp|overflow-x:\s*hidden|overflow-x-hidden/);
    // layout lives on the element (Tailwind utilities); src/index.css stays untouched - it is not in this job's SCOPE
    assert.match(componentSource, /className="catalog-overflow-note price-note block mb-4 text-pretty leading-relaxed"/);
    assert.doesNotMatch(cssSource, /catalog-overflow-note/, "index.css must not grow rules for job 448-B");
    // the site forces `font-size: var(--storefront-copy-size) !important` on .page-wrap p, so no size fight here
    assert.doesNotMatch(componentSource, /text-xs|text-sm|!important|truncate|overflow-hidden/);
  });
});
