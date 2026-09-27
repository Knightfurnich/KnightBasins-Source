import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type DatabaseHealthFixture = {
  status: "healthy" | "degraded";
  latencyMs: number;
  database: "postgres";
  timestamp: string;
  tablesCount: number;
};

const healthyResponse: DatabaseHealthFixture = {
  status: "healthy",
  latencyMs: 12,
  database: "postgres",
  timestamp: "2026-09-27T04:30:00.000Z",
  tablesCount: 18,
};

const degradedResponse: DatabaseHealthFixture = {
  ...healthyResponse,
  latencyMs: 850,
};

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const componentPath = join(appRoot, "src/admin/AdminDashboard.tsx");
const componentUrl = pathToFileURL(componentPath).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const componentSource = readFileSync(componentPath, "utf8");

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mod = await import(${JSON.stringify(componentUrl)});
const healthyResponse = ${JSON.stringify(healthyResponse)};
const degradedResponse = ${JSON.stringify(degradedResponse)};

function renderWidget(response) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["/api/admin/database/health"], response);
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(mod.DashboardDatabaseHealthWidget),
    ),
  );
}

process.stdout.write(JSON.stringify({
  healthyHtml: renderWidget(healthyResponse),
  degradedHtml: renderWidget(degradedResponse),
}));
`;

type HarnessResult = {
  healthyHtml: string;
  degradedHtml: string;
};

let harness: HarnessResult;
let tempDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected the workspace tsx loader at ${tsxLoaderPath}`);
  }
  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tempDir = mkdtempSync(join(appRoot, "node_modules", ".admin-database-health-test-"));
  const tsconfigPath = join(tempDir, "tsconfig.override.json");
  const harnessPath = join(tempDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");
  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: appRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("admin dashboard database health widget", () => {
  it("loads the health endpoint with credentials and polls for current status", () => {
    assert.match(componentSource, /queryKey:\s*databaseHealthQueryKey/);
    assert.match(
      componentSource,
      /customFetch<AdminDatabaseHealth>\("\/api\/admin\/database\/health",\s*\{\s*method:\s*"GET",\s*credentials:\s*"include",\s*responseType:\s*"json"/,
    );
    assert.match(componentSource, /refetchInterval:\s*30_000/);
    assert.match(componentSource, /const databaseHealthQueryKey = \["\/api\/admin\/database\/health"\]/);
  });

  it("renders the healthy status, latency, database table count, latest check, and refresh button", () => {
    assert.ok(harness.healthyHtml.includes('data-testid="widget-database-health"'));
    assert.ok(harness.healthyHtml.includes("พร้อมใช้งาน (Healthy)"));
    assert.ok(harness.healthyHtml.includes('data-testid="db-latency-value">12 ms</p>'));
    assert.ok(harness.healthyHtml.includes('data-testid="db-tables-count">18 ตาราง</p>'));
    assert.ok(harness.healthyHtml.includes("PostgreSQL"));
    assert.ok(harness.healthyHtml.includes('data-testid="db-last-checked"'));
    assert.ok(harness.healthyHtml.includes('data-testid="button-refresh-db-health"'));
  });

  it("marks a high-latency database connection as degraded", () => {
    assert.ok(harness.degradedHtml.includes("ตอบสนองช้า (Degraded)"));
    assert.ok(harness.degradedHtml.includes('data-testid="db-latency-value">850 ms</p>'));
  });

  it("connects the refresh button to React Query and preserves the storage widget", () => {
    assert.match(componentSource, /onClick=\{\(\) => void refetch\(\)\}[\s\S]*?data-testid="button-refresh-db-health"/);
    assert.ok(componentSource.includes('data-testid="widget-storage-health"'));
    assert.ok(componentSource.includes("DashboardStorageHealthWidget canNavigate={canNavigate}"));
  });
});