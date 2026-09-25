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
  senderName: string | null;
  capturedAt: string | null;
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

const SQL_COLUMN_TO_ROW_KEY: Record<string, string> = {
  job_code: "jobCode",
  lead_id: "leadId",
  stage: "stage",
  sender_name: "senderName",
  captured_at: "capturedAt",
};

function isColumnChunk(node: unknown): node is { name: string } {
  return Boolean(node && typeof node === "object" && "dataType" in (node as object) && "columnType" in (node as object) && "name" in (node as object));
}

function isSqlNode(node: unknown): node is { queryChunks: unknown[] } {
  return Boolean(node && typeof node === "object" && Array.isArray((node as { queryChunks?: unknown[] }).queryChunks));
}

function stringChunkText(node: unknown): string | null {
  if (node && typeof node === "object" && (node as { constructor?: { name?: string } }).constructor?.name === "StringChunk") {
    const value = (node as { value?: unknown }).value;
    return Array.isArray(value) ? value.join("") : String(value ?? "");
  }
  return null;
}

function paramValue(node: unknown): { value: unknown } | null {
  if (node && typeof node === "object" && (node as { constructor?: { name?: string } }).constructor?.name === "Param") {
    return { value: (node as { value?: unknown }).value };
  }
  return null;
}

/**
 * Recursively evaluates a real drizzle SQL condition tree (from eq/isNull/
 * ilike/gte/lt/and/or) against one fake row. Drizzle's and()/or() flatten
 * all their arguments into ONE joiner level (e.g. and(a,b,c,d) has 4
 * sibling leaves joined by 3 " and " chunks, not pairwise nesting), each
 * wrapped in a "(...)" pair -- this walks that shape generically instead of
 * hardcoding it to the 3 specific filters this test adds, so it also still
 * covers the pre-existing jobCode/leadId/stage filters combined with them.
 */
function evaluateCondition(node: unknown, row: FakeSitePhotoRow): boolean {
  if (node === undefined) return true;
  if (!isSqlNode(node)) return true;
  const chunks = node.queryChunks;

  const columnChunk = chunks.find(isColumnChunk);
  if (columnChunk) {
    const opText = chunks.map(stringChunkText).filter((text): text is string => text !== null).join("");
    const rowKey = SQL_COLUMN_TO_ROW_KEY[columnChunk.name] ?? columnChunk.name;
    const rowValue = (row as unknown as Record<string, unknown>)[rowKey];

    if (opText.includes("is null")) return rowValue === null || rowValue === undefined;

    if (opText.includes(" ilike ")) {
      const pattern = chunks.find((chunk): chunk is string => typeof chunk === "string") ?? "";
      const needle = pattern.replace(/^%|%$/g, "").toLowerCase();
      return typeof rowValue === "string" && rowValue.toLowerCase().includes(needle);
    }

    const param = chunks.map(paramValue).find((candidate): candidate is { value: unknown } => candidate !== null);
    const compareValue = param?.value;
    if (opText.includes(" = ")) return rowValue === compareValue;
    if (opText.includes(" >= ")) return (rowValue as Date) >= (compareValue as Date);
    if (opText.includes(" < ")) return (rowValue as Date) < (compareValue as Date);
    return true;
  }

  const nested = chunks.filter(isSqlNode);
  if (nested.length === 0) return true;
  const results = nested.map((child) => evaluateCondition(child, row));
  const isOr = chunks.some((chunk) => stringChunkText(chunk) === " or ");
  return isOr ? results.some(Boolean) : results.every(Boolean);
}

/** Stateful in-memory fake for site_photos, with a real drizzle-condition-tree
 * evaluator behind .where() so unassigned/month/senderName (and/or combined
 * with the pre-existing jobCode/leadId/stage filters) are genuinely applied,
 * not just accepted as no-ops. */
function createFakeSitePhotoDatabase(initialRows: FakeSitePhotoRow[]) {
  const rows = [...initialRows];
  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          orderBy: () => ({
            limit: async (limitValue: number) =>
              rows
                .filter((row) => evaluateCondition(condition, row))
                .sort((a, b) => (b.capturedAt?.getTime() ?? 0) - (a.capturedAt?.getTime() ?? 0) || b.id - a.id)
                .slice(0, limitValue),
          }),
        }),
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

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-site-photos-filters-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-site-photos-filters-test";
  process.env["SESSION_SECRET"] = "admin-site-photos-filters-test-session-secret";
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

const FIXTURE_ROWS: FakeSitePhotoRow[] = [
  {
    id: 1,
    leadId: null,
    jobCode: null,
    imageUrl: "https://example.com/1.jpg",
    description: null,
    stage: "survey",
    senderName: "ช่างเอ ทีมเอ",
    capturedAt: new Date("2026-09-05T03:00:00.000Z"),
    createdAt: new Date("2026-09-05T03:05:00.000Z"),
  },
  {
    id: 2,
    leadId: 42,
    jobCode: "JB02/2569",
    imageUrl: "https://example.com/2.jpg",
    description: null,
    stage: "installation",
    senderName: "ช่างบี ทีมบี",
    capturedAt: new Date("2026-09-20T03:00:00.000Z"),
    createdAt: new Date("2026-09-20T03:05:00.000Z"),
  },
  {
    id: 3,
    leadId: null,
    jobCode: "",
    imageUrl: "https://example.com/3.jpg",
    description: null,
    stage: "completed",
    senderName: "คุณสมชาย",
    capturedAt: new Date("2026-10-02T03:00:00.000Z"),
    createdAt: new Date("2026-10-02T03:05:00.000Z"),
  },
  {
    id: 4,
    leadId: 7,
    jobCode: "JB05/2569",
    imageUrl: "https://example.com/4.jpg",
    description: null,
    stage: "service",
    senderName: "ทีมเอ",
    capturedAt: new Date("2026-09-28T03:00:00.000Z"),
    createdAt: new Date("2026-09-28T03:05:00.000Z"),
  },
];

describe("GET /admin/site-photos?unassigned=true", () => {
  it("returns only photos with a null or empty jobCode", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?unassigned=true`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 3]);
    } finally {
      await server.close();
    }
  });

  it("also accepts unassigned=1", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?unassigned=1`, { headers: { cookie } });
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 3]);
    } finally {
      await server.close();
    }
  });

  it("is a no-op (returns everything) when omitted or false", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?unassigned=false`, { headers: { cookie } });
      const payload = await response.json() as SitePhotoPayload[];
      assert.equal(payload.length, 4);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/site-photos?month=YYYY-MM", () => {
  it("returns only photos captured in that month", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?month=2026-09`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 2, 4]);
    } finally {
      await server.close();
    }
  });

  it("excludes a photo captured on the 1st of the following month (exclusive upper bound)", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?month=2026-10`, { headers: { cookie } });
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3]);
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed month", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?month=september`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a month number outside 01-12", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?month=2026-13`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/site-photos?senderName=...", () => {
  it("case-insensitively matches a substring of the sender/team name", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?senderName=${encodeURIComponent("ทีมเอ")}`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 4]);
    } finally {
      await server.close();
    }
  });

  it("returns nothing when no sender matches", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?senderName=${encodeURIComponent("ไม่มีคนนี้")}`, { headers: { cookie } });
      const payload = await response.json() as SitePhotoPayload[];
      assert.equal(payload.length, 0);
    } finally {
      await server.close();
    }
  });
});

describe("combining filters", () => {
  it("combines month and senderName (AND semantics)", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(
        `${server.url}/api/admin/site-photos?month=2026-09&senderName=${encodeURIComponent("ทีมเอ")}`,
        { headers: { cookie } },
      );
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id).sort(), [1, 4]);
    } finally {
      await server.close();
    }
  });

  it("combines unassigned and stage", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?unassigned=true&stage=completed`, { headers: { cookie } });
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3]);
    } finally {
      await server.close();
    }
  });
});
