import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { mkdir, mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

/**
 * GET /api/admin/storage/stats reports portfolio/backup file counts+sizes
 * from src/lib/storage-stats.ts. These tests point UPLOAD_DIR and
 * KNIGHT_BASINS_BACKUP_DIR at throwaway temp directories (never the real
 * VPS upload/backup paths) so counts and byte totals can be asserted exactly.
 */

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type StorageStatsResponse = {
  portfolio: { count: number; totalBytes: number; averageBytes: number };
  backups: { count: number; totalBytes: number; oldestDate: string | null; newestDate: string | null };
  diskUsage: { freeBytes: number; totalBytes: number; usedBytes: number };
  status: "healthy" | "warning";
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
  KNIGHT_BASINS_BACKUP_DIR: process.env["KNIGHT_BASINS_BACKUP_DIR"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

const DAY_MS = 24 * 60 * 60 * 1000;

let uploadDir = "";
let backupDir = "";

/** The storage/stats route never touches the database, so a bare stub is enough. */
function createUnusedDatabase() {
  return {
    select: () => ({ from: () => Promise.resolve([]) }),
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

function adminCookie(): string {
  return `knight_admin_session=${createAdminToken()}`;
}

async function writePortfolioCatalog(items: Array<{ id: string; bytes: number }>) {
  const catalogDir = join(uploadDir, "portfolio");
  await mkdir(catalogDir, { recursive: true });
  const catalog = {
    updatedAt: new Date().toISOString(),
    total: items.length,
    items: items.map((item) => ({
      id: item.id,
      category: "counter",
      categoryName: "เคาน์เตอร์",
      icon: "kitchen",
      filename: `${item.id}.jpg`,
      url: `/uploads/portfolio/counter/${item.id}.jpg`,
      width: 800,
      height: 600,
      bytes: item.bytes,
      title: item.id,
    })),
  };
  await writeFile(join(catalogDir, "catalog.json"), JSON.stringify(catalog, null, 2), "utf8");
}

/** Writes a fake backup file and back-dates its mtime/atime by `ageDays`. */
async function writeAgedBackup(name: string, ageDays: number, contents = "x".repeat(100)) {
  const path = join(backupDir, name);
  await writeFile(path, contents);
  const timestamp = new Date(Date.now() - ageDays * DAY_MS);
  await utimes(path, timestamp, timestamp);
  return { name, path, bytes: contents.length };
}

before(async () => {
  process.env["ADMIN_PASSWORD"] = "admin-storage-stats-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-storage-stats-test";
  process.env["SESSION_SECRET"] = "admin-storage-stats-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Each test gets fresh temp directories so counts/sizes are exact.
beforeEach(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), "knight-storage-stats-upload-"));
  backupDir = await mkdtemp(join(tmpdir(), "knight-storage-stats-backup-"));
  process.env["UPLOAD_DIR"] = uploadDir;
  process.env["KNIGHT_BASINS_BACKUP_DIR"] = backupDir;
});

afterEach(async () => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  await rm(uploadDir, { recursive: true, force: true });
  await rm(backupDir, { recursive: true, force: true });
});

describe("GET /admin/storage/stats", () => {
  it("rejects an unauthenticated request", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/storage/stats`);
      assert.equal(response.status, 401);
    } finally {
      await route.close();
    }
  });

  it("rejects an admin session without the leads/basins permission", async () => {
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "sheet-stones";
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/storage/stats`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 403);
    } finally {
      await route.close();
    }
  });

  it("reports portfolio and backup stats correctly", async () => {
    await writePortfolioCatalog([
      { id: "counter_001", bytes: 1000 },
      { id: "counter_002", bytes: 3000 },
    ]);
    const older = await writeAgedBackup("knight_basins_older.sql.gz", 10, "a".repeat(500));
    const newer = await writeAgedBackup("knight_basins_newer.sql.gz", 1, "b".repeat(300));

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/storage/stats`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as StorageStatsResponse;

      assert.equal(payload.portfolio.count, 2);
      assert.equal(payload.portfolio.totalBytes, 4000);
      assert.equal(payload.portfolio.averageBytes, 2000);

      assert.equal(payload.backups.count, 2);
      assert.equal(payload.backups.totalBytes, older.bytes + newer.bytes);
      assert.ok(payload.backups.oldestDate && payload.backups.newestDate);
      assert.ok(new Date(payload.backups.newestDate!).getTime() > new Date(payload.backups.oldestDate!).getTime());

      assert.ok(["healthy", "warning"].includes(payload.status));
    } finally {
      await route.close();
    }
  });

  it("falls back to safe zeros when portfolio and backups are empty, without erroring", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/storage/stats`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as StorageStatsResponse;

      assert.equal(payload.portfolio.count, 0);
      assert.equal(payload.portfolio.totalBytes, 0);
      assert.equal(payload.portfolio.averageBytes, 0);

      assert.equal(payload.backups.count, 0);
      assert.equal(payload.backups.totalBytes, 0);
      assert.equal(payload.backups.oldestDate, null);
      assert.equal(payload.backups.newestDate, null);

      assert.equal(payload.status, "healthy");
    } finally {
      await route.close();
    }
  });

  it("falls back to safe zeros when the backup directory does not exist", async () => {
    await rm(backupDir, { recursive: true, force: true });
    process.env["KNIGHT_BASINS_BACKUP_DIR"] = join(backupDir, "does-not-exist");

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/storage/stats`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as StorageStatsResponse;
      assert.equal(payload.backups.count, 0);
      assert.equal(payload.backups.totalBytes, 0);
    } finally {
      await route.close();
    }
  });
});
