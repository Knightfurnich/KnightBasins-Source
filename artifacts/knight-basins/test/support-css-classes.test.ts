import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// job-239: the support widget's markup and its stylesheet drifted apart.
// KnightSupport.tsx rendered the speak button with class names that index.css
// never defined, so the button came out unstyled (the CSS was stranded in an
// unmerged branch). This guard fails whenever a `knight-support*` class used in
// a className attribute has no rule in src/index.css.
//
// Only className attributes are inspected: the widget also carries values that
// merely look like class names — data-testid hooks
// (button-knight-support-attach-slip, knight-support-mode-banner,
// input-knight-support-slip-file) and a localStorage key
// ("knight-support-position"). Those must NOT be required in the stylesheet.

const supportSource = readFileSync(
  new URL("../src/components/KnightSupport.tsx", import.meta.url),
  "utf8",
);
const stylesheet = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

/** Class names used in className="..." / className={`...`} attributes. */
function classNamesFromSource(source: string): Set<string> {
  const found = new Set<string>();
  // className="a b"  |  className={`a ${x} b`}
  for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = (match[1] ?? match[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
    for (const token of raw.split(/\s+/)) {
      if (token.startsWith("knight-support")) found.add(token);
    }
  }
  return found;
}

const used = classNamesFromSource(supportSource);

describe("job-239: support widget class names all have stylesheet rules", () => {
  it("finds the widget's class names at all (guards the extractor itself)", () => {
    assert.ok(used.size >= 15, `expected the extractor to find class names, got ${used.size}`);
    assert.ok(used.has("knight-support-panel"));
  });

  it("does not require stylesheet rules for test hooks or storage keys", () => {
    // Regression guard for the extractor: these appear in the component but are
    // not class names, so they must stay out of `used`.
    assert.equal(used.has("knight-support-position"), false, "localStorage key leaked in");
    assert.equal(used.has("knight-support-mode-banner"), false, "data-testid leaked in");
    assert.equal(used.has("knight-support-attach-slip"), false, "data-testid leaked in");
    assert.equal(used.has("knight-support-slip-file"), false, "data-testid leaked in");
  });

  it("every className used by the widget has a rule in index.css", () => {
    const missing = [...used].filter((token) => !stylesheet.includes(token));
    assert.deepEqual(missing, [], `classes used but not styled: ${missing.join(", ")}`);
  });

  it("keeps the speak button and its spinner styled", () => {
    assert.ok(used.has("knight-support-speak-button"), "the speak button lost its class name");
    assert.ok(used.has("knight-support-speak-spin"), "the spinner lost its class name");
    assert.match(stylesheet, /\.knight-support-speak-button\s*\{/);
    assert.match(stylesheet, /\.knight-support-speak-spin\s*\{/);
    assert.match(stylesheet, /@keyframes knight-support-speak-spin/);
  });
});
