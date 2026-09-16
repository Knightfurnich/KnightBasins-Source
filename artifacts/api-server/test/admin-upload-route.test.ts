import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { MAX_IMAGE_UPLOAD_BYTES } from "../src/lib/image-upload.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type UploadModule = {
  saveUploadedImage: (image: {
    buffer: Buffer;
    contentType: string;
    originalName: string;
  }) => Promise<UploadResponse>;
  saveUploadedVideo: (video: {
    buffer: Buffer;
    contentType: string;
    originalName: string;
  }) => Promise<UploadResponse>;
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
const uploadModule = fileURLToPath(
  new URL("../src/lib/image-upload.ts", import.meta.url),
);
const uploadOrigin = "https://uploads.example.test/catalog";
let uploadDirectory = "";

function imageFormData(
  fileName = "basin.png",
  contentType = "image/png",
  bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
  fieldName = "file",
) {
  const formData = new FormData();
  formData.append(fieldName, new Blob([bytes], { type: contentType }), fileName);
  return formData;
}

function videoFormData(
  fileName = "basin.mp4",
  contentType = "video/mp4",
  bytes = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]),
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
  const errors: unknown[] = [];
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  app.use((
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    errors.push(error);
    res.status(500).json({ message: "Internal server error" });
  });
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
    errors,
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
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);
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
    const bytes = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
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

  it("removes a newly created file when the storage write fails", async () => {
    const { saveUploadedImage } =
      await importTypeScriptModule<UploadModule>(uploadModule);
    const filesBefore = await readdir(uploadDirectory);
    const writeError = new Error("simulated storage write failure");
    const originalOpen = fsPromises.open;
    let filesAtWriteFailure: string[] | undefined;
    const openMock = mock.method(
      fsPromises,
      "open",
      async (...args: Parameters<typeof fsPromises.open>) => {
        const handle = await originalOpen(...args);
        filesAtWriteFailure = await readdir(uploadDirectory);

        return new Proxy(handle, {
          get(target, property, receiver) {
            if (property === "writeFile") {
              return async () => {
                throw writeError;
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );
    syncBuiltinESMExports();

    try {
      await assert.rejects(
        saveUploadedImage({
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          contentType: "image/png",
          originalName: "failed-write.png",
        }),
        (error) => {
          assert.strictEqual(error, writeError);
          return true;
        },
      );
      assert.equal(filesAtWriteFailure?.length, filesBefore.length + 1);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      openMock.mock.restore();
      syncBuiltinESMExports();
    }
  });

  it("removes a newly created video file when the storage write fails", async () => {
    const { saveUploadedVideo } =
      await importTypeScriptModule<UploadModule>(uploadModule);
    const filesBefore = await readdir(uploadDirectory);
    const writeError = new Error("simulated video storage write failure");
    const originalOpen = fsPromises.open;
    let filesAtWriteFailure: string[] | undefined;
    const openMock = mock.method(
      fsPromises,
      "open",
      async (...args: Parameters<typeof fsPromises.open>) => {
        const handle = await originalOpen(...args);
        filesAtWriteFailure = await readdir(uploadDirectory);

        return new Proxy(handle, {
          get(target, property, receiver) {
            if (property === "writeFile") {
              return async () => {
                throw writeError;
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );
    syncBuiltinESMExports();

    try {
      await assert.rejects(
        saveUploadedVideo({
          buffer: Buffer.from([
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70,
            0x34, 0x32,
          ]),
          contentType: "video/mp4",
          originalName: "failed-write.mp4",
        }),
        (error) => {
          assert.strictEqual(error, writeError);
          return true;
        },
      );
      assert.equal(filesAtWriteFailure?.length, filesBefore.length + 1);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      openMock.mock.restore();
      syncBuiltinESMExports();
    }
  });

  it("returns a server error and cleans up when the video route storage write fails", async () => {
    const filesBefore = await readdir(uploadDirectory);
    const writeError = new Error("simulated video route storage write failure");
    const originalOpen = fsPromises.open;
    let filesAtWriteFailure: string[] | undefined;
    const openMock = mock.method(
      fsPromises,
      "open",
      async (...args: Parameters<typeof fsPromises.open>) => {
        const handle = await originalOpen(...args);
        filesAtWriteFailure = await readdir(uploadDirectory);

        return new Proxy(handle, {
          get(target, property, receiver) {
            if (property === "writeFile") {
              return async () => {
                throw writeError;
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );
    syncBuiltinESMExports();
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/upload/video`, {
        method: "POST",
        headers: { cookie },
        body: videoFormData("failed-route-write.mp4"),
      });

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        message: "Internal server error",
      });
      assert.strictEqual(server.errors.at(-1), writeError);
      assert.equal(filesAtWriteFailure?.length, filesBefore.length + 1);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      openMock.mock.restore();
      syncBuiltinESMExports();
    }
  });

  it("returns a server error and cleans up when the image route storage write fails", async () => {
    const filesBefore = await readdir(uploadDirectory);
    const writeError = new Error("simulated image route storage write failure");
    const originalOpen = fsPromises.open;
    let filesAtWriteFailure: string[] | undefined;
    const openMock = mock.method(
      fsPromises,
      "open",
      async (...args: Parameters<typeof fsPromises.open>) => {
        const handle = await originalOpen(...args);
        filesAtWriteFailure = await readdir(uploadDirectory);

        return new Proxy(handle, {
          get(target, property, receiver) {
            if (property === "writeFile") {
              return async () => {
                throw writeError;
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );
    syncBuiltinESMExports();
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("failed-route-write.png"),
      });

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        message: "Internal server error",
      });
      assert.strictEqual(server.errors.at(-1), writeError);
      assert.equal(filesAtWriteFailure?.length, filesBefore.length + 1);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      openMock.mock.restore();
      syncBuiltinESMExports();
    }
  });

  it("rejects a filename collision without replacing the existing image", async () => {
    const now = 1_758_000_000_000;
    const fixedToken = Buffer.alloc(8, 0xab);
    const dateMock = mock.method(Date, "now", () => now);
    const randomBytesMock = mock.method(crypto, "randomBytes", () => fixedToken);
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const existingBytes = Buffer.from("existing catalog photo");
    const replacementBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
    ]);
    const filename = `catalog-${now.toString(36)}-${fixedToken.toString("hex")}.png`;

    try {
      await writeFile(path.join(uploadDirectory, filename), existingBytes);
      const response = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("replacement.png", "image/png", replacementBytes),
      });

      assert.equal(response.status, 409);
      assert.match((await response.json()).message, /already exists/i);
      assert.deepEqual(
        await readFile(path.join(uploadDirectory, filename)),
        existingBytes,
      );
    } finally {
      await server.close();
      await rm(path.join(uploadDirectory, filename), { force: true });
      randomBytesMock.mock.restore();
      dateMock.mock.restore();
    }
  });

  it("rejects a video filename collision without replacing the existing video", async () => {
    const now = 1_758_000_000_000;
    const fixedToken = Buffer.alloc(8, 0xcd);
    const dateMock = mock.method(Date, "now", () => now);
    const randomBytesMock = mock.method(crypto, "randomBytes", () => fixedToken);
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const existingBytes = Buffer.from("existing catalog video");
    const replacementBytes = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
    ]);
    const filename = `catalog-${now.toString(36)}-${fixedToken.toString("hex")}.mp4`;

    try {
      await writeFile(path.join(uploadDirectory, filename), existingBytes);
      const filesBefore = await readdir(uploadDirectory);
      const response = await fetch(`${server.url}/api/admin/upload/video`, {
        method: "POST",
        headers: { cookie },
        body: videoFormData("replacement.mp4", "video/mp4", replacementBytes),
      });

      assert.equal(response.status, 409);
      assert.match((await response.json()).message, /already exists/i);
      assert.deepEqual(
        await readFile(path.join(uploadDirectory, filename)),
        existingBytes,
      );
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      await rm(path.join(uploadDirectory, filename), { force: true });
      randomBytesMock.mock.restore();
      dateMock.mock.restore();
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

  it("rejects an oversized image without creating an upload file", async () => {
    const server = await startAdminRoute({});
    const cookie = `knight_admin_session=${createAdminToken()}`;
    const existingFile = "existing-upload.txt";
    await writeFile(path.join(uploadDirectory, existingFile), "keep this file");
    const filesBefore = await readdir(uploadDirectory);
    const oversizedImage = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES),
    ]);

    try {
      const response = await fetch(`${server.url}/api/admin/upload`, {
        method: "POST",
        headers: { cookie },
        body: imageFormData("too-large.png", "image/png", oversizedImage),
      });

      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /Image is too large/i);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      await rm(path.join(uploadDirectory, existingFile), { force: true });
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