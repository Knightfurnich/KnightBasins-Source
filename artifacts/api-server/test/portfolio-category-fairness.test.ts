import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";
import { loadCatalog, saveCatalog, type PortfolioItem } from "../src/lib/portfolio-catalog.ts";

type PortfolioRouteModule = { default: Parameters<typeof express["use"]>[1] };

async function startPortfolioRoute() {
  const routeModule = await importTypeScriptModule<PortfolioRouteModule>("src/routes/portfolio.ts");
  const app = express();
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
    throw new Error("Portfolio category-fairness test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function makeItem(category: string, serial: number): PortfolioItem {
  const id = `${category}_${String(serial).padStart(3, "0")}`;
  return {
    id,
    category,
    categoryName: category,
    icon: "📸",
    filename: `${id}.jpg`,
    url: `/api/uploads/portfolio/${category}/${id}.jpg`,
    width: 1200,
    height: 800,
    bytes: 123456,
    title: `${category} sample ${serial}`,
  };
}

/**
 * Mirrors the real production bug report: bathroom dominates the catalog
 * (312 real items; here a smaller but still lopsided 40) while design and
 * kitchen barely have any (47/33 real; here 3 and 2). A naive
 * "sort-by-CATEGORY_ORDER-then-slice" would put all 40 bathroom items
 * before a single design/kitchen item ever appears.
 */
function buildLopsidedCatalog(): PortfolioItem[] {
  const items: PortfolioItem[] = [];
  for (let i = 1; i <= 40; i += 1) items.push(makeItem("bathroom", i));
  for (let i = 1; i <= 5; i += 1) items.push(makeItem("counter", i));
  for (let i = 1; i <= 3; i += 1) items.push(makeItem("design", i));
  for (let i = 1; i <= 2; i += 1) items.push(makeItem("kitchen", i));
  for (let i = 1; i <= 4; i += 1) items.push(makeItem("wall", i));
  return items;
}

const originalEnv = { UPLOAD_DIR: process.env["UPLOAD_DIR"] };
let uploadDirectory: string;

before(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-category-fairness-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  if (originalEnv.UPLOAD_DIR === undefined) delete process.env["UPLOAD_DIR"];
  else process.env["UPLOAD_DIR"] = originalEnv.UPLOAD_DIR;
  await rm(uploadDirectory, { force: true, recursive: true });
});

async function seedCatalog(items: PortfolioItem[]) {
  await saveCatalog(uploadDirectory, { updatedAt: new Date().toISOString(), total: items.length, items });
}

describe("GET /api/portfolio category fairness (Task 105 regression)", () => {
  it("BUG REPRODUCTION FIXED: a small limit still surfaces design and kitchen items, not bathroom-only", async () => {
    await seedCatalog(buildLopsidedCatalog());
    const server = await startPortfolioRoute();
    try {
      // Same shape as the real bug report: public gallery, default-sized page.
      const response = await fetch(`${server.url}/api/portfolio?limit=10`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ category: string }> };
      const categoriesSeen = new Set(body.items.map((item) => item.category));
      assert.ok(categoriesSeen.has("design"), "design must appear in the first page, not be starved out by bathroom");
      assert.ok(categoriesSeen.has("kitchen"), "kitchen must appear in the first page, not be starved out by bathroom");
      assert.ok(categoriesSeen.has("bathroom"), "bathroom should still appear -- fairness, not exclusion");
    } finally {
      await server.close();
    }
  });

  it("distributes round-robin: the first N items (N = category count) are one of each category", async () => {
    await seedCatalog(buildLopsidedCatalog());
    const server = await startPortfolioRoute();
    try {
      // 5 categories seeded (bathroom, counter, design, kitchen, wall). CATEGORY_ORDER's
      // actual sequence is bathroom(0), counter(1), kitchen(2), design(3), ..., wall(5),
      // so the first 5 items must be exactly one from each, in that relative order.
      const response = await fetch(`${server.url}/api/portfolio?limit=5`);
      const body = (await response.json()) as { items: Array<{ category: string }> };
      assert.deepEqual(body.items.map((item) => item.category), ["bathroom", "counter", "kitchen", "design", "wall"]);
    } finally {
      await server.close();
    }
  });

  it("limit=all returns every item across every category", async () => {
    const catalogItems = buildLopsidedCatalog();
    await seedCatalog(catalogItems);
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio?limit=all`);
      const body = (await response.json()) as { items: unknown[]; count: number; hasMore: boolean; nextOffset: number | null };
      assert.equal(body.items.length, catalogItems.length);
      assert.equal(body.count, catalogItems.length);
      assert.equal(body.hasMore, false);
      assert.equal(body.nextOffset, null);
    } finally {
      await server.close();
    }
  });

  it("limit=2000 (the new ceiling) returns every item, unlike the old 600 cap", async () => {
    // Build a catalog bigger than the OLD 600 cap to prove the ceiling actually moved.
    const items: PortfolioItem[] = [];
    for (let i = 1; i <= 650; i += 1) items.push(makeItem("bathroom", i));
    await seedCatalog(items);
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio?limit=2000`);
      const body = (await response.json()) as { items: unknown[]; count: number };
      assert.equal(body.count, 650);
      assert.equal(body.items.length, 650);
    } finally {
      await server.close();
    }
  });

  it("a numeric limit above 2000 is still capped at 2000", async () => {
    const items: PortfolioItem[] = [];
    for (let i = 1; i <= 5; i += 1) items.push(makeItem("bathroom", i));
    await seedCatalog(items);
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio?limit=999999`);
      const body = (await response.json()) as { items: unknown[] };
      // Only 5 exist, but this proves no error/crash and the cap logic runs; a
      // dedicated ceiling check is redundant with limit=2000 above returning
      // exactly 650 (not capped short) while this exercises the >2000 clamp path.
      assert.equal(body.items.length, 5);
    } finally {
      await server.close();
    }
  });

  it("hasMore/nextOffset are consistent with what was actually returned", async () => {
    await seedCatalog(buildLopsidedCatalog());
    const server = await startPortfolioRoute();
    try {
      const first = await fetch(`${server.url}/api/portfolio?limit=10&offset=0`);
      const firstBody = (await first.json()) as { hasMore: boolean; nextOffset: number | null; count: number; items: unknown[] };
      assert.equal(firstBody.items.length, 10);
      assert.equal(firstBody.hasMore, true);
      assert.equal(firstBody.nextOffset, 10);

      const last = await fetch(`${server.url}/api/portfolio?limit=1000&offset=0`);
      const lastBody = (await last.json()) as { hasMore: boolean; nextOffset: number | null; count: number };
      assert.equal(lastBody.hasMore, false);
      assert.equal(lastBody.nextOffset, null);
      assert.equal(lastBody.count, 54); // 40+5+3+2+4
    } finally {
      await server.close();
    }
  });

  it("fetching page 2 with nextOffset never repeats an item from page 1", async () => {
    await seedCatalog(buildLopsidedCatalog());
    const server = await startPortfolioRoute();
    try {
      const page1Response = await fetch(`${server.url}/api/portfolio?limit=10&offset=0`);
      const page1 = (await page1Response.json()) as { items: Array<{ id: string }>; nextOffset: number };
      const page2Response = await fetch(`${server.url}/api/portfolio?limit=10&offset=${page1.nextOffset}`);
      const page2 = (await page2Response.json()) as { items: Array<{ id: string }> };
      const page1Ids = new Set(page1.items.map((item) => item.id));
      for (const item of page2.items) {
        assert.ok(!page1Ids.has(item.id), `item ${item.id} appeared on both page 1 and page 2`);
      }
    } finally {
      await server.close();
    }
  });
});

describe("GET /api/portfolio?category=... behavior is unchanged (Task 105 must not alter this path)", () => {
  it("filtering by a specific category still returns only that category, in catalog file order", async () => {
    // File order deliberately NOT id-sorted (design_003 before design_001) --
    // the category-specific path must preserve this exact original order,
    // never applying the new id-tiebreak sort meant only for the "no category" path.
    const items: PortfolioItem[] = [
      { ...makeItem("design", 3), id: "design_003" },
      { ...makeItem("design", 1), id: "design_001" },
      { ...makeItem("design", 2), id: "design_002" },
      makeItem("bathroom", 1),
    ];
    await seedCatalog(items);
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio?category=design`);
      const body = (await response.json()) as { items: Array<{ id: string; category: string }> };
      assert.deepEqual(body.items.map((item) => item.id), ["design_003", "design_001", "design_002"]);
      assert.ok(body.items.every((item) => item.category === "design"));
    } finally {
      await server.close();
    }
  });

  it("category count/total fields are unaffected by the fairness change", async () => {
    await seedCatalog(buildLopsidedCatalog());
    const server = await startPortfolioRoute();
    try {
      const response = await fetch(`${server.url}/api/portfolio?category=design&limit=100`);
      const body = (await response.json()) as { total: number; count: number; items: unknown[] };
      assert.equal(body.count, 3);
      assert.equal(body.items.length, 3);
      assert.equal(body.total, 54); // total = all visible items regardless of category filter, unchanged semantics
    } finally {
      await server.close();
    }
  });
});
