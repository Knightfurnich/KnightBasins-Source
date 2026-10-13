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
  themeStyles.slice(themeStyles.indexOf("job 465-C · dark theme"), themeStyles.indexOf("job 468-R · hero rule #449"));

const hex = (v: string) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

describe("468-R hero, labels and independent night-work fee", () => {
  const dark468 = themeStyles.slice(themeStyles.indexOf("job 468-R · hero rule #449"), themeStyles.indexOf("export type StorefrontThemeValue"));
  const light468 = css.slice(css.indexOf("job 468-R · pinned text colours only"));
  it("all three dark heroes, headings/emphasis, small copy and links get white text and a dark shadow", () => {
    assert.match(dark468, /\[data-theme="dark"\] :is\(\.catalog-hero, \.stone-hero, \.quote-heading\)/);
    for (const selector of ["h1 em", ".eyebrow", ".hero-index span", ".hero-copy", ".quote-date button", "a)"]) assert.ok(dark468.includes(selector), selector);
    assert.match(dark468, /color: #ffffff !important;/);
    assert.match(dark468, /text-shadow: 0 0 2px #07111f, 0 0 4px #07111f, 0 1px 6px #07111f, 0 2px 12px #07111f;/);
    assert.ok(ratio("#ffffff", "#07111f") >= 4.5);
    const declarations = dark468.match(/\{([^}]+)\}/)?.[1] ?? "";
    assert.ok(declarations.length > 20);
    assert.ok(declarations.split(";").filter((x) => x.trim()).every((x) => /^\s*(color|text-shadow):/.test(x)), "hero permits text colour/shadow only");
  });
  it("light product labels are pinned without changing dark chips or label geometry", () => {
    assert.match(light468, /\[data-theme="light"\] \.product-index,\n\[data-theme="light"\] \.art-note \{ color: #34495b; \}/);
    for (const bg of ["#e7e4dc", "#edf8fc", "#dceef7"]) assert.ok(ratio("#34495b", bg) >= 4.5, bg);
    assert.match(themeStyles, /background-color: rgba\(11, 19, 36, 0\.88\)/);
  });
  it("PROJECT DETAILS and footer meta use readable light-theme text without changing colour tokens", () => {
    assert.match(light468, /\.quote-main \.eyebrow \{ color: #4b6276; \}/);
    assert.match(light468, /\.footer-meta \{ color: #4b6276; \}/);
    for (const bg of ["#e4f2f8", "#f6fbfe"]) assert.ok(ratio("#4b6276", bg) >= 4.5);
    assert.doesNotMatch(light468 + dark468, /--[\w-]+\s*:/);
    assert.doesNotMatch(dark468, /dark:/);
  });
  it("the price guide imports NIGHT_WORK_FEE and never couples the night charge to installation", () => {
    assert.match(priceGuide, /import \{[^}]*\bNIGHT_WORK_FEE\b[^}]*\} from "@\/data\/catalog"/);
    assert.match(priceGuide, /formatTHB\(NIGHT_WORK_FEE\)\} \/ คืน/);
    assert.match(priceGuide, /formatTHB\(INSTALLATION_PRICE\)\} \/ ชุด/);
    assert.doesNotMatch(priceGuide, /formatTHB\(INSTALLATION_PRICE\)\} \/ คืน/);
    const expression = priceGuide.match(/\{(formatTHB\([A-Z_]+\))\} \/ คืน/)?.[1];
    assert.ok(expression);
    const render = new Function("formatTHB", "NIGHT_WORK_FEE", "INSTALLATION_PRICE", `return ${expression}`);
    const format = (n: number) => n.toLocaleString("en-US");
    assert.equal(render(format, 7300, 5100), "7,300");
    assert.equal(render(format, 7300, 9900), "7,300");
    assert.equal(render(format, 8600, 5100), "8,600");
  });
  it("CI builds then sweeps both widths, fails without Chrome, and allowlists only the unchanged LINE green", () => {
    const workflow = read("../../../.github/workflows/release-validation.yml");
    const sweep = read("../../../qa/tools/sweep-467c.mjs");
    const scanner = read("../../../qa/tools/gradient-scan-465c.mjs");
    const job = workflow.slice(workflow.indexOf("\n  contrast-sweep:"));
    assert.match(job, /timeout-minutes: 10/);
    assert.match(job, /width: \[1440, 390\]/);
    assert.match(job, /CHROME_BIN: "\/usr\/bin\/google-chrome"/);
    assert.match(job, /pnpm --filter @workspace\/knight-basins run build/);
    assert.match(job, /node qa\/tools\/sweep-467c\.mjs/);
    assert.match(job, /contrast was NOT checked/);
    assert.match(sweep, /const ALLOWLIST = \[\{/);
    assert.match(sweep, /row\.fg\.slice\(0, 3\)\.every/);
    assert.match(sweep, /Math\.abs\(row\.ratio - 2\.26\)/);
    assert.doesNotMatch(sweep, /filter\(\(x\) => !x\.hero/);
    assert.match(sweep, /if \(!existsSync\(chrome\)\)/);
    assert.match(sweep, /Expected 12 sitemap routes/);
    assert.match(scanner, /required hero\/product-label pixels were NOT checked/);
  });
});
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
  it("blind spot: footer and Studio sketch banner lose their pale gradient in the dark theme (the probe skips text over a background-image)", () => {
    assert.match(themeStyles, /\[data-theme="dark"\] \.site-footer \{ background-image: none !important; background-color: #0b1324 !important; \}/);
    assert.match(themeStyles, /\[data-theme="dark"\] \.studio-sketch-bridge-banner \{ background-image: none !important; background-color: var\(--card-paper\) !important; \}/);
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
    ["--ink-soft token on the page paper", "#577186", "#f6fbfe", 4.5],
    ["--ink-soft token on the palest measured fill", "#577186", "#f5fbfe", 4.5],
    ["--ink-soft token on white", "#577186", "#ffffff", 4.5],
    ["--ink-soft token on the quote-format panel fill", "#577186", "#f5fbfe", 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) {
    it(`${name}: ${fg} on ${bg}`, () => assert.ok(ratio(fg, bg) >= min, `${ratio(fg, bg).toFixed(2)} < ${min}`));
  }
  it("the light --ink-soft token is the darkened one (it was 4.26-4.44, the cause of ~97% of the remaining light failures)", () => {
    assert.match(css, /--ink-soft: #577186;/);
    assert.doesNotMatch(css, /--ink-soft: #5f7b92;/);
    assert.ok(ratio("#5f7b92", "#f6fbfe") < 4.5, "the old value really was under AA");
    assert.match(css, /\.hero-copy \{ color: var\(--ink-soft\); \}/, "hero copy follows the token (its own #5a7890 was 4.45)");
    assert.doesNotMatch(css, /color: #5a7890/);
  });
  it("every listed colour is actually written in the source it claims", () => {
    const all = css + priceGuide + updates + network + themeStyles;
    for (const c of ["#020617", "#bfdbfe", "#7dd3fc", "#3b556e", "#1f2937", "#ff9b8d", "#4f6a80", "#5b6663", "#0f6ea8", "#8a4f0f", "#0b1324"]) {
      assert.ok(all.includes(c), c);
    }
  });
});

/**
 * job 466-C: /sketch in the dark theme. The upload panel, photo slots, AI result cards, workpiece cards and the bridge banner
 * kept a fixed pale fill (a linear-gradient, #fff, #f8fbfd) under dark-theme text tokens. contrast-probe.js skips text over a
 * background-image, so the numbers said 0; qa/tools/gradient-scan-465c.mjs samples the real pixels and found 9-18 points per state.
 */
describe("466-C /sketch dark theme", () => {
  const sketchDark = themeStyles.slice(themeStyles.indexOf("job 466-C · /sketch in the dark theme"), themeStyles.indexOf("export type StorefrontThemeValue"));
  it("the dark block exists and lives in STOREFRONT_THEME_STYLES, not in the frozen stylesheet", () => {
    assert.ok(sketchDark.length > 800);
    assert.ok(!css.includes('data-theme="dark"'));
  });
  it("upload panel, result cards and workpiece cards drop the pale gradient / fill in the dark theme", () => {
    assert.match(sketchDark, /\.studio-page--sketch :is\(\.studio-sketch-dropzone, \.studio-sketch-analysis-card, \.studio-sketch-workpiece-card\) \{\s*background-image: none !important; background-color: var\(--card-paper\) !important; border-color: var\(--line\) !important;/);
    assert.match(sketchDark, /\.studio-sketch-slot:not\(\.studio-sketch-slot--filled\) \{ background-color: var\(--brand-sky\) !important;/);
    assert.match(sketchDark, /:is\(\.studio-sketch-bridge-banner, \.sketch-studio-bridge-banner\) \{ background-image: none !important; background-color: var\(--card-paper\) !important;/);
  });
  it("text that used fixed dark colours now follows the tokens, but the cut-out note keeps its own amber pair", () => {
    assert.match(sketchDark, /\.studio-sketch-workpiece-section > strong/);
    assert.match(sketchDark, /\.studio-sketch-analysis-copy p:not\(\.studio-sketch-cutout-note\)/);
    assert.match(sketchDark, /\.studio-sketch-no-cutouts/);
  });
  it("the light theme keeps its gradient exactly (nothing in the dark block is unscoped)", () => {
    assert.match(css, /background: linear-gradient\(135deg, #f8fcfe 0%, #eef7fb 100%\);/);
    assert.match(css, /background: linear-gradient\(110deg, #f1f8fc, #fff\);/);
    for (const line of sketchDark.split("\n").filter((l) => /\{/.test(l) && !l.trim().startsWith("/*") && !l.trim().startsWith("*"))) {
      assert.match(line, /\[data-theme="dark"\]|^\s+background-image/, `unscoped selector: ${line.trim().slice(0, 60)}`);
    }
  });
  it("465 regression closed: the light .price-note colour does not reach the note inside the navy summary panel", () => {
    assert.match(css, /\[data-theme="light"\] \.config-summary \.price-note \{ color: #a9b3af !important; \}/);
    assert.ok(ratio("#a9b3af", "#0e375e") >= 4.5, "pale note on the navy panel");
  });
  it("validation warning and the two light-theme greys / reds use their own readable colours", () => {
    assert.match(css, /\.studio-sketch-dim-field small\.studio-warning \{ color: #a83f37 !important; \}/);
    assert.match(css, /\[data-theme="light"\] \.studio-page--sketch \.studio-sketch-no-cutouts \{ color: #55697a !important; \}/);
    assert.match(css, /\[data-theme="light"\] \.studio-contact-grid label span \{ color: #b8412f; \}/);
  });
  const pairs: Array<[string, string, string]> = [
    ["dark: panel title / banner / rotate hint (--ink on --card-paper)", "#e8eff8", "#162238"],
    ["dark: 'หรือเลือกไฟล์…' / 'เพิ่มรูป' / no-cut-outs (--ink-soft)", "#aab9cc", "#162238"],
    ["dark: 'เพิ่มรูป' on the slot fill (--brand-sky)", "#aab9cc", "#1a3049"],
    ["dark: 'แนบแล้ว' + camera / file buttons (--brand-blue)", "#7ab9fb", "#162238"],
    ["light: no-cut-outs on white", "#55697a", "#ffffff"],
    ["light: no-cut-outs on the workpiece card", "#55697a", "#f8fbfd"],
    ["light: required red on the paper", "#b8412f", "#f6fbfe"],
    ["warning text on its pale-red fill (both themes)", "#a83f37", "#fff1ef"],
  ];
  for (const [name, fg, bg] of pairs) it(`${name}: ${fg} on ${bg} >= 4.5`, () => assert.ok(ratio(fg, bg) >= 4.5, `${ratio(fg, bg).toFixed(2)}`));
  it("the gradient-aware scanner exists and samples real pixels (the reason the probe's 0 was not trustworthy)", () => {
    const scanner = read("../../../qa/tools/gradient-scan-465c.mjs");
    assert.match(scanner, /captureScreenshot/);
    assert.ok(scanner.includes("color:transparent!important"), "all text is made transparent before the background is sampled");
    assert.match(scanner, /getImageData/);
    assert.match(scanner, /elementFromPoint/);
    assert.match(scanner, /#upload/);
  });
});

/**
 * job 467-C: /studio-guide in the dark theme, the summary panels that print `color: var(--paper)`, the product-card labels.
 */
describe("467-C /studio-guide, summary panels, product labels", () => {
  const guide = read("../src/pages/StudioGuidePage.tsx");
  const dark467 = themeStyles.slice(themeStyles.indexOf("job 467-C · dark theme"), themeStyles.indexOf("export type StorefrontThemeValue"));
  const css467 = css.slice(css.indexOf("job 467-C · summary panels"));
  it("/studio-guide has no fixed bg-white surface and no dark: utility (they never fire)", () => {
    const classes = classStrings(guide).join(" ");
    const surfaces = classStrings(guide).filter((c) => c.includes("border-[var(--line)]"));
    assert.ok(surfaces.length >= 4 && surfaces.every((c) => !/(^|\s)bg-white(\s|$)/.test(c)), "bg-white under theme-token text = pale on pale in the dark theme");
    assert.ok(!/(^|\s)dark:/.test(classes));
    assert.ok(!/bg-\[rgba\(255,255,255,0\.92\)\]/.test(classes));
  });
  it("/studio-guide cards, FAQ and gallery use the theme-following .sg-card (light keeps #ffffff, dark uses --card-paper)", () => {
    assert.equal((guide.match(/className="sg-card/g) ?? []).length === 3, true);
    assert.match(guide, /\.sg-card \{ background-color: #ffffff; \}/);
    assert.match(guide, /\[data-theme="dark"\] \.sg-card \{ background-color: var\(--card-paper\); \}/);
    assert.match(guide, /\.sg-header \{ background-color: rgba\(255, 255, 255, 0\.92\); \}/);
  });
  it("/studio-guide edge-legend labels, tip box and check marks keep their light colours and have dark ones", () => {
    for (const [cls, light] of [["ridge", "#8a5a00"], ["wall", "#1268B3"], ["open", "#0f7a52"], ["closed", "#1e40af"], ["joint", "#64748b"]] as const) {
      assert.ok(guide.includes(`.sg-edge-${cls} { color: ${light}; }`), cls);
      assert.ok(guide.includes(`[data-theme="dark"] .sg-edge-${cls}`), cls);
    }
    assert.match(guide, /\.sg-tip \{ background-color: #e5f3fa; color: #1268B3; \}/);
  });
  it("summary panels: dark theme text follows the light paper colour; the strong note too", () => {
    assert.match(dark467, /\[data-theme="dark"\] :is\(\.quote-summary, \.config-summary\) \{ color: #f4f9fd; \}/);
    assert.match(dark467, /\[data-theme="dark"\] \.quote-terms strong \{ color: #f4f9fd; \}/);
    assert.ok(ratio("#f4f9fd", "#0e375e") >= 4.5);
  });
  it("summary panels: pinned colours for the warning, the TOTAL eyebrow, the small grey lines and 'ฟรี' (both themes)", () => {
    assert.match(css467, /\.quote-summary \.summary-warning \{ color: #0b1324; \}/);
    assert.match(css467, /\.quote-summary \.eyebrow \{ color: #cbd5e1; \}/);
    assert.match(css467, /\.quote-summary \.total-rows small, \.config-summary \.summary-row small \{ color: #b8c3bf; \}/);
    assert.match(css467, /\.quote-summary \.total-rows \.free-text \{ color: #7cc7ea; \}/);
    assert.ok(ratio("#0b1324", "#7b8c9f") >= 4.5, "warning on its peach tint over the blue (measured bg rgb(123,140,159))");
    assert.ok(ratio("#cbd5e1", "#124678") >= 4.5);
    assert.ok(ratio("#b8c3bf", "#0f3c66") >= 4.5);
    assert.ok(ratio("#7cc7ea", "#103f6a") >= 4.5);
  });
  it("product-card labels get a dark chip in the dark theme only", () => {
    assert.match(dark467, /\[data-theme="dark"\] \.product-index,\n\[data-theme="dark"\] \.art-note \{ color: #e8eff8; background-color: rgba\(11, 19, 36, 0\.88\)/);
    assert.ok(!/\.art-note[^{]*\{[^}]*rgba\(11, 19, 36/.test(css467), "not in the shared stylesheet");
    assert.ok(ratio("#e8eff8", "#373d4b") >= 4.5, "worst case: the 88% chip over a white pixel");
  });
  it("no colour token value was assigned and the frozen index.css stays free of dark-theme rules", () => {
    assert.ok(!/--(ink|ink-soft|paper|card-paper|line|deep|brand-[a-z]+)\s*:/.test(css467 + dark467 + guide.slice(guide.indexOf("STUDIO_GUIDE_THEME_CSS"))));
    assert.ok(!css.includes('data-theme="dark"'));
  });
  it("the sweep script reads the sitemap, covers both themes and both tools, and exits non-zero on a failing route", () => {
    const sweep = read("../../../qa/tools/sweep-467c.mjs");
    assert.match(sweep, /sitemap\.xml/);
    assert.match(sweep, /\["dark", "light"\]/);
    assert.match(sweep, /contrast-probe\.js/);
    assert.match(sweep, /gradient-scan-465c\.mjs/);
    assert.match(sweep, /process\.exit\(bad\.length \? 1 : 0\)/);
  });
});
