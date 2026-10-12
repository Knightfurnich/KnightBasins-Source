import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 465-C: readable text on every storefront page in both themes.
 *
 * The browser sweep (qa/tools/contrast-probe.js) is the proof of the final pixels; this file pins the *causes* so they
 * cannot come back unnoticed: Tailwind `dark:` utilities never fire (the theme is data-theme="dark", nothing adds a
 * `.dark` class), the global `a { color: inherit }` / `h1,h2,h3 { color: var(--ink) }` beat utilities, and
 * `bg-[var(--ink)]` flips with the theme. Every colour pair named below is also checked by WCAG arithmetic.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = read("../src/index.css");
const priceGuide = read("../src/pages/PriceGuidePage.tsx");
const updates = read("../src/pages/UpdatesPage.tsx");
const network = read("../src/pages/NetworkPage.tsx");
const themeStyles = read("../src/components/ThemeToggle.tsx");
// light + shared half in index.css, dark half in STOREFRONT_THEME_STYLES (a test keeps dark-theme rules out of index.css)
const block =
  css.slice(css.indexOf("job 465-C · readable text")) +
  "\n" +
  themeStyles.slice(themeStyles.indexOf("job 465-C · dark theme"), themeStyles.indexOf("export type StorefrontThemeValue"));

const hex = (v: string) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const classStrings = (src: string) => [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2] ?? "");

describe("A/B pages no longer rely on dead or flipping utilities", () => {
  for (const [name, src] of Object.entries({ "PriceGuidePage": priceGuide, "UpdatesPage": updates, "NetworkPage": network })) {
    it(`${name}: no Tailwind dark: utility in any className (they never fire)`, () => {
      const dead = classStrings(src).filter((c) => /(^|\s)dark:/.test(c));
      assert.deepEqual(dead, []);
    });
  }
  it("/price-guide NEXT STEP band sits on --deep (does not flip with the theme), not --ink", () => {
    assert.doesNotMatch(priceGuide, /bg-\[var\(--ink\)\]/);
    assert.match(priceGuide, /\.pg-next \{ background: var\(--deep\); color: #ffffff; \}/);
    assert.match(priceGuide, /<section className="pg-next /);
  });
  it("the NEXT STEP heading and the CTA label carry their own colour (global h2 / a rules would otherwise win)", () => {
    assert.match(priceGuide, /\.pg-next-title \{ color: #ffffff; \}/);
    assert.match(priceGuide, /\.pg-next-cta \{ background: #ffffff; color: #020617; \}/);
    assert.match(priceGuide, /className="pg-next-title mt-2/);
    assert.match(priceGuide, /pg-next-cta rounded-full[^"]*" data-testid="link-price-guide-final-quote"/);
  });
  it("the CARE cards use the themed surface, not a fixed slate-100 with --ink text", () => {
    assert.doesNotMatch(priceGuide, /bg-slate-100/);
    assert.match(priceGuide, /\[data-theme="dark"\] \.pg-soft \{ background: #1e293b; color: var\(--ink\); \}/);
  });
  it("/network and /updates: cards, links and badges follow the theme", () => {
    assert.doesNotMatch(network, /(text|border|bg)-(slate|sky)-\d|bg-white/);
    assert.match(network, /\[data-theme="dark"\] \.nw-card \{ background: var\(--card-paper\)/);
    assert.match(network, /\[data-theme="dark"\] \.nw-accent \{ color: #7dd3fc; \}/);
    assert.match(updates, /\[data-theme="dark"\] \.up-header \{ background: rgba\(18, 24, 32, 0\.92\); \}/);
    assert.match(updates, /\[data-theme="dark"\] \.up-badge \{ color: #0b1324; \}/);
  });
});

describe("index.css 465-C block pins the C-H causes", () => {
  it("exists, and the colour tokens and hero rule #449 are not edited by it", () => {
    assert.ok(block.length > 500);
    assert.ok(!css.includes('data-theme="dark"'), "dark-theme rules stay out of the frozen stylesheet");
    assert.ok(themeStyles.includes('[data-theme="dark"] .quote-share'), "the dark half lives in STOREFRONT_THEME_STYLES");
    assert.doesNotMatch(block, /--ink:|--paper:|--card-paper:|--line:|--deep:|--brand-blue:|--brand-sky:/, "tokens are read, never assigned, in this block");
    assert.doesNotMatch(block, /catalog-basin-hero|catalog-hero|\.hero-copy/);
  });
  it("C: /quote share box has its own solid fill and text colour in both themes", () => {
    assert.match(block, /\.quote-share \{ background: #ffffff !important;/);
    assert.match(block, /\.quote-share strong \{ color: #123e69 !important; \}/);
    assert.match(block, /\[data-theme="dark"\] \.quote-share \{ background: var\(--card-paper\) !important;/);
  });
  it("D: home studio action follows the dark theme", () => {
    assert.match(block, /\[data-theme="dark"\] \.product-card-action--studio \{ background: var\(--brand-sky\) !important;[^}]*color: var\(--brand-blue\) !important;/);
    assert.match(block, /\.product-card-action--quote,/);
  });
  it("E: portfolio tabs and #003366 text on the dark page (white cards excluded)", () => {
    assert.match(block, /button\[data-testid\^="portfolio-tab-"\]\[class\*="bg-white"\] \{ background: var\(--card-paper\) !important; \}/);
    assert.match(block, /\[class\*="text-\[#003366\]"\]:not\(\[class\*="bg-white"\] \*\)/);
  });
  it("F: stone swatch label keeps the bright tile and gets dark text", () => {
    assert.match(css, /\.material-swatch > span small \{ color: #1f2937 !important; \}/);
    assert.doesNotMatch(themeStyles, /material-swatch/, "stone samples stay out of the theme styles (storefront-theme-toggle test)");
    assert.doesNotMatch(block, /\.material-swatch \{[^}]*background/, "the tile fill is not changed");
  });
  it("G: Maps button on amber has dark text", () => {
    assert.match(block, /\[data-testid="link-google-maps-factory"\] \{ color: #0f172a !important; \}/);
  });
  it("H: studio pale panels follow the theme; canvas and material tiles are not touched", () => {
    for (const cls of ["studio-piece-card", "studio-selector-trigger", "studio-edge-select", "studio-edge-finish-option", "studio-draft-banner"]) {
      assert.ok(block.includes(`.${cls}`), cls);
    }
    for (const forbidden of ["studio-canvas", "studio-stone-choice", "studio-basin-choice", "studio-canvas-quickbar"]) {
      assert.ok(!block.includes(forbidden), `${forbidden} must keep its light fill`);
    }
  });
});

describe("colour pairs introduced by 465-C clear WCAG AA by arithmetic", () => {
  const pairs: Array<[string, string, string, number]> = [
    ["A /price-guide NEXT STEP h2 on --deep (light)", "#ffffff", "#0e355b", 4.5],
    ["A NEXT STEP h2 on --deep (dark)", "#ffffff", "#0b1324", 4.5],
    ["A CTA label", "#020617", "#ffffff", 4.5],
    ["A NEXT STEP kicker", "#bfdbfe", "#0e355b", 4.5],
    ["A muted text on dark card", "#cbd5e1", "#162238", 4.5],
    ["A accent on dark page", "#93c5fd", "#0f172a", 4.5],
    ["A faint caption on dark page", "#a9b8cc", "#0f172a", 4.5],
    ["A dark CARE card", "#e8eff8", "#1e293b", 4.5],
    ["A hero button label (dark)", "#0b1324", "#7ab9fb", 4.5],
    ["B network accent (dark)", "#7dd3fc", "#0f172a", 4.5],
    ["B network accent (light)", "#0369a1", "#ffffff", 4.5],
    ["B update badge (dark)", "#0b1324", "#7ab9fb", 4.5],
    ["C quote-share title (light)", "#123e69", "#ffffff", 4.5],
    ["C quote-share text (light)", "#3b556e", "#ffffff", 4.5],
    ["C quote-share title (dark)", "#e8eff8", "#162238", 4.5],
    ["D studio action (dark)", "#7ab9fb", "#1a3049", 4.5],
    ["E #003366 swapped for brand blue on dark", "#7ab9fb", "#0f172a", 4.5],
    ["F swatch label", "#1f2937", "#f5f3eb", 4.5],
    ["G maps button", "#0f172a", "#ffb900", 4.5],
    ["H amber marker label", "#0b1324", "#b07a12", 4.5],
    ["H required red (dark)", "#ff9b8d", "#162238", 4.5],
    ["primary sky-blue button label", "#0b1324", "#42a9d8", 4.5],
    ["light price note", "#4f6a80", "#f6fbfe", 4.5],
    ["light h2 sub-title", "#5b6663", "#f6fbfe", 4.5],
    ["light preset active", "#0f6ea8", "#ffffff", 4.5],
    ["light track kicker", "#8a4f0f", "#ffffff", 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) {
    it(`${name}: ${fg} on ${bg}`, () => assert.ok(ratio(fg, bg) >= min, `${ratio(fg, bg).toFixed(2)} < ${min}`));
  }
  it("every listed colour is actually written in the source it claims", () => {
    const all = css + priceGuide + updates + network + themeStyles;
    for (const c of ["#020617", "#bfdbfe", "#7dd3fc", "#3b556e", "#1f2937", "#ff9b8d", "#4f6a80", "#5b6663", "#0f6ea8", "#8a4f0f", "#0b1324"]) {
      assert.ok(all.includes(c), c);
    }
  });
});
