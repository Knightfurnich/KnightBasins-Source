/**
 * โครงร่างโดยเดวิด (4 ต.ค. 69) — ใบงาน 266 (บอย): เส้นทาง API จับคู่สีหินจากภาพ
 *
 * TODO(บอย): ทำตามใบงาน qa/job-266-freebuff-stone-match-api-and-admin-page.md
 *   - POST /api/admin/stone-match
 *   - requireAdminPermission("installed-stones", "view") + createRateLimiter({ name: "admin-stone-match", max: 10, windowMs: 60_000 })
 *   - ภาพ ≤ 8 MB · jpeg/png/webp · ไม่มี credentials → 200 + ข้อความไทย · ไม่มีสิทธิ์ → 401/403 · ไม่ใช่ภาพ → 400
 *   - เรียก suggestStonesForPhoto() จาก ../lib/stone-matcher.ts (ห้ามแก้ไฟล์นั้น)
 *   - ยังไม่ต้องลงทะเบียนใน routes/index.ts จนกว่าจะทำเสร็จ (แล้วลงทะเบียน 1 บรรทัดตามใบงาน)
 */
import { Router } from "express";

export const stoneMatchRouter = Router();
