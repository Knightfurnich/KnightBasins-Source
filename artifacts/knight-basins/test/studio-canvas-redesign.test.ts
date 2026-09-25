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
    if (result["exceptionDetails"]) {
      throw new Error(`Browser evaluation failed: ${JSON.stringify(result["exceptionDetails"])}`);
    }
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
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a Chromium debugging port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function launchBrowser() {
  const debuggingPort = await freePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-studio-redesign-"));
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
      // Chromium is starting.
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
  const deadline = Date.now() + 20_000;
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

describe("Studio canvas redesign interactions", { concurrency: false }, () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;

  before(async () => {
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-open-studio-stone-popover"]\') !== null'),
      Boolean,
      "Studio selector toolbar",
    );
  });

  after(async () => {
    if (browser) await stopBrowser(browser);
  });

  it("opens and closes both catalog popovers and closes after a selection", async () => {
    await clickTestId(browser.page, "button-open-studio-stone-popover");
    const stoneCount = await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-stone-popover-panel .studio-stone-choice").length'),
      (count) => count > 0,
      "stone catalog options",
    );
    assert.ok(stoneCount > 0, "the stone tray should show catalog colors");
    await clickTestId(browser.page, "button-open-studio-stone-popover");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-stone-popover"]\')?.hasAttribute("hidden")'), true);

    await clickTestId(browser.page, "button-open-studio-stone-popover");
    const firstStone = await browser.page.evaluate('document.querySelector(".studio-stone-popover-panel .studio-stone-choice")?.getAttribute("data-testid") ?? ""');
    assert.ok(firstStone, "the stone catalog should contain selectable colors");
    await clickTestId(browser.page, firstStone);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-stone-popover"]\')?.hasAttribute("hidden") === true'),
      Boolean,
      "stone tray closing after selection",
    );

    await clickTestId(browser.page, "button-open-studio-basin-popover");
    const basinCount = await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-basin-popover-panel .studio-basin-choice").length'),
      (count) => count > 0,
      "basin catalog options",
    );
    assert.ok(basinCount > 0, "the basin tray should show catalog models");
    await clickTestId(browser.page, "button-open-studio-basin-popover");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-basin-popover"]\')?.hasAttribute("hidden")'), true);

    await clickTestId(browser.page, "button-open-studio-basin-popover");
    const firstBasin = await browser.page.evaluate('document.querySelector(".studio-basin-popover-panel .studio-basin-choice-main")?.getAttribute("data-testid") ?? ""');
    assert.ok(firstBasin, "the basin catalog should contain selectable models");
    await clickTestId(browser.page, firstBasin);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-basin-popover"]\')?.hasAttribute("hidden") === true'),
      Boolean,
      "basin tray closing after selection",
    );
  });

  it("applies a dragged edge finish and clears it with the X control", async () => {
    const drag = await browser.page.evaluate(`(() => {
      const source = document.querySelector('[data-testid="button-studio-edge-status-wall-flush"]');
      const target = document.querySelector(".studio-edge-marker-action");
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLButtonElement)) return null;
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
      return {
        markerTestId: target.getAttribute("data-testid") ?? "",
        draggedStatus: dataTransfer.getData("application/x-studio-edge-status"),
      };
    })()`);
    assert.ok(drag?.markerTestId, "the canvas should expose draggable edge finish chips and edge targets");
    assert.equal(drag.draggedStatus, "wall-flush", "the toolbar should transfer the selected edge finish");
    const markerTestId = drag.markerTestId;
    const clearTestId = markerTestId.replace("studio-edge-marker-", "button-clear-studio-edge-");
    await waitFor(
      () => browser.page.evaluate(`document.querySelector(${JSON.stringify(`[data-testid="${markerTestId}"]`)})?.textContent?.includes("ชิดผนัง") ?? false`),
      Boolean,
      "the dropped edge finish",
    );
    await waitFor(
      () => browser.page.evaluate(`document.querySelector(${JSON.stringify(`[data-testid="${clearTestId}"]`)}) !== null`),
      Boolean,
      "the edge clear button",
    );
    await clickTestId(browser.page, clearTestId);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector(${JSON.stringify(`[data-testid="${clearTestId}"]`)}) === null`),
      Boolean,
      "edge status clearing",
    );
    const statusAfter = await browser.page.evaluate(`document.querySelector(${JSON.stringify(`[data-testid="${markerTestId}"]`)})?.getAttribute("aria-label") ?? ""`);
    assert.ok(statusAfter.includes("ปกติ"), "clearing an edge should restore its normal state");
  });
});