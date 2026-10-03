import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const logsManager = readFileSync(new URL("../src/admin/AdminLogsManager.tsx", import.meta.url), "utf8");

describe("admin audit Action Tracker UI", () => {
  it("offers 7-, 30- and 90-day insight ranges with previous-period trend labels", () => {
    for (const range of ["7d", "30d", "90d"]) {
      assert.match(logsManager, new RegExp(`value: "${range}"`));
      assert.match(logsManager, new RegExp(`button-audit-insights-range-\\$\\{option\\.value\\}`));
    }
    assert.match(logsManager, /audit-logs\/insights\?range=\$\{insightsRange\}/);
    assert.match(logsManager, /data-testid="audit-insights-trend"/);
    assert.match(logsManager, /เพิ่มขึ้น \$\{insightsQuery\.data\.trend\.changePercent\}%/);
    assert.match(logsManager, /ลดลง \$\{Math\.abs\(insightsQuery\.data\.trend\.changePercent\)\}%/);
  });

  it("creates tracker items from pain points and supports status and note updates", () => {
    assert.match(logsManager, /data-testid="audit-issue-tracker"/);
    assert.match(logsManager, /button-audit-create-tracker-\$\{index \+ 1\}/);
    assert.match(logsManager, /data-testid="dialog-audit-tracker-create"/);
    assert.match(logsManager, /data-testid="button-audit-tracker-create-submit"/);
    assert.match(logsManager, /customFetch<AuditIssueTrackerResponse>\("\/api\/admin\/audit-issues", \{/);
    assert.match(logsManager, /data-testid=\{`audit-tracker-column-\$\{statusOption\.value\}`\}/);
    assert.match(logsManager, /data-testid=\{`button-audit-tracker-status-\$\{item\.id\}-\$\{option\.value\}`\}/);
    assert.match(logsManager, /textarea-audit-tracker-notes-\$\{item\.id\}/);
    assert.match(logsManager, /customFetch<AuditIssueTrackerResponse>\(`\/api\/admin\/audit-issues\/\$\{id\}`/);
  });

  it("shows the prune dry-run and requires a successful JSON backup before deletion", () => {
    assert.match(logsManager, /customFetch<AuditPrunePreviewResponse>\("\/api\/admin\/audit-logs\/prune-preview"\)/);
    assert.match(logsManager, /customFetch<AuditLogExportResponse>\("\/api\/admin\/audit-logs\/export"\)/);
    assert.match(logsManager, /customFetch<AuditLogPruneResponse>\("\/api\/admin\/audit-logs\/prune", \{ method: "POST" \}\)/);
    assert.match(logsManager, /data-testid="dialog-audit-prune-confirm"/);
    assert.match(logsManager, /data-testid="audit-prune-preview-total"/);
    assert.match(logsManager, /data-testid="button-audit-prune-download-backup"/);
    assert.match(logsManager, /!backupDownloaded \|\| !prunePreviewQuery\.data/);
    assert.match(logsManager, /action slip\.upload หรือรายการของแอดมิน/);
  });
});