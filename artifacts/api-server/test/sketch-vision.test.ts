import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";
import {
  analyzeSketchImage,
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

function setVertexConfigured() {
  process.env["VERTEX_AI_PROJECT_ID"] = "knight-basins-voice";
  process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
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
  VERTEX_AI_MODEL: process.env["VERTEX_AI_MODEL"],
  VERTEX_AI_FALLBACK_MODELS: process.env["VERTEX_AI_FALLBACK_MODELS"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
};
let uploadDirectory: string;

function clearSketchVisionCredentials() {
  delete process.env["GOOGLE_API_KEY"];
  delete process.env["VERTEX_AI_PROJECT_ID"];
  delete process.env["VERTEX_AI_LOCATION"];
  delete process.env["VERTEX_AI_MODEL"];
  delete process.env["VERTEX_AI_FALLBACK_MODELS"];
  delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
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
    it("is configured when both VERTEX_AI_PROJECT_ID and a Google Service Account are set", () => {
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

    it("sends the request as a user turn -- Vertex rejects a content entry with no role", async () => {
      setVertexConfigured();
      let capturedBody: Record<string, unknown> = {};
      mockVertexFetch((init) => {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shape: "I" }) }] } }] }), { status: 200 });
      });
      await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      const contents = capturedBody["contents"] as Array<{ role?: string }>;
      assert.equal(contents[0]?.role, "user", "Vertex answers 400 'Please use a valid role' without it");
    });

    it("retries with the next candidate model when the configured model is retired", async () => {
      setVertexConfigured();
      process.env["VERTEX_AI_MODEL"] = "gemini-9.9-retired";
      process.env["VERTEX_AI_FALLBACK_MODELS"] = "gemini-2.5-flash";
      const attempted: string[] = [];
      mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = String(input);
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
        }
        if (url.includes("aiplatform.googleapis.com")) {
          attempted.push(url.split("/models/")[1]!.split(":")[0]!);
          if (url.includes("gemini-9.9-retired")) {
            return new Response(JSON.stringify({
              error: { code: 404, status: "NOT_FOUND", message: "Publisher model `projects/knight-basins-voice/locations/asia-southeast1/publishers/google/models/gemini-9.9-retired` was not found or your project does not have access to it." },
            }), { status: 404 });
          }
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shape: "L-left", confidence: "high" }) }] } }] }), { status: 200 });
        }
        return realFetch(input as never);
      });
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.deepEqual(attempted, ["gemini-9.9-retired", "gemini-2.5-flash"]);
      assert.equal(item.shape, "L-left");
      assert.equal(item.confidence, "high");
    });

    it("never hands the upstream Google error text to the customer-visible notes", async () => {
      setVertexConfigured();
      mockVertexFetch(() => new Response(JSON.stringify({
        error: { code: 404, status: "NOT_FOUND", message: "Publisher model `projects/knight-basins-voice/locations/asia-southeast1/publishers/google/models/gemini-3.8-flash` was not found or your project does not have access to it." },
      }), { status: 404 }));
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(item.shape, "unknown");
      assert.ok(item.notes, "the customer still needs to be told to fill the form by hand");
      assert.ok(!String(item.notes).includes("knight-basins-voice"), "must not leak the GCP project id");
      assert.ok(!String(item.notes).includes("Publisher model"), "must not leak the raw upstream error text");
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
      // The model is configuration, not a literal in the source: VERTEX_AI_MODEL
      // is written with vertex-gemini.ts's "google/" prefix and must be
      // stripped for the native publisher path (a prefixed id is a 404).
      process.env["VERTEX_AI_MODEL"] = "google/gemini-2.5-flash";
      await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      assert.equal(capturedUrl, "https://us-central1-aiplatform.googleapis.com/v1/projects/knight-basins-voice/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent");
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
      let capturedUrl = "";
      mock.method(globalThis, "fetch", async (input: string | URL) => {
        capturedUrl = String(input);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shape: "L-left" }) }] } }] }), { status: 200 });
      });
      const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
      // A model the project actually serves (probed against the production
      // service account); the previous literal here was a retired model.
      assert.match(capturedUrl, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=fake-api-key$/);
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
