/**
 * Static source inspection for dashboard-tile navigation permissions.
 *
 * Bug this pins: the "ลูกค้ารอติดต่อ" tile navigates to
 * `/admin/leads?status=awaiting_contact`. The old `canNavigate` looked the
 * WHOLE href up in a hand-written permission map, so a href carrying a query
 * string matched nothing, returned false, and sent the user to
 * /admin/access-denied — for every role, including the owner. The fix resolves
 * the pathname against NAV_ITEMS (the single source of truth for menu
 * permissions) instead of a duplicated map.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../src/admin/AdminApp.tsx", import.meta.url), "utf8");

function canNavigateBody(): string {
  const start = source.indexOf("const canNavigate = (href: string) => {");
  assert.ok(start > -1, "canNavigate not found in AdminApp.tsx");
  const end = source.indexOf("const onNavigate =", start);
  assert.ok(end > start, "onNavigate not found after canNavigate");
  return source.slice(start, end);
}

describe("admin dashboard tile navigation", () => {
  it("strips the query string before resolving the route", () => {
    const body = canNavigateBody();
    assert.match(body, /href\.split\("\?"\)\[0\]\.split\("#"\)\[0\]/);
  });

  it("resolves permissions from NAV_ITEMS instead of a duplicated href map", () => {
    const body = canNavigateBody();
    assert.match(body, /NAV_ITEMS\.find\(\(candidate\) => candidate\.href === pathname\)/);
    assert.doesNotMatch(body, /permissionByHref/);
  });

  it("keeps every gated route enforced for a user without the permission", () => {
    const body = canNavigateBody();
    assert.match(body, /if \("adminOnly" in item && item\.adminOnly\) return canAccessBackupVault\(access\)/);
    assert.match(body, /if \("team" in item && item\.team\) return access\.canManageTeam/);
    assert.match(body, /return hasPermission\(access, item\.permission\)/);
  });

  it("allows unknown dashboard tiles through so the page-level gate decides", () => {
    const body = canNavigateBody();
    assert.match(body, /if \(!item\) return true;/);
  });

  it("the awaiting-contact tile really does carry a query string", () => {
    const dashboard = readFileSync(new URL("../src/admin/AdminDashboard.tsx", import.meta.url), "utf8");
    assert.match(dashboard, /onNavigate\("\/admin\/leads\?status=awaiting_contact"\)/);
  });
});
