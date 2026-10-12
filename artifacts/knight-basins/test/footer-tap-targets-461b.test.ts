import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 461-B (+ ฉบับแก้ 1) — the links at the bottom of every page have to be real tap targets.
 *
 * Round 1 sized the three sister-site links of `NetworkFooterLinks` (Chai measured 23.1 px in job 460-C
 * step 0; re-measured on a build of `main` here: 46.2 / 23.1 / 23.1 px at 390 px, the first being a
 * label that wraps to two lines). The follow-up sizes the six links of the footer's meta bar, measured
 * in this sandbox at 17.0 px (five) and 23.1 px (Private Workbench) — David re-measured and agreed.
 *
 * Locks, and why each earns its place:
 *  - one shared size value, declared once, carrying 44 px on the property that grows a line of text
 *    (`lineHeight`) and the same floor on the box (`minHeight`) — `min-height` alone does nothing to an
 *    inline box, and a `display` change moves links between lines (measured) which GOAL C forbids;
 *  - all nine footer links reference that one value; the count is pinned so a tenth footer link cannot
 *    ship without a size;
 *  - hrefs, order and the `footer-owner-link` class are unchanged — this job changes sizes, not the
 *    footer's content, and it must not turn the VAT notice into a link;
 *  - the frozen `src/index.css` holds none of it; the header built in 453-B and the hero rule of #449
 *    are still present and still outside the touched range.
 *
 * Attributes are read the way the browser does (tag by tag), because attribute order and the optional
 * `data-testid` are not what this job is about.
 */

const ROUND_ONE = {
  ids: ["link-footer-knightfurnich", "link-footer-hinsangkhro", "link-network-footer-price-guide"],
  hrefs: ["https://www.knightfurnich.com/", "https://xn--42cf7czb6aef3bfnp2mrg.com/", "/price-guide"],
};
const ROUND_TWO_HREFS = ["/portfolio", "/price-guide", "/site-prep", "/updates", "/network", "/?workbench=1"];
const ALL_FOOTER_LINKS = ROUND_ONE.ids.length + ROUND_TWO_HREFS.length;
const SIZE = "FOOTER_TAP_TARGET";   // the attribute parser reads the expression inside { }

const appSource = () => readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

/** Region of `App.tsx` between two markers, with comments removed (prose must not satisfy a lock). */
function region(from: string, to: string): string {
  const full = appSource();
  const start = full.indexOf(from);
  const end = full.indexOf(to, start + from.length);
  assert.ok(start >= 0, `src/App.tsx lost ${from}`);
  assert.ok(end > start, `src/App.tsx lost ${to} after ${from}`);
  return full.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
}

const sizeRegion = () => region("const FOOTER_TAP_TARGET", "function Footer()");
const metaBarRegion = () => region("function Footer()", "function NetworkFooterLinks");
const networkRegion = () => region("function NetworkFooterLinks", "function StandaloneNetworkFooter");
const footerRegion = () => region("const FOOTER_TAP_TARGET", "function StandaloneNetworkFooter");

/** Footer link tags of a region as { href, className, style, testid }, in source order. */
function footerLinks(source: string) {
  return [...source.matchAll(/<(?:Link|a)\b([^>]*)>/g)]
    .map((m) => {
      const attrs: Record<string, string> = {};
      for (const a of m[1].matchAll(/(href|className|data-testid|style|aria-label)(?:="([^"]*)"|=\{([^}]*)\})/g)) {
        attrs[a[1]] = a[2] ?? a[3] ?? "";
      }
      return attrs;
    })
    .filter((t) => t.className === "footer-owner-link");
}

// A `<Link>` tag spans several source lines when its attributes are listed one per line (the round-1
// trio does exactly that), so the tag window is taken by characters, not by lines.
describe("ข้อ A - one 44 px value, shared", () => {
  it("declared once, 44 px on the box and on the line box, with no display change", () => {
    assert.equal((appSource().match(/const FOOTER_TAP_TARGET/g) ?? []).length, 1,
      "nine links in two components share one value; a second copy is the drift this repo pays jobs to remove");
    assert.match(sizeRegion(), /minHeight:\s*44/, "the box floor");
    assert.match(sizeRegion(), /lineHeight:\s*"44px"/, "these boxes are lines of text, so the line height is what grows the target");
    assert.doesNotMatch(sizeRegion(), /\bdisplay\s*:/, "a display change moves links between lines (measured) - forbidden by GOAL C");
  });

  it("all nine footer links reference it", () => {
    assert.equal((footerRegion().match(/style=\{FOOTER_TAP_TARGET\}/g) ?? []).length, ALL_FOOTER_LINKS,
      "a footer link appeared without a size, or the sharing stopped");
  });
});

describe("ข้อ A (round 1) - the three sister-site links", () => {
  const links = footerLinks(networkRegion());

  it("same three hrefs, same order, each sized", () => {
    assert.deepEqual(links.map((l) => l.href), ROUND_ONE.hrefs, "same links in the same order, no invented target");
    assert.equal(links.filter((l) => l.style === SIZE).length, 3, "one of the sister-site links lost its tap size");
  });

  it("the probe-facing data-testids are intact", () => {
    assert.deepEqual(links.map((l) => l["data-testid"]), ROUND_ONE.ids, "453-B/460-C read these ids");
  });

  it("the scrollable strip markup is untouched", () => {
    assert.match(networkRegion(), /<span className="flex flex-wrap gap-x-4 gap-y-1">/);
  });
});

describe("ข้อ A (ฉบับแก้ 1) - the six meta-bar links", () => {
  const links = footerLinks(metaBarRegion());

  it("exactly these six hrefs, in order, each sized", () => {
    assert.deepEqual(links.map((l) => l.href), ROUND_TWO_HREFS, "a meta-bar link was added, dropped, reordered or re-pointed");
    assert.equal(links.filter((l) => l.style === SIZE).length, ROUND_TWO_HREFS.length,
      "at least one meta-bar link still has a 17-23 px target");
  });

  it("the price notice and the collection line stay plain text", () => {
    const block = metaBarRegion();
    assert.match(block, /<span>[^<]*VAT[^<]*<\/span>/, "the VAT notice must not become a link");
    assert.match(block, /<span>TH \/ 2026 COLLECTION<\/span>/, "same for the collection line");
    // nothing in the meta bar became a new link, and no price figure moved into one
    // (the meta bar also holds the maps link and the two plain spans; only the six may be links)
    assert.equal(footerLinks(block).length, ROUND_TWO_HREFS.length, "the meta bar gained or lost a footer link");
  });
});

describe("ข้อ B/C - frozen files and neighbours stay out of it", () => {
  it("src/index.css contains none of this fix", () => {
    const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /FOOTER_TAP_TARGET|footer-network-link/, "the sheet is frozen for this job");
    assert.doesNotMatch(css, /\.footer-owner-link\s*\{[^}]*(line-height|min-height):\s*44px/, "no 44 px rule smuggled into the frozen sheet");
    assert.match(css, /\.footer-owner-link \{/, "the frozen colour rule still paints these links");
  });

  it("the 453-B header rules and the #449 hero are still in place", () => {
    const full = appSource();
    assert.match(full, /function Header\(/, "storefront header of 453-B");
    assert.match(full, /\.site-header \.mobile-cart \{[^}]*min-width: 44px/, "453-B's mobile cart size");
    assert.match(full, /\.main-nav::after \{[^}]*content: "\u2192"/, "431-B's mobile menu cue");
    assert.match(full, /catalog-hero|stone-hero/, "the hero this job may not touch");
  });

  it("no horizontal overflow is hidden", () => {
    assert.doesNotMatch(footerRegion(), /overflow-x:\s*hidden/, "measure and fix, never mask");
  });
});
