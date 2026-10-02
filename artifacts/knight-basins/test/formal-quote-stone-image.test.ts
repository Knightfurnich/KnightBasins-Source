/**
 * Static source inspection for the formal-quotation stone thumbnails (job-191).
 *
 * The quarry rows in the printable quotation only render a photo when the
 * `FormalQuoteItem` carries an `imageUrl`; basins already did, stones did not,
 * so the stone rows printed with an empty photo column. Both stone sources —
 * the 2D Studio estimate and the storefront cart — must attach the pinned
 * quote photo, falling back to the storefront photo.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(here, "..", "src", "App.tsx"), "utf8");

describe("formal quotation stone image source", () => {
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

  it("attaches the quote photo (falling back to the storefront photo) on studio stone rows", () => {
    assert.match(
      appSource,
      /imageUrl:\s*activeStone\.quoteImageUrl\s*\?\?\s*activeStone\.imageUrl/,
      "the studio stone formal item must carry imageUrl from quoteImageUrl ?? imageUrl",
    );
  });

  it("attaches the quote photo (falling back to the storefront photo) on cart stone rows", () => {
    assert.match(
      appSource,
      /imageUrl:\s*selectedStone\.quoteImageUrl\s*\?\?\s*selectedStone\.imageUrl/,
      "the storefront stone formal item must carry imageUrl from quoteImageUrl ?? imageUrl",
    );
  });

  it("keeps rendering the photo through the existing formal item component", () => {
    assert.match(
      appSource,
      /item\.imageUrl\s*&&\s*<img className="formal-item-image"/,
      "FormalItemDescription must keep rendering the photo for rows that carry one",
    );
  });

  it("leaves the quotation prices untouched", () => {
    assert.match(appSource, /unitPrice:\s*currentStoneUnitPrice/, "stone unit price stays as calculated");
    assert.match(appSource, /total:\s*stoneTotal\(stone,\s*stoneColors\)/, "stone totals stay as calculated");
  });
});
