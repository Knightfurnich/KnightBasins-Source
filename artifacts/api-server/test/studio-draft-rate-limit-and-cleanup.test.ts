import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { importTypeScriptModule, serveTypeScriptRoute } from "./route-harness.ts";

const studioDraftRoute = fileURLToPath(new URL("../src/routes/studio-draft.ts", import.meta.url));
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;

type CleanupResult = { scanned: number; deleted: number };
type StudioDraftModule = {
  cleanupExpiredStudioDrafts: (retentionDays?: number) => Promise<CleanupResult>;
};

const ORIGINAL_STUDIO_DRAFTS_DIR = process.env["STUDIO_DRAFTS_DIR"];
let draftsDirectory = "";
let cleanupExpiredStudioDrafts: StudioDraftModule["cleanupExpiredStudioDrafts"];

function basePayload() {
  return {
    shape: "L-shape",
    dimensions: { widthMm: 2400, depthMm: 600 },
  };
}

before(async () => {
  draftsDirectory = await mkdtemp(path.join(testDirectory, ".studio-drafts-cleanup-test-"));
  process.env["STUDIO_DRAFTS_DIR"] = draftsDirectory;
  const routeModule = await importTypeScriptModule<StudioDraftModule>(studioDraftRoute);
  cleanupExpiredStudioDrafts = routeModule.cleanupExpiredStudioDrafts;
});

after(async () => {
  await rm(draftsDirectory, { force: true, recursive: true });
  if (ORIGINAL_STUDIO_DRAFTS_DIR === undefined) {
    delete process.env["STUDIO_DRAFTS_DIR"];
  } else {
    process.env["STUDIO_DRAFTS_DIR"] = ORIGINAL_STUDIO_DRAFTS_DIR;
  }
});

describe("Studio Draft rate limit and cleanup", () => {
  it("returns HTTP 429 after 20 POSTs from one IP, even when User-Agent changes", async () => {
    const server = await serveTypeScriptRoute(studioDraftRoute);
    try {
      for (let attempt = 1; attempt <= 21; attempt += 1) {
        const response = await fetch(`${server.url}/api/studio/draft`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": `studio-draft-test-${attempt}`,
          },
          body: JSON.stringify(basePayload()),
        });
        await response.arrayBuffer();

        assert.equal(response.status, attempt <= 20 ? 201 : 429, `unexpected status on request ${attempt}`);
        if (attempt === 21) {
          assert.ok(Number(response.headers.get("retry-after")) > 0);
        }
      }
    } finally {
      await server.close();
    }
  });

  it("deletes drafts older than 30 days and preserves recent drafts", async () => {
    const cleanupDirectory = await mkdtemp(path.join(testDirectory, ".studio-drafts-cleanup-fixture-"));
    process.env["STUDIO_DRAFTS_DIR"] = cleanupDirectory;
    try {
      const oldDraftPath = path.join(cleanupDirectory, "old-draft.json");
      const recentDraftPath = path.join(cleanupDirectory, "recent-draft.json");
      const oldTimestamp = new Date(Date.now() - 31 * DAY_MS);
      const recentTimestamp = new Date(Date.now() - 29 * DAY_MS);
      await writeFile(oldDraftPath, JSON.stringify({ draftKey: "old-draft" }));
      await writeFile(recentDraftPath, JSON.stringify({ draftKey: "recent-draft" }));
      await utimes(oldDraftPath, oldTimestamp, oldTimestamp);
      await utimes(recentDraftPath, recentTimestamp, recentTimestamp);

      const result = await cleanupExpiredStudioDrafts();
      const remainingFiles = await readdir(cleanupDirectory);

      assert.deepEqual(result, { scanned: 2, deleted: 1 });
      assert.deepEqual(remainingFiles, ["recent-draft.json"]);
    } finally {
      process.env["STUDIO_DRAFTS_DIR"] = draftsDirectory;
      await rm(cleanupDirectory, { force: true, recursive: true });
    }
  });

  it("returns zero counts when the drafts directory does not exist", async () => {
    const missingDirectory = path.join(draftsDirectory, "not-created");
    process.env["STUDIO_DRAFTS_DIR"] = missingDirectory;
    try {
      assert.deepEqual(await cleanupExpiredStudioDrafts(), { scanned: 0, deleted: 0 });
    } finally {
      process.env["STUDIO_DRAFTS_DIR"] = draftsDirectory;
    }
  });
});