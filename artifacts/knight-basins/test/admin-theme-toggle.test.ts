import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const adminThemeSource = readFileSync(
  path.join(testDirectory, "../src/admin/admin-theme.tsx"),
  "utf8",
);
const adminAppSource = readFileSync(
  path.join(testDirectory, "../src/admin/AdminApp.tsx"),
  "utf8",
);
const globalStylesSource = readFileSync(
  path.join(testDirectory, "../src/index.css"),
  "utf8",
);

describe("admin theme toggle", () => {
  it("renders an accessible, touch-sized theme toggle in the admin header", () => {
    assert.match(adminThemeSource, /data-testid="button-admin-theme-toggle"/);
    assert.match(adminThemeSource, /aria-label=\{actionLabel\}/);
    assert.match(adminThemeSource, /title=\{actionLabel\}/);
    assert.match(adminThemeSource, /className="[^"]*min-h-10[^"]*"/);
    assert.match(adminAppSource, /<AdminThemeToggle theme=\{theme\} onToggle=\{toggleTheme\} \/>/);
  });

  it("uses the requested storage key and defaults safely to light", () => {
    assert.match(adminThemeSource, /const ADMIN_THEME_STORAGE_KEY = "knight-admin-theme"/);
    assert.match(adminThemeSource, /useState<AdminTheme>\(readStoredAdminTheme\)/);
    assert.match(adminThemeSource, /getItem\(ADMIN_THEME_STORAGE_KEY\) === "dark" \? "dark" : "light"/);
    assert.match(adminThemeSource, /if \(typeof window === "undefined"\) return "light"/);
  });

  it("toggles light and dark and persists the next selection", () => {
    assert.match(adminThemeSource, /const nextTheme = theme === "light" \? "dark" : "light"/);
    assert.match(adminThemeSource, /writeStoredAdminTheme\(nextTheme\)/);
    assert.match(adminThemeSource, /setItem\(ADMIN_THEME_STORAGE_KEY, theme\)/);
    assert.match(adminThemeSource, /aria-pressed=\{isDark\}/);
  });

  it("applies the selected theme to the admin app container", () => {
    assert.match(adminAppSource, /data-admin-theme=\{theme\}/);
    assert.match(adminAppSource, /const \{ theme, toggleTheme \} = useAdminTheme\(\)/);
  });

  it("scopes dark colors to the admin app and covers common admin controls", () => {
    const styleBlock = adminThemeSource.match(/const ADMIN_THEME_STYLES = `([\s\S]*?)`;/)?.[1];
    assert.ok(styleBlock, "The admin theme style block should exist");
    const selectors = [...styleBlock.matchAll(/([^{}]+)\{/g)]
      .map((match) => match[1].trim())
      .filter((selector) => !selector.startsWith("@"));
    assert.ok(selectors.length > 0, "The scoped style block should contain CSS rules");
    for (const selectorBlock of selectors) {
      const individualSelectors: string[] = [];
      let currentSelector = "";
      let nestingDepth = 0;
      for (const character of selectorBlock) {
        if (character === "(") nestingDepth += 1;
        if (character === ")") nestingDepth -= 1;
        if (character === "," && nestingDepth === 0) {
          individualSelectors.push(currentSelector);
          currentSelector = "";
        } else {
          currentSelector += character;
        }
      }
      individualSelectors.push(currentSelector);
      for (const selector of individualSelectors) {
        assert.ok(
          selector.trim().startsWith('.admin-app[data-admin-theme="dark"]'),
          `Theme selector escaped the admin app: ${selector.trim()}`,
        );
      }
    }
    assert.match(styleBlock, /--paper:\s*#0d1726/);
    assert.match(styleBlock, /:is\(input, textarea, select\)/);
    assert.match(styleBlock, /:is\(table, th, td\)/);
  });

  it("keeps theme rules out of the frozen global stylesheet", () => {
    assert.doesNotMatch(globalStylesSource, /knight-admin-theme|data-admin-theme/);
    assert.doesNotMatch(adminAppSource, /<style|\.admin-app\[data-admin-theme/);
  });
});