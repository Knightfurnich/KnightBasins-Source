import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const baseUrl = process.env["BROWSER_TEST_BASE_URL"] ?? "http://127.0.0.1:80";
const adminPassword = process.env["ADMIN_PASSWORD"];
const chromiumPath = process.env["CHROMIUM_BIN"] ?? "/repl/tools/bin/chromium";
const apiServerPackage = new URL("../../api-server/package.json", import.meta.url);
const requireFromApiServer = createRequire(apiServerPackage);

type FixturePool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

type PgModule = {
  Pool: new (options: { connectionString?: string }) => FixturePool;
};

const { Pool } = requireFromApiServer("pg") as PgModule;

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
        if (message.error) request.reject(new Error(message.error.message ?? "Chrome DevTools command failed"));
        else request.resolve(message.result ?? {});
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

async function startIsolatedApiServer(uploadDirectory: string) {
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
        UPLOAD_DIR: uploadDirectory,
        PUBLIC_UPLOAD_ORIGIN: "",
        CORS_ORIGINS: new URL(baseUrl).origin,
        ADMIN_PASSWORD: adminPassword ?? "",
        ADMIN_ROLE: "owner",
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

async function stopIsolatedApiServer(apiServer: { process: ChildProcess }) {
  const { process: apiProcess } = apiServer;
  if (apiProcess.exitCode === null && apiProcess.signalCode === null) {
    const exited = new Promise<void>((resolve) => apiProcess.once("exit", () => resolve()));
    if (apiProcess.pid) process.kill(-apiProcess.pid, "SIGTERM");
    else apiProcess.kill("SIGTERM");
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  }
  if (apiProcess.exitCode === null && apiProcess.signalCode === null && apiProcess.pid) {
    process.kill(-apiProcess.pid, "SIGKILL");
  }
}

async function launchBrowser() {
  const debuggingPort = await freePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-dispatch-browser-"));
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
  return { page: await CdpPage.connect(webSocketUrl), process: browserProcess, profileDirectory };
}

async function stopBrowser(browser: Awaited<ReturnType<typeof launchBrowser>>) {
  await browser.page.close();
  if (browser.process.exitCode === null && browser.process.signalCode === null) {
    const exited = new Promise<void>((resolve) => browser.process.once("exit", () => resolve()));
    browser.process.kill("SIGTERM");
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  }
  if (browser.process.exitCode === null && browser.process.signalCode === null) {
    browser.process.kill("SIGKILL");
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
    const element = document.querySelector('[data-testid="${testId}"]');
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not find [data-testid="${testId}"]`);
}

async function setInput(page: CdpPage, testId: string, value: string) {
  const changed = await page.evaluate(`(() => {
    const input = document.querySelector('[data-testid="${testId}"]');
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not find input [data-testid="${testId}"]`);
}

async function setSelect(page: CdpPage, testId: string, value: string) {
  const changed = await page.evaluate(`(() => {
    const select = document.querySelector('[data-testid="${testId}"]');
    if (!(select instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not find select [data-testid="${testId}"]`);
}

async function waitForElement(page: CdpPage, selector: string, label: string) {
  return waitFor(
    () => page.evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`),
    Boolean,
    label,
  );
}

function teamCode() {
  const letters = [...randomBytes(6)].map((value) => String.fromCharCode(65 + value % 26)).join("");
  return `KT${letters}`;
}

function monthAndDateKeys() {
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = todayParts.find((part) => part.type === "year")!.value;
  const month = todayParts.find((part) => part.type === "month")!.value;
  return {
    month: `${year}-${month}`,
    first: `${year}-${month}-07`,
    second: `${year}-${month}-08`,
    rescheduled: `${year}-${month}-09`,
  };
}

describe("authenticated dispatch persistence browser flow", () => {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;
  let apiServer: Awaited<ReturnType<typeof startIsolatedApiServer>>;
  let pool: FixturePool;
  let uploadDirectory = "";
  let adminCookie = "";
  let proxyError: string | null = null;
  let rosterOverride: { status: number; body: string } | null = null;
  let rosterDelayMs = 0;
  const firstTeamCode = teamCode();
  const secondTeamCode = teamCode();
  const fixtureToken = randomBytes(10).toString("hex");
  const leadKeys = [`dispatch-browser-a-${fixtureToken}`, `dispatch-browser-b-${fixtureToken}`];
  let leadIds: number[] = [];
  const dateKeys = monthAndDateKeys();

  before(async () => {
    if (!adminPassword || !existsSync(chromiumPath)) return;
    if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL is required for dispatch browser fixtures");

    pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    await pool.query("SELECT 1 FROM technician_teams LIMIT 1");
    await pool.query("SELECT 1 FROM customer_leads LIMIT 1");

    uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-dispatch-api-"));
    apiServer = await startIsolatedApiServer(uploadDirectory);
    const sessionResponse = await fetch(`${apiServer.url}/api/admin/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    assert.equal(sessionResponse.status, 200, "Could not authenticate with the dispatch API server");
    adminCookie = sessionResponse.headers.get("set-cookie")
      ?.match(/(?:^|,\s*)knight_admin_session=([^;]+)/)?.[1] ?? "";
    assert.ok(adminCookie, "The dispatch API server did not return an admin session cookie");

    browser = await launchBrowser();
    await browser.page.command("Runtime.enable");
    await browser.page.command("Page.enable");
    await browser.page.command("Network.enable");
    browser.page.on("Fetch.requestPaused", (params) => {
      const requestId = String(params["requestId"] ?? "");
      const request = params["request"] as { url?: string; method?: string; headers?: Record<string, string> } | undefined;
      if (!requestId || !request?.url) return;
      void (async () => {
        try {
          const url = new URL(request.url!);
          if (!url.pathname.startsWith("/api/")) {
            await browser.page.command("Fetch.continueRequest", { requestId });
            return;
          }
          if (url.pathname === "/api/admin/technician-teams" && request.method === "GET") {
            if (rosterDelayMs > 0) {
              const delay = rosterDelayMs;
              rosterDelayMs = 0;
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else if (rosterOverride) {
              const body = Buffer.from(rosterOverride.body).toString("base64");
              await browser.page.command("Fetch.fulfillRequest", {
                requestId,
                responseCode: rosterOverride.status,
                responseHeaders: [{ name: "content-type", value: "application/json" }],
                body,
              });
              return;
            }
          }
          const headers = Object.entries(request.headers ?? {})
            .filter(([name]) => name.toLowerCase() !== "cookie")
            .map(([name, value]) => ({ name, value }));
          headers.push({ name: "Cookie", value: `knight_admin_session=${adminCookie}` });
          await browser.page.command("Fetch.continueRequest", {
            requestId,
            url: `${apiServer.url}${url.pathname}${url.search}`,
            headers,
          });
        } catch (error) {
          proxyError = error instanceof Error ? error.message : String(error);
          await browser.page.command("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => undefined);
        }
      })();
    });
    await browser.page.command("Fetch.enable", {
      patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }],
    });
  });

  after(async () => {
    try {
      if (browser) await stopBrowser(browser);
    } finally {
      try {
        if (pool) {
          await pool.query("DELETE FROM customer_leads WHERE lead_key = ANY($1::varchar[])", [leadKeys]);
          await pool.query("DELETE FROM technician_teams WHERE code = ANY($1::varchar[])", [[firstTeamCode, secondTeamCode]]);
          await pool.end();
        }
      } finally {
        if (apiServer) await stopIsolatedApiServer(apiServer);
        if (uploadDirectory) await rm(uploadDirectory, { force: true, recursive: true });
      }
    }
  });

  it(
    "persists team edits and calendar assignments after API refetches and browser reloads",
    { skip: (!adminPassword || !existsSync(chromiumPath)) && "ADMIN_PASSWORD and Chromium are required for browser test" },
    async () => {
    const page = browser.page;
    const checkProxy = () => {
      assert.equal(proxyError, null, `Browser API forwarding failed: ${proxyError}`);
    };
    const navigate = async (pathName: string) => {
      await page.command("Page.navigate", { url: `${baseUrl}${pathName}` });
      checkProxy();
    };
    const reload = async () => {
      const loaded = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for the browser reload")), 15_000);
        page.on("Page.loadEventFired", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      await page.command("Page.reload", { ignoreCache: true });
      await loaded;
      checkProxy();
    };
    const rowIdForCode = async (code: string) => page.evaluate(`(() => {
      const row = [...document.querySelectorAll('tr[data-testid^="row-technician-team-"]')]
        .find((item) => item.textContent?.includes(${JSON.stringify(code)}));
      return row?.getAttribute("data-testid")?.match(/row-technician-team-(\\d+)/)?.[1] ?? null;
    })()`);
    const createTeam = async (code: string, name: string, shortName: string, sortOrder: number) => {
      await waitForElement(page, '[data-testid="input-technician-team-code"]', "team editor form");
      await setInput(page, "input-technician-team-code", code);
      await setInput(page, "input-technician-team-name", name);
      await setInput(page, "input-technician-team-short-name", shortName);
      await setInput(page, "input-technician-team-aliases", `${shortName} test alias`);
      await setInput(page, "input-technician-team-sort-order", String(sortOrder));
      await clickTestId(page, "button-save-technician-team");
      await waitFor(
        () => page.evaluate(`Array.from(document.querySelectorAll('tr[data-testid^="row-technician-team-"]'))
          .some((row) => row.textContent?.includes(${JSON.stringify(code)}))`),
        Boolean,
        `created team ${code}`,
      );
      checkProxy();
    };
    const openCalendarDay = async (date: string) => {
      await clickTestId(page, `calendar-day-${date}`);
      await waitForElement(page, '[data-testid="sheet-calendar-day-details"]', `calendar day ${date}`);
    };
    const teamContainsJob = async (code: string, leadId: number) => page.evaluate(
      `document.querySelector('[data-testid="calendar-team-${code}"]')?.querySelector('[data-testid="calendar-job-${leadId}"]') !== null`,
    );

    rosterDelayMs = 650;
    await navigate("/admin/technician-teams");
    await waitForElement(page, '[data-testid="status-technician-team-loading"]', "team roster loading state");
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="table-technician-teams"]') !== null
        || document.querySelector('[data-testid="status-technician-team-empty"]') !== null`),
      Boolean,
      "live team roster response",
    );
    checkProxy();

    rosterOverride = { status: 200, body: "[]" };
    await reload();
    await waitForElement(page, '[data-testid="status-technician-team-empty"]', "empty team roster state");

    rosterOverride = { status: 503, body: JSON.stringify({ message: "Dispatch roster unavailable for browser test" }) };
    await reload();
    await waitForElement(page, '[data-testid="status-technician-team-load-error"]', "team roster API error state");
    rosterOverride = null;
    await reload();
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="table-technician-teams"]') !== null
        || document.querySelector('[data-testid="status-technician-team-empty"]') !== null`),
      Boolean,
      "authenticated live technician team manager",
    );

    await createTeam(firstTeamCode, "Dispatch browser team A", "Test A", 9901);
    await clickTestId(page, "button-add-technician-team");
    await createTeam(secondTeamCode, "Dispatch browser team B", "Test B", 9902);

    const firstTeamId = await rowIdForCode(firstTeamCode);
    assert.ok(firstTeamId, `Could not find the created team ${firstTeamCode}`);
    await clickTestId(page, `button-edit-technician-team-${firstTeamId}`);
    await setInput(page, "input-technician-team-name", "Edited dispatch browser team A");
    await setInput(page, "input-technician-team-short-name", "Edited A");
    await setInput(page, "input-technician-team-aliases", "edited dispatch alias");
    await setInput(page, "input-technician-team-sort-order", "9903");
    await clickTestId(page, "button-save-technician-team");
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="row-technician-team-${firstTeamId}"]')?.textContent?.includes("Edited dispatch browser team A") ?? false`),
      Boolean,
      "edited team values from the API",
    );
    await reload();
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="row-technician-team-${firstTeamId}"]')?.textContent?.includes("edited dispatch alias") ?? false`),
      Boolean,
      "edited team values after reload",
    );

    await clickTestId(page, `button-toggle-technician-team-${firstTeamId}`);
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="row-technician-team-${firstTeamId}"]') === null`),
      Boolean,
      "deactivated team omitted from the active roster",
    );
    const includeInactive = await page.evaluate(
      'document.querySelector(\'[data-testid="checkbox-technician-team-include-inactive"]\') instanceof HTMLInputElement',
    );
    assert.equal(includeInactive, true);
    await page.evaluate(`document.querySelector('[data-testid="checkbox-technician-team-include-inactive"]')?.click()`);
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="status-technician-team-${firstTeamId}"]')?.textContent?.includes("ปิดใช้งาน") ?? false`),
      Boolean,
      "deactivated team in the inactive-inclusive roster",
    );
    await reload();
    await waitForElement(page, '[data-testid="admin-technician-teams"]', "team manager after deactivation reload");
    await page.evaluate(`document.querySelector('[data-testid="checkbox-technician-team-include-inactive"]')?.click()`);
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="status-technician-team-${firstTeamId}"]')?.textContent?.includes("ปิดใช้งาน") ?? false`),
      Boolean,
      "deactivated team remains persisted after reload",
    );
    await clickTestId(page, `button-toggle-technician-team-${firstTeamId}`);
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="status-technician-team-${firstTeamId}"]')?.textContent?.includes("เปิดใช้งาน") ?? false`),
      Boolean,
      "reactivated team",
    );
    await reload();
    await waitFor(
      () => page.evaluate(`document.querySelector('[data-testid="row-technician-team-${firstTeamId}"]') !== null`),
      Boolean,
      "reactivated team remains in the active roster after reload",
    );

    const firstLeadInsert = await pool.query(
      `INSERT INTO customer_leads
        (lead_key, status, source, order_mode, name, project, address, product_skus, expected_installation_date, technician_team_code)
       VALUES ($1, 'new_lead', 'dispatch_browser_test', 'quick-purchase', $2, $3, $4, ARRAY[]::text[], $5, $6)
       RETURNING id`,
      [leadKeys[0], `Dispatch browser job A ${fixtureToken}`, "Dispatch browser persistence", "Test address A", dateKeys.first, secondTeamCode],
    );
    const secondLeadInsert = await pool.query(
      `INSERT INTO customer_leads
        (lead_key, status, source, order_mode, name, project, address, product_skus, expected_installation_date, technician_team_code)
       VALUES ($1, 'new_lead', 'dispatch_browser_test', 'quick-purchase', $2, $3, $4, ARRAY[]::text[], $5, $6)
       RETURNING id`,
      [leadKeys[1], `Dispatch browser job B ${fixtureToken}`, "Dispatch browser persistence", "Test address B", dateKeys.second, firstTeamCode],
    );
    leadIds = [Number(firstLeadInsert.rows[0]?.id), Number(secondLeadInsert.rows[0]?.id)];
    assert.ok(leadIds.every((id) => Number.isInteger(id) && id > 0), "Could not seed isolated calendar jobs");

    await navigate("/admin/calendar");
    await waitForElement(page, '[data-testid="calendar-live-notice"]', "live technician calendar");
    checkProxy();

    rosterOverride = { status: 200, body: "[]" };
    await reload();
    await waitForElement(page, '[data-testid="calendar-live-notice"]', "calendar with an empty active roster");
    await openCalendarDay(dateKeys.first);
    const emptyRosterSelect = await page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="select-calendar-team-${leadIds[0]}"]');
      return select instanceof HTMLSelectElement ? select.options.length : -1;
    })()`);
    assert.equal(emptyRosterSelect, 1, "The empty API roster should not show placeholder or seeded team options");

    rosterOverride = { status: 503, body: JSON.stringify({ message: "Dispatch roster unavailable for browser test" }) };
    await reload();
    await waitForElement(page, '[data-testid="calendar-teams-error"]', "calendar roster API error state");
    rosterOverride = null;
    await reload();
    await waitForElement(page, '[data-testid="calendar-live-notice"]', "calendar with the live active roster");
    await openCalendarDay(dateKeys.first);
    await waitFor(
      () => teamContainsJob(secondTeamCode, leadIds[0]),
      Boolean,
      "calendar job loaded under its persisted team",
    );
    const activeRosterOptions = await page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="select-calendar-team-${leadIds[0]}"]');
      return select instanceof HTMLSelectElement ? [...select.options].map((option) => option.value) : [];
    })()`);
    assert.ok(activeRosterOptions.includes(firstTeamCode), "The active roster should include the reactivated team");
    assert.ok(activeRosterOptions.includes(secondTeamCode), "The active roster should include the second live team");

    const firstJobSelectId = `select-calendar-team-${leadIds[0]}`;
    await setSelect(page, firstJobSelectId, firstTeamCode);
    await waitFor(
      () => teamContainsJob(firstTeamCode, leadIds[0]),
      Boolean,
      "job reassigned to team A after calendar refetch",
    );
    await reload();
    await waitForElement(page, '[data-testid="technician-calendar-page"]', "calendar after assignment reload");
    await openCalendarDay(dateKeys.first);
    await waitFor(
      () => teamContainsJob(firstTeamCode, leadIds[0]),
      Boolean,
      "job assignment persisted after browser reload",
    );

    await setSelect(page, firstJobSelectId, "");
    await waitFor(
      () => page.evaluate(`[...document.querySelectorAll('[data-testid^="calendar-team-"]')]
        .every((team) => team.querySelector('[data-testid="calendar-job-${leadIds[0]}"]') === null)`),
      Boolean,
      "cleared team assignment after calendar refetch",
    );
    await reload();
    await waitForElement(page, '[data-testid="technician-calendar-page"]', "calendar after clearing assignment");
    await openCalendarDay(dateKeys.first);
    await waitFor(
      () => page.evaluate(`[...document.querySelectorAll('[data-testid^="calendar-team-"]')]
        .every((team) => team.querySelector('[data-testid="calendar-job-${leadIds[0]}"]') === null)`),
      Boolean,
      "cleared team assignment persisted after browser reload",
    );

    await openCalendarDay(dateKeys.second);
    await waitFor(
      () => teamContainsJob(firstTeamCode, leadIds[1]),
      Boolean,
      "second job available to reschedule",
    );
    await setInput(page, `input-calendar-installation-date-${leadIds[1]}`, dateKeys.rescheduled);
    await waitFor(
      async () => {
        const result = await pool.query(
          "SELECT expected_installation_date FROM customer_leads WHERE id = $1",
          [leadIds[1]],
        );
        return result.rows[0]?.["expected_installation_date"];
      },
      (date) => date === dateKeys.rescheduled,
      "rescheduled job visible on its new date",
    );
    const persistedFixture = await pool.query(
      "SELECT expected_installation_date, technician_team_code FROM customer_leads WHERE id = ANY($1::integer[]) ORDER BY id",
      [leadIds],
    );
    assert.deepEqual(
      persistedFixture.rows.map((row) => [row["expected_installation_date"], row["technician_team_code"]]),
      [[dateKeys.first, null], [dateKeys.rescheduled, firstTeamCode]],
    );

    await reload();
    await waitForElement(page, '[data-testid="technician-calendar-page"]', "calendar after reschedule reload");
    await openCalendarDay(dateKeys.rescheduled);
    await waitFor(
      () => teamContainsJob(firstTeamCode, leadIds[1]),
      Boolean,
      "rescheduled job persisted after browser reload",
    );
    const persistedDateInput = await page.evaluate(
      `document.querySelector('[data-testid="input-calendar-installation-date-${leadIds[1]}"]')?.value ?? ""`,
    );
    assert.equal(persistedDateInput, dateKeys.rescheduled);
    checkProxy();
    },
  );
});