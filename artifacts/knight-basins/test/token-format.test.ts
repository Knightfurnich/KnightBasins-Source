import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatExactTokenCount,
  formatTokenCount,
  formatTokenCountWithExact,
} from "../src/admin/token-format.ts";

describe("AI token count formatting", () => {
  it("formats 392,545,335 as one-decimal million tokens and preserves the exact count", () => {
    assert.equal(formatTokenCount(392_545_335), "392.5 ล้านโทเคน");
    assert.equal(formatExactTokenCount(392_545_335), "392,545,335 โทเคน");
    assert.equal(formatTokenCountWithExact(392_545_335), "392.5 ล้านโทเคน (392,545,335 โทเคน)");
  });

  it("formats 999,999 as a comma-separated exact token count", () => {
    assert.equal(formatTokenCount(999_999), "999,999 โทเคน");
    assert.equal(formatExactTokenCount(999_999), "999,999 โทเคน");
    assert.equal(formatTokenCountWithExact(999_999), "999,999 โทเคน");
  });

  it("formats 1,000,000 as 1.0 million tokens and preserves the exact count", () => {
    assert.equal(formatTokenCount(1_000_000), "1.0 ล้านโทเคน");
    assert.equal(formatExactTokenCount(1_000_000), "1,000,000 โทเคน");
    assert.equal(formatTokenCountWithExact(1_000_000), "1.0 ล้านโทเคน (1,000,000 โทเคน)");
  });

  it("formats zero as 0 โทเคน", () => {
    assert.equal(formatTokenCount(0), "0 โทเคน");
    assert.equal(formatExactTokenCount(0), "0 โทเคน");
    assert.equal(formatTokenCountWithExact(0), "0 โทเคน");
  });
});