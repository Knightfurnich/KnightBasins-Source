import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { basinPrices, basinCategories } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type BasinPayload = {
  id: number;
  sku: string;
  imageUrl: string;
  galleryImageUrls: string[];
  topViewImageUrl: string | null;
};

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeBasinRow = {
  id: number;
  sku: string;
  colorCode: string;
  colorName: string;
  priceTHB: number;
  category: string;
  categoryId: number | null;
  dimensions: string;
  basinDimensions: string | null;
  bowlMm: string | null;
  imageTone: string;
  imageUrl: string | null;
  galleryImageUrls: string[];
  quoteImageUrl: string | null;
  videoUrl: string | null;
  topViewImageUrl: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function paramValueFromCondition(condition: unknown): unknown {
  if (!condition || typeof condition !== "object") return undefined;
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return undefined;
  const paramChunk = chunks.find((chunk) => (chunk as { constructor?: { name?: string } })?.constructor?.name === "Param") as { value?: unknown } | undefined;
  return paramChunk?.value;
}

/** Stateful in-memory fake for basinPrices (+ a read-only basinCategories
 * table) with just enough of the drizzle query builder surface for
 * admin-router.ts's GET/PUT basins endpoints: select/from/orderBy,
 * update/set/where/returning. */
function createFakeBasinsDatabase(initialBasins: FakeBasinRow[], initialCategories: Array<{ id: number; name: string; sortOrder: number }> = []) {
  const basins = [...initialBasins];
  const categories = [...initialCategories];

  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === basinCategories) {
          return { orderBy: async () => [...categories] };
        }
        return { orderBy: async () => [...basins] };
      },
    }),
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: (condition: unknown) => ({
          returning: async () => {
            const id = paramValueFromCondition(condition);
            const index = basins.findIndex((row) => row.id === id);
            if (index === -1) return [];
            basins[index] = { ...basins[index], ...changes } as FakeBasinRow;
            return [basins[index]];
          },
        }),
      };
      return builder;
    },
  };
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

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-basins-topview-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-basins-topview-test";
  process.env["SESSION_SECRET"] = "admin-basins-topview-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

function fixtureBasin(overrides: Partial<FakeBasinRow> = {}): FakeBasinRow {
  const now = new Date("2026-09-25T00:00:00.000Z");
  return {
    id: 1,
    sku: "KF001",
    colorCode: "WHT",
    colorName: "White",
    priceTHB: 4500,
    category: "counter basin",
    categoryId: null,
    dimensions: "500x400mm",
    basinDimensions: null,
    bowlMm: null,
    imageTone: "light",
    imageUrl: "https://example.com/kf001.jpg",
    galleryImageUrls: [],
    quoteImageUrl: null,
    videoUrl: null,
    topViewImageUrl: null,
    active: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GET /admin/basins", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin()]));
    try {
      const response = await fetch(`${server.url}/api/admin/basins`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns topViewImageUrl for a basin that has one set", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([
      fixtureBasin({ id: 1, sku: "KF001", topViewImageUrl: "https://example.com/kf001-top.jpg" }),
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as BasinPayload[];
      assert.equal(payload.length, 1);
      assert.equal(payload[0]?.topViewImageUrl, "https://example.com/kf001-top.jpg");
    } finally {
      await server.close();
    }
  });

  it("returns null topViewImageUrl for a basin that never had one set", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin({ topViewImageUrl: null })]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } });
      const payload = await response.json() as BasinPayload[];
      assert.equal(payload[0]?.topViewImageUrl, null);
    } finally {
      await server.close();
    }
  });
});

describe("PUT /admin/basins/:id (topViewImageUrl)", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin()]));
    try {
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixtureBasin({ topViewImageUrl: "https://example.com/kf001-top.jpg" })),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("sets topViewImageUrl on a basin that didn't have one", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin({ id: 1, topViewImageUrl: null })]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const body = { ...fixtureBasin({ id: 1 }), topViewImageUrl: "https://example.com/kf001-top.jpg" };
      delete (body as { id?: number }).id;
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as BasinPayload;
      assert.equal(updated.topViewImageUrl, "https://example.com/kf001-top.jpg");

      const getResponse = await fetch(`${server.url}/api/admin/basins`, { headers: { cookie } });
      const getPayload = await getResponse.json() as BasinPayload[];
      assert.equal(getPayload[0]?.topViewImageUrl, "https://example.com/kf001-top.jpg", "the change persists for the next GET");
    } finally {
      await server.close();
    }
  });

  it("clears topViewImageUrl back to null", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([
      fixtureBasin({ id: 1, topViewImageUrl: "https://example.com/kf001-top.jpg" }),
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const body = { ...fixtureBasin({ id: 1 }), topViewImageUrl: null };
      delete (body as { id?: number }).id;
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as BasinPayload;
      assert.equal(updated.topViewImageUrl, null);
    } finally {
      await server.close();
    }
  });

  it("leaves other fields (e.g. imageUrl) untouched when only topViewImageUrl changes", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([
      fixtureBasin({ id: 1, imageUrl: "https://example.com/kf001.jpg", topViewImageUrl: null }),
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const body = { ...fixtureBasin({ id: 1 }), topViewImageUrl: "https://example.com/kf001-top.jpg" };
      delete (body as { id?: number }).id;
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const updated = await response.json() as BasinPayload;
      assert.equal(updated.imageUrl, "https://example.com/kf001.jpg");
      assert.equal(updated.topViewImageUrl, "https://example.com/kf001-top.jpg");
    } finally {
      await server.close();
    }
  });

  it("rejects a topViewImageUrl longer than 2000 characters", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin({ id: 1 })]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const body = { ...fixtureBasin({ id: 1 }), topViewImageUrl: "x".repeat(2001) };
      delete (body as { id?: number }).id;
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking basins:edit", async () => {
    const server = await startAdminRoute(createFakeBasinsDatabase([fixtureBasin({ id: 1 })]));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "basins";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const body = { ...fixtureBasin({ id: 1 }), topViewImageUrl: "https://example.com/kf001-top.jpg" };
      delete (body as { id?: number }).id;
      const response = await fetch(`${server.url}/api/admin/basins/1`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});
