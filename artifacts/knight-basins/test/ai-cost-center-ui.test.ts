import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const pageSource = readFileSync(join(knightBasinsRoot, "src/admin/AiCostCenterPage.tsx"), "utf8");
const adminSource = readFileSync(join(knightBasinsRoot, "src/admin/AdminApp.tsx"), "utf8");
const appSource = readFileSync(join(knightBasinsRoot, "src/App.tsx"), "utf8");
const browserBaseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const screenshotPath =
  process.env["AI_COST_CENTER_SCREENSHOT_PATH"] ??
  join(knightBasinsRoot, "evidence/ai-cost-center-ui.png");

const BROWSER_COST_RESPONSE = {
  period: "30d",
  updatedAt: "2026-09-26T03:00:00.000Z",
  totalCostThb: 1532.5,
  totalRequests: 4,
  totalTokens: 35000,
  services: [
    {
      id: "sales_bot",
      name: "น้องไนท์ (LINE Bot ผู้ช่วยขาย)",
      requests: 2,
      tokens: 22000,
      costThb: 845.75,
      status: "active",
    },
    {
      id: "sketch_vision",
      name: "AI Blueprint Reader (อ่านแบบร่าง)",
      requests: 1,
      tokens: 9000,
      costThb: 501.25,
      status: "active",
    },
    {
      id: "hermes_ops",
      name: "เฮอร์มีส (งานบริหารระบบ & งานช่าง)",
      requests: 1,
      tokens: 4000,
      costThb: 185.5,
      status: "no-data",
    },
  ],
  modelBreakdown: [
    { model: "claude-3-haiku", requests: 3, costThb: 1000.25 },
    { model: "gpt-4.1-mini", requests: 1, costThb: 532.25 },
  ],
  apiKey: "sk-fixture-secret-must-not-render",
  providerToken: "provider-fixture-token-must-not-render",
  customerEmail: "private-fixture@example.test",
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

describe("AI cost center UI contract", () => {
  it("declares the required page, period, KPI, table, and refresh test IDs", () => {
    for (const id of [
      "ai-cost-page",
      "table-ai-cost-services",
      "table-ai-cost-models",
      "button-ai-cost-refresh",
    ]) {
      assert.ok(pageSource.includes(`data-testid="${id}"`), `Missing data-testid ${id}`);
    }
    for (const id of [
      "card-ai-cost-total",
      "card-ai-cost-requests",
      "card-ai-cost-tokens",
      "card-ai-cost-average",
    ]) {
      assert.ok(pageSource.includes(`testId="${id}"`), `Missing KPI testId ${id}`);
    }
    assert.match(pageSource, /data-testid=\{`tab-ai-cost-period-\$\{item\.value\}`\}/);
    assert.deepEqual(
      [...pageSource.matchAll(/\{ value: "(today|7d|30d|all)", label:/g)].map((match) => match[1]),
      ["today", "7d", "30d", "all"],
    );
  });

  it("loads the selected period with the documented same-origin API and formats THB", () => {
    assert.match(pageSource, /customFetch<AiCostCenterResponse>\([\s\S]*?\/api\/admin\/ai-cost-center\?period=\$\{encodeURIComponent\(period\)\}/);
    assert.match(pageSource, /credentials: "include"/);
    assert.match(pageSource, /currency: "THB",\s+minimumFractionDigits: 2,\s+maximumFractionDigits: 2/);
    assert.match(pageSource, /\(data\.totalCostThb \* 100\) \/ data\.totalRequests/);
    assert.match(pageSource, /decimalFormatter\.format\(averageSatang\)/);
  });

  it("registers the admin route and enforces the existing leads permission", () => {
    assert.match(appSource, /<Route path="\/admin\/ai-cost" component=\{AdminApp\} \/>/);
    assert.match(adminSource, /\{ href: "\/admin\/ai-cost", label: "ต้นทุน AI", exact: false, permission: "leads" \}/);
    assert.match(adminSource, /<Route path="\/admin\/ai-cost" component=\{AiCostCenterRoute\} \/>/);
    assert.match(adminSource, /<AdminPermissionGate permission="leads" resource="ต้นทุน AI">/);
    assert.match(adminSource, /ไม่มีสิทธิ์เข้าถึงเมนูนี้/);
  });
});

describe("AI cost center browser behavior", () => {
  let browser: ChildProcess | undefined;
  let browserProfile: string | undefined;
  let page: CdpPage | undefined;
  let mockError: Error | undefined;
  let failAllPeriod = true;
  const requestedPeriods: string[] = [];

  before(async () => {
    if (!existsSync(chromiumPath)) return;
    const port = await reserveChromiumPort();
    browserProfile = mkdtempSync(join(os.tmpdir(), "knight-ai-cost-center-chrome-"));
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
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.command("Fetch.enable", {
      patterns: [
        { urlPattern: "*://*/api/admin/session*" },
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
        body = { authenticated: true };
      } else if (parsedUrl.pathname === "/api/admin/ai-cost-center") {
        const period = parsedUrl.searchParams.get("period") ?? "";
        requestedPeriods.push(period);
        if (period === "all" && failAllPeriod) {
          responseCode = 503;
          body = { message: "fixture unavailable" };
        } else {
          body = { ...BROWSER_COST_RESPONSE, period };
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
        mockError = error instanceof Error ? error : new Error("Could not mock the AI cost API");
      });
    });

    await page.command("Page.navigate", { url: new URL("/admin/ai-cost", browserBaseUrl).toString() });
    await waitForBrowserValue(
      () => page!.evaluate<string>("document.body?.innerText ?? ''"),
      (text) => text.includes("AI Blueprint Reader") && text.includes("฿1,532.50"),
      "The mocked AI cost center did not finish loading",
    );
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
    "renders approved aggregate data, changes periods, retries errors, and refreshes in Chromium",
    { skip: !existsSync(chromiumPath) && "Chromium is required for the AI cost center browser test" },
    async () => {
      assert.ok(page, "Chromium page is not ready");
      assert.ifError(mockError);
      const renderedIds = await page.evaluate<string[]>(
        `Array.from(document.querySelectorAll("[data-testid]")).map((element) => element.getAttribute("data-testid") ?? "")`,
      );
      for (const id of [
        "ai-cost-page",
        "tab-ai-cost-period-today",
        "tab-ai-cost-period-7d",
        "tab-ai-cost-period-30d",
        "tab-ai-cost-period-all",
        "card-ai-cost-total",
        "card-ai-cost-requests",
        "card-ai-cost-tokens",
        "card-ai-cost-average",
        "table-ai-cost-services",
        "table-ai-cost-models",
        "button-ai-cost-refresh",
      ]) {
        assert.ok(renderedIds.includes(id), `Browser did not render ${id}`);
      }

      const initialText = await page.evaluate<string>("document.body?.innerText ?? ''");
      assert.ok(initialText.includes("38,312.50"), "Average cost should display satang to two decimal places");
      assert.ok(!initialText.includes("sk-fixture-secret-must-not-render"));
      assert.ok(!initialText.includes("provider-fixture-token-must-not-render"));
      assert.ok(!initialText.includes("private-fixture@example.test"));
      await waitForBrowserValue(
        () => page!.evaluate<string>("getComputedStyle(document.querySelector('.ai-cost-page')).opacity"),
        (opacity) => opacity === "1",
        "The page entrance animation did not finish",
      );

      const screenshot = await page.command("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      });
      const screenshotData = screenshot["data"];
      assert.equal(typeof screenshotData, "string", "Chromium did not return screenshot data");
      mkdirSync(dirname(screenshotPath), { recursive: true });
      writeFileSync(screenshotPath, Buffer.from(screenshotData, "base64"));

      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="tab-ai-cost-period-7d"]')?.click(); return true; })()`,
      );
      await waitForBrowserValue(
        async () => requestedPeriods.includes("7d"),
        Boolean,
        "The AI cost endpoint was not called with period=7d",
      );
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.replace(/\s+/g, " ").includes("ช่วงข้อมูล: 7 วัน"),
        "The selected period label did not update",
      );

      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="tab-ai-cost-period-all"]')?.click(); return true; })()`,
      );
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.includes("ยังโหลดสรุปต้นทุนไม่ได้"),
        "The API failure state did not appear",
      );
      assert.ok(requestedPeriods.filter((period) => period === "all").length >= 2, "The failed request should use the configured retry");

      failAllPeriod = false;
      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="button-ai-cost-retry"]')?.click(); return true; })()`,
      );
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.includes("claude-3-haiku"),
        "Retry did not recover the AI cost data",
      );

      const allRequestsBeforeRefresh = requestedPeriods.filter((period) => period === "all").length;
      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="button-ai-cost-refresh"]')?.click(); return true; })()`,
      );
      await waitForBrowserValue(
        async () => requestedPeriods.filter((period) => period === "all").length,
        (count) => count > allRequestsBeforeRefresh,
        "The refresh button did not request updated AI cost data",
      );
      assert.ifError(mockError);
    },
  );
});