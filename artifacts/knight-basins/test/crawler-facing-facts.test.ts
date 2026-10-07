import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// job-285: the crawler-facing facts that live in the built HTML rather than in the React tree. An AI engine reads the
// static output, so these are the promises worth locking:
//  - only the homepage advertises the ten-question FAQPage (measured on the live routes: all 12 advertised it, but the
//    visible question marks were / = 69, /stone = 1, /network = 1);
//  - every route says who published it and when the page was generated (measured before: 0 of 12 had either);
//  - og:url and canonical name the route they are on, and the email the footer already shows is in the JSON-LD
//    (og:url already per-route before this work; the assertion stays so it cannot regress).

const testDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(testDirectory, "..");
const publicDirectory = join(appDirectory, "dist", "public");
const routes = ["/", "/portfolio", "/stone", "/price-guide", "/site-prep", "/studio-guide", "/quote", "/studio", "/sketch", "/readme", "/updates", "/network"];

if (!existsSync(join(publicDirectory, "index.html"))) {
  // same contract as prerender-output.test.ts: CI builds first, a dev run builds once here

  execFileSync("pnpm", ["run", "build"], {
    cwd: appDirectory,
    env: { ...process.env, NODE_ENV: "production", PORT: process.env.PORT ?? "3000" },
    stdio: "inherit",
  });
}

function pageHtml(path) {
  const file = path === "/" ? "index.html" : `${path.replace(/^\//, "")}/index.html`;
  const target = join(publicDirectory, file);
  if (!existsSync(target)) {
    throw new Error(`[crawler-facing-facts] ${target} is missing — run "pnpm run build" (vite build + prerender) first.`);
  }
  const html = readFileSync(target, "utf8");
  // index.html is the shell every route is built from; each route writes its own copy
  return { html, blocks: [...html.matchAll(/<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]) };
}

function faqQuestionCounts(blocks) {
  return blocks.reduce((total, body) => {
    let doc;
    try { doc = JSON.parse(body); } catch { return total; }
    const nodes = Array.isArray(doc?.["@graph"]) ? doc["@graph"] : [doc];
    for (const node of nodes) {
      if (node?.["@type"] === "FAQPage") total += (node.mainEntity ?? []).length;
    }
    return total;
  }, 0);
}

test("the FAQPage schema only rides along on the page that actually answers it", () => {
  for (const routePath of routes) {
    const { blocks } = pageHtml(routePath);
    const count = faqQuestionCounts(blocks);
    if (routePath === "/") {
      assert.equal(count, 10, "the homepage keeps its ten-question FAQ");
    } else {
      assert.equal(count, 0, `${routePath} renders no FAQ section but advertises ${count} questions`);
    }
  }
});

test("every route carries authorship and a generation date an AI citation can use", () => {
  for (const routePath of routes) {
    const { html, blocks } = pageHtml(routePath);
    const page = blocks.map((b) => { try { return JSON.parse(b); } catch { return null; } })
      .find((doc) => doc?.["@type"] === "WebPage");
    assert.ok(page, `${routePath} must expose a WebPage node`);
    assert.match(String(page.dateModified), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `${routePath} dateModified`);
    assert.equal(page.author?.["@id"], "https://knightbasins.com/#organization", `${routePath} author`);
    assert.equal(page.inLanguage, "th", `${routePath} inLanguage`);
    // the build minifies the JSON-LD, so match with or without the space after the colon
    assert.match(html, /"email": ?"info@knightfurnich.com"/, `${routePath} must publish the company email`);
  }
});

test("no route claims the homepage as its own og:url, and zoom is not blocked", () => {
  for (const routePath of routes.filter((path) => path !== "/")) {
    const { html } = pageHtml(routePath);
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(ogUrl, `https://knightbasins.com${routePath}`, `${routePath} og:url`);
    assert.equal(canonical, `https://knightbasins.com${routePath}`, `${routePath} canonical`);
  }
  assert.doesNotMatch(pageHtml("/").html, /maximum-scale\s*=\s*1/, "pinching to zoom must stay available");
});

test("the sitemap pages are reachable without JavaScript, /network included", () => {
  // Where Chromium rendered the app, the footer link is in the page itself; where prerender fell back to the
  // static shell there is no DOM to inspect, so the shipped bundle is checked instead — /network is only
  // discoverable at all if the footer that links to it is in the code the browser loads.
  const assets = readdirSync(join(publicDirectory, "assets")).filter((name) => name.endsWith(".js"));
  const bundles = assets.map((name) => readFileSync(join(publicDirectory, "assets", name), "utf8")).join("\n");
  for (const routePath of routes) {
    const { html } = pageHtml(routePath);
    const linkedInHtml = /href="\/network"/.test(html);
    assert.ok(linkedInHtml || /["']\/network["']/.test(bundles), `${routePath}: nothing links to /network`);
  }
});
