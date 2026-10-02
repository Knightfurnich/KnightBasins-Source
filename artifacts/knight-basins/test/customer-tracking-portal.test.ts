import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const trackingPageSource = readFileSync(
  new URL("../src/pages/CustomerTrackingPage.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);

describe("customer job tracking portal", () => {
  it("registers the public route and requires the token from the URL", () => {
    assert.match(appSource, /CustomerTrackingPage/);
    assert.match(appSource, /<Route path="\/track" component=\{CustomerTrackingPage\} \/>/);
    assert.match(trackingPageSource, /data-testid="page-customer-tracking"/);
    assert.match(trackingPageSource, /api\/public\/track/);
    assert.match(trackingPageSource, /URLSearchParams/);
    assert.match(trackingPageSource, /token/);
  });

  it("shows the five customer-facing job stages in order", () => {
    assert.match(trackingPageSource, /data-testid="timeline-job-tracking"/);
    const stageKeys = [
      "quote_accepted",
      "in_production",
      "ready_to_install",
      "installing",
      "completed",
    ];
    for (const stage of stageKeys) {
      assert.ok(trackingPageSource.includes(stage), `Missing job-tracking stage: ${stage}`);
    }
  });

  it("shows only completed work photos and supports an enlarged image view", () => {
    assert.match(trackingPageSource, /data-testid="gallery-completed-photos"/);
    assert.match(trackingPageSource, /completed/);
    assert.match(trackingPageSource, /imageUrl/);
    assert.match(trackingPageSource, /role="dialog"/);
    assert.match(trackingPageSource, /data-testid="button-close-completed-photo"/);
  });

  it("maps the live API photo and studio fields and keeps the legacy photo fallback", () => {
    assert.match(
      trackingPageSource,
      /Array\.isArray\(envelope\.sitePhotos\)\s*\?\s*envelope\.sitePhotos\s*:\s*Array\.isArray\(envelope\.photos\)\s*\?\s*envelope\.photos/,
    );
    assert.match(trackingPageSource, /shape: optionalString\(rawStudio\.shape\)/);
    assert.match(trackingPageSource, /dimensionsMm: isRecord\(rawStudio\.dimensionsMm\)/);
    for (const dimension of ["depth", "runA", "runB", "runC"]) {
      assert.match(
        trackingPageSource,
        new RegExp(`${dimension}: optionalNumber\\(rawStudio\\.dimensionsMm\\.${dimension}\\)`),
      );
    }
    assert.match(trackingPageSource, /stoneColor: optionalString\(rawStudio\.stoneColor\)/);
    assert.match(trackingPageSource, /basinSkus: Array\.isArray\(rawStudio\.basinSkus\)/);
    assert.match(trackingPageSource, /formatDimensionsMm\(studio\?\.dimensionsMm\)/);
    assert.match(trackingPageSource, /studio\?\.basinSkus\?\.join\(", "\)/);
    assert.match(trackingPageSource, /data-testid="gallery-completed-photos"/);
    assert.match(trackingPageSource, /onClick=\{\(\) => setSelected\(photo\)\}/);
    assert.match(trackingPageSource, /role="dialog"/);
  });

  it("provides the requested LINE contact and excludes internal-only fields", () => {
    assert.match(trackingPageSource, /789gcnhq/);
    assert.match(trackingPageSource, /line\.me/);
    assert.doesNotMatch(
      trackingPageSource,
      /\.(?:notes|technician(?:Name|Id)?|cost(?:Price)?|profit)\b/i,
    );
  });

  it("copies tokenized tracking links for leads with a public quote token", () => {
    assert.match(leadsManagerSource, /function customerTrackingUrl/);
    assert.match(leadsManagerSource, /new URL\("\/track"/);
    assert.match(leadsManagerSource, /searchParams\.set\("token", token\)/);
    assert.match(leadsManagerSource, /navigator\.clipboard\.writeText\(customerTrackingUrl\(publicQuoteToken\)\)/);
    assert.match(
      leadsManagerSource,
      /data-testid=\{`button-copy-track-link-\$\{lead\.id\}`\}/,
    );
    assert.match(leadsManagerSource, /lead\.publicQuoteToken &&/);
  });

  it("labels a bad/expired token as LINK NOT FOUND instead of a misleading TEMPORARY ISSUE, and hides the no-op retry button", () => {
    // A 404 means this token will never resolve, so the copy must say so
    // plainly and must not offer a "retry" action that just reproduces the
    // same error.
    assert.match(trackingPageSource, /class TrackingFetchError extends Error/);
    assert.match(trackingPageSource, /new TrackingFetchError\(notFound \? "ไม่พบข้อมูลงานสำหรับลิงก์นี้" : "ระบบติดตามงานไม่พร้อมใช้งานชั่วคราว", notFound\)/);
    assert.match(trackingPageSource, /notFound \? "LINK NOT FOUND" : "TEMPORARY ISSUE"/);
    assert.match(trackingPageSource, /\{!noToken && !notFound && \(/);
  });
});