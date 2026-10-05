import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ROUTE_META } from "../src/components/RouteMeta.logic.ts";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(testDirectory, "..");
const appSource = readFileSync(join(appDirectory, "src/App.tsx"), "utf8");
const networkPage = readFileSync(
  join(appDirectory, "src/pages/NetworkPage.tsx"),
  "utf8",
);
const htmlShell = readFileSync(join(appDirectory, "index.html"), "utf8");
const sitemap = readFileSync(join(appDirectory, "public/sitemap.xml"), "utf8");

const expectedExternalSites = [
  "https://www.knightfurnich.com/",
  "https://xn--42cf7czb6aef3bfnp2mrg.com/",
];
const expectedSocialSites = [
  "https://line.me/R/ti/p/@789gcnhq",
  "https://www.facebook.com/knightfurnich",
];

function jsxTags(source: string, tagName: "a" | "Link") {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "g"))].map(
    (match) => match[0],
  );
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match?.slice(1).find((value) => value !== undefined) ?? null;
}

function findTagByTestId(source: string, tagName: "a" | "Link", testId: string) {
  return (
    jsxTags(source, tagName).find(
      (tag) => getAttribute(tag, "data-testid") === testId,
    ) ?? null
  );
}

function assertFollowedExternalLink(source: string, testId: string, href: string) {
  const tag = findTagByTestId(source, "a", testId);
  assert.ok(tag, `Missing external link ${testId}`);
  assert.equal(getAttribute(tag, "href"), href);
  assert.equal(getAttribute(tag, "target"), "_blank");
  const rel = getAttribute(tag, "rel")?.split(/\s+/) ?? [];
  assert.ok(rel.includes("noopener"), `${testId} must use rel="noopener"`);
  assert.ok(!rel.includes("nofollow"), `${testId} must remain a followed link`);
}

function readOrganizationSameAs(html: string) {
  const scripts = [...html.matchAll(
    /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi,
  )];
  const graph = scripts.flatMap((script) => {
    const json = JSON.parse(script[1]) as {
      "@graph"?: Array<Record<string, unknown>>;
      "@type"?: string | string[];
    };
    return Array.isArray(json["@graph"]) ? json["@graph"] : [json];
  });
  const organization = graph.find((entry) => {
    const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
    return types.includes("HomeAndConstructionBusiness");
  });
  assert.ok(organization, "Organization JSON-LD must be present");
  const sameAs = organization.sameAs;
  assert.ok(Array.isArray(sameAs), "Organization sameAs must be an array");
  const normalizedSameAs = sameAs.map((profile) => {
    assert.equal(typeof profile, "string", "Organization sameAs entries must be URLs");
    return profile.replace(/\/+$/, "");
  });
  for (const site of expectedExternalSites) {
    assert.ok(
      normalizedSameAs.includes(site.replace(/\/+$/, "")),
      `Organization sameAs is missing ${site}`,
    );
  }
}

test("network links appear in shared and standalone public footers", () => {
  const footerLinks = appSource.slice(
    appSource.indexOf("function NetworkFooterLinks()"),
    appSource.indexOf("function StandaloneNetworkFooter()"),
  );

  assertFollowedExternalLink(
    footerLinks,
    "link-footer-knightfurnich",
    expectedExternalSites[0],
  );
  assertFollowedExternalLink(
    footerLinks,
    "link-footer-hinsangkhro",
    expectedExternalSites[1],
  );
  assert.match(
    appSource.slice(appSource.indexOf("function Footer()"), appSource.indexOf("function NetworkFooterLinks()")),
    /<NetworkFooterLinks\s*\/>/,
    "The shared storefront footer must include the network links",
  );
  assert.match(
    appSource,
    /STANDALONE_PUBLIC_FOOTER_PATHS\.has\(location\)\s*&&\s*<StandaloneNetworkFooter\s*\/>/,
    "Standalone public pages must also render the network footer",
  );
  for (const route of [
    "/readme",
    "/site-prep",
    "/track",
    "/handover",
    "/updates",
    "/studio-guide",
    "/portfolio",
  ]) {
    assert.ok(
      appSource.includes(`"${route}"`),
      `Standalone public footer route is missing ${route}`,
    );
  }
  for (const existingFooterLink of ["/portfolio", "/site-prep", "/updates"]) {
    assert.ok(
      appSource.includes(`href="${existingFooterLink}"`),
      `Existing footer link ${existingFooterLink} must be preserved`,
    );
  }
  assert.match(appSource, /โชว์รูม: 35\/633 ซอยร่วมสุข 8\/1/);
  assert.match(appSource, /โรงงานผลิต: 35\/170, 35\/267/);
});

test("the public /network page has three cards and all required links", () => {
  const heading = networkPage.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(heading, "The page must have an h1");
  assert.match(heading[1], /เครือข่ายของเรา/);
  assert.doesNotMatch(networkPage, /<iframe\b/i);
  assert.doesNotMatch(networkPage, /youtube/i);
  assert.match(networkPage, /Knight Furnich/);
  assert.match(networkPage, /Knight Basins/);
  assert.match(networkPage, /หินสังเคราะห์\.com/);
  for (const card of [
    "network-card-knight-furnich",
    "network-card-knight-basins",
    "network-card-hinsangkhro",
  ]) {
    assert.ok(networkPage.includes(`data-testid="${card}"`), `Missing ${card}`);
  }

  const links = [...jsxTags(networkPage, "a"), ...jsxTags(networkPage, "Link")];
  const externalLinks = links
    .map((tag) => getAttribute(tag, "href"))
    .filter((href): href is string => href?.startsWith("https://") ?? false);
  assert.deepEqual(externalLinks, [...expectedExternalSites.slice(0, 1), ...expectedSocialSites, ...expectedExternalSites.slice(1)]);
  assertFollowedExternalLink(
    networkPage,
    "link-network-knightfurnich",
    expectedExternalSites[0],
  );
  assertFollowedExternalLink(
    networkPage,
    "link-network-hinsangkhro",
    expectedExternalSites[1],
  );
  assertFollowedExternalLink(networkPage, "link-network-line", expectedSocialSites[0]);
  assertFollowedExternalLink(networkPage, "link-network-facebook", expectedSocialSites[1]);
  for (const [testId, href] of [
    ["link-network-stone", "/stone"],
    ["link-network-portfolio", "/portfolio"],
    ["link-network-quote", "/quote"],
  ]) {
    const tag = findTagByTestId(networkPage, "Link", testId);
    assert.ok(tag, `Missing internal link ${testId}`);
    assert.equal(getAttribute(tag, "href"), href);
  }
  const networkMeta = ROUTE_META["/network"];
  assert.ok(networkMeta, "The route needs unique public metadata");
  assert.ok(networkMeta.description.length > 40);
  assert.match(appSource, /<Route path="\/network" component=\{Storefront\} \/>/);
  assert.match(appSource, /location === "\/network"[\s\S]*?<NetworkPage\s*\/>/);
});

test("Organization JSON-LD sameAs includes both official sites", () => {
  readOrganizationSameAs(htmlShell);
});

test("the sameAs regression check rejects an Organization with sameAs removed", () => {
  const withoutSameAs = htmlShell.replace(
    /"sameAs"\s*:\s*\[[\s\S]*?\]\s*,/i,
    "",
  );
  assert.notEqual(withoutSameAs, htmlShell, "Mutation fixture must remove sameAs");
  assert.throws(() => readOrganizationSameAs(withoutSameAs));
});

test("the sitemap adds /network without dropping any existing public route", () => {
  const paths = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(
    (match) => new URL(match[1].trim()).pathname,
  );
  const originalPaths = [
    "/",
    "/portfolio",
    "/stone",
    "/site-prep",
    "/studio-guide",
    "/quote",
    "/studio",
    "/sketch",
    "/readme",
    "/updates",
  ];

  assert.equal(paths.length, 11);
  assert.equal(new Set(paths).size, 11, "Sitemap routes must remain unique");
  assert.ok(paths.includes("/network"));
  for (const path of originalPaths) {
    assert.ok(paths.includes(path), `Existing sitemap route ${path} was removed`);
  }
});
