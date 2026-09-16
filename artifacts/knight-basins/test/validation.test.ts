import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmailAddress } from "../src/data/validation.ts";

test("accepts optional empty email and common international domains", () => {
  assert.equal(isValidEmailAddress(""), true);
  assert.equal(isValidEmailAddress("name@example.com"), true);
  assert.equal(isValidEmailAddress("name@example.co.th"), true);
});

test("rejects email values without a complete domain", () => {
  assert.equal(isValidEmailAddress("abc@xyz"), false);
  assert.equal(isValidEmailAddress("name.com"), false);
  assert.equal(isValidEmailAddress("name @example.com"), false);
});