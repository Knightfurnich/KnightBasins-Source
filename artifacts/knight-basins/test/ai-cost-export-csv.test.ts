import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const pageSource = readFileSync(join(appRoot, "src/admin/AiCostCenterPage.tsx"), "utf8");
const cssSource = readFileSync(join(appRoot, "src/index.css"), "utf8");
const browserBaseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const screenshotPath =
  process.env["AI_COST_EXPORT_CSV_SCREENSHOT_PATH"] ??
  join(appRoot, "evidence/ai-cost-export-csv.png");

const COST_RESPONSE = {
  period: "30d",
  updatedAt: "2026-09-26T03:00:00.000Z",
  totalCostThb: 1532.5,
  totalRequests: 4,
  totalTokens: 35000,
  services: [
    {
      id: "sales_bot",
      name: 'น้องไนท์, LINE Bot "ผู้ช่วยขาย"',
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
      name: "เฮอร์มีส (งานระบบ & งานช่าง)",
      requests: 1,
      tokens: 4000,
      costThb: 185.5,
      status: "no-data",
    },
  ],
  modelBreakdown: [
    { model: 'claude-3-haiku, "fast" region', requests: 3, costThb: 1000.25 },
    { model: "gpt-4.1-mini", requests: 1, costThb: 532.25 },
  ],
  apiKey: "fixture-api-key-must-not-export",
  providerToken: "fixture-provider-token-must-not-export",
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

function parseCsv(input: string): string[][] {
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" && text[index + 1] === "\n") {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) records.push(row);
      row = [];
      field = "";
      index += 1;
    } else if (character === "\n") {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) records.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) records.push(row);
  }
  return records;
}

describe("AI cost CSV export contract", () => {
  it("declares a BOM-prefixed RFC 4180 exporter and the adjacent export button", () => {
    assert.ok(pageSource.includes("export function exportAiCostToCsv"), "The CSV builder should be exported for reuse");
    assert.ok(pageSource.includes('return "\\uFEFF"'), "The CSV builder should prepend a UTF-8 BOM");
    assert.ok(pageSource.includes('join("\\r\\n")'), "CSV records should use RFC 4180 CRLF separators");
    assert.ok(pageSource.includes('data-testid="button-ai-cost-export-csv"'), "The export button should have its required test id");
    assert.ok(pageSource.includes("data.services.map"), "The export should include each AI service");
    assert.ok(pageSource.includes("data.modelBreakdown.map"), "The export should include each AI model");
    assert.match(cssSource, /\.ai-cost-toolbar__actions\s*\{/);
    assert.match(cssSource, /@media \(max-width: 720px\)[\s\S]*?\.ai-cost-toolbar__actions/);
  });
});

describe("AI cost CSV browser behavior", () => {
  let browser: ChildProcess | undefined;
  let browserProfile: string | undefined;
  let downloadDirectory: string | undefined;
  let page: CdpPage | undefined;
  let mockError: Error | undefined;
  const requestedPeriods: string[] = [];

  before(async () => {
    if (!existsSync(chromiumPath)) return;
    const port = await reserveChromiumPort();
    browserProfile = mkdtempSync(join(os.tmpdir(), "knight-ai-cost-csv-chrome-"));
    downloadDirectory = mkdtempSync(join(os.tmpdir(), "knight-ai-cost-csv-download-"));
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
    await page.command("Fetch.enable", {
      patterns: [
        { urlPattern: "*://*/api/admin/session*" },
        { urlPattern: "*://*/api/admin/ai-cost-center*" },
      ],
    });
    await page.command("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDirectory,
    });
    await page.command("Page.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    page.on("Fetch.requestPaused", (params) => {
      const requestId = params["requestId"];
      const url = String((params["request"] as { url?: string } | undefined)?.url ?? "");
      if (typeof requestId !== "string") return;
      const parsedUrl = new URL(url);
      let body: unknown;
      if (parsedUrl.pathname.startsWith("/api/admin/session")) {
        body = {
          authenticated: true,
          access: { role: "owner", permissions: ["leads"], canEdit: true, canDelete: true, canManageTeam: true },
        };
      } else if (parsedUrl.pathname === "/api/admin/ai-cost-center") {
        const period = parsedUrl.searchParams.get("period") ?? "";
        requestedPeriods.push(period);
        body = { ...COST_RESPONSE, period };
      }
      if (body === undefined) {
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
        mockError = error instanceof Error ? error : new Error("Could not mock the AI cost response");
      });
    });

    await page.command("Page.navigate", { url: new URL("/admin/ai-cost", browserBaseUrl).toString() });
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
    if (downloadDirectory) rmSync(downloadDirectory, { recursive: true, force: true, maxRetries: 5 });
  });

  it(
    "downloads the selected-period report with Thai services, models, BOM, and no secrets",
    { skip: !existsSync(chromiumPath) && "Chromium is required for the AI cost CSV browser test" },
    async () => {
      assert.ok(page, "Chromium page is not ready");
      assert.ok(downloadDirectory, "Download directory is not ready");
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.includes("AI Blueprint Reader") && text.includes("฿1,532.50"),
        "The mocked AI cost page did not finish loading",
      );
      assert.ifError(mockError);
      assert.ok(
        await page.evaluate<boolean>('Boolean(document.querySelector(\'[data-testid="button-ai-cost-export-csv"]\'))'),
        "The CSV export button should render",
      );
      assert.equal(
        await page.evaluate<boolean>('document.querySelector(\'[data-testid="button-ai-cost-export-csv"]\')?.disabled ?? true'),
        false,
        "The CSV export button should be enabled when summary data is available",
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
        "Selecting 7 days did not request period=7d",
      );
      await waitForBrowserValue(
        () => page!.evaluate<string>("document.body?.innerText ?? ''"),
        (text) => text.replace(/\s+/g, " ").includes("ช่วงข้อมูล: 7 วัน"),
        "The selected-period label did not update",
      );

      await page.evaluate<boolean>(
        `(() => { document.querySelector('[data-testid="button-ai-cost-export-csv"]')?.click(); return true; })()`,
      );
      const downloadedFile = await waitForBrowserValue(
        async () =>
          readdirSync(downloadDirectory!).find((name) => name.endsWith(".csv") && !name.endsWith(".crdownload")) ?? null,
        (name): name is string => typeof name === "string",
        "Chromium did not finish downloading the CSV",
      );
      const fileBytes = readFileSync(join(downloadDirectory, downloadedFile));
      assert.deepEqual([...fileBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "Downloaded CSV should begin with a UTF-8 BOM");
      const csvText = fileBytes.toString("utf8");
      assert.ok(csvText.startsWith("\uFEFF"), "Decoded CSV should retain the BOM");
      assert.ok(csvText.includes("\r\n"), "CSV rows should use RFC 4180 CRLF line endings");
      assert.match(downloadedFile, /^knight-basins-ai-cost-7d-\d{4}-\d{2}-\d{2}\.csv$/);
      assert.ifError(mockError);

      const rows = parseCsv(csvText);
      const report = new Map(rows.slice(0, 6).map(([label, value]) => [label, value]));
      assert.equal(report.get("รายงาน"), "สรุปต้นทุน AI - Knight Basins");
      assert.equal(report.get("ช่วงเวลา"), "7 วัน");
      assert.equal(report.get("ยอดเงินรวม (บาท)"), "1532.5");
      assert.equal(report.get("จำนวนคำขอรวม"), "4");
      assert.equal(report.get("โทเคนรวม"), "35000");
      const reportDate = report.get("วันที่สร้างรายงาน");
      assert.match(reportDate ?? "", /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(downloadedFile.includes(reportDate ?? ""), "Filename date should match the report date");

      const serviceHeaderIndex = rows.findIndex((row) => row[0] === "รหัสบริการ");
      assert.ok(serviceHeaderIndex >= 0, "CSV should contain a service section");
      assert.deepEqual(rows[serviceHeaderIndex], [
        "รหัสบริการ",
        "ชื่อบริการ",
        "จำนวนคำขอ",
        "จำนวนโทเคน",
        "ต้นทุน (บาท)",
        "สถานะ",
      ]);
      const modelHeaderIndex = rows.findIndex((row) => row[0] === "ชื่อโมเดล");
      assert.ok(modelHeaderIndex > serviceHeaderIndex, "CSV should contain a model section after services");
      const serviceRows = rows.slice(serviceHeaderIndex + 1, modelHeaderIndex);
      const serviceById = new Map(serviceRows.map((row) => [row[0], row]));
      assert.equal(serviceById.get("sales_bot")?.[1], 'น้องไนท์, LINE Bot "ผู้ช่วยขาย"');
      assert.deepEqual(serviceById.get("sales_bot")?.slice(2), ["2", "22000", "845.75", "ทำงานอยู่"]);
      assert.deepEqual(serviceById.get("sketch_vision")?.slice(2), ["1", "9000", "501.25", "ทำงานอยู่"]);
      assert.deepEqual(serviceById.get("hermes_ops")?.slice(2), ["1", "4000", "185.5", "ไม่มีข้อมูล"]);
      const modelRows = rows.slice(modelHeaderIndex + 1);
      const modelByName = new Map(modelRows.map((row) => [row[0], row]));
      assert.deepEqual(modelByName.get('claude-3-haiku, "fast" region'), ["claude-3-haiku, \"fast\" region", "3", "1000.25"]);
      assert.deepEqual(modelByName.get("gpt-4.1-mini"), ["gpt-4.1-mini", "1", "532.25"]);
      assert.ok(!csvText.includes("fixture-api-key-must-not-export"));
      assert.ok(!csvText.includes("fixture-provider-token-must-not-export"));
      assert.ok(!csvText.includes("private-fixture@example.test"));
    },
  );
});