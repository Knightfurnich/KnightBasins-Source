import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextQuoteImageUrl } from "../src/admin/basinImageRoles.ts";

describe("nextQuoteImageUrl", () => {
  it("pins the clicked image when nothing is currently pinned and it isn't the primary", () => {
    assert.equal(nextQuoteImageUrl(null, "primary.png", "gallery-1.png"), "gallery-1.png");
  });

  it("clears the pin when clicking the primary image while nothing is explicitly pinned", () => {
    assert.equal(nextQuoteImageUrl(null, "primary.png", "primary.png"), null);
  });

  it("clears an explicit pin when clicking the same image again", () => {
    assert.equal(nextQuoteImageUrl("gallery-1.png", "primary.png", "gallery-1.png"), null);
  });

  it("switches the pin to a different image without resetting to auto", () => {
    assert.equal(nextQuoteImageUrl("gallery-1.png", "primary.png", "gallery-2.png"), "gallery-2.png");
  });
});
