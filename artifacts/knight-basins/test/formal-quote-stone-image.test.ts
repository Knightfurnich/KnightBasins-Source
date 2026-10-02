import assert from "node:assert/strict";
import * as fs from "node:fs";
import { describe, it } from "node:test";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

describe("Formal quote stone images", () => {
  it("adds the quote image fallback to the 2D Studio stone item", () => {
    assert.match(
      appSource,
      /formalItems\.push\(\{\s*code:\s*activeStone\.code,[\s\S]*?imageUrl:\s*activeStone\.quoteImageUrl\s*\?\?\s*activeStone\.imageUrl,/,
    );
  });

  it("adds the quote image fallback to the storefront stone item", () => {
    assert.match(
      appSource,
      /formalItems\.push\(\{\s*code:\s*selectedStone\.code,[\s\S]*?imageUrl:\s*selectedStone\.quoteImageUrl\s*\?\?\s*selectedStone\.imageUrl,/,
    );
  });
});