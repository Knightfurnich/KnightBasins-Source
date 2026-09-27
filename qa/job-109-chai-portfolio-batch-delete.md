# ใบงาน 109 (ชัย) — เพิ่ม API สำหรับลบรูปภาพคลังผลงานพร้อมกันหลายรายการ (Portfolio Batch Delete API)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Portfolio API & Batch Operations) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าจัดการคลังผลงาน (`/admin/portfolio`) เมื่อมีรูปภาพที่ซ้ำหรือรูปเก่าที่ต้องการเคลียร์ทิ้ง การลบทีละรูปจะเสียเวลามาก
ชัยจะรับหน้าที่เพิ่ม endpoint **`POST /api/admin/portfolio/batch-delete`** เพื่อรองรับการลบรูปภาพทีละหลายๆ รายการพร้อมกันในคำสั่งเดียว:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/routes/portfolio.ts`:**
   * Endpoint: `POST /api/admin/portfolio/batch-delete` (ใช้ POST หรือ DELETE พร้อม body)
   * บังคับใช้ Admin Guard: `createAdminAuthMiddleware()` และ `requireAnyAdminPermission(["leads", "basins"])`
   * ตรวจสอบ Body Payload:
     - รับ `{ ids: string[] }` โดยจำกัดจำนวนสูงสุดไม่เกิน **50 รายการต่อครั้ง** (`max 50 ids`) เพื่อป้องกัน DoS
     - หาก `ids` ว่างเปล่า หรือไม่ใช่ array ของ string ให้คืน HTTP 400 Bad Request
   * กระบวนการลบแบบ Atomic และ Safe:
     - กรองหาเฉพาะ `id` ที่มีอยู่จริงใน `catalog.json`
     - ลบไฟล์รูปจริงออกจากดิสก์ (ใช้ `resolvePortfolioFilePath` เดิมของ Task 102 เพื่อป้องกัน Path Traversal อย่างเคร่งครัด)
     - อัปเดต `catalog.json` และลบ entry ใน `visibility.json` ออกในคราวเดียว
   * การตอบกลับ (Response):
     - คืน HTTP 200 พร้อมสรุปผล: `{ deletedIds: string[], notFoundIds: string[], filesRemovedCount: number }`
     - มี Audit Log บันทึกว่าแอดมินคนไหนทำการลบรูปชุดใดบ้าง
2. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/portfolio-batch-delete.test.ts` (ใหม่):**
   * ทดสอบลบ 3 รูปพร้อมกัน ➔ ไฟล์ถูกลบจริงจากดิสก์, รายการหายจาก catalog, คืน deletedIds ครบ
   * ทดสอบส่ง id ที่มีจริงผสมกับ id ที่ไม่มีจริง ➔ ลบเฉพาะตัวที่มีจริง และรายงาน notFoundIds ถูกต้อง
   * ทดสอบป้องกัน Path Traversal ใน batch delete (ถ้ามี id แปลกปลอมพยายามลบไฟล์ระบบ ต้องถูกปฏิเสธ)
   * ทดสอบปฏิเสธ request ที่ไม่มี admin session (HTTP 401)
   * ทดสอบจำกัดโควตาไม่เกิน 50 รายการ (ถ้าส่งมา 51 รายการต้องตอบ 400)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-batch-delete แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/portfolio.ts:
     - เพิ่ม endpoint POST /admin/portfolio/batch-delete (รับ { ids: string[] }, สูงสุด 50 ids)
     - ลบรายการออกจาก catalog.json, ลบไฟล์จริงออกจากดิสก์อย่างปลอดภัย, และลบ visibility entry
     - บังคับ Admin Guard และทำ Audit Log
  2. สร้าง artifacts/api-server/test/portfolio-batch-delete.test.ts (ใหม่):
     - ทดสอบ batch delete หลายรายการสำเร็จ
     - ทดสอบ id ปน id ที่ไม่มีจริง
     - ทดสอบป้องกัน Path Traversal
     - ทดสอบจำกัดไม่เกิน 50 ids (HTTP 400)
     - ทดสอบ Admin Auth Guard (HTTP 401)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/portfolio-batch-delete.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามลบไฟล์นอก uploads/portfolio/ เด็ดขาด (ต้องตรวจ Path Traversal ทุก id ใน batch)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-portfolio-batch-delete
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/portfolio-batch-delete.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (545 tests / 540 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-portfolio-batch-delete (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
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
| 11 | ครอบคลุมการป้องกัน Path Traversal และจำกัดไม่เกิน 50 รายการ | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
