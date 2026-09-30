import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import { synthesizeSpeech } from "../src/lib/google-tts.ts";
import { calculateModelCostThb, clearAiUsageEvents, getUnifiedAiCostSummary } from "../src/lib/ai-cost-tracker.ts";

// Same fake-but-real RSA key pair / mocked-fetch technique as google-tts.test.ts:
// only the two outbound HTTP calls (Google's token endpoint and the
// Text-to-Speech API) are mocked, so the real JWT-signing code still runs.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-tts@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

const realFetch = globalThis.fetch;

function mockGoogleFetch(ttsResponse: (init?: RequestInit) => Response | Promise<Response>) {
  return mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes("texttospeech.googleapis.com")) {
      return ttsResponse(init);
    }
    return realFetch(input as never, init);
  });
}

const originalEnv = {
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  databaseUrl: process.env["DATABASE_URL"],
};

before(() => {
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  // Must be set (to *something*) before the very first synthesizeSpeech() call:
  // @workspace/db throws at module-evaluation time when DATABASE_URL is unset,
  // and Node's ESM loader permanently caches that rejection for the module
  // specifier -- a later test setting DATABASE_URL would be too late once that
  // first failed import has poisoned the cache for the rest of this process.
  process.env["DATABASE_URL"] = "postgres://google-tts-cost-test";
});

after(() => {
  if (originalEnv.serviceAccountJson === undefined) delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  else process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = originalEnv.serviceAccountJson;
  if (originalEnv.applicationCredentials === undefined) delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  else process.env["GOOGLE_APPLICATION_CREDENTIALS"] = originalEnv.applicationCredentials;
  if (originalEnv.databaseUrl === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = originalEnv.databaseUrl;
});

afterEach(() => {
  mock.restoreAll();
  clearAiUsageEvents();
});

describe("synthesizeSpeech records google_tts usage in the AI Cost Center", () => {
  it("records a success:true-shaped event (visible as an active request) when Google TTS answers 200", async () => {
    const text = "สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ";
    mockGoogleFetch(() =>
      new Response(JSON.stringify({ audioContent: Buffer.from([1, 2, 3]).toString("base64") }), { status: 200 }));

    const result = await synthesizeSpeech(text);
    assert.equal(result.ok, true);

    const summary = getUnifiedAiCostSummary("all");
    const googleTts = summary.services.find((service) => service.id === "google_tts")!;
    assert.equal(googleTts.requests, 1);
    assert.equal(googleTts.status, "active");
    // promptTokens is the character count (google-tts.ts has no token concept),
    // so the recorded cost must match calculateModelCostThb() priced on that length.
    assert.equal(googleTts.costThb, Math.round(calculateModelCostThb("th-TH-Chirp3-HD-Kore", text.length, 0, 0) * 100) / 100);
    assert.ok(googleTts.costThb > 0);
  });

  it("still records an event (so the failure is never invisible) when Google TTS answers non-2xx", async () => {
    mockGoogleFetch(() =>
      new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 }));

    const result = await synthesizeSpeech("hi");
    assert.equal(result.ok, false);

    const summary = getUnifiedAiCostSummary("all");
    const googleTts = summary.services.find((service) => service.id === "google_tts")!;
    assert.equal(googleTts.requests, 1, "the failed call must still show up as a request in the Cost Center");
  });

  it("still records an event when the request throws (e.g. token exchange failure)", async () => {
    mock.method(globalThis, "fetch", async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      return realFetch(input as never);
    });

    const result = await synthesizeSpeech("hi");
    assert.equal(result.ok, false);

    const summary = getUnifiedAiCostSummary("all");
    const googleTts = summary.services.find((service) => service.id === "google_tts")!;
    assert.equal(googleTts.requests, 1);
  });

  it("never changes synthesizeSpeech's own signature or return shape", async () => {
    mockGoogleFetch(() =>
      new Response(JSON.stringify({ audioContent: Buffer.from([9]).toString("base64") }), { status: 200 }));
    const result = await synthesizeSpeech("hi", "th-TH-Chirp3-HD-Zephyr");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "audio/mpeg");
      assert.ok(Buffer.isBuffer(result.audio));
    }
  });
});

describe("GET /api/admin/ai-cost-center includes google_tts", () => {
  type AdminRouteModule = {
    createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
  };

  const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

  const ORIGINAL_ADMIN_ENV = {
    ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
    DATABASE_URL: process.env["DATABASE_URL"],
    SESSION_SECRET: process.env["SESSION_SECRET"],
  };

  before(() => {
    process.env["ADMIN_PASSWORD"] = "google-tts-cost-test-password";
    process.env["DATABASE_URL"] = "postgres://google-tts-cost-test";
    process.env["SESSION_SECRET"] = "google-tts-cost-test-session-secret";
  });

  after(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ADMIN_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function startAdminRoute() {
    const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", routeModule.createAdminRouter({}));
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

  it("lists google_tts as the 5th pillar, present even with zero events", async () => {
    const server = await startAdminRoute();
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/ai-cost-center`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { services: { id: string; name: string; status: string }[] };
      const googleTts = body.services.find((service) => service.id === "google_tts");
      assert.ok(googleTts, "google_tts must appear in the services list");
      assert.equal(googleTts?.name, "เสียงผู้ช่วยขาย (Google Cloud TTS)");
      assert.equal(googleTts?.status, "no-data");
    } finally {
      await server.close();
    }
  });
});
