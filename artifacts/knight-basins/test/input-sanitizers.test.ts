import assert from "node:assert/strict";
import test from "node:test";
import { cleanPhoneInput, isTallBasinSku, normalizeDimensionInput, sanitizePriceInput } from "../src/data/input-sanitizers.ts";

test("normalizes round basin dimensions to the catalogue diameter symbol", () => {
  assert.equal(normalizeDimensionInput("D350x150"), "Ø350x150");
  assert.equal(normalizeDimensionInput("d 420 × 180 mm"), "Ø420 × 180 mm");
});

test("cleans phone input down to at most ten ASCII digits", () => {
  assert.equal(cleanPhoneInput("081-234 5678"), "0812345678");
  assert.equal(cleanPhoneInput("081 234 56789"), "0812345678");
});

test("sanitizes price decorations before numeric parsing", () => {
  assert.equal(sanitizePriceInput("฿1,250"), "1250");
  assert.equal(sanitizePriceInput(" 9,500 "), "9500");
});

test("recognizes the tall basins whose bowl_mm must be null", () => {
  assert.equal(isTallBasinSku("KF029"), true);
  assert.equal(isTallBasinSku("kf030"), true);
  assert.equal(isTallBasinSku("KF001"), false);
});