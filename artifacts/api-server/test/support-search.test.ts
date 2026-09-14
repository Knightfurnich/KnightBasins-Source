import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportQueryMatches } from "../src/lib/support-search.ts";

describe("KnightSupport catalog search", () => {
  it("matches a SKU when the customer adds a request such as price", () => {
    assert.equal(supportQueryMatches("KF020", "kf020 ราคา"), true);
    assert.equal(supportQueryMatches("KF020", "ขอราคา kf020"), true);
  });

  it("matches product names and rejects unrelated catalog items", () => {
    assert.equal(supportQueryMatches("Neo White", "ขอข้อมูล neo white"), true);
    assert.equal(supportQueryMatches("KF020", "kf021 ราคา"), false);
  });
});