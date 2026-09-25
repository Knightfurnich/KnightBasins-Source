import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const adminPassword = process.env["ADMIN_PASSWORD"];
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const screenshotsDirectory = path.resolve(
  process.env["STOCK_INVENTORY_SCREENSHOT_DIR"] ?? path.join(os.tmpdir(), "knight-stock-screenshots"),
);

const stockResponse = {
  updatedAt: "2026-09-25T06:30:00.000Z",
  staron: {
    title: "Staron",
    total: 63,
    inStockCount: 41,
    items: [
      { no: 1, name: "AA 625 (Aspen Alder)", qty: 16, scrap: "", lots: [], note: "" },
      { no: 2, name: "AP 100 (Aspen Pearl)", qty: 9, scrap: "เศษ 1 ชิ้น", lots: ["ST-101"], note: "ตัวอย่าง" },
      { no: 3, name: "AB 001 (Alpine White)", qty: 0, scrap: "", lots: [], note: "" },
    ],
  },
  zen: {
    title: "Zen Stone",
    total: 47,
    inStockCount: 29,
    items: [
      { no: 1, name: "AP 100 (Apex)", qty: 12, scrap: "", lots: ["ZN-204"], note: "" },
      { no: 2, name: "CS 201 (Cloud Stone)", qty: 7, scrap: "เศษ 2 ชิ้น", lots: [], note: "ตัวอย่าง" },
      { no: 3, name: "BK 001 (Black)", qty: 0, scrap: "", lots: [], note: "" },
    ],
  },
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
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params ?? {});
        }
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

let browser: ChildProcess | undefined;
let browserProfile = "";
let page: CdpPage | undefined;
let mockError: Error | undefined;

async function freePort() {
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

async function waitFor<T>(read: () => Promise<T>, predicate: (value: T) => boolean, message: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function captureScreenshot(filename: string) {
  assert.ok(page, "Chromium page is not ready");
  const result = await page.command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
  });
  const data = result["data"];
  assert.equal(typeof data, "string", "Chromium did not return screenshot data");
  await writeFile(path.join(screenshotsDirectory, filename), Buffer.from(data, "base64"));
}

before(async () => {
  if (!adminPassword) return;
  const port = await freePort();
  browserProfile = await mkdtemp(path.join(os.tmpdir(), "knight-stock-chrome-"));
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

  const pageTarget = await waitFor(
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
    patterns: [{ urlPattern: "*://*/api/admin/stock*" }],
  });
  page.on("Fetch.requestPaused", (params) => {
    const requestId = params["requestId"];
    const url = String((params["request"] as { url?: string } | undefined)?.url ?? "");
    if (typeof requestId !== "string" || !url.includes("/api/admin/stock")) return;
    void page?.command("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
      body: Buffer.from(JSON.stringify(stockResponse)).toString("base64"),
    }).catch((error: unknown) => {
      mockError = error instanceof Error ? error : new Error("Could not mock the stock API");
    });
  });

  const loginResponse = await fetch(new URL("/api/admin/session", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert.ok(loginResponse.ok, `Admin test login failed with HTTP ${loginResponse.status}`);
  const cookie = loginResponse.headers.get("set-cookie")?.match(/knight_admin_session=([^;]+)/)?.[1];
  assert.ok(cookie, "Admin session response did not set its session cookie");
  const cookieResult = await page.command("Network.setCookie", {
    name: "knight_admin_session",
    value: cookie,
    url: baseUrl,
    httpOnly: true,
  });
  assert.notEqual(cookieResult["success"], false, "Could not set the admin session cookie");

  await mkdir(screenshotsDirectory, { recursive: true });
  await page.command("Page.navigate", { url: new URL("/admin/stock", baseUrl).toString() });
  await waitFor(
    () => page!.evaluate<string>("document.body?.innerText ?? ''"),
    (text) => text.includes("AA 625") || text.includes("โหลดสต็อกไม่สำเร็จ"),
    "The stock page did not finish loading",
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
  if (browserProfile) {
    await rm(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

it(
  "loads the contract-shaped stock response and captures Staron and filtered Zen Stone views",
  { skip: !adminPassword && "ADMIN_PASSWORD is required for the admin browser test" },
  async () => {
    assert.ok(page, "Chromium page is not ready");
    assert.ifError(mockError);

    const staronText = await page.evaluate<string>("document.body?.innerText ?? ''");
    assert.match(staronText, /AA 625 \(Aspen Alder\)/);
    assert.match(staronText, /63/);
    await captureScreenshot("admin-stock-staron.png");

    const searchInputUpdated = await page.evaluate<boolean>(`
      (() => {
        document.querySelector('[data-testid="tab-stock-zen"]')?.click();
        const input = document.querySelector('[data-testid="input-stock-search"]');
        if (!(input instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, 'Apex');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        return true;
      })()
    `);
    assert.equal(searchInputUpdated, true, "Could not set the stock search input");

    await new Promise((resolve) => setTimeout(resolve, 100));
    const zenText = await waitFor(
      () => page!.evaluate<string>("document.body?.innerText ?? ''"),
      (text) => text.includes("Zen Stone") && text.includes("AP 100 (Apex)") && text.includes("แสดง 1 รายการ"),
      "The Zen Stone search result did not appear",
    );
    assert.match(zenText, /AP 100 \(Apex\)/);
    assert.doesNotMatch(zenText, /Cloud Stone/);
    assert.ifError(mockError);
    await captureScreenshot("admin-stock-zen-search.png");
  },
);