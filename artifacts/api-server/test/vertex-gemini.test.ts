import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import { askGemini, vertexAiHost, vertexChatCompletionsUrl, vertexGeminiConfigured } from "../src/lib/vertex-gemini.ts";
import { clearAiUsageEvents, getUnifiedAiCostSummary } from "../src/lib/ai-cost-tracker.ts";

const originalEnv = {
  projectId: process.env["VERTEX_AI_PROJECT_ID"],
  location: process.env["VERTEX_AI_LOCATION"],
  model: process.env["VERTEX_AI_MODEL"],
  fallbackModels: process.env["VERTEX_AI_FALLBACK_MODELS"],
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
      fallbackModels: "VERTEX_AI_FALLBACK_MODELS",
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

// job-257 item 3: location "global" has no regional host prefix, and a 404 on the model id falls back instead of failing.
describe("vertex host and URL", () => {
  it("location=global uses aiplatform.googleapis.com with no prefix (global-aiplatform... answers 404)", () => {
    assert.equal(vertexAiHost("global"), "aiplatform.googleapis.com");
    assert.equal(
      vertexChatCompletionsUrl("proj-1", "global"),
      "https://aiplatform.googleapis.com/v1/projects/proj-1/locations/global/endpoints/openapi/chat/completions",
    );
    assert.doesNotMatch(vertexChatCompletionsUrl("proj-1", "global"), /global-aiplatform/);
  });

  it("a regional location keeps its prefix, host and path", () => {
    assert.equal(vertexAiHost("asia-southeast1"), "asia-southeast1-aiplatform.googleapis.com");
    assert.equal(
      vertexChatCompletionsUrl("proj-1", "asia-southeast1"),
      "https://asia-southeast1-aiplatform.googleapis.com/v1/projects/proj-1/locations/asia-southeast1/endpoints/openapi/chat/completions",
    );
    assert.equal(vertexAiHost("us-central1"), "us-central1-aiplatform.googleapis.com");
  });
});

describe("askGemini location and model fallback", () => {
  function recordCalls(respond: (model: string, call: number) => Response) {
    const calls: Array<{ url: string; model: string }> = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      if (url.includes("aiplatform.googleapis.com")) {
        const model = JSON.parse(String(init?.body)).model as string;
        calls.push({ url, model });
        return respond(model, calls.length);
      }
      return realFetch(input as never, init);
    });
    return calls;
  }
  const ok = (text = "pong") => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
  const notFound = () => new Response(JSON.stringify({ error: { message: "Publisher Model was not found" } }), { status: 404 });

  it("VERTEX_AI_LOCATION=global calls https://aiplatform.googleapis.com/... and returns the reply", async () => {
    setConfigured();
    process.env["VERTEX_AI_LOCATION"] = "global";
    process.env["VERTEX_AI_MODEL"] = "google/gemini-3.1-flash-lite";
    const calls = recordCalls(() => ok());
    assert.deepEqual(await askGemini({ message: "ping" }), { ok: true, reply: "pong" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/global/endpoints/openapi/chat/completions");
    assert.equal(calls[0]?.model, "google/gemini-3.1-flash-lite");
  });

  it("an explicit regional location still calls its prefixed host", async () => {
    setConfigured();
    process.env["VERTEX_AI_LOCATION"] = "asia-southeast1";
    const calls = recordCalls(() => ok());
    await askGemini({ message: "ping" });
    assert.match(calls[0]?.url ?? "", /^https:\/\/asia-southeast1-aiplatform\.googleapis\.com\/v1\/projects\/knight-basins-voice\/locations\/asia-southeast1\//);
  });

  it("a 404 on the configured model tries the next VERTEX_AI_FALLBACK_MODELS entry, logs a warning, and answers", async () => {
    setConfigured();
    process.env["VERTEX_AI_MODEL"] = "google/gemini-3.1-flash-lit"; // one letter short
    process.env["VERTEX_AI_FALLBACK_MODELS"] = " google/gemini-3.1-flash-lite , google/gemini-2.5-flash ";
    const warn = mock.method(console, "warn", () => {});
    const calls = recordCalls((model) => (model === "google/gemini-3.1-flash-lite" ? ok("from the fallback") : notFound()));
    assert.deepEqual(await askGemini({ message: "ping" }), { ok: true, reply: "from the fallback" });
    assert.deepEqual(calls.map((call) => call.model), ["google/gemini-3.1-flash-lit", "google/gemini-3.1-flash-lite"]);
    assert.equal(warn.mock.callCount(), 1);
    const logged = JSON.stringify(warn.mock.calls[0]?.arguments);
    assert.match(logged, /gemini-3\.1-flash-lit/);
    assert.doesNotMatch(logged, /fake-access-token|Bearer|private_key/);
  });

  it("walks the whole fallback list on repeated 404s and then reports the last error", async () => {
    setConfigured();
    process.env["VERTEX_AI_MODEL"] = "model-a";
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "model-b,model-a,model-c";
    mock.method(console, "warn", () => {});
    const calls = recordCalls(() => notFound());
    const result = await askGemini({ message: "ping" });
    assert.deepEqual(calls.map((call) => call.model), ["model-a", "model-b", "model-c"], "each model once, in order");
    assert.deepEqual(result, { ok: false, message: "Publisher Model was not found" });
  });

  it("without VERTEX_AI_FALLBACK_MODELS a 404 is reported as before (one call, no retry)", async () => {
    setConfigured();
    delete process.env["VERTEX_AI_FALLBACK_MODELS"];
    const calls = recordCalls(() => notFound());
    const result = await askGemini({ message: "ping" });
    assert.equal(calls.length, 1);
    assert.equal(result.ok, false);
  });

  it("only a 404 falls back: a 500, a 429 or an empty answer does not try another model", async () => {
    setConfigured();
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "model-b";
    for (const response of [() => new Response("{}", { status: 500 }), () => new Response("{}", { status: 429 }), () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 })]) {
      mock.restoreAll();
      const calls = recordCalls(response);
      assert.equal((await askGemini({ message: "ping" })).ok, false);
      assert.equal(calls.length, 1);
    }
  });

  it("each attempt is recorded for cost tracking under the model it used", async () => {
    setConfigured();
    process.env["VERTEX_AI_MODEL"] = "model-a";
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "model-b";
    mock.method(console, "warn", () => {});
    recordCalls((model) => (model === "model-b" ? ok() : notFound()));
    await askGemini({ message: "ping" });
    const recorded = JSON.stringify(getUnifiedAiCostSummary({ period: "all" } as never));
    assert.match(recorded, /model-a/);
    assert.match(recorded, /model-b/);
  });
});
