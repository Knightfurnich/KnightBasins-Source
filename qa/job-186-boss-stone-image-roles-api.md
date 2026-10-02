# ใบงาน 186 (บอส / ชัย Backend) — Stone Image Roles API & Data Contract (เพิ่ม 3 คอลัมน์ภาพหิน)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ บอส / ชัย (Backend API) · เริ่มได้ทันที

**ที่มาและความต้องการ:**
พัฒนาระบบภาพหินสังเคราะห์ทั้งสองประเภท (หินพร้อมติดตั้ง `installed_stone_prices` และหินขายแผ่น `sheet_stone_prices`) ให้รองรับการจัดการภาพ 3 บทบาทชัดเจน (เหมือนกับอ่างล้างหน้า):
1. ภาพแรก (`imageUrl`): แสดงหน้าร้าน /stone และใน 2D Studio
2. ภาพที่สอง (`quoteImageUrl`): แสดงในใบเสนอราคาอย่างเป็นทางการ
3. ภาพที่สาม (`slabImageUrl`): แสดงภาพถ่ายเต็มแผ่น (Full Slab)
และรองรับภาพแกลเลอรีเพิ่มเติม (`galleryImageUrls text[]`)

เดวิดได้เตรียมไฟล์ Migration `deploy/hostinger/migrations/019_stone_image_roles.sql` และอัปเดต Schema ใน `lib/db/src/schema/index.ts` ไว้แล้ว
งานของใบงานนี้คือปรับปรุง Backend API (`admin-router.ts`) ให้รับ-ส่ง 3 ฟิลด์ใหม่นี้อย่างสมบูรณ์

**รายละเอียดสิ่งที่ต้องทำ (2 ไฟล์):**
1. `artifacts/api-server/src/routes/admin-router.ts`
   - ปรับ Zod schema ของ `installedStonePriceSchema` และ `sheetStonePriceSchema`:
     - เพิ่ม `galleryImageUrls: z.array(z.string()).optional()` (หรือ default เป็น array ว่าง)
     - เพิ่ม `quoteImageUrl: z.string().nullable().optional()`
     - เพิ่ม `slabImageUrl: z.string().nullable().optional()`
   - ใน endpoint:
     - `POST /api/admin/installed-stones` และ `PATCH /api/admin/installed-stones/:id`
     - `POST /api/admin/sheet-stones` และ `PATCH /api/admin/sheet-stones/:id`
     ให้บันทึกและส่งคืนฟิลด์ `galleryImageUrls`, `quoteImageUrl`, `slabImageUrl` ครบถ้วน
   - ใน endpoint ทำความสะอาดรูปภาพที่ไม่ได้ใช้ `GET /api/admin/media/cleanup` (บรรทัด ~740):
     - รวมฟิลด์ `galleryImageUrls`, `quoteImageUrl`, `slabImageUrl` ของหินทั้งสองตารางเข้าในลิสต์ภาพที่กำลังใช้งานด้วย เพื่อไม่ให้ถูกลบโดยไม่ได้ตั้งใจ
2. `artifacts/api-server/test/admin-stones-api.test.ts` (หรือไฟล์เทสต์ที่เกี่ยวข้อง)
   - เพิ่มเทสต์เคสทดสอบสร้างและแก้ไขข้อมูลหินพร้อมระบุ `galleryImageUrls`, `quoteImageUrl`, `slabImageUrl`
   - ตรวจสอบว่า API ส่งคืนค่าทั้ง 3 ฟิลด์ถูกต้องครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มฟิลด์ galleryImageUrls, quoteImageUrl, slabImageUrl ใน Zod schema ของหินทั้งสองประเภทใน admin-router.ts
  2. รองรับ CRUD ทั้ง 3 ฟิลด์ใน installed-stones และ sheet-stones endpoints
  3. เพิ่ม 3 ฟิลด์เข้าในรายการ keep list ของ media cleanup endpoint
  4. เพิ่ม Unit Tests ยืนยันพฤติกรรมใน api-server

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-stones-api.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (ฝั่งหน้าจอจะทำในใบงาน 187)
  - ห้ามลบฟิลด์ imageUrl เดิม ต้องใช้เป็นภาพหลักหน้าร้านตามเดิม
  - ห้ามแตะต้องตาราง basin_prices
  - ทำงานผ่าน branch: feat/chai-stone-image-roles-api แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-stone-image-roles-api ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/api-server
     baseline อ้างอิง: tests 741 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น
  4) เทสต์ใหม่เรื่อง stone image roles ผ่านครบ 100%

OUTPUT:
  - branch: feat/chai-stone-image-roles-api (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ตกเกิน 9 ข้อ (baseline เดิม)
  - ถ้าต้องแก้ไฟล์ UI artifacts/knight-basins/
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง และไม่แตะ UI | ✅ ผ่าน |
| 11 | มอบอำนาจขอบเขต Backend แยกจาก UI ชัดเจน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
