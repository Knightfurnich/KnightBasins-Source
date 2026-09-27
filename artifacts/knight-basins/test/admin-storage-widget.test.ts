import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(join(testDir, "../src/admin/AdminDashboard.tsx"), "utf8");

describe("admin dashboard storage health widget", () => {
  it("declares the widget and fetches the storage stats endpoint with admin credentials", () => {
    assert.ok(dashboardSource.includes('data-testid="widget-storage-health"'));
    assert.match(dashboardSource, /queryKey:\s*\["\/api\/admin\/storage\/stats"\]/);
    assert.match(
      dashboardSource,
      /customFetch<AdminStorageStats>\("\/api\/admin\/storage\/stats",\s*\{\s*method:\s*"GET",\s*credentials:\s*"include",\s*responseType:\s*"json"/,
    );
    assert.ok(dashboardSource.includes("DashboardStorageHealthWidget canNavigate={canNavigate}"));
  });

  it("renders portfolio and backup counts, sizes, and the newest backup date", () => {
    for (const id of [
      "storage-portfolio-stats",
      "storage-portfolio-count",
      "storage-backup-stats",
      "storage-backup-count",
      "storage-backup-newest-date",
    ]) {
      assert.ok(dashboardSource.includes(`data-testid="${id}"`), `Missing data-testid ${id}`);
    }
    assert.match(dashboardSource, /formatStorageCount\(data\?\.portfolio\?\.count\)/);
    assert.match(dashboardSource, /formatStorageSize\(data\?\.portfolio\?\.totalBytes\)/);
    assert.match(dashboardSource, /formatStorageCount\(data\?\.backups\?\.count\)/);
    assert.match(dashboardSource, /formatStorageSize\(data\?\.backups\?\.totalBytes\)/);
    assert.match(dashboardSource, /formatBackupDate\(data\?\.backups\?\.newestDate\)/);
  });

  it("shows overall health and only labels populated healthy backups ready for recovery", () => {
    assert.ok(dashboardSource.includes('data-testid="storage-health-status"'));
    assert.ok(dashboardSource.includes("สถานะพื้นที่ปกติ (Healthy)"));
    assert.ok(dashboardSource.includes("ควรตรวจสอบพื้นที่ (Warning)"));
    assert.match(dashboardSource, /const backupReady = hasBackups && status === "healthy"/);
    assert.ok(dashboardSource.includes("พร้อมกู้ภัย (RTO ≤ 4h)"));
    assert.ok(dashboardSource.includes("ยังไม่มีไฟล์สำรอง"));
  });

  it("provides safe loading, failure, and empty-value fallbacks", () => {
    for (const id of [
      "storage-health-loading",
      "storage-health-error",
      "storage-health-stale",
    ]) {
      assert.ok(dashboardSource.includes(`data-testid="${id}"`), `Missing data-testid ${id}`);
    }
    assert.match(dashboardSource, /if \(typeof value !== "number" \|\| !Number\.isFinite\(value\) \|\| value < 0\) return "—"/);
    assert.ok(dashboardSource.includes("ไม่มีข้อมูลวันสำรอง"));
    assert.match(dashboardSource, /data-testid="widget-storage-health"[\s\S]*?aria-busy=\{isLoading && !data\}/);
  });

  it("links users with portfolio access to the portfolio admin page", () => {
    assert.match(dashboardSource, /canNavigate\("\/admin\/portfolio"\)[\s\S]*?href="\/admin\/portfolio"/);
    assert.ok(dashboardSource.includes('data-testid="link-storage-portfolio"'));
    assert.match(
      dashboardSource,
      /\(canNavigate\("\/admin\/leads"\) \|\| canNavigate\("\/admin\/basins"\)\) && \([\s\S]*?DashboardStorageHealthWidget/,
    );
  });
});