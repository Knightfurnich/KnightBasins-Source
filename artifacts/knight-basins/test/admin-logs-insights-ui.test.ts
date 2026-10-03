import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const logsManager = readFileSync(new URL("../src/admin/AdminLogsManager.tsx", import.meta.url), "utf8");

describe("admin audit-log UX Insights tab", () => {
  it("switches between the existing log history and the Insights view", () => {
    assert.match(logsManager, /role="tablist" aria-label="มุมมอง Logs"/);
    assert.match(logsManager, /data-testid="tab-audit-history"/);
    assert.match(logsManager, /data-testid="tab-audit-insights"/);
    assert.match(logsManager, /onClick=\{\(\) => setActiveTab\("history"\)\}/);
    assert.match(logsManager, /onClick=\{\(\) => setActiveTab\("insights"\)\}/);
    assert.match(logsManager, /activeTab === "history" \? \(/);
    assert.match(logsManager, /data-testid="audit-logs-insights"/);
  });

  it("renders four summary cards for totals, success, customer friction and smooth rate", () => {
    for (const testId of [
      "insights-summary-total",
      "insights-summary-success",
      "insights-summary-friction",
      "insights-summary-smooth-rate",
    ]) {
      assert.ok(logsManager.includes(`testId="${testId}"`), `missing summary card ${testId}`);
    }
    assert.match(logsManager, /value=\{insightsQuery\.data\.customerIssues\}/);
    assert.match(logsManager, /insightsQuery\.data\.totals\.success \/ insightsQuery\.data\.totals\.total/);
  });

  it("shows category counts and the five most common pain points with Thai business recommendations", () => {
    assert.match(logsManager, /ปัญหาลูกค้าแยกตามหมวด/);
    assert.match(logsManager, /type AuditInsightCategory = "ux" \| "slip" \| "form"/);
    assert.match(logsManager, /data-testid=\{`insights-category-\$\{category\.category\}`\}/);
    assert.match(logsManager, /insightsQuery\.data\.categories\.map\(\(category\)/);
    assert.match(logsManager, /5 ปัญหาที่ลูกค้าพบบ่อยที่สุดในรอบเดือน/);
    assert.match(logsManager, /painPoints\.slice\(0, 5\)/);
    assert.match(logsManager, /point\.description/);
    assert.match(logsManager, /point\.recommendation/);
    assert.match(logsManager, /data-testid=\{`row-audit-pain-point-\$\{index \+ 1\}`\}/);
    assert.match(logsManager, /data-testid="audit-pain-points-empty"/);
  });

  it("asks before pruning, calls the owner endpoint, and displays the latest pruned row count", () => {
    assert.match(logsManager, /customFetch<AuditLogPruneResponse>\("\/api\/admin\/audit-logs\/prune", \{ method: "POST" \}\)/);
    assert.match(logsManager, /data-testid="button-audit-prune"/);
    assert.match(logsManager, /ล้างประวัติ Log เก่าตามเกณฑ์/);
    assert.match(logsManager, /data-testid="dialog-audit-prune-confirm"/);
    assert.match(logsManager, /action slip\.upload หรือรายการของแอดมิน/);
    assert.match(logsManager, /data-testid="text-audit-prune-result"/);
    assert.match(logsManager, /lastPruneCount\.toLocaleString\("th-TH"\)/);
  });

  it("has explicit loading and error states and refreshes the currently selected view", () => {
    assert.match(logsManager, /data-testid="audit-insights-loading"/);
    assert.match(logsManager, /data-testid="audit-insights-error"/);
    assert.match(logsManager, /activeTab === "history" \? refetch\(\) : insightsQuery\.refetch\(\)/);
    assert.match(logsManager, /queryKey: \["\/api\/admin\/audit-logs\/insights"\]/);
  });
});