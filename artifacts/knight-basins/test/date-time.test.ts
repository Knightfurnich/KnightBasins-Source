import assert from "node:assert/strict";
import test from "node:test";
import { formatEnglishDate, formatThaiDate, formatThaiDateTime, thaiDateInputValue } from "../src/data/date-time.ts";

const instant = new Date("2026-09-15T03:20:00.000Z");

test("date displays remain Bangkok time when the runtime timezone changes", () => {
  const originalTimezone = process.env.TZ;
  try {
    const values = ["UTC", "America/New_York"].map((timezone) => {
      process.env.TZ = timezone;
      return {
        date: formatThaiDate(instant),
        dateTime: formatThaiDateTime(instant),
        english: formatEnglishDate(instant),
        input: thaiDateInputValue(instant),
      };
    });
    assert.deepEqual(values[0], values[1]);
    assert.match(values[0].dateTime, /15 ก\.ย\. 2569 10:20/);
    assert.match(values[0].english, /15 Sept 2026/);
    assert.equal(values[0].input, "2026-09-15");
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});