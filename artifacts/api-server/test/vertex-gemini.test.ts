import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import { askGemini, vertexGeminiConfigured } from "../src/lib/vertex-gemini.ts";
import { clearAiUsageEvents, getUnifiedAiCostSummary } from "../src/lib/ai-cost-tracker.ts";

const originalEnv = {
  projectId: process.env["VERTEX_AI_PROJECT_ID"],
  location: process.env["VERTEX_AI_LOCATION"],
  model: process.env["VERTEX_AI_MODEL"],
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  serviceAccountDisabled: process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"],
};

afterEach(() => {
  mock.restoreAll();
  clearAiUsageEvents();
  for (const [key, value] of Object.entries(originalEnv)) {
    const envKey = {
      projectId: "VERTEX_AI_PROJECT_ID",
      location: "VERTEX_AI_LOCATION",
      model: "VERTEX_AI_MODEL",
      serviceAccountJson: "GOOGLE_SERVICE_ACCOUNT_JSON",
      applicationCredentials: "GOOGLE_APPLICATION_CREDENTIALS",
      serviceAccountDisabled: "GOOGLE_SERVICE_ACCOUNT_DISABLED",
    }[key as keyof typeof originalEnv];
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
  }
});

const realFetch = globalThis.fetch;

// A genuine RSA key pair, so the real JWT-signing code in
// lib/google-service-account.ts runs unmocked -- only the token exchange and
// Vertex AI Chat Completions HTTP calls below are mocked. This never leaves
// this process.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const FAKE_CREDENTIALS_JSON = JSON.stringify({
  client_email: "knight-basins-vertex@test.iam.gserviceaccount.com",
  private_key: privateKey,
});

function setConfigured() {
  process.env["VERTEX_AI_PROJECT_ID"] = "knight-basins-voice";
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
}

/** Mocks Google's token endpoint to always succeed; the caller supplies how
 * the Vertex AI Chat Completions endpoint itself responds. */
function mockVertexFetch(chatResponse: (init?: RequestInit) => Response | Promise<Response>) {
  return mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes("aiplatform.googleapis.com")) {
      return chatResponse(init);
    }
    return realFetch(input as never, init);
  });
}

describe("vertexGeminiConfigured", () => {
  it("is false when VERTEX_AI_PROJECT_ID is missing", () => {
    delete process.env["VERTEX_AI_PROJECT_ID"];
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    assert.equal(vertexGeminiConfigured(), false);
  });

  it("is false when no Google service account is configured", () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "knight-basins-voice";
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    // The loader also looks for credentials files on the host (/opt/data/..., ./google-credentials.json),
    // which deleting the env vars does not hide, so switch the service account off explicitly.
    process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] = "true";
    assert.equal(vertexGeminiConfigured(), false);
  });

  it("is true when both are set", () => {
    setConfigured();
    assert.equal(vertexGeminiConfigured(), true);
  });
});

describe("askGemini", () => {
  it("returns a not-configured failure without calling fetch when VERTEX_AI_PROJECT_ID is missing", async () => {
    delete process.env["VERTEX_AI_PROJECT_ID"];
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response("{}"); });
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("returns a not-configured failure without calling fetch when the service account is missing", async () => {
    process.env["VERTEX_AI_PROJECT_ID"] = "knight-basins-voice";
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    // The loader also looks for credentials files on the host (/opt/data/..., ./google-credentials.json),
    // which deleting the env vars does not hide, so switch the service account off explicitly.
    process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] = "true";
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response("{}"); });
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it("sends the bearer access token, default location/model, and an optional context system message", async () => {
    setConfigured();
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        capturedUrl = url;
        capturedAuth = String((init?.headers as Record<string, string> | undefined)?.["Authorization"]);
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: "สวัสดีค่ะ" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const result = await askGemini({ message: "ราคาเท่าไหร่", contextSummary: "ลูกค้ามีใบเสนอราคา A" });
    assert.equal(capturedUrl, "https://asia-southeast1-aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/asia-southeast1/endpoints/openapi/chat/completions");
    assert.equal(capturedAuth, "Bearer fake-access-token");
    assert.equal(capturedBody["model"], "google/gemini-2.5-flash");
    assert.deepEqual(capturedBody["messages"], [
      { role: "system", content: "ลูกค้ามีใบเสนอราคา A" },
      { role: "user", content: "ราคาเท่าไหร่" },
    ]);
    assert.deepEqual(result, { ok: true, reply: "สวัสดีค่ะ" });
  });

  it("omits the system message when no context summary is given", async () => {
    setConfigured();
    let capturedBody: Record<string, unknown> = {};
    mockVertexFetch((init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });
    await askGemini({ message: "hi" });
    assert.deepEqual(capturedBody["messages"], [{ role: "user", content: "hi" }]);
  });

  it("uses VERTEX_AI_LOCATION and VERTEX_AI_MODEL overrides when set", async () => {
    setConfigured();
    process.env["VERTEX_AI_LOCATION"] = "us-central1";
    process.env["VERTEX_AI_MODEL"] = "google/gemini-2.0-flash-001";
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        capturedUrl = url;
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    await askGemini({ message: "hi" });
    assert.equal(capturedUrl, "https://us-central1-aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/us-central1/endpoints/openapi/chat/completions");
    assert.equal(capturedBody["model"], "google/gemini-2.0-flash-001");
  });

  it("returns a failure without calling Vertex AI when the token exchange fails", async () => {
    setConfigured();
    let vertexCalled = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        vertexCalled = true;
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, false);
    assert.equal(vertexCalled, false);
  });

  it("returns a failure when Vertex AI responds with a non-2xx status", async () => {
    setConfigured();
    mockVertexFetch(() =>
      new Response(JSON.stringify({ error: { message: "The caller does not have permission" } }), { status: 403 }));
    const result = await askGemini({ message: "hi" });
    assert.deepEqual(result, { ok: false, message: "The caller does not have permission" });
  });

  it("returns a failure when the reply content is missing or blank", async () => {
    setConfigured();
    mockVertexFetch(() => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 }));
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, false);
  });

  it("records a vertex_gemini usage event with the real prompt/completion tokens and duration on success", async () => {
    setConfigured();
    mockVertexFetch(() =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "สวัสดีค่ะ" } }],
          usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
        }),
        { status: 200 },
      ));
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, true);

    const summary = getUnifiedAiCostSummary("all");
    const vertexGemini = summary.services.find((service) => service.id === "vertex_gemini")!;
    assert.equal(vertexGemini.requests, 1);
    assert.equal(vertexGemini.tokens, 46);
    assert.equal(vertexGemini.status, "active");
  });

  it("still records a vertex_gemini usage event with success:false when Vertex AI responds with a non-2xx status", async () => {
    setConfigured();
    mockVertexFetch(() =>
      new Response(JSON.stringify({ error: { message: "The caller does not have permission" } }), { status: 403 }));
    const result = await askGemini({ message: "hi" });
    assert.equal(result.ok, false);

    const summary = getUnifiedAiCostSummary("all");
    const vertexGemini = summary.services.find((service) => service.id === "vertex_gemini")!;
    assert.equal(vertexGemini.requests, 1, "an event is still recorded even though the call failed");
  });

  it("returns a timeout failure when the request is aborted", async () => {
    setConfigured();
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      }
      return new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = askGemini({ message: "hi" });
      mock.timers.tick(45_000);
      const result = await pending;
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, /timed out/);
    } finally {
      mock.timers.reset();
    }
  });
});
