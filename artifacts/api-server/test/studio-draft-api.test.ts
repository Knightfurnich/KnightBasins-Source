import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { serveTypeScriptRoute } from "./route-harness.ts";

const studioDraftRoute = fileURLToPath(new URL("../src/routes/studio-draft.ts", import.meta.url));
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const ORIGINAL_STUDIO_DRAFTS_DIR = process.env["STUDIO_DRAFTS_DIR"];
let draftsDirectory = "";

function basePayload() {
  return {
    shape: "L-shape",
    dimensions: { widthMm: 2400, depthMm: 600 },
    stoneColor: "KZ802",
    basinSku: "KF010",
    basinPlacements: [{ sku: "KF010", xMm: 300, yMm: 150 }],
    edges: { front: "bullnose" },
    customerInfo: { name: "คุณทดสอบ", phone: "0812345678" },
  };
}

before(async () => {
  draftsDirectory = await mkdtemp(path.join(testDirectory, ".studio-drafts-test-"));
  process.env["STUDIO_DRAFTS_DIR"] = draftsDirectory;
});

after(async () => {
  await rm(draftsDirectory, { force: true, recursive: true });
  if (ORIGINAL_STUDIO_DRAFTS_DIR === undefined) {
    delete process.env["STUDIO_DRAFTS_DIR"];
  } else {
    process.env["STUDIO_DRAFTS_DIR"] = ORIGINAL_STUDIO_DRAFTS_DIR;
  }
});

describe("Studio Draft Save & Resume API", () => {
  it("saves a new draft and returns a draftKey plus a resume URL", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const response = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePayload()),
      });
      const body = (await response.json()) as { draftKey: string; resumeUrl: string; expiresAt: string };

      assert.equal(response.status, 201);
      assert.match(body.draftKey, /^dft_[a-f0-9]{24}$/);
      assert.equal(body.resumeUrl, `/studio?draft=${body.draftKey}`);
      assert.equal(Number.isNaN(Date.parse(body.expiresAt)), false);
    } finally {
      await server.close();
    }
  });

  it("resumes a saved draft via GET with the exact dimensions, shape, stone color, and basin placements", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const payload = basePayload();
      const saveResponse = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = (await saveResponse.json()) as { draftKey: string };

      const getResponse = await fetch(`${server.url}/api/studio/draft/${saved.draftKey}`);
      const restored = (await getResponse.json()) as Record<string, unknown>;

      assert.equal(getResponse.status, 200);
      assert.equal(restored["draftKey"], saved.draftKey);
      assert.equal(restored["shape"], payload.shape);
      assert.deepEqual(restored["dimensions"], payload.dimensions);
      assert.equal(restored["stoneColor"], payload.stoneColor);
      assert.equal(restored["basinSku"], payload.basinSku);
      assert.deepEqual(restored["basinPlacements"], payload.basinPlacements);
      assert.deepEqual(restored["edges"], payload.edges);
      assert.deepEqual(restored["customerInfo"], payload.customerInfo);
    } finally {
      await server.close();
    }
  });

  it("re-saving with an existing draftKey updates it in place and returns 200", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const first = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePayload()),
      });
      const { draftKey } = (await first.json()) as { draftKey: string };

      const second = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...basePayload(), draftKey, stoneColor: "KZ900" }),
      });
      const secondBody = (await second.json()) as { draftKey: string };

      assert.equal(second.status, 200);
      assert.equal(secondBody.draftKey, draftKey);

      const getResponse = await fetch(`${server.url}/api/studio/draft/${draftKey}`);
      const restored = (await getResponse.json()) as { stoneColor: string };
      assert.equal(restored.stoneColor, "KZ900");
    } finally {
      await server.close();
    }
  });

  it("rejects path traversal attempts in draftKey on GET", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const response = await fetch(`${server.url}/api/studio/draft/${encodeURIComponent("../../etc/passwd")}`);
      assert.ok([400, 404].includes(response.status));
      const body = (await response.json()) as { message: string };
      assert.equal(typeof body.message, "string");
    } finally {
      await server.close();
    }
  });

  it("rejects path traversal attempts in a client-supplied draftKey on POST", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const response = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...basePayload(), draftKey: "../../etc/passwd" }),
      });
      assert.ok([400, 404].includes(response.status));
    } finally {
      await server.close();
    }
  });

  it("returns a safe 404 for a draftKey that does not exist", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const response = await fetch(`${server.url}/api/studio/draft/dft_000000000000000000000000`);
      const body = (await response.json()) as { message: string };

      assert.equal(response.status, 404);
      assert.equal(body.message, "แบบร่างไม่พบหรือหมดอายุแล้ว");
    } finally {
      await server.close();
    }
  });

  it("rejects a malformed payload missing required fields", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      const response = await fetch(`${server.url}/api/studio/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shape: "L-shape" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});
