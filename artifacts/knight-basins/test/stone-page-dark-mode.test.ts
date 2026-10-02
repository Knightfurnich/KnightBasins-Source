import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const themeToggleSource = readFileSync(
  new URL("../src/components/ThemeToggle.tsx", import.meta.url),
  "utf8",
);

describe("StonePage Dark Mode Contrast (static source inspection)", () => {
  it("declares dark background for storefront-theme-root", () => {
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.storefront-theme-root\s*\{[^}]*background-color:\s*var\(--paper\)/s);
  });

  it("declares ink colors for stone hero and page elements", () => {
    assert.match(themeToggleSource, /\[data-theme="dark"\] :is\(\.stone-hero, \.stone-page, \.config-layout\)\s*\{[^}]*color:\s*var\(--ink\)/s);
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.stone-hero h1\s*\{[^}]*color:\s*#ffffff/s);
  });

  it("declares card-paper background and ink text for stone colors button", () => {
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.stone-colors button\s*\{[^}]*background:\s*var\(--card-paper\)/s);
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.stone-colors button\s*\{[^}]*color:\s*var\(--ink\)/s);
  });

  it("declares dark mode styles for mode-switch, filters and summary", () => {
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.mode-switch button\s*\{[^}]*background:\s*var\(--card-paper\)/s);
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.stone-price-filters\s*\{[^}]*background:\s*var\(--card-paper\)/s);
    assert.match(themeToggleSource, /\[data-theme="dark"\] \.config-summary\s*\{[^}]*background:\s*var\(--card-paper\)/s);
  });
});
