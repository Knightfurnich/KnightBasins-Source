/**
 * Guards the business identity a crawler reads (job 273, done by david).
 *
 * The shell's HomeAndConstructionBusiness node is copied into every prerendered page,
 * so a wrong phone number, a stale address or a dead social link ships site-wide and
 * quietly contradicts the Google Business Profile. Google and AI assistants compare
 * these values; a mismatch costs local visibility. Asserted here, and the same values
 * must keep matching the GBP listing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { breadcrumbItemsForPath, buildQuotePageJsonLd, buildStonePageJsonLd } from "../src/data/structured-data.ts";

const appRoot = path.resolve(import.meta.dirname, "..");
const shell = readFileSync(path.join(appRoot, "index.html"), "utf8");

function businessNode(): Record<string, any> {
  const blocks = [...shell.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const block of blocks) {
    let parsed: any;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const nodes = parsed["@graph"] ?? [parsed];
    const hit = nodes.find((node: any) => node["@type"] === "HomeAndConstructionBusiness");
    if (hit) return hit;
  }
  throw new Error("index.html no longer carries a HomeAndConstructionBusiness node");
}

describe("business JSON-LD", () => {
  const org = businessNode();

  it("uses the showroom address the boss confirmed, not the factory", () => {
    const address = org.address;
    assert.equal(address["@type"], "PostalAddress");
    assert.match(address.streetAddress, /^35\/633 ซอยร่วมสุข 8\/1/);
    assert.equal(address.addressLocality, "อ.เมือง");
    assert.equal(address.addressRegion, "จ.ปทุมธานี");
    assert.equal(address.postalCode, "12000");
    assert.equal(address.addressCountry, "TH");
    assert.ok(!/35\/170|35\/267/.test(JSON.stringify(address)), "the factory address must not be the primary address");
  });

  it("leads with the primary phone and keeps the second line reachable", () => {
    assert.equal(org.telephone, "+66-91-978-2292");
    const phones = (org.contactPoint ?? []).map((c: any) => c.telephone);
    assert.deepEqual(phones, ["+66-91-978-2292", "+66-94-496-1949"]);
  });

  it("carries the coordinates from the Maps listing and a map link", () => {
    assert.equal(org.geo["@type"], "GeoCoordinates");
    assert.equal(org.geo.latitude, 13.9567567);
    assert.equal(org.geo.longitude, 100.56523);
    assert.match(String(org.hasMap), /^https:\/\/maps\.app\.goo\.gl\/|^https:\/\/www\.google\.com\/maps/);
  });

  it("lists every profile that actually resolves and no dead link", () => {
    const sameAs: string[] = org.sameAs;
    for (const expected of [
      "https://www.facebook.com/knightfurnich",
      "https://www.instagram.com/knightfurnich",
      "https://www.tiktok.com/@knightfurnich",
      "https://line.me/R/ti/p/@789gcnhq",
      "https://www.knightfurnich.com",
      "https://xn--42cf7czb6aef3bfnp2mrg.com/",
    ]) {
      assert.ok(sameAs.includes(expected), `sameAs is missing ${expected}`);
    }
    // @knightfurnich returns 404 on YouTube, so it must not reappear without the real URL.
    assert.ok(!sameAs.some((url) => /youtube\.com/i.test(url)), "a dead YouTube link must not ship");
  });

  it("keeps the rest of the identity intact", () => {
    assert.equal(org.priceRange, "฿฿฿");
    assert.equal(org.areaServed.length >= 3, true);
    assert.match(String(org.url), /^https:\/\/knightbasins\.com\/$/);
    assert.ok(Array.isArray(org.openingHoursSpecification) && org.openingHoursSpecification.length >= 1);
  });

  it("keeps existing opening hours pending confirmation of the GBP discrepancy", () => {
    assert.deepEqual(org.openingHoursSpecification, [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:30",
        closes: "16:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday"],
        opens: "08:30",
        closes: "11:30",
      },
    ]);
  });
});

describe("stone and quotation route schemas", () => {
  const appSource = readFileSync(path.join(appRoot, "src", "App.tsx"), "utf8");
  const stone = JSON.parse(JSON.stringify(buildStonePageJsonLd()));
  const quote = JSON.parse(JSON.stringify(buildQuotePageJsonLd()));

  it("/stone describes a Product and the fabrication/installation Service", () => {
    assert.equal(stone["@context"], "https://schema.org");
    const product = stone["@graph"].find((node: any) => node["@type"] === "Product");
    assert.ok(product, "/stone must retain its Product node");
    assert.equal(product.url, "https://knightbasins.com/stone");
    assert.equal(product.material, "Solid Surface");
    assert.ok(product.name.length > 0);
    assert.equal(product.brand["@id"], "https://knightbasins.com/#organization");
    const service = stone["@graph"].find((node: any) => node["@type"] === "Service");
    assert.ok(service, "/stone must retain its Service node");
    assert.equal(service.provider["@id"], "https://knightbasins.com/#organization");
  });

  it("/quote describes the public quotation Service even with an empty cart", () => {
    assert.equal(quote["@context"], "https://schema.org");
    assert.equal(quote["@type"], "Service");
    assert.equal(quote.url, "https://knightbasins.com/quote");
    assert.equal(quote.provider["@id"], "https://knightbasins.com/#organization");
    assert.ok(quote.name.length > 0 && quote.serviceType.length > 0);
  });

  it("publishes no guessed prices, offers, ratings or customer fields", () => {
    const forbidden = new Set(["price", "priceCurrency", "priceSpecification", "offers", "aggregateRating", "review", "customer", "email", "telephone"]);
    function check(value: unknown) {
      if (!value || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        assert.ok(!forbidden.has(key), `route schema must not fabricate or expose ${key}`);
        check(nested);
      }
    }
    check(stone);
    check(quote);
  });

  it("mounts each schema inside its route component, not only on the home page", () => {
    const stoneSource = appSource.slice(appSource.indexOf("function StonePage("), appSource.indexOf("function SavedQuotePage("));
    const quoteSource = appSource.slice(appSource.indexOf("function QuotePage("), appSource.indexOf("function Storefront("));
    assert.match(stoneSource, /<RouteStructuredData id="stone-products" data=\{buildStonePageJsonLd\(\)\} \/>/);
    assert.match(quoteSource, /<RouteStructuredData id="quote-service" data=\{buildQuotePageJsonLd\(\)\} \/>/);
  });
});

describe("breadcrumb trails", () => {
  it("covers every public sitemap route", () => {
    const sitemap = readFileSync(path.join(appRoot, "public", "sitemap.xml"), "utf8");
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    assert.ok(paths.length >= 10, `expected at least 10 sitemap routes, found ${paths.length}`);
    for (const route of paths) {
      if (route === "/") continue; // the home page is the top of every trail
      const trail = breadcrumbItemsForPath(route);
      assert.ok(trail && trail.length >= 2, `${route} has no breadcrumb trail`);
      assert.equal(trail[0].path, "/", `${route} trail must start at the home page`);
      assert.equal(trail[trail.length - 1].path, route, `${route} trail must end at itself`);
    }
  });
});
