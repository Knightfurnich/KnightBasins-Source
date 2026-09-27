# ใบงาน 130 (Replit) — เพิ่มปุ่มดาวน์โหลดภาพหน้างานเป็นไฟล์ ZIP แยกตามรหัสงาน (Site Photos Batch ZIP Download UI)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Site Photos UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ชัยได้สร้าง API ฝั่งเซิร์ฟเวอร์ `GET /api/admin/site-photos/download-zip?jobCode=...` (Task 129) เสร็จสมบูรณ์และ Deploy Live แล้ว
ใบงานนี้คือการ **เพิ่มปุ่มดาวน์โหลดไฟล์ ZIP** บนหน้าจัดการภาพหน้างานช่าง (`/admin/site-photos`) เพื่อให้ทีมงานและฝ่ายขาย:
1. เมื่อค้นหาหรือกรองภาพของรหัสงานใดๆ (เช่น ค้นหา `JB26/1080`) จะมีปุ่ม **`[ 📦 ดาวน์โหลดรูปทั้งหมดเป็น ZIP ]`** แสดงขึ้นมา
2. หรือบนการ์ดภาพที่มี `jobCode` ให้มีปุ่มทางลัดดาวน์โหลด ZIP ของรหัสงานนั้นได้ทันที
3. กดคลิกเดียวระบบจะเบราว์เซอร์จะดาวน์โหลดไฟล์ `.zip` ที่บีบอัดรูปภาพหน้างานทั้งหมดของงานนั้นอย่างรวดเร็ว

**API หลังบ้านที่พร้อมใช้งาน 100%:**
* `GET /api/admin/site-photos/download-zip?jobCode=...`
* `GET /api/admin/site-photos/download-zip?leadId=...`

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/SitePhotosPage.tsx`:**
1. **เพิ่มปุ่มดาวน์โหลด ZIP ในแถบผลการค้นหา/หัวตาราง:**
   * เมื่อผู้ใช้พิมพ์ค้นหารหัสงาน หรือเลือกดูภาพที่มีรหัสงาน
   * เพิ่มปุ่ม **`[ 📦 ดาวน์โหลด ZIP ของงานนี้ ]`** มี attribute `data-testid="button-download-site-photos-zip"`
   * เมื่อคลิก: นำทางหรือทริกเกอร์ดาวน์โหลดไปยัง `/api/admin/site-photos/download-zip?jobCode=${encodeURIComponent(jobCode)}`
   * แสดง Loading state หรือ Toast ขณะเตรียมไฟล์
2. **เพิ่มปุ่มไอคอนดาวน์โหลด ZIP ด่วนบนการ์ดภาพแต่ละใบ (Quick ZIP Action):**
   * สำหรับภาพที่มี `jobCode` แสดงปุ่มไอคอนเล็กๆ `[ 📦 ]` (title: "ดาวน์โหลดรูปทั้งหมดของรหัสงานนี้เป็น ZIP")
   * มี attribute `data-testid="button-card-download-zip-${photo.id}"`
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-site-photos-zip-download-ui.test.ts` (ใหม่):**
   * ทดสอบปุ่มดาวน์โหลด ZIP แสดงผลถูกต้องเมื่อมี jobCode
   * ทดสอบ URL ลิงก์ดาวน์โหลดที่สร้างขึ้นถูกต้องตรงตามสเปก API
   * ทดสอบปุ่มดาวน์โหลดด่วนบนการ์ดภาพ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/SitePhotosPage.tsx:
     - เพิ่มปุ่มดาวน์โหลด ZIP ของรหัสงาน (data-testid="button-download-site-photos-zip")
     - เพิ่มปุ่มดาวน์โหลด ZIP ด่วนบนการ์ดภาพที่มี jobCode (data-testid="button-card-download-zip-*")
     - เชื่อมต่อกับ GET /api/admin/site-photos/download-zip?jobCode=...
  2. สร้าง artifacts/knight-basins/test/admin-site-photos-zip-download-ui.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/SitePhotosPage.tsx
  - artifacts/knight-basins/test/admin-site-photos-zip-download-ui.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้ฟังก์ชันลบ ย้ายขั้นตอน หรือ Universal Search เดิมเสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-site-photos-zip-download-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 529 / pass 507 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-site-photos-zip-download-ui.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-site-photos-zip-download-ui (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ฟังก์ชันลบ/ย้าย/ค้นหาเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
