import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

/**
 * The .sql.gz dumps themselves are produced off-container by
 * backups/knight_db_backup.sh and mounted read-only at BACKUP_DIR. These tests
 * point BACKUP_DIR at a temp directory so they can assert the route's real
 * behaviour: the auth gate, the "no dump yet" case, newest-first selection when
 * several dumps exist, the ?list=1 metadata shape, and that the download is a
 * gzip attachment rather than inline text.
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

let backupDir = "";

/** The dump route never touches the database, so a bare stub is enough. */
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

before(async () => {
  process.env["ADMIN_PASSWORD"] = "admin-backup-dump-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-backup-dump-test";
  process.env["SESSION_SECRET"] = "admin-backup-dump-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  backupDir = await mkdtemp(join(tmpdir(), "knight-backup-dump-"));
  process.env["KNIGHT_BASINS_BACKUP_DIR"] = backupDir;
});

after(async () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (backupDir) await rm(backupDir, { recursive: true, force: true });
});

afterEach(async () => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  // Each test starts from a clean directory so "newest" assertions are exact.
  for (const name of ["knight_basins_20260101T010101Z.sql.gz", "knight_basins_20260202T020202Z.sql.gz", "notes.txt"]) {
    await rm(join(backupDir, name), { force: true });
  }
});

describe("GET /admin/backup/database-dump", () => {
  it("rejects an unauthenticated request", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/database-dump`);
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
      const response = await fetch(`${route.url}/api/admin/backup/database-dump`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 403);
    } finally {
      await route.close();
    }
  });

  it("reports 404 with a Thai message when no dump exists yet", async () => {
    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/database-dump`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 404);
      const payload = await response.json() as { message?: string };
      assert.match(payload.message ?? "", /ยังไม่มีไฟล์สำรองฐานข้อมูล/);
    } finally {
      await route.close();
    }
  });

  it("serves the newest dump as a gzip attachment and ignores non-dump files", async () => {
    const olderName = "knight_basins_20260101T010101Z.sql.gz";
    const newerName = "knight_basins_20260202T020202Z.sql.gz";
    await writeFile(join(backupDir, olderName), "older-dump-bytes");
    await writeFile(join(backupDir, newerName), "newest-dump-bytes");
    await writeFile(join(backupDir, "notes.txt"), "not a dump");

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/database-dump`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/gzip");
      assert.match(response.headers.get("content-disposition") ?? "", new RegExp(`attachment; filename="${newerName}"`));
      assert.equal(await response.text(), "newest-dump-bytes");
    } finally {
      await route.close();
    }
  });

  it("returns dump metadata (not the binary) for ?list=1, newest first", async () => {
    const olderName = "knight_basins_20260101T010101Z.sql.gz";
    const newerName = "knight_basins_20260202T020202Z.sql.gz";
    await writeFile(join(backupDir, olderName), "older-dump-bytes");
    await writeFile(join(backupDir, newerName), "newest-dump-bytes");

    const route = await startAdminRoute(createUnusedDatabase());
    try {
      const response = await fetch(`${route.url}/api/admin/backup/database-dump?list=1`, {
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { latest: string; count: number; dumps: Array<{ name: string; bytes: number }> };
      assert.equal(payload.latest, newerName);
      assert.equal(payload.count, 2);
      assert.deepEqual(payload.dumps.map((dump) => dump.name), [newerName, olderName]);
      assert.equal(payload.dumps[0]!.bytes, "newest-dump-bytes".length);
    } finally {
      await route.close();
    }
  });
});
