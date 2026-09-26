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
