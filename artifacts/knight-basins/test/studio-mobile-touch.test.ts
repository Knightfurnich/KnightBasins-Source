import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const studioCss = readFile(new URL("../src/index.css", import.meta.url), "utf8");

function extractBlock(source: string, marker: string) {
  const start = source.lastIndexOf(marker);
  assert.notEqual(start, -1, `Missing CSS block: ${marker}`);

  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1, `Missing opening brace for ${marker}`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openBrace + 1, index);
  }
  assert.fail(`Unclosed CSS block: ${marker}`);
}

test("mobile Studio edge controls define comfortable touch targets", async () => {
  const css = await studioCss;
  const mobileStyles = extractBlock(css, "@media (max-width: 480px)");

  assert.match(mobileStyles, /\.studio-edge-select\s*\{[^}]*min-height:\s*42px/s);
  assert.match(mobileStyles, /\.studio-edge-options\s+button\s*\{[^}]*min-height:\s*40px/s);
  assert.match(mobileStyles, /\.studio-custom-shape-actions\s+\.button\s*\{[^}]*min-height:\s*48px/s);
});

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

async function getFreePort() {
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
  const debuggingPort = await getFreePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-studio-touch-"));
  const browserProcess = spawn(chromiumPath, [
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
    browserProcess.kill("SIGTERM");
    await rm(profileDirectory, { force: true, recursive: true });
    throw new Error("Chromium did not expose a debugging page");
  }

  return { page: await CdpPage.connect(webSocketUrl), browserProcess, profileDirectory };
}

async function stopBrowser(browser: {
  page: CdpPage;
  browserProcess: ChildProcess;
  profileDirectory: string;
}) {
  browser.page.close();
  if (browser.browserProcess.exitCode === null && browser.browserProcess.signalCode === null) {
    browser.browserProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => browser.browserProcess.once("exit", () => resolve()));
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

async function openDetailedStudio(page: CdpPage, width: number) {
  await page.command("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await page.command("Page.navigate", { url: `${baseUrl}/studio` });
  await waitFor(
    () => page.evaluate("document.querySelector('.studio-page') !== null"),
    Boolean,
    "Studio page",
  );

  await page.evaluate(`(() => {
    const button = document.querySelector('[data-testid="button-studio-mode-detailed"]');
    if (button instanceof HTMLButtonElement) button.click();
  })()`);
  await waitFor(
    () => page.evaluate("document.querySelectorAll('.studio-edge-select').length"),
    (count) => count > 0,
    "custom shape edge controls",
  );
}

test("Studio has no horizontal overflow at 360px and 390px and keeps desktop edge layout", {
  skip: !existsSync(chromiumPath) && "Chromium is required for Studio viewport checks",
}, async () => {
  const browser = await launchBrowser();
  try {
    const { page } = browser;

    for (const width of [360, 390]) {
      await openDetailedStudio(page, width);
      const opened = await page.evaluate(`(() => {
        const edge = [...document.querySelectorAll('.studio-edge-select')]
          .find((button) => button instanceof HTMLButtonElement && !button.disabled);
        if (!(edge instanceof HTMLButtonElement)) return false;
        edge.scrollIntoView({ block: 'center' });
        edge.click();
        return true;
      })()`);
      assert.equal(opened, true, `No enabled edge selector at ${width}px`);

      await waitFor(
        () => page.evaluate("document.querySelectorAll('.studio-edge-options button').length"),
        (count) => count > 0,
        `edge options at ${width}px`,
      );
      const snapshot = await page.evaluate(`(() => {
        const edge = [...document.querySelectorAll('.studio-edge-select')]
          .find((button) => button instanceof HTMLButtonElement && !button.disabled);
        const options = [...document.querySelectorAll('.studio-edge-options button')];
        const action = document.querySelector('[data-testid="button-apply-custom-shape"]');
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          edgeHeight: edge?.getBoundingClientRect().height ?? 0,
          optionHeights: options.map((button) => button.getBoundingClientRect().height),
          actionHeight: action?.getBoundingClientRect().height ?? 0,
        };
      })()`);

      assert.equal(snapshot.viewportWidth, width);
      assert.ok(snapshot.documentWidth <= width, `Document overflows at ${width}px: ${JSON.stringify(snapshot)}`);
      assert.ok(snapshot.bodyWidth <= width, `Body overflows at ${width}px: ${JSON.stringify(snapshot)}`);
      assert.ok(snapshot.edgeHeight >= 42, `Edge selector is too short at ${width}px: ${JSON.stringify(snapshot)}`);
      assert.ok(snapshot.optionHeights.length > 0);
      assert.ok(snapshot.optionHeights.every((height) => height >= 40), `Edge option is too short at ${width}px: ${JSON.stringify(snapshot)}`);
      assert.ok(snapshot.actionHeight >= 48, `Apply action is too short at ${width}px: ${JSON.stringify(snapshot)}`);
    }

    await openDetailedStudio(page, 1024);
    const desktop = await page.evaluate(`(() => {
      const row = document.querySelector('.studio-piece-edge-row');
      const edge = document.querySelector('.studio-edge-select');
      return {
        viewportWidth: window.innerWidth,
        columns: row ? getComputedStyle(row).gridTemplateColumns.split(' ').length : 0,
        edgeMinHeight: edge ? getComputedStyle(edge).minHeight : null,
      };
    })()`);
    assert.equal(desktop.viewportWidth, 1024);
    assert.equal(desktop.columns, 2, `Desktop edge layout changed: ${JSON.stringify(desktop)}`);
    assert.equal(desktop.edgeMinHeight, "38px", `Desktop touch sizing changed: ${JSON.stringify(desktop)}`);
  } finally {
    await stopBrowser(browser);
  }
});