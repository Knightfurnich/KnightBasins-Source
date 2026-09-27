import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type SitePhotoPayload = {
  id: number;
  leadId: number | null;
  jobCode: string | null;
  imageUrl: string;
  description: string | null;
  stage: string;
  senderName: string | null;
  capturedAt: string | null;
  createdAt: string;
};

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeSitePhotoRow = {
  id: number;
  leadId: number | null;
  jobCode: string | null;
  imageUrl: string;
  description: string | null;
  stage: string;
  senderName: string | null;
  capturedAt: Date | null;
  createdAt: Date;
};

/** Drizzle's eq()/and() build a tree of SQL nodes with a `queryChunks` array;
 * an eq(sitePhotos.id, value) leaf's queryChunks contains exactly one drizzle
 * Column object (identified by having dataType+columnType) and one Param
 * (identified by its constructor name) holding the bound value. Walk the
 * tree recursively looking for the "id" column's bound value -- the only
 * filter admin-router.ts's PATCH .../visibility existence check ever uses. */
function extractEqId(node: unknown): number | undefined {
  if (!node || typeof node !== "object") return undefined;
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return undefined;

  const columnChunk = chunks.find(
    (chunk) => chunk && typeof chunk === "object" && "dataType" in chunk && "columnType" in chunk,
  ) as { name?: string } | undefined;
  const paramChunk = chunks.find(
    (chunk) => (chunk as { constructor?: { name?: string } })?.constructor?.name === "Param",
  ) as { value?: unknown } | undefined;

  if (columnChunk?.name === "id" && paramChunk && "value" in paramChunk) {
    return paramChunk.value as number;
  }
  for (const chunk of chunks) {
    const found = extractEqId(chunk);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Stateful in-memory fake for the site_photos table, with just enough of the
 * drizzle query builder surface for admin-router.ts's site-photos GET
 * (select/from/where/orderBy/limit) and PATCH .../visibility (select/from/where,
 * awaited directly with no further chaining) endpoints. The where() result is
 * itself an awaitable Promise carrying an extra .orderBy() method, so both
 * call shapes work against the same fake. */
function createFakeSitePhotoDatabase(initialRows: FakeSitePhotoRow[]) {
  const rows = [...initialRows];

  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          const id = extractEqId(condition);
          const filtered = condition === undefined ? rows : rows.filter((row) => row.id === id);
          const result = Promise.resolve(filtered) as Promise<FakeSitePhotoRow[]> & {
            orderBy: () => { limit: (limitValue: number) => Promise<FakeSitePhotoRow[]> };
          };
          result.orderBy = () => ({
            limit: async (limitValue: number) =>
              [...filtered]
                .sort((a, b) => (b.capturedAt?.getTime() ?? 0) - (a.capturedAt?.getTime() ?? 0) || b.id - a.id)
                .slice(0, limitValue),
          });
          return result;
        },
      }),
    }),
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

function adminCookie() {
  return `knight_admin_session=${createAdminToken()}`;
}

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
};
let uploadDirectory: string;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "admin-site-photos-visibility-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
  process.env["ADMIN_PASSWORD"] = "admin-site-photos-visibility-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-site-photos-visibility-test";
  process.env["SESSION_SECRET"] = "admin-site-photos-visibility-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

afterEach(async () => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  // Each test gets a clean slate for the visibility JSON file -- otherwise a
  // hide/show left behind by one test would leak into the next test's
  // default-filter expectations.
  await rm(path.join(uploadDirectory, "site_photos_visibility.json"), { force: true });
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { force: true, recursive: true });
});

const SEED_ROWS: FakeSitePhotoRow[] = [
  {
    id: 1,
    leadId: null,
    jobCode: "JB01/2569",
    imageUrl: "https://example.com/site-photos/1.jpg",
    description: "รูปหน้างานก่อนติดตั้ง",
    stage: "survey",
    senderName: "ช่างเอ",
    capturedAt: new Date("2026-09-20T03:00:00.000Z"),
    createdAt: new Date("2026-09-20T03:05:00.000Z"),
  },
  {
    id: 2,
    leadId: 42,
    jobCode: "JB02/2569",
    imageUrl: "https://example.com/site-photos/2.jpg",
    description: null,
    stage: "installation",
    senderName: "ช่างบี",
    capturedAt: new Date("2026-09-22T03:00:00.000Z"),
    createdAt: new Date("2026-09-22T03:05:00.000Z"),
  },
  {
    id: 3,
    leadId: 42,
    jobCode: "JB02/2569",
    imageUrl: "https://example.com/site-photos/3.jpg",
    description: null,
    stage: "completed",
    senderName: "ช่างบี",
    capturedAt: new Date("2026-09-24T03:00:00.000Z"),
    createdAt: new Date("2026-09-24T03:05:00.000Z"),
  },
];

describe("PATCH /admin/site-photos/:id/visibility", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1/visibility`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking leads:edit", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const cookie = adminCookie();
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-boolean isVisible", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: "false" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for a photo that doesn't exist", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/999/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("hides a photo without touching its sitePhotos row, and persists the state to site_photos_visibility.json", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/2/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { success: boolean; id: number; isVisible: boolean };
      assert.deepEqual(body, { success: true, id: 2, isVisible: false });

      const raw = await readFile(path.join(uploadDirectory, "site_photos_visibility.json"), "utf8");
      const map = JSON.parse(raw) as Record<string, boolean>;
      assert.equal(map["2"], false);
    } finally {
      await server.close();
    }
  });

  it("restores a hidden photo back to visible", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      const hideResponse = await fetch(`${server.url}/api/admin/site-photos/3/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });
      assert.equal(hideResponse.status, 200);

      const restoreResponse = await fetch(`${server.url}/api/admin/site-photos/3/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: true }),
      });
      assert.equal(restoreResponse.status, 200);
      const body = await restoreResponse.json() as { success: boolean; id: number; isVisible: boolean };
      assert.deepEqual(body, { success: true, id: 3, isVisible: true });

      const raw = await readFile(path.join(uploadDirectory, "site_photos_visibility.json"), "utf8");
      const map = JSON.parse(raw) as Record<string, boolean>;
      assert.equal(map["3"], true);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/site-photos visibility filter", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("defaults to visibility=visible, excluding hidden photos", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      await fetch(`${server.url}/api/admin/site-photos/2/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });

      const response = await fetch(`${server.url}/api/admin/site-photos`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 3]);
    } finally {
      await server.close();
    }
  });

  it("visibility=hidden returns only hidden photos", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      await fetch(`${server.url}/api/admin/site-photos/2/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });

      const response = await fetch(`${server.url}/api/admin/site-photos?visibility=hidden`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [2]);
    } finally {
      await server.close();
    }
  });

  it("visibility=all returns every photo regardless of hidden state", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      await fetch(`${server.url}/api/admin/site-photos/2/visibility`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      });

      const response = await fetch(`${server.url}/api/admin/site-photos?visibility=all`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 2, 3]);
    } finally {
      await server.close();
    }
  });

  it("rejects an invalid visibility value", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = adminCookie();
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?visibility=nope`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});
