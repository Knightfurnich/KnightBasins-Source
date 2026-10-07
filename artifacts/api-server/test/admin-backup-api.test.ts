import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { customerLeads, sitePhotos, basinPrices, paymentSlips } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

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

/** Thenable "table rows" result that also supports .orderBy(...) chaining,
 * so it works both for admin-router.ts's bare `.select().from(table)` calls
 * (backup summary) and its `.select().from(table).orderBy(...)` calls
 * (the two CSV exports). */
function queryableRows(rows: unknown[]) {
  const promise = Promise.resolve([...rows]);
  return Object.assign(promise, {
    orderBy: (..._args: unknown[]) => Promise.resolve([...rows]),
  });
}

function createFakeBackupDatabase(data: {
  leads?: unknown[];
  sitePhotos?: unknown[];
  basins?: unknown[];
  paymentSlips?: unknown[];
}) {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === customerLeads) return queryableRows(data.leads ?? []);
        if (table === sitePhotos) return queryableRows(data.sitePhotos ?? []);
        if (table === basinPrices) return queryableRows(data.basins ?? []);
        if (table === paymentSlips) return queryableRows(data.paymentSlips ?? []);
        return queryableRows([]);
      },
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
  process.env["ADMIN_PASSWORD"] = "admin-backup-api-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-backup-api-test";
  process.env["SESSION_SECRET"] = "admin-backup-api-test-session-secret";
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

const FIXTURE_LEADS = [
  {
    id: 1,
    leadKey: "LEAD-0001",
    name: "คุณสมชาย",
    project: "บ้านสมชาย",
    address: "123 ถ.สุขุมวิท",
    technicianTeamCode: "TP",
    expectedInstallationDate: "2026-10-05",
    status: "quote_requested",
    studioData: { estimate: { totalTHB: 45000 } },
    createdAt: new Date("2026-09-01T02:00:00.000Z"),
  },
  {
    id: 2,
    leadKey: "LEAD-0002",
    name: "คุณสมหญิง",
    project: null,
    address: null,
    technicianTeamCode: null,
    expectedInstallationDate: null,
    status: "closed",
    studioData: null,
    createdAt: new Date("2026-09-05T02:00:00.000Z"),
  },
];

const FIXTURE_BASINS = [
  {
    id: 1,
    sku: "KF001",
    colorName: "White",
    colorCode: "WHT",
    priceTHB: 4500,
    dimensions: "500x400mm",
    bowlMm: "400x300x120mm",
    basinDimensions: null,
    imageUrl: "https://example.com/kf001.jpg",
    topViewImageUrl: "https://example.com/kf001-top.jpg",
  },
  {
    id: 2,
    sku: "KF002",
    colorName: "Black",
    colorCode: "BLK",
    priceTHB: 5200,
    dimensions: "600x450mm",
    bowlMm: null,
    basinDimensions: null,
    imageUrl: "",
    topViewImageUrl: null,
  },
];

const FIXTURE_SITE_PHOTOS = [{ id: 1 }, { id: 2 }, { id: 3 }];
const FIXTURE_PAYMENT_SLIPS = [{ id: 1 }, { id: 2 }];

describe("GET /admin/backup/summary", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({}));
    try {
      const response = await fetch(`${server.url}/api/admin/backup/summary`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns accurate counts for all 4 record types plus a generatedAt timestamp", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({
      leads: FIXTURE_LEADS,
      sitePhotos: FIXTURE_SITE_PHOTOS,
      basins: FIXTURE_BASINS,
      paymentSlips: FIXTURE_PAYMENT_SLIPS,
    }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/summary`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as {
        leadsCount: number; sitePhotosCount: number; basinsCount: number; paymentSlipsCount: number; generatedAt: string;
      };
      assert.equal(payload.leadsCount, 2);
      assert.equal(payload.sitePhotosCount, 3);
      assert.equal(payload.basinsCount, 2);
      assert.equal(payload.paymentSlipsCount, 2);
      assert.ok(!Number.isNaN(new Date(payload.generatedAt).getTime()), "generatedAt must be a valid timestamp");
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking both leads and basins permission", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({}));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "installed-stones";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/summary`, { headers: { cookie } });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/backup/leads-export", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ leads: FIXTURE_LEADS }));
    try {
      const response = await fetch(`${server.url}/api/admin/backup/leads-export`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns text/csv with a UTF-8 BOM and the expected Thai column headers", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ leads: FIXTURE_LEADS }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/leads-export`, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
      assert.ok(response.headers.get("content-disposition")?.includes("attachment"));
      // fetch's response.text() decodes UTF-8 and silently strips a leading BOM
      // (per the WHATWG TextDecoder spec), so the raw bytes must be checked instead.
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      assert.deepEqual([bytes[0], bytes[1], bytes[2]], [0xEF, 0xBB, 0xBF], "first 3 bytes must be the UTF-8 BOM");
      const text = await response.text();
      assert.ok(text.includes("รหัสงาน,ชื่อลูกค้า,โครงการ,ที่อยู่,ทีมช่าง,วันที่นัด,สถานะ,ยอดเงิน,วันที่สร้าง"));
    } finally {
      await server.close();
    }
  });

  it("exports every lead's data, correctly computing status label and quote total", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ leads: FIXTURE_LEADS }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/leads-export`, { headers: { cookie } });
      const text = await response.text();
      const lines = text.replace(/^﻿/, "").split("\r\n");
      assert.equal(lines.length, 3, "header + 2 leads");
      assert.equal(lines[1], "LEAD-0001,คุณสมชาย,บ้านสมชาย,123 ถ.สุขุมวิท,TP,2026-10-05,ขอใบเสนอราคา,45000,2026-09-01T02:00:00.000Z");
      assert.equal(lines[2], "LEAD-0002,คุณสมหญิง,,,,,ปิดการขาย,,2026-09-05T02:00:00.000Z");
    } finally {
      await server.close();
    }
  });

  it("exports quote_sent with a readable Thai status label", async () => {
    const lead = { ...FIXTURE_LEADS[0], leadKey: "LEAD-0003", status: "quote_sent" };
    const server = await startAdminRoute(createFakeBackupDatabase({ leads: [lead] }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/leads-export`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const lines = (await response.text()).replace(/^﻿/, "").split("\r\n");
      assert.equal(lines[1], "LEAD-0003,คุณสมชาย,บ้านสมชาย,123 ถ.สุขุมวิท,TP,2026-10-05,ส่งใบเสนอราคาแล้ว,45000,2026-09-01T02:00:00.000Z");
      assert.ok(!lines[1]?.includes("quote_sent"));
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking both leads and basins permission", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ leads: FIXTURE_LEADS }));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "installed-stones";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/leads-export`, { headers: { cookie } });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/backup/basins-export", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ basins: FIXTURE_BASINS }));
    try {
      const response = await fetch(`${server.url}/api/admin/backup/basins-export`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns text/csv with a UTF-8 BOM and the expected column headers", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ basins: FIXTURE_BASINS }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/basins-export`, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      assert.deepEqual([bytes[0], bytes[1], bytes[2]], [0xEF, 0xBB, 0xBF], "first 3 bytes must be the UTF-8 BOM");
      const text = await response.text();
      assert.ok(text.includes("SKU,ชื่อสี,รหัสสี,ราคา,ขนาด,ขนาดหลุม,ลิงก์ภาพหลัก,ลิงก์ภาพ Top View"));
    } finally {
      await server.close();
    }
  });

  it("exports every basin, falling back to the generated image URL and blank topViewImageUrl when unset", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ basins: FIXTURE_BASINS }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/basins-export`, { headers: { cookie } });
      const text = await response.text();
      const lines = text.replace(/^﻿/, "").split("\r\n");
      assert.equal(lines.length, 3, "header + 2 basins");
      assert.equal(lines[1], "KF001,White,WHT,4500,500x400mm,400x300x120mm,https://example.com/kf001.jpg,https://example.com/kf001-top.jpg");
      // KF002 has no stored imageUrl, so withBasinMedia() falls back to the generated basin-hd URL; topViewImageUrl is blank.
      assert.ok(lines[2]?.startsWith("KF002,Black,BLK,5200,600x450mm,,https://knightbasins.com/kb/images/basin-hd/KF002.jpg,"));
      assert.ok(lines[2]?.endsWith(","), "topViewImageUrl column is blank when null");
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking both leads and basins permission", async () => {
    const server = await startAdminRoute(createFakeBackupDatabase({ basins: FIXTURE_BASINS }));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "installed-stones";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/backup/basins-export`, { headers: { cookie } });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });
});
