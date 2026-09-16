import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { inflateSync } from "node:zlib";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const adminPassword = process.env["ADMIN_PASSWORD"];
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const transparentPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const transparentBasinFixture =
  "data:image/svg+xml;base64," +
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100">
    <path fill="#2f8ca5" d="M13 31c2-7 10-11 19-11h36c12 0 26 6 32 15l7 12c3 6-1 12-8 13H24c-8 0-14-4-15-10z"/>
    <ellipse cx="54" cy="33" rx="25" ry="8" fill="#1d6170"/>
    <circle cx="54" cy="35" r="4" fill="#092f3b"/>
  </svg>`).toString("base64");

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
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-visual-"));
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
  const deadline = Date.now() + 20_000;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastValue)}`);
}

async function clickText(page: CdpPage, text: string) {
  const clicked = await page.evaluate(`(() => {
    const element = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(${JSON.stringify(text)}));
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click button containing "${text}"`);
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

type BasinVisualSnapshot = {
  hasImage: string;
  imageCount: number;
  loadedImageCount: number;
  mockupElementCount: number;
  shadow: { display: string; opacity: string; width: number };
  image: { objectFit: string; width: number; height: number; naturalWidth: number; naturalHeight: number } | null;
};

type DecodedPng = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

type PixelPoint = {
  x: number;
  y: number;
  rgb: [number, number, number];
};

type BasinPixelSnapshot = {
  width: number;
  height: number;
  fixturePixelCount: number;
  fixtureBounds: { left: number; top: number; right: number; bottom: number } | null;
  shadowPixelCount: number;
  transparentPoints: PixelPoint[];
};

type BasinPixelBaseline = {
  fixturePixelCount: { min: number; max: number };
  fixtureBounds: {
    left: { min: number; max: number };
    top: { min: number; max: number };
    right: { min: number; max: number };
    bottom: { min: number; max: number };
  };
  shadowPixelCount: { min: number; max: number };
  transparentPoints: Array<{ x: number; y: number; rgb: [number, number, number] }>;
};

function paethPredictor(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodePng(base64: string): DecodedPng {
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Chromium must return a PNG screenshot");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const compressed: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlaceMethod = data[12] ?? 0;
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  assert.equal(bitDepth, 8, "Visual baselines require 8-bit PNG screenshots");
  assert.ok(colorType === 2 || colorType === 6, "Visual baselines require RGB or RGBA PNG screenshots");
  assert.equal(interlaceMethod, 0, "Visual baselines require non-interlaced PNG screenshots");
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = width * bytesPerPixel;
  const decoded = inflateSync(Buffer.concat(compressed));
  const scanlines = new Uint8Array(width * height * bytesPerPixel);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = decoded[sourceOffset++];
    assert.ok(filter !== undefined, "PNG row is missing its filter byte");
    const rowOffset = y * rowLength;
    for (let x = 0; x < rowLength; x += 1) {
      const raw = decoded[sourceOffset++];
      assert.ok(raw !== undefined, "PNG row is shorter than expected");
      const left = x >= bytesPerPixel ? scanlines[rowOffset + x - bytesPerPixel] ?? 0 : 0;
      const above = y > 0 ? scanlines[rowOffset - rowLength + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? scanlines[rowOffset - rowLength + x - bytesPerPixel] ?? 0 : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 0xff;
      else if (filter === 2) value = (raw + above) & 0xff;
      else if (filter === 3) value = (raw + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) value = (raw + paethPredictor(left, above, upperLeft)) & 0xff;
      else assert.equal(filter, 0, `Unsupported PNG filter ${filter}`);
      scanlines[rowOffset + x] = value;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = scanlines[index * bytesPerPixel] ?? 0;
    pixels[index * 4 + 1] = scanlines[index * bytesPerPixel + 1] ?? 0;
    pixels[index * 4 + 2] = scanlines[index * bytesPerPixel + 2] ?? 0;
    pixels[index * 4 + 3] = colorType === 6 ? scanlines[index * bytesPerPixel + 3] ?? 0 : 255;
  }
  return { width, height, pixels };
}

function pixelAt(image: DecodedPng, x: number, y: number): [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.pixels[offset] ?? 0, image.pixels[offset + 1] ?? 0, image.pixels[offset + 2] ?? 0];
}

function colorDistance(rgb: [number, number, number], target: [number, number, number]) {
  return Math.sqrt(
    (rgb[0] - target[0]) ** 2 +
    (rgb[1] - target[1]) ** 2 +
    (rgb[2] - target[2]) ** 2,
  );
}

function summarizeBasinPixels(image: DecodedPng): BasinPixelSnapshot {
  const fixtureColor: [number, number, number] = [47, 140, 165];
  const fixtureCoordinates: Array<[number, number]> = [];
  let shadowPixelCount = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const rgb = pixelAt(image, x, y);
      if (colorDistance(rgb, fixtureColor) < 32) fixtureCoordinates.push([x, y]);
      if (
        y >= image.height * 0.82 &&
        x >= image.width * 0.18 &&
        x <= image.width * 0.82 &&
        rgb[0] < 235 &&
        rgb[1] < 245 &&
        rgb[2] < 250
      ) {
        shadowPixelCount += 1;
      }
    }
  }

  const fixtureBounds = fixtureCoordinates.length > 0 ? {
    left: Math.min(...fixtureCoordinates.map(([x]) => x)) / image.width,
    top: Math.min(...fixtureCoordinates.map(([, y]) => y)) / image.height,
    right: Math.max(...fixtureCoordinates.map(([x]) => x)) / image.width,
    bottom: Math.max(...fixtureCoordinates.map(([, y]) => y)) / image.height,
  } : null;
  const transparentLocations = [
    [0.08, 0.10],
    [0.50, 0.10],
    [0.92, 0.10],
    [0.08, 0.50],
    [0.92, 0.50],
    [0.08, 0.78],
    [0.50, 0.78],
    [0.92, 0.78],
  ] as const;

  return {
    width: image.width,
    height: image.height,
    fixturePixelCount: fixtureCoordinates.length,
    fixtureBounds,
    shadowPixelCount,
    transparentPoints: transparentLocations.map(([x, y]) => {
      const pixelX = Math.min(image.width - 1, Math.max(0, Math.round(image.width * x)));
      const pixelY = Math.min(image.height - 1, Math.max(0, Math.round(image.height * y)));
      return { x, y, rgb: pixelAt(image, pixelX, pixelY) };
    }),
  };
}

const pixelBaselines: Record<string, BasinPixelBaseline> = {
  storefront: {
    fixturePixelCount: { min: 2900, max: 3900 },
    fixtureBounds: {
      left: { min: 0.10, max: 0.18 },
      top: { min: 0.21, max: 0.30 },
      right: { min: 0.82, max: 0.90 },
      bottom: { min: 0.52, max: 0.63 },
    },
    shadowPixelCount: { min: 2000, max: 2600 },
    transparentPoints: [
      { x: 0.08, y: 0.10, rgb: [240, 249, 253] },
      { x: 0.50, y: 0.10, rgb: [236, 247, 252] },
      { x: 0.92, y: 0.10, rgb: [230, 244, 250] },
      { x: 0.08, y: 0.50, rgb: [233, 245, 250] },
      { x: 0.92, y: 0.50, rgb: [227, 242, 249] },
      { x: 0.08, y: 0.78, rgb: [229, 243, 250] },
      { x: 0.50, y: 0.78, rgb: [227, 242, 249] },
      { x: 0.92, y: 0.78, rgb: [225, 241, 248] },
    ],
  },
  quote: {
    fixturePixelCount: { min: 280, max: 390 },
    fixtureBounds: {
      left: { min: 0.22, max: 0.31 },
      top: { min: 0.23, max: 0.32 },
      right: { min: 0.66, max: 0.76 },
      bottom: { min: 0.45, max: 0.57 },
    },
    shadowPixelCount: { min: 130, max: 190 },
    transparentPoints: [
      { x: 0.08, y: 0.10, rgb: [246, 251, 254] },
      { x: 0.50, y: 0.10, rgb: [246, 251, 254] },
      { x: 0.92, y: 0.10, rgb: [246, 251, 254] },
      { x: 0.08, y: 0.50, rgb: [246, 251, 254] },
      { x: 0.92, y: 0.50, rgb: [246, 251, 254] },
      { x: 0.08, y: 0.78, rgb: [242, 247, 250] },
      { x: 0.50, y: 0.78, rgb: [231, 236, 240] },
      { x: 0.92, y: 0.78, rgb: [242, 247, 250] },
    ],
  },
  workbench: {
    fixturePixelCount: { min: 1300, max: 1700 },
    fixtureBounds: {
      left: { min: 0.29, max: 0.36 },
      top: { min: 0.15, max: 0.25 },
      right: { min: 0.89, max: 0.96 },
      bottom: { min: 0.76, max: 0.86 },
    },
    shadowPixelCount: { min: 2000, max: 2700 },
    transparentPoints: [
      { x: 0.08, y: 0.10, rgb: [223, 228, 223] },
      { x: 0.50, y: 0.10, rgb: [223, 228, 223] },
      { x: 0.92, y: 0.10, rgb: [223, 228, 223] },
      { x: 0.08, y: 0.50, rgb: [223, 228, 223] },
      { x: 0.92, y: 0.50, rgb: [223, 228, 223] },
      { x: 0.08, y: 0.78, rgb: [223, 228, 223] },
      { x: 0.50, y: 0.78, rgb: [220, 225, 220] },
      { x: 0.92, y: 0.78, rgb: [161, 130, 135] },
    ],
  },
};

function assertBasinPixelBaseline(snapshot: BasinPixelSnapshot, baseline: BasinPixelBaseline, label: string) {
  assert.ok(snapshot.fixturePixelCount >= baseline.fixturePixelCount.min, `${label} image silhouette is missing`);
  assert.ok(snapshot.fixturePixelCount <= baseline.fixturePixelCount.max, `${label} image silhouette changed too much`);
  assert.ok(snapshot.shadowPixelCount >= baseline.shadowPixelCount.min, `${label} base shadow is missing`);
  assert.ok(snapshot.shadowPixelCount <= baseline.shadowPixelCount.max, `${label} base shadow changed too much`);
  assert.ok(snapshot.fixtureBounds, `${label} image silhouette has no visible bounds`);
  for (const key of ["left", "top", "right", "bottom"] as const) {
    const value = snapshot.fixtureBounds?.[key] ?? 0;
    assert.ok(value >= baseline.fixtureBounds[key].min && value <= baseline.fixtureBounds[key].max, `${label} image ${key} edge moved`);
  }
  assert.equal(snapshot.transparentPoints.length, baseline.transparentPoints.length);
  for (const [index, point] of snapshot.transparentPoints.entries()) {
    const expected = baseline.transparentPoints[index];
    if (!expected) continue;
    assert.ok(colorDistance(point.rgb, expected.rgb) <= 18, `${label} transparent pixel ${index} changed; a CSS mockup layer may be visible`);
  }
}

async function captureBasinPixels(page: CdpPage, selector: string) {
  const clip = await page.evaluate<{ x: number; y: number; width: number; height: number } | null>(`(() => {
    const visual = document.querySelector(${JSON.stringify(selector)});
    if (!(visual instanceof HTMLElement)) return null;
    const rect = visual.getBoundingClientRect();
    return { x: rect.x, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  })()`);
  assert.ok(clip && clip.width > 0 && clip.height > 0, `Could not capture ${selector}`);
  const result = await page.command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { ...clip, scale: 1 },
  });
  const data = result["data"];
  assert.equal(typeof data, "string", `Chromium did not return a screenshot for ${selector}`);
  const image = decodePng(data as string);
  const coloredPixelCount = Array.from({ length: image.width * image.height }, (_, index) => index)
    .filter((index) => {
      const red = image.pixels[index * 4] ?? 0;
      const green = image.pixels[index * 4 + 1] ?? 0;
      const blue = image.pixels[index * 4 + 2] ?? 0;
      return red < 220 || green < 220 || blue < 220;
    }).length;
  assert.ok(coloredPixelCount > 0, `${selector} screenshot must contain rendered pixels`);
  return summarizeBasinPixels(image);
}

async function applyTransparentBasinFixture(page: CdpPage, selector: string) {
  await waitFor(
    () => page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`),
    (count) => count > 0,
    `basin image elements for ${selector}`,
  );
  const changed = await page.evaluate(`(() => {
    const images = [...document.querySelectorAll(${JSON.stringify(selector)})];
    for (const image of images) image.setAttribute("src", ${JSON.stringify(transparentBasinFixture)});
    return images.length;
  })()`);
  assert.ok(Number(changed) > 0, `Could not install the transparent basin fixture for ${selector}`);
  await waitFor(
    () => page.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].every((image) => image.complete && image.naturalWidth > 0)`),
    Boolean,
    `transparent basin fixture for ${selector}`,
  );
  await page.evaluate(`Promise.all([...document.querySelectorAll(${JSON.stringify(selector)})].map((image) => image.decode?.().catch(() => undefined)))`);
}

async function readVisuals(page: CdpPage, selector: string) {
  return page.evaluate<BasinVisualSnapshot[]>(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((visual) => {
    const image = visual.querySelector("img.basin-image");
    const shadow = visual.querySelector(".basin-shadow");
    const imageStyle = image instanceof HTMLElement ? getComputedStyle(image) : null;
    const imageRect = image?.getBoundingClientRect();
    const shadowStyle = shadow instanceof HTMLElement ? getComputedStyle(shadow) : null;
    const shadowRect = shadow?.getBoundingClientRect();
    return {
      hasImage: visual.getAttribute("data-has-image") ?? "",
      imageCount: visual.querySelectorAll("img.basin-image").length,
      loadedImageCount: image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 ? 1 : 0,
      mockupElementCount: visual.querySelectorAll(".basin-body, .basin-bowl, .basin-drain, .basin-stem").length,
      shadow: {
        display: shadowStyle?.display ?? "",
        opacity: shadowStyle?.opacity ?? "",
        width: shadowRect?.width ?? 0,
      },
      image: image instanceof HTMLImageElement && imageStyle && imageRect ? {
        objectFit: imageStyle.objectFit,
        width: imageRect.width,
        height: imageRect.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      } : null,
    };
  })`);
}

function assertLoadedImageVisuals(visuals: BasinVisualSnapshot[], label: string) {
  assert.ok(visuals.length > 0, `${label} should render basin visuals`);
  assert.ok(visuals.some((visual) => visual.loadedImageCount === 1), `${label} should load at least one real image`);
  for (const visual of visuals) {
    assert.equal(visual.hasImage, "true", `${label} should use the real image layer`);
    assert.equal(visual.imageCount, 1, `${label} should render one basin image`);
    assert.equal(visual.mockupElementCount, 0, `${label} must not render CSS basin elements behind the image`);
    assert.equal(visual.image?.objectFit, "contain", `${label} image must preserve its proportions`);
    assert.ok((visual.image?.width ?? 0) > 0 && (visual.image?.height ?? 0) > 0, `${label} image must have a visible box`);
    assert.equal(visual.shadow.display, "block", `${label} must retain the base shadow`);
    assert.ok(Number(visual.shadow.opacity) > 0 && visual.shadow.width > 0, `${label} shadow must remain visible`);
  }
}

describe("transparent basin image visual regression", { concurrency: false }, () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;

  before(async () => {
    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
  });

  after(async () => {
    if (browser) await stopBrowser(browser);
  });

  it("keeps real basin images clean across storefront cards and quote rows", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate("document.readyState"),
      (state) => state !== "loading",
      "storefront document",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear(); location.reload()");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".product-card .basin-visual").length'),
      (count) => count === 30,
      "all storefront basin cards",
    );
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".product-card img.basin-image").length'),
      (count) => count === 30,
      "remote storefront basin images",
    );
    await browser.page.evaluate('document.querySelector(".product-grid")?.scrollIntoView({ block: "start" })');
    await waitFor(
      () => browser.page.evaluate('[...document.querySelectorAll(".product-card img.basin-image")].filter((image) => image.complete && image.naturalWidth > 0).length'),
      (count) => count > 0,
      "visible storefront basin images",
    );

    const storefrontVisuals = await readVisuals(browser.page, ".product-card .basin-visual");
    assertLoadedImageVisuals(storefrontVisuals, "storefront cards");
    await applyTransparentBasinFixture(browser.page, ".product-card img.basin-image");
    const storefrontPixels = await captureBasinPixels(browser.page, ".product-card .basin-visual");
    assertBasinPixelBaseline(storefrontPixels, pixelBaselines.storefront, "storefront cards");

    for (const sku of ["KF001", "KF029"]) await clickTestId(browser.page, `card-product-${sku}`);
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".quote-line .basin-visual").length'),
      (count) => count === 2,
      "selected quote rows",
    );
    await browser.page.evaluate('document.querySelector(".quote-line")?.scrollIntoView({ block: "center" })');
    await applyTransparentBasinFixture(browser.page, ".quote-line img.basin-image");
    const quoteVisuals = await readVisuals(browser.page, ".quote-line .basin-visual");
    assertLoadedImageVisuals(quoteVisuals, "quote rows");
    const quotePixels = await captureBasinPixels(browser.page, ".quote-line .basin-visual");
    assertBasinPixelBaseline(quotePixels, pixelBaselines.quote, "quote rows");

    const transparentState = await browser.page.evaluate(`(() => {
      const images = [...document.querySelectorAll(".quote-line img.basin-image")];
      for (const image of images) image.setAttribute("src", ${JSON.stringify(transparentPng)});
      return images.length;
    })()`);
    assert.equal(transparentState, 2);
    await waitFor(
      () => browser.page.evaluate('[...document.querySelectorAll(".quote-line img.basin-image")].every((image) => image.complete && image.naturalWidth === 1 && image.naturalHeight === 1)'),
      Boolean,
      "transparent quote PNGs",
    );
    assertLoadedImageVisuals(await readVisuals(browser.page, ".quote-line .basin-visual"), "transparent quote rows");
  });

  it("falls back to the CSS basin when an image fails", async () => {
    const result = await browser.page.evaluate(`(() => {
      const image = document.querySelector(".quote-line img.basin-image");
      if (!(image instanceof HTMLImageElement)) return false;
      image.dispatchEvent(new Event("error", { bubbles: false }));
      return true;
    })()`);
    assert.equal(result, true);
    const fallback = await waitFor(
      () => readVisuals(browser.page, ".quote-line .basin-visual"),
      (visuals) => visuals.some((visual) => visual.hasImage === "false"),
      "failed image fallback",
    );
    const failed = fallback.find((visual) => visual.hasImage === "false");
    assert.ok(failed);
    assert.equal(failed?.mockupElementCount, 3, "failed images must restore the body, bowl, and drain CSS visual");
    assert.equal(failed?.shadow.display, "block");
  });

  it("keeps Workbench favourite-basin cards on the same image layer", async () => {
    assert.ok(adminPassword, "ADMIN_PASSWORD is required for the Workbench visual regression");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/?workbench=1` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'input[type="password"]\') !== null || document.querySelector(".owner-workbench") !== null'),
      Boolean,
      "Workbench authentication",
    );
    const needsLogin = await browser.page.evaluate('document.querySelector(\'input[type="password"]\') !== null');
    if (needsLogin) {
      const changed = await browser.page.evaluate(`(() => {
        const input = document.querySelector('input[type="password"]');
        if (!(input instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, ${JSON.stringify(adminPassword)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      assert.equal(changed, true);
      await clickText(browser.page, "เข้าสู่ระบบ");
    }
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".top-basin-art .basin-visual").length'),
      (count) => count === 3,
      "Workbench favourite basins",
    );
    await waitFor(
      () => browser.page.evaluate('[...document.querySelectorAll(".top-basin-art img.basin-image")].every((image) => image.complete && image.naturalWidth > 0)'),
      Boolean,
      "Workbench basin images",
    );
    assertLoadedImageVisuals(await readVisuals(browser.page, ".top-basin-art .basin-visual"), "Workbench favourite cards");
    await applyTransparentBasinFixture(browser.page, ".top-basin-art img.basin-image");
    const workbenchPixels = await captureBasinPixels(browser.page, ".top-basin-art .basin-visual");
    assertBasinPixelBaseline(workbenchPixels, pixelBaselines.workbench, "Workbench favourite cards");
  });
});