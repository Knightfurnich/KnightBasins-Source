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
  description: string | null;
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
 * ilike/gte/lte/and/or) against one fake row, same shape-walking approach as
 * admin-site-photos-filters.test.ts, extended with a "<=" (lte) branch for
 * the new endDate filter.
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
    if (opText.includes(" <= ")) return (rowValue as Date) <= (compareValue as Date);
    if (opText.includes(" < ")) return (rowValue as Date) < (compareValue as Date);
    return true;
  }

  const nested = chunks.filter(isSqlNode);
  if (nested.length === 0) return true;
  const results = nested.map((child) => evaluateCondition(child, row));
  const isOr = chunks.some((chunk) => stringChunkText(chunk) === " or ");
  return isOr ? results.some(Boolean) : results.every(Boolean);
}

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
  process.env["ADMIN_PASSWORD"] = "admin-site-photos-search-api-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-site-photos-search-api-test";
  process.env["SESSION_SECRET"] = "admin-site-photos-search-api-test-session-secret";
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

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS);

const FIXTURE_ROWS: FakeSitePhotoRow[] = [
  {
    id: 1,
    leadId: 10,
    jobCode: "JB01/2569",
    imageUrl: "https://example.com/1.jpg",
    description: "ติดตั้งอ่างในห้องน้ำชั้น 2 เสร็จเรียบร้อย",
    stage: "installation",
    senderName: "ช่างเอ ทีมเอ",
    capturedAt: daysAgo(5),
    createdAt: daysAgo(5),
  },
  {
    id: 2,
    leadId: null,
    jobCode: null,
    imageUrl: "https://example.com/2.jpg",
    description: "พบรอยแตกร้าวที่เคาน์เตอร์หน้าอ่าง",
    stage: "service",
    senderName: "ช่างบี ทีมบี",
    capturedAt: daysAgo(15),
    createdAt: daysAgo(15),
  },
  {
    id: 3,
    leadId: 30,
    jobCode: "JB03/2569",
    imageUrl: "https://example.com/3.jpg",
    description: null,
    stage: "installation",
    senderName: "คุณสมชาย ใจดี",
    capturedAt: daysAgo(45),
    createdAt: daysAgo(45),
  },
  {
    id: 4,
    leadId: 40,
    jobCode: "OTHER99",
    imageUrl: "https://example.com/4.jpg",
    description: "งานสำรวจหน้างานทั่วไป",
    stage: "installation",
    senderName: "ทีมซี",
    capturedAt: daysAgo(100),
    createdAt: daysAgo(100),
  },
];

describe("GET /admin/site-photos?q=... (Universal Search)", () => {
  it("matches by jobCode substring", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?q=JB01`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [1]);
    } finally {
      await server.close();
    }
  });

  it("matches by description substring", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?q=${encodeURIComponent("รอยแตก")}`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [2]);
    } finally {
      await server.close();
    }
  });

  it("matches by senderName substring", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?q=${encodeURIComponent("สมชาย")}`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3]);
    } finally {
      await server.close();
    }
  });

  it("also accepts the search= alias", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?search=JB01`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [1]);
    } finally {
      await server.close();
    }
  });

  it("returns nothing when q matches no row", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?q=${encodeURIComponent("ไม่มีข้อมูลนี้")}`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.equal(payload.length, 0);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/site-photos?startDate=...&endDate=... (Date Range)", () => {
  it("filters to rows captured within [startDate, endDate]", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const startDate = daysAgo(20).toISOString();
      const endDate = daysAgo(10).toISOString();
      const response = await fetch(
        `${server.url}/api/admin/site-photos?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        { headers: { cookie } },
      );
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [2]);
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed startDate", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?startDate=not-a-date`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed endDate", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?endDate=not-a-date`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/site-photos?days=30", () => {
  it("returns only rows captured within the last N days", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?days=30`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [1, 2]);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-integer days value", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?days=abc`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a days value below 1", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?days=0`, { headers: { cookie } });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

describe("combining q + stage + limit", () => {
  it("applies q and stage together, then limit truncates to the most recent match", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      // q="ทีม" matches senderName of rows 1 and 4 (not row 3's "คุณสมชาย ใจดี").
      // stage=installation matches rows 1, 3, 4. Combined: rows 1 and 4, newest first is row 1.
      const response = await fetch(
        `${server.url}/api/admin/site-photos?q=${encodeURIComponent("ทีม")}&stage=installation&limit=1`,
        { headers: { cookie } },
      );
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [1]);
    } finally {
      await server.close();
    }
  });

  it("returns both matches when limit is not restrictive", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(
        `${server.url}/api/admin/site-photos?q=${encodeURIComponent("ทีม")}&stage=installation&limit=10`,
        { headers: { cookie } },
      );
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [1, 4]);
    } finally {
      await server.close();
    }
  });
});

describe("backward compatibility", () => {
  it("preserves old behavior (returns everything) when no new query params are sent", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.equal(payload.length, 4);
    } finally {
      await server.close();
    }
  });

  it("still supports jobCode exact match alongside the new q/date params being absent", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(FIXTURE_ROWS));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos?jobCode=JB03/2569`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SitePhotoPayload[];
      assert.deepEqual(payload.map((row) => row.id), [3]);
    } finally {
      await server.close();
    }
  });
});
