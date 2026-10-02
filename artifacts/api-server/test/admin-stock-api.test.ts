import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminStockItemPayload = { no: number; name: string; qty: number; scrap: string; lots: string[]; note: string };
type AdminStockSheetPayload = { title: string; total: number; inStockCount: number; totalSheets: number; items: AdminStockItemPayload[] };
type AdminStockResponsePayload = { updatedAt: string; staron: AdminStockSheetPayload; zen: AdminStockSheetPayload };

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const realFetch = globalThis.fetch;

// A genuine RSA key pair, so the route's real JWT-signing code (node:crypto
// sign("RSA-SHA256", ...)) runs unmocked -- only the two outbound HTTP calls
// (Google's token endpoint and the Sheets API) are mocked below. This is not
// a real Google service account; it never leaves this process.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-stock@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

const STARON_ID = "12g_xKizhTAFz0wheAVV3LtLvzBuoCItR";
const ZEN_ID = "1Reo4DQlsXddm19ksEw3xhrfvhY06QjvP";

const STARON_VALUES = [
  ["no", "name", "qty", "scrap", "lots", "note"],
  ["1", "AA 625 (Aspen Alder)", "21", "", "L001, L002", ""],
  ["2", "BW 010 (Bianco White)", "0", "0.4 ตร.ม.", "", "หมดสต๊อค"],
];

const ZEN_VALUES = [
  ["no", "name", "qty", "scrap", "lots", "note"],
  ["1", "AP 100 (Apex)", "3", "", "", ""],
  ["", "", "", "", "", ""],
  ["2", "NW 013 (Night White)", "5", "", "L010\nL011", ""],
];

function mockGoogleFetch() {
  let tokenCalls = 0;
  let sheetsCalls = 0;
  const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      tokenCalls++;
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes(`/spreadsheets/${STARON_ID}/values/`)) {
      sheetsCalls++;
      return new Response(JSON.stringify({ values: STARON_VALUES }), { status: 200 });
    }
    if (url.includes(`/spreadsheets/${ZEN_ID}/values/`)) {
      sheetsCalls++;
      return new Response(JSON.stringify({ values: ZEN_VALUES }), { status: 200 });
    }
    return realFetch(input as never, init);
  });
  return { fetchMock, tokenCalls: () => tokenCalls, sheetsCalls: () => sheetsCalls };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-stock-api-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-stock-api-test";
  process.env["SESSION_SECRET"] = "admin-stock-api-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  mock.restoreAll();
});

describe("GET /admin/stock", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute({});
    try {
      const response = await fetch(`${server.url}/api/admin/stock`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking both leads and basins permission", async () => {
    const server = await startAdminRoute({});
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "installed-stones";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  });

  it("returns 503 when no Google service account credentials are configured", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] = "true";
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(response.status, 503);
    } finally {
      delete process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"];
      await server.close();
    }
  });

  it("returns the full staron and zen structure, parsed from the Sheets API response", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const { fetchMock } = mockGoogleFetch();
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as AdminStockResponsePayload;

      assert.ok(!Number.isNaN(new Date(payload.updatedAt).getTime()));

      assert.equal(payload.staron.title, "สต๊อคแผ่นหินสังเคราะห์ Staron");
      assert.equal(payload.staron.total, 2);
      assert.equal(payload.staron.inStockCount, 1, "only AA 625 has qty > 0");
      assert.equal(payload.staron.totalSheets, 21, "sum of every item's qty (21 + 0)");
      assert.deepEqual(payload.staron.items[0], { no: 1, name: "AA 625 (Aspen Alder)", qty: 21, scrap: "", lots: ["L001", "L002"], note: "" });
      assert.deepEqual(payload.staron.items[1], { no: 2, name: "BW 010 (Bianco White)", qty: 0, scrap: "0.4 ตร.ม.", lots: [], note: "หมดสต๊อค" });

      assert.equal(payload.zen.title, "สต๊อคแผ่นหินสังเคราะห์ Zen Stone");
      assert.equal(payload.zen.total, 2, "the blank row is skipped");
      assert.equal(payload.zen.inStockCount, 2);
      assert.equal(payload.zen.totalSheets, 8, "sum of every item's qty (3 + 5)");
      assert.deepEqual(payload.zen.items[1]!.lots, ["L010", "L011"], "lots split on newlines too");

      assert.equal(fetchMock.mock.callCount() > 0, true);
    } finally {
      await server.close();
    }
  });

  it("drops the factory sheet's trailing SUM-formula row instead of counting it as a fake extra stone color (job-80)", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes(`/spreadsheets/${STARON_ID}/values/`)) {
        return new Response(JSON.stringify({
          values: [
            ["no", "name", "qty", "scrap", "lots", "note"],
            ["1", "AA 625 (Aspen Alder)", "21", "", "", ""],
            ["2", "BW 010 (Bianco White)", "5", "", "", ""],
            ["63", "รวมแผ่นทั้งหมด", "26", "", "", ""],
          ],
        }), { status: 200 });
      }
      if (url.includes(`/spreadsheets/${ZEN_ID}/values/`)) {
        return new Response(JSON.stringify({
          values: [
            ["no", "name", "qty", "scrap", "lots", "note"],
            ["1", "AP 100 (Apex)", "3", "", "", ""],
            ["2", "NW 013 (Night White)", "5", "", "", ""],
            ["3", "รวมทั้งหมด", "8", "", "", ""],
          ],
        }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as AdminStockResponsePayload;

      assert.equal(payload.staron.total, 2, "the SUM row must not be counted as a 3rd stone color");
      assert.equal(payload.staron.items.some((item) => item.name.includes("รวมแผ่นทั้งหมด")), false);
      assert.equal(payload.staron.totalSheets, 26, "26 real sheets (21 + 5), matching what the SUM row itself claimed");

      assert.equal(payload.zen.total, 2);
      assert.equal(payload.zen.items.some((item) => item.name.includes("รวมทั้งหมด")), false);
      assert.equal(payload.zen.totalSheets, 8);

      assert.equal(fetchMock.mock.callCount() > 0, true);
    } finally {
      await server.close();
    }
  });

  it("recognizes every documented summary-row phrasing ('รวมแผ่นทั้งหมด' / 'รวมทั้งหมด' / 'ยอดรวม' / 'Total'), case-insensitively", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes(`/spreadsheets/${STARON_ID}/values/`)) {
        return new Response(JSON.stringify({
          values: [
            ["no", "name", "qty", "scrap", "lots", "note"],
            ["1", "AA 625 (Aspen Alder)", "21", "", "", ""],
            ["2", "ยอดรวม", "21", "", "", ""],
            ["3", "TOTAL", "21", "", "", ""],
          ],
        }), { status: 200 });
      }
      if (url.includes(`/spreadsheets/${ZEN_ID}/values/`)) {
        return new Response(JSON.stringify({ values: [["no", "name", "qty", "scrap", "lots", "note"], ["1", "AP 100 (Apex)", "3", "", "", ""]] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      const payload = await response.json() as AdminStockResponsePayload;
      assert.equal(payload.staron.total, 1, "both the Thai 'ยอดรวม' row and the English 'TOTAL' row must be dropped");
      assert.equal(payload.staron.totalSheets, 21);
    } finally {
      await server.close();
    }
  });

  it("serves from cache on a second request (no new Sheets API calls)", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const { sheetsCalls } = mockGoogleFetch();
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      const callsAfterFirst = sheetsCalls();
      assert.equal(callsAfterFirst, 2, "one call per sheet");

      const second = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(second.status, 200);
      assert.equal(sheetsCalls(), callsAfterFirst, "second request must be served from the 5-minute cache");
    } finally {
      await server.close();
    }
  });

  it("keeps serving the last good snapshot when a later refresh fails, instead of blanking the page", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let sheetsDown = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (sheetsDown && (url.startsWith("https://sheets.googleapis.com/") || url.startsWith("https://docs.google.com/"))) {
        return new Response("Server Error", { status: 500 });
      }
      if (url.includes(`/spreadsheets/${STARON_ID}/values/`)) return new Response(JSON.stringify({ values: STARON_VALUES }), { status: 200 });
      if (url.includes(`/spreadsheets/${ZEN_ID}/values/`)) return new Response(JSON.stringify({ values: ZEN_VALUES }), { status: 200 });
      return realFetch(input as never, init);
    });
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const first = await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      assert.equal(first.status, 200);
      const firstPayload = await first.json() as AdminStockResponsePayload;

      sheetsDown = true;
      const refreshed = await fetch(`${server.url}/api/admin/stock?refresh=true`, { headers: { cookie } });
      assert.equal(refreshed.status, 200, "a failed refresh falls back to the cached snapshot");
      const refreshedPayload = await refreshed.json() as AdminStockResponsePayload;
      assert.equal(refreshedPayload.updatedAt, firstPayload.updatedAt, "still the old snapshot, so its age stays visible");
      assert.equal(refreshedPayload.staron.total, 2);
    } finally {
      await server.close();
    }
  });

  describe("source failures (job-184)", () => {
    const HEADER = ["no", "name", "qty", "scrap", "lots", "note"];
    const csv = (rows: string[][]) => rows.map((row) => row.map((cell) => (/[",]/.test(cell) ? `"${cell}"` : cell)).join(",")).join("\r\n");
    const STARON_CSV = csv([HEADER, ["1", "AA 625 (Aspen Alder)", "21", "", "", ""], ["2", "BW 010 (Bianco White)", "0", "", "", ""]]);
    const ZEN_CSV = csv([HEADER, ["1", "AP 100 (Apex)", "3", "", "", ""]]);

    type GoogleBehavior = {
      sheetsApi?: (url: string) => Response;
      staronExport?: (url: string) => Response;
      zenExport?: (url: string) => Response;
      token?: () => Response;
      htmlview?: (url: string, init?: RequestInit) => Response | Promise<Response>;
    };

    /** Mocks Google's token endpoint, the Sheets API and the CSV export. The
     * Sheets API answers 403 by default (the API-not-enabled / Office-file case
     * that forces the CSV fallback). Records every outbound call. */
    function mockGoogle(behavior: GoogleBehavior = {}) {
      const calls: { url: string; signal: AbortSignal | null | undefined }[] = [];
      const htmlviewCalls: { url: string; signal: AbortSignal | null | undefined; authorization: string | null }[] = [];
      mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return behavior.token?.() ?? new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
        }
        if (url.startsWith("https://sheets.googleapis.com/")) {
          calls.push({ url, signal: init?.signal });
          return behavior.sheetsApi?.(url) ?? new Response("{}", { status: 403 });
        }
        if (url.startsWith("https://docs.google.com/spreadsheets/") && url.endsWith("/htmlview")) {
          htmlviewCalls.push({ url, signal: init?.signal, authorization: new Headers(init?.headers).get("authorization") });
          return (await behavior.htmlview?.(url, init)) ?? new Response("Not Found", { status: 404 });
        }
        if (url.startsWith("https://docs.google.com/spreadsheets/")) {
          calls.push({ url, signal: init?.signal });
          if (url.includes(`/d/${STARON_ID}/`)) return behavior.staronExport?.(url) ?? new Response(STARON_CSV, { status: 200 });
          if (url.includes(`/d/${ZEN_ID}/`)) return behavior.zenExport?.(url) ?? new Response(ZEN_CSV, { status: 200 });
        }
        return realFetch(input as never, init);
      });
      return {
        calls,
        htmlviewCalls,
        exports: (id: string) => calls.filter((call) => call.url.startsWith("https://docs.google.com/") && call.url.includes(`/d/${id}/`)),
      };
    }

    async function getStock(path = "/api/admin/stock") {
      process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
      const server = await startAdminRoute({});
      const cookie = `knight_admin_session=${createAdminToken()}`;
      return {
        server,
        cookie,
        get: (requestPath = path) => fetch(`${server.url}${requestPath}`, { headers: { cookie } }),
      };
    }

    afterEach(() => {
      delete process.env["STOCK_STARON_SHEET_GID"];
    });

    it("builds the Staron CSV export URL without any gid when STOCK_STARON_SHEET_GID is not set", async () => {
      delete process.env["STOCK_STARON_SHEET_GID"];
      const google = mockGoogle();
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 200);
        const payload = await response.json() as AdminStockResponsePayload;
        assert.equal(payload.staron.total, 2);
        assert.equal(payload.zen.total, 1);

        const staronExports = google.exports(STARON_ID);
        assert.equal(staronExports.length, 1, "no gid configured -> a single plain export, no retry");
        assert.ok(!staronExports[0]!.url.includes("gid="), "the URL must not carry a gid");
        assert.ok(!google.exports(ZEN_ID)[0]!.url.includes("gid="));
      } finally {
        await server.close();
      }
    });

    it("uses STOCK_STARON_SHEET_GID when set, and retries without it if Google rejects that tab id", async () => {
      process.env["STOCK_STARON_SHEET_GID"] = "424242";
      const google = mockGoogle({
        staronExport: (url) => (url.includes("gid=424242") ? new Response("Bad Request", { status: 400 }) : new Response(STARON_CSV, { status: 200 })),
      });
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 200);
        const payload = await response.json() as AdminStockResponsePayload;
        assert.equal(payload.staron.items[0]!.name, "AA 625 (Aspen Alder)");

        const staronExports = google.exports(STARON_ID);
        assert.equal(staronExports.length, 2);
        assert.ok(staronExports[0]!.url.endsWith("&gid=424242"), "the configured gid is tried first");
        assert.ok(!staronExports[1]!.url.includes("gid="), "then the plain export");
      } finally {
        await server.close();
      }
    });

    it("keeps Zen Stone available when Staron fails, returning Staron empty with its own reason", async () => {
      const google = mockGoogle({ staronExport: () => new Response("Server Error", { status: 500 }) });
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 200);
        const payload = await response.json() as AdminStockResponsePayload & { staron: { unavailableReason?: string }; zen: { unavailableReason?: string } };
        assert.equal(payload.zen.total, 1);
        assert.equal(payload.zen.items[0]!.name, "AP 100 (Apex)");
        assert.equal(payload.zen.unavailableReason, undefined);
        assert.equal(payload.staron.total, 0);
        assert.deepEqual(payload.staron.items, []);
        assert.match(payload.staron.unavailableReason ?? "", /Staron/);
        assert.match(payload.staron.unavailableReason ?? "", /500/);

        const firstRoundExports = google.exports(STARON_ID).length;
        await get();
        assert.ok(google.exports(STARON_ID).length > firstRoundExports, "a partial answer is not cached, so the next request retries Staron");
      } finally {
        await server.close();
      }
    });

    it("answers 503 (not 500) naming the real cause of both sources when both fail", async () => {
      mockGoogle({
        staronExport: () => new Response("Server Error", { status: 500 }),
        zenExport: () => new Response("Bad Request", { status: 400 }),
      });
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 503);
        const body = await response.json() as { message: string };
        assert.match(body.message, /Staron: .*CSV export: 500/);
        assert.match(body.message, /Zen Stone: .*CSV export: 400/);
        assert.match(body.message, /Sheets API: 403/);

        const exportResponse = await get("/api/admin/stock/export");
        assert.equal(exportResponse.status, 503, "the CSV download reports the same condition");
      } finally {
        await server.close();
      }
    });

    it("answers 503 with the token-exchange status when Google rejects the service account", async () => {
      mockGoogle({ token: () => new Response("{}", { status: 400 }) });
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 503);
        const body = await response.json() as { message: string };
        assert.match(body.message, /token exchange failed with 400/);
      } finally {
        await server.close();
      }
    });

    it("serves the last good copy of just the failing source on refresh, instead of blanking it", async () => {
      let staronDown = false;
      mockGoogle({
        staronExport: () => (staronDown ? new Response("Server Error", { status: 500 }) : new Response(STARON_CSV, { status: 200 })),
      });
      const { server, get } = await getStock();
      try {
        const first = await (await get()).json() as AdminStockResponsePayload;
        assert.equal(first.staron.total, 2);

        staronDown = true;
        const refreshed = await get("/api/admin/stock?refresh=true");
        assert.equal(refreshed.status, 200);
        const payload = await refreshed.json() as AdminStockResponsePayload & { staron: { unavailableReason?: string } };
        assert.equal(payload.staron.total, 2, "Staron falls back to its last good copy");
        assert.equal(payload.staron.unavailableReason, undefined);
        assert.equal(payload.zen.total, 1);
      } finally {
        await server.close();
      }
    });

    it("caps every Google call with an abort signal so a hung export cannot hold the request open", async () => {
      const google = mockGoogle();
      const { server, get } = await getStock();
      try {
        const response = await get();
        assert.equal(response.status, 200);
        assert.ok(google.calls.length >= 4, "Sheets API + CSV export for both sources");
        for (const call of google.calls) {
          assert.ok(call.signal instanceof AbortSignal, `no timeout signal on ${call.url}`);
        }
      } finally {
        await server.close();
      }
    });

    describe("Staron tab id from /htmlview (job-185)", () => {
      // Same shape as the real page: every tab is `items.push({name: "<tab>", pageUrl: "...", gid: "<id>", ...`
      const htmlviewWith = (tabs: [string, string][]) =>
        `<script>var items = [];${tabs.map(([name, gid]) =>
          `items.push({name: "${name}", pageUrl: "https:\\/\\/docs.google.com\\/spreadsheets\\/d\\/${STARON_ID}\\/htmlview\\/sheet?headers\\x3dtrue\\x26gid\\x3d${gid}", gid: "${gid}", initialSheet: false});`,
        ).join("")}</script>`;
      const LIVE_GID = "1328053682";
      const STALE_ENV_GID = "777";
      const STARON_TAB = "สต๊อคหินStaron";
      const liveHtmlview = () => new Response(htmlviewWith([[STARON_TAB, LIVE_GID], ["AA 625", "2087730452"], ["AG 612", "1263622489"]]), { status: 200 });

      it("reads the live Staron tab id from /htmlview and exports that tab first", async () => {
        const google = mockGoogle({ htmlview: liveHtmlview });
        const { server, get } = await getStock();
        try {
          const response = await get();
          assert.equal(response.status, 200);
          const payload = await response.json() as AdminStockResponsePayload;
          assert.equal(payload.staron.total, 2);

          const staronExports = google.exports(STARON_ID);
          assert.equal(staronExports.length, 1);
          assert.ok(staronExports[0]!.url.endsWith(`&gid=${LIVE_GID}`), "the id read from the page is used, not a remembered one");

          const staronHtmlviews = google.htmlviewCalls.filter((c) => c.url.includes(STARON_ID));
          assert.equal(staronHtmlviews.length, 1, "Staron lookup happens once");
          assert.ok(staronHtmlviews[0]!.url.endsWith(`/d/${STARON_ID}/htmlview`));
          assert.ok(staronHtmlviews[0]!.signal instanceof AbortSignal, "the lookup is time-boxed too");
          assert.ok(google.htmlviewCalls.some((c) => c.url.includes(ZEN_ID)), "Zen also performs htmlview lookup");
        } finally {
          await server.close();
        }
      });

      it("matches the tab by its name, not by its position in the list", async () => {
        const google = mockGoogle({ htmlview: () => new Response(htmlviewWith([["AA 625", "111"], [STARON_TAB, "222"]]), { status: 200 }) });
        const { server, get } = await getStock();
        try {
          assert.equal((await get()).status, 200);
          assert.ok(google.exports(STARON_ID)[0]!.url.endsWith("&gid=222"));
        } finally {
          await server.close();
        }
      });

      it("falls back to the plain export when /htmlview answers an error", async () => {
        const google = mockGoogle({ htmlview: () => new Response("Server Error", { status: 500 }) });
        const { server, get } = await getStock();
        try {
          const response = await get();
          assert.equal(response.status, 200);
          const payload = await response.json() as AdminStockResponsePayload;
          assert.equal(payload.staron.total, 2);
          const staronExports = google.exports(STARON_ID);
          assert.equal(staronExports.length, 1);
          assert.ok(!staronExports[0]!.url.includes("gid="));
        } finally {
          await server.close();
        }
      });

      it("falls back to the plain export when /htmlview times out, instead of taking the endpoint down", async () => {
        const google = mockGoogle({
          htmlview: () => {
            throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
          },
        });
        const { server, get } = await getStock();
        try {
          const response = await get();
          assert.equal(response.status, 200);
          const payload = await response.json() as AdminStockResponsePayload;
          assert.equal(payload.staron.total, 2);
          assert.equal(payload.zen.total, 1);
          const staronHtmlviews = google.htmlviewCalls.filter((c) => c.url.includes(STARON_ID));
          assert.equal(staronHtmlviews.length, 1, "a timeout is not retried");
          assert.ok(!google.exports(STARON_ID)[0]!.url.includes("gid="));
        } finally {
          await server.close();
        }
      });

      it("falls back to the plain export when the page doesn't list the Staron tab", async () => {
        const google = mockGoogle({ htmlview: () => new Response(htmlviewWith([["AA 625", "111"], ["AG 612", "222"]]), { status: 200 }) });
        const { server, get } = await getStock();
        try {
          assert.equal((await get()).status, 200);
          assert.ok(!google.exports(STARON_ID)[0]!.url.includes("gid="), "never guesses another tab's id");
        } finally {
          await server.close();
        }
      });

      it("tries the live id, then STOCK_STARON_SHEET_GID, then the plain export, and forgets a live id that stopped working", async () => {
        process.env["STOCK_STARON_SHEET_GID"] = STALE_ENV_GID;
        const google = mockGoogle({
          htmlview: liveHtmlview,
          staronExport: (url) => (url.includes("gid=") ? new Response("Bad Request", { status: 400 }) : new Response(STARON_CSV, { status: 200 })),
        });
        const { server, get } = await getStock();
        try {
          const response = await get();
          assert.equal(response.status, 200);
          const staronExports = google.exports(STARON_ID).map((call) => call.url);
          assert.equal(staronExports.length, 3);
          assert.ok(staronExports[0]!.endsWith(`&gid=${LIVE_GID}`));
          assert.ok(staronExports[1]!.endsWith(`&gid=${STALE_ENV_GID}`));
          assert.ok(!staronExports[2]!.includes("gid="));

          await get("/api/admin/stock?refresh=true");
          const staronHtmlviews = google.htmlviewCalls.filter((c) => c.url.includes(STARON_ID));
          assert.equal(staronHtmlviews.length, 2, "the failed live id was dropped, so the page is read again");
        } finally {
          await server.close();
        }
      });

      it("keeps the live id between refreshes instead of re-reading the page every time", async () => {
        const google = mockGoogle({ htmlview: liveHtmlview });
        const { server, get } = await getStock();
        try {
          await get();
          assert.equal((await get("/api/admin/stock?refresh=true")).status, 200);
          assert.equal(google.htmlviewCalls.length, 2, "1 for staron + 1 for zen on initial fetch, both cached on refresh");
          const staronExports = google.exports(STARON_ID);
          assert.equal(staronExports.length, 2);
          assert.ok(staronExports.every((call) => call.url.endsWith(`&gid=${LIVE_GID}`)));
        } finally {
          await server.close();
        }
      });

      it("sends the service-account token to /htmlview first, and retries without it if the page refuses it", async () => {
        const google = mockGoogle({
          htmlview: (_url, init) => (new Headers(init?.headers).get("authorization") ? new Response("Unauthorized", { status: 401 }) : liveHtmlview()),
        });
        const { server, get } = await getStock();
        try {
          assert.equal((await get()).status, 200);
          const staronHtmlviews = google.htmlviewCalls.filter((c) => c.url.includes(STARON_ID));
          assert.equal(staronHtmlviews.length, 2);
          assert.equal(staronHtmlviews[0]!.authorization, "Bearer fake-access-token");
          assert.equal(staronHtmlviews[1]!.authorization, null);
          assert.ok(google.exports(STARON_ID)[0]!.url.endsWith(`&gid=${LIVE_GID}`));
        } finally {
          await server.close();
        }
      });

      it("resolves Zen Stone live tab id from htmlview when present", async () => {
        const ZEN_LIVE_GID = "656201551";
        const google = mockGoogle({
          htmlview: (url) => {
            if (url.includes(ZEN_ID)) {
              return new Response(
                htmlviewWith([["หน้าโชว์สต๊อคหิน Zen Stone", ZEN_LIVE_GID], ["AP 100", "857804783"]]),
                { status: 200 },
              );
            }
            return liveHtmlview();
          },
        });
        const { server, get } = await getStock();
        try {
          const response = await get();
          assert.equal(response.status, 200);
          const zenExports = google.exports(ZEN_ID);
          assert.ok(zenExports.length > 0);
          assert.ok(zenExports[0]!.url.endsWith(`&gid=${ZEN_LIVE_GID}`), "Zen Stone CSV export uses live gid");
        } finally {
          await server.close();
        }
      });
    });
  });

  it("?refresh=true bypasses the cache and fetches fresh data", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const { sheetsCalls } = mockGoogleFetch();
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      await fetch(`${server.url}/api/admin/stock`, { headers: { cookie } });
      const callsAfterFirst = sheetsCalls();

      const refreshed = await fetch(`${server.url}/api/admin/stock?refresh=true`, { headers: { cookie } });
      assert.equal(refreshed.status, 200);
      assert.equal(sheetsCalls(), callsAfterFirst + 2, "refresh=true must trigger a fresh fetch of both sheets");
    } finally {
      await server.close();
    }
  });
});
