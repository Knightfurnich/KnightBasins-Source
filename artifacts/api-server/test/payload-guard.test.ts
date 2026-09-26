import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { build } from "esbuild";
import type { Express } from "express";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePayloadDepthAndSize } from "../src/lib/payload-guard.ts";

// ---- validatePayloadDepthAndSize (unit) ------------------------------------

/** `levels` nested `{ nested: ... }` wrappers around a leaf string. 0 levels is just the leaf itself. */
function buildNestedObject(levels: number): unknown {
  let value: unknown = "leaf";
  for (let i = 0; i < levels; i += 1) {
    value = { nested: value };
  }
  return value;
}

function buildWideObject(keyCount: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: keyCount }, (_, i) => [`k${i}`, i]));
}

describe("validatePayloadDepthAndSize", () => {
  it("accepts a normal small business payload", () => {
    const result = validatePayloadDepthAndSize({
      leadKey: "lead-1",
      status: "quote_requested",
      studioData: { kind: "studio", total: 60990, basin: { xMm: 100, yMm: 100 } },
    });
    assert.deepEqual(result, { safe: true });
  });

  it("accepts a payload of exactly 10 levels of nesting (the boundary itself must pass)", () => {
    const result = validatePayloadDepthAndSize(buildNestedObject(10));
    assert.equal(result.safe, true);
  });

  it("rejects a payload of 11 levels of nesting, just past the floor", () => {
    const result = validatePayloadDepthAndSize(buildNestedObject(11));
    assert.equal(result.safe, false);
    assert.ok(result.reason?.toLowerCase().includes("depth"));
  });

  it("rejects a pathologically deep payload (10,000 levels) without ever throwing a stack overflow", () => {
    assert.doesNotThrow(() => validatePayloadDepthAndSize(buildNestedObject(10_000)));
    const result = validatePayloadDepthAndSize(buildNestedObject(10_000));
    assert.equal(result.safe, false);
  });

  it("accepts a payload with exactly 500 keys (the boundary itself must pass)", () => {
    const result = validatePayloadDepthAndSize(buildWideObject(500));
    assert.equal(result.safe, true);
  });

  it("rejects a payload with 501 keys, just past the floor", () => {
    const result = validatePayloadDepthAndSize(buildWideObject(501));
    assert.equal(result.safe, false);
    assert.ok(result.reason?.toLowerCase().includes("key"));
  });

  it("counts keys across array elements too, not just plain objects", () => {
    const arrayOfObjects = Array.from({ length: 600 }, (_, i) => ({ [`k${i}`]: i }));
    const result = validatePayloadDepthAndSize(arrayOfObjects);
    assert.equal(result.safe, false);
    assert.ok(result.reason?.toLowerCase().includes("key"));
  });

  it("treats a bare primitive or null payload as safe", () => {
    assert.deepEqual(validatePayloadDepthAndSize("just a string"), { safe: true });
    assert.deepEqual(validatePayloadDepthAndSize(42), { safe: true });
    assert.deepEqual(validatePayloadDepthAndSize(null), { safe: true });
  });

  it("respects custom maxDepth/maxKeys overrides", () => {
    assert.equal(validatePayloadDepthAndSize(buildNestedObject(3), 2).safe, false);
    assert.equal(validatePayloadDepthAndSize(buildWideObject(5), 10, 3).safe, false);
  });
});

// ---- app.ts end-to-end: 256kb byte limit -> 413, and the depth/key guard --

type AppModule = { default: Express };

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * app.ts's own tree pulls in cookie-parser/cors/pino-http/pino, whose CJS
 * builds do their own `require("crypto")`-style Node-builtin requires --
 * esbuild's ESM output mishandles that once those packages get bundled in.
 * Marking them external leaves them as normal runtime imports Node resolves
 * itself; everything else (this project's own extensionless relative
 * imports, which plain Node ESM can't resolve on its own) still gets
 * bundled by esbuild. Same split security-audit.test.ts uses for the same
 * reason.
 */
async function importAppModule(): Promise<AppModule> {
  const entryPoint = path.join(testDirectory, "..", "src", "app.ts");
  const outputDirectory = await mkdtemp(path.join(testDirectory, ".payload-guard-bundle-"));
  const outputFile = path.join(outputDirectory, "app.mjs");
  try {
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      external: ["express", "pg", "@workspace/db", "@workspace/db/*", "cookie-parser", "cors", "pino-http", "pino"],
      format: "esm",
      logLevel: "silent",
      outfile: outputFile,
      platform: "node",
      sourcemap: false,
    });
    return (await import(pathToFileURL(outputFile).href)) as AppModule;
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

async function startApp() {
  const appModule = await importAppModule();
  const app = appModule.default;
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Payload-guard test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const originalEnv = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["ADMIN_PASSWORD"] = "payload-guard-test-password";
  process.env["DATABASE_URL"] = "postgres://payload-guard-test";
  process.env["SESSION_SECRET"] = "payload-guard-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("app.ts payload size guard (end-to-end)", () => {
  it("a normal small JSON request is unaffected by either guard", async () => {
    const server = await startApp();
    try {
      const response = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      });
      // Neither guard should ever fire for a normal small payload -- 401
      // (wrong password) is the expected, unrelated outcome here.
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns 413 with a polite message for a JSON body over the 256kb limit", async () => {
    const server = await startApp();
    try {
      const oversizedPassword = "x".repeat(300 * 1024); // 300KB, past the 256kb express.json() limit
      const response = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: oversizedPassword }),
      });
      assert.equal(response.status, 413);
      const body = (await response.json()) as { message?: string };
      assert.equal(typeof body.message, "string");
      assert.ok(!/entity\.too\.large|PayloadTooLargeError|at \w+ \(/.test(body.message ?? ""), "must not leak the raw body-parser error");
    } finally {
      await server.close();
    }
  });

  it("returns 400 for a deeply nested JSON body well under the byte-size limit", async () => {
    const server = await startApp();
    try {
      const deepBody = JSON.stringify({ password: "x", nested: buildNestedObject(20) });
      assert.ok(Buffer.byteLength(deepBody) < 1024, "the fixture must stay tiny in bytes to prove this is the depth guard, not the size guard");
      const response = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: deepBody,
      });
      assert.equal(response.status, 400);
      const body = (await response.json()) as { message?: string };
      assert.ok(body.message?.toLowerCase().includes("depth"));
    } finally {
      await server.close();
    }
  });

  it("returns 400 for a JSON body with an excessive key count, well under the byte-size limit", async () => {
    const server = await startApp();
    try {
      const wideBody = JSON.stringify({ password: "x", extra: buildWideObject(600) });
      assert.ok(Buffer.byteLength(wideBody) < 20 * 1024, "the fixture must stay well under 256kb to prove this is the key-count guard, not the size guard");
      const response = await fetch(`${server.url}/api/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: wideBody,
      });
      assert.equal(response.status, 400);
      const body = (await response.json()) as { message?: string };
      assert.ok(body.message?.toLowerCase().includes("key"));
    } finally {
      await server.close();
    }
  });
});
