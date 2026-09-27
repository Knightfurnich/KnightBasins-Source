import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { mkdtemp, rm, stat, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

/**
 * POST /api/admin/backup/prune applies the retention policy from
 * src/lib/backup-vault.ts to whatever's in KNIGHT_BASINS_BACKUP_DIR. These
 * tests point that env var at a throwaway temp directory (never the real
 * VPS backup vault) and fabricate .sql.gz files with specific mtimes via
 * fs.utimes, so ages can be asserted exactly without waiting real days.
 */

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  KNIGHT_BASINS_BACKUP_DIR: process.env["KNIGHT_BASINS_BACKUP_DIR"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

const DAY_MS = 24 * 60 * 60 * 1000;

let backupDir = "";

/** The prune route never touches the database, so a bare stub is enough. */
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

/** Writes a fake backup file and back-dates its mtime/atime by `ageDays`. */
async function writeAgedBackup(name: string, ageDays: number, contents = "x".repeat(100)) {
  const path = join(backupDir, name);
  await writeFile(path, contents);
  const ageMs = ageDays * DAY_MS;
  const timestamp = new Date(Date.now() - ageMs);
  await utimes(path, timestamp, timestamp);
  return { name, path, bytes: contents.length };
}

before(async () => {
  process.env["ADMIN_PASSWORD"] = "admin-backup-prune-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-backup-prune-test";
  process.env["SESSION_SECRET"] = "admin-backup-prune-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Each test gets a fresh temp directory so age/count assertions are exact.
beforeEach(async () => {
  backupDir = await mkdtemp(join(tmpdir(), "knight-backup-prune-"));
  process.env["KNIGHT_BASINS_BACKUP_DIR"] = backupDir;
});

afterEach(async () => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  await rm(backupDir, { recursive: true, force: true });
});

describe("POST /admin/backup/prune", () => {
  it("rejects an unauthenticated request", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/prune`, { method: "POST" });
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
      const response = await fetch(`${route.url}/api/admin/backup/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 403);
    } finally {
      await route.close();
    }
  });

  it("prunes a 35-day-old backup and reports the freed bytes", async () => {
    const old = await writeAgedBackup("knight_basins_old.sql.gz", 35, "a".repeat(500));
    await writeAgedBackup("knight_basins_recent1.sql.gz", 5);
    await writeAgedBackup("knight_basins_recent2.sql.gz", 3);
    await writeAgedBackup("knight_basins_recent3.sql.gz", 1);

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as {
        prunedCount: number;
        keptCount: number;
        freedBytes: number;
        totalBackups: number;
      };
      assert.equal(payload.prunedCount, 1);
      assert.equal(payload.freedBytes, old.bytes);
      assert.equal(payload.keptCount, 3);
      assert.equal(payload.totalBackups, 4);
      await assert.rejects(() => stat(old.path));
    } finally {
      await route.close();
    }
  });

  it("keeps a 3-day-old backup untouched", async () => {
    await writeAgedBackup("knight_basins_old1.sql.gz", 40);
    await writeAgedBackup("knight_basins_old2.sql.gz", 40);
    await writeAgedBackup("knight_basins_old3.sql.gz", 40);
    const recent = await writeAgedBackup("knight_basins_recent.sql.gz", 3);

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const fs = await import("node:fs/promises");
      const info = await fs.stat(recent.path);
      assert.ok(info.isFile(), "the 3-day-old backup must still be on disk");
    } finally {
      await route.close();
    }
  });

  it("enforces the safety floor: never prunes below 3 remaining backups, even past 30 days", async () => {
    await writeAgedBackup("knight_basins_a.sql.gz", 45);
    await writeAgedBackup("knight_basins_b.sql.gz", 40);

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/prune`, {
        method: "POST",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { prunedCount: number; keptCount: number; totalBackups: number };
      assert.equal(payload.prunedCount, 0, "must refuse to prune when only 2 backups exist");
      assert.equal(payload.keptCount, 2);
      assert.equal(payload.totalBackups, 2);
    } finally {
      await route.close();
    }
  });
});
