import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const quickFaqSource = readFileSync(new URL("../src/components/QuickFAQ.tsx", import.meta.url), "utf8");

describe("QuickFAQ DOM accessibility", () => {
  it("imports the shared FAQ data source", () => {
    assert.match(
      quickFaqSource,
      /import\s+\{\s*KNIGHT_FAQ_ITEMS\s*\}\s+from\s+["']@\/data\/faq-data["']/,
    );
    assert.match(quickFaqSource, /KNIGHT_FAQ_ITEMS\.map\(\(item, index\) =>/);
  });

  it("keeps each answer paragraph in the rendered DOM while collapsed", () => {
    assert.match(quickFaqSource, /<p className="quick-faq-answer"/);
    assert.doesNotMatch(quickFaqSource, /\{\s*isOpen\s*&&/);
    assert.match(quickFaqSource, /<p className="quick-faq-answer"[^>]*hidden=\{!isOpen\}/);
  });

  it("assigns question and answer test IDs for every mapped FAQ item", () => {
    assert.match(quickFaqSource, /KNIGHT_FAQ_ITEMS\.map\(\(item, index\) => \{/);
    assert.match(quickFaqSource, /data-testid=\{`faq-question-\$\{index\}`\}/);
    assert.match(quickFaqSource, /data-testid=\{`faq-answer-\$\{index\}`\}/);
  });
});