/**
 * Static source inspection for the grouped admin sidebar.
 *
 * The owner asked for the flat 14-item left menu to be grouped so it is easier
 * to scan, WITHOUT touching the permission model. These tests pin both halves:
 * the four group headings exist and every nav item still carries its original
 * permission / team / adminOnly flags, so grouping can never silently widen or
 * narrow who can see a menu.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../src/admin/AdminApp.tsx", import.meta.url), "utf8");

describe("admin sidebar grouping", () => {
  it("declares the four navigation groups", () => {
    assert.match(source, /const NAV_GROUPS = \[/);
    for (const label of ["ภาพรวม", "แคตตาล็อก & สต็อก", "ลูกค้า & การขาย", "ระบบ & ทีมงาน"]) {
      assert.ok(source.includes(label), `missing group label: ${label}`);
    }
  });

  it("assigns every nav item to a declared group", () => {
    const itemLines = source.match(/\{ href: "\/admin[^\n]*\},?/g) ?? [];
    assert.equal(itemLines.length, 15, "expected 15 nav items (job-215 added /admin/logs)");
    for (const line of itemLines) {
      assert.match(line, /group: "(overview|catalog|sales|system)"/, `nav item without group: ${line}`);
    }
  });

  it("renders the sidebar grouped and skips empty groups", () => {
    assert.match(source, /NAV_GROUPS\.map\(\(group\) => \{/);
    assert.match(source, /item\.group === group\.key && canShowNavItem\(item, access\)/);
    assert.match(source, /if \(groupItems\.length === 0\) return null;/);
  });

  it("keeps the mobile selector grouped with optgroups", () => {
    assert.match(source, /<optgroup key=\{group\.key\} label=\{group\.label\}>/);
  });

  it("never changes the permission flags while grouping", () => {
    // The exact permission/team/adminOnly values the app shipped with before grouping.
    const expected: Array<[string, string]> = [
      ["/admin", 'permission: null, group: "overview"'],
      ["/admin/basins", 'permission: "basins"'],
      ["/admin/installed-stones", 'permission: "installed-stones"'],
      ["/admin/sheet-stones", 'permission: "sheet-stones"'],
      ["/admin/stock", 'permission: "basins"'],
      ["/admin/leads", 'permission: "leads"'],
      ["/admin/calendar", 'permission: "leads"'],
      ["/admin/technician-teams", 'permission: "leads"'],
      ["/admin/voice-settings", 'permission: "leads"'],
      ["/admin/site-photos", 'permission: "leads"'],
      ["/admin/portfolio", 'permission: "leads"'],
      ["/admin/ai-cost", 'permission: "leads"'],
      ["/admin/team", "team: true"],
      ["/admin/logs", "team: true"],
      ["/admin/backup", "adminOnly: true"],
    ];
    for (const [href, fragment] of expected) {
      const line = source.split("\n").find((l) => l.includes(`href: "${href}"`));
      assert.ok(line, `nav item for ${href} not found`);
      assert.ok(line.includes(fragment), `${href} should still carry ${fragment} — got: ${line.trim()}`);
    }
  });

  it("still filters admin-only items out of the nav for non-owners", () => {
    assert.match(source, /function canShowNavItem\(item: \(typeof NAV_ITEMS\)\[number\], access: AdminAccess\)/);
    assert.match(source, /NAV_ITEMS\.filter\(\(item\) => canShowNavItem\(item, access\)\)/);
  });
});
