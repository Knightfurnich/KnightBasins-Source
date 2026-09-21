import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { askHermesSupport, hermesSupportConfigured } from "../src/lib/hermes-support.ts";

const originalEnv = {
  url: process.env["HERMES_API_URL"],
  key: process.env["HERMES_API_KEY"],
};

afterEach(() => {
  mock.restoreAll();
  if (originalEnv.url === undefined) delete process.env["HERMES_API_URL"];
  else process.env["HERMES_API_URL"] = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env["HERMES_API_KEY"];
  else process.env["HERMES_API_KEY"] = originalEnv.key;
});

describe("hermesSupportConfigured", () => {
  it("is false when either env var is missing", () => {
    delete process.env["HERMES_API_URL"];
    delete process.env["HERMES_API_KEY"];
    assert.equal(hermesSupportConfigured(), false);
    process.env["HERMES_API_URL"] = "https://hermes.test";
    assert.equal(hermesSupportConfigured(), false);
  });

  it("is true when both env vars are set", () => {
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "key";
    assert.equal(hermesSupportConfigured(), true);
  });
});

describe("askHermesSupport", () => {
  it("returns a not-configured failure without calling fetch", async () => {
    delete process.env["HERMES_API_URL"];
    delete process.env["HERMES_API_KEY"];
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response("{}"); });
    const result = await askHermesSupport({ message: "hi", userId: "u1" });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("sends the bearer key, model, user id, and an optional context system message", async () => {
    process.env["HERMES_API_URL"] = "https://hermes.test/";
    process.env["HERMES_API_KEY"] = "secret-key";
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = (init?.headers as Record<string, string>)["Authorization"];
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "สวัสดีค่ะ" } }] }), { status: 200 });
    });

    const result = await askHermesSupport({ message: "ราคาเท่าไหร่", userId: "U123", contextSummary: "ลูกค้ามีใบเสนอราคา A" });
    assert.equal(capturedUrl, "https://hermes.test/v1/chat/completions");
    assert.equal(capturedAuth, "Bearer secret-key");
    assert.equal(capturedBody["user"], "U123");
    assert.deepEqual(capturedBody["messages"], [
      { role: "system", content: "ลูกค้ามีใบเสนอราคา A" },
      { role: "user", content: "ราคาเท่าไหร่" },
    ]);
    assert.deepEqual(result, { ok: true, reply: "สวัสดีค่ะ" });
  });

  it("omits the system message when no context summary is given", async () => {
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "secret-key";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });
    await askHermesSupport({ message: "hi", userId: "u1" });
    assert.deepEqual(capturedBody["messages"], [{ role: "user", content: "hi" }]);
  });

  it("returns a failure when Hermes responds with a non-2xx status", async () => {
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "secret-key";
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ error: { message: "Invalid gateway API key" } }), { status: 401 }));
    const result = await askHermesSupport({ message: "hi", userId: "u1" });
    assert.deepEqual(result, { ok: false, message: "Invalid gateway API key" });
  });

  it("returns a failure when the reply content is missing or blank", async () => {
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "secret-key";
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 }));
    const result = await askHermesSupport({ message: "hi", userId: "u1" });
    assert.equal(result.ok, false);
  });

  it("returns a timeout failure when the request is aborted", async () => {
    process.env["HERMES_API_URL"] = "https://hermes.test";
    process.env["HERMES_API_KEY"] = "secret-key";
    mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = askHermesSupport({ message: "hi", userId: "u1" });
      mock.timers.tick(45_000);
      const result = await pending;
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, /timed out/);
    } finally {
      mock.timers.reset();
    }
  });
});
