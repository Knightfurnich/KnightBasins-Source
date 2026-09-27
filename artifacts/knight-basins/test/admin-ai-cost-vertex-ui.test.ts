import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const costPageUrl = pathToFileURL(join(appRoot, "src/admin/AiCostCenterPage.tsx")).href;
const dashboardUrl = pathToFileURL(join(appRoot, "src/admin/AdminDashboard.tsx")).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const costResponse = {
  period: "30d",
  updatedAt: "2026-09-26T03:00:00.000Z",
  totalCostThb: 1650,
  totalRequests: 5,
  totalTokens: 40000,
  services: [
    {
      id: "sales_bot",
      name: "น้องไนท์ (LINE Bot)",
      requests: 2,
      tokens: 22000,
      costThb: 845.75,
      status: "active",
    },
    {
      id: "sketch_vision",
      name: "วิเคราะห์แบบร่าง",
      requests: 1,
      tokens: 9000,
      costThb: 501.25,
      status: "active",
    },
    {
      id: "hermes_ops",
      name: "เฮอร์มีส",
      requests: 1,
      tokens: 4000,
      costThb: 185.5,
      status: "no-data",
    },
    {
      id: "vertex_gemini",
      name: "Vertex AI (Gemini 2.5 Flash)",
      requests: 1,
      tokens: 5000,
      costThb: 117.5,
      status: "active",
    },
  ],
  modelBreakdown: [
    { model: "gemini-2.5-flash", requests: 1, costThb: 117.5 },
  ],
};

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const costPage = await import(${JSON.stringify(costPageUrl)});
const dashboard = await import(${JSON.stringify(dashboardUrl)});
const data = ${JSON.stringify(costResponse)};
const service = data.services.find((item) => item.id === "vertex_gemini");
const serviceNameMarkup = renderToStaticMarkup(
  createElement(costPage.AiCostServiceName, { service }),
);
const dashboardBadgeMarkup = renderToStaticMarkup(
  createElement(dashboard.DashboardAiCostBadges, { services: data.services }),
);
const lineSummary = costPage.buildAiCostSummaryMessage(data, "30d");
process.stdout.write(JSON.stringify({ serviceNameMarkup, dashboardBadgeMarkup, lineSummary }));
`;

type HarnessResult = {
  serviceNameMarkup: string;
  dashboardBadgeMarkup: string;
  lineSummary: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }

  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(appRoot, "node_modules", ".admin-ai-cost-vertex-ui-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
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
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("Vertex AI cost UI", () => {
  it("renders the Vertex service name with its dedicated icon locator", () => {
    assert.match(harness.serviceNameMarkup, /data-testid="ai-cost-service-vertex-gemini"/);
    assert.match(harness.serviceNameMarkup, /data-testid="icon-ai-cost-vertex-gemini"/);
    assert.match(harness.serviceNameMarkup, /Vertex AI \(Gemini 2\.5 Flash\)/);
  });

  it("renders the Vertex AI dashboard badge with its service label, model, and active state", () => {
    assert.match(harness.dashboardBadgeMarkup, /data-testid="dashboard-ai-cost-service-vertex_gemini"/);
    assert.match(harness.dashboardBadgeMarkup, /Vertex AI/);
    assert.match(harness.dashboardBadgeMarkup, /Gemini 2\.5 Flash/);
    assert.match(harness.dashboardBadgeMarkup, /dashboard-ai-badge--active/);
    assert.match(harness.dashboardBadgeMarkup, />Active</);
  });

  it("includes Vertex AI in the LINE service summary", () => {
    const lines = harness.lineSummary.split("\n");
    assert.ok(lines.includes("แยกตามบริการ:"));
    assert.ok(lines.some((line) => line.startsWith("• Vertex AI (Gemini 2.5 Flash):")));
    assert.ok(lines.includes("แยกตามโมเดล:"));
    assert.ok(lines.some((line) => line.startsWith("• gemini-2.5-flash:")));
  });
});