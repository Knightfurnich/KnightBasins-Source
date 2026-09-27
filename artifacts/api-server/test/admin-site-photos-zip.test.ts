import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type FakeSitePhotoRow = {
  id: number;
  leadId: number | null;
  jobCode: string | null;
  imageUrl: string;
  description: string | null;
  stage: string;
  senderName: string | null;
  capturedAt: Date | null;
  createdAt: Date;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

// UPLOAD_DIR is read once when image-upload.ts is first imported, so the test
// workspace must exist before the route module is loaded (see `before`).
const TEST_UPLOAD_DIR = mkdtempSync(join(tmpdir(), "site-photos-zip-upload-"));
const OUTSIDE_SENTINEL = join(TEST_UPLOAD_DIR, "..", `sentinel-${process.pid}.txt`);

const SQL_COLUMN_TO_ROW_KEY: Record<string, string> = {
  job_code: "jobCode",
  lead_id: "leadId",
};

function isColumnChunk(node: unknown): node is { name: string } {
  return Boolean(node && typeof node === "object" && "dataType" in (node as object) && "columnType" in (node as object) && "name" in (node as object));
}

function isSqlNode(node: unknown): node is { queryChunks: unknown[] } {
  return Boolean(node && typeof node === "object" && Array.isArray((node as { queryChunks?: unknown[] }).queryChunks));
}

function stringChunkText(node: unknown): string | null {
  if (node && typeof node === "object" && (node as { constructor?: { name?: string } }).constructor?.name === "StringChunk") {
    const value = (node as { value?: unknown }).value;
    return Array.isArray(value) ? value.join("") : String(value ?? "");
  }
  return null;
}

function paramValue(node: unknown): { value: unknown } | null {
  if (node && typeof node === "object" && (node as { constructor?: { name?: string } }).constructor?.name === "Param") {
    return { value: (node as { value?: unknown }).value };
  }
  return null;
}

/** Evaluates a real drizzle condition tree (eq/and) against one fake row. */
function evaluateCondition(node: unknown, row: FakeSitePhotoRow): boolean {
  if (node === undefined) return true;
  if (!isSqlNode(node)) return true;
  const chunks = node.queryChunks;

  const columnChunk = chunks.find(isColumnChunk);
  if (columnChunk) {
    const opText = chunks.map(stringChunkText).filter((text): text is string => text !== null).join("");
    const rowKey = SQL_COLUMN_TO_ROW_KEY[columnChunk.name] ?? columnChunk.name;
    const rowValue = (row as unknown as Record<string, unknown>)[rowKey];
    const param = chunks.map(paramValue).find((candidate): candidate is { value: unknown } => candidate !== null);
    if (opText.includes(" = ")) return rowValue === param?.value;
    return true;
  }

  const nested = chunks.filter(isSqlNode);
  if (nested.length === 0) return true;
  return nested.map((child) => evaluateCondition(child, row)).every(Boolean);
}

function createFakeSitePhotoDatabase(initialRows: FakeSitePhotoRow[]) {
  const rows = [...initialRows];
  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          orderBy: async (_stage: unknown, _id: unknown) =>
            rows.filter((row) => evaluateCondition(condition, row)),
        }),
      }),
    }),
  };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

before(() => {
  process.env["UPLOAD_DIR"] = TEST_UPLOAD_DIR;
  process.env["ADMIN_PASSWORD"] = "admin-site-photos-zip-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-site-photos-zip-test";
  process.env["SESSION_SECRET"] = "admin-site-photos-zip-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];

  // Real files on disk: the route streams them into the archive, so the test
  // exercises the genuine createReadStream + DEFLATE path, not a mock.
  writeFileSync(join(TEST_UPLOAD_DIR, "survey-a.webp"), Buffer.from("fake-webp-survey-payload"));
  writeFileSync(join(TEST_UPLOAD_DIR, "install-b.webp"), Buffer.from("fake-webp-install-payload"));
  writeFileSync(OUTSIDE_SENTINEL, "sentinel-must-not-be-archived");
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  rmSync(OUTSIDE_SENTINEL, { force: true });
});

afterEach(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

const JOB_ROWS: FakeSitePhotoRow[] = [
  {
    id: 1,
    leadId: 10,
    jobCode: "JB01/2569",
    imageUrl: "/api/uploads/survey-a.webp",
    description: "วัดหน้างาน",
    stage: "survey",
    senderName: "ช่างเอ",
    capturedAt: new Date("2026-09-20T03:00:00.000Z"),
    createdAt: new Date("2026-09-20T03:00:00.000Z"),
  },
  {
    id: 2,
    leadId: 10,
    jobCode: "JB01/2569",
    imageUrl: "/api/uploads/install-b.webp",
    description: "ติดตั้ง",
    stage: "installation",
    senderName: "ช่างบี",
    capturedAt: new Date("2026-09-21T03:00:00.000Z"),
    createdAt: new Date("2026-09-21T03:00:00.000Z"),
  },
  {
    id: 3,
    leadId: 99,
    jobCode: "JB99/2569",
    imageUrl: "/api/uploads/other-job.webp",
    description: "งานอื่น",
    stage: "service",
    senderName: "ช่างซี",
    capturedAt: new Date("2026-09-22T03:00:00.000Z"),
    createdAt: new Date("2026-09-22T03:00:00.000Z"),
  },
];

const EOCD_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

describe("GET /admin/site-photos/download-zip", () => {
  it("rejects unauthenticated callers with 401", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?jobCode=JB01/2569`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("requires jobCode or leadId", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 400);
      const body = (await response.json()) as { message: string };
      assert.match(body.message, /jobCode or leadId/i);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the job has no photos", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?jobCode=NO-SUCH-JOB`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 404);
      const body = (await response.json()) as { message: string };
      assert.match(body.message, /no site photos/i);
    } finally {
      await server.close();
    }
  });

  it("streams a valid zip with the correct headers, entry names, and payloads", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?jobCode=${encodeURIComponent("JB01/2569")}`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/zip");
      assert.match(
        String(response.headers.get("content-disposition")),
        /attachment; filename="site-photos-JB01_2569\.zip"/,
      );

      const archive = Buffer.from(await response.arrayBuffer());
      // Local file header signature starts the archive; EOCD record closes it.
      assert.equal(archive.readUInt32LE(0), LOCAL_HEADER_SIGNATURE);
      assert.equal(archive.readUInt32LE(archive.length - 22), EOCD_SIGNATURE);

      const totalEntries = archive.readUInt16LE(archive.length - 22 + 10);
      assert.equal(totalEntries, 2, "only the two photos of this job belong in the archive");

      const text = archive.toString("latin1");
      assert.ok(text.includes("survey_1_survey-a.webp"), "stage-prefixed entry name for the survey photo");
      assert.ok(text.includes("installation_2_install-b.webp"), "stage-prefixed entry name for the install photo");
      assert.ok(!text.includes("other-job.webp"), "photos of a different job must not be included");
    } finally {
      await server.close();
    }
  });

  it("filters by leadId when jobCode is omitted", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?leadId=10`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 200);
      assert.match(String(response.headers.get("content-disposition")), /site-photos-lead-10\.zip/);
      const archive = Buffer.from(await response.arrayBuffer());
      assert.equal(archive.readUInt16LE(archive.length - 22 + 10), 2);
    } finally {
      await server.close();
    }
  });

  it("skips path-traversal entries instead of archiving files outside the upload root", async () => {
    const sentinelName = OUTSIDE_SENTINEL.split("/").pop() as string;
    const traversalRows: FakeSitePhotoRow[] = [
      { ...JOB_ROWS[0]!, id: 11, imageUrl: `/api/uploads/../../${sentinelName}` },
      { ...JOB_ROWS[0]!, id: 12, imageUrl: "/api/uploads/not-on-disk.webp" },
      { ...JOB_ROWS[1]!, id: 13, imageUrl: "/api/uploads/install-b.webp" },
    ];
    const server = await startAdminRoute(createFakeSitePhotoDatabase(traversalRows));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?jobCode=${encodeURIComponent("JB01/2569")}`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 200);
      const archive = Buffer.from(await response.arrayBuffer());
      assert.equal(archive.readUInt32LE(archive.length - 22), EOCD_SIGNATURE, "archive stays structurally valid");
      assert.equal(archive.readUInt16LE(archive.length - 22 + 10), 1, "only the safe, present file is archived");

      const text = archive.toString("latin1");
      assert.ok(!text.includes("sentinel-must-not-be-archived"), "foreign file content must never be archived");

      // The sentinel outside the upload root is untouched on disk.
      assert.equal(readFileSync(OUTSIDE_SENTINEL, "utf8"), "sentinel-must-not-be-archived");
    } finally {
      await server.close();
    }
  });

  it("rejects a non-integer leadId", async () => {
    const server = await startAdminRoute(createFakeSitePhotoDatabase(JOB_ROWS));
    try {
      const response = await fetch(`${server.url}/api/admin/site-photos/download-zip?leadId=abc`, {
        headers: { cookie: `knight_admin_session=${createAdminToken()}` },
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });
});
