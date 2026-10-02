import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { installedStonePrices, sheetStonePrices } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type StoneRow = {
  id: number;
  code: string;
  name: string;
  tone: string;
  imageUrl: string | null;
  galleryImageUrls: string[];
  quoteImageUrl: string | null;
  slabImageUrl: string | null;
  aliases: string[];
  active: boolean;
  sortOrder: number;
  categoryId?: number | null;
  pricePerSqmTHB?: number;
  basePriceTHB?: number;
  price10PlusTHB?: number;
  price50PlusTHB?: number;
  createdAt: Date;
  updatedAt: Date;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  PUBLIC_UPLOAD_ORIGIN: process.env["PUBLIC_UPLOAD_ORIGIN"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const uploadOrigin = "https://uploads.example.test/catalog";
let uploadDirectory = "";

function paramValueFromCondition(condition: unknown): unknown {
  if (!condition || typeof condition !== "object") return undefined;
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return undefined;
  const paramChunk = chunks.find((chunk) => (chunk as { constructor?: { name?: string } })?.constructor?.name === "Param") as { value?: unknown } | undefined;
  return paramChunk?.value;
}

/** Stateful in-memory fake for both stone tables with just the drizzle
 * surface the stone endpoints use: select/from/orderBy, insert/values/returning,
 * update/set/where/returning. Like Postgres it fills the schema defaults for
 * columns an insert leaves out (gallery -> [], the single image URLs -> null). */
function createFakeStonesDatabase() {
  const installed: StoneRow[] = [];
  const sheet: StoneRow[] = [];
  let nextId = 1;
  const tableRows = (table: unknown) => (table === installedStonePrices ? installed : sheet);

  const database = {
    select: () => ({
      from: (table: unknown) => ({ orderBy: async () => [...tableRows(table)] }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const row = {
            galleryImageUrls: [],
            quoteImageUrl: null,
            slabImageUrl: null,
            imageUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...values,
            id: nextId++,
          } as StoneRow;
          tableRows(table).push(row);
          return [row];
        },
      }),
    }),
    update: (table: unknown) => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: (condition: unknown) => ({
          returning: async () => {
            const rows = tableRows(table);
            const index = rows.findIndex((row) => row.id === paramValueFromCondition(condition));
            if (index === -1) return [];
            // drizzle's .set() skips keys whose value is undefined
            const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
            rows[index] = { ...rows[index], ...defined } as StoneRow;
            return [rows[index]!];
          },
        }),
      };
      return builder;
    },
  };
  return { database, installed, sheet };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(async () => {
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "knight-stone-roles-"));
  process.env["ADMIN_PASSWORD"] = "admin-stones-api-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-stones-api-test";
  process.env["SESSION_SECRET"] = "admin-stones-api-test-session-secret";
  process.env["PUBLIC_UPLOAD_ORIGIN"] = uploadOrigin;
  process.env["UPLOAD_DIR"] = uploadDirectory;
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

const installedBody = (overrides: Record<string, unknown> = {}) => ({
  code: "SS001",
  name: "Pure White",
  pricePerSqmTHB: 8500,
  categoryId: null,
  tone: "#f5f5f0",
  imageUrl: "https://img.example.test/main.png",
  aliases: [],
  active: true,
  sortOrder: 1,
  ...overrides,
});

const sheetBody = (overrides: Record<string, unknown> = {}) => ({
  code: "SH001",
  name: "Pure White Sheet",
  basePriceTHB: 12000,
  price10PlusTHB: 11000,
  price50PlusTHB: 10000,
  tone: "#f5f5f0",
  imageUrl: "https://img.example.test/sheet-main.png",
  aliases: [],
  active: true,
  sortOrder: 1,
  ...overrides,
});

const ROLES = {
  galleryImageUrls: ["https://img.example.test/g1.png", "https://img.example.test/g2.png"],
  quoteImageUrl: "https://img.example.test/quote.png",
  slabImageUrl: "https://img.example.test/slab.png",
};

async function adminSession(database: unknown) {
  const server = await startAdminRoute(database);
  const cookie = `knight_admin_session=${createAdminToken()}`;
  const send = (method: string, route: string, body?: unknown) => fetch(`${server.url}/api${route}`, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { server, send };
}

describe("stone image roles (job-186)", () => {
  for (const kind of [
    { label: "installed", route: "/admin/installed-stones", body: installedBody, table: "installed" as const },
    { label: "sheet", route: "/admin/sheet-stones", body: sheetBody, table: "sheet" as const },
  ]) {
    describe(`${kind.label} stones`, () => {
      it("creates a stone with gallery, quotation and slab images and returns all three", async () => {
        const fake = createFakeStonesDatabase();
        const { server, send } = await adminSession(fake.database);
        try {
          const response = await send("POST", kind.route, kind.body(ROLES));
          assert.equal(response.status, 201);
          const created = await response.json() as StoneRow;
          assert.deepEqual(created.galleryImageUrls, ROLES.galleryImageUrls);
          assert.equal(created.quoteImageUrl, ROLES.quoteImageUrl);
          assert.equal(created.slabImageUrl, ROLES.slabImageUrl);
          assert.equal(created.imageUrl, kind.body().imageUrl, "the main storefront image is untouched");

          assert.deepEqual(fake[kind.table][0]!.galleryImageUrls, ROLES.galleryImageUrls, "persisted, not just echoed");
          assert.equal(fake[kind.table][0]!.slabImageUrl, ROLES.slabImageUrl);

          const listed = await (await send("GET", kind.route)).json() as StoneRow[];
          assert.equal(listed[0]!.quoteImageUrl, ROLES.quoteImageUrl);
          assert.deepEqual(listed[0]!.galleryImageUrls, ROLES.galleryImageUrls);
        } finally {
          await server.close();
        }
      });

      it("creates a stone that sends none of the new fields (existing clients keep working)", async () => {
        const fake = createFakeStonesDatabase();
        const { server, send } = await adminSession(fake.database);
        try {
          const response = await send("POST", kind.route, kind.body());
          assert.equal(response.status, 201);
          const created = await response.json() as StoneRow;
          assert.deepEqual(created.galleryImageUrls, []);
          assert.equal(created.quoteImageUrl, null);
          assert.equal(created.slabImageUrl, null);
        } finally {
          await server.close();
        }
      });

      it("updates the three image roles and returns them", async () => {
        const fake = createFakeStonesDatabase();
        const { server, send } = await adminSession(fake.database);
        try {
          const id = (await (await send("POST", kind.route, kind.body())).json() as StoneRow).id;
          const response = await send("PUT", `${kind.route}/${id}`, kind.body({ ...ROLES, name: "Renamed" }));
          assert.equal(response.status, 200);
          const updated = await response.json() as StoneRow;
          assert.equal(updated.name, "Renamed");
          assert.deepEqual(updated.galleryImageUrls, ROLES.galleryImageUrls);
          assert.equal(updated.quoteImageUrl, ROLES.quoteImageUrl);
          assert.equal(updated.slabImageUrl, ROLES.slabImageUrl);
          assert.deepEqual(fake[kind.table][0]!.galleryImageUrls, ROLES.galleryImageUrls);
        } finally {
          await server.close();
        }
      });

      it("keeps the stored image roles when an update omits them, and clears a single image sent as null", async () => {
        const fake = createFakeStonesDatabase();
        const { server, send } = await adminSession(fake.database);
        try {
          const id = (await (await send("POST", kind.route, kind.body(ROLES))).json() as StoneRow).id;

          const omitted = await (await send("PUT", `${kind.route}/${id}`, kind.body({ name: "Omits roles" }))).json() as StoneRow;
          assert.deepEqual(omitted.galleryImageUrls, ROLES.galleryImageUrls, "omitted = unchanged");
          assert.equal(omitted.quoteImageUrl, ROLES.quoteImageUrl);
          assert.equal(omitted.slabImageUrl, ROLES.slabImageUrl);

          const cleared = await (await send("PUT", `${kind.route}/${id}`, kind.body({ quoteImageUrl: null, slabImageUrl: null, galleryImageUrls: [] }))).json() as StoneRow;
          assert.equal(cleared.quoteImageUrl, null, "null clears it");
          assert.equal(cleared.slabImageUrl, null);
          assert.deepEqual(cleared.galleryImageUrls, []);
          assert.equal(cleared.imageUrl, kind.body().imageUrl, "main image still intact");
        } finally {
          await server.close();
        }
      });

      it("rejects more than 4 gallery images, like basins do", async () => {
        const fake = createFakeStonesDatabase();
        const { server, send } = await adminSession(fake.database);
        try {
          const tooMany = Array.from({ length: 5 }, (_, index) => `https://img.example.test/g${index}.png`);
          const response = await send("POST", kind.route, kind.body({ galleryImageUrls: tooMany }));
          assert.equal(response.status, 400);
          assert.equal(fake[kind.table].length, 0, "nothing was stored");
        } finally {
          await server.close();
        }
      });
    });
  }

  it("keeps the gallery, quotation and slab images of both stone tables out of the orphan-upload cleanup", async () => {
    const names = {
      orphan: "catalog-mold-aaaaaaaaaaaaaaaa.png",
      installedMain: "catalog-mold-1111111111111111.png",
      installedGallery: "catalog-mold-2222222222222222.png",
      installedQuote: "catalog-mold-3333333333333333.png",
      installedSlab: "catalog-mold-4444444444444444.png",
      sheetGallery: "catalog-mold-5555555555555555.png",
      sheetQuote: "catalog-mold-6666666666666666.png",
      sheetSlab: "catalog-mold-7777777777777777.png",
    };
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (const name of Object.values(names)) {
      await writeFile(path.join(uploadDirectory, name), name);
      await utimes(path.join(uploadDirectory, name), oldTime, oldTime);
    }
    const url = (name: string) => `${uploadOrigin}/${name}?v=mold`;

    // cleanup reads, in order: basins, installed stones, sheet stones, leads
    const rows = [
      [],
      [{ imageUrl: url(names.installedMain), galleryImageUrls: [url(names.installedGallery)], quoteImageUrl: url(names.installedQuote), slabImageUrl: url(names.installedSlab) }],
      [{ imageUrl: null, galleryImageUrls: [url(names.sheetGallery)], quoteImageUrl: url(names.sheetQuote), slabImageUrl: url(names.sheetSlab) }],
      [],
    ];
    let queryNumber = 0;
    const database = { select: () => ({ from: async () => rows[queryNumber++] ?? [] }) };
    const { server, send } = await adminSession(database);
    try {
      const response = await send("POST", "/admin/uploads/cleanup");
      assert.equal(response.status, 200);
      const payload = await response.json() as { removed: string[]; skippedReferenced: number };
      assert.deepEqual(payload.removed, [names.orphan], "only the genuinely unreferenced file goes");
      assert.equal(payload.skippedReferenced, 7);
      for (const [key, name] of Object.entries(names)) {
        if (key === "orphan") continue;
        assert.equal((await readFile(path.join(uploadDirectory, name), "utf8")), name, `${key} must survive cleanup`);
      }
      await assert.rejects(readFile(path.join(uploadDirectory, names.orphan)));
    } finally {
      await server.close();
    }
  });
});
