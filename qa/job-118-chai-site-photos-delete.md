# ใบงาน 118 (ชัย) — เพิ่ม API ลบภาพหน้างานช่าง (Delete Site Photo API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Admin API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าจัดการภาพหน้างานช่าง (`/admin/site-photos`) มีภาพที่ไม่ถูกต้อง หรือภาพซ้ำ/ขยะ ที่แอดมินต้องการลบทิ้งออกจากระบบ
ปัจจุบันมี `GET /api/admin/site-photos` และ `PATCH /api/admin/site-photos/:id` แต่ยังไม่มี Endpoint สำหรับลบภาพ

**รายละเอียดงาน:**
1. **เพิ่ม Endpoint `DELETE /api/admin/site-photos/:id` ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   * ตรวจสิทธิ์แอดมิน: `requireAdminPermission("leads", "edit")`
   * ตรวจสอบว่ามี record ภาพในตาราง `sitePhotos` หรือไม่ หากไม่มีตอบ 404
   * ลบไฟล์ภาพจริงออกจากดิสก์อย่างปลอดภัย:
     - ดึง `imageUrl` ของภาพ ถ้าเป็น relative path หรือชี้ในไดเรกทอรีอัปโหลด ให้ลบไฟล์จริงออกจากดิสก์ (ใช้ safe path resolve ป้องกัน path traversal)
     - หากลบไฟล์ไม่สำเร็จหรือหาไฟล์ไม่เจอ ให้ catch error และยังคงลบ record ออกจากฐานข้อมูลได้ (ไม่พัง 500)
   * ลบแถวข้อมูลออกจากตาราง `sitePhotos`
   * ตอบกลับ HTTP 200 `{ "success": true, "deletedId": id }` หรือ 204 No Content
2. **สร้าง Automated Unit Tests ใน `artifacts/api-server/test/admin-site-photos-delete.test.ts` (ใหม่):**
   * ทดสอบ DELETE โดยไม่มี admin auth ตอบ 401
   * ทดสอบ DELETE ภาพที่ไม่มีอยู่จริง ตอบ 404
   * ทดสอบ DELETE ภาพสำเร็จ ลบ record ออกจาก DB และตอบกลับ success
   * ทดสอบป้องกัน Path Traversal ใน id

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-site-photos-delete แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. เพิ่ม DELETE /api/admin/site-photos/:id ใน artifacts/api-server/src/routes/admin-router.ts
     - บังคับสิทธิ์ requireAdminPermission("leads", "edit")
     - ลบไฟล์จริงอย่างปลอดภัย + ลบ record ออกจากตาราง sitePhotos
  2. สร้าง test/admin-site-photos-delete.test.ts (ใหม่) ครอบคลุม auth, not found, delete success, id validation

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos-delete.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องตาราง database schema อื่นนอกเหนือจาก sitePhotos
  - ห้ามลบไฟล์นอก uploads/ ป้องกัน path traversal เด็ดขาด
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-site-photos-delete
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/admin-site-photos-delete.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 552 / pass 547 / fail 5 (pre-existing) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-site-photos-delete (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline (5 pre-existing)
  - ถ้าแตะต้องไฟล์นอก SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ระบุไฟล์ชัดเจนพร้อมเครื่องหมาย (ใหม่) | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์ schema ฐานข้อมูลเดิม | ✅ ผ่าน |
| 11 | ป้องกัน path traversal | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
