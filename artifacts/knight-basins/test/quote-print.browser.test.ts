import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
    const field = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) return false;
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not set ${testId}`);
}

async function setSelectValue(page: CdpPage, testId: string, value: string) {
  const changed = await page.evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return select.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(changed, true, `Could not set ${testId}`);
}

async function setFileInput(page: CdpPage, filePath: string) {
  const documentResult = await page.command("DOM.getDocument");
  const root = documentResult["root"] as { nodeId: number };
  const queryResult = await page.command("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: 'input[data-testid="input-studio-sketch"]',
  });
  const nodeId = queryResult["nodeId"] as number;
  assert.ok(nodeId, "Could not find the Studio sketch file input");
  await page.command("DOM.setFileInputFiles", { nodeId, files: [filePath] });
}

function sharedStudioDraftUrl(state: unknown, catalogContext: unknown) {
  const token = Buffer.from(JSON.stringify({ state, catalogContext }), "utf8").toString("base64url");
  return `${baseUrl}/studio?draft=${token}`;
}

describe("long formal quote print flow", { concurrency: false }, () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;

  before(async () => {
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("DOM.enable");
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
    const initialLanguage = await browser.page.evaluate(`(() => ({
      thaiActive: document.querySelector('[data-testid="button-quote-language-th"]')?.classList.contains("is-active") ?? false,
      englishActive: document.querySelector('[data-testid="button-quote-language-en"]')?.classList.contains("is-active") ?? false,
      total: document.querySelector('[data-testid="text-grand-total"]')?.textContent ?? "",
    }))()`);
    assert.equal(initialLanguage.thaiActive, true);
    assert.equal(initialLanguage.englishActive, false);
    await clickTestId(browser.page, "button-quote-language-en");
    const selectedLanguage = await browser.page.evaluate(`(() => ({
      thaiActive: document.querySelector('[data-testid="button-quote-language-th"]')?.classList.contains("is-active") ?? false,
      englishActive: document.querySelector('[data-testid="button-quote-language-en"]')?.classList.contains("is-active") ?? false,
      total: document.querySelector('[data-testid="text-grand-total"]')?.textContent ?? "",
    }))()`);
    assert.equal(selectedLanguage.thaiActive, false);
    assert.equal(selectedLanguage.englishActive, true);
    assert.equal(selectedLanguage.total, initialLanguage.total);
    await setTextInput(browser.page, "input-customer-name", "คุณนรินทร์");
    await setTextInput(browser.page, "input-customer-company", "บริษัททดสอบ จำกัด");
    await setTextInput(browser.page, "input-customer-phone", "0812345678");
    await setTextInput(browser.page, "input-customer-email", "customer@example.com");
    await setTextInput(browser.page, "input-customer-taxId", "0135553014114");
    await setTextInput(browser.page, "input-customer-address", "224/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000");
    await setTextInput(browser.page, "input-customer-project", "โครงการหลายรายการ");
    await clickTestId(browser.page, "button-generate-quote");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="saved-quote-page"] [data-testid="formal-quote-sheet"]\') !== null'),
      Boolean,
      "formal quote",
    );
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="saved-quote-page"] [data-testid="formal-quote-sheet"] h1\')?.textContent === "OFFICIAL QUOTATION"'),
      Boolean,
      "saved quote language",
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
    const savedLanguage = await browser.page.evaluate(`(() => ({
      thaiActive: document.querySelector('[data-testid="button-saved-quote-language-th"]')?.classList.contains("is-active") ?? false,
      englishActive: document.querySelector('[data-testid="button-saved-quote-language-en"]')?.classList.contains("is-active") ?? false,
      total: document.querySelector('.formal-grand-total strong')?.textContent ?? "",
    }))()`);
    assert.equal(savedLanguage.thaiActive, false);
    assert.equal(savedLanguage.englishActive, true);
    assert.equal(savedLanguage.total, initialLanguage.total);

    await clickTestId(browser.page, "button-saved-quote-language-th");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="formal-quote-sheet"] h1\')?.textContent'), "ใบเสนอราคา / สรุปตามพื้นที่");
    await clickTestId(browser.page, "button-saved-quote-language-en");
    const englishQuote = await browser.page.evaluate(`(() => ({
      title: document.querySelector('[data-testid="formal-quote-sheet"] h1')?.textContent ?? "",
      headers: [...document.querySelectorAll('[data-testid="formal-quote-table"] thead th')].map((cell) => cell.textContent ?? "").join(" | "),
      body: document.querySelector('[data-testid="formal-quote-table"] tbody')?.textContent ?? "",
      notes: document.querySelector('.formal-notes')?.textContent ?? "",
      customer: document.querySelector('.formal-customer-grid')?.textContent ?? "",
      bank: document.querySelector('.formal-bank-details')?.textContent ?? "",
      signature: document.querySelector('.formal-quote-signature')?.textContent ?? "",
      languageButton: document.querySelector('[data-testid="button-saved-quote-language-en"]')?.classList.contains("is-active") ?? false,
    }))()`);
    assert.equal(englishQuote.title, "OFFICIAL QUOTATION");
    assert.match(englishQuote.headers, /Item Description/);
    assert.match(englishQuote.headers, /Work Area/);
    assert.match(englishQuote.headers, /Material \/ m²/);
    assert.match(englishQuote.headers, /Labor \/ m²/);
    assert.match(englishQuote.headers, /Work Qty/);
    assert.match(englishQuote.headers, /Total \(THB\)/);
    assert.match(englishQuote.body, /Basin Set/);
    assert.match(englishQuote.body, /Solid Surface Stone/);
    assert.match(englishQuote.customer, /0135553014114/);
    assert.match(englishQuote.customer, /224\/26 ถนนติวานนท์ จังหวัดปทุมธานี 12000/);
    assert.match(englishQuote.bank, /สาขาปตท\. ติวานนท์/);
    assert.match(englishQuote.bank, /574-1-18925-4/);
    assert.match(englishQuote.signature, /อุไรวรรณ/);
    assert.equal(englishQuote.languageButton, true);
    assert.match(englishQuote.notes, /50% deposit upon approval/);
    await browser.page.evaluate("window.__savedQuotePrintTitle = ''; window.print = () => { window.__savedQuotePrintTitle = document.title; }");
    await clickTestId(browser.page, "button-print-saved-quote");
    assert.match(await browser.page.evaluate("window.__savedQuotePrintTitle"), /^KF-Basins-Quote-.+-EN\.pdf$/);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await browser.page.evaluate(`(() => {
      const style = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? getComputedStyle(element).gridTemplateColumns : "";
      };
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        sheetWidth: document.querySelector('[data-testid="formal-quote-sheet"]')?.clientWidth ?? 0,
        wrapperWidth: document.querySelector('.formal-quote-table-wrap')?.clientWidth ?? 0,
        tableWidth: document.querySelector('.formal-quote-table')?.scrollWidth ?? 0,
        wrapperOverflow: getComputedStyle(document.querySelector('.formal-quote-table-wrap')).overflowX,
        rectangleColumns: style(".studio-rectangle-inputs"),
        sideStatusColumns: style(".studio-side-status-grid"),
        pricingColumns: style(".studio-pricing-inputs"),
        comparisonColumns: style(".studio-stone-comparison-grid"),
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

  it("renders the OF format with installation-point details", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "catalog cards for OF quote",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "fresh catalog cards for OF quote",
    );
    await clickTestId(browser.page, "card-product-KF001");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-name"]\') !== null'),
      Boolean,
      "OF quote editor",
    );
    await clickTestId(browser.page, "button-quote-format-of");
    await setTextInput(browser.page, "input-customer-name", "คุณทดสอบ OF");
    await setTextInput(browser.page, "input-customer-phone", "0812345678");
    await setTextInput(browser.page, "input-customer-email", "of@example.com");
    await setTextInput(browser.page, "input-customer-project", "โครงการ OF");
    await setTextInput(browser.page, "input-customer-site", "ห้องน้ำชั้น 2");
    await clickTestId(browser.page, "button-generate-quote");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="saved-quote-page"] [data-testid="formal-quote-sheet"]\') !== null'),
      Boolean,
      "saved OF formal quote",
    );

    const ofQuote = await browser.page.evaluate(`(() => {
      const sheet = document.querySelector('[data-testid="formal-quote-sheet"]');
      return {
        className: sheet?.className ?? "",
        title: sheet?.querySelector("h1")?.textContent ?? "",
        chip: sheet?.querySelector(".formal-format-chip")?.textContent ?? "",
        body: sheet?.querySelector("tbody")?.textContent ?? "",
        hasQrHeader: sheet?.querySelector("th.formal-qr-column")?.textContent?.includes("3D") ?? false,
        imageCount: sheet?.querySelectorAll(".formal-item-image").length ?? 0,
      };
    })()`);
    assert.match(ofQuote.className, /formal-quote-sheet--of/);
    assert.equal(ofQuote.title, "ใบเสนอราคา / รายละเอียดหน้างาน");
    assert.match(ofQuote.chip, /รายละเอียดตามห้อง/);
    assert.match(ofQuote.body, /จุดติดตั้ง ห้องน้ำชั้น 2/);
    assert.equal(ofQuote.hasQrHeader, true);
    assert.ok(ofQuote.imageCount >= 1);
  });

  it("offers catalog name, SKU, price, and selected-first sorting", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="select-sort"]\') !== null'),
      Boolean,
      "catalog sort control",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="select-sort"]\') !== null'),
      Boolean,
      "catalog sort control after clearing state",
    );
    const options = await browser.page.evaluate(`(() => [...document.querySelectorAll('[data-testid="select-sort"] option')].map((option) => ({ value: option.value, label: option.textContent ?? "" })))()`);
    assert.deepEqual(options.map((option) => option.value), ["catalog", "name-az", "name-za", "sku-az", "price-low", "price-high", "selected"]);
    assert.match(options.find((option) => option.value === "sku-az")?.label ?? "", /SKU.*น้อยไปมาก/);
    assert.match(await browser.page.evaluate('document.querySelector(\'[data-testid="text-sort-help"]\')?.textContent ?? ""'), /ทุกรุ่นที่เปิดใช้งาน/);
    await setSelectValue(browser.page, "select-sort", "name-az");
    const firstName = await browser.page.evaluate('document.querySelector(".product-card h3")?.textContent ?? ""');
    await setSelectValue(browser.page, "select-sort", "price-low");
    const firstPrice = await browser.page.evaluate('document.querySelector(".product-price")?.textContent ?? ""');
    assert.notEqual(firstName, "");
    assert.notEqual(firstPrice, "");
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
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'.studio-placement\') !== null'),
      Boolean,
      "Studio basin placement",
    );
    await browser.page.evaluate("document.querySelector('.studio-placement')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="input-placement-x-"]\') !== null && document.querySelector(\'[data-testid^="input-placement-y-"]\') !== null'),
      Boolean,
      "basin placement inspector",
    );
    const placementPreview = await browser.page.evaluate(`(() => ({
      hasCatalogPreview: document.querySelector('.studio-placement-visual .basin-visual') !== null,
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("value") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("value") ?? "",
    }))()`);
    assert.equal(placementPreview.hasCatalogPreview, true);
    assert.notEqual(placementPreview.x, "");
    assert.notEqual(placementPreview.y, "");
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
    assert.ok(initialComparison.count >= 2 && initialComparison.count <= 3);
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
      const basin = canvas?.querySelector('.studio-placement');
      return {
        canvasTone: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-stone-tone") : "",
        rectangleBackground: rectangle instanceof HTMLElement ? getComputedStyle(rectangle).backgroundColor : "",
        textColor: size instanceof HTMLElement ? getComputedStyle(size).color : "",
        basinShadow: basin instanceof HTMLElement ? getComputedStyle(basin, "::before").boxShadow : "",
        basinRadius: basin instanceof HTMLElement ? getComputedStyle(basin).borderRadius : "",
      };
    })()`);
    assert.equal(lightTone.canvasTone, "#fbfaf4");
    assert.notEqual(lightTone.rectangleBackground, "rgba(248, 252, 254, 0.78)");
    assert.match(lightTone.basinShadow, /inset/);
    assert.equal(lightTone.basinRadius, "10px");
    const so423Selected = await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-stone-SO423"]\')?.getAttribute("aria-pressed") === "true"');
    if (!so423Selected) {
      const selectedStoneToRemove = await browser.page.evaluate(`(() => {
        const button = [...document.querySelectorAll('[data-testid^="button-studio-stone-"][aria-pressed="true"]')]
          .find((candidate) => candidate.getAttribute("data-testid") !== "button-studio-stone-BW010");
        return button?.getAttribute("data-testid") ?? "";
      })()`);
      if (selectedStoneToRemove) await clickTestId(browser.page, selectedStoneToRemove);
      await clickTestId(browser.page, "button-studio-stone-SO423");
    }
    await clickTestId(browser.page, "button-studio-active-stone-SO423");
    const darkTone = await browser.page.evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="studio-canvas"]');
      const rectangle = canvas?.querySelector('.studio-piece-rectangle');
      const size = rectangle?.querySelector('.studio-piece-size');
      const basin = canvas?.querySelector('.studio-placement');
      return {
        canvasTone: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-stone-tone") : "",
        rectangleBackground: rectangle instanceof HTMLElement ? getComputedStyle(rectangle).backgroundColor : "",
        textColor: size instanceof HTMLElement ? getComputedStyle(size).color : "",
        jointColor: canvas instanceof HTMLElement ? canvas.style.getPropertyValue("--studio-joint-color") : "",
        basinShadow: basin instanceof HTMLElement ? getComputedStyle(basin, "::before").boxShadow : "",
        total: document.querySelector('[data-testid="studio-total-value"]')?.textContent ?? "",
      };
    })()`);
    assert.equal(darkTone.canvasTone, "#343736");
    assert.notEqual(darkTone.rectangleBackground, lightTone.rectangleBackground);
    assert.equal(darkTone.textColor, "rgb(255, 255, 255)");
    assert.equal(darkTone.jointColor, "#ffe08a");
    assert.match(darkTone.basinShadow, /inset/);
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

  it("supports one-click Studio presets, basin alignment, zoom, and the mobile estimate bar", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
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
      "Studio preset order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "Studio preset canvas",
    );

    await clickTestId(browser.page, "button-studio-preset-l-left");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="select-studio-rectangle-"] option:nth-child(2)\') !== null'),
      Boolean,
      "L preset rectangles",
    );
    const leftFirstRectangle = await browser.page.evaluate(`(() => ({
      widths: [...document.querySelectorAll('[data-testid^="input-rectangle-width-"]')].map((input) => input.value),
      lengths: [...document.querySelectorAll('[data-testid^="input-rectangle-length-"]')].map((input) => input.value),
      xs: [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')].map((input) => input.value),
      ys: [...document.querySelectorAll('[data-testid^="input-rectangle-y-"]')].map((input) => input.value),
    }))()`);
    assert.deepEqual(leftFirstRectangle, { widths: ["1500"], lengths: ["600"], xs: ["0"], ys: ["0"] });
    await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid^="select-studio-rectangle-"]');
      if (!(select instanceof HTMLSelectElement)) return false;
      select.value = select.options[1]?.value ?? "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="input-rectangle-width-"]\')?.value === "600"'),
      Boolean,
      "left L second rectangle selection",
    );
    const leftSecondRectangle = await browser.page.evaluate(`(() => ({
      widths: [...document.querySelectorAll('[data-testid^="input-rectangle-width-"]')].map((input) => input.value),
      lengths: [...document.querySelectorAll('[data-testid^="input-rectangle-length-"]')].map((input) => input.value),
      xs: [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')].map((input) => input.value),
      ys: [...document.querySelectorAll('[data-testid^="input-rectangle-y-"]')].map((input) => input.value),
    }))()`);
    assert.deepEqual(leftSecondRectangle, { widths: ["600"], lengths: ["1200"], xs: ["0"], ys: ["600"] });

    await clickTestId(browser.page, "button-studio-mirror-l");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="input-rectangle-x-"]\')?.value === "900"'),
      Boolean,
      "mirrored L second rectangle selection",
    );
    const rightPreset = await browser.page.evaluate(`(() => ({
      xs: [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')].map((input) => input.value),
      ys: [...document.querySelectorAll('[data-testid^="input-rectangle-y-"]')].map((input) => input.value),
    }))()`);
    assert.deepEqual(rightPreset, { xs: ["900"], ys: ["600"] });
    assert.equal(await browser.page.evaluate('document.querySelectorAll(\'[data-testid^="button-studio-preset-"]\').length'), 4);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-preset-l-right"]\') !== null'), true);

    await clickTestId(browser.page, "button-studio-preset-u");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(\'[data-testid="studio-canvas"] .studio-piece-rectangle\').length === 3'),
      Boolean,
      "U preset rectangles",
    );
    const uPreset = await browser.page.evaluate(`(() => ({
      count: document.querySelectorAll('[data-testid="studio-canvas"] .studio-piece-rectangle').length,
      sizes: [...document.querySelectorAll('[data-testid="studio-canvas"] .studio-piece-size')].map((item) => item.textContent),
    }))()`);
    assert.deepEqual(uPreset, { count: 3, sizes: ["1500 × 600", "600 × 1200", "600 × 1200"] });

    await clickTestId(browser.page, "button-studio-preset-i");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="input-rectangle-length-"]\')?.value === "600"'),
      Boolean,
      "I preset rectangle",
    );
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length === 1'),
      Boolean,
      "preset basin placement",
    );
    await browser.page.evaluate("document.querySelector('.studio-placement')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await clickTestId(browser.page, "button-center-selected-basin");
    const centered = await waitFor(
      () => browser.page.evaluate(`(() => {
        const placement = document.querySelector('.studio-placement');
        return { left: Number.parseFloat(placement?.getAttribute('style')?.match(/left: ([0-9.]+)%/)?.[1] ?? "0"), top: Number.parseFloat(placement?.getAttribute('style')?.match(/top: ([0-9.]+)%/)?.[1] ?? "0") };
      })()`),
      (value) => Math.abs(value.left - 38.3333) < 0.1 && Math.abs(value.top - 8.3333) < 0.1,
      "centered basin placement",
    );
    assert.ok(Math.abs(centered.left - 38.3333) < 0.1);
    assert.ok(Math.abs(centered.top - 8.3333) < 0.1);

    await clickTestId(browser.page, "button-studio-zoom-in");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-zoom-value"]\')?.textContent'), "125%");
    await clickTestId(browser.page, "button-studio-zoom-reset");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-zoom-value"]\')?.textContent'), "100%");

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "mobile Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-mobile-estimate-bar"]\') !== null'),
      Boolean,
      "mobile estimate bar",
    );
    const mobileEstimate = await browser.page.evaluate(`(() => {
      const bar = document.querySelector('[data-testid="studio-mobile-estimate-bar"]');
      return {
        display: bar instanceof HTMLElement ? getComputedStyle(bar).display : "",
        position: bar instanceof HTMLElement ? getComputedStyle(bar).position : "",
        total: bar?.textContent ?? "",
        detailButton: document.querySelector('[data-testid="button-mobile-studio-details"]')?.textContent ?? "",
        submitButton: document.querySelector('[data-testid="button-mobile-studio-submit"]')?.textContent ?? "",
      };
    })()`);
    assert.equal(mobileEstimate.display, "flex");
    assert.equal(mobileEstimate.position, "fixed");
    assert.match(mobileEstimate.total, /ยอดประเมินรวม:/);
    assert.match(mobileEstimate.total, /฿/);
    assert.equal(mobileEstimate.detailButton, "ดูรายละเอียด");
    assert.equal(mobileEstimate.submitButton, "ส่งขอราคา");
  });

  it("shows and blocks the Studio joint, disconnected-rectangle, and discount validations", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "Studio canvas",
    );

    const addRectangle = await browser.page.evaluate(`(() => {
      const button = document.querySelector('[data-testid^="button-add-studio-rectangle-"]');
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()`);
    assert.equal(addRectangle, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="select-studio-rectangle-"] option:nth-child(2)\') !== null'),
      Boolean,
      "small rectangle companion panel",
    );
    const secondRectangleX = await browser.page.evaluate(`(() => {
      const inputs = [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')];
      return inputs[0]?.getAttribute("data-testid") ?? "";
    })()`);
    assert.match(secondRectangleX, /^input-rectangle-x-/);
    await setTextInput(browser.page, secondRectangleX, "2100");
    await waitFor(
      () => browser.page.evaluate('document.body.textContent?.includes("สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน") ?? false'),
      Boolean,
      "disconnected rectangle warning",
    );

    await setTextInput(browser.page, secondRectangleX, "1800");
    await waitFor(
      () => browser.page.evaluate('!(document.body.textContent?.includes("สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน") ?? false)'),
      Boolean,
      "connected rectangle reset",
    );
    const droppedAcrossJoint = await browser.page.evaluate(`(() => {
      const source = document.querySelector('[data-testid="button-studio-basin-KF001"]');
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + rect.width * 0.5, clientY: rect.top + rect.height * 0.5 }));
      return true;
    })()`);
    assert.equal(droppedAcrossJoint, true);
    await waitFor(
      () => browser.page.evaluate('document.body.textContent?.includes("อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว") ?? false'),
      Boolean,
      "cross-joint warning",
    );
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว"'),
      Boolean,
      "cross-joint submission block",
    );
    const movedOutOfJoint = await browser.page.evaluate(`(() => {
      const placement = document.querySelector(".studio-placement");
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(placement instanceof HTMLElement) || !(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      placement.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + rect.width * 0.25, clientY: rect.top + rect.height * 0.5 }));
      return true;
    })()`);
    assert.equal(movedOutOfJoint, true);
    await waitFor(
      () => browser.page.evaluate('!(document.body.textContent?.includes("อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว") ?? false)'),
      Boolean,
      "cross-joint warning cleared after basin move",
    );

    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "fresh Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "fresh Studio canvas",
    );
    const droppedInsidePanel = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + rect.width * 0.25, clientY: rect.top + rect.height * 0.5 }));
      return true;
    })()`);
    assert.equal(droppedInsidePanel, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length === 1'),
      Boolean,
      "inside-panel basin placement",
    );
    await setTextInput(browser.page, "input-studio-discount", "-1");
    await waitFor(
      () => browser.page.evaluate('document.body.textContent?.includes("ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด") ?? false'),
      Boolean,
      "discount warning",
    );
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "ส่วนลดต้องไม่ติดลบและไม่เกินยอดรวมก่อนส่วนลด"'),
      Boolean,
      "discount submission block",
    );
  });

  it("blocks overlapping basin placements before a quote request", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "overlap Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "overlap Studio canvas",
    );
    await clickTestId(browser.page, "button-studio-basin-KF002");
    const dropBasin = async (sku: string) => {
      const dropped = await browser.page.evaluate(`(() => {
        const target = document.querySelector('[data-testid="studio-canvas"]');
        if (!(target instanceof HTMLElement)) return false;
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("application/x-studio-basin", "${sku}");
        const rect = target.getBoundingClientRect();
        target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
        target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + rect.width * 0.25, clientY: rect.top + rect.height * 0.5 }));
        return true;
      })()`);
      assert.equal(dropped, true);
    };
    await dropBasin("KF001");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length === 1'),
      Boolean,
      "first overlap basin",
    );
    await dropBasin("KF002");
    await waitFor(
      () => browser.page.evaluate('document.body.textContent?.includes("มีอ่างวางซ้อนทับกัน กรุณาขยับอ่างให้อยู่ห่างกัน") ?? false'),
      Boolean,
      "basin overlap warning",
    );
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "มีอ่างวางซ้อนทับกัน กรุณาขยับอ่างให้อยู่ห่างกัน"'),
      Boolean,
      "basin overlap submission block",
    );
  });

  it("blocks invalid Studio upstand heights and phone numbers", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "field validation Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "field validation Studio canvas",
    );
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length === 1'),
      Boolean,
      "field validation basin",
    );
    await setTextInput(browser.page, "input-studio-upstand-height", "-1");
    await waitFor(
      () => browser.page.evaluate('document.body.textContent?.includes("ความสูงบัวต้องอยู่ระหว่าง 0–500 มม.") ?? false'),
      Boolean,
      "upstand height warning",
    );
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "ความสูงบัวต้องอยู่ระหว่าง 0–500 มม."'),
      Boolean,
      "upstand height submission block",
    );
    await setTextInput(browser.page, "input-studio-upstand-height", "120");
    for (const [testId, value] of [
      ["input-studio-name", "คุณทดสอบเบอร์โทร"],
      ["input-studio-phone", "08123"],
      ["input-studio-project", "โครงการเบอร์โทร"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const) {
      await setTextInput(browser.page, testId, value);
    }
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก"'),
      Boolean,
      "phone format submission block",
    );
    await setTextInput(browser.page, "input-studio-phone", "0812345678");
    await setTextInput(browser.page, "input-studio-email", "abc@xyz");
    await clickTestId(browser.page, "button-submit-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)"'),
      Boolean,
      "Studio email format submission block",
    );
  });

  it("shows email format guidance in quick quote and trims blank hand-sketch contact names", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-email"]\') !== null'),
      Boolean,
      "quick quote customer form",
    );
    assert.equal(
      await browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-lineContact"]\') !== null'),
      true,
    );
    assert.deepEqual(
      await browser.page.evaluate(`Array.from(document.querySelector('[data-testid="input-customer-preferred-contact"]')?.options ?? []).map((option) => option.textContent)`),
      ["ยังไม่ระบุ", "LINE", "โทรศัพท์", "อีเมล"],
    );
    await setTextInput(browser.page, "input-customer-email", "abc@xyz");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="status-quote-email-validation"]\')?.textContent === "กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)"'),
      Boolean,
      "incomplete email guidance",
    );
    await setTextInput(browser.page, "input-customer-email", "name.com");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="status-quote-email-validation"]\')?.textContent === "กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)"'),
      Boolean,
      "missing-at email guidance",
    );

    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-sketch"]\') !== null'),
      Boolean,
      "hand-sketch order mode",
    );
    await clickTestId(browser.page, "button-order-mode-sketch");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-submit-sketch"]\') !== null'),
      Boolean,
      "hand-sketch submit form",
    );
    await setTextInput(browser.page, "input-studio-name", "   ");
    await setTextInput(browser.page, "input-studio-phone", "0812345678");
    await setTextInput(browser.page, "input-studio-project", "โครงการภาพร่าง");
    await clickTestId(browser.page, "button-submit-sketch");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[role="status"]\')?.textContent === "กรุณาแนบไฟล์ และกรอกชื่อผู้ติดต่อ โทรศัพท์ และชื่อโครงการ"'),
      Boolean,
      "hand-sketch blank-name validation",
    );
  });

  it("creates a formal quote when customer details are still incomplete", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "catalog for partial quote",
    );
    await clickTestId(browser.page, "card-product-KF001");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-name"]\') !== null'),
      Boolean,
      "partial quote form",
    );
    await setTextInput(browser.page, "input-customer-lineContact", "@partial-quote");
    await setTextInput(browser.page, "input-customer-site", "ห้องน้ำชั้น 2");
    await clickTestId(browser.page, "button-generate-quote");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="saved-quote-page"] [data-testid="formal-quote-sheet"]\') !== null'),
      Boolean,
      "formal quote with partial customer details",
    );
    assert.equal(
      await browser.page.evaluate('document.querySelector(\'[data-testid="formal-quote-sheet"]\')?.textContent?.includes("@partial-quote")'),
      true,
    );
  });

  it("shows a non-blocking warning for rectangle dimensions under 400 mm", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "small rectangle Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "small rectangle Studio canvas",
    );
    const widthInput = await browser.page.evaluate('document.querySelector(\'[data-testid^="input-rectangle-width-"]\')?.getAttribute("data-testid") ?? ""');
    const lengthInput = await browser.page.evaluate('document.querySelector(\'[data-testid^="input-rectangle-length-"]\')?.getAttribute("data-testid") ?? ""');
    assert.match(widthInput, /^input-rectangle-width-/);
    assert.match(lengthInput, /^input-rectangle-length-/);
    await setTextInput(browser.page, widthInput, "10");
    await setTextInput(browser.page, lengthInput, "15");
    const warning = await waitFor(
      () => browser.page.evaluate(`(() => {
        const element = document.querySelector('[data-testid^="status-small-rectangle-"]');
        return element?.textContent ?? "";
      })()`),
      (value) => value.includes("ขนาด 10 มม.") && value.includes("ขนาด 15 มม.") && value.includes("400 มม."),
      "small rectangle informative warning",
    );
    assert.match(warning, /กรุณาตรวจสอบหน่วยมิลลิเมตร/);

    const addRectangle = await browser.page.evaluate(`(() => {
      const button = document.querySelector('[data-testid^="button-add-studio-rectangle-"]');
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()`);
    assert.equal(addRectangle, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="select-studio-rectangle-"] option:nth-child(2)\') !== null'),
      Boolean,
      "small rectangle companion panel",
    );
    const secondRectangleX = await browser.page.evaluate(`(() => {
      const inputs = [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')];
      return inputs[0]?.getAttribute("data-testid") ?? "";
    })()`);
    assert.match(secondRectangleX, /^input-rectangle-x-/);
    await setTextInput(browser.page, secondRectangleX, "10");

    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'),
      Boolean,
      "small rectangle basin placement",
    );

    for (const [testId, value] of [
      ["input-studio-name", "คุณทดสอบขนาดเล็ก"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการขนาดเล็ก"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const) {
      await setTextInput(browser.page, testId, value);
    }
    await clickTestId(browser.page, "button-submit-studio");
    const submitResult = await waitFor(
      () => browser.page.evaluate("window.location.href"),
      (value) => value.includes("/quote/view?token="),
      "small rectangle non-blocking submit",
    );
    assert.match(submitResult, /\/quote\/view\?token=/);
    assert.match(warning, /ขนาด 10 มม/);
  });

  it("keeps Studio export actions on a saved quote snapshot", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "saved Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "saved Studio canvas",
    );
    const fill = [
      ["input-studio-name", "คุณทดสอบแบบ"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการ Studio Export"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const;
    for (const [testId, value] of fill) await setTextInput(browser.page, testId, value);
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
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
    await clickTestId(browser.page, "button-saved-quote-language-en");
    const savedEnglish = await browser.page.evaluate(`(() => ({
      heading: document.querySelector('[data-testid="saved-studio-layout"] h2')?.textContent ?? "",
      note: document.querySelector('[data-testid="saved-studio-layout"] .studio-saved-layout-note')?.textContent ?? "",
      formalTitle: document.querySelector('[data-testid="formal-quote-sheet"] h1')?.textContent ?? "",
    }))()`);
    assert.equal(savedEnglish.heading, "Saved layout");
    assert.match(savedEnglish.note, /Basin positions are read-only/);
    assert.equal(savedEnglish.formalTitle, "OFFICIAL QUOTATION");
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
    await clickTestId(browser.page, "button-copy-saved-studio-to-editor");
    await waitFor(
      () => browser.page.evaluate('window.location.pathname === "/studio" && new URLSearchParams(window.location.search).has("draft")'),
      Boolean,
      "Studio duplicate route",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'), true);
    assert.equal(await browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'), true);
  });

  it("saves a named multi-piece draft and prints every piece on the saved quote", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "multi-piece Studio canvas",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "fresh multi-piece Studio canvas",
    );

    const firstPieceName = await browser.page.evaluate(
      'document.querySelector(\'[data-testid^="input-piece-name-"]\')?.getAttribute("data-testid") ?? ""',
    );
    assert.match(firstPieceName, /^input-piece-name-/);
    await setTextInput(browser.page, firstPieceName, "ครัวหลัก");
    const firstRectangleInputs = await browser.page.evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="studio-canvas"]');
      const rectangle = canvas?.querySelector('.studio-rectangle-drag-target')?.getAttribute('aria-label') ?? "";
      const width = document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? "";
      const length = document.querySelector('[data-testid^="input-rectangle-length-"]')?.getAttribute("data-testid") ?? "";
      return { rectangle, width, length };
    })()`);
    assert.match(firstRectangleInputs.width, /^input-rectangle-width-/);
    assert.match(firstRectangleInputs.length, /^input-rectangle-length-/);
    await setTextInput(browser.page, firstRectangleInputs.width, "1800");
    await setTextInput(browser.page, firstRectangleInputs.length, "600");
    await clickTestId(browser.page, "button-add-studio-piece");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(\'[data-testid^="input-piece-name-"]\').length'),
      (count) => count === 2,
      "second Studio workpiece",
    );

    const pieceNameInputs = await browser.page.evaluate(
      '([...document.querySelectorAll(\'[data-testid^="input-piece-name-"]\')]).map((input) => input.getAttribute("data-testid") ?? "")',
    );
    assert.equal(pieceNameInputs.length, 2);
    await setTextInput(browser.page, pieceNameInputs[1]!, "ห้องน้ำชั้นสอง");

    await clickTestId(browser.page, "button-studio-basin-KF001");
    await clickTestId(browser.page, "button-studio-basin-place-KF001");
    const selectedSecondPiece = await browser.page.evaluate(`(() => {
      const rectangle = document.querySelector('[data-testid^="studio-canvas-piece-"] .studio-rectangle-drag-target');
      if (!(rectangle instanceof HTMLElement)) return false;
      rectangle.click();
      return true;
    })()`);
    assert.equal(selectedSecondPiece, true);
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await clickTestId(browser.page, "button-studio-basin-place-KF002");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(\'[data-testid="studio-canvas"] .studio-placement, [data-testid^="studio-canvas-piece-"] .studio-placement\').length'),
      (count) => count === 2,
      "basins on both workpieces",
    );

    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "named Studio draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "แบบครัวและห้องน้ำ");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    const draftSummary = await waitFor(
      () => browser.page.evaluate(`(() => {
        const card = document.querySelector('[data-testid^="studio-saved-draft-"]');
        return {
          drawer: document.querySelector('[data-testid="studio-drafts-drawer"]') !== null,
          card: card !== null,
          name: card?.textContent ?? "",
          previews: card?.querySelectorAll('[data-testid^="studio-draft-preview-"]').length ?? 0,
          openButton: card?.querySelector('[data-testid^="button-open-studio-draft-"]')?.getAttribute("data-testid") ?? "",
        };
      })()`),
      (value) => value.drawer && value.card && Boolean(value.openButton),
      "saved multi-piece draft",
    );
    assert.match(draftSummary.name, /แบบครัวและห้องน้ำ/);
    assert.equal(draftSummary.previews, 2);

    await clickTestId(browser.page, draftSummary.openButton);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') === null'),
      Boolean,
      "reopened Studio draft",
    );
    assert.equal(await browser.page.evaluate('document.querySelectorAll(\'[data-testid^="input-piece-name-"]\').length'), 2);
    assert.equal(await browser.page.evaluate('document.querySelectorAll(\'[data-testid="studio-canvas"] .studio-placement, [data-testid^="studio-canvas-piece-"] .studio-placement\').length'), 2);

    for (const [testId, value] of [
      ["input-studio-name", "คุณทดสอบหลายชิ้นงาน"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการครัวและห้องน้ำ"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const) {
      await setTextInput(browser.page, testId, value);
    }
    await clickTestId(browser.page, "button-submit-studio");
    const savedOutcome = await waitFor(
      () => browser.page.evaluate(`(() => ({
        saved: document.querySelector('[data-testid="saved-studio-layout"]') !== null,
        error: document.querySelector('[data-testid="status-saved-quote-error"]')?.textContent ?? "",
        invalid: document.querySelector('[data-testid="status-saved-quote-invalid"]')?.textContent ?? "",
      }))()`),
      (value) => value.saved || Boolean(value.error) || Boolean(value.invalid),
      "multi-piece saved quote",
    );
    assert.equal(savedOutcome.saved, true, JSON.stringify(savedOutcome));

    const savedLayout = await browser.page.evaluate(`(() => ({
      heading: document.querySelector('[data-testid="saved-studio-layout"] .studio-saved-layout-heading')?.textContent ?? "",
      pieces: document.querySelectorAll('[data-testid="saved-studio-layout"] .studio-saved-piece').length,
      canvases: document.querySelectorAll('[data-testid^="saved-studio-canvas-"]').length,
      placements: document.querySelectorAll('[data-testid="saved-studio-layout"] .studio-placement').length,
      canvasBounds: [...document.querySelectorAll('[data-testid^="saved-studio-canvas-"]')].map((canvas) => {
        const canvasBounds = canvas.getBoundingClientRect();
        const containerBounds = canvas.parentElement?.getBoundingClientRect();
        return {
          canvasWidth: canvasBounds.width,
          containerWidth: containerBounds?.width ?? 0,
          fitsContainer: canvasBounds.right <= (containerBounds?.right ?? canvasBounds.right) + 1,
        };
      }),
    }))()`);
    assert.match(savedLayout.heading, /2/);
    assert.equal(savedLayout.pieces, 2);
    assert.equal(savedLayout.canvases, 2);
    assert.equal(savedLayout.placements, 2);
    assert.ok(savedLayout.canvasBounds.every((canvas) => canvas.fitsContainer), JSON.stringify(savedLayout.canvasBounds));

    await browser.page.evaluate("window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true; }");
    await clickTestId(browser.page, "button-download-saved-studio-pdf");
    assert.equal(await waitFor(
      () => browser.page.evaluate("window.__studioPrintCalled === true"),
      Boolean,
      "multi-piece saved Studio print action",
    ), true);
    assert.match(await browser.page.evaluate("document.title"), /^KF-Basins-.+-2ชิ้น$/);
  });

  it("guides shared Studio drafts through basin catalog changes", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "shared Studio draft canvas",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "fresh shared Studio draft canvas",
    );
    await clickTestId(browser.page, "button-studio-basin-KF002");
    const storedDraft = await waitFor(
      () => browser.page.evaluate('localStorage.getItem("knight-studio-draft-v1")'),
      (value) => Boolean(value),
      "Studio catalog context before named save",
    );
    const savedDraft = JSON.parse(storedDraft) as {
      state: { basinSkus: string[] };
      catalogContext: { revision: string; basinItems: Array<Record<string, unknown>> };
    };
    assert.ok(savedDraft.catalogContext);

    const removedSku = "KF999";
    const removedState = {
      ...savedDraft.state,
      basinSkus: [...savedDraft.state.basinSkus, removedSku],
    };
    const removedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-named-removal",
      basinItems: [
        ...savedDraft.catalogContext.basinItems,
        { sku: removedSku, colorName: "รุ่นที่ยกเลิกสำหรับแบบร่างที่ตั้งชื่อ" },
      ],
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "removed basin catalog notice",
    );
    const removedNotice = await browser.page.evaluate(`(() => ({
      banner: document.querySelector('[data-testid="studio-catalog-change-banner"]')?.textContent ?? "",
      hidden: document.querySelector('[data-testid="studio-hidden-basins"]')?.textContent ?? "",
      replacement: document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') !== null,
      removal: document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null,
    }))()`);
    assert.match(removedNotice.banner, new RegExp(removedSku));
    assert.match(removedNotice.banner, /ไม่มีในแคตตาล็อกปัจจุบัน/);
    assert.match(removedNotice.hidden, new RegExp(removedSku));
    assert.equal(removedNotice.replacement, true);
    assert.equal(removedNotice.removal, true);

    const replacementSku = await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]');
      if (!(select instanceof HTMLSelectElement)) return "";
      return [...select.options].find((option) => option.value)?.value ?? "";
    })()`);
    assert.ok(replacementSku, "A replacement basin should be available");
    await setSelectValue(browser.page, `select-replace-studio-basin-${removedSku}`, replacementSku);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`),
      Boolean,
      "removed basin replacement",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="button-studio-basin-${replacementSku}"]')?.getAttribute("aria-pressed")`), "true");
    const replacedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("จัดการแล้ว") && value.includes(removedSku),
      "resolved replacement catalog notice",
    );
    assert.doesNotMatch(replacedNotice, /ไม่มีในแคตตาล็อกปัจจุบัน/);
    const persistedReplacementResolution = await waitFor(
      () => browser.page.evaluate(`(() => {
        const raw = localStorage.getItem("knight-studio-draft-v1");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed.catalogContext?.resolvedSkus?.includes("${removedSku}") === true;
      })()`),
      Boolean,
      "resolved replacement autosave",
    );
    assert.equal(persistedReplacementResolution, true);

    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-resume-studio-draft"]\') !== null'),
      Boolean,
      "resolved Studio draft reopen banner",
    );
    await clickTestId(browser.page, "button-resume-studio-draft");
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "resolved replacement after draft reopen",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`), true);

    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null`),
      Boolean,
      "removed basin removal control",
    );
    await clickTestId(browser.page, `button-remove-hidden-studio-basin-${removedSku}`);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-hidden-basins"]') === null`),
      Boolean,
      "removed basin removal",
    );
    const removedResolvedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-resolved"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "resolved removal catalog notice",
    );
    assert.match(removedResolvedNotice, /นำออกจากแบบหรือแทนที่แล้ว/);
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`), true);

    const changedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-update",
      basinItems: savedDraft.catalogContext.basinItems.map((item) =>
        item.sku === "KF001"
          ? { ...item, colorName: "ชื่อสีก่อนหน้า", priceTHB: Number(item.priceTHB) + 1000, basinDimensions: "360 × 510 × 130 mm" }
          : item,
      ),
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(savedDraft.state, changedContext),
    });
    const changedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("KF001") && value.includes("ชื่อสีก่อนหน้า"),
      "changed basin catalog notice",
    );
    assert.match(changedNotice, /รายละเอียดแคตตาล็อกเปลี่ยนจาก ชื่อสีก่อนหน้า/);
    assert.match(changedNotice, /ราคา: ฿[\d,]+ → ฿[\d,]+/);
    assert.match(changedNotice, /ขนาดหลุม: 360 × 510 × 130 mm →/);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-hidden-basins"]\') === null'), true);

    const staleContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-other-catalog-change",
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(savedDraft.state, staleContext),
    });
    const unchangedSelectionNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("รุ่นอ่างที่เลือกยังตรงกับรายการปัจจุบัน"),
      "unchanged selected basin catalog notice",
    );
    assert.match(unchangedSelectionNotice, /มีรายการอื่นในแคตตาล็อกอัปเดตแล้ว/);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-hidden-basins"]\') === null'), true);
  });

  it("keeps Studio controls within the viewport on mobile", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-stone-comparison"]\') !== null'),
      Boolean,
      "Studio comparison",
    );

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await browser.page.evaluate(`(() => {
      const style = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? getComputedStyle(element).gridTemplateColumns : "";
      };
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        rectangleColumns: style(".studio-rectangle-inputs"),
        sideStatusColumns: style(".studio-side-status-grid"),
        pricingColumns: style(".studio-pricing-inputs"),
        comparisonColumns: style(".studio-stone-comparison-grid"),
      };
    })()`);
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, "Studio must not widen the mobile page");
    assert.equal(mobile.rectangleColumns.split(" ").length, 2);
    assert.equal(mobile.sideStatusColumns.split(" ").length, 2);
    assert.equal(mobile.pricingColumns.split(" ").length, 1);
    assert.equal(mobile.comparisonColumns.split(" ").length, 1);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 768,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const tablet = await browser.page.evaluate(`(() => {
      const style = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? getComputedStyle(element).gridTemplateColumns : "";
      };
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        rectangleColumns: style(".studio-rectangle-inputs"),
        sideStatusColumns: style(".studio-side-status-grid"),
        pricingColumns: style(".studio-pricing-inputs"),
        comparisonColumns: style(".studio-stone-comparison-grid"),
      };
    })()`);
    assert.ok(tablet.bodyWidth <= tablet.viewportWidth, "Studio must not widen the tablet page");
    assert.equal(tablet.rectangleColumns.split(" ").length, 4);
    assert.equal(tablet.sideStatusColumns.split(" ").length, 4);
    assert.equal(tablet.pricingColumns.split(" ").length, 3);
    assert.equal(tablet.comparisonColumns.split(" ").length, 3);
  });

  it("previews the latest hand sketch file without widening the mobile page", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-sketch-preview-"));
    const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const firstFile = path.join(fixtureDirectory, "first-sketch.png");
    const secondFile = path.join(fixtureDirectory, "latest-sketch.png");
    await writeFile(firstFile, pngBytes);
    await writeFile(secondFile, pngBytes);
    try {
      await browser.page.command("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 1200,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
      await waitFor(
        () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-sketch"]\') !== null'),
        Boolean,
        "hand sketch order mode",
      );
      await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
      await clickTestId(browser.page, "button-order-mode-sketch");
      await waitFor(
        () => browser.page.evaluate('document.querySelector(\'[data-testid="input-studio-sketch"]\') !== null'),
        Boolean,
        "hand sketch file input",
      );
      await browser.page.evaluate(`(() => {
        window.__revokedSketchObjectUrls = [];
        const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = (url) => {
          window.__revokedSketchObjectUrls.push(url);
          nativeRevokeObjectURL(url);
        };
      })()`);

      await setFileInput(browser.page, firstFile);
      const firstPreview = await waitFor(
        () => browser.page.evaluate(`(() => {
          const image = document.querySelector('[data-testid="img-studio-sketch-preview-0"]');
          return {
            src: image?.getAttribute("src") ?? "",
            alt: image?.getAttribute("alt") ?? "",
            naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
          };
        })()`),
        (value) => Boolean(value.src) && value.naturalWidth > 0,
        "first hand sketch preview",
      );
      assert.match(firstPreview.alt, /first-sketch\.png/);

      await setFileInput(browser.page, secondFile);
      const secondPreview = await waitFor(
        () => browser.page.evaluate(`(() => {
          const image = document.querySelector('[data-testid="img-studio-sketch-preview-1"]');
          return {
            src: image?.getAttribute("src") ?? "",
            alt: image?.getAttribute("alt") ?? "",
            naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
          };
        })()`),
        (value) => Boolean(value.src) && value.naturalWidth > 0,
        "second hand sketch preview",
      );
      assert.match(secondPreview.alt, /latest-sketch\.png/);
      assert.ok(secondPreview.src.startsWith("blob:"));
      assert.notEqual(secondPreview.src, firstPreview.src);
      // Adding a second file must not disturb the already-shown first slot.
      const firstSlotAfterSecondUpload = await browser.page.evaluate(
        `document.querySelector('[data-testid="img-studio-sketch-preview-0"]')?.getAttribute("src") ?? ""`,
      );
      assert.equal(firstSlotAfterSecondUpload, firstPreview.src);
      assert.equal(await browser.page.evaluate(`window.__revokedSketchObjectUrls.includes(${JSON.stringify(firstPreview.src)})`), false);

      const mobileLayout = await browser.page.evaluate(`(() => {
        const slots = document.querySelector(".studio-sketch-slots");
        const filledSlot = slots?.querySelector(".studio-sketch-slot--filled");
        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          previewWidth: filledSlot?.querySelector("img")?.getBoundingClientRect().width ?? 0,
          slotWidth: filledSlot instanceof HTMLElement ? filledSlot.getBoundingClientRect().width : 0,
        };
      })()`);
      assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, "Hand sketch preview must not widen the mobile page");
      assert.ok(mobileLayout.previewWidth <= mobileLayout.slotWidth, "Hand sketch preview must stay inside its upload slot");

      // Removing the first slot must revoke only its own preview URL and
      // shift the remaining file into its place.
      await clickTestId(browser.page, "button-remove-studio-sketch-0");
      await waitFor(
        () => browser.page.evaluate(
          `document.querySelector('[data-testid="img-studio-sketch-preview-0"]')?.getAttribute("src") ?? ""`,
        ),
        (value) => value === secondPreview.src,
        "second file shifted into the first slot after removal",
      );
      assert.equal(await browser.page.evaluate(`window.__revokedSketchObjectUrls.includes(${JSON.stringify(firstPreview.src)})`), true);
      assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="img-studio-sketch-preview-1"]')`), null);

      await setTextInput(browser.page, "input-studio-name", "คุณทดสอบ");
      await setTextInput(browser.page, "input-studio-phone", "0812345678");
      await setTextInput(browser.page, "input-studio-project", "โครงการทดสอบ preview");
      await browser.page.evaluate(`(() => {
        window.fetch = async () => new Response(JSON.stringify({ message: "ส่งแบบร่างเรียบร้อยแล้ว" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })()`);
      await clickTestId(browser.page, "button-submit-sketch");
      await waitFor(
        () => browser.page.evaluate(`(() => ({
          preview: document.querySelector('[data-testid^="img-studio-sketch-preview-"]') !== null,
          fileCount: document.querySelector('[data-testid="input-studio-sketch"]') instanceof HTMLInputElement
            ? document.querySelector('[data-testid="input-studio-sketch"]').files?.length ?? 0
            : -1,
          revoked: window.__revokedSketchObjectUrls.includes(${JSON.stringify(secondPreview.src)}),
        }))()`),
        (value) => !value.preview && value.fileCount === 0 && value.revoked,
        "cleared hand sketch preview after submit",
      );
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("shows the Studio basin shortlist as a responsive two-or-three card grid", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "basin grid Studio order mode",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-basin-list"]\') !== null'),
      Boolean,
      "basin shortlist",
    );

    const readBasinGrid = () => browser.page.evaluate(`(() => {
      const list = document.querySelector(".studio-basin-list");
      const cards = [...document.querySelectorAll(".studio-basin-choice")];
      const art = document.querySelector(".studio-basin-choice-art");
      const columns = list instanceof HTMLElement
        ? getComputedStyle(list).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length
        : 0;
      return {
        columns,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        cardCount: cards.length,
        artWidth: art instanceof HTMLElement ? art.getBoundingClientRect().width : 0,
        artHeight: art instanceof HTMLElement ? art.getBoundingClientRect().height : 0,
      };
    })()`);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await readBasinGrid();
    assert.equal(mobile.columns, 2);
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, "The mobile basin shortlist must not widen the page");
    assert.ok(mobile.artWidth >= 100, `Mobile basin art is too narrow: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.artHeight >= 100, `Mobile basin art is too short: ${JSON.stringify(mobile)}`);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const desktop = await readBasinGrid();
    assert.equal(desktop.columns, 3, `Desktop basin grid is not three columns: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.bodyWidth <= desktop.viewportWidth, "The desktop basin shortlist must not widen the page");
    assert.ok(desktop.artWidth > 100);
    assert.ok(desktop.artHeight > 100);

    await clickTestId(browser.page, "button-studio-basin-KF001");
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await clickTestId(browser.page, "button-studio-basin-KF019");
    const selectedBeforeSearch = await browser.page.evaluate(`(() => ({
      selected: [...document.querySelectorAll(".studio-basin-choice.is-selected")].length,
      first: document.querySelector('[data-testid="button-studio-basin-KF001"]')?.getAttribute("aria-pressed") ?? "",
      second: document.querySelector('[data-testid="button-studio-basin-KF002"]')?.getAttribute("aria-pressed") ?? "",
      third: document.querySelector('[data-testid="button-studio-basin-KF019"]')?.getAttribute("aria-pressed") ?? "",
    }))()`);
    assert.equal(selectedBeforeSearch.selected, 2);
    assert.equal(selectedBeforeSearch.first, "true");
    assert.equal(selectedBeforeSearch.second, "true");
    assert.equal(selectedBeforeSearch.third, "false");

    await setTextInput(browser.page, "input-studio-basin-search", "KF002");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-basin-choice").length === 1'),
      Boolean,
      "filtered basin shortlist",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF002"]\')?.getAttribute("aria-pressed")'), "true");
  });

  it("shows Studio measurement guidance, swaps deep dimensions, and cleans phone input", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio helper order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "Studio helper canvas",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    const lengthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-length-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    assert.ok(lengthId);
    assert.equal(await browser.page.evaluate('document.body.textContent?.includes("หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร") ?? false'), true);
    assert.equal(await browser.page.evaluate('document.body.textContent?.includes("ติดบัว = ชิดผนังปูน / ขอบเปิด = โชว์ลอยในอากาศ") ?? false'), true);

    await setTextInput(browser.page, widthId, "1000");
    const swapId = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="button-swap-rectangle-dimensions-"]\')?.getAttribute("data-testid") ?? ""'),
      (value) => Boolean(value),
      "dimension swap suggestion",
    );
    await clickTestId(browser.page, swapId);
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="${widthId}"]')?.value ?? ""`), "600");
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="${lengthId}"]')?.value ?? ""`), "5000");

    await setTextInput(browser.page, "input-studio-phone", "081-234-5678");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-studio-phone"]\')?.value ?? ""'),
      (value) => value === "0812345678",
      "cleaned Studio phone",
    );
  });

  it("autosaves Studio drafts and resumes them from a self-contained link", async () => {
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
      "Studio order mode",
    );
    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1')");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "Studio draft toolbar",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    await setTextInput(browser.page, widthId, "2100");
    await clickTestId(browser.page, "button-studio-stone-SO423");
    await clickTestId(browser.page, "button-studio-active-stone-SO423");
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await waitFor(
      () => browser.page.evaluate(`(() => {
        const record = JSON.parse(localStorage.getItem("knight-studio-draft-v1") || "null");
        return record?.state?.activeStone === "SO423" && record?.state?.basinSkus?.includes("KF002") && record?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm === 2100;
      })()`),
      Boolean,
      "autosaved Studio state",
    );

    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode after draft save",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-draft-banner"]\') !== null'),
      Boolean,
      "Studio draft recovery banner",
    );
    assert.match(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-draft-banner"]\')?.textContent ?? ""'), /พบแบบร่างที่ทำค้างไว้เมื่อ/);
    await clickTestId(browser.page, "button-resume-studio-draft");
    const resumed = await waitFor(
      () => browser.page.evaluate(`(() => {
        const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
        return input instanceof HTMLInputElement ? input.value : "";
      })()`),
      (value) => value === "2250",
      "named draft card restore",
    );
    assert.equal(resumed.activeStone, true);
    assert.equal(resumed.basinSelected, true);
    assert.equal(resumed.width, "2100");
    assert.equal(resumed.banner, false);

    await browser.page.evaluate(`(() => {
      window.__draftLink = "";
      navigator.clipboard.writeText = async (value) => { window.__draftLink = value; };
    })()`);
    await clickTestId(browser.page, "button-save-studio-draft-link");
    const draftLink = await waitFor(
      () => browser.page.evaluate("window.__draftLink"),
      (value) => typeof value === "string" && value.includes("/studio?draft="),
      "copied Studio draft link",
    );
    assert.ok(draftLink.length > 100);
    assert.match(draftLink, /\/studio\?draft=[A-Za-z0-9_-]+$/);
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: draftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "linked Studio draft",
    );
    const linked = await browser.page.evaluate(`(() => ({
      activeStone: document.querySelector('[data-testid="button-studio-active-stone-SO423"]')?.classList.contains("is-active") ?? false,
      basinSelected: document.querySelector('[data-testid="button-studio-basin-KF002"]')?.classList.contains("is-selected") ?? false,
      width: (() => { const input = document.querySelector('[data-testid^="input-rectangle-width-"]'); return input instanceof HTMLInputElement ? input.value : ""; })(),
      banner: document.querySelector('[data-testid="studio-draft-banner"]') !== null,
    }))()`);
    assert.equal(linked.activeStone, true);
    assert.equal(linked.basinSelected, true);
    assert.equal(linked.width, "2100");
    assert.equal(linked.banner, false);
    const legacyDraftLink = draftLink;
    assert.match(legacyDraftLink, /\/studio\?draft=[A-Za-z0-9_-]+$/);
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: legacyDraftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "legacy linked Studio draft",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-active-stone-SO423"]\')?.classList.contains("is-active") ?? false'), true);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF002"]\')?.classList.contains("is-selected") ?? false'), true);
    assert.equal(await browser.page.evaluate(`(() => {
      const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
      return input instanceof HTMLInputElement ? input.value : "";
    })()`), "2100");
    await browser.page.evaluate("localStorage.clear()");
  });

  it("restores a named U-shaped draft and prints its three-panel geometry", async () => {
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
      "U-shaped Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "U-shaped Studio canvas",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");

    await clickTestId(browser.page, "button-studio-preset-u");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(\'[data-testid="studio-canvas"] .studio-piece-rectangle\').length'),
      (count) => count === 3,
      "U-shaped three-panel preset",
    );
    assert.deepEqual(
      await browser.page.evaluate(`([...document.querySelectorAll('[data-testid="studio-canvas"] .studio-piece-size')]).map((item) => item.textContent)`),
      ["1500 × 600", "600 × 1200", "600 × 1200"],
    );

    await clickTestId(browser.page, "button-studio-basin-KF001");
    await clickTestId(browser.page, "button-studio-basin-place-KF001");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(\'[data-testid="studio-canvas"] .studio-placement\').length'),
      (count) => count === 1,
      "basin on U-shaped Studio layout",
    );

    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "U-shaped draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "แบบร่างตัวยู");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    const saved = await waitFor(
      () => browser.page.evaluate(`(() => {
        const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
        const draft = drafts.find((item) => item.name === "แบบร่างตัวยู");
        if (!draft) return null;
        return {
          shape: draft.state.shape,
          dimensions: draft.state.dimensions,
          rectangles: draft.state.pieces?.[0]?.rectangles?.map(({ widthMm, lengthMm, xMm, yMm, rotation }) => ({ widthMm, lengthMm, xMm, yMm, rotation })) ?? [],
          basinPlacements: draft.state.basinPlacements?.map(({ sku, pieceId, xMm, yMm, widthMm, depthMm }) => ({ sku, pieceId, xMm, yMm, widthMm, depthMm })) ?? [],
        };
      })()`),
      (value) => value !== null,
      "saved U-shaped draft payload",
    );
    assert.equal(saved?.shape, "U");
    assert.deepEqual(saved?.dimensions, { depthMm: 600, runAMm: 1500, runBMm: 1200, runCMm: 1200 });
    assert.deepEqual(saved?.rectangles, [
      { widthMm: 1500, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 },
      { widthMm: 600, lengthMm: 1200, xMm: 0, yMm: 600, rotation: 0 },
      { widthMm: 600, lengthMm: 1200, xMm: 900, yMm: 600, rotation: 0 },
    ]);
    const savedBasin = saved?.basinPlacements[0];
    assert.ok(savedBasin);
    assert.match(savedBasin.pieceId, /^piece-/);
    assert.deepEqual({
      sku: savedBasin.sku,
      xMm: savedBasin.xMm,
      yMm: savedBasin.yMm,
      widthMm: savedBasin.widthMm,
      depthMm: savedBasin.depthMm,
    }, {
      sku: "KF001",
      xMm: 575,
      yMm: 50,
      widthMm: 350,
      depthMm: 500,
    });

    const draftCard = await waitFor(
      () => browser.page.evaluate(`(() => {
        const card = document.querySelector('[data-testid^="studio-saved-draft-"]');
        return {
          name: card?.querySelector(".studio-saved-draft-heading strong")?.textContent ?? "",
          previews: card?.querySelectorAll('[data-testid^="studio-draft-preview-"]').length ?? 0,
          openButton: card?.querySelector('[data-testid^="button-open-studio-draft-"]')?.getAttribute("data-testid") ?? "",
        };
      })()`),
      (value) => value.name === "แบบร่างตัวยู" && value.previews === 1 && Boolean(value.openButton),
      "saved U-shaped draft card",
    );
    await clickTestId(browser.page, draftCard.openButton);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') === null'),
      Boolean,
      "reopened U-shaped draft",
    );

    const restored = await waitFor(
      () => browser.page.evaluate(`(() => ({
        mainSizes: [...document.querySelectorAll('[data-testid="studio-canvas"] .studio-piece-size')].map((item) => item.textContent),
        printSizes: [...document.querySelectorAll('.studio-print-canvas .studio-piece-size')].map((item) => item.textContent),
        mainBasin: document.querySelector('[data-testid="studio-canvas"] .studio-placement')?.getAttribute("style") ?? "",
        mainBasinValid: document.querySelector('[data-testid="studio-canvas"] .studio-placement')?.classList.contains("studio-placement--invalid") === false,
      }))()`),
      (value) => {
        const left = Number.parseFloat(value.mainBasin.match(/left: ([0-9.]+)/)?.[1] ?? "NaN");
        const top = Number.parseFloat(value.mainBasin.match(/top: ([0-9.]+)/)?.[1] ?? "NaN");
        return value.mainSizes.length === 3 &&
          value.printSizes.length === 3 &&
          value.mainBasinValid &&
          Number.isFinite(left) &&
          Number.isFinite(top);
      },
      "restored U-shaped geometry",
    );
    assert.deepEqual(restored.mainSizes, ["1500 × 600", "600 × 1200", "600 × 1200"]);
    assert.deepEqual(restored.printSizes, ["1500 × 600", "600 × 1200", "600 × 1200"]);

    await browser.page.evaluate("window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true; }");
    await clickTestId(browser.page, "button-download-studio-pdf");
    assert.equal(await waitFor(
      () => browser.page.evaluate("window.__studioPrintCalled === true"),
      Boolean,
      "U-shaped Studio print action",
    ), true);
    assert.equal(await browser.page.evaluate("document.title"), "KF-Basins-studio-layout-1ชิ้น");
  });

  it("saves named Studio drafts in My Drafts and restores each card", async () => {
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
      "Studio order mode",
    );
    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1'); localStorage.removeItem('knight-studio-drafts-v1')");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-named-studio-draft"]\') !== null'),
      Boolean,
      "named Studio draft toolbar",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    await setTextInput(browser.page, widthId, "2250");
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="studio-placement-"]\') !== null'),
      Boolean,
      "basin placement on Studio canvas",
    );
    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "save named draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "ห้องน้ำชั้น 1");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "My Drafts drawer",
    );
    const card = await browser.page.evaluate(`(() => {
      const card = document.querySelector('[data-testid^="studio-saved-draft-"]');
      return {
        name: card?.querySelector(".studio-saved-draft-heading strong")?.textContent ?? "",
        summary: card?.querySelector(".studio-saved-draft-summary")?.textContent ?? "",
        preview: card?.querySelector('[data-testid^="studio-draft-preview-"]') !== null,
        placement: card?.querySelector('[data-testid^="studio-draft-placement-"]') !== null,
        count: document.querySelector('[data-testid="button-open-studio-drafts"]')?.textContent ?? "",
      };
    })()`);
    assert.equal(card.name, "ห้องน้ำชั้น 1");
    assert.match(card.summary, /m²/);
    assert.equal(card.preview, true);
    assert.equal(card.placement, true);
    assert.match(card.count, /แบบร่างของฉัน \(1\)/);

    await browser.page.evaluate(`(() => {
      window.__namedDraftLink = "";
      navigator.clipboard.writeText = async (value) => { window.__namedDraftLink = value; };
    })()`);
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-copy-studio-draft-\"]')?.click()");
    const namedDraftLink = await waitFor(
      () => browser.page.evaluate("window.__namedDraftLink"),
      (value) => typeof value === "string" && value.includes("/studio?draft="),
      "named draft card link",
    );
    assert.ok(namedDraftLink.length <= 100);
    assert.match(namedDraftLink, /\/studio\?draft=KB-[A-Z0-9]{6}$/);
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-open-studio-draft-\"]')?.click()");
    const resumed = await waitFor(
      () => browser.page.evaluate(`(() => {
        const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
        return input instanceof HTMLInputElement ? input.value : "";
      })()`),
      (value) => value === "2250",
      "named draft card restore",
    );
    assert.equal(resumed, "2250");

    await setTextInput(browser.page, widthId, "2350");
    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "update named draft dialog",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="input-studio-draft-name"]')?.value ?? ""`), "ห้องน้ำชั้น 1");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate(`(() => {
        const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
        return drafts.length === 1 && drafts[0]?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm === 2350;
      })()`),
      Boolean,
      "updated named draft without duplicate",
    );
    const updatedDraft = await browser.page.evaluate(`(() => {
      const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
      return { count: drafts.length, id: drafts[0]?.id ?? "", name: drafts[0]?.name ?? "", width: drafts[0]?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm ?? 0 };
    })()`);
    assert.equal(updatedDraft.count, 1);
    assert.equal(updatedDraft.name, "ห้องน้ำชั้น 1");
    assert.equal(updatedDraft.width, 2350);
    await clickTestId(browser.page, "button-close-studio-drafts");

    await clickTestId(browser.page, "button-open-studio-drafts");
    await browser.page.evaluate("window.confirm = () => true");
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-delete-studio-draft-\"]')?.click()");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\')?.textContent?.includes("ยังไม่มีแบบร่างที่ตั้งชื่อ") ?? false'),
      Boolean,
      "deleted named draft",
    );

    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1'); localStorage.removeItem('knight-studio-drafts-v1')");
    await browser.page.command("Page.navigate", { url: namedDraftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-named-studio-draft"]\') !== null'),
      Boolean,
      "named draft link",
    );
    const linkedWidth = await browser.page.evaluate(`(() => {
      const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
      return input instanceof HTMLInputElement ? input.value : "";
    })()`);
    const storedDraft = await waitFor(
      () => browser.page.evaluate('localStorage.getItem("knight-studio-draft-v1")'),
      (value) => Boolean(value),
      "Studio catalog context before named save",
    );
    const savedDraft = JSON.parse(storedDraft) as {
      state: { basinSkus: string[] };
      catalogContext: { revision: string; basinItems: Array<Record<string, unknown>> };
    };
    assert.ok(savedDraft.catalogContext);

    const removedSku = "KF999";
    const removedState = {
      ...savedDraft.state,
      basinSkus: [...savedDraft.state.basinSkus, removedSku],
    };
    const removedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-named-removal",
      basinItems: [
        ...savedDraft.catalogContext.basinItems,
        { sku: removedSku, colorName: "รุ่นที่ยกเลิกสำหรับแบบร่างที่ตั้งชื่อ" },
      ],
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "named draft removed basin notice",
    );
    await clickTestId(browser.page, `button-remove-hidden-studio-basin-${removedSku}`);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "named draft resolved catalog notice",
    );

    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "named catalog draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "แบบร่างที่ยืนยันแคตตาล็อกแล้ว");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "named catalog draft saved",
    );
    const namedDraftRecord = await browser.page.evaluate(`(() => {
      const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
      const draft = drafts[0];
      return {
        basinSkus: draft?.state?.basinSkus ?? [],
        savedCatalogSkus: draft?.catalogContext?.basinItems?.map((item) => item.sku) ?? [],
        resolvedSkus: draft?.catalogContext?.resolvedSkus ?? [],
      };
    })()`);
    assert.equal(namedDraftRecord.basinSkus.includes(removedSku), false);
    assert.equal(namedDraftRecord.savedCatalogSkus.includes(removedSku), true);
    assert.equal(namedDraftRecord.resolvedSkus.includes(removedSku), true);

    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-new-studio-draft"]\') !== null'),
      Boolean,
      "fresh Studio draft action",
    );
    await clickTestId(browser.page, "button-new-studio-draft");
    await clickTestId(browser.page, "button-open-studio-drafts");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "named catalog draft drawer after reopen",
    );
    await browser.page.evaluate('document.querySelector(\'[data-testid^="button-open-studio-draft-"]\')?.click()');
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "resolved catalog entry after named draft reopen",
    );
    const reopenedNotice = await browser.page.evaluate(`(() => ({
      resolved: document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]')?.textContent ?? "",
      activeWarning: document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') !== null ||
        document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null,
    }))()`);
    assert.match(reopenedNotice.resolved, new RegExp(removedSku));
    assert.equal(reopenedNotice.activeWarning, false);
    await browser.page.evaluate("localStorage.clear()");
  });

  it("keeps KnightSupport readable and above mobile floating controls", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-knight-support"]\') !== null'),
      Boolean,
      "KnightSupport trigger",
    );
    await clickTestId(browser.page, "button-knight-support");
    const support = await waitFor(
      () => browser.page.evaluate(`(() => {
        const panel = document.querySelector(".knight-support-panel");
        const input = document.querySelector(".knight-support-form input");
        const title = document.querySelector(".knight-support-head strong");
        const description = document.querySelector(".knight-support-head small");
        const support = document.querySelector(".knight-support");
        if (!(panel instanceof HTMLElement) || !(input instanceof HTMLInputElement) || !(support instanceof HTMLElement)) return null;
        const maxHeight = Number.parseFloat(getComputedStyle(panel).maxHeight);
        return {
          title: title?.textContent ?? "",
          description: description?.textContent ?? "",
          fontSize: getComputedStyle(input).fontSize,
          maxHeight,
          expectedMaxHeight: window.innerHeight - 80,
          zIndex: getComputedStyle(support).zIndex,
          panelWidth: panel.getBoundingClientRect().width,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      })()`),
      (value): value is { title: string; description: string; fontSize: string; maxHeight: number; expectedMaxHeight: number; zIndex: string; panelWidth: number; bodyWidth: number; viewportWidth: number } => value !== null,
      "KnightSupport panel",
    );
    assert.equal(support.title, "น้องไนท์ (ผู้ช่วยทีมขาย)");
    assert.equal(support.description, "ถามสินค้า ราคา หรือวิธีใช้งาน Knight Basins ได้เลยค่ะ");
    assert.equal(support.fontSize, "14px");
    assert.ok(support.maxHeight <= support.expectedMaxHeight + 1);
    assert.equal(support.zIndex, "100");
    assert.ok(support.panelWidth <= 351);
    assert.ok(support.bodyWidth <= support.viewportWidth);

    await clickTestId(browser.page, "button-reset-knight-support-position");
    const dragStart = await browser.page.evaluate(`(() => {
      const wrapper = document.querySelector(".knight-support");
      const head = document.querySelector(".knight-support-head");
      if (!(wrapper instanceof HTMLElement) || !(head instanceof HTMLElement)) return null;
      const rect = wrapper.getBoundingClientRect();
      const pointer = { bubbles: true, cancelable: true, clientX: rect.left + 40, clientY: rect.top + 20, pointerId: 7, pointerType: "touch", buttons: 1 };
      head.dispatchEvent(new PointerEvent("pointerdown", pointer));
      head.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: pointer.clientX - 90, clientY: pointer.clientY - 70 }));
      head.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: pointer.clientX - 90, clientY: pointer.clientY - 70, buttons: 0 }));
      return { left: rect.left, top: rect.top };
    })()`);
    assert.ok(dragStart);
    const draggedPosition = await waitFor(
      () => browser.page.evaluate(`(() => {
        const wrapper = document.querySelector(".knight-support");
        if (!(wrapper instanceof HTMLElement)) return null;
        const rect = wrapper.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      })()`),
      (value): value is { left: number; top: number } => value !== null && value.left < (dragStart?.left ?? 0) - 40 && value.top < (dragStart?.top ?? 0) - 20,
      "dragged KnightSupport position",
    );
    assert.ok(draggedPosition.left < (dragStart?.left ?? 0) - 40);
    assert.ok(draggedPosition.top < (dragStart?.top ?? 0) - 20);
    await clickTestId(browser.page, "button-reset-knight-support-position");
    await waitFor(
      () => browser.page.evaluate("localStorage.getItem('knight-support-position')"),
      (value) => value === null,
      "reset KnightSupport position",
    );
  });

  it("flows authenticated profile defaults into a quote and toggles the condo floor field", async () => {
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const realFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes("/api/auth/line/status")) {
            return new Response(JSON.stringify({ authenticated: true, displayName: "คุณโปรไฟล์" }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.includes("/api/customer/profile")) {
            return new Response(JSON.stringify({
              id: 7,
              lineUserId: "Uprofile",
              displayName: "คุณโปรไฟล์",
              fullName: "คุณโปรไฟล์",
              phone: "0812345678",
              email: "profile@example.com",
              company: "บริษัทโปรไฟล์ จำกัด",
              project: "โครงการจากโปรไฟล์",
              address: "99 ถนนสุขุมวิท กรุงเทพฯ",
              taxName: "บริษัทโปรไฟล์ จำกัด",
              taxId: "0105559012345",
              taxBranch: "สำนักงานใหญ่",
              taxAddress: "99 ถนนสุขุมวิท กรุงเทพฯ 10110",
              preferredContact: "line",
              customerRole: "homeowner",
              createdAt: "2026-09-15T00:00:00.000Z",
              updatedAt: "2026-09-15T00:00:00.000Z"
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.includes("/api/customer/quotes")) {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return realFetch(input, init);
        };
      })();`,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-quick-purchase"]\') !== null'),
      Boolean,
      "storefront before clearing browser state",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "catalog with authenticated profile",
    );
    await clickTestId(browser.page, "card-product-KF001");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-name"]\')?.value === "คุณโปรไฟล์"'),
      Boolean,
      "profile defaults in quote",
    );

    const profileDefaults = await browser.page.evaluate(`(() => ({
      name: document.querySelector('[data-testid="input-customer-name"]')?.value ?? "",
      phone: document.querySelector('[data-testid="input-customer-phone"]')?.value ?? "",
      project: document.querySelector('[data-testid="input-customer-project"]')?.value ?? "",
      taxAddress: document.querySelector('[data-testid="input-customer-tax-address"]')?.value ?? "",
      preferredContact: document.querySelector('[data-testid="input-customer-preferred-contact"]')?.value ?? "",
      role: document.querySelector('[data-testid="input-customer-role"]')?.value ?? "",
    }))()`);
    assert.deepEqual(profileDefaults, {
      name: "คุณโปรไฟล์",
      phone: "0812345678",
      project: "โครงการจากโปรไฟล์",
      taxAddress: "99 ถนนสุขุมวิท กรุงเทพฯ 10110",
      preferredContact: "line",
      role: "homeowner",
    });

    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-property-type"]\') !== null'),
      Boolean,
      "quote site fields",
    );
    await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="input-customer-property-type"]');
      if (!(select instanceof HTMLSelectElement)) return false;
      select.value = "condo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-condo-floor"]\') !== null'),
      Boolean,
      "condo floor field",
    );
    await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="input-customer-property-type"]');
      if (!(select instanceof HTMLSelectElement)) return false;
      select.value = "house-townhome";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-condo-floor"]\') === null'),
      Boolean,
      "condo floor field hidden for houses",
    );
  });

  it("defaults a custom Studio counter to the selected basin color until the customer chooses a stone", async () => {
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF001"]\') !== null'),
      Boolean,
      "Studio basin shortlist",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF001"]\') !== null'),
      Boolean,
      "fresh Studio basin shortlist",
    );

    await clickTestId(browser.page, "button-studio-basin-KF001");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-active-stone-VS311"]\')?.classList.contains("is-active") === true'),
      Boolean,
      "basin-matched default stone",
    );
    const basinMatched = await browser.page.evaluate(`(() => ({
      selected: document.querySelector('[data-testid="button-studio-stone-VS311"]')?.getAttribute("aria-pressed") === "true",
      active: document.querySelector('[data-testid="button-studio-active-stone-VS311"]')?.classList.contains("is-active") ?? false,
      estimateCode: document.querySelector(".studio-estimate-panel .studio-panel-heading > span")?.textContent ?? "",
    }))()`);
    assert.equal(basinMatched.selected, true);
    assert.equal(basinMatched.active, true);
    assert.equal(basinMatched.estimateCode, "VS311");

    await clickTestId(browser.page, "button-studio-stone-SO423");
    await clickTestId(browser.page, "button-studio-active-stone-SO423");
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-active-stone-SO423"]\')?.classList.contains("is-active") === true'),
      Boolean,
      "customer-selected stone after another basin",
    );
    assert.equal(
      await browser.page.evaluate('document.querySelector(\'.studio-estimate-panel .studio-panel-heading > span\')?.textContent ?? ""'),
      "SO423",
    );
  });
});
