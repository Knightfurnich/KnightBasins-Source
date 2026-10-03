/**
 * Static checks for the admin "Logs ตรวจสอบ" page (job-215): the SYSTEM menu item and its
 * route, the live search and filters, the status colours, and the detail drawer. The page
 * is a React component (not renderable in node:test), so these read the real source; the one
 * pure helper that decides the "open this lead" link is executed for real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { describe, it } from "node:test";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const adminApp = read("../src/admin/AdminApp.tsx");
const logsManager = read("../src/admin/AdminLogsManager.tsx");
const leadsManager = read("../src/admin/LeadsManager.tsx");
const dbSchema = read("../../../lib/db/src/schema/index.ts");

describe("admin sidebar and route (job-215)", () => {
  const navItems = adminApp.slice(adminApp.indexOf("const NAV_ITEMS = ["), adminApp.indexOf("] as const;", adminApp.indexOf("const NAV_ITEMS = [")));
  const logsItem = navItems.split("\n").find((line) => line.includes('href: "/admin/logs"')) ?? "";

  it('has a "Logs ตรวจสอบ" menu item in the SYSTEM group', () => {
    assert.ok(logsItem, "no /admin/logs entry in NAV_ITEMS");
    assert.match(logsItem, /label: "Logs ตรวจสอบ"/);
    assert.match(logsItem, /group: "system"/);
    assert.match(adminApp, /\{ key: "system", label: "ระบบ & ทีมงาน" \}/);
  });

  it("is owner-only, like the team page, because the trail lists customer names and phone numbers", () => {
    assert.match(logsItem, /team: true/);
    assert.match(adminApp, /function AdminLogsRoute\(\) \{\s*const access = useAdminAccess\(\);\s*return access\.canManageTeam \? <AdminLogsManager \/> : <AccessDeniedPage resource="Logs ตรวจสอบ" \/>;/);
  });

  it("registers the /admin/logs route and imports the page", () => {
    assert.match(adminApp, /<Route path="\/admin\/logs" component=\{AdminLogsRoute\} \/>/);
    assert.match(adminApp, /import \{ AdminLogsManager \} from "\.\/AdminLogsManager";/);
  });

  it("gives the item its own test id instead of colliding with the team item's", () => {
    assert.match(logsItem, /testId: "nav-admin-logs"/);
    assert.match(adminApp, /data-testid=\{testId \?\? `nav-admin-\$\{adminOnly \? "backup" : team \? "team" : permission \?\? "home"\}`\}/);
    assert.match(adminApp, /testId=\{"testId" in item \? item\.testId : undefined\}/);
  });
});

describe("AdminLogsManager search, filters and table (job-215)", () => {
  it("searches live by quote number, customer phone or staff name against GET /api/admin/audit-logs", () => {
    assert.match(logsManager, /data-testid="input-audit-log-search"/);
    assert.match(logsManager, /placeholder="ค้นหาเลขที่ใบเสนอราคา \/ เบอร์โทรลูกค้า \/ ชื่อทีมงาน"/);
    assert.match(logsManager, /const SEARCH_DEBOUNCE_MS = \d+/);
    assert.match(logsManager, /useDebounced\(search\.trim\(\), SEARCH_DEBOUNCE_MS\)/);
    assert.match(logsManager, /customFetch<AuditLogsResponse>\(`\/api\/admin\/audit-logs\?\$\{queryString\}`\)/);
    for (const param of ['"q"', '"status"', '"actorType"', "limit:", "offset:"]) {
      assert.ok(logsManager.includes(param), `the query string no longer sends ${param}`);
    }
  });

  it("offers the four status filters: all / success / warning / error", () => {
    for (const [value, label] of [["all", "ทั้งหมด"], ["success", "สำเร็จ"], ["warning", "คำเตือน"], ["error", "ข้อผิดพลาด"]]) {
      assert.ok(logsManager.includes(`{ value: "${value}", label: "${label}" }`), `missing filter ${value}`);
    }
    assert.match(logsManager, /data-testid=\{`button-audit-status-\$\{option\.value\}`\}/);
    assert.match(logsManager, /aria-pressed=\{status === option\.value\}/);
  });

  it("starts again from the first page whenever a filter changes, and pages 50 at a time", () => {
    assert.match(logsManager, /useEffect\(\(\) => setPage\(0\), \[debouncedSearch, status, actorType\]\)/);
    assert.match(logsManager, /export const AUDIT_PAGE_SIZE = 50;/);
    assert.match(logsManager, /data-testid="button-audit-prev"/);
    assert.match(logsManager, /data-testid="button-audit-next"/);
  });

  it("colours the rows green / orange / red by status", () => {
    const block = logsManager.slice(logsManager.indexOf("AUDIT_STATUS_STYLES"), logsManager.indexOf("function actionLabel"));
    assert.match(block, /success:[^\n]*emerald/);
    assert.match(block, /warning:[^\n]*amber/);
    assert.match(block, /error:[^\n]*red/);
    assert.match(logsManager, /className=\{`border-l-4 \$\{AUDIT_STATUS_STYLES\[row\.status\]\?\.row \?\? ""\}`\}/);
    assert.match(logsManager, /data-testid=\{`row-audit-log-\$\{row\.id\}`\}/);
  });

  it("shows loading, empty and error states, and uses no custom CSS (Tailwind utilities only)", () => {
    for (const id of ["audit-logs-loading", "audit-logs-empty", "audit-logs-error"]) assert.ok(logsManager.includes(`data-testid="${id}"`), id);
    assert.doesNotMatch(logsManager, /className="(ai-cost|admin-logs|audit-log)[a-z_-]*/);
  });

  it("reads exactly the columns the system_audit_logs table has", () => {
    const rowType = logsManager.slice(logsManager.indexOf("export type AuditLogRow = {"), logsManager.indexOf("};", logsManager.indexOf("export type AuditLogRow = {")));
    const tableBlock = dbSchema.slice(dbSchema.indexOf('"system_audit_logs"'), dbSchema.indexOf("export type BasinPrice"));
    const fields = [...rowType.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]!);
    assert.deepEqual(fields, ["id", "actorType", "actorName", "action", "targetId", "status", "errorCode", "details", "ipAddress", "userAgent", "createdAt"]);
    for (const field of fields) assert.ok(tableBlock.includes(`${field}: `), `the table has no ${field} column`);
  });
});

describe("detail drawer (job-215)", () => {
  it("opens a side drawer from a button on every row", () => {
    assert.match(logsManager, /data-testid=\{`button-audit-detail-\$\{row\.id\}`\}/);
    assert.match(logsManager, /onClick=\{\(\) => setSelected\(row\)\}/);
    assert.match(logsManager, /<Sheet open=\{row !== null\}/);
    assert.match(logsManager, /<SheetContent side="right"[^>]*data-testid="audit-log-detail-drawer"/);
  });

  it("unfolds the JSON details, the raw error message and the request context", () => {
    assert.match(logsManager, /JSON\.stringify\(row\.details, null, 2\)/);
    assert.match(logsManager, /data-testid="audit-log-detail-json"/);
    assert.match(logsManager, /data-testid="audit-log-raw-error"/);
    assert.match(logsManager, /row\.details\["errorMessage"\]/);
    assert.match(logsManager, /row\.ipAddress/);
    assert.match(logsManager, /row\.userAgent/);
    assert.match(logsManager, /data-testid="button-audit-copy-json"/);
  });

  it("links to the lead the row is about, using the quote number the Leads page can search", () => {
    assert.match(logsManager, /href=\{`\/admin\/leads\?q=\$\{encodeURIComponent\(leadTerm\)\}`\}/);
    assert.match(logsManager, /data-testid="link-audit-open-lead"/);
    assert.match(leadsManager, /new URLSearchParams\(window\.location\.search\)\.get\("q"\)/, "the Leads page must read ?q= for that link to land on the right lead");
  });

  it("auditLeadSearchTerm prefers the quote number and only offers a link for lead-related events", () => {
    const start = logsManager.indexOf("export function auditLeadSearchTerm(");
    const end = logsManager.indexOf("function useDebounced", start);
    assert.ok(start >= 0 && end > start);
    const source = stripTypeScriptTypes(logsManager.slice(start, end).replace("export function", "function"));
    const auditLeadSearchTerm = new Function(`${source}\nreturn auditLeadSearchTerm;`)() as (row: unknown) => string | null;

    assert.equal(auditLeadSearchTerm({ action: "lead.upsert", targetId: "lead-key", details: { quoteNumber: "ตุลาคม / US / 123456" } }), "ตุลาคม / US / 123456");
    assert.equal(auditLeadSearchTerm({ action: "slip.upload", targetId: "ตุลาคม / US / 654321", details: null }), "ตุลาคม / US / 654321");
    assert.equal(auditLeadSearchTerm({ action: "admin.lead.delete", targetId: "ตุลาคม / US / 123456", details: { quoteNumber: "ตุลาคม / US / 123456" } }), null, "a deleted lead has nothing to open");
    assert.equal(auditLeadSearchTerm({ action: "lead.upsert", targetId: "lead-xyz", details: { leadKey: "lead-xyz" } }), null, "a failed save has no quotation yet");
    assert.equal(auditLeadSearchTerm({ action: "admin.stone.update", targetId: "BW010", details: { code: "BW010" } }), null);
    assert.equal(auditLeadSearchTerm({ action: "lead.upsert", targetId: null, details: null }), null);
  });
});
