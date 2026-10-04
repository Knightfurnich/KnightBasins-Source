/**
 * โครงร่างเทสต์โดยเดวิด (4 ต.ค. 69) — ใบงาน 266 (บอย)
 * TODO(บอย): เพิ่มเคสตามใบงาน (ไม่มีสิทธิ์ · ไฟล์ไม่ใช่ภาพ · ใหญ่เกิน 8 MB · matcher ปิด · สำเร็จด้วย mock)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { stoneMatchRouter } from "../src/routes/stone-match.ts";

test("stone-match route module is wired to the shared helper surface", () => {
  assert.equal(typeof stoneMatchRouter, "function");
});
