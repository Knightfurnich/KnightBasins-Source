import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_IMAGE_UPLOAD_BYTES } from "../src/lib/image-upload.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type OriginModule = typeof import("../src/lib/public-origin.ts");
type LeadRouteModule = typeof import("../src/routes/leads.ts");

const originalEnv = {
  appOrigin: process.env["PUBLIC_APP_ORIGIN"],
  uploadOrigin: process.env["PUBLIC_UPLOAD_ORIGIN"],
  nodeEnv: process.env["NODE_ENV"],
  databaseUrl: process.env["DATABASE_URL"],
  uploadDirectory: process.env["UPLOAD_DIR"],
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    PUBLIC_APP_ORIGIN: originalEnv.appOrigin,
    PUBLIC_UPLOAD_ORIGIN: originalEnv.uploadOrigin,
    NODE_ENV: originalEnv.nodeEnv,
    DATABASE_URL: originalEnv.databaseUrl,
    UPLOAD_DIR: originalEnv.uploadDirectory,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function module() {
  return importTypeScriptModule<OriginModule>("src/lib/public-origin.ts");
}

function request(protocol = "http", headers: Record<string, string> = {}) {
  return {
    protocol,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function imageFormData(bytes: Buffer) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    "too-large.png",
  );
  return formData;
}

function postChunkedMultipart(
  url: string,
  boundary: string,
  chunks: Buffer[],
) {
  const target = new URL(url);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      (response) => {
        const responseChunks: Buffer[] = [];
        response.on("data", (chunk) => {
          responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(responseChunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

async function startLeadsRoute() {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  const contentLengths: Array<string | undefined> = [];
  app.use((req, _res, next) => {
    contentLengths.push(req.headers["content-length"]);
    next();
  });
  app.use("/api", routeModule.createLeadsRouter({} as never));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Lead route test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    contentLengths,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

describe("public quote origin", () => {
  it("prefers PUBLIC_APP_ORIGIN and strips any path", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["PUBLIC_APP_ORIGIN"] = "http://knightbasins.srv1964473.hstgr.cloud/quote/view";
    process.env["PUBLIC_UPLOAD_ORIGIN"] = "https://upload.example.test/api/uploads";

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "internal:8080", "x-forwarded-proto": "http" })),
      "https://knightbasins.srv1964473.hstgr.cloud",
    );
  });

  it("uses the existing PUBLIC_UPLOAD_ORIGIN as the public app origin", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["PUBLIC_APP_ORIGIN"];
    process.env["PUBLIC_UPLOAD_ORIGIN"] = "https://knightbasins.srv1964473.hstgr.cloud/api/uploads";

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "internal:8080", "x-forwarded-proto": "http" })),
      "https://knightbasins.srv1964473.hstgr.cloud",
    );
  });

  it("rejects production requests without a configured public origin", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["PUBLIC_APP_ORIGIN"];
    delete process.env["PUBLIC_UPLOAD_ORIGIN"];

    const originModule = await module();
    assert.throws(
      () => originModule.requestOrigin(request("http", { host: "public.example.test", "x-forwarded-proto": "http" })),
      /PUBLIC_APP_ORIGIN or PUBLIC_UPLOAD_ORIGIN/,
    );
  });

  it("keeps forwarded protocol behavior for development fallback", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["PUBLIC_APP_ORIGIN"];
    delete process.env["PUBLIC_UPLOAD_ORIGIN"];

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "localhost:8080", "x-forwarded-proto": "https, http" })),
      "https://localhost:8080",
    );
  });
});

describe("sketch lead uploads", () => {
  it("rejects an oversized image without creating an upload file", async () => {
    const uploadDirectory = await mkdtemp(
      path.join(path.dirname(fileURLToPath(import.meta.url)), ".sketch-upload-test-"),
    );
    process.env["DATABASE_URL"] = "postgres://sketch-upload-test";
    process.env["UPLOAD_DIR"] = uploadDirectory;
    process.env["NODE_ENV"] = "development";

    const existingFile = "existing-upload.txt";
    await writeFile(path.join(uploadDirectory, existingFile), "keep this file");
    const filesBefore = await readdir(uploadDirectory);
    const oversizedImage = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES),
    ]);
    const server = await startLeadsRoute();

    try {
      const response = await fetch(`${server.url}/api/leads/sketch`, {
        method: "POST",
        body: imageFormData(oversizedImage),
      });

      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /Image is too large/i);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      await rm(uploadDirectory, { force: true, recursive: true });
    }
  });

  it("rejects an oversized streamed image without content-length and preserves files", async () => {
    const uploadDirectory = await mkdtemp(
      path.join(path.dirname(fileURLToPath(import.meta.url)), ".sketch-upload-stream-test-"),
    );
    process.env["DATABASE_URL"] = "postgres://sketch-upload-stream-test";
    process.env["UPLOAD_DIR"] = uploadDirectory;
    process.env["NODE_ENV"] = "development";

    const existingFile = "existing-stream-upload.txt";
    await writeFile(path.join(uploadDirectory, existingFile), "keep this file");
    const filesBefore = await readdir(uploadDirectory);
    const boundary = "streamed-sketch-boundary";
    const signature = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);
    const multipartHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="oversized-stream.png"\r\nContent-Type: image/png\r\n\r\n`,
    );
    const multipartFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const oversizedFile = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024 - signature.length);
    const server = await startLeadsRoute();

    try {
      const response = await postChunkedMultipart(
        `${server.url}/api/leads/sketch`,
        boundary,
        [multipartHeader, signature, oversizedFile, multipartFooter],
      );

      assert.equal(server.contentLengths.at(-1), undefined);
      assert.equal(response.status, 400);
      assert.match(JSON.parse(response.body).message, /Image is too large/i);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      await rm(uploadDirectory, { force: true, recursive: true });
    }
  });
});