import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const adminPassword = process.env["ADMIN_PASSWORD"];
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";

type CdpEvent = {
  method: string;
  params: Record<string, unknown>;
};

class CdpPage {
  private readonly socket: WebSocket;
  private nextCommandId = 0;
  private readonly pending = new Map<number, {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
  }>();
  private readonly eventListeners = new Map<string, Array<(params: Record<string, unknown>) => void>>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: Record<string, unknown>;
        error?: { message?: string };
        method?: string;
        params?: Record<string, unknown>;
      };

      if (message.id !== undefined) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) {
          request.reject(new Error(message.error.message ?? "Chrome DevTools command failed"));
        } else {
          request.resolve(message.result ?? {});
        }
        return;
      }

      if (message.method) {
        for (const listener of this.eventListeners.get(message.method) ?? []) {
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
    const listeners = this.eventListeners.get(method) ?? [];
    listeners.push(listener);
    this.eventListeners.set(method, listeners);
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
    const remoteObject = result["result"] as { value?: T } | undefined;
    return remoteObject?.value as T;
  }

  async close() {
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

async function clickButton(page: CdpPage, text: string) {
  const clicked = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      item.textContent?.includes(${JSON.stringify(text)})
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not find button containing "${text}"`);
}

async function setTextInput(page: CdpPage, selector: string, value: string) {
  const changed = await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not find input ${selector}`);
}

async function setFileInput(page: CdpPage, filePath: string) {
  const documentResult = await page.command("DOM.getDocument");
  const root = documentResult["root"] as { nodeId: number };
  const queryResult = await page.command("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: 'input[type="file"]',
  });
  const nodeId = queryResult["nodeId"] as number;
  assert.ok(nodeId, "Could not find the image file input");
  await page.command("DOM.setFileInputFiles", { nodeId, files: [filePath] });
}

async function launchBrowser() {
  const debuggingPort = await freePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-browser-"));
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

  return {
    page: await CdpPage.connect(webSocketUrl),
    process,
    profileDirectory,
  };
}

async function stopBrowser(browser: {
  page: CdpPage;
  process: ChildProcess;
  profileDirectory: string;
}) {
  await browser.page.close();
  if (browser.process.exitCode === null && browser.process.signalCode === null) {
    const exited = new Promise<void>((resolve) => {
      browser.process.once("exit", () => resolve());
    });
    browser.process.kill("SIGTERM");
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
  if (browser.process.exitCode === null && browser.process.signalCode === null) {
    browser.process.kill("SIGKILL");
  }
  await rm(browser.profileDirectory, {
    force: true,
    recursive: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

describe("admin image upload browser flow", () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;
  let fixtureDirectory = "";

  before(async () => {
    if (!adminPassword) throw new Error("ADMIN_PASSWORD is required for the browser upload test");
    fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-upload-fixtures-"));
    await writeFile(path.join(fixtureDirectory, "unsupported.txt"), "not an image");
    await writeFile(path.join(fixtureDirectory, "supported.png"), "browser png fixture");
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("DOM.enable");
    await browser.page.command("Network.enable");
  });

  after(async () => {
    if (browser) await stopBrowser(browser);
    if (fixtureDirectory) await rm(fixtureDirectory, { force: true, recursive: true });
  });

  it("logs in through the admin UI, shows validation errors, and previews the saved upload URL", async () => {
    const uploadRequests: Array<{ method?: string; contentType?: string; status?: number }> = [];
    browser.page.on("Network.requestWillBeSent", (params) => {
      const request = params["request"] as { url?: string; method?: string; headers?: Record<string, string> } | undefined;
      if (!request?.url?.endsWith("/api/admin/upload")) return;
      uploadRequests.push({
        method: request.method,
        contentType: Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === "content-type")?.[1],
      });
    });
    browser.page.on("Network.responseReceived", (params) => {
      const response = params["response"] as { url?: string; status?: number } | undefined;
      if (!response?.url?.endsWith("/api/admin/upload")) return;
      const request = uploadRequests[uploadRequests.length - 1];
      if (request) request.status = response.status;
    });

    await browser.page.command("Page.navigate", { url: `${baseUrl}/admin/basins` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'input[type="password"]\') !== null'),
      Boolean,
      "admin login form",
    );
    await setTextInput(browser.page, 'input[type="password"]', adminPassword!);
    await clickButton(browser.page, "เข้าสู่ระบบ");
    await waitFor(
      () => browser.page.evaluate('document.body.innerText.includes("จัดการอ่างล้างหน้า")'),
      Boolean,
      "authenticated basin manager",
    );

    await clickButton(browser.page, "เพิ่มรายการใหม่");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'input[type="file"]\') !== null'),
      Boolean,
      "image upload field",
    );

    await setFileInput(browser.page, path.join(fixtureDirectory, "unsupported.txt"));
    await waitFor(
      () => browser.page.evaluate('document.body.innerText.includes("Only JPG, PNG, WEBP, and GIF images are allowed")'),
      Boolean,
      "unsupported file validation error",
    );

    await setFileInput(browser.page, path.join(fixtureDirectory, "supported.png"));
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'img[alt="ตัวอย่างรูปภาพสินค้า"]\')?.getAttribute("src")?.includes("/api/uploads/") ?? false'),
      Boolean,
      "uploaded URL preview",
    );

    const preview = await browser.page.evaluate(`(() => {
      const image = document.querySelector('img[alt="ตัวอย่างรูปภาพสินค้า"]');
      return {
        src: image?.getAttribute("src") ?? "",
        text: document.body.innerText,
      };
    })()`);
    assert.match(preview.src, /\/api\/uploads\/catalog-[a-z0-9]+-[a-f0-9]{16}\.png\?v=[a-z0-9]+$/);
    assert.match(preview.text, /\/api\/uploads\/catalog-/);

    assert.equal(uploadRequests.length, 2);
    assert.deepEqual(uploadRequests.map((request) => request.status), [400, 201]);
    assert.ok(uploadRequests.every((request) => request.method === "POST"));
    assert.ok(uploadRequests.every((request) => request.contentType?.toLowerCase().startsWith("multipart/form-data;")));
  });
});