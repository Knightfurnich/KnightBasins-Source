import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const handoverPageSource = readFileSync(
  new URL("../src/pages/DigitalHandoverPage.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);

describe("digital handover page", () => {
  it("registers the public handover route and loads the tokenized tracking endpoint", () => {
    assert.match(appSource, /<Route path="\/handover" component=\{DigitalHandoverPage\} \/>/);
    assert.match(handoverPageSource, /data-testid="page-digital-handover"/);
    assert.match(handoverPageSource, /api\/public\/track\?token=/);
    assert.match(handoverPageSource, /URLSearchParams/);
    assert.match(handoverPageSource, /encodeURIComponent\(token\)/);
    assert.match(handoverPageSource, /controller\.abort\(\)/);
    assert.match(handoverPageSource, /status-digital-handover-no-token/);
    assert.match(handoverPageSource, /status-digital-handover-error/);
  });

  it("renders real job, customer, project, location, and installation details", () => {
    for (const field of [
      "jobCode",
      "quoteNumber",
      "customerName",
      "projectName",
      "basinSkus",
      "shape",
      "stoneColor",
      "dimensionsMm",
      "completionDate",
      "site",
      "phone",
      "sitePhotos",
      "done",
    ]) {
      assert.ok(handoverPageSource.includes(field), `Missing handover data field: ${field}`);
    }
    for (const testId of [
      "text-handover-reference",
      "text-handover-date",
      "text-handover-customer",
      "text-handover-phone",
      "text-handover-project",
      "text-handover-location",
    ]) {
      assert.ok(handoverPageSource.includes(testId), `Missing handover display: ${testId}`);
    }
    assert.match(handoverPageSource, /data-testid=\{`text-handover-\$\{detail\.testId\}`\}/);
    for (const testId of ["stone-type", "stone-color", "basin-model", "counter-shape", "counter-dimensions"]) {
      assert.ok(handoverPageSource.includes(`testId: "${testId}"`), `Missing dynamic handover display: ${testId}`);
    }
    assert.match(handoverPageSource, /phone:\s*optionalString\(envelope\.phone\)/);
    assert.match(handoverPageSource, /phone \|\| "ไม่ได้ระบุ"/);
  });

  it("includes completed photos, the warranty terms, and care instructions", () => {
    assert.match(handoverPageSource, /data-testid="section-completed-work"/);
    assert.match(handoverPageSource, /envelope\.sitePhotos/);
    assert.match(handoverPageSource, /item\.stage !== "completed"/);
    assert.match(handoverPageSource, /safeImageUrl/);
    assert.match(handoverPageSource, /รับประกันงานประกอบและติดตั้ง 1 ปี/);
    assert.match(handoverPageSource, /รับประกันวัสดุตามเงื่อนไขผู้ผลิต/);
    assert.match(handoverPageSource, /สบู่อ่อนหรือน้ำยาล้างจาน/);
    assert.match(handoverPageSource, /ภาชนะหรือเครื่องครัวที่ร้อนจัด/);
    assert.match(handoverPageSource, /กรดหรือด่างรุนแรง/);
  });

  it("supports A4 printing and LINE sharing with the current handover link", () => {
    assert.match(handoverPageSource, /@page\s*\{\s*size:\s*A4/);
    assert.match(handoverPageSource, /window\.print\(\)/);
    assert.match(handoverPageSource, /data-testid="button-print-handover"/);
    assert.match(handoverPageSource, /line\.me\/R\/msg\/text/);
    assert.match(handoverPageSource, /window\.location\.href/);
    assert.match(handoverPageSource, /data-testid="button-share-handover-line"/);
  });

  it("opens the tokenized handover page from leads that have a public quote token", () => {
    assert.match(leadsManagerSource, /lead\.publicQuoteToken &&/);
    assert.match(leadsManagerSource, /href=\{`\/handover\?token=\$\{encodeURIComponent\(lead\.publicQuoteToken\)\}`\}/);
    assert.match(leadsManagerSource, /data-testid=\{`button-open-handover-\$\{lead\.id\}`\}/);
    assert.match(leadsManagerSource, /ใบส่งมอบงาน/);
  });

  it("labels a bad/expired token as LINK NOT FOUND instead of a misleading TEMPORARY ISSUE, and hides the no-op retry button", () => {
    // A 404 means this token will never resolve, so the copy must say so
    // plainly and must not offer a "retry" action that just reproduces the
    // same error.
    assert.match(handoverPageSource, /class HandoverFetchError extends Error/);
    assert.match(handoverPageSource, /new HandoverFetchError\(notFound \? "ไม่พบข้อมูลงานสำหรับลิงก์นี้" : "ระบบส่งมอบงานไม่พร้อมใช้งานชั่วคราว", notFound\)/);
    assert.match(handoverPageSource, /notFound \? "LINK NOT FOUND" : "TEMPORARY ISSUE"/);
    assert.match(handoverPageSource, /\{!noToken && !notFound && \(/);
  });
});