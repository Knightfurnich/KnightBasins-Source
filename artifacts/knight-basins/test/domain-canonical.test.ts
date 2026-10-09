/**
 * Guards the single canonical host (job 272).
 *
 * The app was served from knightbasins.srv1964473.hstgr.cloud and now lives on
 * https://knightbasins.com. Google and AI crawlers consolidate signals from the
 * canonical URL only, so a stale legacy hostname left behind in sitemap.xml,
 * robots.txt, llms.txt or the JSON-LD graph quietly splits the site in two.
 * These assertions fail loudly instead.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const LEGACY_HOST = "knightbasins.srv1964473.hstgr.cloud";
const CANONICAL = "https://knightbasins.com";

const read = (relative: string) => readFileSync(path.join(appRoot, relative), "utf8");

describe("canonical domain", () => {
  it("keeps the legacy hostname out of every public-facing file", () => {
    const files = [
      "index.html",
      "public/sitemap.xml",
      "public/sitemap_index.xml",
      "public/robots.txt",
      "public/llms.txt",
      "public/llms-full.txt",
      "src/data/structured-data.ts",
      "src/data/faq-data.ts",
    ];
    for (const file of files) {
      assert.ok(!read(file).includes(LEGACY_HOST), `${file} still contains ${LEGACY_HOST}`);
    }
  });

  it("lists every sitemap URL on the canonical domain", () => {
    const sitemap = read("public/sitemap.xml");
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(locs.length >= 10, `expected at least 10 sitemap URLs, found ${locs.length}`);
    for (const loc of locs) {
      assert.ok(loc.startsWith(`${CANONICAL}/`), `${loc} is not on ${CANONICAL}`);
    }
    assert.equal(new Set(locs).size, locs.length, "sitemap URLs must be unique");
    const index = read("public/sitemap_index.xml");
    assert.ok(index.includes(`${CANONICAL}/sitemap.xml`), "sitemap_index.xml must point at the canonical sitemap");
  });

  it("points robots.txt at the canonical sitemap and still welcomes AI crawlers", () => {
    const robots = read("public/robots.txt");
    assert.ok(robots.includes(`Sitemap: ${CANONICAL}/sitemap.xml`), "robots.txt needs the canonical Sitemap line");
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"]) {
      assert.ok(robots.includes(`User-agent: ${bot}`), `robots.txt should keep welcoming ${bot}`);
    }
  });

  it("uses the canonical URL in the shell canonical, og:url and JSON-LD ids", () => {
    const shell = read("index.html");
    assert.ok(shell.includes(`<link rel="canonical" href="${CANONICAL}/"`), "shell canonical must be the canonical domain");
    assert.ok(shell.includes(`content="${CANONICAL}/"`), "og:url must be the canonical domain");
    assert.ok(shell.includes(`"@id": "${CANONICAL}/#organization"`), "organization @id must be the canonical domain");
  });

  it("serves llms.txt content from the canonical domain", () => {
    for (const file of ["public/llms.txt", "public/llms-full.txt"]) {
      const text = read(file);
      assert.ok(text.includes(CANONICAL), `${file} should reference ${CANONICAL}`);
    }
  });

  it("keeps one URL per page: index.html, trailing slashes and www all redirect", () => {
    const nginx = readFileSync(path.join(repoRoot, "deploy", "hostinger", "nginx.conf"), "utf8");
    // /index.html is the same page as /, a trailing slash is the same page without it,
    // and www is the same host without it. Google needs one of each, not several.
    assert.match(nginx, /location = \/index\.html \{\s*return 301 https:\/\/knightbasins\.com\/;/, "index.html must 301 to the canonical root");
    assert.match(nginx, /if \(\$host = www\.knightbasins\.com\)/, "www must be redirected to the apex host");
    assert.match(nginx, /return 301 https:\/\/knightbasins\.com\$1\$is_args\$args;/, "trailing slashes must 301 to the slashless URL and keep the query string");
    // The API and hashed assets are not pages and must keep answering directly.
    assert.ok(!/location = \/index\.html \{[\s\S]{0,200}\/api\//.test(nginx), "the API must not be caught by the page rules");
  });

  it("keeps the retired legacy hostname out of the deploy config", () => {
    const nginx = readFileSync(path.join(repoRoot, "deploy", "hostinger", "nginx.conf"), "utf8");
    // The legacy host is retired on purpose: one canonical hostname, no redirect
    // host left behind. If it creeps back into nginx.conf or the Traefik labels
    // the site silently splits across two hosts again.
    assert.ok(!nginx.includes(LEGACY_HOST), `deploy/hostinger/nginx.conf still contains ${LEGACY_HOST}`);
    assert.ok(!nginx.includes("knight_legacy_host"), "the legacy host map must be gone from nginx.conf");
    assert.match(
      nginx,
      /server_name knightbasins\.com www\.knightbasins\.com;/,
      "nginx must serve only the canonical hosts",
    );
    const compose = readFileSync(path.join(repoRoot, "deploy", "hostinger", "docker-compose.yml"), "utf8");
    assert.ok(!compose.includes(LEGACY_HOST), `deploy/hostinger/docker-compose.yml still contains ${LEGACY_HOST}`);
  });
});
