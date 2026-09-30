import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const leadsUtilsSource = readFileSync(new URL("../src/admin/leads-utils.ts", import.meta.url), "utf8");
const leadsManagerSource = readFileSync(new URL("../src/admin/LeadsManager.tsx", import.meta.url), "utf8");
const duplicateMatcherSource = leadsUtilsSource.slice(
  leadsUtilsSource.indexOf("export function findDuplicateLeads"),
  leadsUtilsSource.indexOf("export function leadSearchText"),
);

describe("admin duplicate Lead detection", () => {
  it("exports a matcher that excludes the current Lead", () => {
    assert.match(
      leadsUtilsSource,
      /export function findDuplicateLeads\(currentLead: CustomerLead, allLeads: CustomerLead\[\]\): CustomerLead\[\]/,
    );
    assert.match(duplicateMatcherSource, /lead\.id === currentLead\.id/);
    assert.match(duplicateMatcherSource, /return false/);
  });

  it("normalizes phone spaces and hyphens and requires at least eight characters", () => {
    assert.ok(leadsUtilsSource.includes('return String(value ?? "").replace(/[\\s-]/g, "");'));
    assert.match(duplicateMatcherSource, /currentPhone\.length >= 8/);
    assert.match(duplicateMatcherSource, /candidatePhone\.length >= 8/);
    assert.match(duplicateMatcherSource, /candidatePhone === currentPhone/);
  });

  it("matches only trimmed case-insensitive names longer than three characters", () => {
    assert.ok(leadsUtilsSource.includes('return String(value ?? "").trim().toLocaleLowerCase();'));
    assert.match(duplicateMatcherSource, /normalized\(currentLead\.name\)/);
    assert.match(duplicateMatcherSource, /normalized\(lead\.name\)/);
    assert.match(duplicateMatcherSource, /currentName\.length > 3/);
    assert.match(duplicateMatcherSource, /candidateName\.length > 3/);
    assert.match(duplicateMatcherSource, /candidateName === currentName/);
  });

  it("accepts either a matching phone number or a matching name", () => {
    assert.match(duplicateMatcherSource, /return samePhone \|\| sameName/);
  });

  it("renders the duplicate warning badge and expandable related-history panel", () => {
    assert.ok(leadsManagerSource.includes("data-testid={`badge-duplicate-lead-${lead.id}`}"));
    assert.ok(leadsManagerSource.includes('data-testid="panel-duplicate-leads"'));
    assert.match(leadsManagerSource, /count=\{duplicateLeads\.length\}/);
    assert.match(leadsManagerSource, /onClick=\{\(\) => setExpandedLeadId\(isExpanded \? null : lead\.id\)\}/);
  });

  it("shows the related job code, date, status, and navigation action", () => {
    assert.match(leadsManagerSource, /relatedLead\.leadKey \|\| relatedLead\.quoteNumber/);
    assert.match(leadsManagerSource, /formatLeadDate\(relatedLead\.createdAt\)/);
    assert.match(leadsManagerSource, /statusLabels\[relatedLead\.status\]/);
    assert.match(leadsManagerSource, /onClick=\{\(\) => onNavigateToLead\(relatedLead\.id\)\}/);
    assert.match(leadsManagerSource, /row\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  });
});