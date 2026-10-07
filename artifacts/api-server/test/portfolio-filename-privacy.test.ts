import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { importTypeScriptModule } from "./route-harness.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import {
  applyPortfolioFilenameAnonymization,
  findPersonalPortfolioFilenames,
  looksPersonalPortfolioFilename,
  planPortfolioFilenameAnonymization,
  saveCatalog,
  type PortfolioCatalog,
  type PortfolioItem,
} from "../src/lib/portfolio-catalog.ts";

type RouteModule = { default: Parameters<typeof express["use"]>[1] };

/** The shape the live import produced: LINE album folder names with the customer's own words in them. */
const PERSONAL = "bathroom_new_043_LINE_ALBUM_บ้านคุณน้อยครับ_250.webp";
const PROJECT_NAME = "design_040_LINE_ALBUM_วรรณศิริห้องน้ำชายช.webp";
const CLEAN = "bathroom_1789abc_5f4d3c.webp";

function item(id: string, filename: string, category = "bathroom"): PortfolioItem {
  return {
    id, category, categoryName: "งานห้องน้ำ", icon: "🛁", filename,
    url: `/api/uploads/portfolio/${category}/${filename}`, width: 1200, height: 800, bytes: 1000, title: "งานจริง",
  };
}

function catalogOf(items: PortfolioItem[]): PortfolioCatalog {
  return { updatedAt: new Date().toISOString(), total: items.length, items };
}

describe("portfolio filename privacy helpers", () => {
  it("flags only the legacy LINE-import names", () => {
    assert.equal(looksPersonalPortfolioFilename(PERSONAL), true);
    assert.equal(looksPersonalPortfolioFilename(PROJECT_NAME), true);
    assert.equal(looksPersonalPortfolioFilename(CLEAN), false);
    const flagged = findPersonalPortfolioFilenames([item("bathroom_9", CLEAN), item("bathroom_1", PERSONAL), item("design_4", PROJECT_NAME)]);
    assert.deepEqual(flagged.map((entry) => entry.id), ["bathroom_1", "design_4"]);
  });

  it("plans a rename that keeps the id, the category folder and the extension", () => {
    const plan = planPortfolioFilenameAnonymization([item("bathroom_1", PERSONAL)], () => 1_700_000_000_000);
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.id, "bathroom_1");
    assert.equal(plan[0]?.from, PERSONAL);
    assert.match(plan[0]!.to, /^bathroom_[a-z0-9]+_[a-f0-9]{12}\.webp$/);
    assert.equal(looksPersonalPortfolioFilename(plan[0]!.to), false, "the new name must not carry customer words either");
    assert.equal(planPortfolioFilenameAnonymization([item("bathroom_9", CLEAN)]).length, 0);
  });
});

describe("applyPortfolioFilenameAnonymization + the admin route", () => {
  let uploadDir = "";
  let routeUrl = "";
  let closeServer: (() => Promise<void>) | undefined;
  const authCookie = () => `knight_admin_session=${createAdminToken()}`;

  async function startServer() {
    const mod = await importTypeScriptModule<RouteModule>("src/routes/portfolio.ts");
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", mod.default);
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ message: error instanceof Error ? error.message : "server error" });
    });
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no address");
    return {
      url: `http://127.0.0.1:${address.port}`,
      close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
    };
  }

  before(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-privacy-"));
    await mkdir(path.join(uploadDir, "portfolio", "bathroom"), { recursive: true });
    await writeFile(path.join(uploadDir, "portfolio", "bathroom", PERSONAL), "fake-image");
    process.env["UPLOAD_DIR"] = uploadDir;
    process.env["SESSION_SECRET"] = process.env["SESSION_SECRET"] ?? "portfolio-filename-privacy-test-secret";
    const server = await startServer();
    routeUrl = server.url;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer?.();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("renames on disk, rewrites catalog.json, and never touches the id", async () => {
    const catalog = catalogOf([item("bathroom_1", PERSONAL), item("bathroom_2", CLEAN)]);
    await saveCatalog(uploadDir, catalog);
    const plan = planPortfolioFilenameAnonymization(catalog.items);
    const result = await applyPortfolioFilenameAnonymization(uploadDir, catalog, plan);

    assert.deepEqual(result.renamed, ["bathroom_1"]);
    assert.deepEqual(result.missing, []);
    const next = await readFile(path.join(uploadDir, "portfolio", "bathroom", PERSONAL), "utf8").then(() => "still-there").catch(() => "gone");
    assert.equal(next, "gone", "the file with the customer name must no longer exist");
    const stored: PortfolioCatalog = JSON.parse(await readFile(path.join(uploadDir, "portfolio", "catalog.json"), "utf8"));
    const moved = stored.items.find((entry) => entry.id === "bathroom_1")!;
    assert.equal(moved.filename.includes("LINE_ALBUM"), false);
    assert.equal(moved.url, `/api/uploads/portfolio/bathroom/${moved.filename}`);
    assert.equal(stored.items.find((entry) => entry.id === "bathroom_2")!.filename, CLEAN, "clean rows stay untouched");
    assert.equal(looksPersonalPortfolioFilename(moved.filename), false);
  });

  it("aborts before publishing a catalog when a source file cannot be moved", async () => {
    const catalog = catalogOf([item("bathroom_7", "bathroom_new_999_LINE_ALBUM_คุณทดสอบ.webp")]);
    await saveCatalog(uploadDir, catalog);
    const plan = planPortfolioFilenameAnonymization(catalog.items);
    const result = await applyPortfolioFilenameAnonymization(uploadDir, catalog, plan);
    assert.deepEqual(result.renamed, []);
    assert.deepEqual(result.missing, ["bathroom_7"], "a file that is not on disk is reported, not fatal");
    const stored: PortfolioCatalog = JSON.parse(await readFile(path.join(uploadDir, "portfolio", "catalog.json"), "utf8"));
    assert.equal(stored.items[0]!.filename, plan[0]!.from, "no half-applied catalog is written when nothing moved");
  });

  it("the admin route inspects for free and refuses to rename without the count it just reported", async () => {
    // the previous case already moved this file, so the disk starts over here — the route renames what is really there
    await writeFile(path.join(uploadDir, "portfolio", "bathroom", PERSONAL), "fake-image");
    const catalog = catalogOf([item("bathroom_1", PERSONAL)]);
    await saveCatalog(uploadDir, catalog);

    const inspect = await fetch(`${routeUrl}/api/admin/portfolio/filename-privacy`, {
      method: "POST", headers: { cookie: authCookie(), "content-type": "application/json" }, body: JSON.stringify({ action: "inspect" }),
    });
    assert.equal(inspect.status, 200);
    const inspected = await inspect.json() as { flaggedCount: number; flagged: Array<{ id: string; filename: string }> };
    assert.equal(inspected.flaggedCount, 1);
    assert.equal(inspected.flagged[0]!.filename, PERSONAL, "the operator has to see what is being changed");

    const refused = await fetch(`${routeUrl}/api/admin/portfolio/filename-privacy`, {
      method: "POST", headers: { cookie: authCookie(), "content-type": "application/json" }, body: JSON.stringify({ action: "anonymize", confirmCount: 99 }),
    });
    assert.equal(refused.status, 409);

    const applied = await fetch(`${routeUrl}/api/admin/portfolio/filename-privacy`, {
      method: "POST", headers: { cookie: authCookie(), "content-type": "application/json" }, body: JSON.stringify({ action: "anonymize", confirmCount: 1 }),
    });
    assert.equal(applied.status, 200);
    const outcome = await applied.json() as { renamed: string[]; note: string };
    assert.deepEqual(outcome.renamed, ["bathroom_1"]);
    assert.match(outcome.note, /featured/i, "the response must say what to regenerate afterwards");

    const again = await fetch(`${routeUrl}/api/admin/portfolio/filename-privacy`, {
      method: "POST", headers: { cookie: authCookie(), "content-type": "application/json" }, body: JSON.stringify({ action: "inspect" }),
    });
    assert.equal((await again.json() as { flaggedCount: number }).flaggedCount, 0);
  });

  it("requires an admin session", async () => {
    const denied = await fetch(`${routeUrl}/api/admin/portfolio/filename-privacy`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "anonymize", confirmCount: 0 }),
    });
    assert.equal(denied.status, 401);
  });
});
