import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type UploadResponse = {
  filename: string;
  contentType: string;
  size: number;
  originalName: string;
  version: string;
  url: string;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  PUBLIC_UPLOAD_ORIGIN: process.env["PUBLIC_UPLOAD_ORIGIN"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
};

const adminRoute = fileURLToPath(
  new URL("../src/routes/admin-router.ts", import.meta.url),
);
const uploadOrigin = "https://uploads.example.test/catalog";
let uploadDirectory = "";

function imageFormData(
  fileName = "basin.png",
  contentType = "image/png",
  bytes = Buffer.from("png-fixture"),
  fieldName = "file",
) {
  const formData = new FormData();
  formData.append(fieldName, new Blob([bytes], { type: contentType }), fileName);
  return formData;
}

function videoFormData(
  fileName = "basin.mp4",
  contentType = "video/mp4",
  bytes = Buffer.from("mp4-fixture"),
) {
  return imageFormData(fileName, contentType, bytes);
}

function cleanupDatabase(
  basins: Array<{ imageUrl?: string | null }>,
  installedStones: Array<{ imageUrl?: string | null }>,
  sheetStones: Array<{ imageUrl?: string | null }>,
) {
  const rows = [basins, installedStones, sheetStones];
  let queryNumber = 0;

  return {
    select: () => ({
      from: async () => rows[queryNumber++] ?? [],
    }),
  };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    },
  );
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin upload test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

before(async () => {
  uploadDirectory = await mkdtemp(
    path.join(path.dirname(fileURLToPath(import.meta.url)), ".upload-test-"),
  );
  process.env["ADMIN_PASSWORD"] = "admin-upload-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-upload-test";
  process.env["PUBLIC_UPLOAD_ORIGIN"] = uploadOrigin;
  process.env["SESSION_SECRET"] = "admin-upload-test-session-secret";
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  await rm(uploadDirectory, { force: true, recursive: true });
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("protected admin image upload route", () => {
  it("rejects uploads without the existing admin session cookie", async () => {
    const server = await startAdminRoute({});

    try {
      const response = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        body: imageFormData(),
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        message: "Authentication required",
      });
    } finally {
      await server.close();
    }
  });

  it("accepts a valid multipart image and returns a versioned public URL", async () => {
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const bytes = Buffer.from("valid-png-fixture");
    let uploadedFilename: string | undefined;

    try {
      const response = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("catalog-image.png", "image/png", bytes),
      });
      const payload = (await response.json()) as UploadResponse;
      uploadedFilename = payload.filename;

      assert.equal(response.status, 201);
      assert.equal(payload.contentType, "image/png");
      assert.equal(payload.originalName, "catalog-image.png");
      assert.equal(payload.size, bytes.length);
      assert.match(payload.version, /^[a-z0-9]+$/);
      assert.match(payload.filename, new RegExp(`^catalog-${payload.version}-[a-f0-9]{16}\\.png$`));
      assert.equal(
        payload.url,
        `${uploadOrigin}/${payload.filename}?v=${payload.version}`,
      );
      assert.deepEqual(
        await readFile(path.join(uploadDirectory, payload.filename)),
        bytes,
      );
    } finally {
      await server.close();
      if (uploadedFilename) {
        await rm(path.join(uploadDirectory, uploadedFilename), { force: true });
      }
    }
  });

  it("accepts a valid basin video without changing image upload validation", async () => {
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const bytes = Buffer.from("valid-mp4-fixture");
    let uploadedFilename: string | undefined;

    try {
      const response = await fetch(`${server.url}/api/admin/upload/video`, {
        method: "POST",
        headers: { cookie },
        body: videoFormData("basin-tour.mp4", "video/mp4", bytes),
      });
      const payload = (await response.json()) as UploadResponse;
      uploadedFilename = payload.filename;

      assert.equal(response.status, 201);
      assert.equal(payload.contentType, "video/mp4");
      assert.match(payload.filename, new RegExp(`^catalog-${payload.version}-[a-f0-9]{16}\\.mp4$`));
      assert.deepEqual(await readFile(path.join(uploadDirectory, payload.filename)), bytes);
    } finally {
      await server.close();
      if (uploadedFilename) await rm(path.join(uploadDirectory, uploadedFilename), { force: true });
    }
  });

  it("returns a client error for malformed or unsupported multipart input", async () => {
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const filesBefore = await readdir(uploadDirectory);

    try {
      const missingBoundary = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": "multipart/form-data",
        },
        body: "not multipart",
      });
      assert.equal(missingBoundary.status, 400);
      assert.match((await missingBoundary.json()).message, /multipart image file/i);

      const unsupportedType = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("notes.txt", "text/plain"),
      });
      assert.equal(unsupportedType.status, 400);
      assert.match((await unsupportedType.json()).message, /JPG, PNG, WEBP, and GIF/i);

      const wrongField = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("basin.png", "image/png", undefined, "photo"),
      });
      assert.equal(wrongField.status, 400);
      assert.match((await wrongField.json()).message, /Choose an image file/i);

      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
    }
  });

  it("removes old unreferenced uploads but preserves referenced and fresh files", async () => {
    const referenced = "catalog-mold-bbbbbbbbbbbbbbbb.png";
    const referencedVideo = "catalog-mold-dddddddddddddddd.mp4";
    const orphan = "catalog-mold-aaaaaaaaaaaaaaaa.png";
    const fresh = "catalog-mfresh-cccccccccccccccc.png";
    const unrelated = "keep-this-file.txt";
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await writeFile(path.join(uploadDirectory, orphan), "old orphan");
    await writeFile(path.join(uploadDirectory, referenced), "still in catalog");
    await writeFile(path.join(uploadDirectory, referencedVideo), "video still in catalog");
    await writeFile(path.join(uploadDirectory, fresh), "fresh orphan");
    await writeFile(path.join(uploadDirectory, unrelated), "not managed");
    await utimes(path.join(uploadDirectory, orphan), oldTime, oldTime);
    await utimes(path.join(uploadDirectory, referenced), oldTime, oldTime);
    await utimes(path.join(uploadDirectory, referencedVideo), oldTime, oldTime);

    const server = await startAdminRoute(
      cleanupDatabase(
        [{ imageUrl: null, videoUrl: `${uploadOrigin}/${referencedVideo}?v=mold` }],
        [{ imageUrl: `${uploadOrigin}/${referenced}?v=mold` }],
        [{ imageUrl: "https://central.example.test/slab/SS001.png" }],
      ),
    );
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/uploads/cleanup`, {
        method: "POST",
        headers: { cookie },
      });
      const payload = (await response.json()) as {
        retentionHours: number;
        scanned: number;
        removed: string[];
        skippedReferenced: number;
        skippedTooNew: number;
      };

      assert.equal(response.status, 200);
      assert.equal(payload.retentionHours, 24);
       assert.equal(payload.scanned, 4);
      assert.deepEqual(payload.removed, [orphan]);
       assert.equal(payload.skippedReferenced, 2);
      assert.equal(payload.skippedTooNew, 1);
      await assert.rejects(readFile(path.join(uploadDirectory, orphan)));
      assert.deepEqual(await readFile(path.join(uploadDirectory, referenced)), Buffer.from("still in catalog"));
       assert.deepEqual(await readFile(path.join(uploadDirectory, referencedVideo)), Buffer.from("video still in catalog"));
      assert.deepEqual(await readFile(path.join(uploadDirectory, fresh)), Buffer.from("fresh orphan"));
      assert.deepEqual(await readFile(path.join(uploadDirectory, unrelated)), Buffer.from("not managed"));
    } finally {
      await server.close();
      await rm(path.join(uploadDirectory, referenced), { force: true });
       await rm(path.join(uploadDirectory, referencedVideo), { force: true });
      await rm(path.join(uploadDirectory, fresh), { force: true });
      await rm(path.join(uploadDirectory, unrelated), { force: true });
    }
  });
});