import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stylesheet = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const heroBackgroundRule = stylesheet.match(
  /\.catalog-hero::before\s*,\s*\.stone-hero::before\s*,\s*\.quote-heading::before\s*\{([^}]*)\}/,
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
