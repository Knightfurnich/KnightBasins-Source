import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { importTypeScriptModule } from "./route-harness.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";

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
    throw new Error("Portfolio resilience test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const originalEnv = {
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  PORTFOLIO_FEATURED_KB_PATH: process.env["PORTFOLIO_FEATURED_KB_PATH"],
};
let uploadDirectory: string;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-resilience-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
  process.env["DATABASE_URL"] = "postgres://portfolio-resilience-test";
  process.env["SESSION_SECRET"] = "portfolio-resilience-test-secret";
  process.env["ADMIN_PASSWORD"] = "portfolio-resilience-test-password";
  // portfolio.ts's 3rd featured.json candidate is a hardcoded path outside
  // UPLOAD_DIR (a real file on the production VPS) -- point it inside this
  // test's own throwaway temp directory, where it's guaranteed never to
  // exist, so these tests behave the same on every machine that runs them.
  process.env["PORTFOLIO_FEATURED_KB_PATH"] = path.join(uploadDirectory, "never-created-knight-design-kb-featured.json");
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { force: true, recursive: true });
});

function samplePortfolioItem(id: string) {
  return {
    id,
    category: "bathroom",
    categoryName: "ห้องน้ำ",
    icon: "🛁",
    filename: `${id}.jpg`,
    url: `https://example.com/${id}.jpg`,
    width: 1200,
    height: 800,
    bytes: 123456,
    title: "ผลงานติดตั้งจริง",
  };
}

describe("GET /api/portfolio resilience", () => {
  it("returns 200 with an empty catalog when catalog.json does not exist at all", async () => {
    // A fresh portfolio/ directory with no catalog.json in it -- the exact
    // "Local Test Harness" scenario job-100 names.
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { total: number; items: unknown[] };
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
    } finally {
      await server.close();
    }
  });

  it("returns 200 with an empty catalog when catalog.json exists but is malformed JSON", async () => {
    const portfolioDir = path.join(uploadDirectory, "portfolio");
    await mkdir(portfolioDir, { recursive: true });
    await writeFile(path.join(portfolioDir, "catalog.json"), "{ this is not valid json ", "utf8");
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { total: number; items: unknown[] };
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
    } finally {
      await server.close();
      await rm(portfolioDir, { force: true, recursive: true });
    }
  });

  it("still serves a normal, valid catalog fully and correctly (no regression)", async () => {
    const portfolioDir = path.join(uploadDirectory, "portfolio");
    await mkdir(portfolioDir, { recursive: true });
    await writeFile(
      path.join(portfolioDir, "catalog.json"),
      JSON.stringify({ updatedAt: "2026-09-01T00:00:00.000Z", items: [samplePortfolioItem("bathroom_001")] }),
      "utf8",
    );
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { total: number; items: Array<{ id: string }> };
      assert.equal(body.total, 1);
      assert.equal(body.items[0]?.id, "bathroom_001");
    } finally {
      await server.close();
      await rm(portfolioDir, { force: true, recursive: true });
    }
  });
});

describe("GET /api/portfolio/featured resilience", () => {
  it("returns 200 with an empty items list when both featured.json and catalog.json are missing", async () => {
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio/featured`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: unknown[] };
      assert.deepEqual(body.items, []);
    } finally {
      await server.close();
    }
  });

  it("returns 200 and falls back to the catalog's own items when only featured.json is missing", async () => {
    const portfolioDir = path.join(uploadDirectory, "portfolio");
    await mkdir(portfolioDir, { recursive: true });
    await writeFile(
      path.join(portfolioDir, "catalog.json"),
      JSON.stringify({ updatedAt: "2026-09-01T00:00:00.000Z", items: [samplePortfolioItem("bathroom_002")] }),
      "utf8",
    );
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio/featured`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ id: string }> };
      assert.equal(body.items[0]?.id, "bathroom_002");
    } finally {
      await server.close();
      await rm(portfolioDir, { force: true, recursive: true });
    }
  });

  it("still serves a normal featured.json fixture correctly (no regression)", async () => {
    const portfolioDir = path.join(uploadDirectory, "portfolio");
    await mkdir(portfolioDir, { recursive: true });
    await writeFile(
      path.join(portfolioDir, "featured.json"),
      JSON.stringify({ updatedAt: "2026-09-01T00:00:00.000Z", items: [{ id: "featured_001", rank: 1 }] }),
      "utf8",
    );
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio/featured`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ id: string }> };
      assert.equal(body.items[0]?.id, "featured_001");
    } finally {
      await server.close();
      await rm(portfolioDir, { force: true, recursive: true });
    }
  });
});

describe("PATCH /api/admin/portfolio/:id/visibility resilience", () => {
  it("creates the portfolio/ directory on demand instead of failing when it doesn't exist yet", async () => {
    const portfolioDir = path.join(uploadDirectory, "portfolio");
    await mkdir(portfolioDir, { recursive: true });
    await writeFile(
      path.join(portfolioDir, "catalog.json"),
      JSON.stringify({ updatedAt: "2026-09-01T00:00:00.000Z", items: [samplePortfolioItem("bathroom_003")] }),
      "utf8",
    );
    // Simulates a fresh environment where visibility.json (and potentially
    // its parent directory) has never been written yet.
    const server = await startPortfolioRoute();
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const response = await fetch(`${server.url}/api/admin/portfolio/bathroom_003/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ visible: false }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { id: string; visible: boolean };
      assert.deepEqual(body, { id: "bathroom_003", visible: false });
    } finally {
      await server.close();
      await rm(portfolioDir, { force: true, recursive: true });
    }
  });
});
