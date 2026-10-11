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
  bowlShapeFields,
  parseBowlShapeInput,
  resolveBowlShape,
  withBasinBowlShape,
} from "../src/lib/basin-bowl-shape.ts";
import { PRODUCTS } from "../../knight-basins/src/data/catalog.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job 445-C: bowl shape / overflow hole as two nullable columns on basin_prices, edited by the admin.
// Customer-visible values before and after the migration must be identical: an empty column means "ask the built-in table".
// Names for Boy (446-B): columns bowl_shape + bowl_overflow_hole · API fields bowlShape + bowlOverflowHole (+ bowlShapeLabel, read-only)
// · save with PUT /api/admin/basins/:id/bowl-shape  { "bowlShape": "oval" | null, "bowlOverflowHole": true | false | null }.

const migrationSql = readFileSync(new URL("../../../deploy/hostinger/migrations/025_basin_bowl_shape.sql", import.meta.url), "utf8");
const codeOnly = migrationSql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

describe("migration 025", () => {
  it("is additive: two nullable columns, IF NOT EXISTS, nothing dropped, truncated or deleted", () => {
    assert.match(codeOnly, /ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_shape varchar\(24\);/);
    assert.match(codeOnly, /ALTER TABLE basin_prices ADD COLUMN IF NOT EXISTS bowl_overflow_hole boolean;/);
    assert.ok(!/\b(DROP|TRUNCATE|DELETE)\b/i.test(codeOnly), "no destructive statement");
    assert.ok(!/NOT NULL/i.test(codeOnly), "the columns stay nullable");
    assert.ok(!/\bDEFAULT\b/i.test(codeOnly), "no default: an empty column means 'not specified'");
  });

  it("seeds only KF003, KF006 and KF025, each guarded so an admin edit or a second run is never overwritten", () => {
    const updates = [...codeOnly.matchAll(/UPDATE basin_prices SET ([^;]+?)\s+WHERE ([^;]+);/gs)];
    assert.deepEqual(updates.map((m) => /sku = '(KF\d{3})'/.exec(m[2]!)?.[1]), ["KF003", "KF006", "KF025"]);
    for (const m of updates) assert.match(m[2]!, /bowl_shape IS NULL AND bowl_overflow_hole IS NULL/, "guarded");
  });

  it("the seeded values equal what the built-in table says for those three models (customer sees the same before and after)", () => {
    for (const m of codeOnly.matchAll(/UPDATE basin_prices SET ([^;]+?)\s+WHERE sku = '(KF\d{3})'/gs)) {
      const sku = m[2]!;
      const shape = /bowl_shape = '([a-z-]+)'/.exec(m[1]!)?.[1];
      const holeText = /bowl_overflow_hole = (true|false)/.exec(m[1]!)?.[1];
      const seeded = resolveBowlShape({ sku, bowlShape: shape, bowlOverflowHole: holeText === undefined ? null : holeText === "true" });
      assert.equal(seeded.source, "database", sku);
      assert.deepEqual(seeded.fields, bowlShapeFields(sku), sku);
    }
  });

  it("the schema names the columns bowl_shape and bowl_overflow_hole", () => {
    assert.equal(basinPrices.bowlShape.name, "bowl_shape");
    assert.equal(basinPrices.bowlOverflowHole.name, "bowl_overflow_hole");
  });
});

describe("what the customer sees (resolveBowlShape / withBasinBowlShape)", () => {
  it("a database value wins over the built-in table, and the label is built from it", () => {
    const out = resolveBowlShape({ sku: "KF002", bowlShape: "oval", bowlOverflowHole: true });
    assert.equal(out.source, "database");
    assert.deepEqual(out.fields, { bowlShape: "oval", bowlShapeLabel: "หลุมวงรี มีรูน้ำล้น", bowlOverflowHole: true });
  });

  it("works for a model the built-in table does not know (the admin can specify KF007)", () => {
    const out = withBasinBowlShape({ sku: "KF007", bowlShape: "oval", bowlOverflowHole: null });
    assert.equal(out.bowlShape, "oval");
    assert.equal(out.bowlShapeLabel, "หลุมวงรี");
    assert.equal(out.bowlOverflowHole, null);
  });

  it("an empty column falls back to the built-in table; no table entry means nothing (null), never an error", () => {
    assert.equal(resolveBowlShape({ sku: "KF002", bowlShape: null, bowlOverflowHole: null }).source, "builtin");
    assert.deepEqual(resolveBowlShape({ sku: "KF002", bowlShape: null, bowlOverflowHole: null }).fields, bowlShapeFields("KF002"));
    assert.deepEqual(resolveBowlShape({ sku: "KF007" }).fields, { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null });
    assert.equal(resolveBowlShape({ sku: "KF007" }).source, "none");
    assert.equal(resolveBowlShape({ sku: "KF029", bowlShape: null }).source, "none");
  });

  it("a value nobody should have written (unknown shape, hole without a shape) is ignored, not shown", () => {
    assert.deepEqual(resolveBowlShape({ sku: "KF002", bowlShape: "triangle", bowlOverflowHole: true }).fields, bowlShapeFields("KF002"));
    assert.equal(resolveBowlShape({ sku: "KF007", bowlShape: null, bowlOverflowHole: true }).source, "none");
  });

  it("BEFORE = AFTER: for all 30 models, a row before the migration (no columns), after it (only the 3 seeds) and with every column empty give the identical text", () => {
    const seeds: Record<string, { bowlShape: string; bowlOverflowHole: boolean | null }> = {
      KF003: { bowlShape: "rounded-rectangle", bowlOverflowHole: false },
      KF006: { bowlShape: "oval", bowlOverflowHole: true },
      KF025: { bowlShape: "round", bowlOverflowHole: null },
    };
    assert.equal(PRODUCTS.length, 30);
    for (const product of PRODUCTS) {
      const triple = (o: { bowlShape: unknown; bowlShapeLabel: unknown; bowlOverflowHole: unknown }) => [o.bowlShape, o.bowlShapeLabel, o.bowlOverflowHole];
      const before = triple(withBasinBowlShape({ sku: product.sku }));
      const afterSeeded = triple(withBasinBowlShape({ sku: product.sku, ...(seeds[product.sku] ?? { bowlShape: null, bowlOverflowHole: null }) }));
      const afterEmpty = triple(withBasinBowlShape({ sku: product.sku, bowlShape: null, bowlOverflowHole: null }));
      assert.deepEqual(afterSeeded, before, `${product.sku} after the seed`);
      assert.deepEqual(afterEmpty, before, `${product.sku} with empty columns`);
      assert.deepEqual(before, triple(bowlShapeFields(product.sku)), `${product.sku} equals the built-in table`);
    }
  });

  it("adds nothing but the three keys: price, size, name, code, order and media of the row are untouched", () => {
    const row = { sku: "KF003", colorCode: "RW316", priceTHB: 19000, dimensions: "600 × 800 × 200 mm", sortOrder: 2, imageUrl: "x", bowlShape: "rounded-rectangle", bowlOverflowHole: false };
    const { bowlShape, bowlShapeLabel, bowlOverflowHole, ...rest } = withBasinBowlShape(row);
    assert.deepEqual(rest, { sku: "KF003", colorCode: "RW316", priceTHB: 19000, dimensions: "600 × 800 × 200 mm", sortOrder: 2, imageUrl: "x" });
    assert.equal(bowlShape, "rounded-rectangle");
    assert.equal(bowlShapeLabel, "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น");
    assert.equal(bowlOverflowHole, false);
  });
});

describe("parseBowlShapeInput", () => {
  it("accepts every known shape with true / false / null, and null with null", () => {
    for (const shape of BOWL_SHAPES) for (const hole of [true, false, null]) {
      assert.deepEqual(parseBowlShapeInput({ bowlShape: shape, bowlOverflowHole: hole }), { ok: true, value: { bowlShape: shape, bowlOverflowHole: hole } });
    }
    assert.deepEqual(parseBowlShapeInput({ bowlShape: null, bowlOverflowHole: null }), { ok: true, value: { bowlShape: null, bowlOverflowHole: null } });
  });

  it("rejects what would put a wrong value in the database", () => {
    for (const bad of [null, "oval", [], {}, { bowlShape: "oval" }, { bowlOverflowHole: true }, { bowlShape: "triangle", bowlOverflowHole: null },
      { bowlShape: "oval", bowlOverflowHole: "yes" }, { bowlShape: null, bowlOverflowHole: true }, { bowlShape: undefined, bowlOverflowHole: null }]) {
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
    active: true, sortOrder: id, createdAt: now, updatedAt: now, bowlShape: null, bowlOverflowHole: null, ...extra,
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
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, null, { bowlShape: "oval", bowlOverflowHole: true })).status, 401);
    } finally { await server.close(); }
  });

  it("GET shows what the customer sees and where it comes from (database / builtin / none)", async () => {
    const server = await start(fakeDatabase([
      basinRow(1, "KF003", { bowlShape: "rounded-rectangle", bowlOverflowHole: false }),
      basinRow(2, "KF002"),
      basinRow(3, "KF007"),
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const list = await (await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } })).json() as Array<Record<string, unknown>>;
      assert.deepEqual(list.map((b) => [b["sku"], b["bowlShape"], b["bowlShapeLabel"], b["bowlOverflowHole"], b["bowlShapeSource"]]), [
        ["KF003", "rounded-rectangle", "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น", false, "database"],
        ["KF002", "rounded-rectangle", "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น", false, "builtin"],
        ["KF007", null, null, null, "none"],
      ]);
    } finally { await server.close(); }
  });

  it("saves a shape, persists it for the next GET, and writes who changed what to the audit trail", async () => {
    const db = fakeDatabase([basinRow(3, "KF007")]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await put(`${server.url}/api/admin/basins/3/bowl-shape`, cookie, { bowlShape: "oval", bowlOverflowHole: true });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: 3, sku: "KF007", bowlShape: "oval", bowlShapeLabel: "หลุมวงรี มีรูน้ำล้น", bowlOverflowHole: true, bowlShapeSource: "database" });
      assert.deepEqual([db.rows[0]!["bowlShape"], db.rows[0]!["bowlOverflowHole"]], ["oval", true]);
      assert.equal(db.rows[0]!["priceTHB"], 19000, "price is not touched");
      const list = await (await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } })).json() as Array<Record<string, unknown>>;
      assert.equal(list[0]!["bowlShape"], "oval");
      await new Promise((resolve) => setTimeout(resolve, 20)); // audit write is fire-and-forget
      const audit = db.audits.find((a) => a["action"] === "admin.basin.bowl_shape");
      assert.ok(audit, "an audit event was written");
      assert.equal(audit!["targetId"], "KF007");
      assert.equal(audit!["actorType"], "admin");
      assert.ok(String(audit!["actorName"]).length > 0, "it says who");
      assert.deepEqual((audit!["details"] as { changes: unknown }).changes, { bowlShape: { from: null, to: "oval" }, bowlOverflowHole: { from: null, to: true } });
    } finally { await server.close(); }
  });

  it("null / null clears the columns and the built-in table answers again (null is saved as null)", async () => {
    const db = fakeDatabase([basinRow(1, "KF006", { bowlShape: "round", bowlOverflowHole: false })]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: null, bowlOverflowHole: null });
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body["bowlShapeSource"], "builtin");
      assert.equal(body["bowlShape"], "oval");
      assert.deepEqual([db.rows[0]!["bowlShape"], db.rows[0]!["bowlOverflowHole"]], [null, null]);
    } finally { await server.close(); }
  });

  it("refuses a bad body (400) and an unknown basin (404), and changes nothing", async () => {
    const db = fakeDatabase([basinRow(1, "KF001")]);
    const server = await start(db);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: "triangle", bowlOverflowHole: null })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: "oval" })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/1/bowl-shape`, cookie, { bowlShape: null, bowlOverflowHole: true })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/abc/bowl-shape`, cookie, { bowlShape: "oval", bowlOverflowHole: null })).status, 400);
      assert.equal((await put(`${server.url}/api/admin/basins/99/bowl-shape`, cookie, { bowlShape: "oval", bowlOverflowHole: null })).status, 404);
      assert.deepEqual([db.rows[0]!["bowlShape"], db.rows[0]!["bowlOverflowHole"]], [null, null]);
    } finally { await server.close(); }
  });

  it("the generic basin edit cannot blank the columns: the form's body never reaches them", () => {
    const source = readFileSync(new URL("../src/routes/admin-router.ts", import.meta.url), "utf8");
    const generic = source.slice(source.indexOf('router.put("/admin/basins/:id", '), source.indexOf('router.put("/admin/basins/:id/bowl-shape"'));
    assert.ok(generic.length > 200);
    assert.ok(!/bowlShape|bowlOverflowHole/.test(generic), "the generic PUT does not mention the bowl columns");
  });
});
