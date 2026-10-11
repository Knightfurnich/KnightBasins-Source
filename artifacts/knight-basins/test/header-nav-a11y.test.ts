import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 453-B - findings of the independent check 451-R:
 *   A idle menu links 4.435:1 (< AA 4.5:1)    B /price-guide only in the footer
 *   C header shells differ per route         D header cart link 42x19 px (< 44 px)
 * `src/index.css` is frozen, so every fix lives in App.tsx's Header.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const css = read("../src/index.css");

/** Header() source: from its declaration to the end of the nav markup. */
const header = app.slice(app.indexOf("function Header("), app.indexOf('<div className="header-actions">'));
const style = header.slice(header.indexOf("<style>"), header.indexOf("</style>"));

const hex = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (soft: number[], ink: number[], inkPercent: number) => soft.map((v, i) => Math.round(v * (1 - inkPercent / 100) + ink[i] * (inkPercent / 100)));

describe("A - idle menu link contrast (453-B)", () => {
  // the light-theme tokens the measurement used; if index.css moves them this test must be re-read
  const INK = "#123e69";
  const INK_SOFT = "#5f7b92";
  // the header paints rgba(255,255,255,.9) over the page; the browser measured 254,255,255
  const HEADER_BG = [254, 255, 255];

  it("the tokens the measurement relied on are still in index.css", () => {
    assert.ok(css.includes(`--ink: ${INK};`) && css.includes(`--ink-soft: ${INK_SOFT};`));
  });

  it("the old colour (ink-soft alone) was below AA - the reason for the override", () => {
    assert.ok(contrast(hex(INK_SOFT), HEADER_BG) < 4.5);
  });

  it("the override keeps idle links at 4.5:1 or better", () => {
    const m = style.match(/\.site-header > \.main-nav a:not\(\.is-active\):not\(:hover\)\s*\{\s*color:\s*color-mix\(in srgb, var\(--ink-soft\) (\d+)%, var\(--ink\)\)/);
    assert.ok(m, "the idle-link colour override must exist in Header()");
    const softPercent = Number(m[1]);
    const ratio = contrast(mix(hex(INK_SOFT), hex(INK), 100 - softPercent), HEADER_BG);
    assert.ok(ratio >= 4.5, `idle link contrast ${ratio.toFixed(3)}:1`);
  });

  it("does not edit the frozen stylesheet to get there", () => {
    assert.doesNotMatch(css, /453-B/, "src/index.css must stay untouched by this job");
  });
});

describe("B - /price-guide is in the main menu (453-B)", () => {
  const nav = app.slice(app.indexOf('<nav className="main-nav"'), app.indexOf("</nav>", app.indexOf('<nav className="main-nav"')));

  it("the main nav links to /price-guide", () => {
    assert.match(nav, /<Link href="\/price-guide"[^>]*data-testid="link-price-guide"[^>]*>คู่มือราคา<\/Link>/);
  });

  it("it is marked active on its own route like the other entries", () => {
    assert.match(nav, /location === "\/price-guide" \? "is-active"/);
  });

  it("the footer links to the guide stay", () => {
    assert.match(app, /data-testid="link-footer-price-guide"/);
  });
});

describe("D - header cart link tap target (453-B)", () => {
  it("the mobile cart link is at least 44 x 44 inside the phone breakpoint", () => {
    const m = style.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.site-header \.mobile-cart\s*\{([^}]*)\}/);
    assert.ok(m, "a .mobile-cart rule must exist inside the 720px block");
    assert.match(m[1], /min-height:\s*44px/);
    assert.match(m[1], /min-width:\s*44px/);
  });

  it("the link itself is still the cart link", () => {
    assert.match(app, /className="mobile-cart"[^>]*data-testid="link-mobile-quote"/);
  });
});

describe("C - standalone page headers (453-B, documented difference)", () => {
  // Each standalone route owns its header (src/pages/** belongs to another owner, PriceGuidePage is
  // out of scope for this job). The floor they share, and which this test locks: a way back home.
  const pages: Array<[string, string]> = [
    ["components/SalesGuide.tsx", "/readme"],
    ["pages/PortfolioPage.tsx", "/portfolio"],
    ["pages/SitePrepPage.tsx", "/site-prep"],
    ["pages/StudioGuidePage.tsx", "/studio-guide"],
    ["pages/UpdatesPage.tsx", "/updates"],
    ["pages/PriceGuidePage.tsx", "/price-guide"],
  ];
  for (const [file, route] of pages) {
    it(`${route} header links back to the storefront`, () => {
      assert.match(read(`../src/${file}`), /href="\/"/, `${file} lost its link home`);
    });
  }
});
