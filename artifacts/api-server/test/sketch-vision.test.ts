import assert from "node:assert/strict";
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
};
let uploadDirectory: string;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://sketch-vision-test";
  process.env["SESSION_SECRET"] = "sketch-vision-test-secret";
  delete process.env["GOOGLE_API_KEY"];
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

describe("analyzeSketchImage", () => {
  it("returns an unknown item without calling fetch when GOOGLE_API_KEY is not configured", async () => {
    assert.equal(sketchVisionConfigured(), false);
    let called = false;
    mock.method(globalThis, "fetch", async () => {
      called = true;
      return new Response("{}");
    });
    const item = await analyzeSketchImage(Buffer.from("fake-image-bytes"), "image/png", 0);
    assert.equal(called, false, "must never call the AI when no key is configured");
    assert.equal(item.shape, "unknown");
    assert.equal(item.confidence, "low");
    assert.equal(item.index, 0);
    assert.ok(item.notes);
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
