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
  generatePortfolioId,
  loadCatalog,
  readImageDimensions,
  resolvePortfolioFilePath,
  saveCatalog,
  type PortfolioItem,
} from "../src/lib/portfolio-catalog.ts";

type PortfolioRouteModule = { default: Parameters<typeof express["use"]>[1] };

// ---- test image fixtures ---------------------------------------------------

/** A structurally-valid-enough PNG: real signature + a real IHDR chunk (CRC is dummy, never checked by our own reader or by hasFileSignature's magic-byte check). */
function buildPngBuffer(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13, 0);
  const type = Buffer.from("IHDR");
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  const crc = Buffer.alloc(4);
  return Buffer.concat([signature, length, type, data, crc]);
}

const SAMPLE_PNG = buildPngBuffer(1200, 800);

// ---- shared harness ---------------------------------------------------------

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
    throw new Error("Portfolio admin-write test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function adminCookie() {
  return `knight_admin_session=${createAdminToken()}`;
}

function uploadForm(fileBuffer: Buffer, options: { category?: string; title?: string; contentType?: string; filename?: string } = {}) {
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: options.contentType ?? "image/png" }), options.filename ?? "photo.png");
  if (options.category !== undefined) form.append("category", options.category);
  if (options.title !== undefined) form.append("title", options.title);
  return form;
}

const originalEnv = {
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
};
let uploadDirectory: string;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-admin-write-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
  process.env["DATABASE_URL"] = "postgres://portfolio-admin-write-test";
  process.env["SESSION_SECRET"] = "portfolio-admin-write-test-secret";
  process.env["ADMIN_PASSWORD"] = "portfolio-admin-write-test-password";
});

afterEach(async () => {
  // Every test gets a clean uploads/portfolio/ -- otherwise a catalog.json
  // (or a category subfolder) left behind by one test would leak into the
  // next test's item counts/ids, since uploadDirectory itself is shared for
  // the whole file (a fresh mkdtemp per test would be needlessly slow here).
  await rm(path.join(uploadDirectory, "portfolio"), { force: true, recursive: true });
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { force: true, recursive: true });
});

// ---- lib/portfolio-catalog.ts (unit) ---------------------------------------

describe("portfolio-catalog.ts helpers", () => {
  it("generatePortfolioId avoids colliding with existing ids", () => {
    const existing = new Set(["bathroom_001", "bathroom_002"]);
    const id = generatePortfolioId("bathroom", existing);
    assert.equal(id, "bathroom_003");
    assert.ok(!existing.has(id));
  });

  it("resolvePortfolioFilePath resolves a normal category/filename under uploads/portfolio/", () => {
    const resolved = resolvePortfolioFilePath(uploadDirectory, "bathroom", "bathroom_abc_123.jpg");
    assert.ok(resolved);
    assert.ok(resolved!.startsWith(path.join(uploadDirectory, "portfolio", "bathroom")));
  });

  it("resolvePortfolioFilePath refuses a path-traversal category or filename", () => {
    assert.equal(resolvePortfolioFilePath(uploadDirectory, "../../etc", "passwd"), null);
    assert.equal(resolvePortfolioFilePath(uploadDirectory, "bathroom", "../../../etc/passwd"), null);
    assert.equal(resolvePortfolioFilePath(uploadDirectory, "..", "file.jpg"), null);
    assert.equal(resolvePortfolioFilePath(uploadDirectory, "bathroom", ".."), null);
  });

  it("readImageDimensions reads a real PNG IHDR chunk correctly", () => {
    const dims = readImageDimensions(buildPngBuffer(640, 480), "image/png");
    assert.deepEqual(dims, { width: 640, height: 480 });
  });

  it("readImageDimensions reads a GIF logical screen descriptor correctly", () => {
    const gif = Buffer.alloc(10);
    gif.write("GIF89a", 0, "ascii");
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(240, 8);
    assert.deepEqual(readImageDimensions(gif, "image/gif"), { width: 320, height: 240 });
  });

  it("readImageDimensions returns null for an unrecognized or too-short buffer", () => {
    assert.equal(readImageDimensions(Buffer.from("not an image"), "image/png"), null);
    assert.equal(readImageDimensions(Buffer.alloc(2), "image/gif"), null);
  });

  it("saveCatalog + loadCatalog round-trip atomically", async () => {
    const catalog = { updatedAt: new Date().toISOString(), total: 1, items: [{ id: "x_001", category: "x", categoryName: "X", icon: "📸", filename: "x_001.jpg", url: "/api/uploads/portfolio/x/x_001.jpg", width: 10, height: 10, bytes: 100, title: "t" }] };
    await saveCatalog(uploadDirectory, catalog);
    const loaded = await loadCatalog(uploadDirectory);
    assert.deepEqual(loaded, catalog);
  });
});

// ---- POST /api/admin/portfolio/upload --------------------------------------

describe("POST /api/admin/portfolio/upload", () => {
  it("rejects an unauthenticated request", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        body: uploadForm(SAMPLE_PNG, { category: "bathroom" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("adds a new photo: file written to disk, catalog gains a unique-id item, response is 201", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(SAMPLE_PNG, { category: "bathroom", title: "ห้องน้ำคอนโดตัวอย่าง" }),
      });
      assert.equal(response.status, 201);
      const item = (await response.json()) as PortfolioItem;
      assert.equal(item.category, "bathroom");
      assert.equal(item.title, "ห้องน้ำคอนโดตัวอย่าง");
      assert.equal(item.width, 1200);
      assert.equal(item.height, 800);
      assert.equal(item.bytes, SAMPLE_PNG.length);
      assert.ok(item.id.startsWith("bathroom_"));

      const onDisk = await readFile(path.join(uploadDirectory, "portfolio", "bathroom", item.filename));
      assert.deepEqual(onDisk, SAMPLE_PNG);

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.length, 1);
      assert.equal(catalog.items[0]?.id, item.id);
    } finally {
      await server.close();
    }
  });

  it("assigns non-colliding ids across repeated uploads to the same category", async () => {
    const server = await startPortfolioRoute();
    try {
      const first = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(SAMPLE_PNG, { category: "counter" }),
      });
      const second = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(SAMPLE_PNG, { category: "counter" }),
      });
      const firstItem = (await first.json()) as PortfolioItem;
      const secondItem = (await second.json()) as PortfolioItem;
      assert.notEqual(firstItem.id, secondItem.id);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing/unknown category", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(SAMPLE_PNG, { category: "not-a-real-category" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a file whose magic bytes don't match its declared image type", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(Buffer.from("this is definitely not a png"), { category: "bathroom" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-image content type outright", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(Buffer.from("hello"), { category: "bathroom", contentType: "text/plain", filename: "note.txt" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a file over the 10MB limit", async () => {
    const server = await startPortfolioRoute();
    try {
      const oversized = Buffer.concat([SAMPLE_PNG, Buffer.alloc(10 * 1024 * 1024)]);
      const response = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(oversized, { category: "bathroom" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

// ---- DELETE /api/admin/portfolio/:id ---------------------------------------

describe("DELETE /api/admin/portfolio/:id", () => {
  it("rejects an unauthenticated request", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/anything`, { method: "DELETE" });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for an id that doesn't exist", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/does-not-exist`, {
        method: "DELETE",
        headers: { cookie: adminCookie() },
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("deletes the catalog entry, the file on disk, and its visibility.json entry", async () => {
    const server = await startPortfolioRoute();
    try {
      const uploadResponse = await fetch(`${server.url}/api/admin/portfolio/upload`, {
        method: "POST",
        headers: { cookie: adminCookie() },
        body: uploadForm(SAMPLE_PNG, { category: "bathroom" }),
      });
      const item = (await uploadResponse.json()) as PortfolioItem;

      const hideResponse = await fetch(`${server.url}/api/admin/portfolio/${item.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: adminCookie() },
        body: JSON.stringify({ visible: false }),
      });
      assert.equal(hideResponse.status, 200);

      const deleteResponse = await fetch(`${server.url}/api/admin/portfolio/${item.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie() },
      });
      assert.equal(deleteResponse.status, 200);
      const body = (await deleteResponse.json()) as { id: string; deleted: boolean; fileRemoved: boolean };
      assert.deepEqual(body, { id: item.id, deleted: true, fileRemoved: true });

      const catalog = await loadCatalog(uploadDirectory);
      assert.equal(catalog.items.some((entry) => entry.id === item.id), false);

      const visibilityRaw = await readFile(path.join(uploadDirectory, "portfolio", "visibility.json"), "utf8");
      assert.equal(Object.keys(JSON.parse(visibilityRaw) as Record<string, unknown>).includes(item.id), false);

      await assert.rejects(readFile(path.join(uploadDirectory, "portfolio", "bathroom", item.filename)));
    } finally {
      await server.close();
    }
  });

  it("never deletes a file outside uploads/portfolio/, even for a tampered catalog entry (path traversal)", async () => {
    // A sentinel file well outside the sandbox, standing in for a real system file.
    const sentinelDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-traversal-sentinel-"));
    const sentinelPath = path.join(sentinelDir, "do-not-delete.txt");
    await writeFile(sentinelPath, "must survive", "utf8");
    try {
      await mkdir(path.join(uploadDirectory, "portfolio"), { recursive: true });
      const maliciousItem: PortfolioItem = {
        id: "evil_001",
        category: `..${path.sep}..${path.sep}${path.basename(sentinelDir)}`,
        categoryName: "evil",
        icon: "📸",
        filename: "do-not-delete.txt",
        url: "/api/uploads/portfolio/evil/do-not-delete.txt",
        width: 1,
        height: 1,
        bytes: 1,
        title: "evil",
      };
      await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: 1, items: [maliciousItem] });

      const server = await startPortfolioRoute();
      try {
        const response = await fetch(`${server.url}/api/admin/portfolio/evil_001`, {
          method: "DELETE",
          headers: { cookie: adminCookie() },
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as { fileRemoved: boolean };
        assert.equal(body.fileRemoved, false, "resolvePortfolioFilePath must refuse a category containing path separators");

        const sentinelStillThere = await readFile(sentinelPath, "utf8");
        assert.equal(sentinelStillThere, "must survive");
      } finally {
        await server.close();
      }
    } finally {
      await rm(sentinelDir, { force: true, recursive: true });
    }
  });
});

// ---- GET /api/admin/portfolio/duplicates -----------------------------------

describe("GET /api/admin/portfolio/duplicates", () => {
  it("rejects an unauthenticated request", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/duplicates`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("groups byte-identical files (MD5) and same width/height/bytes pairs, leaving unrelated items alone", async () => {
    // Two items pointing at byte-identical files -> an MD5 duplicate group.
    const dupPathA = resolvePortfolioFilePath(uploadDirectory, "bathroom", "dup_a.png")!;
    const dupPathB = resolvePortfolioFilePath(uploadDirectory, "bathroom", "dup_b.png")!;
    await mkdir(path.dirname(dupPathA), { recursive: true });
    await writeFile(dupPathA, SAMPLE_PNG);
    await writeFile(dupPathB, SAMPLE_PNG);

    // A lone, unrelated file -- must never appear in any group.
    const uniquePath = resolvePortfolioFilePath(uploadDirectory, "bathroom", "unique.png")!;
    await writeFile(uniquePath, buildPngBuffer(50, 50));

    const items: PortfolioItem[] = [
      { id: "dup_a", category: "bathroom", categoryName: "ห้องน้ำ", icon: "🛁", filename: "dup_a.png", url: "/api/uploads/portfolio/bathroom/dup_a.png", width: 1200, height: 800, bytes: SAMPLE_PNG.length, title: "a" },
      { id: "dup_b", category: "bathroom", categoryName: "ห้องน้ำ", icon: "🛁", filename: "dup_b.png", url: "/api/uploads/portfolio/bathroom/dup_b.png", width: 1200, height: 800, bytes: SAMPLE_PNG.length, title: "b" },
      // Same width/height/bytes as the MD5 pair but genuinely different bytes -- still flagged by the dimensions signal.
      { id: "dim_c", category: "bathroom", categoryName: "ห้องน้ำ", icon: "🛁", filename: "dim_c.png", url: "/api/uploads/portfolio/bathroom/dim_c.png", width: 1200, height: 800, bytes: SAMPLE_PNG.length, title: "c" },
      { id: "unique", category: "bathroom", categoryName: "ห้องน้ำ", icon: "🛁", filename: "unique.png", url: "/api/uploads/portfolio/bathroom/unique.png", width: 50, height: 50, bytes: 999, title: "u" },
    ];
    await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });

    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/admin/portfolio/duplicates`, { headers: { cookie: adminCookie() } });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { groups: Array<{ reason: string; itemIds: string[] }> };

      const md5Group = body.groups.find((group) => group.reason === "md5");
      assert.ok(md5Group);
      assert.deepEqual([...md5Group!.itemIds].sort(), ["dup_a", "dup_b"]);

      const dimensionGroup = body.groups.find((group) => group.reason === "dimensions");
      assert.ok(dimensionGroup);
      assert.deepEqual([...dimensionGroup!.itemIds].sort(), ["dim_c", "dup_a", "dup_b"]);

      for (const group of body.groups) {
        assert.ok(!group.itemIds.includes("unique"), "an unrelated singleton item must never appear in any duplicate group");
      }
    } finally {
      await server.close();
    }
  });
});
