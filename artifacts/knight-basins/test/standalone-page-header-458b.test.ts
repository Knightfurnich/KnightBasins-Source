import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The menu is asserted from a plain .ts module: `node --test` strips types but cannot load JSX.
import { STANDALONE_PAGE_NAV, STANDALONE_PAGE_QUOTE_LABEL } from "../src/components/standalonePageNav.ts";

/**
 * job 458-B - the four standalone pages (/readme /site-prep /portfolio /price-guide) share ONE
 * header instead of four look-alikes.
 *
 * What is locked here, and why each line earns its place:
 *  - A page that grew its own `<header>` again is exactly the drift this job was created to stop, so
 *    every page file is asserted to render the shared component exactly once and to hold no inline
 *    `<header>` of its own, `//` comments removed first so a comment can never satisfy a lock.
 *  - The shared block must *say* the same menu as the storefront header. `src/App.tsx` is frozen for
 *    this job, so the list is compared against App's real markup by parsing it - not against a copy
 *    of the labels that could rot quietly.
 *  - The mobile menu (job 431-B E) and the AA link colour (job 453-B A) were tuned in App's inline
 *    `<style>`. A standalone route never renders that `<style>`, so the shared block re-declares the
 *    same three numbers; comparing them against App's file here means a future tweak in one place
 *    turns this test red instead of silently making the two headers disagree again.
 *  - ข้อ C: the boss approved touching `/price-guide`'s header *only*, so the header's own props are
 *    checked for prices/digits and the page's price markup is checked to still be there.
 */

const read = (rel: string) => {
  const path = new URL(rel, import.meta.url);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

/**
 * Source without comments: a lock must be satisfied by code, not by prose. Template literals stay -
 * the mobile-menu CSS of the shared header *is* a template literal, and it is one of the things
 * this file checks.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const PAGES: Record<string, string> = {
  readme: "../src/components/SalesGuide.tsx",
  "site-prep": "../src/pages/SitePrepPage.tsx",
  portfolio: "../src/pages/PortfolioPage.tsx",
  "price-guide": "../src/pages/PriceGuidePage.tsx",
};
/** The `page` prefix each route passes; /readme keeps its historical "guide" ids. */
const PAGE_IDS: Record<string, string> = {
  readme: "guide",
  "site-prep": "site-prep",
  portfolio: "portfolio",
  "price-guide": "price-guide",
};
const HEADER = "../src/components/StandalonePageHeader.tsx";

/** The storefront's `.main-nav` items, read out of the frozen `src/App.tsx`. */
function storefrontMenu(): Array<{ href: string; label: string }> {
  const app = codeOnly("../src/App.tsx");
  const start = app.indexOf('<nav className="main-nav"');
  assert.ok(start >= 0, "App.tsx must still hold the storefront main-nav");
  const block = app.slice(start, app.indexOf("</nav>", start));
  const items = [...block.matchAll(/href="([^"]+)"[^>]*data-testid="(link-[^"]+)">([^<]+)</g)]
    .map(([, href, , label]) => ({ href, label: label.trim() }));
  assert.ok(items.length >= 5, `expected the storefront menu in App.tsx, read ${items.length}`);
  return items;
}

describe("ข้อ A - the standalone pages share one header block", () => {
  it("the shared header exists and is the only header markup in it", () => {
    const file = codeOnly(HEADER);
    assert.equal((file.match(/<header[\s>]/g) ?? []).length, 1, "one header element");
    assert.match(file, /className="site-header standalone-page-header"/, "it borrows the storefront classes, restating no typography");
    assert.match(file, /STANDALONE_PAGE_NAV\.map\(/, "the menu is rendered from one list");
    assert.match(file, /<Link href="\/" className="brand"/, "the brand is a link home");
    assert.match(file, /href="\/quote"/, "the quote basket is one tap away from any page");
  });

  for (const [route, rel] of Object.entries(PAGES)) {
    it(`${route} renders the shared header and no header of its own`, () => {
      const file = codeOnly(rel);
      assert.ok(file.length > 200, `${rel} should exist`);
      assert.equal((file.match(/<StandalonePageHeader\b/g) ?? []).length, 1, "exactly one shared header");
      assert.match(file, new RegExp(`<StandalonePageHeader\\s+page="${PAGE_IDS[route]}"\\s+subtitle="[^"]+"\\s*\\/>`),
        "the page passes only an id and its own subtitle");
      assert.equal((file.match(/<header[\s>]/g) ?? []).length, 0, "a page with its own header is the drift this job removes");
      assert.doesNotMatch(file, /knightFurnichLogo/, "the brand picture belongs to the shared block now");
    });
  }
});

describe("ข้อ B - home link, the same menu, and a mobile strip that shows it scrolls", () => {
  it("every page keeps a link back to the storefront (the id each probe already reads)", () => {
    const file = codeOnly(HEADER);
    assert.match(file, /data-testid=\{`link-\$\{page\}-back-to-store`\}/, "back-to-store link per page");
    assert.match(file, /\{STANDALONE_PAGE_HOME_LABEL\}/, "and it is worded the same everywhere");
    for (const route of Object.keys(PAGES)) {
      assert.match(codeOnly(PAGES[route]), new RegExp(`page="${PAGE_IDS[route]}"`), `${route} keeps its ids`);
    }
  });

  it("the shared menu is the storefront menu - same links, same words, same order", () => {
    const store = storefrontMenu();
    const mine = [...STANDALONE_PAGE_NAV, { href: "/quote", label: STANDALONE_PAGE_QUOTE_LABEL }];
    assert.deepEqual(mine.map((item) => item.href), store.map((item) => item.href),
      "a menu item added, dropped or reordered in App.tsx must be mirrored here");
    assert.deepEqual(mine.map((item) => item.label), store.map((item) => item.label),
      "the wording on the two headers has to agree");
    assert.ok(mine.some((item) => item.href === "/price-guide"), "ข้อ F: /price-guide stays in the main menu (#554)");
  });

  it("the mobile cue and the tap/colour numbers match App's frozen header rules", () => {
    const app = read("../src/App.tsx");
    const header = read(HEADER); // comments and template literals kept: this is CSS text, not code
    for (const [name, pattern] of [
      // App spells the cue as `"\2192"`, this component as `"\\2192"` (both are one backslash to CSS);
      // accept either spelling, so the check compares the rule and not the escaping style.
      ["sideways cue", /::after\s*\{[^}]*content:\s*"(?:\\{1,2}2192|\u2192)"/],
      ["44 px menu targets", /min-height:\s*44px/],
      ["AA idle link colour", /color-mix\(in srgb,\s*var\(--ink-soft\)\s*70%,\s*var\(--ink\)\)/],
    ] as const) {
      assert.match(app, pattern, `App.tsx should still define ${name} (the source of the rule)`);
      assert.match(header, pattern, `the shared header must define the same ${name} - a standalone route never renders App's <style>`);
    }
  });
});

describe("ข้อ C - the price guide stays out of the header", () => {
  it("the header CSS is one well-formed template literal (a stray backtick once killed every page)", () => {
    const raw = read(HEADER);
    const literals = raw.match(/<style>\{`[\s\S]*?`\}<\/style>/g) ?? [];
    assert.equal(literals.length, 1, "exactly one <style> template literal");
    const css = literals[0].replace(/^<style>\{`/, "").replace(/`\}<\/style>$/, "");
    assert.equal(css.includes("`"), false, "a backtick inside the literal closes it early - the bundle then throws at render");
    assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length, "the rules must balance");
    assert.ok(/@media \(max-width: 720px\)/.test(css), "the mobile block must exist - no standalone route renders App's <style>");
  });

  it("the back-to-store button is a 44 px target too, at every width", () => {
    const css = read(HEADER);
    assert.match(css, /\.standalone-page-header \.standalone-back-home[\s\S]{0,120}min-height:\s*44px/,
      "the button inherits 10 px padding from .button, which measured 42 px before this rule");
  });

  it("the header row of /price-guide carries no figure and no price word", () => {
    const file = codeOnly(PAGES["price-guide"]);
    const [row] = file.match(/<StandalonePageHeader[^>]*\/>/) ?? [];
    assert.ok(row, "the shared header is rendered");
    assert.doesNotMatch(row ?? "", /\d/, "a header line must not hold a number");
    assert.doesNotMatch(row ?? "", /\u0e1a\u0e32\u0e17|THB|\u0e1a\u0e23\u0e34\u0e15|\u0e40\u0e15\u0e47\u0e21\u0e40\u0e25\u0e/,
      "the header is a label, never a price line - only its structure was approved for touching");
  });

  it("the price page's own content markers are untouched (only the header moved)", () => {
    const file = read(PAGES["price-guide"]);
    for (const marker of ["data-testid=\"price-guide-content\"", "buildPriceGuideJsonLd(", "PRICE_GUIDE_SCHEMA_PRICES", "<th scope=\"row\""]) {
      assert.ok(file.includes(marker), `${marker} must survive the header change`);
    }
  });

  it("the guide and portfolio keep their own body content", () => {
    assert.ok(codeOnly(PAGES.readme).includes('data-testid="link-guide-hub-portfolio"'), "the guide's hub links are not part of the header");
    assert.ok(codeOnly(PAGES.portfolio).includes('data-testid="portfolio-heading"'), "the portfolio heading is not part of the header");
    assert.ok(codeOnly(PAGES["site-prep"]).includes('data-testid="section-site-prep-hero"'), "the site-prep hero is not part of the header");
  });
});
