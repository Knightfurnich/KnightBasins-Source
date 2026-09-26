import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { importTypeScriptModule } from "./route-harness.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import {
  loadCatalog,
  resolvePortfolioFilePath,
  saveCatalog,
  type PortfolioItem,
} from "../src/lib/portfolio-catalog.ts";

type PortfolioRouteModule = { default: Parameters<typeof express["use"]>[1] };

async function startPortfolioRoute() {
  const routeModule = await importTypeScriptModule<PortfolioRouteModule>("src/routes/portfolio.ts");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.default);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Portfolio batch-delete test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function adminCookie() {
  return `knight_admin_session=${createAdminToken()}`;
}

function makeItem(overrides: Partial<PortfolioItem> & { id: string }): PortfolioItem {
  return {
    category: "bathroom",
    categoryName: "ห้องน้ำ",
    icon: "🛁",
    filename: `${overrides.id}.png`,
    url: `/api/uploads/portfolio/bathroom/${overrides.id}.png`,
    width: 10,
    height: 10,
    bytes: 4,
    title: overrides.id,
    ...overrides,
  };
}

async function writeItemFile(uploadDirectory: string, item: PortfolioItem, contents = "x"): Promise<void> {
  const filePath = resolvePortfolioFilePath(uploadDirectory, item.category, item.filename)!;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

const originalEnv = {
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
};
let uploadDirectory: string;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-batch-delete-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
  process.env["DATABASE_URL"] = "postgres://portfolio-batch-delete-test";
  process.env["SESSION_SECRET"] = "portfolio-batch-delete-test-secret";
  process.env["ADMIN_PASSWORD"] = "portfolio-batch-delete-test-password";
});

afterEach(async () => {
  await rm(path.join(uploadDirectory, "portfolio"), { force: true, recursive: true });
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { force: true, recursive: true });
});

describe("POST /api/admin/portfolio/batch-delete", () => {
  it("rejects an unauthenticated request", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["bathroom_001"] }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("deletes multiple items: files removed from disk, catalog entries gone, deletedIds complete", async () => {
    const items = [makeItem({ id: "bathroom_001" }), makeItem({ id: "bathroom_002" }), makeItem({ id: "bathroom_003" })];
    for (const item of items) await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: ["bathroom_001", "bathroom_002", "bathroom_003"] }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { deletedIds: string[]; notFoundIds: string[]; filesRemovedCount: number };
      assert.deepEqual(body.deletedIds, ["bathroom_001", "bathroom_002", "bathroom_003"]);
      assert.deepEqual(body.notFoundIds, []);
      assert.equal(body.filesRemovedCount, 3);

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.length, 0);

      for (const item of items) {
        const filePath = resolvePortfolioFilePath(uploadDirectory, item.category, item.filename)!;
        await assert.rejects(readFile(filePath));
      }
    } finally {
      await server.close();
    }
  });

  it("removes deleted ids from visibility.json in the same call", async () => {
    const items = [makeItem({ id: "bathroom_010" }), makeItem({ id: "bathroom_011" })];
    for (const item of items) await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });

    const server = await startPortfolioRoute();
    try {
      const hideResponse = await fetch(`${server.url}/api/admin/portfolio/bathroom_010/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ visible: false }),
      });
      assert.equal(hideResponse.status, 200);

      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: ["bathroom_010", "bathroom_011"] }),
      });
      assert.equal(response.status, 200);

      const visibilityRaw = await readFile(path.join(uploadDirectory, "portfolio", "visibility.json"), "utf8");
      const visibilityMap = JSON.parse(visibilityRaw) as Record<string, unknown>;
      assert.equal("bathroom_010" in visibilityMap, false);
    } finally {
      await server.close();
    }
  });

  it("deletes only the ids that exist and reports the rest as notFoundIds", async () => {
    const item = makeItem({ id: "bathroom_020" });
    await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: 1, items: [item] });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: ["bathroom_020", "does-not-exist-1", "does-not-exist-2"] }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { deletedIds: string[]; notFoundIds: string[]; filesRemovedCount: number };
      assert.deepEqual(body.deletedIds, ["bathroom_020"]);
      assert.deepEqual(body.notFoundIds, ["does-not-exist-1", "does-not-exist-2"]);
      assert.equal(body.filesRemovedCount, 1);

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.length, 0);
    } finally {
      await server.close();
    }
  });

  it("never deletes a file outside uploads/portfolio/, even for a tampered catalog entry (path traversal)", async () => {
    const sentinelDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-batch-delete-traversal-sentinel-"));
    const sentinelPath = path.join(sentinelDir, "do-not-delete.txt");
    await writeFile(sentinelPath, "must survive", "utf8");
    try {
      await mkdir(path.join(uploadDirectory, "portfolio"), { recursive: true });
      const maliciousItem: PortfolioItem = makeItem({
        id: "evil_001",
        category: `..${path.sep}..${path.sep}${path.basename(sentinelDir)}`,
        filename: "do-not-delete.txt",
      });
      const safeItem = makeItem({ id: "bathroom_030" });
      await writeItemFile(uploadDirectory, safeItem);
      await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: 2, items: [maliciousItem, safeItem] });

      const server = await startPortfolioRoute();
      try {
        const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: adminCookie() },
          body: JSON.stringify({ ids: ["evil_001", "bathroom_030"] }),
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as { deletedIds: string[]; filesRemovedCount: number };
        // Both catalog entries are still removed (the entry itself, not the
        // file, is what's untrusted) -- but only the safe item's file is
        // actually unlinked from disk.
        assert.deepEqual([...body.deletedIds].sort(), ["bathroom_030", "evil_001"]);
        assert.equal(body.filesRemovedCount, 1, "resolvePortfolioFilePath must refuse a category containing path separators");

        const sentinelStillThere = await readFile(sentinelPath, "utf8");
        assert.equal(sentinelStillThere, "must survive");
      } finally {
        await server.close();
      }
    } finally {
      await rm(sentinelDir, { force: true, recursive: true });
    }
  });

  it("rejects a request with no admin session even when the payload is otherwise valid (401)", async () => {
    const item = makeItem({ id: "bathroom_040" });
    await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: 1, items: [item] });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["bathroom_040"] }),
      });
      assert.equal(response.status, 401);

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.length, 1, "an unauthenticated request must not delete anything");
    } finally {
      await server.close();
    }
  });

  it("rejects an empty ids array (400)", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: [] }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-array ids payload (400)", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: "bathroom_001" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects an ids array containing non-string entries (400)", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: ["bathroom_001", 42] }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("accepts exactly 50 ids", async () => {
    const items = Array.from({ length: 50 }, (_, i) => makeItem({ id: `bathroom_${String(i).padStart(3, "0")}` }));
    for (const item of items) await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: items.map((item) => item.id) }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { deletedIds: string[]; filesRemovedCount: number };
      assert.equal(body.deletedIds.length, 50);
      assert.equal(body.filesRemovedCount, 50);
    } finally {
      await server.close();
    }
  });

  it("rejects a batch of 51 ids (over the 50-id quota) with 400 and deletes nothing", async () => {
    const items = Array.from({ length: 51 }, (_, i) => makeItem({ id: `bathroom_${String(i).padStart(3, "0")}` }));
    for (const item of items) await writeItemFile(uploadDirectory, item);
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ ids: items.map((item) => item.id) }),
      });
      assert.equal(response.status, 400);

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.length, 51, "a rejected over-quota request must not delete anything");
    } finally {
      await server.close();
    }
  });
});
