import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const dashboardSource = readFileSync(join(appRoot, "src/admin/AdminDashboard.tsx"), "utf8");
const dashboardCss = readFileSync(join(appRoot, "src/index.css"), "utf8");
const browserBaseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const screenshotPath =
  process.env["ADMIN_DASHBOARD_AI_COST_SCREENSHOT_PATH"] ??
  join(appRoot, "evidence/admin-dashboard-ai-cost.png");

const COST_RESPONSE = {
  period: "30d",
  updatedAt: "2026-09-26T03:00:00.000Z",
  totalCostThb: 1532.5,
  totalRequests: 4,
  totalTokens: 35000,
  services: [
    { id: "sales_bot", name: "น้องไนท์ (LINE Bot ผู้ช่วยขาย)", requests: 2, tokens: 22000, costThb: 845.75, status: "active" },
    { id: "sketch_vision", name: "AI Blueprint Reader (อ่านแบบร่าง)", requests: 1, tokens: 9000, costThb: 501.25, status: "active" },
    { id: "hermes_ops", name: "เฮอร์มีส (งานบริหารระบบ & งานช่าง)", requests: 1, tokens: 4000, costThb: 185.5, status: "no-data" },
  ],
  modelBreakdown: [],
};

const DASHBOARD_RESPONSE = {
  period: "30d",
  kpis: { totalRevenueThb: 0, totalLeads: 0, readyForProduction: 0, closed: 0 },
  actionItems: { unassignedSlipsCount: 0, awaitingContactCount: 0 },
  pipelineRatio: { usCount: 0, ofCount: 0, otherCount: 0 },
  upcomingInstallations: [],
  popularItems: [],
  popularStones: [],
  popularBasins: [],
  recentActivities: [],
  monthlyComparison: [],
  projectedCashInflowThb: 0,
  technicianCapacity: [],
  asOf: "2026-09-26T03:00:00.000Z",
};

type CdpMessage = {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message?: string };
  method?: string;
  params?: Record<string, unknown>;
};

class CdpPage {
  private readonly socket: WebSocket;
  private nextCommandId = 0;
  private readonly pending = new Map<number, {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
  }>();
  private readonly listeners = new Map<string, Array<(params: Record<string, unknown>) => void>>();

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const command = this.pending.get(message.id);
        if (!command) return;
        this.pending.delete(message.id);
        if (message.error) command.reject(new Error(message.error.message ?? "CDP command failed"));
        else command.resolve(message.result ?? {});
        return;
      }
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
      }
    });
  }

  static async connect(webSocketUrl: string) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium")), { once: true });
    });
    return new CdpPage(socket);
  }

  on(method: string, listener: (params: Record<string, unknown>) => void) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  command(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.nextCommandId;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const response = await this.command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response["exceptionDetails"]) {
      throw new Error(`Browser evaluation failed: ${JSON.stringify(response["exceptionDetails"])}`);
    }
    return (response["result"] as { value?: T } | undefined)?.value as T;
  }

  close() {
    this.socket.close();
  }
}

async function reserveChromiumPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a Chromium debugging port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForBrowserValue<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  message: string,
): Promise<T> {
  const deadline = Date.now() + 20_000;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    const value = await read();
    lastValue = value;
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}; last observed value: ${JSON.stringify(lastValue).slice(0, 600)}`);
}

describe("admin dashboard AI cost widget", () => {
  it("declares the summary panel, API contract, service badges, and deep link", () => {
    for (const id of [
      "panel-dashboard-ai-cost",
      "link-dashboard-ai-cost",
      "dashboard-ai-cost-total",
      "dashboard-ai-cost-requests",
      "dashboard-ai-cost-error",
    ]) {
      assert.ok(dashboardSource.includes(`data-testid="${id}"`), `Missing data-testid ${id}`);
    }
    assert.match(dashboardSource, /customFetch<AiCostCenterSummary>\("\/api\/admin\/ai-cost-center\?period=30d"/);
    assert.match(dashboardSource, /href="\/admin\/ai-cost"/);
    for (const service of ["sales_bot", "sketch_vision", "hermes_ops"]) {
      assert.ok(dashboardSource.includes(`dashboard-ai-cost-service-${service}`) || dashboardSource.includes("dashboard-ai-cost-service-${item.id}"));
    }
    assert.match(dashboardCss, /\.dashboard-ai-cost-card\s*\{/);
    assert.match(dashboardCss, /\.dashboard-ai-badges\s*\{/);
    assert.match(dashboardCss, /@media \(max-width: 720px\)[\s\S]*?\.dashboard-ai-badges/);
  });
});

describe("admin dashboard AI cost browser behavior", () => {
  let browser: ChildProcess | undefined;
  let browserProfile: string | undefined;
  let page: CdpPage | undefined;
  let mockError: Error | undefined;
  let failAiCost = true;
  const requestedPeriods: string[] = [];

  before(async () => {
    if (!existsSync(chromiumPath)) return;
    const port = await reserveChromiumPort();
    browserProfile = mkdtempSync(join(os.tmpdir(), "knight-admin-dashboard-ai-cost-chrome-"));
    browser = spawn(
      chromiumPath,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${browserProfile}`,
        "about:blank",
      ],
      { stdio: "ignore", detached: true },
    );

    const pageTarget = await waitForBrowserValue(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
        if (!response?.ok) return null;
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
        return targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? null;
      },
      (target) => Boolean(target),
      "Chromium did not start",
    );
    page = await CdpPage.connect(pageTarget);
    await page.command("Page.enable");
    await page.command("Runtime.enable");
    await page.command("Network.enable");
    await page.command("Page.setDeviceMetricsOverride", {
      width: 1440,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.command("Fetch.enable", {
      patterns: [
        { urlPattern: "*://*/api/admin/session*" },
        { urlPattern: "*://*/api/admin/dashboard-stats*" },
        { urlPattern: "*://*/api/admin/ai-cost-center*" },
      ],
    });
    page.on("Fetch.requestPaused", (params) => {
      const requestId = params["requestId"];
      const url = String((params["request"] as { url?: string } | undefined)?.url ?? "");
      if (typeof requestId !== "string") return;
      const parsedUrl = new URL(url);
      let body: unknown;
      let responseCode = 200;
      if (parsedUrl.pathname.startsWith("/api/admin/session")) {
        body = {
          authenticated: true,
          access: { role: "owner", permissions: ["leads"], canEdit: true, canDelete: true, canManageTeam: true },
        };
      } else if (parsedUrl.pathname === "/api/admin/dashboard-stats") {
        body = DASHBOARD_RESPONSE;
      } else if (parsedUrl.pathname === "/api/admin/ai-cost-center") {
        requestedPeriods.push(parsedUrl.searchParams.get("period") ?? "");
        if (failAiCost) {
          responseCode = 503;
          body = { message: "fixture unavailable" };
        } else {
          body = COST_RESPONSE;
        }
      }
      if (body === undefined) {
        void page?.command("Fetch.continueRequest", { requestId }).catch((error: unknown) => {
          mockError = error instanceof Error ? error : new Error("Could not continue browser request");
        });
        return;
      }
      void page?.command("Fetch.fulfillRequest", {
        requestId,
        responseCode,
        responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      }).catch((error: unknown) => {
        mockError = error instanceof Error ? error : new Error("Could not mock dashboard data");
      });
    });

    await page.command("Page.navigate", { url: new URL("/admin", browserBaseUrl).toString() });
  });

  after(async () => {
    page?.close();
    if (browser?.pid && browser.exitCode === null) {
      try {
        process.kill(-browser.pid, "SIGTERM");
      } catch {
        browser.kill("SIGTERM");
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 3_000);
        browser?.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (browserProfile) rmSync(browserProfile, { recursive: true, force: true, maxRetries: 5 });
  });

  it(
    "keeps the dashboard usable on API failure and renders the 30-day summary and link",
    { skip: !existsSync(chromiumPath) && "Chromium is required for the dashboard browser test" },
    async () => {
      assert.ok(page, "Chromium page is not ready");
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.includes("ภาพรวมธุรกิจ") && text.includes("สรุปต้นทุน AI ยังโหลดไม่สำเร็จ"),
        "Dashboard or isolated AI cost error state did not render",
      );
      assert.ok(
        await page.evaluate<boolean>('Boolean(document.querySelector(\'[data-testid="admin-dashboard"]\'))'),
        "The main dashboard should remain rendered when the AI cost API fails",
      );
      assert.ok(
        await page.evaluate<boolean>('Boolean(document.querySelector(\'[data-testid="panel-dashboard-ai-cost"]\'))'),
        "The AI cost panel should remain present when its request fails",
      );
      assert.ok(requestedPeriods.length >= 2, "The AI cost query should retry once after the mocked failure");
      assert.ok(requestedPeriods.every((period) => period === "30d"), "The summary request should use period=30d");

      failAiCost = false;
      await page.command("Page.reload", { ignoreCache: true });
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) =>
          text.includes("ต้นทุน & ปริมาณงาน AI รวม (30 วัน)") &&
          text.includes("฿1,532.50") &&
          text.includes("4 คำขอ") &&
          text.includes("2 บริการ Active"),
        "The successful 30-day AI cost summary did not render",
      );

      const renderedIds = await page.evaluate<string[]>(
        `Array.from(document.querySelectorAll("[data-testid]")).map((element) => element.getAttribute("data-testid") ?? "")`,
      );
      for (const id of [
        "panel-dashboard-ai-cost",
        "dashboard-ai-cost-total",
        "dashboard-ai-cost-requests",
        "dashboard-ai-cost-service-sales_bot",
        "dashboard-ai-cost-service-sketch_vision",
        "dashboard-ai-cost-service-hermes_ops",
        "link-dashboard-ai-cost",
      ]) {
        assert.ok(renderedIds.includes(id), `Browser did not render ${id}`);
      }
      assert.equal(
        await page.evaluate<string>('document.querySelector(\'[data-testid="link-dashboard-ai-cost"]\')?.getAttribute("href") ?? ""'),
        "/admin/ai-cost",
        "The shortcut should link directly to the AI cost page",
      );
      assert.ifError(mockError);

      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="panel-dashboard-ai-cost"]')?.scrollIntoView({ block: "center" }); return true; })()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      const screenshot = await page.command("Page.captureScreenshot", { format: "png", fromSurface: true });
      const screenshotData = screenshot["data"];
      assert.equal(typeof screenshotData, "string", "Chromium did not return screenshot data");
      mkdirSync(dirname(screenshotPath), { recursive: true });
      writeFileSync(screenshotPath, Buffer.from(screenshotData, "base64"));
    },
  );
});