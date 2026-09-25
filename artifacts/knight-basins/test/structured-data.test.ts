/**
 * Tests for the route-level structured data builders.
 *
 * These guard the contract that Google / Bing / AI assistants rely on:
 * a JSON-LD blob that is valid, carries stable @id values, and points at the
 * live canonical URLs. A typo in a @type or a missing @id silently degrades
 * rich results without ever throwing at runtime, so it has to be asserted here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPortfolioStructuredData, buildSitePrepStructuredData } from "../src/data/structured-data.ts";

describe("buildPortfolioStructuredData", () => {
  const categories = [
    { slug: "bathroom", name: "งานห้องน้ำ", icon: "🛁", count: 69 },
    { slug: "kitchen", name: "งานครัว", icon: "🍳", count: 18 },
  ];

  it("emits a valid ImageGallery entity", () => {
    const data = buildPortfolioStructuredData(categories, 124);
    assert.equal(data["@type"], "ImageGallery");
    assert.equal(data["@context"], "https://schema.org");
    assert.equal(data["@id"], "https://knightbasins.srv1964473.hstgr.cloud/portfolio#gallery");
    assert.equal(data.url, "https://knightbasins.srv1964473.hstgr.cloud/portfolio");
  });

  it("reports the live total in both the description and numberOfItems", () => {
    const data = buildPortfolioStructuredData(categories, 124);
    assert.equal(data.numberOfItems, 124);
    assert.ok(String(data.description).includes("124"));
  });

  it("links itself to the site and the organization by @id", () => {
    const data = buildPortfolioStructuredData(categories, 124);
    assert.deepEqual(data.isPartOf, { "@id": "https://knightbasins.srv1964473.hstgr.cloud/#website" });
    assert.deepEqual(data.publisher, { "@id": "https://knightbasins.srv1964473.hstgr.cloud/#organization" });
  });

  it("maps every category to a hasPart sub-gallery with URL-encoded slugs", () => {
    const data = buildPortfolioStructuredData(categories, 124);
    const parts = data.hasPart as Array<Record<string, unknown>>;
    assert.equal(parts.length, 2);
    assert.equal(parts[0].url, "https://knightbasins.srv1964473.hstgr.cloud/portfolio?category=bathroom");
    assert.equal(parts[0].numberOfItems, 69);
    assert.equal(parts[1].url, "https://knightbasins.srv1964473.hstgr.cloud/portfolio?category=kitchen");
  });

  it("omits hasPart entirely when no categories are known yet", () => {
    const data = buildPortfolioStructuredData([], 0);
    assert.equal("hasPart" in data, false);
  });

  it("survives a JSON round-trip (nothing undefined leaks into the payload)", () => {
    const data = buildPortfolioStructuredData(categories, 124);
    const parsed = JSON.parse(JSON.stringify(data));
    assert.deepEqual(parsed, data);
  });
});

describe("buildSitePrepStructuredData", () => {
  it("emits a valid HowTo entity", () => {
    const data = buildSitePrepStructuredData();
    assert.equal(data["@type"], "HowTo");
    assert.equal(data["@id"], "https://knightbasins.srv1964473.hstgr.cloud/site-prep#howto");
    assert.equal(data.url, "https://knightbasins.srv1964473.hstgr.cloud/site-prep");
    assert.equal(data.inLanguage, "th-TH");
  });

  it("numbers every step consecutively starting at 1", () => {
    const data = buildSitePrepStructuredData();
    const steps = data.step as Array<Record<string, unknown>>;
    assert.ok(steps.length >= 4);
    steps.forEach((step, index) => {
      assert.equal(step["@type"], "HowToStep");
      assert.equal(step.position, index + 1);
      assert.ok(typeof step.name === "string" && step.name.length > 0);
      assert.ok(typeof step.text === "string" && step.text.length > 0);
    });
  });

  it("survives a JSON round-trip (nothing undefined leaks into the payload)", () => {
    const data = buildSitePrepStructuredData();
    const parsed = JSON.parse(JSON.stringify(data));
    assert.deepEqual(parsed, data);
  });
});