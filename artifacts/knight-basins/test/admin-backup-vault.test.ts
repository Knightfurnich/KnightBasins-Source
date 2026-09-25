import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const backupPageSource = readFileSync(
  path.join(testDirectory, "../src/admin/BackupVaultPage.tsx"),
  "utf8",
);
const adminAppSource = readFileSync(
  path.join(testDirectory, "../src/admin/AdminApp.tsx"),
  "utf8",
);

const mockedCsvExports = new Map([
  ["/api/admin/backup/leads-export", () => new Response("lead_id,customer\n1,Sample", {
    headers: { "content-type": "text/csv; charset=utf-8" },
  })],
  ["/api/admin/backup/basins-export", () => new Response("sku,name,price\nB-001,Sample basin,1000", {
    headers: { "content-type": "text/csv; charset=utf-8" },
  })],
]);

describe("admin backup vault", () => {
  it("shows all four backup categories and the Admin / Owner access badge", () => {
    for (const testId of [
      "backup-card-leads",
      "backup-card-photos",
      "backup-card-basins",
      "backup-card-database",
    ]) {
      assert.match(backupPageSource, new RegExp(`data-testid="${testId}"`));
    }

    assert.match(backupPageSource, /ข้อมูลลูกค้าและคำสั่งซื้อ/);
    assert.match(backupPageSource, /ภาพถ่ายหน้างานจริง/);
    assert.match(backupPageSource, /แคตตาล็อกอ่าง 30 รุ่นและราคา/);
    assert.match(backupPageSource, /ฐานข้อมูลระบบ/);
    assert.match(backupPageSource, /เข้าถึงโดย: ผู้ดูแลระบบ \(Admin \/ Owner\)/);
    assert.match(backupPageSource, /href="\/admin\/site-photos"/);
    assert.match(backupPageSource, /fetch\("\/api\/admin\/site-photos"/);
  });

  it("uses downloadable links compatible with mocked CSV export responses", () => {
    for (const [endpoint, mockResponse] of mockedCsvExports) {
      const escapedEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        backupPageSource,
        new RegExp(`<a\\b[^>]*href="${escapedEndpoint}"[^>]*\\bdownload\\b[^>]*>`),
      );
      assert.equal(mockResponse().headers.get("content-type"), "text/csv; charset=utf-8");
    }
  });

  it("shows the backup navigation and route only to Admin / Owner access", () => {
    assert.match(
      adminAppSource,
      /href: "\/admin\/backup", label: "สำรองข้อมูล", exact: false, permission: null, adminOnly: true/,
    );
    assert.match(adminAppSource, /access\.role === "owner" \|\| access\.canManageTeam/);
    assert.match(adminAppSource, /NAV_ITEMS\.filter\(\(item\) => canShowNavItem\(item, access\)\)/);
    assert.match(adminAppSource, /<Route path="\/admin\/backup" component=\{AdminBackupRoute\} \/>/);
    assert.match(adminAppSource, /function AdminBackupRoute\(\)/);
  });
});