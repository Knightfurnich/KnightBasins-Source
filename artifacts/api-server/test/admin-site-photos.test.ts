import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
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

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
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

/** Stateful in-memory fake for the site_photos table, with just enough of the
 * drizzle query builder surface (select/where/orderBy/limit, insert/returning,
 * update/set/where/returning) for admin-router.ts's site-photos endpoints. */
function createFakeSitePhotoDatabase(initialRows: FakeSitePhotoRow[]) {
  let rows = [...initialRows];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  // Drizzle's eq()/and() build a tree of SQL nodes with a `queryChunks` array;
  // each eq(column, value) leaf's queryChunks contains exactly one drizzle
  // Column object (identified by having dataType+columnType) and one Param
  // (identified by its constructor name) holding the bound value. Walk the
  // tree recursively to find every such leaf, regardless of how deep and()
  // nests them.
  function extractEqFilters(node: unknown): Array<{ column: string; value: unknown }> {
    if (!node || typeof node !== "object") return [];
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
    if (!Array.isArray(chunks)) return [];

    const columnChunk = chunks.find(
      (chunk) => chunk && typeof chunk === "object" && "dataType" in chunk && "columnType" in chunk,
    ) as { name?: string } | undefined;
    const paramChunk = chunks.find(
      (chunk) => (chunk as { constructor?: { name?: string } })?.constructor?.name === "Param",
    ) as { value?: unknown } | undefined;

    if (columnChunk?.name && paramChunk && "value" in paramChunk) {
      return [{ column: columnChunk.name, value: paramChunk.value }];
    }
    return chunks.flatMap((chunk) => extractEqFilters(chunk));
  }

  const SQL_COLUMN_TO_ROW_KEY: Record<string, string> = {
    job_code: "jobCode",
    lead_id: "leadId",
    stage: "stage",
  };

  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          const filters = extractEqFilters(condition);
          const filtered = condition === undefined
            ? rows
            : rows.filter((row) => filters.every(({ column, value }) => {
              const rowKey = SQL_COLUMN_TO_ROW_KEY[column] ?? column;
              return (row as Record<string, unknown>)[rowKey] === value;
            }));
          return {
            orderBy: () => ({
              limit: async (limitValue: number) =>
                [...filtered]
                  .sort((a, b) => (b.capturedAt?.getTime() ?? 0) - (a.capturedAt?.getTime() ?? 0) || b.id - a.id)
                  .slice(0, limitValue),
            }),
          };
        },
      }),
    }),
    insert: () => ({
      values: (data: Partial<FakeSitePhotoRow>) => ({
        returning: async () => {
          const created: FakeSitePhotoRow = {
            id: nextId++,
            leadId: data.leadId ?? null,
            jobCode: data.jobCode ?? null,
            imageUrl: data.imageUrl ?? "",
            description: data.description ?? null,
            stage: data.stage ?? "installation",
            senderName: data.senderName ?? null,
            capturedAt: data.capturedAt ?? null,
            createdAt: new Date(),
          };
          rows.push(created);
          return [created];
        },
      }),
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
            const id = (condition as { queryChunks?: Array<{ value?: unknown }> } | undefined)?.queryChunks
              ?.find((chunk) => chunk?.constructor?.name === "Param")?.value;
            const index = rows.findIndex((row) => row.id === id);
            if (index === -1) return [];
            rows[index] = { ...rows[index], ...changes } as FakeSitePhotoRow;
            return [rows[index]];
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
  process.env["ADMIN_PASSWORD"] = "admin-site-photos-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-site-photos-test";
  process.env["SESSION_SECRET"] = "admin-site-photos-test-session-secret";
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

describe("GET /admin/site-photos", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("lists all photos, most recently captured first, when no filter is given", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3, 2, 1]);
    } finally {
      await server.close();
    }
  });

  it("filters by jobCode", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?jobCode=JB02/2569`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [2, 3]);
    } finally {
      await server.close();
    }
  });

  it("filters by stage", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?stage=completed`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3]);
    } finally {
      await server.close();
    }
  });

  it("filters by leadId", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?leadId=42`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [2, 3]);
    } finally {
      await server.close();
    }
  });

  it("combines jobCode and stage filters", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?jobCode=JB02/2569&stage=installation`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [2]);
    } finally {
      await server.close();
    }
  });

  it("respects the limit parameter", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?limit=1`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.equal(payload.length, 1);
      assert.equal(payload[0]?.id, 3);
    } finally {
      await server.close();
    }
  });

  it("rejects an invalid stage", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?stage=not-a-stage`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-numeric leadId", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?leadId=abc`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

describe("POST /admin/site-photos", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/x.jpg" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing imageUrl", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("creates a site photo, defaulting stage to installation when omitted", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/new.jpg", jobCode: "JB03/2569" }),
      });
      assert.equal(response.status, 201);
      const created = await response.json() as SitePhotoPayload;
      assert.equal(created.imageUrl, "https://example.com/new.jpg");
      assert.equal(created.jobCode, "JB03/2569");
      assert.equal(created.stage, "installation");
      assert.equal(created.leadId, null);
    } finally {
      await server.close();
    }
  });

  it("stores the given stage, leadId, description, senderName, and capturedAt", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://example.com/survey.jpg",
          leadId: 7,
          stage: "survey",
          description: "วัดหน้างานหน้าบ้าน",
          senderName: "ช่างซี",
          capturedAt: "2026-09-25T02:00:00.000Z",
        }),
      });
      assert.equal(response.status, 201);
      const created = await response.json() as SitePhotoPayload;
      assert.equal(created.leadId, 7);
      assert.equal(created.stage, "survey");
      assert.equal(created.description, "วัดหน้างานหน้าบ้าน");
      assert.equal(created.senderName, "ช่างซี");
      assert.equal(created.capturedAt, "2026-09-25T02:00:00.000Z");
    } finally {
      await server.close();
    }
  });

  it("rejects a stage outside the 4 standard values", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/x.jpg", stage: "not-a-stage" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking leads:edit", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase([]));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/x.jpg" }),
      });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});

describe("PATCH /admin/site-photos/:id", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "x" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("binds leadId to a photo that doesn't have one yet", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ leadId: 99 }),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as SitePhotoPayload;
      assert.equal(updated.leadId, 99);

      const getResponse = await fetch(`${server.url}/api/admin/site-photos?leadId=99`, { headers: { cookie } });
      const getPayload = await getResponse.json() as SitePhotoPayload[];
      assert.deepEqual(getPayload.map((row) => row.id), [1], "the bound leadId persists for the next GET");
    } finally {
      await server.close();
    }
  });

  it("updates description and stage", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/2`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ description: "เก็บงานเรียบร้อย", stage: "service" }),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as SitePhotoPayload;
      assert.equal(updated.description, "เก็บงานเรียบร้อย");
      assert.equal(updated.stage, "service");
    } finally {
      await server.close();
    }
  });

  it("rejects an empty body", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for a photo that doesn't exist", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/999`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ description: "x" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking leads:edit", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(SEED_ROWS));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ description: "x" }),
      });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});
