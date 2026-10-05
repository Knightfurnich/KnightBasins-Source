/**
 * Guards the real-404 behaviour.
 *
 * The SPA fallback answered 200 for every unknown path, so Google crawled URLs that
 * do not exist (soft 404s) and burned crawl budget on them. nginx now returns a real
 * 404 with a noindex page, while the client-only routes (admin portals and the private
 * customer links) keep serving the shell. These assertions keep both halves honest.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const nginx = readFileSync(path.join(repoRoot, "deploy", "hostinger", "nginx.conf"), "utf8");

describe("serving hygiene", () => {
  it("ships a noindex 404 page that leads back to the real pages", () => {
    const page = path.join(appRoot, "public", "404.html");
    assert.ok(existsSync(page), "public/404.html must exist");
    const html = readFileSync(page, "utf8");
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
    for (const href of ['href="/"', 'href="/stone"', 'href="/quote"', 'href="/portfolio"']) {
      assert.ok(html.includes(href), `the 404 page should link ${href}`);
    }
  });

  it("returns a real 404 for paths that are not pages", () => {
    assert.ok(nginx.includes("error_page 404 /404.html;"), "nginx must serve the 404 page");
    assert.ok(
      nginx.includes("try_files $uri $uri/index.html =404;"),
      "location / must 404 instead of falling back to the shell",
    );
    assert.ok(!nginx.includes("try_files $uri $uri/index.html $uri/ /index.html;"), "the old SPA fallback must be gone");
  });

  it("compresses text responses (the bundle shipped raw before)", () => {
    assert.ok(nginx.includes("gzip on;"), "gzip must be enabled");
    assert.ok(nginx.includes("gzip_vary on;"), "Vary: Accept-Encoding must be set for caches");
    for (const type of ["text/css", "application/javascript", "application/json", "image/svg+xml"]) {
      assert.ok(nginx.includes(type), `gzip_types should cover ${type}`);
    }
  });

  it("revalidates the prerendered HTML instead of caching it for a year", () => {
    const pageLocation = nginx.slice(nginx.indexOf("location / {"));
    assert.match(pageLocation, /add_header Cache-Control "no-cache" always;/);
  });

  it("keeps the SPA shell for client-only routes", () => {
    assert.match(
      nginx,
      /location ~ \^\/\(\?:admin\|track\|profile\|handover\|quote\/view\)\(\?:\/\|\$\) \{/,
      "the client-only route whitelist must be present",
    );
    assert.ok(nginx.includes("try_files /index.html =404;"), "client-only routes must still get the shell");
  });
});
