import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const stockComponentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/StockInventoryPage.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const FIXTURE_ITEMS = [
  { no: 3, name: "CC 030 (Cedar)", qty: 0, scrap: "Small", lots: ["Lot C"], note: "Zulu" },
  { no: 1, name: "AA 010 (Aspen)", qty: 12, scrap: "Large", lots: ["Lot A"], note: "Alpha" },
  { no: 2, name: "BB 020 (Birch)", qty: 5, scrap: "Medium", lots: ["Lot B"], note: "Beta" },
];

const HARNESS_SCRIPT = `
const stock = await import(${JSON.stringify(stockComponentUrl)});
const items = ${JSON.stringify(FIXTURE_ITEMS)};
const result = {
  noAsc: stock.sortStockItems(items, "no", "asc").map((item) => item.no),
  noDesc: stock.sortStockItems(items, "no", "desc").map((item) => item.no),
  nameAsc: stock.sortStockItems(items, "name", "asc").map((item) => item.no),
  nameDesc: stock.sortStockItems(items, "name", "desc").map((item) => item.no),
  qtyAsc: stock.sortStockItems(items, "qty", "asc").map((item) => item.no),
  qtyDesc: stock.sortStockItems(items, "qty", "desc").map((item) => item.no),
  scrapAsc: stock.sortStockItems(items, "scrap", "asc").map((item) => item.no),
  lotsAsc: stock.sortStockItems(items, "lots", "asc").map((item) => item.no),
  noteAsc: stock.sortStockItems(items, "note", "asc").map((item) => item.no),
  totalSheets: stock.totalStockSheets(items),
  inStockMessage: stock.buildStockLineMessage("Staron", items[1]),
  outOfStockMessage: stock.buildStockLineMessage("Zen Stone", items[0]),
  quantityTones: [0, 1, 9, 10].map(stock.getStockQuantityTone),
};
process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  noAsc: number[];
  noDesc: number[];
  nameAsc: number[];
  nameDesc: number[];
  qtyAsc: number[];
  qtyDesc: number[];
  scrapAsc: number[];
  lotsAsc: number[];
  noteAsc: number[];
  totalSheets: number;
  inStockMessage: string;
  outOfStockMessage: string;
  quantityTones: string[];
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(
      `Expected tsx's loader at ${tsxLoaderPath} (a devDependency of the scripts workspace) -- run "pnpm install" at the repo root.`,
    );
  }

  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".stock-sorting-copy-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("stock table sorting", () => {
  it("sorts the No. column numerically in both directions", () => {
    assert.deepEqual(harness.noAsc, [1, 2, 3]);
    assert.deepEqual(harness.noDesc, [3, 2, 1]);
  });

  it("sorts color names alphabetically in both directions", () => {
    assert.deepEqual(harness.nameAsc, [1, 2, 3]);
    assert.deepEqual(harness.nameDesc, [3, 2, 1]);
  });

  it("sorts quantities numerically in both directions", () => {
    assert.deepEqual(harness.qtyAsc, [3, 2, 1]);
    assert.deepEqual(harness.qtyDesc, [1, 2, 3]);
  });

  it("sorts scrap, lot, and note text alphabetically", () => {
    assert.deepEqual(harness.scrapAsc, [1, 2, 3]);
    assert.deepEqual(harness.lotsAsc, [1, 2, 3]);
    assert.deepEqual(harness.noteAsc, [1, 2, 3]);
  });

  it("does not mutate the source array while sorting", () => {
    assert.deepEqual(FIXTURE_ITEMS.map((item) => item.no), [3, 1, 2]);
  });
});

describe("stock KPI, LINE copy text, and quantity tones", () => {
  it("totals the sheet quantities for the active stock list", () => {
    assert.equal(harness.totalSheets, 17);
  });

  it("builds the available-stock message with the brand and sheet quantity", () => {
    assert.equal(
      harness.inStockMessage,
      "หิน Staron รหัส AA 010 (Aspen) สต็อกโรงงานพร้อมส่ง 12 แผ่นค่ะ",
    );
  });

  it("builds a distinct out-of-stock message", () => {
    assert.equal(
      harness.outOfStockMessage,
      "หิน Zen Stone รหัส CC 030 (Cedar) ปัจจุบันหมดสต็อกค่ะ",
    );
  });

  it("uses green for ten or more, orange for one to nine, and muted red for zero", () => {
    assert.deepEqual(harness.quantityTones, ["empty", "caution", "caution", "good"]);
  });

  it("renders accessible sort states and a per-row LINE copy button", () => {
    const pageSource = readFileSync(join(knightBasinsRoot, "src/admin/StockInventoryPage.tsx"), "utf8");
    assert.match(pageSource, /aria-sort=\{ariaSort\("no"\)\}/);
    assert.match(pageSource, /aria-sort=\{ariaSort\("qty"\)\}/);
    assert.match(pageSource, /data-testid=\{`button-copy-stock-\$\{item\.no\}`\}/);
    assert.match(pageSource, /คัดลอกข้อความ LINE/);
  });
});

const browserBaseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const screenshotPath = process.env["STOCK_TABLE_SCREENSHOT_PATH"];
const BROWSER_STOCK_RESPONSE = {
  updatedAt: "2026-09-25T06:30:00.000Z",
  staron: {
    title: "Staron",
    total: 3,
    inStockCount: 2,
    items: [
      { no: 1, name: "AA 625 (Aspen Alder)", qty: 9, scrap: "", lots: [], note: "" },
      { no: 2, name: "AP 100 (Aspen Pearl)", qty: 16, scrap: "เศษ 1 ชิ้น", lots: ["ST-101"], note: "ตัวอย่าง" },
      { no: 3, name: "AB 001 (Alpine White)", qty: 0, scrap: "", lots: [], note: "" },
    ],
  },
  zen: {
    title: "Zen Stone",
    total: 1,
    inStockCount: 1,
    items: [
      { no: 1, name: "AP 100 (Apex)", qty: 12, scrap: "", lots: ["ZN-204"], note: "" },
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

async function waitForBrowserValue<T>(read: () => Promise<T>, predicate: (value: T) => boolean, message: string): Promise<T> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

describe("stock table browser behavior", () => {
  let browser: ChildProcess | undefined;
  let browserProfile: string | undefined;
  let page: CdpPage | undefined;
  let mockError: Error | undefined;

  before(async () => {
    if (!existsSync(chromiumPath)) return;
    const port = await reserveChromiumPort();
    browserProfile = mkdtempSync(join(os.tmpdir(), "knight-stock-sorting-chrome-"));
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
    await page.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.__stockClipboardText = text; } } });`,
    });
    await page.command("Fetch.enable", {
      patterns: [
        { urlPattern: "*://*/api/admin/session*" },
        { urlPattern: "*://*/api/admin/stock*" },
      ],
    });
    page.on("Fetch.requestPaused", (params) => {
      const requestId = params["requestId"];
      const url = String((params["request"] as { url?: string } | undefined)?.url ?? "");
      if (typeof requestId !== "string") return;
      const pathname = new URL(url).pathname;
      const body = pathname.startsWith("/api/admin/session")
        ? { authenticated: true }
        : pathname.startsWith("/api/admin/stock")
          ? BROWSER_STOCK_RESPONSE
          : null;
      if (!body) {
        void page?.command("Fetch.continueRequest", { requestId }).catch((error: unknown) => {
          mockError = error instanceof Error ? error : new Error("Could not continue browser request");
        });
        return;
      }
      void page?.command("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      }).catch((error: unknown) => {
        mockError = error instanceof Error ? error : new Error("Could not mock the stock API");
      });
    });
    await page.command("Page.navigate", { url: new URL("/admin/stock", browserBaseUrl).toString() });
    await waitForBrowserValue(
      () => page!.evaluate<string>("document.body?.innerText ?? ''"),
      (text) => text.includes("AA 625") && text.includes("แผ่น"),
      "The mocked stock page did not finish loading",
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
    "sorts and copies stock in Chromium with a mocked stock API",
    { skip: !existsSync(chromiumPath) && "Chromium is required for the stock table browser test" },
    async () => {
      assert.ok(page, "Chromium page is not ready");
      assert.ifError(mockError);
      const rowOrder = () => page!.evaluate<number[]>(
        `([...document.querySelectorAll('[data-testid^="stock-row-staron-"]')].map((row) => Number(row.getAttribute("data-testid")?.split("-").at(-1))))`,
      );
      assert.deepEqual(await rowOrder(), [1, 2, 3]);
      assert.equal(
        await page.evaluate<string>("document.querySelector('[data-testid=\"stock-kpi-total-sheets-value\"]')?.textContent?.trim() ?? ''"),
        "25",
      );
      const tones = await page.evaluate<string[]>(
        `[...document.querySelectorAll('[data-testid^="stock-row-staron-"] [data-stock-tone]')].map((badge) => badge.getAttribute("data-stock-tone") ?? "")`,
      );
      assert.deepEqual(tones, ["caution", "good", "empty"]);

      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-name"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "1,3,2", "Name ascending order did not appear"), [1, 3, 2]);
      assert.equal(
        await page.evaluate<boolean>(`document.querySelector('th[aria-sort="ascending"] [data-testid="button-sort-stock-name"]') !== null`),
        true,
      );
      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-name"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "2,3,1", "Name descending order did not appear"), [2, 3, 1]);

      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-qty"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "2,1,3", "Quantity descending order did not appear"), [2, 1, 3]);
      assert.equal(
        await page.evaluate<boolean>(`document.querySelector('th[aria-sort="descending"] [data-testid="button-sort-stock-qty"]') !== null`),
        true,
      );
      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-qty"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "3,1,2", "Quantity ascending order did not appear"), [3, 1, 2]);

      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-no"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "1,2,3", "No. ascending order did not appear"), [1, 2, 3]);
      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-no"]')?.click(); return true; })()`);
      assert.deepEqual(await waitForBrowserValue(rowOrder, (rows) => rows.join(",") === "3,2,1", "No. descending order did not appear"), [3, 2, 1]);

      await page.evaluate<boolean>(`(() => { document.querySelector('[data-testid="button-sort-stock-qty"]')?.click(); document.querySelector('[data-testid="button-copy-stock-2"]')?.click(); return true; })()`);
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.querySelector('[data-testid=\"button-copy-stock-2\"]')?.textContent ?? ''"),
        (text) => text.includes("คัดลอกแล้ว"),
        "Copy feedback did not appear",
      );
      assert.equal(
        await page.evaluate<string>("window.__stockClipboardText ?? ''"),
        "หิน Staron รหัส AP 100 (Aspen Pearl) สต็อกโรงงานพร้อมส่ง 16 แผ่นค่ะ",
      );
      assert.ifError(mockError);

      if (screenshotPath) {
        const screenshot = await page.command("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: true,
        });
        const data = screenshot["data"];
        assert.equal(typeof data, "string", "Chromium did not return screenshot data");
        mkdirSync(dirname(screenshotPath), { recursive: true });
        writeFileSync(screenshotPath, Buffer.from(data, "base64"));
      }
    },
  );
});