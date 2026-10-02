import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const component = readFileSync(new URL("../src/admin/StoneImageManagerField.tsx", import.meta.url), "utf8");
const sheetManager = readFileSync(new URL("../src/admin/SheetStonesManager.tsx", import.meta.url), "utf8");
const installedManager = readFileSync(new URL("../src/admin/InstalledStonesManager.tsx", import.meta.url), "utf8");

describe("StoneImageManagerField source", () => {
  it("exposes all three stone image roles and the full-slab action", () => {
    assert.ok(component.includes("ภาพแสดงหน้าร้าน"));
    assert.ok(component.includes("ภาพใบเสนอราคา"));
    assert.ok(component.includes("ภาพแสดงเต็มแผ่น"));
    assert.ok(component.includes("✓ ตั้งเป็นภาพเต็มแผ่น"));
    assert.ok(component.includes("ภาพถ่ายลายหินเต็มแผ่นใหญ่ สำหรับประกอบการตัดสินใจและดูลายก่อนตัดชิ้นงาน"));
  });

  it("mounts the manager in both sheet and installed stone forms", () => {
    assert.match(sheetManager, /<StoneImageManagerField\s/);
    assert.match(installedManager, /<StoneImageManagerField\s/);
  });
});