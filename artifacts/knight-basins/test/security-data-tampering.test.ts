import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeIntegerRange, sanitizeTextInput } from "../src/data/input-sanitizers.ts";

const studioSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

test("sanitizes customer HTML and executable text while preserving Thai text", () => {
  assert.equal(sanitizeTextInput("บริษัท <b>ครัวไทย</b>"), "บริษัท ครัวไทย");
  assert.equal(sanitizeTextInput("ลูกค้า <script>alert(1)</script> ทดลอง"), "ลูกค้า  ทดลอง");
  assert.equal(sanitizeTextInput('<img src=x onerror=alert(1)>'), "");
  assert.equal(sanitizeTextInput("&lt;svg/onload=alert(1)&gt;"), "");
  assert.equal(sanitizeTextInput("java&#x73;cript&colon;alert(1)"), "alert(1)");
  assert.equal(sanitizeTextInput("ข้อความ onerror=alert(1)"), "ข้อความ ");
  assert.equal(sanitizeTextInput("https://example.com/งานครัว"), "https://example.com/งานครัว");
  assert.equal(sanitizeTextInput(123), "");
});

test("accepts only safe integer dimensions inside inclusive bounds", () => {
  assert.equal(sanitizeIntegerRange(100, 100, 10_000), 100);
  assert.equal(sanitizeIntegerRange(600, 100, 10_000), 600);
  assert.equal(sanitizeIntegerRange(1_800, 100, 10_000), 1_800);
  assert.equal(sanitizeIntegerRange(10_000, 100, 10_000), 10_000);
  assert.equal(sanitizeIntegerRange(0, 0, 1_000_000_000), 0);
  assert.equal(sanitizeIntegerRange(1_000_000_000, 0, 1_000_000_000), 1_000_000_000);
  assert.equal(sanitizeIntegerRange(1_000_000_001, 0, 1_000_000_000), null);
  assert.equal(sanitizeIntegerRange(99, 100, 10_000), null);
  assert.equal(sanitizeIntegerRange(10_001, 100, 10_000), null);
  assert.equal(sanitizeIntegerRange(1_800.5, 100, 10_000), null);
  assert.equal(sanitizeIntegerRange(Number.NaN, 0, 10_000), null);
  assert.equal(sanitizeIntegerRange(Number.POSITIVE_INFINITY, 0, 10_000), null);
  assert.equal(sanitizeIntegerRange("1,800", 100, 10_000), null);
  assert.equal(sanitizeIntegerRange(1, 10, 0), null);
  assert.equal(sanitizeIntegerRange(1, 0, Number.MAX_SAFE_INTEGER + 1), null);
});

test("Studio and Sketch send sanitized customer text and recalculated bounded estimates", () => {
  assert.match(studioSource, /function prepareStudioSubmissionPayload/);
  assert.match(studioSource, /studioEstimate\(safeState, basinProducts\)/);
  assert.match(studioSource, /sanitizeStudioSubmissionRate/);
  assert.match(studioSource, /MAX_STUDIO_SUBMISSION_DIMENSION_MM/);
  assert.match(studioSource, /safeState\.discountTHB/);
  assert.match(studioSource, /function sanitizeStudioContactForPayload/);
  assert.match(studioSource, /const safeContact = sanitizeStudioContactForPayload\(contact\)/);
  assert.match(studioSource, /state: safeState,\s*estimate: safeEstimate,\s*contact: safeContact/);
  assert.match(studioSource, /notes: safeContact\.notes \|\| null/);
  assert.doesNotMatch(studioSource, /onSubmitStudio\(\{\s*state,\s*estimate,\s*contact/);
  assert.doesNotMatch(studioSource, /dangerouslySetInnerHTML/);
});