import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { basinPrices, basinCategories, systemAuditLogs } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import {
  BOWL_SHAPES,
  seedBowlShapeFields,
  SEEDED_BOWL_SKUS,
  parseBowlShapeInput,
  resolveBowlShape,
  withBasinBowlShape,
} from "../src/lib/basin-bowl-shape.ts";
import { PRODUCTS } from "../../knight-basins/src/data/catalog.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job 445-C (revision 2): bowl shape as ONE nullable column on basin_prices, edited by the admin. The overflow hole is a
// made-to-order option, not a spec of the model: no column, no label wording, `bowlOverflowHole` is an always-null key.
// Customer-visible values before and after the migration must be identical: an empty column means "ask the built-in table".
// Names for Boy (446-B): column bowl_shape · API fields bowlShape (+ bowlShapeLabel, read-only; bowlOverflowHole always null)
// · save with PUT /api/admin/basins/:id/bowl-shape  { "bowlShape": "oval" | null }.

const migrationSql = readFileSync(new URL("../../../deploy/hostinger/migrations/025_basin_bowl_shape.sql", import.meta.url), "utf8");
const seedSql = readFileSync(new URL("../../../deploy/hostinger/migrations/026_basin_bowl_shape_seed.sql", import.meta.url), "utf8");
const seedCodeOnly = seedSql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
const codeOnly = migrationSql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

describe("migration 025", () => {
  it("is additive: one nullable column, IF NOT EXISTS, nothing dropped, truncated or deleted", () => {
    assert.match(codeOnly, /ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_shape varchar\(24\);/);
    assert.ok(!/bowl_overflow_hole|overflow/i.test(codeOnly), "no overflow-hole column (it is not a spec of the model)");
    assert.ok(!/(DROP|TRUNCATE|DELETE)/i.test(codeOnly), "no destructive statement");
    assert.ok(!/NOT NULL/i.test(codeOnly), "the column stays nullable");
    assert.ok(!/DEFAULT/i.test(codeOnly), "no default: an empty column means 'not specified'");
    assert.equal((codeOnly.match(/ADD COLUMN/g) ?? []).length, 1, "exactly one column");
  });

  it("seeds only KF003, KF006 and KF025, each guarded so an admin edit or a second run is never overwritten", () => {
    const updates = [...codeOnly.matchAll(/UPDATE basin_prices SET ([^;]+?)\s+WHERE ([^;]+);/gs)];
    assert.deepEqual(updates.map((m) => /sku = '(KF\d{3})'/.exec(m[2]!)?.[1]), ["KF003", "KF006", "KF025"]);
    for (const m of updates) assert.match(m[2]!, /AND bowl_shape IS NULL$/, "guarded");
  });

  it("the seeded values equal what the built-in table says for those three models (customer sees the same before and after)", () => {
    const seeded = [...codeOnly.matchAll(/UPDATE basin_prices SET bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})'/g)];
    assert.equal(seeded.length, 3);
    for (const m of seeded) {
      const out = resolveBowlShape({ sku: m[2]!, bowlShape: m[1] });
      assert.equal(out.source, "database", m[2]);
      assert.deepEqual(out.fields, seedBowlShapeFields(m[2]!), m[2]);
    }
  });

  it("the schema has the column bowl_shape and no overflow-hole column", () => {
    assert.equal(basinPrices.bowlShape.name, "bowl_shape");
    assert.ok(!("bowlOverflowHole" in basinPrices), "no bowlOverflowHole column in the schema");
  });
});

describe("migration 026 (job 449-C)", () => {
  it("is data only and additive: UPDATEs of one column, no schema change, nothing dropped or deleted", () => {
    assert.ok(!/\b(ALTER|CREATE|DROP|TRUNCATE|DELETE|INSERT)\b/i.test(seedCodeOnly), "no schema change, no destructive statement");
    assert.ok(!/overflow/i.test(seedCodeOnly), "nothing about an overflow hole");
    const updates = [...seedCodeOnly.matchAll(/UPDATE basin_prices SET bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})' AND bowl_shape IS NULL;/g)];
    assert.equal(updates.length, 22, "22 rows, each guarded so an admin edit or clear is never overwritten");
    assert.equal(seedCodeOnly.split(";").filter((part) => part.trim()).length, 22, "nothing but those 22 guarded UPDATEs");
  });

  it("with 025 it covers exactly the 25 surveyed models with exactly the values the seed table holds, and none of the five that must stay empty", () => {
    const all = new Map<string, string>();
    for (const m of [...codeOnly.matchAll(/bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})'/g), ...seedCodeOnly.matchAll(/bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})'/g)]) all.set(m[2]!, m[1]!);
    assert.equal(all.size, 25);
    for (const [sku, shape] of all) assert.equal(seedBowlShapeFields(sku).bowlShape, shape, sku);
    for (const sku of ["KF007", "KF009", "KF010", "KF029", "KF030"]) assert.ok(!all.has(sku), sku);
  });
});

describe("what the customer sees (resolveBowlShape / withBasinBowlShape)", () => {
  it("a database value wins over the built-in table, and the label is built from it in code", () => {
    const out = resolveBowlShape({ sku: "KF002", bowlShape: "oval" });
    assert.equal(out.source, "database");
    assert.deepEqual(out.fields, { bowlShape: "oval", bowlShapeLabel: "หลุมวงรี", bowlOverflowHole: null });
  });

  it("works for a model the built-in table does not know (the admin can specify KF007)", () => {
    const out = withBasinBowlShape({ sku: "KF007", bowlShape: "round" });
    assert.equal(out.bowlShape, "round");
    assert.equal(out.bowlShapeLabel, "หลุมกลม");
    assert.equal(out.bowlOverflowHole, null);
  });

  it("an empty column means 'not specified' and NOTHING falls back: no value, no label, never an error (job 449-C)", () => {
    for (const sku of ["KF002", "KF003", "KF025", "KF007", "KF029"]) {
      assert.deepEqual(resolveBowlShape({ sku, bowlShape: null }), { fields: { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null }, source: "none" }, sku);
    }
    assert.equal(resolveBowlShape({ sku: "KF002" }).source, "none");
  });

  it("a value nobody should have written (unknown shape) is ignored, not shown, and the seed table is not consulted", () => {
    assert.equal(resolveBowlShape({ sku: "KF002", bowlShape: "triangle" }).source, "none");
    assert.equal(withBasinBowlShape({ sku: "KF002", bowlShape: "triangle" }).bowlShapeLabel, null);
  });

  it("the customer path never reads the seed table (read from the source)", () => {
    const lib = readFileSync(new URL("../src/lib/basin-bowl-shape.ts", import.meta.url), "utf8");
    const resolver = lib.slice(lib.indexOf("export function resolveBowlShape"), lib.indexOf("export function withBasinBowlShape"));
    assert.ok(resolver.length > 100 && !/CHECKED_BOWLS|seedBowlShapeFields/.test(resolver), "resolveBowlShape does not use the seed table");
    for (const file of ["../src/routes/catalog.ts", "../src/routes/admin-router.ts"]) {
      const text = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.ok(!/seedBowlShapeFields|SEEDED_BOWL_SKUS|CHECKED_BOWLS/.test(text), `${file} does not read the seed table`);
    }
  });

  it("no label for any shape, any model and any database value says anything about an overflow hole; bowlOverflowHole is always null", () => {
    for (const shape of BOWL_SHAPES) {
      const out = withBasinBowlShape({ sku: "KF007", bowlShape: shape });
      assert.ok(out.bowlShapeLabel && /^หลุม/.test(out.bowlShapeLabel), shape);
      assert.ok(!/น้ำล้น/.test(out.bowlShapeLabel!), `${shape}: no overflow wording`);
      assert.equal(out.bowlOverflowHole, null, shape);
    }
    for (const product of PRODUCTS) {
      const out = withBasinBowlShape({ sku: product.sku, bowlShape: null });
      assert.ok(!/น้ำล้น/.test(out.bowlShapeLabel ?? ""), product.sku);
      assert.equal(out.bowlOverflowHole, null, product.sku);
    }
  });

  it("BEFORE = AFTER: for all 30 models, what the database answers once 025 + 026 are applied equals what the built-in table answered before — zero differences", () => {
    const dbRows = new Map<string, string>();
    for (const m of [...migrationSql.matchAll(/UPDATE basin_prices SET bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})' AND bowl_shape IS NULL;/g), ...seedSql.matchAll(/UPDATE basin_prices SET bowl_shape = '([a-z-]+)' WHERE sku = '(KF\d{3})' AND bowl_shape IS NULL;/g)]) {
      assert.ok(!dbRows.has(m[2]!), `${m[2]} is seeded once`);
      dbRows.set(m[2]!, m[1]!);
    }
    assert.equal(PRODUCTS.length, 30);
    let differences = 0;
    for (const product of PRODUCTS) {
      const triple = (o: { bowlShape: unknown; bowlShapeLabel: unknown; bowlOverflowHole: unknown }) => JSON.stringify([o.bowlShape, o.bowlShapeLabel, o.bowlOverflowHole]);
      const before = triple(seedBowlShapeFields(product.sku));
      const after = triple(withBasinBowlShape({ sku: product.sku, bowlShape: dbRows.get(product.sku) ?? null }));
      if (before !== after) differences += 1;
      assert.equal(after, before, `${product.sku}: before ${before} · after ${after}`);
    }
    assert.equal(differences, 0);
    assert.equal(dbRows.size, 25);
    assert.deepEqual([...dbRows.keys()].sort(), [...SEEDED_BOWL_SKUS].sort());
    for (const sku of ["KF007", "KF009", "KF010", "KF029", "KF030"]) assert.ok(!dbRows.has(sku), `${sku} stays empty`);
  });

  it("CLEAR = HIDE: take one seeded model's value away and its line is gone; put it back and the same text returns", () => {
    const withValue = withBasinBowlShape({ sku: "KF002", bowlShape: "rounded-rectangle" });
    assert.equal(withValue.bowlShapeLabel, "หลุมสี่เหลี่ยมมุมมน");
    const cleared = withBasinBowlShape({ sku: "KF002", bowlShape: null });
    assert.equal(cleared.bowlShape, null);
    assert.equal(cleared.bowlShapeLabel, null);
    assert.equal(withBasinBowlShape({ sku: "KF002", bowlShape: "rounded-rectangle" }).bowlShapeLabel, withValue.bowlShapeLabel);
  });

  it("adds nothing but the three keys: price, size, name, code, order and media of the row are untouched", () => {
    const row = { sku: "KF003", colorCode: "RW316", priceTHB: 19000, dimensions: "600 × 800 × 200 mm", sortOrder: 2, imageUrl: "x", bowlShape: "rounded-rectangle" };
    const { bowlShape, bowlShapeLabel, bowlOverflowHole, ...rest } = withBasinBowlShape(row);
    assert.deepEqual(rest, { sku: "KF003", colorCode: "RW316", priceTHB: 19000, dimensions: "600 × 800 × 200 mm", sortOrder: 2, imageUrl: "x" });
    assert.equal(bowlShape, "rounded-rectangle");
    assert.equal(bowlShapeLabel, "หลุมสี่เหลี่ยมมุมมน");
    assert.equal(bowlOverflowHole, null);
  });
});

describe("parseBowlShapeInput", () => {
  it("accepts every known shape, and null (clears the column)", () => {
    for (const shape of BOWL_SHAPES) assert.deepEqual(parseBowlShapeInput({ bowlShape: shape }), { ok: true, value: { bowlShape: shape } });
    assert.deepEqual(parseBowlShapeInput({ bowlShape: null }), { ok: true, value: { bowlShape: null } });
  });

  it("an older client may still send bowlOverflowHole: null, but never a value", () => {
    assert.deepEqual(parseBowlShapeInput({ bowlShape: "oval", bowlOverflowHole: null }), { ok: true, value: { bowlShape: "oval" } });
    assert.equal(parseBowlShapeInput({ bowlShape: "oval", bowlOverflowHole: true }).ok, false);
    assert.equal(parseBowlShapeInput({ bowlShape: "oval", bowlOverflowHole: false }).ok, false);
  });

  it("rejects what would put a wrong value in the database", () => {
    for (const bad of [null, "oval", [], {}, { bowlOverflowHole: null }, { bowlShape: "triangle" }, { bowlShape: 3 }, { bowlShape: undefined }]) {
      assert.equal(parseBowlShapeInput(bad).ok, false, JSON.stringify(bad));
    }
  });
});

// ---- the admin routes, against an in-memory fake of basin_prices (same approach as admin-basins-topview.test.ts) ----

type Row = Record<string, unknown> & { id: number; sku: string };
const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
};
const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

function paramValue(condition: unknown): unknown {
  const chunks = (condition as { queryChunks?: unknown[] } | undefined)?.queryChunks;
  const param = Array.isArray(chunks) ? chunks.find((c) => (c as { constructor?: { name?: string } })?.constructor?.name === "Param") as { value?: unknown } | undefined : undefined;
  return param?.value;
}

function fakeDatabase(initial: Row[]) {
  const rows = initial.map((r) => ({ ...r }));
  const audits: Array<Record<string, unknown>> = [];
  return {
    rows,
    audits,
    select: () => ({
      from: (table: unknown) => {
        if (table === basinCategories) return { orderBy: async () => [] };
        return {
          orderBy: async () => rows.map((r) => ({ ...r })),
          where: (condition: unknown) => ({ limit: async () => rows.filter((r) => r.id === paramValue(condition)).map((r) => ({ ...r })) }),
        };
      },
    }),
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) { changes = values; return builder; },
        where: (condition: unknown) => ({
          returning: async () => {
            const index = rows.findIndex((r) => r.id === paramValue(condition));
            if (index === -1) return [];
            rows[index] = { ...rows[index]!, ...changes };
            return [{ ...rows[index]! }];
          },
        }),
      };
      return builder;
    },
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => { if (table === systemAuditLogs) audits.push(values); },
    }),
  };
}

function basinRow(id: number, sku: string, extra: Record<string, unknown> = {}): Row {
  const now = new Date("2026-10-11T00:00:00.000Z");
  return {
    id, sku, colorCode: "WHT", colorName: "White", priceTHB: 19000, category: "counter basin", categoryId: null,
    dimensions: "600 × 800 × 200 mm", basinDimensions: "350 × 500 × 130 mm", bowlMm: "350 × 500 × 130 mm", imageTone: "light",
    imageUrl: "https://knightbasins.com/x.jpg", galleryImageUrls: [], quoteImageUrl: null, videoUrl: null, topViewImageUrl: null,
    active: true, sortOrder: id, createdAt: now, updatedAt: now, bowlShape: null, ...extra,
  };
}

async function start(database: unknown) {
  const mod = await importTypeScriptModule<{ createAdminRouter: (db: unknown) => Parameters<typeof express["use"]>[1] }>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", mod.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const l = app.listen(0, "127.0.0.1", () => resolve(l));
    l.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))) };
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "bowl-shape-db-test-password";
  process.env["DATABASE_URL"] = "postgres://bowl-shape-db-test";
  process.env["SESSION_SECRET"] = "bowl-shape-db-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});
after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
afterEach(() => { delete process.env["ADMIN_ROLE"]; delete process.env["ADMIN_PERMISSIONS"]; });

const put = (url: string, cookie: string | null, body: unknown) => fetch(url, {
  method: "PUT",
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

describe("PUT /admin/basins/:id/bowl-shape and GET /admin/basins", () => {
  it("needs a signed-in admin", async () => {
    const server = await start(fakeDatabase([basinRow(1, "KF001")]));
    try {
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, null, { bowlShape: "oval" })).status, 401);
    } finally { await server.close(); }
  });

  it("GET shows what the customer sees and where it comes from (database / none)", async () => {
    const server = await start(fakeDatabase([
      basinRow(1, "KF003", { bowlShape: "rounded-rectangle" }),
      basinRow(2, "KF002"),
      basinRow(3, "KF007"),
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const list = await (await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } })).json() as Array<Record<string, unknown>>;
      assert.deepEqual(list.map((b) => [b["sku"], b["bowlShape"], b["bowlShapeLabel"], b["bowlOverflowHole"], b["bowlShapeSource"]]), [
        ["KF003", "rounded-rectangle", "หลุมสี่เหลี่ยมมุมมน", null, "database"],
        ["KF002", null, null, null, "none"],
        ["KF007", null, null, null, "none"],
      ]);
    } finally { await server.close(); }
  });

  it("saves a shape, persists it for the next GET, and writes who changed what to the audit trail", async () => {
    const db = fakeDatabase([basinRow(3, "KF007")]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await put(`${server.url}/api/admin/basins/3/bowl-shape`, cookie, { bowlShape: "oval" });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: 3, sku: "KF007", bowlShape: "oval", bowlShapeLabel: "หลุมวงรี", bowlOverflowHole: null, bowlShapeSource: "database" });
      assert.equal(db.rows[0]!["bowlShape"], "oval");
      assert.ok(!("bowlOverflowHole" in db.rows[0]!), "nothing about an overflow hole is written");
      assert.equal(db.rows[0]!["priceTHB"], 19000, "price is not touched");
      const list = await (await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } })).json() as Array<Record<string, unknown>>;
      assert.equal(list[0]!["bowlShape"], "oval");
      await new Promise((resolve) => setTimeout(resolve, 20)); // audit write is fire-and-forget
      const audit = db.audits.find((a) => a["action"] === "admin.basin.bowl_shape");
      assert.ok(audit, "an audit event was written");
      assert.equal(audit!["targetId"], "KF007");
      assert.equal(audit!["actorType"], "admin");
      assert.ok(String(audit!["actorName"]).length > 0, "it says who");
      assert.deepEqual((audit!["details"] as { changes: unknown }).changes, { bowlShape: { from: null, to: "oval" } });
    } finally { await server.close(); }
  });

  it("null clears the column: the line is hidden (source none) and null is saved as null", async () => {
    const db = fakeDatabase([basinRow(1, "KF006", { bowlShape: "round" })]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: null });
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body["bowlShapeSource"], "none");
      assert.equal(body["bowlShape"], null);
      assert.equal(body["bowlShapeLabel"], null);
      assert.equal(db.rows[0]!["bowlShape"], null);
    } finally { await server.close(); }
  });

  it("refuses a bad body (400) and an unknown basin (404), and changes nothing", async () => {
    const db = fakeDatabase([basinRow(1, "KF001")]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: "triangle" })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, {})).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: "oval", bowlOverflowHole: true })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/abc/bowl-shape`, cookie, { bowlShape: "oval" })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/99/bowl-shape`, cookie, { bowlShape: "oval" })).status, 404);
      assert.equal(db.rows[0]!["bowlShape"], null);
    } finally { await server.close(); }
  });

  it("the generic basin edit cannot blank the columns: the form's body never reaches them", () => {
    const source = readFileSync(new URL("../src/routes/admin-router.ts", import.meta.url), "utf8");
    const generic = source.slice(source.indexOf('router.put("/admin/basins/:id", '), source.indexOf('router.put("/admin/basins/:id/bowl-shape"'));
    assert.ok(generic.length > 200);
    assert.ok(!/bowlShape|bowlOverflowHole|bowl_shape/.test(generic), "the generic PUT does not mention the bowl columns");
  });
});
