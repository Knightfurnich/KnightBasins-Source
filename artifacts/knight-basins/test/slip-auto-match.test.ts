import assert from "node:assert/strict";
import test from "node:test";
import { extractJobCodesAndQuotes } from "../src/data/slip-matching.ts";

test("extracts a job code prefixed with 'รัน'", () => {
  const result = extractJobCodesAndQuotes("รัน 26/1008 ขอเข้ารับสินค้าวันที่ 16/09/69");
  assert.deepEqual(result.jobCodes, ["26/1008"]);
});

test("extracts a job code prefixed with 'Pay In + PO'", () => {
  const result = extractJobCodesAndQuotes("Pay In + PO 26/0956 งวด 2-3");
  assert.deepEqual(result.jobCodes, ["26/0956"]);
});

test("extracts a quote number", () => {
  const result = extractJobCodesAndQuotes("Sep 26 OF 1158 (R1)(บริษัท สเปคไลท์ จำกัด)");
  assert.ok(result.quoteNumbers.includes("Sep 26 OF 1158"));
});

test("flags internal expenses as internal and skips job/quote extraction", () => {
  const result = extractJobCodesAndQuotes("เติมเงิน Easypass 500 บาท");
  assert.equal(result.isInternal, true);
});

test("returns empty arrays and isInternal false for empty or nullish text", () => {
  assert.deepEqual(extractJobCodesAndQuotes(""), { jobCodes: [], quoteNumbers: [], isInternal: false });
  assert.deepEqual(extractJobCodesAndQuotes(null), { jobCodes: [], quoteNumbers: [], isInternal: false });
  assert.deepEqual(extractJobCodesAndQuotes(undefined), { jobCodes: [], quoteNumbers: [], isInternal: false });
});

test("extracts multiple distinct job codes from one message without duplicates", () => {
  const result = extractJobCodesAndQuotes("รัน 26/1008 และ 26/1009 ทั้งสองงาน รัน 26/1008 ซ้ำ");
  assert.deepEqual(result.jobCodes, ["26/1008", "26/1009"]);
});

test("extracts a job code prefixed with lowercase 'pay in'", () => {
  const result = extractJobCodesAndQuotes("pay in 26/0123");
  assert.deepEqual(result.jobCodes, ["26/0123"]);
});

test("extracts a US-format quote number", () => {
  const result = extractJobCodesAndQuotes("Sep 26 US 0762");
  assert.ok(result.quoteNumbers.includes("Sep 26 US 0762"));
});
