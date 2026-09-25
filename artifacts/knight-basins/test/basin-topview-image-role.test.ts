import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextTopViewImageUrl } from "../src/admin/basinImageRoles.ts";

describe("nextTopViewImageUrl", () => {
  it("pins the clicked image when nothing is currently pinned", () => {
    assert.equal(nextTopViewImageUrl(null, "gallery-1.png"), "gallery-1.png");
  });

  it("pins the clicked image when it differs from the currently-pinned one", () => {
    assert.equal(nextTopViewImageUrl("gallery-1.png", "gallery-2.png"), "gallery-2.png");
  });

  it("unpins (clears back to null) when clicking the already-pinned image again", () => {
    assert.equal(nextTopViewImageUrl("gallery-1.png", "gallery-1.png"), null);
  });

  it("treats undefined the same as null (nothing pinned yet)", () => {
    assert.equal(nextTopViewImageUrl(undefined, "primary.png"), "primary.png");
  });

  it("has no implicit fallback to a primary image, unlike the quote-image role", () => {
    // nextQuoteImageUrl falls back to the primary image when nothing is
    // explicitly pinned; Top View has no such fallback, so clicking the
    // *first* image is always a plain pin, never a no-op/clear.
    assert.equal(nextTopViewImageUrl(null, "primary.png"), "primary.png");
  });
});
