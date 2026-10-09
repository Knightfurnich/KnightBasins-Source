import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stylesheet = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const heroBackgroundRule = stylesheet.match(
  /\.catalog-hero::before\s*,\s*\.stone-hero::before\s*,\s*\.quote-heading::before\s*\{([^}]*)\}/,
);
const stylesheetWithoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
const stoneMobileStyles = Array.from(
  stylesheetWithoutComments.matchAll(/@media\s+(?:screen\s+and\s+)?\(\s*max-width:\s*720px\s*\)\s*\{/g),
).map((match) => {
  const blockStart = (match.index ?? 0) + match[0].length;
  let depth = 1;
  for (let index = blockStart; index < stylesheetWithoutComments.length; index += 1) {
    if (stylesheetWithoutComments[index] === "{") depth += 1;
    if (stylesheetWithoutComments[index] === "}") depth -= 1;
    if (depth === 0) return stylesheetWithoutComments.slice(blockStart, index);
  }
  return "";
}).find((block) =>
  block.includes(".stone-colors") &&
  block.includes(".stone-search-row") &&
  block.includes("repeat(3, minmax(0, 1fr)"),
);

function declarationsFrom(ruleBody: string) {
  return new Map(
    ruleBody
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [
          declaration.slice(0, separator).trim(),
          declaration.slice(separator + 1).trim(),
        ];
      }),
  );
}

test("hero gradient stays within the page-wrap and keeps its original scale", () => {
  assert.ok(heroBackgroundRule, "all three hero backgrounds must share a CSS rule");

  const declarations = declarationsFrom(heroBackgroundRule[1]);
  assert.equal(
    declarations.get("inset"),
    "0 calc(0px - clamp(18px, 5vw, 76px))",
    "extend the pseudo-element only to the padded page-wrap edge",
  );
  assert.equal(
    declarations.get("background-size"),
    "calc(100% + 40vw - clamp(18px, 5vw, 76px) - clamp(18px, 5vw, 76px)) 100%",
    "keep the original gradient width when the pseudo-element is extended to the page edge",
  );
  assert.equal(
    declarations.get("background-position"),
    "center",
    "center the scaled gradient to preserve its original alignment",
  );
  assert.match(
    declarations.get("background") ?? "",
    /linear-gradient\(115deg,\s*rgba\(228,244,252,\.88\),\s*rgba\(244,249,253,0\)\s*58%\)/,
    "keep the existing hero gradient colors and direction",
  );
});

test("mobile stone layout wraps its summary and constrains card grid tracks", () => {
  assert.ok(stoneMobileStyles, "the mobile storefront styles must contain the stone grid");
  assert.match(
    stoneMobileStyles,
    /\.stone-colors\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
    "let the three stone-card columns shrink within the config main width",
  );
  assert.match(
    stoneMobileStyles,
    /\.stone-search-row\s*\{[^}]*flex-direction:\s*column/,
    "stack the search control and selection summary on mobile",
  );
  assert.match(
    stoneMobileStyles,
    /\.stone-search-row\s*>\s*span\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/,
    "allow the selected-stone summary to wrap instead of widening the page",
  );
});

test("mobile sheet quantity editor fits its stone container without clipping the root", () => {
  assert.ok(stoneMobileStyles);
  const editor = stoneMobileStyles.match(
    /\.config-main:has\(\.stone-price-filters\)\s*>\s*\.quantity-editor\.large\s*\{([^}]*)\}/,
  );
  assert.ok(editor, "the stone-only mobile quantity editor must override max-content width");
  const declarations = declarationsFrom(editor[1]);
  assert.equal(declarations.get("width"), "100%");
  assert.equal(declarations.get("min-width"), "0");
  const label = stoneMobileStyles.match(
    /\.config-main:has\(\.stone-price-filters\)\s*>\s*\.quantity-editor\.large\s*>\s*span\s*\{([^}]*)\}/,
  );
  assert.ok(label, "the quantity label must shrink and wrap within the editor");
  const labelDeclarations = declarationsFrom(label[1]);
  assert.equal(labelDeclarations.get("min-width"), "0");
  assert.equal(labelDeclarations.get("white-space"), "normal");
  assert.equal(labelDeclarations.get("overflow-wrap"), "anywhere");
});

test("readme company badge wraps inside a shrinkable heading without changing its text", () => {
  const guide = readFileSync(new URL("../src/components/SalesGuide.tsx", import.meta.url), "utf8");
  assert.match(guide, /<div className="max-\[720px\]:min-w-0">\s*<Badge/);
  assert.match(guide, /<Badge[^>]*max-\[720px\]:max-w-full[^>]*max-\[720px\]:whitespace-normal/);
  assert.ok(guide.includes("บริษัท ไนท์ เฟอร์นิช จำกัด (KNIGHT FURNICH Co., Ltd.)"));
});
