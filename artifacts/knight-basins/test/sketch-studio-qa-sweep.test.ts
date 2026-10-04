import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");
const browserBaseUrl = (process.env.BROWSER_TEST_BASE_URL ?? "http://127.0.0.1:80").replace(/\/+$/, "");
const chromiumPath = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";

test("Sketch and Studio validate dimensions and prevent duplicate sketch actions", () => {
  assert.match(studioPageSource, /function parseBoundedIntegerInput\(value: string, min: number, max: number, step = 1\)/);
  // job-256: sketch sizes are validated per piece by sketch-order.ts (whole positive millimetres); the page only sends a request
  // when every piece has valid sizes and a stone, and only bridges to Studio when every size is valid.
  assert.match(studioPageSource, /const sketchSizesValid = resolvedSketchPieces\.every\(\(piece\) => piece\.sizeValid\);/);
  assert.match(studioPageSource, /const sketchOrderReady = resolvedSketchPieces\.length > 0 && resolvedSketchPieces\.every\(\(piece\) => sketchPieceReady\(piece, sketchOrderType\)\);/);
  assert.match(studioPageSource, /!sketchOrderReady\} onClick=\{\(\) => void primarySubmit\(\)\} data-testid="button-submit-sketch-lead"/);
  assert.match(studioPageSource, /!sketchSizesValid\} onClick=\{bridgeToStudio\}/);
  assert.match(studioPageSource, /Number\.isSafeInteger\(panel\.widthMm\)/);
  assert.match(studioPageSource, /Number\.isSafeInteger\(panel\.depthMm\)/);
  assert.match(studioPageSource, /disabled=\{submitting \|\| sketchStatus\?\.busy\}/);
  assert.match(studioPageSource, /if \(submissionInFlightRef\.current\) return;/);
  assert.match(studioPageSource, /if \(sketchStatus\?\.busy\) \{\s*setResult\("กรุณารอให้วิเคราะห์ภาพแบบร่างเสร็จก่อนส่ง"\)/);
});

test("Sketch-to-Studio bridge carries and reads shape, dimensions, stone, and basin", () => {
  for (const parameter of ["shape", "runAMm", "depthMm", "stoneColor", "basinSku"]) {
    assert.ok(studioPageSource.includes(`params.set("${parameter}"`), `bridge writes ${parameter}`);
  }
  assert.match(studioPageSource, /studioSearchParams\.get\("shape"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("runAMm"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("depthMm"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("stoneColor"\)/);
  assert.match(studioPageSource, /studioSearchParams\.get\("basinSku"\)/);
  assert.match(studioPageSource, /applyStudioShareParameters\(withRequestedBasin,\s*requestedStudioPreset,\s*requestedStudioWidthMm,\s*requestedStudioDepthMm\)/);
});

test("Studio holds estimate and exports until assembly and exposes all edge finishes", () => {
  assert.match(studioPageSource, /mode === "studio" && !studioLayoutApplied\s*\?\s*UNASSEMBLED_STUDIO_ESTIMATE\s*:\s*studioEstimate\(state, basinProducts\)/);
  assert.ok(studioPageSource.includes('data-testid="studio-estimate-not-ready"'));
  assert.ok(studioPageSource.includes('data-testid="status-studio-estimate-locked"'));
  assert.match(studioPageSource, /studioLayoutApplied && studioExportDimensionsValid\(state\)/);
  assert.ok(studioPageSource.includes('{ value: "closed-edge", label: "ขอบปิด ⊞" }'));
  assert.ok((studioPageSource.match(/<option value="closed-edge">ขอบปิด ⊞<\/option>/g) ?? []).length >= 2);
  assert.ok(studioPageSource.includes('data-testid="button-apply-custom-shape"'));
});

type CdpResponse = {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

class CdpPage {
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (value: CdpResponse) => void; reject: (error: Error) => void }>();
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (message.id === undefined) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chrome DevTools command failed"));
      else request.resolve(message);
    });
  }

  static async connect(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium DevTools")), { once: true });
    });
    return new CdpPage(socket);
  }

  command(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.nextId;
    return new Promise<CdpResponse>((resolve, reject) => {
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
    const result = response.result as { result?: { value?: T }; exceptionDetails?: { text?: string } } | undefined;
    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    return result?.result?.value as T;
  }

  close() {
    this.socket.close();
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(read: () => Promise<T>, predicate: (value: T) => boolean, label: string, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${JSON.stringify(lastValue)}`);
}

async function reserveLocalPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve a Chromium debugging port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopBrowser(page: CdpPage | null, browserProcess: ChildProcess, profileDirectory: string) {
  page?.close();
  if (browserProcess.exitCode === null && browserProcess.signalCode === null) browserProcess.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => browserProcess.once("exit", () => resolve())),
    delay(3_000),
  ]);
  rmSync(profileDirectory, { recursive: true, force: true });
}

test("Chromium checks Sketch and Studio mobile layout, estimate gating, validation, and closed-edge selection", {
  skip: !existsSync(chromiumPath),
  timeout: 120_000,
}, async () => {
  const port = await reserveLocalPort();
  const profileDirectory = mkdtempSync(join(tmpdir(), "sketch-studio-qa-"));
  const browserProcess = spawn(chromiumPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore" });
  let page: CdpPage | null = null;

  try {
    const webSocketUrl = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (!response.ok) return null;
        const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
        return targets.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? null;
      } catch {
        return null;
      }
    }, (value) => value !== null, "Chromium page target");
    if (!webSocketUrl) throw new Error("Chromium did not expose a page target");
    page = await CdpPage.connect(webSocketUrl);
    await page.command("Page.enable");
    await page.command("Runtime.enable");

    const openRoute = async (width: number, route: string) => {
      await page!.command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await page!.command("Page.navigate", { url: `${browserBaseUrl}${route}` });
      await waitFor(
        () => page!.evaluate<boolean>('document.querySelector(".studio-page") !== null'),
        Boolean,
        `${route} page at ${width}px`,
      );
      await waitFor(
        () => page!.evaluate<boolean>(route.startsWith("/sketch")
          ? 'document.querySelector(\'[data-testid="studio-sketch-flow"]\') !== null'
          : 'document.querySelector(\'[data-testid="button-apply-custom-shape"]\') !== null'),
        Boolean,
        `${route} content at ${width}px`,
      );
    };

    for (const width of [360, 375, 390, 414]) {
      for (const route of ["/sketch", "/studio"]) {
        await openRoute(width, route);
        const measurements = await page.evaluate<{
          viewport: number;
          documentWidth: number;
          bodyWidth: number;
          targets: Array<{ id: string; height: number }>;
        }>(`(() => {
          const ids = ["button-sketch-camera", "button-sketch-file", "button-submit-sketch-lead", "button-bridge-to-studio"];
          return {
            viewport: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body?.scrollWidth ?? 0,
            targets: ids.map((id) => {
              const element = document.querySelector('[data-testid="' + id + '"]');
              return { id, height: element?.getBoundingClientRect().height ?? 0 };
            }).filter((target) => target.height > 0),
          };
        })()`);
        assert.equal(measurements.viewport, width, `viewport should be ${width}px on ${route}`);
        assert.ok(measurements.documentWidth <= width, `${route} overflows document at ${width}px: ${measurements.documentWidth}`);
        assert.ok(measurements.bodyWidth <= width, `${route} overflows body at ${width}px: ${measurements.bodyWidth}`);
        if (route === "/sketch") {
          assert.ok(measurements.targets.length >= 4, "camera, file, submit, and bridge actions should be present");
          for (const target of measurements.targets) {
            assert.ok(target.height >= 44, `${target.id} is only ${target.height}px high at ${width}px`);
          }
        }
      }
    }

    await openRoute(390, "/studio?shape=i&runAMm=1970&depthMm=580");
    const initialEstimateState = await page.evaluate<{ locked: boolean; totalVisible: boolean }>(`(() => ({
      locked: document.querySelector('[data-testid="studio-estimate-not-ready"]') !== null,
      totalVisible: document.querySelector('[data-testid="studio-total-value"]') !== null,
    }))()`);
    assert.equal(initialEstimateState.locked, true, "Studio should request assembly before displaying a live estimate");
    assert.equal(initialEstimateState.totalVisible, false, "Studio total must stay hidden before assembly");

    const invalidSizeState = await page.evaluate<{ negativeDisabled: boolean; emptyDisabled: boolean; restoredEnabled: boolean }>(`(() => {
      const input = document.querySelector('[data-testid="input-piece-0-length"]');
      const button = document.querySelector('[data-testid="button-apply-custom-shape"]');
      if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
        return { negativeDisabled: false, emptyDisabled: false, restoredEnabled: false };
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      const change = (value) => {
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      change("-1");
      const negativeDisabled = button.disabled;
      change("");
      const emptyDisabled = button.disabled;
      change("1800");
      return { negativeDisabled, emptyDisabled, restoredEnabled: !button.disabled };
    })()`);
    assert.equal(invalidSizeState.negativeDisabled, true, "negative sheet dimensions must block assembly");
    assert.equal(invalidSizeState.emptyDisabled, true, "empty sheet dimensions must block assembly");
    assert.equal(invalidSizeState.restoredEnabled, true, "a valid dimension should re-enable assembly");

    const edgeSelectorExists = await page.evaluate<boolean>('document.querySelector(\'[data-testid="select-edge-0-top"]\') instanceof HTMLButtonElement');
    assert.equal(edgeSelectorExists, true, "the first exposed edge selector should be available");
    await page.evaluate('document.querySelector(\'[data-testid="select-edge-0-top"]\')?.click()');
    await waitFor(
      () => page!.evaluate<boolean>('[...document.querySelectorAll(".studio-edge-options button")].some((button) => button.textContent?.includes("ขอบปิด"))'),
      Boolean,
      "closed-edge option",
    );
    await page.evaluate('[...document.querySelectorAll(".studio-edge-options button")].find((button) => button.textContent?.includes("ขอบปิด"))?.click()');
    const closedEdgeSelected = await waitFor(
      () => page!.evaluate<boolean>('document.querySelector(\'[data-testid="select-edge-0-top"]\')?.getAttribute("aria-label")?.includes("ขอบปิด") ?? false'),
      Boolean,
      "closed-edge selection",
    );
    assert.equal(closedEdgeSelected, true, "closed-edge should be selectable in the custom shape editor");
    await page.evaluate('document.querySelector(\'[data-testid="button-apply-custom-shape"]\')?.click()');
    await waitFor(
      () => page!.evaluate<boolean>('document.querySelector(\'[data-testid="studio-total-value"]\') !== null'),
      Boolean,
      "Studio estimate after assembly",
    );
    await page.evaluate('document.querySelector(\'[data-testid="button-studio-mode-detailed"]\')?.click()');
    const closedEdgePersisted = await waitFor(
      () => page!.evaluate<boolean>('Array.from(document.querySelectorAll(".studio-side-status-grid select")).some((select) => select.value === "closed-edge")'),
      Boolean,
      "closed-edge in the assembled inspector",
    );
    assert.equal(closedEdgePersisted, true, "closed-edge should remain selected after assembly");
  } finally {
    await stopBrowser(page, browserProcess, profileDirectory);
  }
});