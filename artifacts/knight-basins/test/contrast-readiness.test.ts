import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const theme = readFileSync(new URL("../src/components/ThemeToggle.tsx", import.meta.url), "utf8");
const scanner = readFileSync(new URL("../../../qa/tools/gradient-scan-465c.mjs", import.meta.url), "utf8");

describe("470-R contrast readiness and real error states", () => {
  it("pins only the gallery error foreground, never hides its real message", () => {
    const block = theme.split("/* 470-R:")[1].split("/* Stone swatches")[0];
    assert.match(block, /color: #ffb4ab !important/);
    assert.doesNotMatch(block, /display:|visibility:|opacity:|font-size:|padding:|margin:/);
  });
  it("pins both price-label foreground and backing in both themes", () => {
    assert.match(theme, /\[data-theme="light"\] small\.stone-card-prices,\s*\[data-theme="dark"\] small\.stone-card-prices \{\s*color: #173f6b !important;\s*background-color: #f4f9fd !important;\s*\}/);
  });
  it("requires successful consumed API data and two stable observations, not a longer sleep", () => {
    assert.match(scanner, /stable >= 2/);
    assert.match(scanner, /products === catalog\?\.basins/);
    assert.match(scanner, /matchingStoneSet/);
    assert.match(scanner, /gallery === state\?\.data/);
    assert.match(scanner, /state\.pending === 0/);
    assert.match(scanner, /หน้าโหลดไม่จบ/);
    assert.match(scanner, /process\.exit\(2\)/);
    const navigation = scanner.slice(scanner.indexOf("const all = []"));
    assert.doesNotMatch(navigation, /await sleep\(2500\)|await sleep\(3500\)/);
  });
});
