import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { googleTtsConfigured, synthesizeSpeech } from "../src/lib/google-tts.ts";

const originalEnv = {
  key: process.env["GOOGLE_TTS_API_KEY"],
  voiceName: process.env["GOOGLE_TTS_VOICE_NAME"],
  languageCode: process.env["GOOGLE_TTS_LANGUAGE_CODE"],
};

afterEach(() => {
  mock.restoreAll();
  if (originalEnv.key === undefined) delete process.env["GOOGLE_TTS_API_KEY"];
  else process.env["GOOGLE_TTS_API_KEY"] = originalEnv.key;
  if (originalEnv.voiceName === undefined) delete process.env["GOOGLE_TTS_VOICE_NAME"];
  else process.env["GOOGLE_TTS_VOICE_NAME"] = originalEnv.voiceName;
  if (originalEnv.languageCode === undefined) delete process.env["GOOGLE_TTS_LANGUAGE_CODE"];
  else process.env["GOOGLE_TTS_LANGUAGE_CODE"] = originalEnv.languageCode;
});

describe("googleTtsConfigured", () => {
  it("is false when GOOGLE_TTS_API_KEY is missing", () => {
    delete process.env["GOOGLE_TTS_API_KEY"];
    assert.equal(googleTtsConfigured(), false);
  });

  it("is true once GOOGLE_TTS_API_KEY is set", () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    assert.equal(googleTtsConfigured(), true);
  });
});

describe("synthesizeSpeech", () => {
  it("returns a not-configured failure without calling fetch", async () => {
    delete process.env["GOOGLE_TTS_API_KEY"];
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("สวัสดีค่ะ");
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("rejects empty text without calling fetch", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("   ");
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("rejects text over the length limit without calling fetch", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response(""); });
    const result = await synthesizeSpeech("ก".repeat(601));
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("sends the key in the query string, default voice/language, and decodes base64 audio", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    delete process.env["GOOGLE_TTS_VOICE_NAME"];
    delete process.env["GOOGLE_TTS_LANGUAGE_CODE"];
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    const fakeAudioBase64 = Buffer.from([1, 2, 3, 4]).toString("base64");
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ audioContent: fakeAudioBase64 }), { status: 200 });
    });

    const result = await synthesizeSpeech("สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ");
    assert.equal(capturedUrl, "https://texttospeech.googleapis.com/v1/text:synthesize?key=test-key");
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
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    process.env["GOOGLE_TTS_VOICE_NAME"] = "th-TH-Chirp3-HD-Zephyr";
    process.env["GOOGLE_TTS_LANGUAGE_CODE"] = "th-TH";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ audioContent: Buffer.from([9]).toString("base64") }), { status: 200 });
    });
    await synthesizeSpeech("hi");
    assert.deepEqual(capturedBody["voice"], { languageCode: "th-TH", name: "th-TH-Chirp3-HD-Zephyr" });
  });

  it("surfaces the Google error message on a non-2xx response", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }));
    const result = await synthesizeSpeech("hi");
    assert.deepEqual(result, { ok: false, message: "API key not valid" });
  });

  it("falls back to a generic status message when audioContent is missing", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({}), { status: 200 }));
    const result = await synthesizeSpeech("hi");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /200/);
  });

  it("returns a timeout failure when the request is aborted", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
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
