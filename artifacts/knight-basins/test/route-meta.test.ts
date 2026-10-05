import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRouteMeta, ROUTE_META } from "../src/components/RouteMeta.logic.ts";

type FakeElement = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

function fakeElement(initialContent: string | null): FakeElement {
  let content = initialContent;
  return {
    getAttribute: (name) => (name === "content" || name === "href" ? content : null),
    setAttribute: (name, value) => {
      if (name === "content" || name === "href") content = value;
    },
    removeAttribute: (name) => {
      if (name === "content" || name === "href") content = null;
    },
  };
}

function fakeDocument(initial: Record<string, string | null>) {
  const elements = new Map(Object.entries(initial).map(([selector, value]) => [selector, fakeElement(value)]));
  return {
    title: "Knight Furnich | หน้าแรก",
    querySelector: (selector: string) => elements.get(selector) ?? null,
    _elements: elements,
  };
}

const BASELINE = {
  'meta[name="description"]': "default description",
  'meta[property="og:title"]': "default og title",
  'meta[property="og:description"]': "default og description",
  'meta[property="og:url"]': "https://knightbasins.com/",
  'meta[name="twitter:title"]': "default twitter title",
  'meta[name="twitter:description"]': "default twitter description",
  'meta[name="robots"]': "index, follow",
  'link[rel="canonical"]': "https://knightbasins.com/",
};

describe("applyRouteMeta", () => {
  it("sets title, description, canonical and OG tags for a known route", () => {
    const doc = fakeDocument(BASELINE);
    applyRouteMeta("/portfolio", doc as never, "https://knightbasins.com");

    assert.equal(doc.title, ROUTE_META["/portfolio"]?.title);
    assert.equal(doc._elements.get('meta[name="description"]')?.getAttribute("content"), ROUTE_META["/portfolio"]?.description);
    assert.equal(doc._elements.get('meta[property="og:title"]')?.getAttribute("content"), ROUTE_META["/portfolio"]?.title);
    assert.equal(doc._elements.get('meta[property="og:url"]')?.getAttribute("content"), "https://knightbasins.com/portfolio");
    assert.equal(doc._elements.get('link[rel="canonical"]')?.getAttribute("href"), "https://knightbasins.com/portfolio");
  });

  it("strips the query string by looking up the bare pathname only", () => {
    const doc = fakeDocument(BASELINE);
    // Caller is expected to pass the bare pathname (as wouter's useLocation
    // already does); this just documents that a token-bearing path with no
    // table entry falls into the noindex branch rather than matching /quote.
    applyRouteMeta("/quote/view", doc as never, "https://knightbasins.com");
    assert.equal(doc._elements.get('meta[name="robots"]')?.getAttribute("content"), "noindex, nofollow");
  });

  it("restores every original value when the returned cleanup runs", () => {
    const doc = fakeDocument(BASELINE);
    const restore = applyRouteMeta("/stone", doc as never, "https://knightbasins.com");

    restore();

    assert.equal(doc.title, "Knight Furnich | หน้าแรก");
    for (const [selector, originalValue] of Object.entries(BASELINE)) {
      if (selector === 'meta[name="robots"]') continue;
      const attr = selector.startsWith("link") ? "href" : "content";
      assert.equal(doc._elements.get(selector)?.getAttribute(attr), originalValue, `expected ${selector} restored`);
    }
  });

  it("sets robots to noindex for a route with no table entry (private pages and the soft-404 fallback)", () => {
    const doc = fakeDocument(BASELINE);
    applyRouteMeta("/track", doc as never, "https://knightbasins.com");
    assert.equal(doc._elements.get('meta[name="robots"]')?.getAttribute("content"), "noindex, nofollow");

    const unknownRouteDoc = fakeDocument(BASELINE);
    applyRouteMeta("/this-page-does-not-exist-xyz", unknownRouteDoc as never, "https://knightbasins.com");
    assert.equal(unknownRouteDoc._elements.get('meta[name="robots"]')?.getAttribute("content"), "noindex, nofollow");
  });

  it("restores the original robots value when leaving a noindexed route", () => {
    const doc = fakeDocument(BASELINE);
    const restore = applyRouteMeta("/admin", doc as never, "https://knightbasins.com");
    restore();
    assert.equal(doc._elements.get('meta[name="robots"]')?.getAttribute("content"), "index, follow");
  });

  it("does not throw when a selector is missing from the document", () => {
    const doc = fakeDocument({});
    assert.doesNotThrow(() => applyRouteMeta("/", doc as never, "https://knightbasins.com")());
  });
});
