# ใบงาน 44 (ชัย) — ระบบฐานข้อมูลและ API ภาพหน้างานช่าง (Site Photos Backend — Migration 014)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของเห็นพ้องให้มีระบบแกลเลอรีภาพหน้างาน (`/admin/site-photos`) ในหน้าแอดมิน เพื่อให้ทีมขายและช่างสามารถเปิดดูภาพหน้างานจริงที่ช่างส่งเข้ามาใน LINE (แยกตามรหัสงาน, ทีมช่าง, วันที่ และประเภทงาน) ได้สะดวก

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  พัฒนาระบบฐานข้อมูลและ API สำหรับจัดเก็บและค้นหาภาพหน้างาน:
  1. สร้างตาราง `site_photos` (migration 014) เก็บข้อมูลภาพหน้างาน:
     - id, leadId, jobCode, imageUrl, description, stage, senderName, capturedAt, createdAt
  2. เพิ่ม Endpoint แอดมิน:
     - `GET /api/admin/site-photos`: ค้นหาและดึงรายการภาพหน้างาน (รองรับตัวกรอง jobCode, leadId, stage, limit)
     - `POST /api/admin/site-photos`: บันทึกข้อมูลภาพหน้างานใหม่
     - `PATCH /api/admin/site-photos/:id`: แก้ไขคำบรรยาย, stage หรือผูก leadId เข้ากับภาพ
  3. เขียน Unit tests ใน admin-site-photos.test.ts ครอบคลุมการเพิ่ม, ดึงข้อมูล, กรองข้อมูล และอัปเดต

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  2. /opt/data/cache/kbsrc/deploy/hostinger/migrations/014_site_photos.sql (ใหม่)
  3. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  4. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  5. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-site-photos-api แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 285 / pass 281 / fail 4 (ห้ามมี fail ใหม่)
  5) เทสต์ใหม่ใน admin-site-photos.test.ts ยืนยัน:
     - GET /admin/site-photos ดึงรายการได้ถูกต้อง
     - รองรับตัวกรอง jobCode และ stage
     - PATCH /admin/site-photos/:id ผูก leadId เข้ากับภาพสำเร็จ

OUTPUT:
  - branch: feat/chai-site-photos-api (เปิด PR เข้า main รอตรวจ)
  - 5 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API fail > 4)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน lib/db/src/schema/index.ts:
     - ประกาศตาราง `sitePhotos = pgTable("site_photos", { ... })`:
       - `id`: serial("id").primaryKey()
       - `leadId`: integer("lead_id")
       - `jobCode`: varchar("job_code", { length: 32 })
       - `imageUrl`: text("image_url").notNull()
       - `description`: text("description")
       - `stage`: varchar("stage", { length: 32 }).notNull().default("installation")
       - `senderName`: varchar("sender_name", { length: 64 })
       - `capturedAt`: timestamp("captured_at", { withTimezone: true })
       - `createdAt`: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  2. ใน deploy/hostinger/migrations/014_site_photos.sql:
     - สร้างตาราง site_photos พร้อม index บน (job_code) และ (lead_id)
  3. ค่า stage มาตรฐาน:
     - `survey`: "วัดหน้างาน"
     - `installation`: "งานติดตั้ง"
     - `service`: "เก็บงาน/เซอร์วิส"
     - `completed`: "ติดตั้งเสร็จสมบูรณ์/ส่งมอบ"
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบฐานข้อมูลและ API ภาพหน้างานช่าง |
| 2 | GOAL วัดได้ | ✅ ตาราง DB + API GET/POST/PATCH + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 5 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 285/281/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-site-photos-api |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 285 / pass 281 / fail 4 |
| 9 | CONTRACT ระบุ schema และ stage ชัดเจน | ✅ ระบุคอลัมน์และ 4 ค่า stage |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
