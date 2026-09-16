import assert from "node:assert/strict";
import test from "node:test";
import { formatQuoteMonth } from "../src/lib/date-time.ts";

test("new quote numbers use the Bangkok month at the UTC month boundary", async () => {
  assert.equal(formatQuoteMonth(new Date("2026-09-30T23:30:00.000Z")), "Oct 26");
});