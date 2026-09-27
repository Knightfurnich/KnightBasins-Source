# ใบงาน 129 (ชัย) — เพิ่ม API ดาวน์โหลดภาพหน้างานเป็นไฟล์ ZIP แยกตามรหัสงาน (Batch Download Site Photos ZIP API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Admin API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพอนุมัติตัวเลือกที่ 3: เวลาช่างหรือทีมส่งมอบงานต้องการรวมรูปหน้างานของงานนั้นๆ (เช่น รหัสงาน `JB26/1080` หรือตาม `leadId`) ส่งให้ลูกค้าตรวจงานหรือส่งมอบ 
ปัจจุบันต้องดาวน์โหลดทีละรูป ชัยจะรับหน้าที่สร้าง Endpoint สำหรับบีบอัดรูปภาพหน้างานทั้งหมดของงานนั้นเป็นไฟล์ `.zip` ให้คลิกเดียวดาวน์โหลดได้ทันที

**รายละเอียดงานใน `artifacts/api-server/src/routes/admin-router.ts` (หรือแยกใน `src/lib/site-photos-zip.ts`):**
1. **สร้าง Endpoint `GET /api/admin/site-photos/download-zip`:**
   * บังคับสิทธิ์แอดมิน: `requireAdminPermission("leads")`
   * รับพารามิเตอร์ `jobCode` (string) หรือ `leadId` (number):
     - หากไม่ระบุทั้งสองอย่าง ให้ตอบ 400 `jobCode or leadId is required`
   * ดึงรายการภาพทั้งหมดที่ตรงกับเงื่อนไขจากตาราง `sitePhotos`
     - หากไม่พบภาพใดๆ ตอบ 404 `No site photos found for this job`
   * บีบอัดรูปภาพจริงจากดิสก์เป็นไฟล์ ZIP:
     - ใช้ไลบรารีสตรีมมิ่งบีบอัดมาตรฐาน (เช่น `archiver` หรือ Node.js zlib/stream) ที่ไม่กินหน่วยความจำเซิร์ฟเวอร์
     - ตั้งชื่อไฟล์ใน ZIP ให้อ่านง่าย เช่น `[stage]_[index]_[filename].webp`
     - ป้องกัน Path Traversal: ตรวจสอบว่าไฟล์รูปภาพอยู่ใน `UPLOAD_DIR` ก่อนอ่านเข้า ZIP เสมอ หากไฟล์ไหนหาไม่เจอให้ข้ามไป ไม่ทำให้ทั้ง ZIP ล่ม
   * ส่งสตรีมไฟล์ดาวน์โหลดกลับมาที่เบราว์เซอร์:
     - Header: `Content-Type: application/zip`
     - Header: `Content-Disposition: attachment; filename="site-photos-[jobCode].zip"`
2. **สร้าง Automated Unit Tests ใน `artifacts/api-server/test/admin-site-photos-zip.test.ts` (ใหม่):**
   * ทดสอบการปฏิเสธเมื่อไม่มีสิทธิ์ (401)
   * ทดสอบการปฏิเสธเมื่อไม่มีพารามิเตอร์ (400)
   * ทดสอบกรณีไม่พบรูปภาพ (404)
   * ทดสอบการสร้างและสตรีมไฟล์ ZIP สำเร็จพร้อมตรวจ header ที่ถูกต้อง
   * ทดสอบป้องกัน Path Traversal

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-site-photos-zip แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง GET /api/admin/site-photos/download-zip ใน artifacts/api-server/src/routes/admin-router.ts
     - รับ jobCode หรือ leadId ดึงภาพทั้งหมดแล้วสตรีมบีบอัดเป็น .zip
     - ป้องกัน path traversal และมี header attachment ถูกต้อง
  2. สร้าง test/admin-site-photos-zip.test.ts (ใหม่) ครอบคลุม auth, validation, zip stream, path safety

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos-zip.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามเขียนไฟล์ zip ค้างทิ้งไว้บนดิสก์โดยไม่ลบ (ให้ใช้ stream หรือ safe temp)
  - ห้ามอ่านไฟล์นอก uploads/ ป้องกัน path traversal เด็ดขาด
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-site-photos-zip

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-site-photos-zip
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/admin-site-photos-zip.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 610 / pass 604 / fail 6 (pre-existing sandbox) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-site-photos-zip (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline 6 ข้อเดิม
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์ schema ฐานข้อมูลเดิม | ✅ ผ่าน |
| 11 | ป้องกัน path traversal และจัดการหน่วยความจำสตรีม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
