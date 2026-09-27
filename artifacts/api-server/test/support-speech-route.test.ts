import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import { serveTypeScriptRoute } from "./route-harness.ts";

process.env["DATABASE_URL"] ??= "postgres://support-speech-route-test";

const originalEnv = {
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
};

afterEach(() => {
  mock.restoreAll();
  if (originalEnv.serviceAccountJson === undefined) delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  else process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = originalEnv.serviceAccountJson;
  if (originalEnv.applicationCredentials === undefined) delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  else process.env["GOOGLE_APPLICATION_CREDENTIALS"] = originalEnv.applicationCredentials;
});

const realFetch = globalThis.fetch;

// A genuine RSA key pair, so the real JWT-signing code in
// lib/google-service-account.ts runs unmocked -- only the token exchange and
// Text-to-Speech HTTP calls below are mocked. This never leaves this process.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-tts@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

// Mocking globalThis.fetch also intercepts the test's own calls to the local
// route.url server (same process, same global) -- not just the outbound
// Google calls inside the handler. Falling through to the real fetch for
// anything that isn't Google's own endpoints keeps the local HTTP round-trip
// genuine, the same pattern payment-slip-route.test.ts uses for mocking SlipOK.
function mockGoogleTtsFetch(googleResponse: () => Response) {
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes("texttospeech.googleapis.com")) return googleResponse();
    return realFetch(input as never, init);
  });
}

const fakeAudioBase64 = Buffer.from([1, 2, 3]).toString("base64");

describe("POST /api/support/speech", () => {
  it("returns audio/mpeg bytes for a valid message", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockGoogleTtsFetch(() =>
      new Response(JSON.stringify({ audioContent: fakeAudioBase64 }), { status: 200 }));

    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await fetch(`${route.url}/api/support/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "สวัสดีค่ะ" }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "audio/mpeg");
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.deepEqual([...bytes], [1, 2, 3]);
    } finally {
      await route.close();
    }
  });

  it("returns 422 with the failure message when Google TTS isn't configured", async () => {
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await fetch(`${route.url}/api/support/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "สวัสดีค่ะ" }),
      });
      assert.equal(response.status, 422);
      const body = await response.json() as { message: string };
      assert.match(body.message, /GOOGLE_SERVICE_ACCOUNT_JSON/);
    } finally {
      await route.close();
    }
  });

  it("rejects a 21st request within an hour from the same IP with 429", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockGoogleTtsFetch(() =>
      new Response(JSON.stringify({ audioContent: fakeAudioBase64 }), { status: 200 }));

    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      let lastStatus = 0;
      for (let i = 0; i < 21; i += 1) {
        const response = await fetch(`${route.url}/api/support/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `ครั้งที่ ${i}` }),
        });
        lastStatus = response.status;
        if (i < 20) assert.equal(response.status, 200, `request ${i + 1} should still be within quota`);
      }
      assert.equal(lastStatus, 429, "the 21st request within the window should be rate limited");
    } finally {
      await route.close();
    }
  });
});
