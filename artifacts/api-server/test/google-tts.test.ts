import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import { googleTtsConfigured, synthesizeSpeech } from "../src/lib/google-tts.ts";

const originalEnv = {
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  voiceName: process.env["GOOGLE_TTS_VOICE_NAME"],
  languageCode: process.env["GOOGLE_TTS_LANGUAGE_CODE"],
};

afterEach(() => {
  mock.restoreAll();
  if (originalEnv.serviceAccountJson === undefined) delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  else process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = originalEnv.serviceAccountJson;
  if (originalEnv.applicationCredentials === undefined) delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  else process.env["GOOGLE_APPLICATION_CREDENTIALS"] = originalEnv.applicationCredentials;
  if (originalEnv.voiceName === undefined) delete process.env["GOOGLE_TTS_VOICE_NAME"];
  else process.env["GOOGLE_TTS_VOICE_NAME"] = originalEnv.voiceName;
  if (originalEnv.languageCode === undefined) delete process.env["GOOGLE_TTS_LANGUAGE_CODE"];
  else process.env["GOOGLE_TTS_LANGUAGE_CODE"] = originalEnv.languageCode;
});

const realFetch = globalThis.fetch;

// A genuine RSA key pair, so the real JWT-signing code in
// lib/google-service-account.ts (node:crypto sign("RSA-SHA256", ...)) runs
// unmocked -- only the two outbound HTTP calls (Google's token endpoint and
// the Text-to-Speech API) are mocked below. This is not a real Google
// service account; it never leaves this process.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-tts@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

/** Mocks Google's token endpoint to always succeed; the caller supplies how
 * the Text-to-Speech endpoint itself responds. */
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

describe("googleTtsConfigured", () => {
  it("is false when no Google service account is configured", () => {
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    assert.equal(googleTtsConfigured(), false);
  });

  it("is true once GOOGLE_SERVICE_ACCOUNT_JSON is set", () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    assert.equal(googleTtsConfigured(), true);
  });
});

describe("synthesizeSpeech", () => {
  it("returns a not-configured failure without calling fetch", async () => {
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("สวัสดีค่ะ");
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("rejects empty text without calling fetch", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("   ");
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("rejects text over the length limit without calling fetch", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("ก".repeat(601));
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("authenticates with a Bearer access token, default voice/language, and decodes base64 audio", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    delete process.env["GOOGLE_TTS_VOICE_NAME"];
    delete process.env["GOOGLE_TTS_LANGUAGE_CODE"];
    const fakeAudioBase64 = Buffer.from([1, 2, 3, 4]).toString("base64");
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("texttospeech.googleapis.com")) {
        capturedUrl = url;
        capturedAuth = String((init?.headers as Record<string, string> | undefined)?.["Authorization"]);
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ audioContent: fakeAudioBase64 }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const result = await synthesizeSpeech("สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ");
    assert.equal(capturedUrl, "https://texttospeech.googleapis.com/v1/text:synthesize");
    assert.equal(capturedAuth, "Bearer fake-access-token");
    assert.deepEqual(capturedBody["voice"], { languageCode: "th-TH", name: "th-TH-Chirp3-HD-Kore" });
    assert.deepEqual(capturedBody["input"], { text: "สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ" });
    assert.deepEqual(capturedBody["audioConfig"], { audioEncoding: "MP3" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "audio/mpeg");
      assert.deepEqual([...result.audio], [1, 2, 3, 4]);
    }
  });

  it("uses GOOGLE_TTS_VOICE_NAME and GOOGLE_TTS_LANGUAGE_CODE overrides when set", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    process.env["GOOGLE_TTS_VOICE_NAME"] = "th-TH-Chirp3-HD-Zephyr";
    process.env["GOOGLE_TTS_LANGUAGE_CODE"] = "th-TH";
    let capturedBody: Record<string, unknown> = {};
    mockGoogleFetch((init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ audioContent: Buffer.from([9]).toString("base64") }), { status: 200 });
    });
    await synthesizeSpeech("hi");
    assert.deepEqual(capturedBody["voice"], { languageCode: "th-TH", name: "th-TH-Chirp3-HD-Zephyr" });
  });

  it("returns a failure without calling the TTS endpoint when the token exchange fails", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let ttsCalled = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      if (url.includes("texttospeech.googleapis.com")) {
        ttsCalled = true;
        return new Response(JSON.stringify({ audioContent: "" }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    const result = await synthesizeSpeech("hi");
    assert.equal(result.ok, false);
    assert.equal(ttsCalled, false);
  });

  it("surfaces the Google error message on a non-2xx response", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockGoogleFetch(() =>
      new Response(JSON.stringify({ error: { message: "Request had invalid authentication credentials" } }), { status: 400 }));
    const result = await synthesizeSpeech("hi");
    assert.deepEqual(result, { ok: false, message: "Request had invalid authentication credentials" });
  });

  it("falls back to a generic status message when audioContent is missing", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mockGoogleFetch(() => new Response(JSON.stringify({}), { status: 200 }));
    const result = await synthesizeSpeech("hi");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /200/);
  });

  it("returns a timeout failure when the request is aborted", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      return new Promise((_resolve, reject) => {
        // The token exchange above now runs (and awaits) before this call, so
        // by the time execution gets here the abort timer may have already
        // fired -- check signal.aborted upfront, the same way real fetch()
        // does, instead of only listening for a future "abort" event.
        if (init?.signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = synthesizeSpeech("hi");
      mock.timers.tick(30_000);
      const result = await pending;
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, /timeout|หมดเวลา/);
    } finally {
      mock.timers.reset();
    }
  });
});
