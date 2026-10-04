import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const widgetSource = readFileSync(
  process.env["OPS_ASSISTANT_WIDGET_SOURCE"] ??
    join(testDirectory, "../src/admin/OpsAssistantWidget.tsx"),
  "utf8",
);
const adminAppSource = readFileSync(
  join(testDirectory, "../src/admin/AdminApp.tsx"),
  "utf8",
);
const browserBaseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const evidenceDirectory = process.env["OPS_ASSISTANT_EVIDENCE_DIR"];

const DASHBOARD_RESPONSE = {
  period: "30d",
  kpis: { totalRevenueThb: 0, totalLeads: 0, readyForProduction: 0, closed: 0 },
  actionItems: { unassignedSlipsCount: 0, awaitingContactCount: 0 },
  pipelineRatio: { usCount: 0, ofCount: 0, otherCount: 0 },
  upcomingInstallations: [],
  popularItems: [],
  popularStones: [],
  popularBasins: [],
  recentActivities: [],
  monthlyComparison: [],
  projectedCashInflowThb: 0,
  technicianCapacity: [],
  asOf: "2026-10-04T00:00:00.000Z",
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
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params ?? {});
        }
      }
    });
  }

  static async connect(webSocketUrl: string) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
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
  if (!address || typeof address === "string") throw new Error("Could not reserve a Chromium port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
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
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}; last observed value: ${JSON.stringify(lastValue).slice(0, 600)}`);
}

async function sendMouseEvent(
  page: CdpPage,
  type: "mousePressed" | "mouseMoved" | "mouseReleased",
  x: number,
  y: number,
) {
  await page.command("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? "none" : "left",
    buttons: type === "mousePressed" || type === "mouseMoved" ? 1 : 0,
    clickCount: type === "mousePressed" ? 1 : 0,
  });
}

async function sendKey(page: CdpPage, key: string, shiftKey = false) {
  const code = key.startsWith("Arrow") ? key : key === "Enter" ? "Enter" : key;
  const windowsVirtualKeyCode =
    key === "Enter" ? 13 : key === "ArrowLeft" ? 37 : key === "ArrowUp" ? 38 :
      key === "ArrowRight" ? 39 : key === "ArrowDown" ? 40 : undefined;
  await page.command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    shiftKey,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
  await page.command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    shiftKey,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
}

describe("admin operations assistant widget", () => {
  it("provides the floating entry point, chat panel, and three accessible modes", () => {
    assert.match(widgetSource, /data-testid="button-open-ops-assistant"/);
    assert.match(widgetSource, /data-testid="panel-ops-assistant"/);
    assert.match(widgetSource, /testId: "assistant-mode-dashboard"/);
    assert.match(widgetSource, /testId: "assistant-mode-leads"/);
    assert.match(widgetSource, /testId: "assistant-mode-calendar"/);
    assert.match(widgetSource, /aria-pressed=\{mode === option\.id\}/);
  });

  it("limits questions to 500 characters and posts the selected mode", () => {
    assert.match(widgetSource, /data-testid="input-ops-assistant-question"/);
    assert.match(widgetSource, /maxLength=\{500\}/);
    assert.match(widgetSource, /data-testid="button-ask-ops-assistant"/);
    assert.match(widgetSource, /disabled=\{!question\.trim\(\) \|\| isLoading\}/);
    assert.match(widgetSource, /fetch\("\/api\/admin\/assistant\/ask"/);
    assert.match(widgetSource, /JSON\.stringify\(\{ question: cleanQuestion, mode: selectedMode \}\)/);
  });

  it("shows message history, loading feedback, and a safe unavailable message", () => {
    assert.match(widgetSource, /data-testid="list-assistant-messages"/);
    assert.match(widgetSource, /data-testid="assistant-loading"/);
    assert.match(widgetSource, /data-testid="assistant-unavailable"/);
    assert.match(widgetSource, /ผู้ช่วย AI ยังไม่พร้อมให้บริการ/);
    assert.match(widgetSource, /payload\.ok !== true/);
  });

  it("includes suggested questions, the disclaimer, and the LINE escalation link", () => {
    assert.match(widgetSource, /data-testid="assistant-suggestions"/);
    assert.match(widgetSource, /งานติดตั้งในเดือนนี้มีกี่งาน/);
    assert.match(widgetSource, /data-testid="assistant-disclaimer"/);
    assert.match(widgetSource, /คำตอบของ AI ใช้เป็นข้อมูลประกอบ ควรตรวจสอบกับข้อมูลจริงอีกครั้ง/);
    assert.match(widgetSource, /data-testid="button-assistant-escalate"/);
    assert.match(widgetSource, /line\.me\/R\/ti\/p\/@789gcnhq/);
  });

  it("supports pointer dragging from the header without adding a page-blocking overlay", () => {
    assert.match(widgetSource, /data-testid="header-ops-assistant"/);
    assert.match(widgetSource, /beginInteraction\("move", event\)/);
    assert.match(widgetSource, /setPointerCapture\(event\.pointerId\)/);
    assert.match(widgetSource, /touch-action: none/);
    assert.doesNotMatch(widgetSource, /data-testid="ops-assistant-overlay"/);
  });

  it("supports two-axis resizing and keeps the widget inside viewport limits", () => {
    assert.match(widgetSource, /data-testid="button-resize-ops-assistant"/);
    assert.match(widgetSource, /beginInteraction\("resize", event\)/);
    assert.match(widgetSource, /width: geometry\.width/);
    assert.match(widgetSource, /height: isCollapsed \? "auto" : geometry\.height/);
    assert.match(widgetSource, /OPS_ASSISTANT_MIN_WIDTH = 280/);
    assert.match(widgetSource, /OPS_ASSISTANT_MIN_HEIGHT = 320/);
    assert.match(widgetSource, /OPS_ASSISTANT_MAX_WIDTH = 840/);
    assert.match(widgetSource, /OPS_ASSISTANT_MAX_HEIGHT = 900/);
    assert.match(widgetSource, /window\.addEventListener\("resize", clampToViewport\)/);
    assert.match(widgetSource, /clampWidgetGeometry\(/);
  });

  it("persists position and dimensions and exposes Thai keyboard and collapse controls", () => {
    assert.match(widgetSource, /OPS_ASSISTANT_GEOMETRY_STORAGE_KEY/);
    assert.match(widgetSource, /localStorage\.getItem\(OPS_ASSISTANT_GEOMETRY_STORAGE_KEY\)/);
    assert.match(widgetSource, /localStorage\.setItem\(OPS_ASSISTANT_GEOMETRY_STORAGE_KEY/);
    assert.match(widgetSource, /data-testid="button-collapse-ops-assistant"/);
    assert.match(widgetSource, /data-testid="button-reset-ops-assistant"/);
    assert.match(widgetSource, /aria-expanded=\{!isCollapsed\}/);
    assert.match(widgetSource, /aria-label="แถบหัวผู้ช่วย AI/);
    assert.match(widgetSource, /aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown/);
    assert.match(widgetSource, /คืนตำแหน่งและขนาดเริ่มต้นของผู้ช่วย AI/);
  });

  it("renders the widget only after the unauthenticated login guard", () => {
    assert.match(
      adminAppSource,
      /if \(!session\?\.authenticated\) \{\s*return <AdminLogin \/>;\s*\}[\s\S]*?<OpsAssistantWidget \/>/,
    );
    assert.match(adminAppSource, /import \{ OpsAssistantWidget \} from "\.\/OpsAssistantWidget";/);
  });

  it("drags, resizes, persists, collapses, clamps, and leaves uncovered admin navigation clickable", {
    timeout: 90_000,
  }, async (testContext) => {
    if (!existsSync(chromiumPath)) {
      testContext.skip(`Chromium not found at ${chromiumPath}`);
      return;
    }

    let browser: ChildProcess | undefined;
    let browserProfile: string | undefined;
    let page: CdpPage | undefined;
    let mockError: Error | undefined;
    try {
      const port = await reserveChromiumPort();
      browserProfile = mkdtempSync(join(os.tmpdir(), "knight-ops-assistant-chrome-"));
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
      const webSocketUrl = await waitForBrowserValue(
        async () => {
          const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
          if (!response?.ok) return null;
          const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
          return targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl)
            ?.webSocketDebuggerUrl ?? null;
        },
        (target) => Boolean(target),
        "Chromium did not start",
      );
      page = await CdpPage.connect(webSocketUrl);
      await page.command("Page.enable");
      await page.command("Runtime.enable");
      await page.command("Fetch.enable", {
        patterns: [
          { urlPattern: "*://*/api/admin/session*" },
          { urlPattern: "*://*/api/admin/dashboard-stats*" },
        ],
      });
      const activePage = page;
      activePage.on("Fetch.requestPaused", (params) => {
        const requestId = params["requestId"];
        if (typeof requestId !== "string") return;
        const request = params["request"] as { url?: string } | undefined;
        const pathname = request?.url ? new URL(request.url).pathname : "";
        let body: unknown;
        if (pathname.startsWith("/api/admin/session")) {
          body = {
            authenticated: true,
            access: {
              role: "owner",
              permissions: ["basins", "installed-stones", "sheet-stones", "leads"],
              canEdit: true,
              canDelete: true,
              canManageTeam: true,
            },
            member: { displayName: "QA" },
          };
        } else if (pathname === "/api/admin/dashboard-stats") {
          body = DASHBOARD_RESPONSE;
        }
        if (body === undefined) {
          void activePage.command("Fetch.continueRequest", { requestId }).catch((error: unknown) => {
            mockError = error instanceof Error ? error : new Error("Could not continue browser request");
          });
          return;
        }
        void activePage.command("Fetch.fulfillRequest", {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
          body: Buffer.from(JSON.stringify(body)).toString("base64"),
        }).catch((error: unknown) => {
          mockError = error instanceof Error ? error : new Error("Could not mock admin data");
        });
      });
      await activePage.command("Page.setDeviceMetricsOverride", {
        width: 1440,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await activePage.command("Page.navigate", { url: new URL("/admin", browserBaseUrl).toString() });
      await waitForBrowserValue(
        () => activePage.evaluate<boolean>(
          `Boolean(document.querySelector('[data-testid="button-open-ops-assistant"]'))`,
        ),
        Boolean,
        "Admin page did not render",
      );
      await activePage.evaluate<boolean>(
        `document.querySelector('[data-testid="button-open-ops-assistant"]').click(); true`,
      );
      await waitForBrowserValue(
        () => activePage.evaluate<boolean>(
          `Boolean(document.querySelector('[data-testid="panel-ops-assistant"]'))`,
        ),
        Boolean,
        "Assistant panel did not open",
      );

      const initial = await activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
        `(()=>{const r=document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
      );
      const dragStart = await activePage.evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector('[data-testid="header-ops-assistant"]').getBoundingClientRect();return {x:r.left+120,y:r.top+r.height/2}})()`,
      );
      const dragTarget = {
        x: dragStart.x + 24 - initial.left,
        y: dragStart.y + 300 - initial.top,
      };
      await sendMouseEvent(activePage, "mousePressed", dragStart.x, dragStart.y);
      await sendMouseEvent(activePage, "mouseMoved", dragTarget.x, dragTarget.y);
      await sendMouseEvent(activePage, "mouseReleased", dragTarget.x, dragTarget.y);
      const dragged = await waitForBrowserValue(
        () => activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
          `(()=>{const r=document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
        ),
        (value) => Math.abs(value.left - 24) < 2 && Math.abs(value.top - 300) < 2,
        "Panel did not move to the requested position",
      );

      const capture = async (name: string) => {
        if (!evidenceDirectory) return;
        mkdirSync(evidenceDirectory, { recursive: true });
        const result = await activePage.command("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        const encoded = result["data"];
        assert.equal(typeof encoded, "string", "Chromium did not return screenshot data");
        writeFileSync(join(evidenceDirectory, name), Buffer.from(encoded as string, "base64"));
      };
      await capture("after-drag.png");

      const navPoint = await activePage.evaluate<{ x: number; y: number; hit: string | null }>(
        `(()=>{const n=document.querySelector('[data-testid="nav-admin-basins"]');const r=n.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.closest('[data-testid]')?.getAttribute('data-testid')??null}})()`,
      );
      assert.equal(navPoint.hit, "nav-admin-basins", "The widget must not cover the tested navigation button");
      await sendMouseEvent(activePage, "mousePressed", navPoint.x, navPoint.y);
      await sendMouseEvent(activePage, "mouseReleased", navPoint.x, navPoint.y);
      await waitForBrowserValue(
        () => activePage.evaluate<string>("location.pathname"),
        (pathname) => pathname === "/admin/basins",
        "Uncovered background navigation did not respond to a real pointer click",
      );
      await capture("before-resize.png");

      const resizeStart = await activePage.evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector('[data-testid="button-resize-ops-assistant"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
      );
      await sendMouseEvent(activePage, "mousePressed", resizeStart.x, resizeStart.y);
      await sendMouseEvent(activePage, "mouseMoved", resizeStart.x + 144, resizeStart.y + 88);
      await sendMouseEvent(activePage, "mouseReleased", resizeStart.x + 144, resizeStart.y + 88);
      const resized = await waitForBrowserValue(
        () => activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
          `(()=>{const r=document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
        ),
        (value) => value.width > dragged.width + 100 && value.height > dragged.height + 50,
        "Panel did not resize in both dimensions",
      );
      assert.ok(resized.width <= 840 && resized.height <= 900);
      await capture("after-resize.png");

      const savedBeforeReload = resized;
      await activePage.command("Page.navigate", { url: new URL("/admin/basins", browserBaseUrl).toString() });
      await waitForBrowserValue(
        () => activePage.evaluate<boolean>(
          `Boolean(document.querySelector('[data-testid="button-open-ops-assistant"]'))`,
        ),
        Boolean,
        "Admin page did not reload",
      );
      await activePage.evaluate<boolean>(
        `document.querySelector('[data-testid="button-open-ops-assistant"]').click(); true`,
      );
      const restored = await waitForBrowserValue(
        () => activePage.evaluate<{ left: number; top: number; width: number; height: number } | null>(
          `(()=>{const e=document.querySelector('[data-testid="panel-ops-assistant"]');if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
        ),
        Boolean,
        "Assistant panel did not reopen after reload",
      );
      for (const dimension of ["left", "top", "width", "height"] as const) {
        assert.ok(
          Math.abs(restored[dimension] - savedBeforeReload[dimension]) < 2,
          `${dimension} was not restored after reload`,
        );
      }

      await activePage.evaluate(
        `document.querySelector('[data-testid="header-ops-assistant"]').focus()`,
      );
      const beforeKeyboardMove = restored.left;
      await sendKey(activePage, "ArrowRight");
      const afterKeyboardMove = await activePage.evaluate<number>(
        `document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect().left`,
      );
      assert.equal(afterKeyboardMove, beforeKeyboardMove + 16, "Arrow keys should move the focused header");
      await activePage.evaluate(
        `document.querySelector('[data-testid="button-resize-ops-assistant"]').focus()`,
      );
      const beforeKeyboardResize = await activePage.evaluate<number>(
        `document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect().width`,
      );
      await sendKey(activePage, "ArrowRight");
      const afterKeyboardResize = await activePage.evaluate<number>(
        `document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect().width`,
      );
      assert.equal(afterKeyboardResize, beforeKeyboardResize + 24, "Arrow keys should resize the focused handle");

      await activePage.command("Page.setDeviceMetricsOverride", {
        width: 360,
        height: 300,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const clamped = await waitForBrowserValue(
        () => activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
          `(()=>{const r=document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
        ),
        (value) => value.width <= 336 && value.height <= 276 && value.left >= 0 && value.top >= 0,
        "Panel did not clamp inside a smaller viewport",
      );
      assert.ok(clamped.left + clamped.width <= 360 && clamped.top + clamped.height <= 300);

      await activePage.command("Page.setDeviceMetricsOverride", {
        width: 1440,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const expectedReset = await activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
        `(()=>{const w=window.innerWidth,h=window.innerHeight,width=Math.max(1,Math.min(400,w-24)),height=Math.max(1,Math.min(640,h-24));return {left:Math.min(w-width-12,Math.max(12,w-width-22)),top:Math.min(h-height-12,Math.max(12,h-height-86)),width,height}})()`,
      );
      await activePage.evaluate(
        `document.querySelector('[data-testid="button-reset-ops-assistant"]').click()`,
      );
      await waitForBrowserValue(
        () => activePage.evaluate<{ left: number; top: number; width: number; height: number }>(
          `(()=>{const r=document.querySelector('[data-testid="panel-ops-assistant"]').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`,
        ),
        (value) => Object.keys(expectedReset).every(
          (dimension) => Math.abs(
            value[dimension as keyof typeof value] - expectedReset[dimension as keyof typeof expectedReset],
          ) < 2,
        ),
        "Reset control did not restore the default position and size",
      );
      await activePage.evaluate(
        `document.querySelector('[data-testid="button-collapse-ops-assistant"]').click()`,
      );
      await waitForBrowserValue(
        () => activePage.evaluate<boolean>(
          `document.querySelector('[data-testid="button-collapse-ops-assistant"]')?.getAttribute('aria-expanded') === 'false'`,
        ),
        Boolean,
        "Collapse control did not hide the assistant body",
      );
      await capture("after-collapse.png");

      if (mockError) throw mockError;
    } finally {
      page?.close();
      if (browser?.pid && browser.exitCode === null) {
        try {
          process.kill(-browser.pid, "SIGTERM");
        } catch {
          browser.kill("SIGTERM");
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (browser.exitCode === null) {
          try {
            process.kill(-browser.pid, "SIGKILL");
          } catch {
            browser.kill("SIGKILL");
          }
        }
      }
      if (browserProfile) {
        try {
          rmSync(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {
          // A Chromium child process may still be flushing files as it exits.
        }
      }
    }
  });
});