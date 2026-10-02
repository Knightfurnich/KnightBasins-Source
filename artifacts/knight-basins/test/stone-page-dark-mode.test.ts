/**
 * job-173: /stone page dark-mode contrast fix.
 *
 * STOREFRONT_THEME_STYLES is a plain CSS string injected at runtime via a
 * <style> tag (ThemeToggle.tsx), not index.css -- this is how the project
 * ships dark-mode overrides without touching the frozen stylesheet. Static
 * source inspection on that string is the right way to assert the rules
 * exist, since there's no DOM/CSSOM available in this test runner.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const themeToggleSource = readFileSync(new URL("../src/components/ThemeToggle.tsx", import.meta.url), "utf8");
const STOREFRONT_THEME_STYLES = themeToggleSource.slice(
  themeToggleSource.indexOf("export const STOREFRONT_THEME_STYLES = `"),
  themeToggleSource.indexOf("\n`;", themeToggleSource.indexOf("export const STOREFRONT_THEME_STYLES = `")),
);

describe("STOREFRONT_THEME_STYLES: /stone page dark mode", () => {
  it("gives .storefront-theme-root a dark background", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.storefront-theme-root\s*\{[^}]*background-color:\s*var\(--paper\)/,
    );
  });

  it("colors the hero/page/config-layout text for readability", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*:is\(\.stone-hero,\s*\.stone-page,\s*\.config-layout\)\s*\{[^}]*color:\s*var\(--ink\)/,
    );
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.stone-hero h1\s*\{[^}]*color:\s*#ffffff/,
    );
  });

  it("declares dark-mode styling for the mode-switch buttons", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.mode-switch button\s*\{[^}]*background-color:\s*var\(--card-paper\)[^}]*border-color:\s*var\(--line\)[^}]*color:\s*var\(--ink-soft\)/,
    );
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.mode-switch button\.is-active\s*\{[^}]*border-color:\s*var\(--brand-blue\)[^}]*color:\s*var\(--ink\)/,
    );
  });

  it("declares dark-mode styling for the stone color cards", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.stone-colors button\s*\{[^}]*background-color:\s*var\(--card-paper\)[^}]*border-color:\s*var\(--line\)[^}]*color:\s*var\(--ink\)/,
    );
    assert.match(STOREFRONT_THEME_STYLES, /\[data-theme="dark"\]\s*\.stone-colors button:hover,/);
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\.stone-colors button\.is-active\s*\{[^}]*border-color:\s*var\(--brand-blue\)/,
    );
  });

  it("declares dark-mode styling for the price filter bar", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.stone-price-filters\s*\{[^}]*background-color:\s*var\(--card-paper\)[^}]*border:\s*1px solid var\(--line\)/,
    );
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.stone-price-filters button\.is-active\s*\{[^}]*background-color:\s*var\(--brand-blue\)[^}]*color:\s*#ffffff/,
    );
  });

  it("declares dark-mode styling for the config summary card", () => {
    assert.match(
      STOREFRONT_THEME_STYLES,
      /\[data-theme="dark"\]\s*\.config-summary\s*\{[^}]*background-color:\s*var\(--card-paper\)[^}]*border-color:\s*var\(--line\)[^}]*color:\s*var\(--ink\)/,
    );
  });

  it("never touches the real stone swatch color (.stone-card-image-wrap)", () => {
    assert.ok(!STOREFRONT_THEME_STYLES.includes(".stone-card-image-wrap"));
  });
});
