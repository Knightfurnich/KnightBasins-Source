import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const calendarSource = readFileSync(
  new URL("../src/admin/TechnicianCalendarPage.tsx", import.meta.url),
  "utf8",
);
const formatterStart = calendarSource.indexOf("export function formatTechnicianJobCard");
const formatterEnd = calendarSource.indexOf("function StageBadge", formatterStart);
const formatterSource = calendarSource.slice(formatterStart, formatterEnd);

describe("technician LINE job card", () => {
  it("exports the requested formatter signature", () => {
    assert.match(
      calendarSource,
      /export function formatTechnicianJobCard\(job: CalendarJobItem, dateIso: string\): string/,
    );
  });

  it("includes the job code, project, customer, date, and detected work stage", () => {
    assert.match(formatterSource, /dateFormatter\.format\(dateFromBangkokDateKey\(dateIso\)\)/);
    assert.match(formatterSource, /job\.leadKey\.trim\(\)/);
    assert.match(formatterSource, /job\.project\?\.trim\(\)/);
    assert.match(formatterSource, /job\.name\.trim\(\)/);
    assert.match(formatterSource, /detectJobStage\(job\.project\)/);
    assert.match(formatterSource, /JOB_STAGE_PRESENTATION\[detectJobStage\(job\.project\)\]\.label/);
  });

  it("includes an existing Maps link or builds navigation from a non-empty address", () => {
    assert.match(formatterSource, /job\.siteMapsUrl\?\.trim\(\) \|\| \(address \? googleMapsUrl\(address\) : ""\)/);
    assert.match(formatterSource, /🧭 Google Maps: \$\{mapsUrl\}/);
  });

  it("uses safe address fallback text and omits an absent phone number", () => {
    assert.match(formatterSource, /const address = job\.address\?\.trim\(\) \|\| ""/);
    assert.match(formatterSource, /const phone = job\.phone\?\.trim\(\) \|\| ""/);
    assert.match(formatterSource, /📍 ที่อยู่: \$\{address \|\| "ยังไม่ได้ระบุที่อยู่"\}/);
    assert.match(formatterSource, /\.\.\.\(phone \? \[`📞 เบอร์ติดต่อ: \$\{phone\}`\] : \[\]\)/);
    assert.doesNotMatch(formatterSource, /\b(?:undefined|null)\b/);
  });

  it("renders the technician-card copy button on each job card", () => {
    assert.ok(calendarSource.includes("data-testid={`button-copy-technician-card-${job.id}`}"));
    assert.match(calendarSource, /📲 การ์ดงานช่าง/);
  });

  it("copies the formatted card and shows the required Thai success toast", () => {
    assert.match(
      calendarSource,
      /navigator\.clipboard\.writeText\(formatTechnicianJobCard\(job, installationDate\)\)/,
    );
    assert.match(calendarSource, /คัดลอกการ์ดงานสำหรับส่ง LINE ช่างเรียบร้อย/);
  });
});