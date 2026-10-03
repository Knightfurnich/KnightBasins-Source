import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { importTypeScriptModule } from "./route-harness.ts";
import { getUnifiedAiCostSummary, resolveHermesAuditLogPath } from "../src/lib/ai-cost-tracker.ts";

// job-205: the two remaining code paths that default to a file on the VPS
// (/opt/data/...) must take an env override, and must keep the VPS path when
// the env is not set. Nothing here reads the VPS paths themselves: the
// defaults are checked as strings through the resolvers, the overrides through
// real files inside a throwaway temp directory.
const VPS_HERMES_AUDIT_LOG = "/opt/data/cron/usage_audit.jsonl";
const VPS_PORTFOLIO_FEATURED_KB = "/opt/data/knight-design-kb/portfolio_featured.json";

type PortfolioRouteModule = {
  default: Parameters<(typeof express)["use"]>[1];
  resolveKnightDesignKbFeaturedPath: (env?: NodeJS.ProcessEnv) => string;
};

const ENV_KEYS = ["HERMES_AUDIT_LOG_PATH", "PORTFOLIO_FEATURED_KB_PATH", "UPLOAD_DIR", "DATABASE_URL", "SESSION_SECRET", "ADMIN_PASSWORD"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
let tempDirectory: string;
let portfolioRoute: PortfolioRouteModule;

before(async () => {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), "host-path-env-override-"));
  process.env["UPLOAD_DIR"] = path.join(tempDirectory, "uploads");
  process.env["DATABASE_URL"] = "postgres://host-path-env-override-test";
  process.env["SESSION_SECRET"] = "host-path-env-override-test-secret";
  process.env["ADMIN_PASSWORD"] = "host-path-env-override-test-password";

  const featuredKbFile = path.join(tempDirectory, "featured-kb.json");
  await writeFile(
    featuredKbFile,
    JSON.stringify({ updatedAt: "2026-10-03T00:00:00.000Z", items: [{ id: "from-env-override", url: "https://example.com/a.jpg", rank: 1 }] }),
    "utf8",
  );
  process.env["PORTFOLIO_FEATURED_KB_PATH"] = featuredKbFile;
  // portfolio.ts reads PORTFOLIO_FEATURED_KB_PATH once, when it is loaded.
  portfolioRoute = await importTypeScriptModule<PortfolioRouteModule>("src/routes/portfolio.ts");
});

after(async () => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(tempDirectory, { force: true, recursive: true });
});

describe("HERMES_AUDIT_LOG_PATH (ai-cost-tracker)", () => {
  it("keeps the VPS audit log path when the env is not set, or is empty", () => {
    assert.equal(resolveHermesAuditLogPath({}), VPS_HERMES_AUDIT_LOG);
    assert.equal(resolveHermesAuditLogPath({ HERMES_AUDIT_LOG_PATH: "" }), VPS_HERMES_AUDIT_LOG);
  });

  it("uses the env path when it is set", () => {
    assert.equal(resolveHermesAuditLogPath({ HERMES_AUDIT_LOG_PATH: "/somewhere/else.jsonl" }), "/somewhere/else.jsonl");
  });

  it("reads Hermes usage from the env path, skipping malformed lines", async () => {
    const auditFile = path.join(tempDirectory, "usage_audit.jsonl");
    await writeFile(
      auditFile,
      [
        JSON.stringify({ model: "hermes-agent", promptTokens: 1200, completionTokens: 300, success: true, timestamp: "2026-10-03T01:00:00.000Z" }),
        "this line is not json",
        "",
      ].join("\n"),
      "utf8",
    );
    process.env["HERMES_AUDIT_LOG_PATH"] = auditFile;
    const hermes = getUnifiedAiCostSummary("all").services.find((service) => service.id === "hermes_ops")!;
    assert.equal(hermes.requests, 1);
    assert.equal(hermes.tokens, 1500);
  });

  it("reports no Hermes usage, without throwing, when the env path does not exist", () => {
    process.env["HERMES_AUDIT_LOG_PATH"] = path.join(tempDirectory, "never-created-usage-audit.jsonl");
    const hermes = getUnifiedAiCostSummary("all").services.find((service) => service.id === "hermes_ops")!;
    assert.equal(hermes.requests, 0);
  });
});

describe("PORTFOLIO_FEATURED_KB_PATH (routes/portfolio)", () => {
  it("keeps the VPS knowledge-base path when the env is not set", () => {
    assert.equal(portfolioRoute.resolveKnightDesignKbFeaturedPath({}), VPS_PORTFOLIO_FEATURED_KB);
  });

  it("uses the env path when it is set, and keeps an empty value as an empty path", () => {
    assert.equal(portfolioRoute.resolveKnightDesignKbFeaturedPath({ PORTFOLIO_FEATURED_KB_PATH: "/somewhere/else.json" }), "/somewhere/else.json");
    assert.equal(portfolioRoute.resolveKnightDesignKbFeaturedPath({ PORTFOLIO_FEATURED_KB_PATH: "" }), "");
  });

  it("GET /api/portfolio/featured serves the knowledge-base file found at the env path", async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", portfolioRoute.default);
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string", "test server did not expose a TCP address");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/portfolio/featured`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ id: string }> };
      assert.deepEqual(body.items.map((item) => item.id), ["from-env-override"]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
