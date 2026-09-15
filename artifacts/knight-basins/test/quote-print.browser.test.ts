import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";

class CdpPage {
  private readonly socket: WebSocket;
  private nextCommandId = 0;
  private readonly pending = new Map<number, {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
  }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (message.id === undefined) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chrome DevTools command failed"));
      else request.resolve(message.result ?? {});
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

  command(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.nextCommandId;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string) {
    const result = await this.command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const exceptionDetails = result["exceptionDetails"];
    if (exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(exceptionDetails)}`);
    return (result["result"] as { value?: T } | undefined)?.value as T;
  }

  close() {
    this.socket.close();
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a browser debugging port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function launchBrowser() {
  const debuggingPort = await freePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-quote-print-"));
  const process = spawn(chromiumPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore" });

  const deadline = Date.now() + 15_000;
  let webSocketUrl = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
      webSocketUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? "";
      if (webSocketUrl) break;
    } catch {
      // Chromium is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!webSocketUrl) {
    process.kill("SIGTERM");
    await rm(profileDirectory, { force: true, recursive: true });
    throw new Error("Chromium did not expose a debugging page");
  }
  return { page: await CdpPage.connect(webSocketUrl), process, profileDirectory };
}

async function stopBrowser(browser: {
  page: CdpPage;
  process: ChildProcess;
  profileDirectory: string;
}) {
  browser.page.close();
  if (browser.process.exitCode === null && browser.process.signalCode === null) {
    browser.process.kill("SIGTERM");
    await new Promise<void>((resolve) => browser.process.once("exit", () => resolve()));
  }
  await rm(browser.profileDirectory, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 });
}

async function waitFor<T>(read: () => Promise<T>, predicate: (value: T) => boolean, label: string) {
  const deadline = Date.now() + 15_000;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastValue)}`);
}

async function clickTestId(page: CdpPage, testId: string) {
  const clicked = await page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click ${testId}`);
}

async function setTextInput(page: CdpPage, testId: string, value: string) {
  const changed = await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not set ${testId}`);
}

describe("long formal quote print flow", () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;

  before(async () => {
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  });

  after(async () => {
    if (browser) await stopBrowser(browser);
  });

  it("keeps every basin and stone row readable on mobile and across print pages", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "catalog cards",
    );

    for (const sku of ["KF001", "KF002", "KF019"]) await clickTestId(browser.page, `card-product-${sku}`);
    await browser.page.command("Page.navigate", { url: `${baseUrl}/stone` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-stone-color-BW010"]\') !== null'),
      Boolean,
      "stone color buttons",
    );
    for (const code of ["BW010", "MU010", "EG501"]) await clickTestId(browser.page, `button-stone-color-${code}`);

    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-name"]\') !== null'),
      Boolean,
      "quote editor",
    );
    await setTextInput(browser.page, "input-customer-name", "คุณนรินทร์");
    await setTextInput(browser.page, "input-customer-phone", "0812345678");
    await setTextInput(browser.page, "input-customer-email", "customer@example.com");
    await setTextInput(browser.page, "input-customer-project", "โครงการหลายรายการ");
    await clickTestId(browser.page, "button-generate-quote");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="saved-quote-page"] [data-testid="formal-quote-sheet"]\') !== null'),
      Boolean,
      "formal quote",
    );

    const quote = await browser.page.evaluate(`(() => {
      const table = document.querySelector('[data-testid="formal-quote-table"]');
      const rows = [...document.querySelectorAll('[data-testid="formal-quote-table"] tbody tr')].map((row) => row.textContent ?? "");
      const sheet = document.querySelector('[data-testid="formal-quote-sheet"]');
      const wrapper = document.querySelector('.formal-quote-table-wrap');
      return {
        rows,
        hasQrHeader: table?.querySelector('th.formal-qr-column')?.textContent?.includes("3D") ?? false,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        sheetWidth: sheet?.clientWidth ?? 0,
        wrapperWidth: wrapper?.clientWidth ?? 0,
        tableWidth: table?.scrollWidth ?? 0,
      };
    })()`);
    assert.equal(quote.rows.length, 6);
    for (const code of ["KF001", "KF002", "KF019", "BW010", "MU010", "EG501"]) {
      assert.ok(quote.rows.some((row) => row.includes(code)), `Formal quote is missing ${code}`);
    }
    assert.equal(quote.hasQrHeader, true);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await browser.page.evaluate(`(() => {
      const sheet = document.querySelector('[data-testid="formal-quote-sheet"]');
      const wrapper = document.querySelector('.formal-quote-table-wrap');
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        sheetWidth: sheet?.clientWidth ?? 0,
        wrapperWidth: wrapper?.clientWidth ?? 0,
        tableWidth: document.querySelector('[data-testid="formal-quote-table"]')?.scrollWidth ?? 0,
        wrapperOverflow: wrapper ? getComputedStyle(wrapper).overflowX : "",
      };
    })()`);
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, "The formal quote must not widen the mobile page");
    assert.ok(mobile.sheetWidth <= mobile.viewportWidth, "The formal quote sheet must fit the mobile viewport");
    assert.equal(mobile.wrapperOverflow, "auto");
    assert.ok(mobile.tableWidth > mobile.wrapperWidth, "The long table should scroll inside its own mobile wrapper");

    await browser.page.command("Emulation.setEmulatedMedia", { media: "print" });
    const printStyles = await browser.page.evaluate(`(() => ({
      editor: getComputedStyle(document.querySelector('.quote-editor')).display,
      tableHeader: getComputedStyle(document.querySelector('.formal-quote-table thead')).display,
      tableWrapperOverflow: getComputedStyle(document.querySelector('.formal-quote-table-wrap')).overflowX,
      sheetShadow: getComputedStyle(document.querySelector('[data-testid="formal-quote-sheet"]')).boxShadow,
      firstRowBreak: getComputedStyle(document.querySelector('.formal-quote-table tbody tr')).breakInside,
      totalBreak: getComputedStyle(document.querySelector('.formal-totals')).breakInside,
    }))()`);
    assert.equal(printStyles.editor, "none");
    assert.equal(printStyles.tableHeader, "table-header-group");
    assert.equal(printStyles.tableWrapperOverflow, "visible");
    assert.equal(printStyles.sheetShadow, "none");
    assert.equal(printStyles.firstRowBreak, "avoid");
    assert.equal(printStyles.totalBreak, "avoid");
  });

  it("shows both real Studio download actions for the current layout", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "order mode tabs",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-download-studio-dxf"]\') !== null'),
      Boolean,
      "Studio export actions",
    );
    const actions = await browser.page.evaluate(`(() => ({
      dxfText: document.querySelector('[data-testid="button-download-studio-dxf"]')?.textContent ?? "",
      pdfText: document.querySelector('[data-testid="button-download-studio-pdf"]')?.textContent ?? "",
      pngText: document.querySelector('[data-testid="button-download-studio-png"]')?.textContent ?? "",
      dxfDisabled: document.querySelector('[data-testid="button-download-studio-dxf"]')?.disabled ?? true,
      pdfDisabled: document.querySelector('[data-testid="button-download-studio-pdf"]')?.disabled ?? true,
      pngDisabled: document.querySelector('[data-testid="button-download-studio-png"]')?.disabled ?? true,
    }))()`);
    assert.match(actions.dxfText, /ดาวน์โหลดแบบ.*DXF/);
    assert.match(actions.pdfText, /ดาวน์โหลดแบบ.*PDF/);
    assert.match(actions.pngText, /ดาวน์โหลดภาพ.*PNG/);
    assert.equal(actions.dxfDisabled, false);
    assert.equal(actions.pdfDisabled, false);
    assert.equal(actions.pngDisabled, false);
    const initialComparison = await browser.page.evaluate(`(() => ({
      count: document.querySelectorAll('[data-testid^="button-stone-comparison-"]').length,
      active: document.querySelector('[data-testid^="button-stone-comparison-"][aria-pressed="true"]')?.getAttribute("data-testid") ?? "",
      total: document.querySelector('[data-testid="studio-total-value"]')?.textContent ?? "",
    }))()`);
    assert.equal(initialComparison.count, 2);
    assert.equal(initialComparison.active, "button-stone-comparison-BW010");
    await clickTestId(browser.page, "button-stone-comparison-MU010");
    const selectedComparison = await browser.page.evaluate(`(() => ({
      active: document.querySelector('[data-testid^="button-stone-comparison-"][aria-pressed="true"]')?.getAttribute("data-testid") ?? "",
      mainStone: document.querySelector('[data-testid="button-studio-active-stone-MU010"]')?.classList.contains("is-active") ?? false,
      total: document.querySelector('[data-testid="studio-total-value"]')?.textContent ?? "",
    }))()`);
    assert.equal(selectedComparison.active, "button-stone-comparison-MU010");
    assert.equal(selectedComparison.mainStone, true);
    const lightTone = await browser.page.evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="studio-canvas"]');
      const rectangle = canvas?.querySelector('.studio-piece-rectangle');
      const size = rectangle?.querySelector('.studio-piece-size');
      return {
        canvasTone: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-stone-tone") : "",
        rectangleBackground: rectangle instanceof HTMLElement ? getComputedStyle(rectangle).backgroundColor : "",
        textColor: size instanceof HTMLElement ? getComputedStyle(size).color : "",
      };
    })()`);
    assert.equal(lightTone.canvasTone, "#fbfaf4");
    assert.notEqual(lightTone.rectangleBackground, "rgba(248, 252, 254, 0.78)");
    await clickTestId(browser.page, "button-studio-stone-SO423");
    await clickTestId(browser.page, "button-studio-active-stone-SO423");
    const darkTone = await browser.page.evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="studio-canvas"]');
      const rectangle = canvas?.querySelector('.studio-piece-rectangle');
      const size = rectangle?.querySelector('.studio-piece-size');
      return {
        canvasTone: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-stone-tone") : "",
        rectangleBackground: rectangle instanceof HTMLElement ? getComputedStyle(rectangle).backgroundColor : "",
        textColor: size instanceof HTMLElement ? getComputedStyle(size).color : "",
        jointColor: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-joint-color") : "",
        total: document.querySelector('[data-testid="studio-total-value"]')?.textContent ?? "",
      };
    })()`);
    assert.equal(darkTone.canvasTone, "#343736");
    assert.notEqual(darkTone.rectangleBackground, lightTone.rectangleBackground);
    assert.equal(darkTone.textColor, "rgb(255, 255, 255)");
    assert.equal(darkTone.jointColor, "#ffe08a");
    assert.notEqual(darkTone.total, initialComparison.total);
    await clickTestId(browser.page, "button-download-studio-png");
    assert.match(await waitFor(
      () => browser.page.evaluate("document.querySelector('[role=\"status\"]')?.textContent ?? \"\""),
      (value) => value.includes("PNG"),
      "Studio PNG download",
    ), /PNG/);
    await clickTestId(browser.page, "button-download-studio-dxf");
    await browser.page.evaluate("window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true; }");
    await clickTestId(browser.page, "button-download-studio-pdf");
    const printStatus = await waitFor(
      () => browser.page.evaluate("window.__studioPrintCalled === true"),
      Boolean,
      "Studio print action",
    );
    assert.equal(printStatus, true);
    assert.equal(await browser.page.evaluate("document.title"), "KF-Basins-studio-layout-1ชิ้น");
  });

  it("keeps Studio export actions on a saved quote snapshot", async () => {
    const fill = [
      ["input-studio-name", "คุณทดสอบแบบ"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการ Studio Export"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const;
    for (const [testId, value] of fill) await setTextInput(browser.page, testId, value);
    const dropped = await browser.page.evaluate(`(() => {
      const source = document.querySelector('[data-testid="button-studio-basin-KF001"]');
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + rect.width * 0.35, clientY: rect.top + rect.height * 0.5 }));
      return true;
    })()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'),
      Boolean,
      "basin placement",
    );
    await clickTestId(browser.page, "button-submit-studio");
    const savedOutcome = await waitFor(
      () => browser.page.evaluate(`(() => ({
        saved: document.querySelector('[data-testid="saved-studio-layout"]') !== null,
        error: document.querySelector('[data-testid="status-saved-quote-error"]')?.textContent ?? "",
        invalid: document.querySelector('[data-testid="status-saved-quote-invalid"]')?.textContent ?? "",
        result: document.querySelector('[role="status"]')?.textContent ?? "",
        url: window.location.href,
      }))()`),
      (value) => value.saved || Boolean(value.error) || Boolean(value.invalid),
      "saved Studio navigation",
    );
    assert.equal(savedOutcome.saved, true, JSON.stringify(savedOutcome));
    const savedActions = await browser.page.evaluate(`(() => ({
      dxf: document.querySelector('[data-testid="button-download-saved-studio-dxf"]')?.disabled ?? true,
      pdf: document.querySelector('[data-testid="button-download-saved-studio-pdf"]')?.disabled ?? true,
      png: document.querySelector('[data-testid="button-download-studio-png"]')?.disabled ?? true,
    }))()`);
    assert.equal(savedActions.dxf, false);
    assert.equal(savedActions.pdf, false);
    assert.equal(savedActions.png, false);
    await clickTestId(browser.page, "button-download-studio-png");
    await clickTestId(browser.page, "button-download-saved-studio-dxf");
    await browser.page.evaluate("window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true; }");
    await clickTestId(browser.page, "button-download-saved-studio-pdf");
    assert.equal(await waitFor(
      () => browser.page.evaluate("window.__studioPrintCalled === true"),
      Boolean,
      "saved Studio print action",
    ), true);
    assert.match(await browser.page.evaluate("document.title"), /^KF-Basins-.+-\d+ชิ้น$/);
  });
});