import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const adminPassword = process.env["ADMIN_PASSWORD"];
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
let uploadDirectory = "";
const managedUploadFilename =
  /^(?:catalog|sketch)-[a-z0-9]+-[a-f0-9]{16}\.(?:jpg|png|webp|gif|mp4|webm|mov)$/i;

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

async function startIsolatedApiServer(directory: string) {
  const port = await freePort();
  const apiProcess = spawn(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "dev"],
    {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        UPLOAD_DIR: directory,
        PUBLIC_UPLOAD_ORIGIN: "",
        CORS_ORIGINS: new URL(baseUrl).origin,
        ADMIN_PASSWORD: adminPassword ?? "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  apiProcess.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  apiProcess.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  const url = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (apiProcess.exitCode !== null) {
        throw new Error(`Isolated API server exited before becoming ready:\n${output}`);
      }
      try {
        const response = await fetch(`${url}/api/healthz`);
        if (response.ok) return { url, process: apiProcess };
      } catch {
        // The API build or startup is still in progress.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for the isolated API server:\n${output}`);
  } catch (error) {
    await stopIsolatedApiServer({ process: apiProcess });
    throw error;
  }
}

async function stopIsolatedApiServer(apiServer: {
  process: ChildProcess;
}) {
  const { process: apiProcess } = apiServer;
  if (apiProcess.exitCode === null && apiProcess.signalCode === null) {
    const exited = new Promise<void>((resolve) => {
      apiProcess.once("exit", () => resolve());
    });
    if (apiProcess.pid) {
      process.kill(-apiProcess.pid, "SIGTERM");
    } else {
      apiProcess.kill("SIGTERM");
    }
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
  if (apiProcess.exitCode === null && apiProcess.signalCode === null && apiProcess.pid) {
    process.kill(-apiProcess.pid, "SIGKILL");
  }
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

async function isolatedAdminCookie(apiUrl: string) {
  const response = await fetch(`${apiUrl}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: adminPassword }),
  });
  assert.equal(response.status, 200, "Could not authenticate with the isolated API server");
  const cookie = response.headers
    .get("set-cookie")
    ?.match(/(?:^|,\s*)knight_admin_session=([^;]+)/)?.[1];
  assert.ok(cookie, "The isolated API server did not return an admin session cookie");
  return `knight_admin_session=${cookie}`;
}

async function routeBrowserUploads(
  page: CdpPage,
  apiUrl: string,
  adminCookie: string,
) {
  page.on("Fetch.requestPaused", (params) => {
    const requestId = String(params["requestId"] ?? "");
    const request = params["request"] as {
      url?: string;
      headers?: Record<string, string>;
    } | undefined;
    if (!requestId || !request?.url) return;

    const requestPath = new URL(request.url).pathname;
    if (!requestPath.endsWith("/api/admin/upload")) {
      void page.command("Fetch.continueRequest", { requestId });
      return;
    }

    const headers = Object.entries(request.headers ?? {})
      .filter(([name]) => name.toLowerCase() !== "cookie")
      .map(([name, value]) => ({ name, value }));
    headers.push({ name: "Cookie", value: adminCookie });
    void page.command("Fetch.continueRequest", {
      requestId,
      url: `${apiUrl}/api/admin/upload`,
      headers,
    });
  });
  await page.command("Fetch.enable", {
    patterns: [{
      urlPattern: "*://*/api/admin/upload*",
      requestStage: "Request",
    }],
  });
}

async function listUploadFiles(directory = uploadDirectory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Set<string>();
    }
    throw error;
  }
}

async function removeGeneratedUploads(
  beforeTest: Set<string>,
  directory = uploadDirectory,
) {
  const afterTest = await listUploadFiles(directory);
  await Promise.all(
    [...afterTest]
      .filter(
        (filename) =>
          !beforeTest.has(filename) && managedUploadFilename.test(filename),
      )
      .map((filename) =>
        rm(path.join(directory, filename), { force: true }),
      ),
  );
}

describe("admin upload browser cleanup", () => {
  it("removes new managed image and video uploads without deleting pre-existing uploads", async () => {
    const isolatedUploadDirectory = await mkdtemp(
      path.join(os.tmpdir(), "knight-basins-upload-cleanup-"),
    );
    const existingFilename = "catalog-mu0existing-0123456789abcdef.png";
    const newImageFilename = "catalog-mu0newupload-fedcba9876543210.png";
    const newVideoFilename = "catalog-mu0newvideo-fedcba9876543210.mp4";
    const existingContents = Buffer.from("existing production upload");

    try {
      await writeFile(
        path.join(isolatedUploadDirectory, existingFilename),
        existingContents,
      );
      const uploadFilesBeforeTest = await listUploadFiles(
        isolatedUploadDirectory,
      );
      await writeFile(
        path.join(isolatedUploadDirectory, newImageFilename),
        "new upload",
      );
      await writeFile(
        path.join(isolatedUploadDirectory, newVideoFilename),
        "new video upload",
      );

      await removeGeneratedUploads(
        uploadFilesBeforeTest,
        isolatedUploadDirectory,
      );

      assert.deepEqual(
        await listUploadFiles(isolatedUploadDirectory),
        new Set([existingFilename]),
      );
      await assert.rejects(
        readFile(path.join(isolatedUploadDirectory, newImageFilename)),
        { code: "ENOENT" },
      );
      await assert.rejects(
        readFile(path.join(isolatedUploadDirectory, newVideoFilename)),
        { code: "ENOENT" },
      );
      assert.deepEqual(
        await readFile(path.join(isolatedUploadDirectory, existingFilename)),
        existingContents,
      );
    } finally {
      await rm(isolatedUploadDirectory, { force: true, recursive: true });
    }
  });
});

describe("admin image upload browser flow", () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;
  let apiServer: Awaited<ReturnType<typeof startIsolatedApiServer>>;
  let fixtureDirectory = "";
  let uploadFilesBeforeTest = new Set<string>();
  let uploadCleanupEnabled = false;
  const existingUploadFilename = "catalog-mu0existing-0123456789abcdef.png";
  const existingUploadContents = Buffer.from("existing upload seeded before the browser flow");

  before(async () => {
    if (!adminPassword) {
      throw new Error("ADMIN_PASSWORD is required for the browser upload test");
    }
    fixtureDirectory = await mkdtemp(
      path.join(os.tmpdir(), "knight-basins-upload-fixtures-"),
    );
    uploadDirectory = await mkdtemp(
      path.join(os.tmpdir(), "knight-basins-upload-api-"),
    );
    await writeFile(
      path.join(uploadDirectory, existingUploadFilename),
      existingUploadContents,
    );
    await writeFile(path.join(fixtureDirectory, "unsupported.txt"), "not an image");
    const supportedImage = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x03,
    ]);
    await writeFile(
      path.join(fixtureDirectory, "supported.png"),
      supportedImage,
    );
    uploadFilesBeforeTest = await listUploadFiles();
    uploadCleanupEnabled = true;
    apiServer = await startIsolatedApiServer(uploadDirectory);
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("DOM.enable");
    await browser.page.command("Network.enable");
    await routeBrowserUploads(
      browser.page,
      apiServer.url,
      await isolatedAdminCookie(apiServer.url),
    );
  });

  after(async () => {
    try {
      if (browser) await stopBrowser(browser);
    } finally {
      try {
        if (uploadCleanupEnabled) {
          await removeGeneratedUploads(uploadFilesBeforeTest);
          assert.deepEqual(
            await listUploadFiles(),
            new Set([existingUploadFilename]),
          );
          assert.deepEqual(
            await readFile(path.join(uploadDirectory, existingUploadFilename)),
            existingUploadContents,
          );
        }
      } finally {
        if (apiServer) await stopIsolatedApiServer(apiServer);
        if (uploadDirectory) {
          await rm(uploadDirectory, { force: true, recursive: true });
        }
        if (fixtureDirectory) {
          await rm(fixtureDirectory, { force: true, recursive: true });
        }
      }
    }
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
    const uploadedFilename = preview.src.match(
      /\/api\/uploads\/(catalog-[a-z0-9]+-[a-f0-9]{16}\.png)\?v=/,
    )?.[1];
    assert.ok(uploadedFilename);
    assert.deepEqual(
      await readFile(path.join(uploadDirectory, uploadedFilename)),
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0x03,
      ]),
    );
    assert.equal(
      (await listUploadFiles()).has(existingUploadFilename),
      true,
      "The pre-existing upload should remain beside the browser upload",
    );

    assert.equal(uploadRequests.length, 2);
    assert.deepEqual(uploadRequests.map((request) => request.status), [400, 201]);
    assert.ok(uploadRequests.every((request) => request.method === "POST"));
    assert.ok(uploadRequests.every((request) => request.contentType?.toLowerCase().startsWith("multipart/form-data;")));
  });

  it("guards round dimensions, tall-basin bowl_mm, and decorated prices in the basin form", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/admin/basins` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'input[type="password"]\') !== null || document.body?.innerText.includes("จัดการอ่างล้างหน้า") === true'),
      Boolean,
      "admin login form for field guards",
    );
    const needsLogin = await browser.page.evaluate('document.querySelector(\'input[type="password"]\') !== null');
    if (needsLogin) {
      await setTextInput(browser.page, 'input[type="password"]', adminPassword!);
      await clickButton(browser.page, "เข้าสู่ระบบ");
    }
    await waitFor(
      () => browser.page.evaluate('document.body?.innerText.includes("จัดการอ่างล้างหน้า") === true'),
      Boolean,
      "authenticated basin manager for field guards",
    );
    await clickButton(browser.page, "เพิ่มรายการใหม่");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-admin-basin-bowl"]\') !== null'),
      Boolean,
      "basin guard form",
    );

    await setTextInput(browser.page, '[data-testid="input-admin-basin-sku"]', "KF001");
    await setTextInput(browser.page, '[data-testid="input-admin-basin-bowl"]', "D350x150");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-admin-basin-bowl"]\')?.value ?? ""'),
      (value) => value === "Ø350x150",
      "normalized round bowl dimension",
    );
    await setTextInput(browser.page, '[data-testid="input-admin-basin-price"]', "฿1,000");
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="input-admin-basin-price"]\')?.value ?? ""'), "1000");

    await setTextInput(browser.page, '[data-testid="input-admin-basin-sku"]', "KF029");
    await waitFor(
      () => browser.page.evaluate(`(() => {
        const input = document.querySelector('[data-testid="input-admin-basin-bowl"]');
        return input instanceof HTMLInputElement && input.disabled && input.value === "";
      })()`),
      Boolean,
      "tall basin bowl guard",
    );
    assert.equal(await browser.page.evaluate('document.body.innerText.includes("KF029 / KF030 ต้องเก็บ bowl_mm เป็น null ตามแคตตาล็อก")'), true);
  });
});