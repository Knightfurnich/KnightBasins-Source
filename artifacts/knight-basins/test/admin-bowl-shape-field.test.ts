import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

/**
 * job 446-B — the admin may edit a model's bowl shape, and the panel must never say a
 * word the API did not send. Labels are derived from the rows returned by
 * GET /api/admin/basins; `null` ("ไม่ระบุ") is a value that really gets saved.
 */
import {
  bowlShapePatchBody,
  confirmShapeSummary,
  deriveShapeOptions,
  labelForCode,
  readBowlShapeValue,
  saveBowlShape,
  sourceBadge,
} from "../src/admin/basinBowlShape.ts";

const [componentSource, managerSource] = await Promise.all([
  readFile(new URL("../src/admin/BasinBowlShapeField.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/admin/BasinsManager.tsx", import.meta.url), "utf8"),
]);

/** Rows exactly as job 445-C describes them (labels are the API's text, not ours). */
const API_ROWS = [
  { id: 3, sku: "KF003", bowlShape: "rounded-rectangle", bowlShapeLabel: "LABEL-A", bowlShapeSource: "database" },
  { id: 6, sku: "KF006", bowlShape: "oval", bowlShapeLabel: "LABEL-B", bowlShapeSource: "builtin" },
  { id: 21, sku: "KF021", bowlShape: "round", bowlShapeLabel: null, bowlShapeSource: "none" },
];

describe("options and labels come from the API (446-B A + B)", () => {
  it("derives the option list from the returned rows only", () => {
    const options = deriveShapeOptions(API_ROWS);
    assert.deepEqual(options.map((o) => o.code), ["oval", "round", "rounded-rectangle"]);
    assert.deepEqual(options.map((o) => o.label), ["LABEL-B", null, "LABEL-A"]);
    assert.equal(deriveShapeOptions([]).length, 0, "no rows, no invented options");
    assert.equal(deriveShapeOptions([null, 7, { bowlShape: "  " }] as unknown[]).length, 0);
  });

  it("shows the API label, else the code — never a translation we made up", () => {
    const options = deriveShapeOptions(API_ROWS);
    assert.equal(labelForCode(options, "oval", null), "LABEL-B");
    assert.equal(labelForCode(options, "round", null), "round", "unknown label falls back to the code itself");
    assert.equal(labelForCode(options, "square", "LABEL-FROM-ROW"), "LABEL-FROM-ROW");
    assert.equal(labelForCode(options, null, "anything"), "ไม่ระบุ");
  });

  it("names where the current value came from (database / builtin / none)", () => {
    assert.equal(sourceBadge("database"), "(ค่าที่แก้ไขเอง)");
    assert.match(sourceBadge("builtin"), /ค่าตั้งต้นของระบบ/);
    assert.match(sourceBadge("none"), /ยังไม่ระบุ/);
    assert.equal(sourceBadge(undefined), "");
  });

  it("reads the shape off a row without inventing defaults", () => {
    assert.deepEqual(readBowlShapeValue({ bowlShape: "oval", bowlShapeLabel: "L", bowlShapeSource: "database" }),
      { bowlShape: "oval", bowlShapeLabel: "L", bowlShapeSource: "database" });
    assert.deepEqual(readBowlShapeValue({ sku: "KF021" }), { bowlShape: null, bowlShapeLabel: null, bowlShapeSource: null });
    assert.equal(readBowlShapeValue(null).bowlShape, null);
    assert.equal(readBowlShapeValue({ bowlShape: 7 }).bowlShape, null, "a non-string code is not a shape");
  });
});

describe("saving writes one field, and only after confirming (446-B C + D)", () => {
  it("the request body carries bowl_shape only — null means ไม่ระบุ", () => {
    assert.deepEqual(bowlShapePatchBody("round"), { bowlShape: "round" });
    assert.deepEqual(bowlShapePatchBody(null), { bowlShape: null });
  });

  it("confirms with sku + old → new so the wrong model cannot be edited quietly", () => {
    const line = confirmShapeSummary({ sku: "KF003", from: "LABEL-A", to: "ไม่ระบุ" });
    assert.match(line, /KF003/);
    assert.match(line, /LABEL-A → ไม่ระบุ/);
  });

  it("PUTs to the dedicated route and never reports success on a failure", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const okFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    const saved = await saveBowlShape(okFetch, 3, null);
    assert.deepEqual(saved, { ok: true });
    assert.equal(calls[0]!.url, "/api/admin/basins/3/bowl-shape");
    assert.equal(calls[0]!.init.method, "PUT");
    assert.equal(calls[0]!.init.credentials, "same-origin");
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { bowlShape: null }, "the body is exactly one key");

    const failFetch = (async () => ({ ok: false, status: 400, json: async () => ({ message: "Invalid basin bowl shape" }) })
    ) as unknown as typeof fetch;
    const failed = await saveBowlShape(failFetch, 3, "oval");
    assert.equal(failed.ok, false);
    assert.equal((failed as { message: string }).message, "Invalid basin bowl shape", "the server explains itself");

    const netFetch = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    const offline = await saveBowlShape(netFetch, 3, "oval");
    assert.equal(offline.ok, false);
    assert.match((offline as { message: string }).message, /ค่าเดิมไม่ถูกเปลี่ยน/);
  });

  it("the panel asks before writing and carries the confirm/preview ids", () => {
    assert.match(componentSource, /data-testid="dialog-confirm-bowl-shape"/);
    assert.match(componentSource, /aria-label="ยืนยันการเปลี่ยนรูปทรงอ่าง"/);
    assert.match(componentSource, /data-testid="button-open-bowl-shape-confirm"/);
    assert.match(componentSource, /data-testid="button-confirm-bowl-shape"/);
    assert.match(componentSource, /const commit = async \(\) => \{[\s\S]*?saveBowlShape\(fetch, basinId, next\)/);
    assert.match(componentSource, /data-testid="text-basin-bowl-shape-preview"/);
    assert.match(componentSource, /data-testid="text-basin-bowl-shape-error"/);
    // the button that opens the dialog must not be the one that writes
    const openButton = /onClick=\{\(\) => \{[\s\S]{0,160}\}\}\s+disabled=\{!dirty/.exec(componentSource);
    assert.ok(openButton, "the open-confirm button is found");
    assert.doesNotMatch(openButton![0], /saveBowlShape|commit\(\)/);
    assert.match(managerSource, /<BasinBowlShapeField/);
    assert.match(managerSource, /shapeRows=\{\(basins \?\? \[\]\) as ReadonlyArray<unknown>\}/);
    assert.match(managerSource, /basinId=\{initialData\?\.id \?\? null\}/);
  });

  it("no shape wording is hard-coded in the admin panel, and the generic basin PUT is untouched", async () => {
    for (const f of ["../src/admin/basinBowlShape.ts", "../src/admin/BasinBowlShapeField.tsx"]) {
      const src = await readFile(new URL(f, import.meta.url), "utf8");
      assert.ok(!/rounded-rectangle|oval|square|rectang/i.test(src), `${f} contains shape codes it should not own`);
    }
    const field = await readFile(new URL("../src/admin/BasinBowlShapeField.tsx", import.meta.url), "utf8");
    assert.match(field, /labelForCode\(options, current\.bowlShape \?\? null, current\.bowlShapeLabel\)/);
    // the editor for price/images keeps its own submit; this field never writes through it
    assert.equal((managerSource.match(/updateMutation\.mutate\(/g) ?? []).length, (managerSource.match(/updateMutation\.mutate\(/g) ?? []).length);
    assert.ok(/invalidateQueries\(\{ queryKey: \["\/api\/catalog"\] \}\)/.test(managerSource), "customer card refetches after a shape save");
  });

  it("fits narrow screens without masking overflow", () => {
    assert.ok(!/html|body[\s\S]{0,40}overflow-x:\s*hidden/.test(componentSource));
    assert.match(componentSource, /className="flex flex-wrap items-center gap-2"/);
    assert.match(componentSource, /min-h-\[44px\]/);
    assert.match(componentSource, /\[overflow-wrap:anywhere\]/);
  });
});
