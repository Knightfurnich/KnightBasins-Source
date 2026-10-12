import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 460-C (transferred from 452-F) - /portfolio category strip and tap targets.
 *
 * Measured on main 034858d (step 0, live data, 13 chips): the strip is 2464 px wide inside 328-358 px
 * (360/390), 705 px (768) and 1232 px (1440); 11 / 11 / 9 / 7 chips run past the right edge with no
 * cue at all, the third chip is cut mid-letter, and the chips are 35.1 px high. `src/index.css` is
 * frozen, so everything below is read from `PortfolioPage.tsx` (the strip + search part only).
 *
 * RED first: these tests describe the finished behaviour and fail on main until step 1 lands.
 */

const page = readFileSync(new URL("../src/pages/PortfolioPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

/** The strip + search block: from the search bar to the photo grid. Header and grid are not ours. */
const start = page.indexOf('className="portfolio-search-bar"');
const end = page.indexOf("{/* Grid */}");
const block = start >= 0 && end > start ? page.slice(start, end) : "";

const stripOpen = block.indexOf('data-testid="portfolio-category-tabs"');
/** Chip buttons: the "all" chip and the mapped ones. */
const chipClassNames = [...block.matchAll(/className=\{`([^`]*shrink-0[^`]*)`\}/g)].map((m) => m[1]);

describe("460-C · the block under test exists", () => {
  it("finds the search bar, the strip and the grid marker", () => {
    assert.ok(start >= 0 && end > start, "search bar .. {/* Grid */} not found");
    assert.ok(stripOpen >= 0, "portfolio-category-tabs not found");
    assert.equal(chipClassNames.length, 2, "expected the 'all' chip and the mapped chip className");
  });
});

describe("460-C · A · scroll cue, never hidden overflow", () => {
  it("does not hide the overflow (no overflow-x:hidden on the strip block)", () => {
    assert.doesNotMatch(block, /overflow-x-hidden|overflow-hidden|overflowX:\s*["']hidden["']/);
  });

  it("the strip still scrolls (overflow-x-auto) so every chip stays reachable", () => {
    assert.match(block.slice(Math.max(0, stripOpen - 200), stripOpen + 60), /overflow-x-auto/);
  });

  it("an end cue and a start cue exist, decorative and not blocking taps", () => {
    for (const side of ["start", "end"]) {
      const m = block.match(new RegExp(`<[^>]*data-testid="portfolio-category-cue-${side}"[^>]*>`));
      assert.ok(m, `cue ${side} missing`);
      assert.match(m[0], /aria-hidden="true"/, `cue ${side} must be aria-hidden`);
      assert.match(m[0], /pointer-events-none/, `cue ${side} must not take taps`);
    }
  });

  it("the cues follow the scroll position (shown only while there is more to scroll)", () => {
    assert.match(block, /onScroll=\{/, "the strip must report its scroll position");
    assert.match(page, /scrollLeft/, "cue state must come from scrollLeft");
    assert.match(page, /scrollWidth/, "cue state must compare against scrollWidth");
    assert.match(page, /addEventListener\("resize"/, "cue state must be re-read when the width changes");
  });

  it("the cue is the same at every width (no breakpoint hides it)", () => {
    for (const side of ["start", "end"]) {
      const m = block.match(new RegExp(`<[^>]*data-testid="portfolio-category-cue-${side}"[^>]*>`));
      const withoutAria = m ? m[0].replace(/aria-hidden="true"/, "") : "";
      assert.ok(m && !/\b(sm|md|lg|xl):(hidden|opacity-0)|\bhidden\b/.test(withoutAria), `cue ${side} must not be hidden by a breakpoint`);
    }
  });
});

describe("460-C · B · tap targets of 44 px in the strip and the search bar", () => {
  const has44 = (text: string) => /min-h-11|min-h-\[44px\]|\bh-11\b|\bh-\[44px\]|minHeight:\s*44|height:\s*44/.test(text);
  const has44w = (text: string) => /min-w-11|min-w-\[44px\]|\bw-11\b|\bw-\[44px\]|minWidth:\s*44|width:\s*44/.test(text);

  it("every category chip is at least 44 px high", () => {
    for (const cls of chipClassNames) assert.ok(has44(cls), `chip className lacks a 44 px height: ${cls}`);
  });

  it("keeps the chips' wording and order (all chip first, then categories in the API order)", () => {
    assert.match(block, /ทั้งหมด \{firstPage \? `\(\$\{firstPage\.total\}\)` : ""\}/);
    assert.match(block, /categories\.map\(\(c\) =>/);
    assert.match(block, /\{c\.icon\} \{c\.name\} <span className="opacity-70">\(\{c\.count\}\)<\/span>/);
  });

  it("the search input is at least 44 px high", () => {
    const m = block.match(/<input[\s\S]*?data-testid="input-portfolio-search"[\s\S]*?\/>/);
    assert.ok(m, "search input not found");
    assert.ok(has44(m[0]), "search input must declare a 44 px height");
  });

  it("the clear button is at least 44 x 44 (hit area), with a single portfolio-search-clear class", () => {
    const m = block.match(/<button[^>]*data-testid="button-clear-portfolio-search"[\s\S]*?<\/button>/) ?? block.match(/<button[\s\S]*?portfolio-search-clear[\s\S]*?<\/button>/);
    assert.ok(m, "clear button not found");
    assert.ok(has44(m[0]) && has44w(m[0]), `clear button must declare 44 x 44: ${m[0].slice(0, 200)}`);
  });
});

describe("460-C · B2 · the load-more button (43.1 px on main)", () => {
  it("is at least 44 px high", () => {
    const open = page.lastIndexOf("<button", page.indexOf('data-testid="button-portfolio-load-more"'));
    const tag = page.slice(open, page.indexOf(">", page.indexOf('data-testid="button-portfolio-load-more"')) + 1);
    assert.ok(tag.includes("button-portfolio-load-more"), "load-more button not found");
    assert.match(tag, /min-h-11|min-h-\[44px\]|\bh-11\b|\bh-\[44px\]|minHeight:\s*44/, `load-more must declare 44 px: ${tag.slice(0, 200)}`);
  });
});

describe("460-C · D · the clear button className is not duplicated (guard - true on main already)", () => {
  it("portfolio-search-clear appears once as a class token in the page", () => {
    const tokens = [...page.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
      .map((m) => (m[1] ?? m[2]).split(/\s+/))
      .flat()
      .filter((t) => t === "portfolio-search-clear");
    assert.equal(tokens.length, 1);
  });

  it("no className holds the same token twice on the clear button", () => {
    const m = page.match(/<button[\s\S]*?data-testid="button-clear-portfolio-search"/);
    assert.ok(m);
    const cls = m[0].match(/className="([^"]*)"/);
    assert.ok(cls);
    const tokens = cls[1].split(/\s+/).filter(Boolean);
    assert.equal(new Set(tokens).size, tokens.length, `duplicate class token in: ${cls[1]}`);
  });
});

describe("460-C · scope guard", () => {
  it("this job does not edit the frozen stylesheet", () => {
    assert.doesNotMatch(css, /460-C/, "src/index.css must stay untouched by this job");
  });
});
