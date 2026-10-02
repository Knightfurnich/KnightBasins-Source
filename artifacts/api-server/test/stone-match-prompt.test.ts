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
  serviceAccountJson: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  applicationCredentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  serviceAccountDisabled: process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"],
};

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
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = TEST_CREDENTIALS;
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"];
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
    contents: Array<{ parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> }>;
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

  it("returns a failed result when the Vertex request reaches the 30-second timeout", async () => {
    setVertexConfigured();
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
      assert.equal(result.status, "failed");
      if (result.status === "failed") assert.match(result.message, /timed out/);
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
});