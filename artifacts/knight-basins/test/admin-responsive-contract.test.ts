import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * job 450-B · สัญญาความถูกใจของหน้า admin บนมือถือ (390/360)
 * เป้า: ห้ามกลบ overflow ด้วย mask, กริดฟอร์มต้องพับ, ตารางต้องมีกรอบเลื่อนของตัวเอง,
 * เป้าแตะ >=44px และช่องว่างระหว่างกลุ่ม >=24px บนเดสก์ท็อปต้องไม่เปลี่ยน
 */

const ADMIN_DIR = new URL("../src/admin/", import.meta.url);
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const adminFiles = readdirSync(ADMIN_DIR)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => ({ name, source: readFileSync(new URL(name, ADMIN_DIR), "utf8") }));
const read = (name: string) => readFileSync(new URL(name, ADMIN_DIR), "utf8");

const basinsManager = read("BasinsManager.tsx");
const installedManager = read("InstalledStonesManager.tsx");
const sheetManager = read("SheetStonesManager.tsx");
const calendarPage = read("TechnicianCalendarPage.tsx");
const teamsPage = read("TechnicianTeamsManager.tsx");
const stockPage = read("StockInventoryPage.tsx");

/** กริดที่มีจำนวนคอลัมน์ตายตัว โดยไม่มี breakpoint คุม = ต้นเหตุของ "ฟอร์มเบียด" บนมือถือ */
function nakedFixedGrids(source: string) {
  const hits: string[] = [];
  for (const token of source.match(/class(?:Name)?="[^"]*"/g) ?? []) {
    const value = token.slice(token.indexOf('"') + 1, -1);
    const cols = value.match(/\bgrid-cols-([2-9])\b/);
    if (!cols) continue;
    const hasBreakpoint = new RegExp(`(?:sm|md|lg|xl|min-\\[[^\\]]+\\]):grid-cols-([2-9])`).test(value);
    if (value.includes("admin-week-grid")) continue; // กริดสัปดาห์: พับไม่ได้ แต่ล็อกไว้ในกรอบเลื่อนของตัวเอง
    if (!hasBreakpoint && value.includes("grid") && !value.includes("grid-flow")) hits.push(value);
  }
  return hits;
}

describe("job 450-B · admin responsive contract", () => {
  it(" bans the overflow-x masking hack across the whole admin panel", () => {
    for (const { name, source } of adminFiles) {
      assert.doesNotMatch(source, /overflow-x-hidden/, `${name} still masks horizontal overflow`);
    }
    assert.doesNotMatch(css, /\.admin-main[^{]*\{[^}]*overflow-x:\s*hidden/);
  });

  it("folds every basin/stone form grid to one column on phones and keeps two on desktop", () => {
    for (const [source, expected] of [
      [basinsManager, 4],
      [installedManager, 2],
      [sheetManager, 2],
    ] as const) {
      const folded = source.match(/admin-form-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4/g) ?? [];
      assert.equal(folded.length, expected, "form grids must fold cols-1 -> sm:cols-2");
      assert.equal(nakedFixedGrids(source).length, 0, `naked fixed grid remains: ${nakedFixedGrids(source).join(" | ")}`);
    }
    // เดสก์ท็อป (>=640px) ยังเป็น 2 คอลัมน์เหมือนก่อนแก้
    assert.match(basinsManager, /sm:grid-cols-2/);
  });

  it("keeps form groups spaced and labels above their fields", () => {
    for (const source of [basinsManager, installedManager, sheetManager]) {
      assert.match(source, /space-y-6/, "dialog body needs >=24px between field groups");
    }
    assert.match(css, /\.admin-form-grid label\s*\{[^}]*flex-direction:\s*column/);
    assert.match(css, /\.admin-form-grid label\s*\{[^}]*gap:\s*6px/);
    assert.match(basinsManager, /admin-form-grid grid grid-cols-1 gap-3 sm:grid-cols-2/, "12px gap between stacked fields");
  });

  it("gives every wide table and calendar its own scroll frame instead of widening the page", () => {
    assert.match(css, /\.admin-calendar-shell\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(calendarPage, /admin-calendar-shell/);
    assert.equal((calendarPage.match(/className="admin-week-grid grid grid-cols-7/g) ?? []).length, 2, "both month grids must be frame-scoped");
    assert.equal(nakedFixedGrids(calendarPage).length, 0, "calendar grids must be frame-scoped");
    for (const source of [basinsManager, installedManager, sheetManager, teamsPage, stockPage, read("LeadsManager.tsx"), read("AdminLogsManager.tsx")]) {
      const wide = /min-w-\[(6|7|8|9)\d\dpx\]/.test(source);
      if (wide) assert.match(source, /overflow-x-auto/, "min-w table must live inside overflow-x-auto wrapper");
    }
    assert.match(css, /\.admin-app \.admin-main :where\(\.grid, \.flex, \.table, table[^)]*\)\s*\{[^}]*min-width:\s*0/);
  });

  it("enforces 44px touch targets and near-full-width dialogs only below 768px", () => {
    const mobileBlock = css.slice(css.indexOf("@media (max-width: 768px) {", css.indexOf("job 450-B")));
    assert.ok(mobileBlock.length > 0, "job 450-B mobile media block missing");
    assert.match(mobileBlock, /min-height:\s*44px/);
    assert.match(mobileBlock, /max-width:\s*calc\(100vw - 16px\)/);
    // desktop ต้องไม่โดน rule เหล่านี้ (ไม่มี min-height:44px นอก media query ของ job นี้)
    assert.doesNotMatch(css.slice(0, css.indexOf("job 450-B")), /\.admin-app \.admin-main :where\(button[^)]*\)\s*\{[^}]*min-height:\s*44px/);
  });

  it("folds secondary admin grids (stock summary, team rows) without changing desktop layout", () => {
    assert.match(stockPage, /grid grid-cols-2 gap-3 min-\[820px\]:grid-cols-4 min-\[820px\]:gap-4/);
    assert.match(teamsPage, /grid min-h-16 grid-cols-1 items-center gap-1 min-\[820px\]:grid-cols-3/);
    assert.equal(nakedFixedGrids(stockPage).length, 0);
    assert.equal(nakedFixedGrids(teamsPage).length, 0);
  });
});
