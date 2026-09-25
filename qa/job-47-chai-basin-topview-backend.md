# ใบงาน 47 (ชัย) — ระบบปักหมุดภาพ Top View สำหรับอ่างในฐานข้อมูลและ API (Migration 015)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เพื่อรองรับการที่คุณนพกำลังเตรียมภาพถ่าย/ภาพกราฟิก Top View (มองจากด้านบนตรง ๆ) ของอ่างทั้ง 30 รุ่น และจะอัปโหลดผ่านหน้าแอดมิน `/admin/basins` เราต้องเพิ่มฟิลด์ `top_view_image_url` ในฐานข้อมูลและ API เพื่อให้อ่างแต่ละรุ่นสามารถเก็บและส่งภาพ Top View เฉพาะของรุ่นนั้นไปยัง 2D Studio ได้

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มฟิลด์และ API รองรับภาพ Top View ของอ่างแต่ละรุ่น:
  1. เพิ่มคอลัมน์ `top_view_image_url` ในตาราง `basin_prices` (migration 015)
  2. อัปเดต `lib/db/src/schema/index.ts` และ `lib/api-spec/openapi.yaml`:
     - เพิ่ม `topViewImageUrl: text("top_view_image_url")` ใน `basinPrices`
     - เพิ่ม `topViewImageUrl` ใน Schema `BasinPrice`, `BasinProduct` และ `BasinPriceUpdateInput`
  3. อัปเดต Endpoint ใน `artifacts/api-server/`:
     - `GET /api/basins` และ `GET /api/admin/basins`: ส่งคืนฟิลด์ `topViewImageUrl`
     - `PATCH /api/admin/basins/:sku`: รองรับการอัปเดตฟิลด์ `topViewImageUrl`
  4. รัน `pnpm --filter @workspace/api-spec run codegen`
  5. เขียน Unit tests ใน `admin-basins-topview.test.ts` ครอบคลุมการอ่านและอัปเดต `topViewImageUrl`

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  2. /opt/data/cache/kbsrc/deploy/hostinger/migrations/015_basin_top_view_image.sql (ใหม่)
  3. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  4. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  5. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-basins-topview.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-basin-topview-backend แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 306 / pass 302 / fail 4 (ห้ามมี fail ใหม่)
  5) เทสต์ใหม่ใน admin-basins-topview.test.ts ยืนยัน:
     - PATCH /admin/basins/:sku อัปเดต topViewImageUrl สำเร็จ
     - GET /admin/basins ส่งคืน topViewImageUrl ถูกต้อง

OUTPUT:
  - branch: feat/chai-basin-topview-backend (เปิด PR เข้า main รอตรวจ)
  - 5 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API fail > 4)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน lib/db/src/schema/index.ts (ตาราง basinPrices):
     - `topViewImageUrl: text("top_view_image_url")`
  2. ใน deploy/hostinger/migrations/015_basin_top_view_image.sql:
     ```sql
     ALTER TABLE public.basin_prices
     ADD COLUMN IF NOT EXISTS top_view_image_url text;
     ```
  3. ใน openapi.yaml:
     - `topViewImageUrl`: type string, nullable: true
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ฟิลด์และ API ภาพ Top View ของอ่าง (Migration 015) |
| 2 | GOAL วัดได้ | ✅ คอลัมน์ DB + API GET/PATCH + codegen + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 5 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 306/302/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-basin-topview-backend |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 4 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 306 / pass 302 / fail 4 |
| 9 | CONTRACT ระบุชื่อคอลัมน์และ SQL ชัด | ✅ top_view_image_url และ migration SQL ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
