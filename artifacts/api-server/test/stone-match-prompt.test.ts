import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import {
  suggestStonesForPhoto,
  type StoneMatchCandidate,
} from "../src/lib/stone-matcher.ts";

const SLAB_IMAGE_ORIGIN = "https://api.srv1964473.hstgr.cloud";
const originalEnv = {
  projectId: process.env["VERTEX_AI_PROJECT_ID"],
  location: process.env["VERTEX_AI_LOCATION"],
  model: process.env["VERTEX_AI_MODEL"],
  fallbackModels: process.env["VERTEX_AI_FALLBACK_MODELS"],
  visionLocation: process.env["VERTEX_VISION_LOCATION"],
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  serviceAccountDisabled: process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"],
};

// The static Thai failure message job 248 requires. Duplicated here on purpose: if the source string ever changes
// (or a raw provider error leaks through), this assertion fails instead of silently moving with it.
const THAI_FAILED_MESSAGE = "ขออภัย ไม่สามารถจับคู่สีหินจากภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const TEST_CREDENTIALS = JSON.stringify({ client_email: "", private_key: privateKey });
const testImage = Buffer.from([0x10, 0x20, 0x30]);
const candidates: StoneMatchCandidate[] = [
  { code: "ST001", name: "Cloud White", slabImageUrl: null },
  { code: "ST002", name: "Silver Mist", slabImageUrl: null },
  { code: "ST003", name: "Warm Sand", slabImageUrl: null },
  { code: "ST004", name: "Deep Charcoal", slabImageUrl: null },
];

function setVertexConfigured() {
  process.env["VERTEX_AI_PROJECT_ID"] = "stone-matcher-test";
  process.env["VERTEX_AI_LOCATION"] = "asia-southeast1";
  // Fake values only (job 248): the names come from src/lib/sketch-vision-config.ts, never from a real environment.
  // The google/ vendor prefix is deliberate — the publisher path must strip it.
  process.env["VERTEX_AI_MODEL"] = "google/gemini-2.5-flash";
  delete process.env["VERTEX_AI_FALLBACK_MODELS"];
  delete process.env["VERTEX_VISION_LOCATION"];
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = TEST_CREDENTIALS;
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"];
}

type VertexCall = { url: string; init?: RequestInit };

/** fetch mock with full control of every generateContent answer; oauth and slab requests keep their defaults. */
function installVertexFetch(
  vertex: (call: { url: string; init?: RequestInit; index: number }) => Response | Promise<Response>,
) {
  const calls: VertexCall[] = [];
  let index = 0;
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "stone-matcher-test-token" }), { status: 200 });
    }
    if (url.startsWith(`${SLAB_IMAGE_ORIGIN}/kb/images/slab/`)) {
      return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url.includes("aiplatform.googleapis.com")) {
      calls.push({ url, init });
      return vertex({ url, init, index: index++ });
    }
    throw new Error(`Unexpected fetch in stone matcher test: ${url}`);
  });
  return calls;
}

function okVertexResponse(modelText: string): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: modelText }] } }],
  }), { status: 200 });
}

function captureWarns() {
  return mock.method(console, "warn", () => {});
}

function loggedText(warns: ReturnType<typeof captureWarns>): string {
  return warns.mock.calls.flatMap((call) => call.arguments).map(String).join("\n");
}

function vertexUrls(calls: VertexCall[]): string[] {
  return calls.filter(({ url }) => url.includes("aiplatform.googleapis.com")).map(({ url }) => url);
}

function mockAllFetches(
  modelText: string,
  options: { onVertexRequest?: (init?: RequestInit) => void } = {},
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "stone-matcher-test-token" }), { status: 200 });
    }
    if (url.startsWith(`${SLAB_IMAGE_ORIGIN}/kb/images/slab/`)) {
      return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url.includes("aiplatform.googleapis.com")) {
      options.onVertexRequest?.(init);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: modelText }] } }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected fetch in stone matcher test: ${url}`);
  });
  return calls;
}

function requestBody(calls: Array<{ url: string; init?: RequestInit }>) {
  const call = calls.find(({ url }) => url.includes("aiplatform.googleapis.com"));
  assert.ok(call, "Vertex AI request should be mocked and observed");
  return JSON.parse(String(call.init?.body)) as {
    contents: Array<{ role?: string; parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> }>;
    generationConfig: { responseMimeType: string };
  };
}

afterEach(() => {
  mock.restoreAll();
  if (originalEnv.projectId === undefined) delete process.env["VERTEX_AI_PROJECT_ID"];
  else process.env["VERTEX_AI_PROJECT_ID"] = originalEnv.projectId;
  if (originalEnv.location === undefined) delete process.env["VERTEX_AI_LOCATION"];
  else process.env["VERTEX_AI_LOCATION"] = originalEnv.location;
  if (originalEnv.serviceAccountJson === undefined) delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  else process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = originalEnv.serviceAccountJson;
  if (originalEnv.applicationCredentials === undefined) delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  else process.env["GOOGLE_APPLICATION_CREDENTIALS"] = originalEnv.applicationCredentials;
  if (originalEnv.serviceAccountDisabled === undefined) delete process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"];
  else process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] = originalEnv.serviceAccountDisabled;
  if (originalEnv.model === undefined) delete process.env["VERTEX_AI_MODEL"];
  else process.env["VERTEX_AI_MODEL"] = originalEnv.model;
  if (originalEnv.fallbackModels === undefined) delete process.env["VERTEX_AI_FALLBACK_MODELS"];
  else process.env["VERTEX_AI_FALLBACK_MODELS"] = originalEnv.fallbackModels;
  if (originalEnv.visionLocation === undefined) delete process.env["VERTEX_VISION_LOCATION"];
  else process.env["VERTEX_VISION_LOCATION"] = originalEnv.visionLocation;
});

describe("suggestStonesForPhoto", () => {
  it("returns not-configured without making any network request when Vertex AI is unset", async () => {
    delete process.env["VERTEX_AI_PROJECT_ID"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    let fetchCalled = false;
    mock.method(globalThis, "fetch", async () => {
      fetchCalled = true;
      throw new Error("Network access is forbidden in this test.");
    });

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "not-configured" });
    assert.equal(fetchCalled, false);
  });

  it("includes every allowed code and name in the prompt and sends the room photo as inline_data", async () => {
    setVertexConfigured();
    const calls = mockAllFetches(JSON.stringify({ matches: [] }));

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "ok", matches: [] });
    const body = requestBody(calls);
    const parts = body.contents[0]!.parts;
    const prompt = parts.find((part) => typeof part.text === "string")?.text ?? "";
    for (const candidate of candidates) {
      assert.ok(prompt.includes(`- ${candidate.code} · ${candidate.name}`));
    }
    assert.ok(prompt.includes('{"matches":[{"code":"...","reason":"..."}]}'));
    assert.match(prompt, /Do not calculate or return prices/);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(parts.some((part) =>
      part.inline_data?.mime_type === "image/jpeg"
      && part.inline_data.data === testImage.toString("base64")));
  });

  it("drops unlisted codes and duplicate codes, using names only from the supplied catalog", async () => {
    setVertexConfigured();
    const calls = mockAllFetches(JSON.stringify({
      matches: [
        { code: "ST002", reason: "Grey veining is similar." },
        { code: "INVENTED-99", reason: "This code was not supplied." },
        { code: "ST002", reason: "Duplicate." },
        { code: "ST001", name: "AI invented name", reason: "Light tone." },
      ],
    }));

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, {
      status: "ok",
      matches: [
        { code: "ST002", name: "Silver Mist", reason: "Grey veining is similar." },
        { code: "ST001", name: "Cloud White", reason: "Light tone." },
      ],
    });
    assert.ok(requestBody(calls));
  });

  it("returns an empty match list instead of throwing when the model text is not JSON", async () => {
    setVertexConfigured();
    mockAllFetches("not JSON");

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "ok", matches: [] });
  });

  it("preserves model rank order and caps valid results at three", async () => {
    setVertexConfigured();
    mockAllFetches(JSON.stringify({
      matches: [
        { code: "ST004", reason: "1" },
        { code: "ST003", reason: "2" },
        { code: "ST002", reason: "3" },
        { code: "ST001", reason: "4" },
      ],
    }));

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, {
      status: "ok",
      matches: [
        { code: "ST004", name: "Deep Charcoal", reason: "1" },
        { code: "ST003", name: "Warm Sand", reason: "2" },
        { code: "ST002", name: "Silver Mist", reason: "3" },
      ],
    });
  });

  it("returns the static Thai message when the Vertex request reaches the 30-second timeout", async () => {
    setVertexConfigured();
    const warns = captureWarns();
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "stone-matcher-test-token" }), { status: 200 });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        return new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")));
        });
      }
      throw new Error(`Unexpected fetch in stone matcher timeout test: ${url}`);
    });
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = suggestStonesForPhoto(testImage, "image/jpeg", candidates);
      mock.timers.tick(30_000);
      const result = await pending;
      assert.deepEqual(result, { status: "failed", message: THAI_FAILED_MESSAGE });
      assert.match(loggedText(warns), /TimeoutError/);
    } finally {
      mock.timers.reset();
    }
  });

  it("includes a fetched official slab image beside its code label", async () => {
    setVertexConfigured();
    const candidateWithImage: StoneMatchCandidate = {
      code: "ST001",
      name: "Cloud White",
      slabImageUrl: `${SLAB_IMAGE_ORIGIN}/kb/images/slab/ST001.png`,
    };
    let capturedBody: ReturnType<typeof requestBody> | undefined;
    const calls = mockAllFetches(JSON.stringify({ matches: [{ code: "ST001", reason: "Similar light veining." }] }), {
      onVertexRequest: (init) => {
        capturedBody = JSON.parse(String(init?.body)) as ReturnType<typeof requestBody>;
      },
    });

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", [candidateWithImage]);

    assert.deepEqual(result, {
      status: "ok",
      matches: [{ code: "ST001", name: "Cloud White", reason: "Similar light veining." }],
    });
    const body = capturedBody ?? requestBody(calls);
    const parts = body.contents[0]!.parts;
    const labelIndex = parts.findIndex((part) => part.text === "Official slab reference for ST001 · Cloud White:");
    assert.ok(labelIndex >= 0);
    assert.deepEqual(parts[labelIndex + 1]?.inline_data, {
      mime_type: "image/png",
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
    });
    assert.ok(calls.some(({ url }) => url === candidateWithImage.slabImageUrl));
  });

  // ---- job 248: model/location from env, role:"user", 404 fallback, error hygiene, never throw ----

  it("sends role \"user\" and the model from VERTEX_AI_MODEL with any google/ prefix stripped", async () => {
    setVertexConfigured();
    const calls = installVertexFetch(() => okVertexResponse(JSON.stringify({ matches: [] })));

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "ok", matches: [] });
    const body = requestBody(calls);
    assert.equal(body.contents[0]?.role, "user");
    const url = vertexUrls(calls)[0] ?? "";
    assert.ok(url.includes("/publishers/google/models/gemini-2.5-flash:generateContent"), url);
    assert.ok(!url.includes("google/gemini-2.5-flash"), url);
    assert.ok(url.startsWith("https://asia-southeast1-aiplatform.googleapis.com/"), url);
  });

  it("takes the location from VERTEX_VISION_LOCATION instead of the shared default", async () => {
    setVertexConfigured();
    process.env["VERTEX_VISION_LOCATION"] = "europe-west4";
    const calls = installVertexFetch(() => okVertexResponse(JSON.stringify({ matches: [] })));

    await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    const url = vertexUrls(calls)[0] ?? "";
    assert.ok(url.startsWith("https://europe-west4-aiplatform.googleapis.com/"), url);
    assert.ok(url.includes("/locations/europe-west4/"), url);
  });

  it("uses the unprefixed host when the location is global", async () => {
    setVertexConfigured();
    process.env["VERTEX_VISION_LOCATION"] = "global";
    const calls = installVertexFetch(() => okVertexResponse(JSON.stringify({ matches: [] })));

    await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    const url = vertexUrls(calls)[0] ?? "";
    assert.ok(
      url.startsWith("https://aiplatform.googleapis.com/v1/projects/stone-matcher-test/locations/global/"),
      url,
    );
    assert.ok(!url.includes("global-aiplatform"), url);
  });

  it("falls back to VERTEX_AI_FALLBACK_MODELS when the configured model is not served (404)", async () => {
    setVertexConfigured();
    process.env["VERTEX_AI_MODEL"] = "google/gemini-retired-001";
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "google/gemini-live-2.5, gemini-never-tried";
    const warns = captureWarns();
    const calls = installVertexFetch(({ index }) => {
      if (index === 0) {
        return new Response(JSON.stringify({
          error: {
            message: "Publisher Model `projects/stone-matcher-test/locations/asia-southeast1/publishers/google/models/gemini-retired-001` was not found or is not served for API version v1.",
          },
        }), { status: 404 });
      }
      return okVertexResponse(JSON.stringify({ matches: [{ code: "ST001", reason: "Closest light tone." }] }));
    });

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, {
      status: "ok",
      matches: [{ code: "ST001", name: "Cloud White", reason: "Closest light tone." }],
    });
    const urls = vertexUrls(calls);
    assert.equal(urls.length, 2);
    assert.ok(urls[0]?.includes("/models/gemini-retired-001:"), urls[0]);
    assert.ok(urls[1]?.includes("/models/gemini-live-2.5:"), urls[1]);
    assert.ok(!urls.some((url) => url.includes("gemini-never-tried")));
    assert.match(loggedText(warns), /not served/);
  });

  it("keeps raw provider error text in the log only; the customer sees the static Thai message", async () => {
    setVertexConfigured();
    const warns = captureWarns();
    const rawError = "projects/stone-prod-secret/locations/asia-southeast1/publishers/google/models/gemini-x: internal error";
    installVertexFetch(() => new Response(JSON.stringify({ error: { message: rawError } }), { status: 500 }));

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "failed", message: THAI_FAILED_MESSAGE });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("stone-prod-secret"), serialized);
    assert.ok(!serialized.includes("asia-southeast1"), serialized);
    assert.ok(loggedText(warns).includes("stone-prod-secret"), loggedText(warns));
  });

  it("returns the static Thai message instead of throwing when the network dies", async () => {
    setVertexConfigured();
    const warns = captureWarns();
    mock.method(globalThis, "fetch", async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.7:443");
    });

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "failed", message: THAI_FAILED_MESSAGE });
    assert.ok(loggedText(warns).includes("ECONNREFUSED"), loggedText(warns));
  });

  it("stays not-configured (no request at all) when VERTEX_AI_MODEL is unset", async () => {
    setVertexConfigured();
    delete process.env["VERTEX_AI_MODEL"];
    let fetchCalled = false;
    mock.method(globalThis, "fetch", async () => {
      fetchCalled = true;
      throw new Error("Network access is forbidden in this test.");
    });

    const result = await suggestStonesForPhoto(testImage, "image/jpeg", candidates);

    assert.deepEqual(result, { status: "not-configured" });
    assert.equal(fetchCalled, false);
  });
});