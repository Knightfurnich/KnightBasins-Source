import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 461-B — the three sister-site links at the bottom of every page (the block
 * `NetworkFooterLinks` renders into both the storefront footer and the standalone footer) were a
 * 23.1 px tall tap target. Chai measured that in job 460-C step 0; this job re-measured it on a
 * production build of `main` (23.1 px at 390 / 360 / 768 / 1440) and raised it to 44 px.
 *
 * What is locked, and why:
 *  - the size object exists in the footer block and is applied to exactly the three named links —
 *    adding a fourth link without a tap size, or dropping the size, fails here;
 *  - `lineHeight` (not only `min-height`) has to carry it: the links are inline boxes in the frozen
 *    stylesheet, and `min-height` does nothing to an inline box. Measured, a class rule also lost to
 *    `.footer-contact-item > span:last-child`, which is why the size sits on the element;
 *  - no `display` change: `display: inline-flex` was tried and measured — it collapsed the three
 *    links from three lines onto one at 390 px, i.e. it re-flowed the footer, which GOAL C forbids;
 *  - `src/index.css` stays clean of it (frozen) and the hero rule of #449 plus the header of #554
 *    are still in the file, untouched.
 *
 * Two-way proof is run against this file: removing `style={FOOTER_TAP_TARGET}` from one link, or
 * deleting the size object, must turn these cases red.
 */

const FOOTER_IDS = [
  "link-footer-knightfurnich",
  "link-footer-hinsangkhro",
  "link-network-footer-price-guide",
];

const appSource = () => readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

/** `NetworkFooterLinks` with comments stripped, so prose can never satisfy a lock. */
function footerBlock(): string {
  const full = appSource();
  const start = full.indexOf("function NetworkFooterLinks");
  assert.ok(start >= 0, "src/App.tsx must still define NetworkFooterLinks");
  const end = full.indexOf("function StandaloneNetworkFooter", start);
  assert.ok(end > start, "the standalone footer must still follow it");
  return full.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
}

describe("ข้อ A - the three footer links are 44 px tap targets", () => {
  const block = footerBlock();

  it("the size object states 44 px, through the line box", () => {
    assert.match(block, /const FOOTER_TAP_TARGET = \{\s*minHeight: 44,\s*lineHeight: "44px"\s*\} as const/,
      "min-height alone does nothing to an inline link; the height has to come from line-height too");
    assert.doesNotMatch(block, /FOOTER_TAP_TARGET = \{[^}]*display\s*:/,
      "a display change re-flowed the three links onto one line at 390 px (measured) — not allowed");
  });

  for (const id of FOOTER_IDS) {
    it(`${id} carries the size object and keeps its class and href`, () => {
      assert.match(block, new RegExp(`style=\\{FOOTER_TAP_TARGET\\}[^]*?data-testid="${id}"`),
        `${id} lost its tap size (or a link was added/removed in this block)`);
      assert.match(block, new RegExp(`className="footer-owner-link"[^]*?data-testid="${id}"`),
        `${id} must keep the footer link class the frozen stylesheet colours`);
    });
  }

  it("exactly the three named links are sized", () => {
    assert.equal((block.match(/style=\{FOOTER_TAP_TARGET\}/g) ?? []).length, 3, FOOTER_IDS.join(", "));
  });
});

describe("ข้อ B/C - nothing else in the footer, the file or the frozen sheet moved", () => {
  const block = footerBlock();

  it("the three links keep their order and destinations", () => {
    const order = [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(order.slice(0, 3), [
      "https://www.knightfurnich.com/",
      "https://xn--42cf7czb6aef3bfnp2mrg.com/",
      "/price-guide",
    ], "the same three links, in the same order, with no invented target");
  });

  it("the wrapper markup is still the flex strip that main has", () => {
    assert.match(block, /<span className="flex flex-wrap gap-x-4 gap-y-1">/);
    assert.match(block, /data-testid="footer-network-links"/);
  });

  it("src/index.css carries no part of this fix (frozen for this job)", () => {
    const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /footer-network-link|FOOTER_TAP_TARGET/);
    assert.match(css, /\.footer-owner-link \{/, "the existing link colour rule must still be the one that paints them");
  });

  it("the rest of App.tsx is untouched where this job may not go", () => {
    const full = appSource();
    assert.match(full, /function Header\(/, "storefront header (job 453-B / #554)");
    assert.match(full, /catalog-hero/, "hero (rule #449)");
    assert.match(full, /function StandaloneNetworkFooter/, "the other footer that renders this same block");
    assert.equal((full.match(/const FOOTER_TAP_TARGET/g) ?? []).length, 1, "the size object exists once, in the footer block");
  });
});
