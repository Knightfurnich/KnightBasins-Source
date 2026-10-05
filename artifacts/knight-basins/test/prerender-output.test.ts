import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ROUTE_META } from "../src/components/RouteMeta.logic.ts";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(testDirectory, "..");
const publicDirectory = join(appDirectory, "dist", "public");
const sitemapPath = join(appDirectory, "public", "sitemap.xml");

function ensureProductionBuild() {
  // CI runs this test directly from a clean checkout. Build there, but never
  // rebuild an existing dist directory: a partial output must fail the test.
  if (existsSync(publicDirectory)) return;

  execFileSync("pnpm", ["run", "build"], {
    cwd: appDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: process.env.PORT ?? "3000",
    },
    stdio: "inherit",
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match?.slice(1).find((value) => value !== undefined) ?? null;
}

function findMetaContent(html: string, name: string) {
  const metaTag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => getAttribute(tag, "name") === name);
  return metaTag ? getAttribute(metaTag, "content") : null;
}

function findCanonical(html: string) {
  const linkTag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => getAttribute(tag, "rel") === "canonical");
  return linkTag ? getAttribute(linkTag, "href") : null;
}

function visibleText(markup: string) {
  return decodeEntities(
    markup
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function renderedMainText(html: string) {
  const mainTag =
    html.match(
      /<main\b(?=[^>]*\bdata-testid=["']storefront-main["'])[^>]*>/i,
    ) ?? html.match(/<main\b[^>]*>/i);
  if (!mainTag || mainTag.index === undefined) return "";

  const contentStart = mainTag.index + mainTag[0].length;
  const contentEnd = html.indexOf("</main>", contentStart);
  return contentEnd < 0
    ? ""
    : visibleText(html.slice(contentStart, contentEnd));
}

test("production build prerenders unique, contentful HTML for every public sitemap route", () => {
  ensureProductionBuild();
  const sitemap = readFileSync(sitemapPath, "utf8");
  const locations = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(
    (match) => decodeEntities(match[1].trim()),
  );

  assert.equal(locations.length, 10, "the public sitemap must keep its 10 URLs");
  assert.equal(
    existsSync(join(publicDirectory, "admin")),
    false,
    "admin pages must never be emitted as static files",
  );

  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const canonicals = new Set<string>();
  const mainContents = new Set<string>();

  for (const location of locations) {
    const url = new URL(location);
    const route = url.pathname;
    assert.doesNotMatch(route, /^\/admin(?:\/|$)/i);

    const outputPath =
      route === "/"
        ? join(publicDirectory, "index.html")
        : join(publicDirectory, route.slice(1), "index.html");
    assert.ok(
      existsSync(outputPath),
      `Missing prerendered output for ${route}: ${outputPath}`,
    );

    const html = readFileSync(outputPath, "utf8");
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? decodeEntities(titleMatch[1].replace(/<[^>]*>/g, "").trim())
      : null;
    const description = findMetaContent(html, "description");
    const canonical = findCanonical(html);
    const entry = ROUTE_META[route];

    assert.ok(entry, `No shared route metadata is defined for ${route}`);
    assert.equal(title, entry.title, `Wrong prerendered title for ${route}`);
    assert.equal(
      description,
      entry.description,
      `Wrong prerendered description for ${route}`,
    );
    assert.equal(canonical, url.href, `Wrong canonical URL for ${route}`);
    assert.ok(title, `Missing title for ${route}`);
    assert.ok(description, `Missing description for ${route}`);
    assert.ok(canonical, `Missing canonical URL for ${route}`);
    assert.match(
      html,
      /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>/i,
      `JSON-LD was removed from ${route}`,
    );
    const pageDataScript = html.match(
      /<script\b(?=[^>]*\bdata-prerender-webpage=["']true["'])[^>]*>([\s\S]*?)<\/script>/i,
    );
    assert.ok(pageDataScript, `Missing route-specific WebPage JSON-LD for ${route}`);
    const pageData = JSON.parse(pageDataScript[1]);
    assert.equal(pageData["@type"], "WebPage", `Wrong JSON-LD type for ${route}`);
    assert.equal(pageData["@id"], `${url.href}#webpage`, `Wrong JSON-LD @id for ${route}`);
    assert.equal(pageData.url, url.href, `Wrong JSON-LD URL for ${route}`);
    assert.equal(pageData.name, entry.title, `Wrong JSON-LD name for ${route}`);
    assert.equal(
      pageData.description,
      entry.description,
      `Wrong JSON-LD description for ${route}`,
    );
    assert.equal(
      pageData.isPartOf?.["@id"],
      `${url.origin}/#website`,
      `Wrong JSON-LD site reference for ${route}`,
    );

    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    assert.ok(bodyMatch, `Missing body for ${route}`);
    const bodyText = visibleText(bodyMatch[1]);
    assert.ok(
      (bodyText.match(/[\p{L}\p{N}]+/gu) ?? []).length > 0,
      `Prerendered body has no readable text for ${route}`,
    );

    const routeMain = renderedMainText(html);
    assert.ok(routeMain, `Missing rendered main content for ${route}`);
    assert.ok(routeMain.length > 0, `Main content is empty for ${route}`);

    assert.ok(!titles.has(title), `Duplicate page title: ${title}`);
    assert.ok(
      !descriptions.has(description),
      `Duplicate page description: ${description}`,
    );
    assert.ok(!canonicals.has(canonical), `Duplicate canonical URL: ${canonical}`);
    assert.ok(
      !mainContents.has(routeMain),
      `Rendered main content is duplicated for ${route}`,
    );
    titles.add(title);
    descriptions.add(description);
    canonicals.add(canonical);
    mainContents.add(routeMain);
  }

  assert.equal(titles.size, locations.length);
  assert.equal(descriptions.size, locations.length);
  assert.equal(canonicals.size, locations.length);
  assert.equal(mainContents.size, locations.length);
});
