import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import express from "express";
import { DEFAULT_UPLOADS_CACHE_MAX_AGE, uploadsCacheMaxAge, uploadsStaticOptions } from "../src/lib/uploads-static.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

// job-289: the gallery routes publish 333 and 59 photos and every visit used to fetch them again, because
// express.static was mounted with no maxAge at all. The mount lives in src/app.ts, which no other test boots
// (it pulls in the database); the option object therefore lives in lib/uploads-static.ts so this file can mount
// the same options app.ts uses and assert the header a visitor actually receives.
async function serveUploads(env: NodeJS.ProcessEnv) {
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "uploads-cache-"));
  await mkdir(path.join(uploadDir, "portfolio", "bathroom"), { recursive: true });
  await writeFile(path.join(uploadDir, "portfolio", "bathroom", "bathroom_1700_abc123def456.webp"), "RIFF fake webp");
  const app = express();
  app.use("/api/uploads", express.static(uploadDir, uploadsStaticOptions(env)));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    cleanup: () => rm(uploadDir, { recursive: true, force: true }),
  };
}

const PHOTO = "portfolio/bathroom/bathroom_1700_abc123def456.webp";

describe("uploads cache policy (job-289)", () => {
  let uploads: Awaited<ReturnType<typeof serveUploads>>;
  before(async () => { uploads = await serveUploads({}); });
  after(async () => { await uploads.close(); await uploads.cleanup(); });

  it("defaults to a month instead of the old revalidate-every-visit answer", () => {
    assert.equal(uploadsCacheMaxAge({}), DEFAULT_UPLOADS_CACHE_MAX_AGE);
    assert.equal(uploadsCacheMaxAge({ UPLOADS_CACHE_MAX_AGE: "  " }), DEFAULT_UPLOADS_CACHE_MAX_AGE);
  });

  it("sends the photo with a cache lifetime and keeps a validator", async () => {
    const response = await fetch(`${uploads.url}/api/uploads/${PHOTO}`);
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    assert.match(response.headers.get("cache-control") ?? "", /max-age=2592000/, response.headers.get("cache-control") ?? "no cache-control");
    assert.ok(response.headers.get("etag") || response.headers.get("last-modified"), "revalidation must survive the cache window");
  });

  it("sends last-modified, and is honest that the win is freshness rather than a 304", async () => {
    // Measured here and on the live host: express.static answers a weak ETag (W/...), which send() will not use for a
    // 304, so a returning visitor gets 200 again if they revalidate. That is why the fix is the cache lifetime itself -
    // for thirty days a gallery visit does not revalidate at all - and why this test asserts the header, not a 304.
    const response = await fetch(`${uploads.url}/api/uploads/${PHOTO}`);
    await response.arrayBuffer();
    assert.match(response.headers.get("etag") ?? "", /^W\//, "the validator is weak, so it cannot carry a 304");
    assert.ok(response.headers.get("last-modified"), "last-modified is the fallback validator");
    const revalidated = await fetch(`${uploads.url}/api/uploads/${PHOTO}`, { headers: { "if-none-match": response.headers.get("etag") ?? "" } });
    assert.equal(revalidated.status, 200, "documented behaviour: revalidation does not save the bytes, the max-age does");
  });
});

describe("the ops valve and the page headers", () => {
  it('turns the cache back off with UPLOADS_CACHE_MAX_AGE="0" for a restore that must show now', async () => {
    assert.equal(uploadsCacheMaxAge({ UPLOADS_CACHE_MAX_AGE: "0" }), "0");
    const uploads = await serveUploads({ UPLOADS_CACHE_MAX_AGE: "0" });
    try {
      const response = await fetch(`${uploads.url}/api/uploads/${PHOTO}`);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
      assert.match(response.headers.get("cache-control") ?? "", /max-age=0/);
    } finally {
      await uploads.close();
      await uploads.cleanup();
    }
  });

  it("gives every block that sets its own nginx headers the sniff guard as well", async () => {
    const nginx = await readFile(path.join(REPO_ROOT, "deploy", "hostinger", "nginx.conf"), "utf8");
    assert.match(nginx, /^ {4}add_header X-Content-Type-Options "nosniff" always;$/m, "server level");
    assert.match(nginx, /^ {4}add_header X-Frame-Options "SAMEORIGIN" always;$/m, "pages must be frameable only by us");
    assert.match(nginx, /^ {4}add_header Referrer-Policy "strict-origin-when-cross-origin" always;$/m);
    const blocks = nginx.split(/\n(?= {4}location )/).filter((chunk) => /^ {4}location /m.test(chunk) && /add_header /.test(chunk));
    assert.ok(blocks.length >= 3, `expected the page, 404 and hashed-asset locations, found ${blocks.length}`);
    for (const block of blocks) {
      assert.match(block, /add_header X-Content-Type-Options "nosniff" always;/, `location without the sniff guard:\n${block.slice(0, 160)}`);
    }
    assert.equal(/add_header +Strict-Transport-Security/.test(nginx), false, "HSTS belongs to Traefik; this server only ever sees http");
  });
});
