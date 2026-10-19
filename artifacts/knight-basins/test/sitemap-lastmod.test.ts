import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// Read the shipped XML, never a separate test fixture.
const xml = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const expected = [
  ["/", "daily", "1.0"],
  ["/portfolio", "daily", "0.95"],
  ["/stone", "weekly", "0.9"],
  ["/price-guide", "weekly", "0.85"],
  ["/site-prep", "weekly", "0.85"],
  ["/studio-guide", "monthly", "0.85"],
  ["/quote", "weekly", "0.85"],
  ["/studio", "monthly", "0.8"],
  ["/sketch", "monthly", "0.75"],
  ["/readme", "monthly", "0.7"],
  ["/updates", "weekly", "0.6"],
  ["/network", "monthly", "0.55"],
] as const;
const entries = [...xml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)].map((match) => {
  const field = (name: string) => {
    const values = [...match[1].matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))];
    assert.equal(values.length, 1, `Each URL must have exactly one ${name}`);
    return values[0][1];
  };
  return {
    loc: field("loc"), lastmod: field("lastmod"),
    changefreq: field("changefreq"), priority: field("priority"),
  };
});

// Confirmed route-specific deployment dates, from the owner's evidence table.
// UPDATE_RELEASES lives in src/pages/UpdatesPage.tsx, not src/data. Its global
// dateTime is not a per-route change date. Applying it to every URL would force
// fabricated dates on the explicitly preserved /portfolio, /site-prep, /studio
// and /updates rows. Use the authorized (1)+(2) fallback plus the known floors.
const confirmedChanges: Record<string, string> = {
  "/": "2026-10-12",
  "/stone": "2026-10-13",
  "/price-guide": "2026-10-13",
  "/studio-guide": "2026-10-13",
  "/quote": "2026-10-13",
  "/sketch": "2026-10-13",
  "/readme": "2026-10-12",
};

describe("sitemap lastmod freshness", () => {
  it("keeps the twelve real URLs, order, origin, frequency and priority", () => {
    assert.match(xml, /<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.equal((xml.match(/<url>/g) ?? []).length, 12);
    assert.equal((xml.match(/<\/url>/g) ?? []).length, 12);
    assert.deepEqual(
      entries.map(({ loc, changefreq, priority }) => [loc, changefreq, priority]),
      expected.map(([path, frequency, priority]) => [`https://knightbasins.com${path}`, frequency, priority]),
    );
  });

  it("requires one real YYYY-MM-DD calendar date per URL, never in the future", () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    for (const entry of entries) {
      assert.match(entry.lastmod, /^\d{4}-\d{2}-\d{2}$/, `${entry.loc}: invalid lastmod format`);
      const date = new Date(`${entry.lastmod}T00:00:00.000Z`);
      assert.ok(Number.isFinite(date.getTime()), `${entry.loc}: invalid lastmod date`);
      assert.equal(date.toISOString().slice(0, 10), entry.lastmod, `${entry.loc}: impossible calendar date`);
      assert.ok(entry.lastmod <= today, `${entry.loc}: future lastmod ${entry.lastmod} > ${today} (Asia/Bangkok)`);
    }
  });

  it("never predates the confirmed content change for each of the seven affected routes", () => {
    for (const [path, minimum] of Object.entries(confirmedChanges)) {
      const entry = entries.find(({ loc }) => loc === `https://knightbasins.com${path}`);
      assert.ok(entry, `Missing confirmed route ${path}`);
      assert.ok(entry.lastmod >= minimum, `${path}: stale lastmod ${entry.lastmod}; confirmed change requires >= ${minimum}`);
    }
  });

  it("requires a sitemap review when the declared release changes", () => {
    // A review trigger, NOT a global lastmod floor for unchanged pages.
    const releases = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
    const latest = releases.match(/export const UPDATE_RELEASES\s*=\s*\[\s*\{[^}]*?\bdateTime:\s*["']([^"']+)["']/)?.[1];
    assert.equal(latest, "2026-10-04",
      "Release changed or is no longer readable: review affected sitemap dates and confirmedChanges, then update the reviewed release date; never bulk-date unchanged routes");
  });
});
