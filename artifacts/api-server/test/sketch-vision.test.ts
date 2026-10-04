import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";
import {
  analyzeSketchImage,
  analyzeSketchImageWithUsage,
  parseDimensionToMm,
  parseSketchVisionResponse,
  sketchVisionConfigured,
} from "../src/lib/sketch-vision.ts";

const realFetch = globalThis.fetch;

// A genuine RSA key pair, so the real JWT-signing code in
// lib/google-service-account.ts runs unmocked -- only the token exchange and
// Vertex AI generateContent HTTP calls below are mocked. This never leaves
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

// The Gemini path reads its model id from VERTEX_AI_MODEL (job-240: the code carries no model id of its own).
const TEST_GEMINI_MODEL = "gemini-test-model";

function setVertexConfigured() {
  process.env["VERTEX_AI_PROJECT_ID"] = "knight-basins-voice";
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
  process.env["VERTEX_AI_MODEL"] = TEST_GEMINI_MODEL;
}

/** Mocks Google's token endpoint to always succeed; the caller supplies how
 * the Vertex AI generateContent endpoint itself responds. */
function mockVertexFetch(generateContentResponse: (init?: RequestInit) => Response | Promise<Response>) {
  return mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }
    if (url.includes("aiplatform.googleapis.com")) {
      return generateContentResponse(init);
    }
    return realFetch(input as never, init);
  });
}

type LeadRouteModule = typeof import("../src/routes/leads.ts");

async function startLeadsRoute(database: unknown = {}) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Sketch vision route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function sketchForm(...files: Array<{ name: string; type: string }>) {
  const form = new FormData();
  for (const file of files) {
    form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: file.type }), file.name);
  }
  return form;
}

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  GOOGLE_API_KEY: process.env["GOOGLE_API_KEY"],
  VERTEX_AI_PROJECT_ID: process.env["VERTEX_AI_PROJECT_ID"],
  VERTEX_AI_LOCATION: process.env["VERTEX_AI_LOCATION"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  SKETCH_VISION_PROVIDER: process.env["SKETCH_VISION_PROVIDER"],
  SKETCH_VISION_TIMEOUT_MS: process.env["SKETCH_VISION_TIMEOUT_MS"],
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"],
  OPENROUTER_BASE_URL: process.env["OPENROUTER_BASE_URL"],
  OPENROUTER_VISION_MODEL: process.env["OPENROUTER_VISION_MODEL"],
  VERTEX_AI_MODEL: process.env["VERTEX_AI_MODEL"],
  VERTEX_AI_FALLBACK_MODELS: process.env["VERTEX_AI_FALLBACK_MODELS"],
  VERTEX_VISION_LOCATION: process.env["VERTEX_VISION_LOCATION"],
};
let uploadDirectory: string;

function clearSketchVisionCredentials() {
  delete process.env["GOOGLE_API_KEY"];
  delete process.env["VERTEX_AI_PROJECT_ID"];
  delete process.env["VERTEX_AI_LOCATION"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  for (const key of [
    "SKETCH_VISION_PROVIDER", "SKETCH_VISION_TIMEOUT_MS", "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL", "OPENROUTER_VISION_MODEL",
    "VERTEX_AI_MODEL", "VERTEX_AI_FALLBACK_MODELS", "VERTEX_VISION_LOCATION",
  ]) delete process.env[key];
}

before(async () => {
  process.env["DATABASE_URL"] = "postgres://sketch-vision-test";
  process.env["SESSION_SECRET"] = "sketch-vision-test-secret";
  clearSketchVisionCredentials();
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "sketch-vision-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete process.env["UPLOAD_DIR"];
  await rm(uploadDirectory, { force: true, recursive: true });
});

afterEach(() => {
  mock.restoreAll();
  clearSketchVisionCredentials();
});

describe("parseDimensionToMm", () => {
  it("converts explicit-unit values to millimeters", () => {
    assert.equal(parseDimensionToMm("1.98 m"), 1980);
    assert.equal(parseDimensionToMm("198 cm"), 1980);
    assert.equal(parseDimensionToMm("45 cm"), 450);
    assert.equal(parseDimensionToMm("0.45 m"), 450);
  });

  it("converts bare numbers by magnitude (< 10 as meters, >= 10 as centimeters)", () => {
    assert.equal(parseDimensionToMm("1.98"), 1980);
    assert.equal(parseDimensionToMm("45"), 450);
    assert.equal(parseDimensionToMm(1.98), 1980);
    assert.equal(parseDimensionToMm(45), 450);
    assert.equal(parseDimensionToMm(1980), 1980);
    assert.equal(parseDimensionToMm("1980"), 1980);
    assert.equal(parseDimensionToMm(450), 450);
    assert.equal(parseDimensionToMm("450"), 450);
  });

  it("returns null for an unparseable dimension instead of guessing", () => {
    assert.equal(parseDimensionToMm("ประมาณ 2 เมตร"), null);
    assert.equal(parseDimensionToMm(undefined), null);
    assert.equal(parseDimensionToMm(null), null);
    assert.equal(parseDimensionToMm(""), null);
  });
});

describe("parseSketchVisionResponse", () => {
  it("converts '1.98 m' -> 1980 and '45 cm' -> 450 from a full AI JSON response", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        shape: "L-left",
        runAMm: "1.98 m",
        runBMm: "45 cm",
        runCMm: null,
        depthMm: "60 cm",
        basinCount: 1,
        stoneHint: "BW010",
        rawText: "1.98m x 0.45m",
        confidence: "high",
        notes: null,
      }),
      0,
    );
    assert.equal(item.runAMm, 1980);
    assert.equal(item.runBMm, 450);
    assert.equal(item.depthMm, 600);
    assert.equal(item.shape, "L-left");
    assert.equal(item.confidence, "high");
    assert.equal(item.basinCount, 1);
    assert.equal(item.stoneHint, "BW010");
  });

  it("falls back to an unknown item without throwing when the response is not JSON", () => {
    assert.doesNotThrow(() => parseSketchVisionResponse("not json at all", 2));
    const item = parseSketchVisionResponse("not json at all", 2);
    assert.equal(item.shape, "unknown");
    assert.equal(item.index, 2);
    assert.equal(item.runAMm, null);
    assert.equal(item.confidence, "low");
    assert.ok(item.notes);
  });

  it("falls back to unknown when the parsed JSON is not an object (e.g. a bare number or array)", () => {
    assert.equal(parseSketchVisionResponse("42", 0).shape, "unknown");
    assert.equal(parseSketchVisionResponse("[1,2,3]", 0).shape, "unknown");
  });

  it("rejects an unrecognized shape/confidence value rather than trusting the AI blindly", () => {
    const item = parseSketchVisionResponse(JSON.stringify({ shape: "circle", confidence: "certain" }), 0);
    assert.equal(item.shape, "unknown");
    assert.equal(item.confidence, "low");
  });
});

describe("parseSketchVisionResponse -- workpieces breakdown (job-76)", () => {
  it("parses multiple workpieces from one image, each with its own shape and label", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        workpieces: [
          { id: "wp-bottom", shape: "L-left", label: "ชิ้นล่าง (เคาน์เตอร์ครัว)", dimensionsSummary: "1.98 x 0.6 ม.", panels: [], edges: [], cutouts: [] },
          { id: "wp-top", shape: "I", label: "ชิ้นบน (ตู้ลอย)", dimensionsSummary: "1.2 ม.", panels: [], edges: [], cutouts: [] },
        ],
      }),
      0,
    );
    assert.equal(item.workpieceCount, 2);
    assert.equal(item.workpieces.length, 2);
    assert.equal(item.workpieces[0]?.id, "wp-bottom");
    assert.equal(item.workpieces[0]?.shape, "L-left");
    assert.equal(item.workpieces[0]?.label, "ชิ้นล่าง (เคาน์เตอร์ครัว)");
    assert.equal(item.workpieces[1]?.id, "wp-top");
    assert.equal(item.workpieces[1]?.shape, "I");
  });

  it("converts each panel's lengthMm/depthMm units to millimeters, same rules as the top-level fields", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        workpieces: [
          {
            shape: "L-left",
            panels: [
              { panelIndex: 0, label: "แผ่นหลัง", lengthMm: "1.98 m", depthMm: "60 cm" },
              { panelIndex: 1, label: "แผ่นขา", lengthMm: "45 cm", depthMm: "0.6 m" },
            ],
            edges: [],
            cutouts: [],
          },
        ],
      }),
      0,
    );
    const [panelA, panelB] = item.workpieces[0]!.panels;
    assert.equal(panelA?.lengthMm, 1980);
    assert.equal(panelA?.depthMm, 600);
    assert.equal(panelB?.lengthMm, 450);
    assert.equal(panelB?.depthMm, 600);
  });

  it("maps all 4 edge-finish symbols plus the joint status through unchanged", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        workpieces: [
          {
            shape: "U",
            panels: [],
            edges: [
              { side: "top", status: "upstand" },
              { side: "front", status: "wall-flush" },
              { side: "left", status: "open-edge" },
              { side: "right", status: "closed-edge" },
            ],
            cutouts: [],
          },
        ],
      }),
      0,
    );
    const byStatus = Object.fromEntries(item.workpieces[0]!.edges.map((edge) => [edge.side, edge.status]));
    assert.equal(byStatus["top"], "upstand");
    assert.equal(byStatus["front"], "wall-flush");
    assert.equal(byStatus["left"], "open-edge");
    assert.equal(byStatus["right"], "closed-edge");
  });

  it("keeps a 'joint' edge status as-is and defaults an unrecognized status to 'unknown' rather than guessing", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        workpieces: [
          {
            shape: "I",
            panels: [],
            edges: [
              { side: "top", status: "joint" },
              { side: "front", status: "some-made-up-status" },
            ],
            cutouts: [],
          },
        ],
      }),
      0,
    );
    const edges = item.workpieces[0]!.edges;
    assert.equal(edges.find((edge) => edge.side === "top")?.status, "joint");
    assert.equal(edges.find((edge) => edge.side === "front")?.status, "unknown");
  });

  it("drops an edge entry with an unrecognized side entirely instead of attaching a guessed side", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({ workpieces: [{ shape: "I", panels: [], edges: [{ side: "diagonal", status: "upstand" }], cutouts: [] }] }),
      0,
    );
    assert.equal(item.workpieces[0]!.edges.length, 0);
  });

  it("parses cutouts (basin/hob/other) with their description and count", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        workpieces: [
          {
            shape: "I",
            panels: [],
            edges: [],
            cutouts: [
              { type: "basin", description: "อ่างล้างหน้า 1 หลุม กลางแผ่น", count: 1 },
              { type: "hob", description: "เตาแก๊ส 2 หัว", count: 1 },
              { type: "other", description: "ช่องเสียบปลั๊ก", count: 2 },
            ],
          },
        ],
      }),
      0,
    );
    const [basin, hob, other] = item.workpieces[0]!.cutouts;
    assert.equal(basin?.type, "basin");
    assert.equal(basin?.description, "อ่างล้างหน้า 1 หลุม กลางแผ่น");
    assert.equal(hob?.type, "hob");
    assert.equal(other?.count, 2);
  });

  it("never deducts cutout area from anything -- cutouts carry only description/count, no area or price fields", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({ workpieces: [{ shape: "I", panels: [], edges: [], cutouts: [{ type: "basin", description: "อ่าง", count: 1 }] }] }),
      0,
    );
    const cutout = item.workpieces[0]!.cutouts[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(cutout).sort(), ["count", "description", "type"]);
  });

  it("derives the legacy top-level fields (shape/runAMm/runBMm/runCMm/depthMm/basinCount) from workpieces[0], ignoring a mismatched top-level value", () => {
    const item = parseSketchVisionResponse(
      JSON.stringify({
        // A stray/inconsistent top-level block that must be ignored once workpieces[] exists.
        shape: "unknown",
        runAMm: 1,
        basinCount: 99,
        workpieces: [
          {
            shape: "U",
            panels: [
              { panelIndex: 0, label: "หลัง", lengthMm: 1500, depthMm: 600 },
              { panelIndex: 1, label: "ขาซ้าย", lengthMm: 600, depthMm: 1200 },
              { panelIndex: 2, label: "ขาขวา", lengthMm: 600, depthMm: 1200 },
            ],
            edges: [],
            cutouts: [
              { type: "basin", description: "อ่างซ้าย", count: 1 },
              { type: "basin", description: "อ่างขวา", count: 1 },
            ],
          },
        ],
      }),
      0,
    );
    assert.equal(item.shape, "U");
    assert.equal(item.runAMm, 1500);
    assert.equal(item.runBMm, 600);
    assert.equal(item.runCMm, 600);
    assert.equal(item.depthMm, 600);
    assert.equal(item.basinCount, 2, "basinCount must sum the basin cutouts' count, not trust the stray top-level 99");
  });

  it("falls back to the old flat top-level fields when the AI returns no workpieces array at all", () => {
    const item = parseSketchVisionResponse(JSON.stringify({ shape: "I", runAMm: "1.98 m", basinCount: 1 }), 0);
    assert.equal(item.workpieceCount, 0);
    assert.deepEqual(item.workpieces, []);
    assert.equal(item.shape, "I");
    assert.equal(item.runAMm, 1980);
    assert.equal(item.basinCount, 1);
  });

  it("never throws and degrades to an empty breakdown when the AI returns an empty or incomplete JSON object", () => {
    assert.doesNotThrow(() => parseSketchVisionResponse("{}", 0));
    const empty = parseSketchVisionResponse("{}", 0);
    assert.equal(empty.workpieceCount, 0);
    assert.deepEqual(empty.workpieces, []);
    assert.equal(empty.shape, "unknown");

    assert.doesNotThrow(() => parseSketchVisionResponse(JSON.stringify({ workpieces: [{}, null, "not-an-object", 42] }), 0));
    const partial = parseSketchVisionResponse(JSON.stringify({ workpieces: [{}, null, "not-an-object", 42] }), 0);
    assert.equal(partial.workpieceCount, 1, "only the one genuinely object-shaped entry survives; the rest are dropped, not thrown");
    assert.deepEqual(partial.workpieces[0]!.panels, []);
    assert.deepEqual(partial.workpieces[0]!.edges, []);
    assert.deepEqual(partial.workpieces[0]!.cutouts, []);
  });

  it("never throws when a workpiece's panels/edges/cutouts are missing or the wrong type entirely", () => {
    assert.doesNotThrow(() => parseSketchVisionResponse(JSON.stringify({ workpieces: [{ shape: "I" }] }), 0));
    const missingArrays = parseSketchVisionResponse(JSON.stringify({ workpieces: [{ shape: "I" }] }), 0);
    assert.deepEqual(missingArrays.workpieces[0]!.panels, []);
    assert.deepEqual(missingArrays.workpieces[0]!.edges, []);
    assert.deepEqual(missingArrays.workpieces[0]!.cutouts, []);

    const wrongTypes = parseSketchVisionResponse(
      JSON.stringify({ workpieces: [{ shape: "I", panels: "not-an-array", edges: 5, cutouts: {} }] }),
      0,
    );
    assert.deepEqual(wrongTypes.workpieces[0]!.panels, []);
    assert.deepEqual(wrongTypes.workpieces[0]!.edges, []);
    assert.deepEqual(wrongTypes.workpieces[0]!.cutouts, []);
  });
});

describe("analyzeSketchImage", () => {
  it("returns an unknown item without calling fetch when neither Service Account nor GOOGLE_API_KEY is configured", async () => {
    assert.equal(sketchVisionConfigured(), false);
    let called = false;
    mock.method(globalThis, "fetch", async () => {
      called = true;
      return new Response("{}");
    });
    const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
    assert.equal(called, false, "must never call the AI when no credentials are configured");
    assert.equal(item.shape, "unknown");
    assert.equal(item.confidence, "low");
    assert.equal(item.index, 0);
    assert.ok(item.notes);
  });

  describe("Vertex AI Service Account flow (job-126)", () => {
    it("is configured when VERTEX_AI_PROJECT_ID, a Google Service Account and VERTEX_AI_MODEL are all set", () => {
      setVertexConfigured();
      assert.equal(sketchVisionConfigured(), true);
    });

    it("sends a Service Account bearer token to the Vertex AI generateContent endpoint (default location)", async () => {
      setVertexConfigured();
      let capturedAuth = "";
      let capturedBody: Record<string, unknown> = {};
      mockVertexFetch((init) => {
        capturedAuth = String((init?.headers as Record<string, string> | undefined)?.["Authorization"]);
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shape: "I", confidence: "high" }) }] } }] }), { status: 200 });
      });
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(capturedAuth, "Bearer fake-access-token");
      assert.ok(Array.isArray(capturedBody["contents"] as Array<unknown>));
      assert.equal(item.shape, "I");
      assert.equal(item.confidence, "high");
    });

    it("uses VERTEX_AI_LOCATION override in the request URL", async () => {
      setVertexConfigured();
      process.env["VERTEX_AI_LOCATION"] = "us-central1";
      let capturedUrl = "";
      mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
        }
        if (url.includes("aiplatform.googleapis.com")) {
          capturedUrl = url;
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
        }
        return realFetch(input as never, init);
      });
      await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(capturedUrl, "https://us-central1-aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/us-central1/publishers/google/models/gemini-test-model:generateContent");
    });

    it("falls back to an unknown item without throwing when the token exchange fails", async () => {
      setVertexConfigured();
      let vertexCalled = false;
      mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
        }
        if (url.includes("aiplatform.googleapis.com")) {
          vertexCalled = true;
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
        }
        return realFetch(input as never, undefined);
      });
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(vertexCalled, false, "must not call generateContent when the token exchange failed");
      assert.equal(item.shape, "unknown");
      assert.ok(item.notes);
    });

    it("falls back to GOOGLE_API_KEY mode when no Service Account is configured but an API key is set", async () => {
      process.env["GOOGLE_API_KEY"] = "fake-api-key";
      process.env["VERTEX_AI_MODEL"] = TEST_GEMINI_MODEL;
      let capturedUrl = "";
      mock.method(globalThis, "fetch", async (input: string | URL) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shape: "L-left" }) }] } }] }), { status: 200 });
      });
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.match(capturedUrl, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test-model:generateContent\?key=fake-api-key$/);
      assert.equal(item.shape, "L-left");
    });

    it("prefers the Service Account over GOOGLE_API_KEY when both are configured", async () => {
      setVertexConfigured();
      process.env["GOOGLE_API_KEY"] = "fake-api-key";
      let calledVertex = false;
      let calledApiKey = false;
      mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
        }
        if (url.includes("aiplatform.googleapis.com")) {
          calledVertex = true;
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
        }
        if (url.includes("generativelanguage.googleapis.com")) {
          calledApiKey = true;
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
        }
        return realFetch(input as never, undefined);
      });
      await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(calledVertex, true);
      assert.equal(calledApiKey, false);
    });
  });
});

describe("POST /api/sketch/analyze", () => {
  it("returns 200 with shape unknown for every item when GOOGLE_API_KEY is not configured", async () => {
    const server = await startLeadsRoute();
    try {
      const response = await fetch(`${server.url}/api/sketch/analyze`, {
        method: "POST",
        body: sketchForm({ name: "sketch.png", type: "image/png" }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ index: number; shape: string }> };
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0]?.shape, "unknown");
      assert.equal(body.items[0]?.index, 0);
    } finally {
      await server.close();
    }
  });

  it("processes multiple images with the correct index each, up to the 3-file limit", async () => {
    const server = await startLeadsRoute();
    try {
      const response = await fetch(`${server.url}/api/sketch/analyze`, {
        method: "POST",
        body: sketchForm({ name: "a.png", type: "image/png" }, { name: "b.png", type: "image/png" }, { name: "c.png", type: "image/png" }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { items: Array<{ index: number }> };
      assert.deepEqual(body.items.map((item) => item.index), [0, 1, 2]);
    } finally {
      await server.close();
    }
  });

  it("rejects a 4th file over the MAX_SKETCH_VISION_FILES limit of 3 with a 400", async () => {
    const server = await startLeadsRoute();
    try {
      const response = await fetch(`${server.url}/api/sketch/analyze`, {
        method: "POST",
        body: sketchForm(
          { name: "a.png", type: "image/png" },
          { name: "b.png", type: "image/png" },
          { name: "c.png", type: "image/png" },
          { name: "d.png", type: "image/png" },
        ),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// job-240: provider choice (OpenRouter / Gemini / auto), the Vertex repairs, error hygiene and usage -> cost center.
// ---------------------------------------------------------------------------------------------------------------------

const OPENROUTER_TEST_BASE = "https://openrouter.test/api/v1";
const READING = { shape: "I", confidence: "high", workpieces: [{ id: "w1", shape: "I", label: "ชิ้นล่าง", dimensionsSummary: "1.98 x 0.6 ม.", panels: [{ panelIndex: 0, label: "แผ่น 1", lengthMm: 1980, depthMm: 600 }], edges: [], cutouts: [] }] };

type ProviderKind = "openrouter" | "vertex" | "aistudio";
type ProviderCall = { kind: ProviderKind; url: string; headers: Record<string, string>; body: Record<string, any> };
type ProviderHandler = (call: ProviderCall, init?: RequestInit) => Response | Promise<Response>;

function openRouterReply(reading: unknown, usage: { prompt_tokens?: number; completion_tokens?: number } | null = { prompt_tokens: 1847, completion_tokens: 5509 }, model = "deepseek/deepseek-v4.1-flash") {
  return new Response(JSON.stringify({ model, choices: [{ message: { content: typeof reading === "string" ? reading : JSON.stringify(reading) } }], ...(usage ? { usage } : {}) }), { status: 200 });
}

function geminiReply(reading: unknown, usageMetadata: Record<string, number> | null = { promptTokenCount: 3000, candidatesTokenCount: 500 }) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof reading === "string" ? reading : JSON.stringify(reading) }] } }], ...(usageMetadata ? { usageMetadata } : {}) }), { status: 200 });
}

/** Routes the three providers' endpoints to the given handlers (an endpoint without a handler fails the test) and records every call. */
function mockProviders(handlers: Partial<Record<ProviderKind, ProviderHandler>>) {
  const calls: ProviderCall[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    const kind: ProviderKind | null = url.startsWith(OPENROUTER_TEST_BASE) ? "openrouter"
      : url.includes("aiplatform.googleapis.com") ? "vertex"
      : url.includes("generativelanguage.googleapis.com") ? "aistudio" : null;
    if (!kind) return realFetch(input as never, init);
    const call: ProviderCall = { kind, url, headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    const handler = handlers[kind];
    if (!handler) throw new Error(`unexpected call to ${kind}`);
    return handler(call, init);
  });
  return calls;
}

/** Captures console.warn: a provider failure is logged, and the test output stays clean. */
function captureWarnings() {
  const lines: string[] = [];
  mock.method(console, "warn", (...args: unknown[]) => { lines.push(args.map(String).join(" ")); });
  return lines;
}

function setOpenRouterConfigured() {
  process.env["OPENROUTER_API_KEY"] = "or-test-key";
  process.env["OPENROUTER_BASE_URL"] = OPENROUTER_TEST_BASE;
}

const IMAGE = Buffer.from("fake-image-bytes");

describe("job-240: OpenRouter provider", () => {
  it("SKETCH_VISION_PROVIDER=openrouter posts to {base}/chat/completions with deepseek/deepseek-v4.1-flash and the key as a bearer token", async () => {
    process.env["SKETCH_VISION_PROVIDER"] = "openrouter";
    setOpenRouterConfigured();
    const calls = mockProviders({ openrouter: () => openRouterReply(READING) });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${OPENROUTER_TEST_BASE}/chat/completions`);
    assert.equal(calls[0]!.body["model"], "deepseek/deepseek-v4.1-flash");
    assert.equal(calls[0]!.headers["Authorization"], "Bearer or-test-key");
    assert.equal(item.shape, "I");
    assert.equal(item.runAMm, 1980);
  });

  it("sends the picture as a data URL with detail \"high\" beside the prompt, in JSON mode, as a user message", async () => {
    setOpenRouterConfigured();
    const calls = mockProviders({ openrouter: () => openRouterReply(READING) });
    await analyzeSketchImage(IMAGE, "image/jpeg", 0);
    const body = calls[0]!.body;
    assert.deepEqual(body["response_format"], { type: "json_object" });
    assert.equal(body["messages"].length, 1);
    assert.equal(body["messages"][0].role, "user");
    const [text, image] = body["messages"][0].content;
    assert.equal(text.type, "text");
    assert.match(text.text, /workpieces/);
    assert.equal(image.type, "image_url");
    assert.equal(image.image_url.url, `data:image/jpeg;base64,${IMAGE.toString("base64")}`);
    assert.equal(image.image_url.detail, "high");
  });

  it("OPENROUTER_VISION_MODEL overrides the model; a trailing slash on OPENROUTER_BASE_URL is harmless", async () => {
    setOpenRouterConfigured();
    process.env["OPENROUTER_BASE_URL"] = `${OPENROUTER_TEST_BASE}/`;
    process.env["OPENROUTER_VISION_MODEL"] = "some-vendor/some-vision-model";
    const calls = mockProviders({ openrouter: () => openRouterReply(READING) });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(calls[0]!.url, `${OPENROUTER_TEST_BASE}/chat/completions`);
    assert.equal(calls[0]!.body["model"], "some-vendor/some-vision-model");
  });

  it("accepts an answer wrapped in a ```json fence", async () => {
    setOpenRouterConfigured();
    mockProviders({ openrouter: () => openRouterReply("```json\n" + JSON.stringify(READING) + "\n```") });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(item.shape, "I");
    assert.equal(item.runAMm, 1980);
  });

  it("is configured with only an OpenRouter key (no Google credentials at all)", () => {
    assert.equal(sketchVisionConfigured(), false);
    process.env["OPENROUTER_API_KEY"] = "or-test-key";
    assert.equal(sketchVisionConfigured(), true);
  });
});

describe("job-240: choosing and falling back between providers", () => {
  const vertexOk: ProviderHandler = () => geminiReply({ ...READING, shape: "L-left", workpieces: [] });

  it("auto: tries OpenRouter first when it has a key", async () => {
    setOpenRouterConfigured();
    setVertexConfigured();
    const calls = mockProviders({ openrouter: () => openRouterReply(READING), vertex: vertexOk });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter"]);
  });

  it("auto: falls back to Gemini when OpenRouter answers 500, and the result is Gemini's", async () => {
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    const calls = mockProviders({ openrouter: () => new Response("upstream exploded", { status: 500 }), vertex: vertexOk });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter", "vertex"]);
    assert.equal(item.shape, "L-left", "the reading comes from the Gemini answer");
  });

  it("auto: uses Gemini alone when there is no OpenRouter key", async () => {
    setVertexConfigured();
    const calls = mockProviders({ vertex: vertexOk });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["vertex"]);
    assert.equal(item.shape, "L-left");
  });

  it("SKETCH_VISION_PROVIDER=gemini: Gemini goes first, OpenRouter is the fallback", async () => {
    process.env["SKETCH_VISION_PROVIDER"] = "gemini";
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    const firstRound = mockProviders({ openrouter: () => openRouterReply(READING), vertex: vertexOk });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(firstRound.map((call) => call.kind), ["vertex"]);
    mock.restoreAll();
    captureWarnings();
    const secondRound = mockProviders({ openrouter: () => openRouterReply(READING), vertex: () => new Response("{}", { status: 500 }) });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(secondRound.map((call) => call.kind), ["vertex", "openrouter"]);
    assert.equal(item.shape, "I");
  });

  it("SKETCH_VISION_PROVIDER=openrouter: OpenRouter first, and Gemini still catches a failure", async () => {
    process.env["SKETCH_VISION_PROVIDER"] = "openrouter";
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    const calls = mockProviders({ openrouter: () => new Response("{}", { status: 503 }), vertex: vertexOk });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter", "vertex"]);
    assert.equal(item.shape, "L-left");
  });

  it("a named provider that is not configured is skipped: gemini requested but only OpenRouter has credentials", async () => {
    process.env["SKETCH_VISION_PROVIDER"] = "gemini";
    setOpenRouterConfigured();
    const calls = mockProviders({ openrouter: () => openRouterReply(READING) });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter"]);
    assert.equal(item.shape, "I");
  });

  it("an unrecognised SKETCH_VISION_PROVIDER means auto", async () => {
    process.env["SKETCH_VISION_PROVIDER"] = "deepseek-direct";
    setOpenRouterConfigured();
    captureWarnings();
    const calls = mockProviders({ openrouter: () => openRouterReply(READING) });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter"]);
  });

  it("an answer that is not a JSON object counts as a failure and the next provider is asked", async () => {
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    const calls = mockProviders({ openrouter: () => openRouterReply("sorry, I cannot read this"), vertex: vertexOk });
    const { item, usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter", "vertex"]);
    assert.equal(item.shape, "L-left");
    assert.deepEqual(usages.map((usage) => [usage.provider, usage.success]), [["openrouter", false], ["gemini", true]], "the billed-but-unusable call is still counted");
  });

  it("a provider that hangs is cut off after SKETCH_VISION_TIMEOUT_MS and the next one answers", async () => {
    process.env["SKETCH_VISION_TIMEOUT_MS"] = "40";
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    const calls = mockProviders({
      openrouter: (_call, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
      vertex: vertexOk,
    });
    // the guard turns "never cut off" into a failing test instead of one that waits for ever
    const item = await Promise.race([
      analyzeSketchImage(IMAGE, "image/png", 0),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("the hanging provider was not cut off")), 3000).unref()),
    ]);
    assert.deepEqual(calls.map((call) => call.kind), ["openrouter", "vertex"]);
    assert.equal(item.shape, "L-left");
  });

  it("when every provider fails the result is the unknown shape with a Thai note (and never a throw)", async () => {
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    mockProviders({ openrouter: () => new Response("{}", { status: 500 }), vertex: () => new Response("{}", { status: 500 }) });
    const { item, usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 2);
    assert.equal(item.shape, "unknown");
    assert.equal(item.index, 2);
    assert.match(item.notes ?? "", /[฀-๿]/);
    assert.deepEqual(usages, [], "no provider answered, so nothing was billed");
  });
});

describe("job-240: the Vertex / Gemini path", () => {
  const ok: ProviderHandler = () => geminiReply(READING);

  it("sends the content as a user turn (role \"user\"), on Vertex and on the API-key endpoint", async () => {
    setVertexConfigured();
    const vertex = mockProviders({ vertex: ok });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(vertex[0]!.body["contents"][0].role, "user");
    assert.equal(vertex[0]!.body["contents"][0].parts[1].inline_data.mime_type, "image/png");
    mock.restoreAll();
    clearSketchVisionCredentials();
    process.env["GOOGLE_API_KEY"] = "fake-api-key";
    process.env["VERTEX_AI_MODEL"] = TEST_GEMINI_MODEL;
    const studio = mockProviders({ aistudio: ok });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(studio[0]!.body["contents"][0].role, "user");
  });

  it("VERTEX_VISION_LOCATION=global uses aiplatform.googleapis.com with no region prefix", async () => {
    setVertexConfigured();
    process.env["VERTEX_VISION_LOCATION"] = "global";
    const calls = mockProviders({ vertex: ok });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(calls[0]!.url, `https://aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/global/publishers/google/models/${TEST_GEMINI_MODEL}:generateContent`);
    assert.doesNotMatch(calls[0]!.url, /global-aiplatform/);
  });

  it("keeps the regional host for a region, and VERTEX_VISION_LOCATION wins over VERTEX_AI_LOCATION", async () => {
    setVertexConfigured();
    process.env["VERTEX_AI_LOCATION"] = "us-central1";
    process.env["VERTEX_VISION_LOCATION"] = "europe-west1";
    const calls = mockProviders({ vertex: ok });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.match(calls[0]!.url, /^https:\/\/europe-west1-aiplatform\.googleapis\.com\/v1\/projects\/knight-basins-voice\/locations\/europe-west1\//);
  });

  it("takes the model id from VERTEX_AI_MODEL, dropping the \"google/\" prefix that vertex-gemini.ts uses", async () => {
    setVertexConfigured();
    process.env["VERTEX_AI_MODEL"] = "google/some-gemini-model";
    const calls = mockProviders({ vertex: ok });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.match(calls[0]!.url, /\/publishers\/google\/models\/some-gemini-model:generateContent$/);
  });

  it("moves to the next VERTEX_AI_FALLBACK_MODELS entry when the project does not serve a model (404), with a warning", async () => {
    setVertexConfigured();
    process.env["VERTEX_AI_MODEL"] = "retired-model";
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "backup-model, other-backup";
    const warnings = captureWarnings();
    const calls = mockProviders({
      vertex: (call) => call.url.includes("/retired-model:")
        ? new Response(JSON.stringify({ error: { message: "Publisher Model `projects/knight-basins-voice/locations/asia-southeast1/publishers/google/models/retired-model` was not found" } }), { status: 404 })
        : geminiReply(READING),
    });
    const { item, usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.deepEqual(calls.map((call) => call.url.match(/models\/([^:]+):/)?.[1]), ["retired-model", "backup-model"]);
    assert.equal(item.shape, "I");
    assert.equal(usages[0]?.model, "backup-model", "the cost is labelled with the model that really answered");
    assert.ok(warnings.some((line) => line.includes("retired-model") && line.includes("backup-model")), "the retirement is logged");
  });

  it("does not try another model for a failure that is not \"model not served\" (e.g. 403)", async () => {
    setVertexConfigured();
    process.env["VERTEX_AI_FALLBACK_MODELS"] = "backup-model";
    captureWarnings();
    const calls = mockProviders({ vertex: () => new Response(JSON.stringify({ error: { message: "Permission denied" } }), { status: 403 }) });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(calls.length, 1);
    assert.equal(item.shape, "unknown");
  });

  it("is not configured when Google credentials exist but VERTEX_AI_MODEL does not (no built-in model id)", async () => {
    setVertexConfigured();
    delete process.env["VERTEX_AI_MODEL"];
    captureWarnings();
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response("{}"); });
    assert.equal(sketchVisionConfigured(), false);
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.equal(called, false);
    assert.equal(item.shape, "unknown");
  });
});

describe("job-240: nothing configured, and what a customer may read", () => {
  it("with no key from either provider no request is made and the note is Thai without naming any setting", async () => {
    let called = false;
    mock.method(globalThis, "fetch", async () => { called = true; return new Response("{}"); });
    const { item, usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.equal(called, false);
    assert.equal(item.shape, "unknown");
    assert.match(item.notes ?? "", /[฀-๿]/);
    assert.doesNotMatch(item.notes ?? "", /GOOGLE|OPENROUTER|VERTEX|API_KEY|Service Account/i);
    assert.deepEqual(usages, []);
  });

  const LEAKY = "Publisher Model `projects/secret-gcp-project/locations/asia-southeast1/publishers/google/models/x` was not found; key sk-or-v1-abcdef";
  const LEAK_PATTERN = /secret-gcp-project|asia-southeast1|publishers|sk-or|not found/i;

  it("a Gemini error message (project, region, model path) is logged but never reaches notes", async () => {
    setVertexConfigured();
    const warnings = captureWarnings();
    mockProviders({ vertex: () => new Response(JSON.stringify({ error: { message: LEAKY } }), { status: 404 }) });
    const item = await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.doesNotMatch(item.notes ?? "", LEAK_PATTERN);
    assert.match(item.notes ?? "", /[฀-๿]/);
    assert.ok(warnings.some((line) => line.includes("secret-gcp-project")), "operators still see the real error in the log");
  });

  it("an OpenRouter error message is logged but never reaches notes (HTTP 402, and an error object inside a 200)", async () => {
    setOpenRouterConfigured();
    for (const status of [402, 200]) {
      const warnings = captureWarnings();
      mockProviders({ openrouter: () => new Response(JSON.stringify({ error: { message: LEAKY } }), { status }) });
      const item = await analyzeSketchImage(IMAGE, "image/png", 0);
      assert.doesNotMatch(item.notes ?? "", LEAK_PATTERN, `status ${status}`);
      assert.equal(item.shape, "unknown");
      assert.ok(warnings.some((line) => line.includes("secret-gcp-project")), `status ${status}: logged for operators`);
      mock.restoreAll();
    }
  });

  it("the log never carries the image, the request body or the key", async () => {
    setOpenRouterConfigured();
    const warnings = captureWarnings();
    mockProviders({ openrouter: () => new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }) });
    await analyzeSketchImage(IMAGE, "image/png", 0);
    assert.ok(warnings.length > 0);
    for (const line of warnings) {
      assert.ok(!line.includes(IMAGE.toString("base64")), line);
      assert.ok(!line.includes("or-test-key"), line);
    }
  });
});

describe("job-240: usage reported with each reading", () => {
  it("OpenRouter: provider, the requested model and the prompt/completion tokens it reported", async () => {
    setOpenRouterConfigured();
    mockProviders({ openrouter: () => openRouterReply(READING, { prompt_tokens: 1847, completion_tokens: 5509 }, "deepseek/deepseek-v4.1-flash-20261001") });
    const { usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.equal(usages.length, 1);
    assert.equal(usages[0]!.provider, "openrouter");
    assert.equal(usages[0]!.model, "deepseek/deepseek-v4.1-flash", "labelled with the requested id (the price table's key), not a dated variant");
    assert.equal(usages[0]!.promptTokens, 1847);
    assert.equal(usages[0]!.completionTokens, 5509);
    assert.equal(usages[0]!.success, true);
    assert.ok(usages[0]!.durationMs >= 0);
  });

  it("Gemini: model and token counts from usageMetadata, with reasoning tokens counted as output", async () => {
    setVertexConfigured();
    mockProviders({ vertex: () => geminiReply(READING, { promptTokenCount: 3531, candidatesTokenCount: 400, thoughtsTokenCount: 100 }) });
    const { usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.deepEqual(usages.map((usage) => [usage.provider, usage.model, usage.promptTokens, usage.completionTokens]), [["gemini", TEST_GEMINI_MODEL, 3531, 500]]);
  });

  it("tokens are null (not 0) when the provider reports none", async () => {
    setOpenRouterConfigured();
    mockProviders({ openrouter: () => openRouterReply(READING, null) });
    const { usages } = await analyzeSketchImageWithUsage(IMAGE, "image/png", 0);
    assert.equal(usages[0]!.promptTokens, null);
    assert.equal(usages[0]!.completionTokens, null);
  });
});

type ConfigModule = typeof import("../src/lib/sketch-vision-config.ts");
const loadConfig = () => importTypeScriptModule<ConfigModule>("src/lib/sketch-vision-config.ts");

describe("job-240: cost center bills the usage the route receives", () => {
  type CostEntry = {
    createLeadsRouter: LeadRouteModule["createLeadsRouter"];
    getUnifiedAiCostSummary: typeof import("../src/lib/ai-cost-tracker.ts")["getUnifiedAiCostSummary"];
    clearAiUsageEvents: () => void;
    calculateModelCostThb: typeof import("../src/lib/ai-cost-tracker.ts")["calculateModelCostThb"];
  };

  /** The route and the cost tracker bundled together, so they share one in-memory event log (a separate import would not). */
  async function startCostRoute() {
    const entry = path.join(uploadDirectory, "cost-entry.ts");
    const root = path.resolve(import.meta.dirname, "..").replaceAll("\\", "/");
    await writeFile(entry, [
      `export { createLeadsRouter } from "${root}/src/routes/leads.ts";`,
      `export { getUnifiedAiCostSummary, clearAiUsageEvents, calculateModelCostThb } from "${root}/src/lib/ai-cost-tracker.ts";`,
    ].join("\n"));
    const module = await importTypeScriptModule<CostEntry>(entry);
    const app = express();
    app.use(express.json());
    app.use("/api", module.createLeadsRouter({} as never));
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("cost route test server did not expose a TCP address");
    return { module, url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
  }

  const postSketch = (url: string) => fetch(`${url}/api/sketch/analyze`, { method: "POST", body: sketchForm({ name: "sketch.png", type: "image/png" }) });
  const sketchService = (summary: { services: Array<{ id: string; requests: number; tokens: number; costThb: number }> }) => summary.services.find((service) => service.id === "sketch_vision")!;

  before(() => {
    process.env["HERMES_AUDIT_LOG_PATH"] = "/tmp/non-existent-hermes-audit.jsonl";
  });
  after(() => {
    delete process.env["HERMES_AUDIT_LOG_PATH"];
  });

  it("records the model and tokens of an OpenRouter reading and prices deepseek/deepseek-v4.1-flash above 0", async () => {
    setOpenRouterConfigured();
    mockProviders({ openrouter: () => openRouterReply(READING, { prompt_tokens: 1847, completion_tokens: 5509 }) });
    const route = await startCostRoute();
    try {
      route.module.clearAiUsageEvents();
      const response = await postSketch(route.url);
      assert.equal(response.status, 200);
      const summary = route.module.getUnifiedAiCostSummary("all");
      const sketch = sketchService(summary);
      assert.equal(sketch.requests, 1);
      assert.equal(sketch.tokens, 1847 + 5509);
      const expected = route.module.calculateModelCostThb("deepseek/deepseek-v4.1-flash", 1847, 5509, 0);
      assert.ok(expected > 0, "the model must not be priced at 0");
      assert.equal(sketch.costThb, Math.round(expected * 100) / 100);
      assert.deepEqual(summary.modelBreakdown.map((entry) => entry.model), ["deepseek/deepseek-v4.1-flash"]);
    } finally {
      await route.close();
    }
  });

  it("falling back records both calls that were billed, each under its own model", async () => {
    setOpenRouterConfigured();
    setVertexConfigured();
    captureWarnings();
    mockProviders({ openrouter: () => openRouterReply("not json at all"), vertex: () => geminiReply(READING, { promptTokenCount: 3000, candidatesTokenCount: 500 }) });
    const route = await startCostRoute();
    try {
      route.module.clearAiUsageEvents();
      await postSketch(route.url);
      const summary = route.module.getUnifiedAiCostSummary("all");
      assert.deepEqual(summary.modelBreakdown.map((entry) => entry.model).sort(), ["deepseek/deepseek-v4.1-flash", TEST_GEMINI_MODEL].sort());
      assert.equal(sketchService(summary).requests, 2);
    } finally {
      await route.close();
    }
  });

  it("a provider that reports no tokens is billed at the per-image rate instead of 0", async () => {
    setVertexConfigured();
    mockProviders({ vertex: () => geminiReply(READING, null) });
    const route = await startCostRoute();
    try {
      route.module.clearAiUsageEvents();
      await postSketch(route.url);
      const sketch = sketchService(route.module.getUnifiedAiCostSummary("all"));
      assert.equal(sketch.costThb, Math.round(route.module.calculateModelCostThb(TEST_GEMINI_MODEL, 0, 0, 1) * 100) / 100);
      assert.ok(sketch.costThb > 0);
    } finally {
      await route.close();
    }
  });

  it("answers 200 with only { items } (no usage leaks to the browser), also when every provider fails, and records no cost", async () => {
    setOpenRouterConfigured();
    captureWarnings();
    mockProviders({ openrouter: () => new Response("{}", { status: 500 }) });
    const route = await startCostRoute();
    try {
      route.module.clearAiUsageEvents();
      const response = await postSketch(route.url);
      assert.equal(response.status, 200);
      const body = (await response.json()) as Record<string, unknown>;
      assert.deepEqual(Object.keys(body), ["items"]);
      assert.equal((body["items"] as Array<{ shape: string }>)[0]?.shape, "unknown");
      assert.equal(sketchService(route.module.getUnifiedAiCostSummary("all")).requests, 0);
    } finally {
      await route.close();
    }
  });
});

describe("job-240: configuration helpers (sketch-vision-config.ts)", () => {
  it("parses SKETCH_VISION_PROVIDER: openrouter | gemini | auto, empty = auto, anything else = auto (flagged)", async () => {
    const config = await loadConfig();
    assert.deepEqual(config.parseSketchVisionProviderChoice("openrouter"), { choice: "openrouter", recognised: true });
    assert.deepEqual(config.parseSketchVisionProviderChoice(" GEMINI "), { choice: "gemini", recognised: true });
    assert.deepEqual(config.parseSketchVisionProviderChoice("auto"), { choice: "auto", recognised: true });
    assert.deepEqual(config.parseSketchVisionProviderChoice(undefined), { choice: "auto", recognised: true });
    assert.deepEqual(config.parseSketchVisionProviderChoice("deepseek"), { choice: "auto", recognised: false });
  });

  it("orders the providers and drops the ones that are not available", async () => {
    const config = await loadConfig();
    const both = ["openrouter", "gemini"] as const;
    assert.deepEqual(config.orderSketchVisionProviders("auto", both), ["openrouter", "gemini"]);
    assert.deepEqual(config.orderSketchVisionProviders("openrouter", both), ["openrouter", "gemini"]);
    assert.deepEqual(config.orderSketchVisionProviders("gemini", both), ["gemini", "openrouter"]);
    assert.deepEqual(config.orderSketchVisionProviders("gemini", ["openrouter"]), ["openrouter"]);
    assert.deepEqual(config.orderSketchVisionProviders("auto", []), []);
  });

  it("reads the OpenRouter settings from env, with the documented defaults for base URL and model", async () => {
    const config = await loadConfig();
    assert.equal(config.openRouterVisionConfig({}), null);
    assert.deepEqual(config.openRouterVisionConfig({ OPENROUTER_API_KEY: "k" }), { apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-v4.1-flash" });
    assert.deepEqual(config.openRouterVisionConfig({ OPENROUTER_API_KEY: " k ", OPENROUTER_BASE_URL: "https://x.test/v1//", OPENROUTER_VISION_MODEL: "a/b" }), { apiKey: "k", baseUrl: "https://x.test/v1", model: "a/b" });
  });

  it("lists Vertex models primary-first without duplicates and without a built-in default", async () => {
    const config = await loadConfig();
    assert.deepEqual(config.vertexModelCandidates({}), []);
    assert.deepEqual(config.vertexModelCandidates({ VERTEX_AI_FALLBACK_MODELS: "b" }), [], "fallbacks alone are not enough");
    assert.deepEqual(config.vertexModelCandidates({ VERTEX_AI_MODEL: "google/a", VERTEX_AI_FALLBACK_MODELS: "b, a ,google/c,," }), ["a", "b", "c"]);
  });

  it("builds the host (global has no prefix) and the location (VERTEX_VISION_LOCATION > VERTEX_AI_LOCATION > asia-southeast1)", async () => {
    const config = await loadConfig();
    assert.equal(config.vertexHost("global"), "aiplatform.googleapis.com");
    assert.equal(config.vertexHost("asia-southeast1"), "asia-southeast1-aiplatform.googleapis.com");
    assert.equal(config.vertexVisionLocation({}), "asia-southeast1");
    assert.equal(config.vertexVisionLocation({ VERTEX_AI_LOCATION: "us-central1" }), "us-central1");
    assert.equal(config.vertexVisionLocation({ VERTEX_AI_LOCATION: "us-central1", VERTEX_VISION_LOCATION: "global" }), "global");
  });

  it("recognises \"model not served\" only for a 404 that names the model", async () => {
    const config = await loadConfig();
    assert.equal(config.isVertexModelNotFound(404, "Publisher Model `x` was not found"), true);
    assert.equal(config.isVertexModelNotFound(404, "something else"), false);
    assert.equal(config.isVertexModelNotFound(403, "Publisher Model `x` was not found"), false);
    assert.equal(config.isVertexModelNotFound(404, undefined), false);
  });

  it("the attempt timeout is 45 s unless SKETCH_VISION_TIMEOUT_MS is a positive number", async () => {
    const config = await loadConfig();
    assert.equal(config.sketchVisionAttemptTimeoutMs({}), 45_000);
    assert.equal(config.sketchVisionAttemptTimeoutMs({ SKETCH_VISION_TIMEOUT_MS: "60000" }), 60_000);
    for (const bad of ["0", "-5", "abc", ""]) assert.equal(config.sketchVisionAttemptTimeoutMs({ SKETCH_VISION_TIMEOUT_MS: bad }), 45_000, bad);
  });
});

describe("job-240: no model id or key is written into the code", () => {
  const code = async (relative: string) => {
    const text = (await readFile(new URL(relative, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  };

  it("sketch-vision.ts and leads.ts name no Gemini or DeepSeek model and no API key", async () => {
    for (const file of ["../src/lib/sketch-vision.ts", "../src/routes/leads.ts"]) {
      assert.doesNotMatch(await code(file), /gemini-\d|deepseek|sk-or-|AIza/i, file);
    }
  });

  it("the only model id sketch-vision-config.ts supplies is OpenRouter's documented default", async () => {
    const text = await code("../src/lib/sketch-vision-config.ts");
    assert.doesNotMatch(text, /gemini-\d|AIza|sk-or-/i);
    assert.equal(text.match(/deepseek\/deepseek-v4\.1-flash/g)?.length, 1);
  });
});
