import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dropInheritedFaqJsonLd } from "../scripts/prerender-faq.mjs";

// job-288: the drop step documents an escape hatch (a route that really renders an FAQ flags its block with
// data-route-schema) and then, on the very next lines, refused to accept any leftover FAQPage - so the flagged
// block was deleted *and* the build threw. The policy itself is not touched here: the homepage keeps its FAQ, other
// routes lose an inherited one, and nothing about how strict the guard is has been loosened.

const faqNode = { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "ถาม?", acceptedAnswer: { "@type": "Answer", text: "ตอบ" } }] };
const otherNode = { "@type": "WebSite", "@id": "https://knightbasins.com/#website" };

const block = (payload, attributes = "") =>
  `<script type="application/ld+json"${attributes}>${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;

const shell = (withFlag) =>
  `<html><head>${block({ "@context": "https://schema.org", "@graph": [otherNode, faqNode] }, withFlag ? ' data-route-schema="faq"' : "")}</head>` +
  `<body><h1>หน้าเว็บ</h1></body></html>`;

const route = (path) => ({ path });
const faqCount = (html) => (html.match(/"@type": ?\\?"FAQPage\\?"/g) ?? []).length;

describe("prerender FAQ drop keeps its documented escape hatch (job-288)", () => {
  it("the homepage keeps the ten-question FAQ it really renders", () => {
    const html = shell(false);
    assert.equal(dropInheritedFaqJsonLd(html, route("/")), html, "the home page must be left alone");
  });

  it("an unflagged inherited FAQPage is removed from every other route", () => {
    const out = dropInheritedFaqJsonLd(shell(false), route("/portfolio"));
    assert.equal(faqCount(out), 0, `FAQPage survived: ${out}`);
    assert.ok(out.includes("WebSite"), "the rest of the graph must not be taken down with the FAQ");
    assert.ok(out.includes("<h1>หน้าเว็บ</h1>"), "the body is untouched");
  });

  it("a flagged block - a route with its own FAQ - is kept and the build does not fail (the bug)", () => {
    const html = shell(true);
    const out = dropInheritedFaqJsonLd(html, route("/price-guide"));
    assert.equal(faqCount(out), 1, "the route renders its own FAQ, so it must still be advertised");
    assert.match(out, /data-route-schema="faq"/, "the flag itself must survive so the next reader knows why");
  });

  it("a block carrying FAQPage next to other top-level keys still refuses to be rewritten", () => {
    const html = `<html><head>${block({
      "@context": "https://schema.org",
      "@graph": [faqNode],
      "dateModified": "2026-10-08",
    })}</head><body></body></html>`;
    assert.throws(
      () => dropInheritedFaqJsonLd(html, route("/quote")),
      /shares a block with other top-level keys/,
      "dropping data silently is not an option",
    );
  });

  it("unparseable JSON-LD in a leftover FAQ block is an error, not a skip", () => {
    const html = '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage",</script></head><body></body></html>';
    assert.throws(
      () => dropInheritedFaqJsonLd(html, route("/sketch")),
      /cannot be parsed/,
      "a half-written block must stop the build instead of shipping whatever the regex matched",
    );
  });

  it("an FAQPage with no @graph entry left behind removes the whole block", () => {
    const html = `<html><head>${block({ "@context": "https://schema.org", "@graph": [faqNode] })}</head><body></body></html>`;
    const out = dropInheritedFaqJsonLd(html, route("/site-prep"));
    assert.equal(out.includes("application/ld+json"), false, `empty block left behind: ${out}`);
  });

  it("a route with both a flagged FAQ block of its own and an inherited one keeps only its own", () => {
    const flagged = block({ "@context": "https://schema.org", "@graph": [faqNode] }, ' data-route-schema="faq"');
    const inherited = block({ "@context": "https://schema.org", "@graph": [faqNode] });
    const out = dropInheritedFaqJsonLd(`<html><head>${flagged}${inherited}</head><body></body></html>`, route("/updates"));
    assert.equal(faqCount(out), 1, "exactly the flagged copy should remain");
    assert.match(out, /data-route-schema="faq"/);
  });
});
