# ใบงาน 127 (Replit) — ยกเครื่องตัวกรองภาพหน้างาน: ช่วงเวลายอดนิยม + ปี พ.ศ. + ค้นหาอัจฉริยะ (Site Photos Smart Search & Flexible Time Filter)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Site Photos UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพชี้จุดบกพร่องของตัวกรองเดือนเดิมในหน้าจัดการภาพหน้างานช่าง (`/admin/site-photos`):
1. **ดรอปดาวน์ "ทุกเดือน" แบบเดิมไม่ยืดหยุ่น:** เมื่อใช้งานข้ามปี รายการจะยาวเป็นหางว่าวและเลือกยาก
2. **ต้องการระบบค้นหาที่ยืดหยุ่น:** สามารถค้นหาได้ทั้งรหัสงาน, ชื่องาน/สถานที่, และชื่อช่าง
เดวิดจึงนำ **ไอเดีย 1 (ช่วงเวลายอดนิยม + ดรอปดาวน์ปี พ.ศ.)** ผสานกับ **ไอเดีย 3 (Universal Search)** มายกระดับหน้าจอนี้

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/SitePhotosPage.tsx`:**
1. **เปลี่ยนตัวกรองเดือนเดิมเป็น "ช่วงเวลายอดนิยม + ตัวเลือกปี พ.ศ.":**
   * **ปุ่มช่วงเวลาลัด (Quick Ranges):**
     - `ทั้งหมด` (all)
     - `30 วันล่าสุด` (30d) — กรองภาพที่ถ่ายย้อนหลังไม่เกิน 30 วัน
     - `ปีปัจจุบัน / ปี พ.ศ.` — มีดรอปดาวน์เลือกปี พ.ศ. (เช่น "พ.ศ. 2569", "พ.ศ. 2568" ดึงจากปีที่มีข้อมูลจริง)
     - เมื่อเลือกปี: สามารถเลือกดูภาพทั้งหมดของปีนั้น หรือกรองเฉพาะไตรมาส/เดือนของปีนั้นได้ ไม่ปนข้ามปี
2. **ช่องค้นหาอัจฉริยะ (Universal Search):**
   * ขยายช่องค้นหา `input-search-job-code` เดิม ให้กลายเป็น **Universal Search** (`data-testid="input-site-photos-search"`)
   * พิมพ์ค้นหาครอบคลุม:
     - รหัสงาน (jobCode เช่น `JB26/1080`, `26/1080`)
     - คำอธิบายงาน / ชื่อลูกค้า / สถานที่ (description เช่น `ราชพฤกษ์`, `สุขุมวิท`, `คุณสมชาย`)
     - ชื่อช่าง / ทีมผู้ส่ง (senderName เช่น `ช่างก้อง`, `ทีม ก`)
   * กรองแบบ Case-insensitive และตัดช่องว่าง
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-site-photos-smart-search.test.ts` (ใหม่):**
   * ทดสอบการกรองช่วงเวลายอดนิยม (30 วันล่าสุด, แยกตามปี พ.ศ.)
   * ทดสอบการค้นหาอัจฉริยะ (ค้นด้วยรหัสงาน, คำอธิบาย/สถานที่, และชื่อช่าง)
   * ทดสอบการทำงานร่วมกันระหว่าง Universal Search + Stage Filter + Time Filter

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/SitePhotosPage.tsx:
     - เปลี่ยนดรอปดาวน์เดือนเดิมเป็นระบบช่วงเวลายอดนิยม (30 วันล่าสุด / ปี พ.ศ.)
     - ขยายช่องค้นหาเป็น Universal Search (รหัสงาน, คำอธิบายสถานที่, ชื่อช่าง)
  2. สร้าง artifacts/knight-basins/test/admin-site-photos-smart-search.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/SitePhotosPage.tsx
  - artifacts/knight-basins/test/admin-site-photos-smart-search.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้ฟังก์ชันลบภาพ ย้ายขั้นตอน หรือแก้ไขคำอธิบายเดิมเสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-site-photos-smart-search แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 519 / pass 497 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-site-photos-smart-search.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-site-photos-smart-search (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ฟังก์ชันลบ/ย้าย/แก้คำอธิบายเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
