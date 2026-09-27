import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type StoredValue = {
  theme: "light" | "dark";
  darkAfterToggle: "light" | "dark";
  lightAfterToggle: "light" | "dark";
  renderedHtml: string;
};

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const themeModulePath = join(knightBasinsRoot, "src/components/ThemeToggle.tsx");
const themeModuleUrl = pathToFileURL(themeModulePath).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const themeSource = readFileSync(themeModulePath, "utf8");
const appSource = readFileSync(join(knightBasinsRoot, "src/App.tsx"), "utf8");
const globalStylesSource = readFileSync(join(knightBasinsRoot, "src/index.css"), "utf8");

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mod = await import(${JSON.stringify(themeModuleUrl)});
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
const storage = new MemoryStorage();
const initialTheme = mod.readStorefrontTheme(storage);
const darkTheme = mod.nextStorefrontTheme(initialTheme);
mod.writeStorefrontTheme(darkTheme, storage);
const darkAfterToggle = mod.readStorefrontTheme(storage);
const lightTheme = mod.nextStorefrontTheme(darkAfterToggle);
mod.writeStorefrontTheme(lightTheme, storage);
const lightAfterToggle = mod.readStorefrontTheme(storage);
const renderedHtml = renderToStaticMarkup(
  createElement(
    mod.StorefrontThemeProvider,
    { value: { theme: "light", toggleTheme: () => {} } },
    createElement(mod.ThemeToggle),
  ),
);
process.stdout.write(JSON.stringify({ initialTheme, darkAfterToggle, lightAfterToggle, renderedHtml }));
`;

let harnessResult: StoredValue;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected the workspace tsx loader at ${tsxLoaderPath}`);
  }
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".storefront-theme-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");
  const output = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harnessResult = JSON.parse(output) as StoredValue;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("storefront theme toggle", () => {
  it("renders the accessible theme toggle in the shared header actions", () => {
    assert.match(appSource, /<div className="header-actions">[\s\S]*?<ThemeToggle \/>[\s\S]*?<LineLoginButton compact \/>/);
    assert.match(harnessResult.renderedHtml, /data-testid="button-storefront-theme-toggle"/);
    assert.match(harnessResult.renderedHtml, /aria-label="สลับเป็นโหมดมืด"/);
    assert.match(harnessResult.renderedHtml, /title="สลับเป็นโหมดมืด"/);
    assert.match(harnessResult.renderedHtml, /data-theme="light"/);
    assert.match(themeSource, /min-width:\s*40px/);
    assert.match(themeSource, /min-height:\s*40px/);
  });

  it("defaults to light and persists both theme transitions", () => {
    assert.equal(harnessResult.initialTheme, "light");
    assert.equal(harnessResult.darkAfterToggle, "dark");
    assert.equal(harnessResult.lightAfterToggle, "light");
    assert.match(themeSource, /STOREFRONT_THEME_STORAGE_KEY = "knight-storefront-theme"/);
    assert.match(themeSource, /setItem\(STOREFRONT_THEME_STORAGE_KEY, theme\)/);
    assert.match(themeSource, /getItem\(STOREFRONT_THEME_STORAGE_KEY\) === "dark" \? "dark" : "light"/);
    assert.match(themeSource, /writeStorefrontTheme\(nextTheme\)/);
  });

  it("applies the selected theme to the main app container and keeps admin separate", () => {
    assert.match(appSource, /data-theme=\{isAdminRoute \? "light" : themeValue\.theme\}/);
    assert.match(appSource, /const isAdminRoute = location === "\/admin" \|\| location\.startsWith\("\/admin\/"\)/);
  });

  it("scopes dark colors and keeps the Studio canvas and stone samples neutral", () => {
    const styleBlock = themeSource.match(/export const STOREFRONT_THEME_STYLES = `([\s\S]*?)`;/)?.[1];
    assert.ok(styleBlock, "The storefront theme style block should exist");
    assert.match(styleBlock, /\[data-theme="dark"\]\s*\{/);
    assert.match(styleBlock, /\[data-theme="dark"\] \.studio-canvas\s*\{[^}]*background-color:\s*#f8fcfe/s);
    assert.match(styleBlock, /--brand-blue:\s*#1268b3/);
    assert.doesNotMatch(styleBlock, /\.studio-stone-swatch|\.stone-chip|\.material-swatch/);
    assert.match(styleBlock, /@media print[\s\S]*?\.formal-quote-sheet[\s\S]*?background-color:\s*#ffffff !important;[\s\S]*?color:\s*#111111 !important;/);
  });

  it("keeps storefront theme styles out of the frozen global stylesheet", () => {
    assert.doesNotMatch(globalStylesSource, /knight-storefront-theme|storefront-theme-root|data-theme="dark"/);
    assert.match(appSource, /<StorefrontThemeProvider value=\{themeValue\}>/);
  });
});