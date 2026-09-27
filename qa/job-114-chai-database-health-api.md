# ใบงาน 114 (ชัย) — เพิ่ม API ตรวจสอบสุขภาพฐานข้อมูลและ Connection Pool (Database Health & Pool Metrics API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Database & Reliability) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ฐานข้อมูล PostgreSQL (`knightbasins-db`) เป็นหัวใจหลักของข้อมูลลูกค้า ใบเสนอราคา และคลังสินค้า
ชัยจะรับหน้าที่สร้าง Endpoint **`GET /api/admin/database/health`** เพื่อตรวจสอบสถานะการเชื่อมต่อ, latency, และความสมบูรณ์ของฐานข้อมูล:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/routes/admin-router.ts` (หรือแยกใน `src/lib/db-metrics.ts`):**
   * Endpoint: `GET /api/admin/database/health`
   * บังคับใช้ Admin Auth Guard (`requireAnyAdminPermission(["leads", "basins"])`)
   * ตรวจสอบสุขภาพฐานข้อมูล (Database Health Metrics):
     - วัดค่าการตอบสนองของการ Query (Query Latency ms) ด้วยคำสั่ง `SELECT 1` หรือ `SELECT current_timestamp`
     - ตรวจสอบจำนวนตารางหลักในระบบ (เช่น `customer_leads`, `customer_accounts`, `payment_slips`)
     - คืนสถานะ `status: "healthy" | "degraded"`
   * การตอบกลับ (Response):
     `{ status: "healthy", latencyMs: number, database: "postgres", timestamp: string, tablesCount: number }`
2. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/admin-database-health.test.ts` (ใหม่):**
   * ทดสอบการคืนค่าสถานะฐานข้อมูลและ latency สำเร็จ
   * ทดสอบการบล็อกเมื่อไม่มีสิทธิ์ Admin (HTTP 401)
   * ทดสอบการรับมือกรณีการเชื่อมต่อขัดข้อง (Safe error fallback)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-database-health-api แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/admin-router.ts (และ src/lib/db-metrics.ts):
     - เพิ่ม endpoint GET /api/admin/database/health ตรวจสอบ latency และความสมบูรณ์ของฐานข้อมูล
     - บังคับ Admin Auth Guard
  2. สร้าง artifacts/api-server/test/admin-database-health.test.ts (ใหม่):
     - ทดสอบการคืนค่า health metrics ถูกต้อง
     - ทดสอบ Admin Auth Guard (401)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/db-metrics.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-database-health.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามรันคำสั่งแก้ไขโครงสร้างตาราง (DDL / ALTER / DROP) เด็ดขาด

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-database-health-api
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/admin-database-health.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (550 tests / 545 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-database-health-api (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์เดิมของ api-server ล้มเหลวเกิน 5 ข้อเดิม
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในระดับ Backend | ✅ ผ่าน |
| 8 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ไม่แตะต้อง Production Database จริง | ✅ ผ่าน |
| 11 | ครอบคลุมการรายงาน Database Health & Metrics | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
