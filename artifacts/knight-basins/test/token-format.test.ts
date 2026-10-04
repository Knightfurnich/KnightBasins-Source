import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatExactTokenCount,
  formatTokenCount,
  formatTokenCountWithExact,
} from "../src/admin/token-format.ts";

describe("AI token count formatting", () => {
  it("shows counts below one million with thousands separators and the Thai unit", () => {
    assert.equal(formatTokenCount(999_999), "999,999 โทเคน");
  });

  it("shows exactly one million as one-decimal million tokens", () => {
    assert.equal(formatTokenCount(1_000_000), "1.0 ล้านโทเคน");
  });

  it("keeps the exact count alongside an abbreviated display", () => {
    assert.equal(formatTokenCountWithExact(392_500_000), "392.5 ล้านโทเคน (392,500,000 โทเคน)");
    assert.equal(formatExactTokenCount(392_500_000), "392,500,000 โทเคน");
  });

  it("rounds million values to one decimal without replacing their exact count", () => {
    assert.equal(formatTokenCount(1_234_567), "1.2 ล้านโทเคน");
    assert.equal(formatTokenCountWithExact(1_234_567), "1.2 ล้านโทเคน (1,234,567 โทเคน)");
  });
});