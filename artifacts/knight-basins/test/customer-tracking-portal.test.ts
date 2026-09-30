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
});