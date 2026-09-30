# ใบงาน 145 (Replit) — บันทึกประวัติรุ่น Version 1.1.0 ในหน้า /updates (Logistics & Financial Safety Suite Release)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Changelog Maintenance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เราเพิ่งปิดกล่องที่ 3 และปล่อย Release **Version 1.1.0 (Logistics & Financial Safety Suite)** อย่างเป็นทางการ
งานนี้คือการอัปเดตหน้าประวัติรุ่นระบบ `/updates` (`src/pages/UpdatesPage.tsx`) เพื่อเพิ่มการ์ดบันทึกความสำเร็จของ **v1.1.0** ขึ้นไว้บนสุดของไทม์ไลน์ เคียงคู่กับรุ่นเดิม

**เนื้อหาของ Version 1.1.0 ที่ต้องเพิ่ม (บนสุดของไทม์ไลน์):**
* **Version:** `v1.1.0`
* **Badge:** `Logistics & Financial Safety Suite` (รุ่นล่าสุด)
* **Date:** `30 กันยายน 2569` (dateTime: `2026-09-30`)
* **Title:** `ระบบพิกัดหน้างานอัจฉริยะ และล็อกความปลอดภัยทางการเงิน`
* **Highlights (4 รายการ):**
  1. 🧭 **Google Maps Smart Navigation:** ถอดรหัสพิกัดหน้างานอัตโนมัติจากทุกลิงก์ Maps พร้อมปุ่มนำทางแตะครั้งเดียวบนมือถือช่าง
  2. 👥 **Smart Duplicate Detection:** ระบบตรวจจับประวัติลูกค้าและเบอร์โทรซ้ำซ้อนอัตโนมัติ พร้อมแสดงประวัติงานเดิมทันที
  3. 📲 **Technician LINE Job Card:** ปุ่มสร้างการ์ดงานช่างส่งเข้า LINE คัดลอกสรุปงานพร้อมลิงก์แผนที่นำทางในคลิกเดียว
  4. 🔒 **Financial Safety Lock:** ถอดแบบกฎเหล็ก KRAKEN ล็อกความปลอดภัยปิดปุ่มลบงานที่มีสลิปการเงินผูกอยู่ 100%

**งานที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/pages/UpdatesPage.tsx`:
   - เพิ่มออบเจกต์ของ `v1.1.0` ไว้เป็นรายการแรกสุดในอาเรย์ไทม์ไลน์
   - ย้าย badge `รุ่นล่าสุด` มาอยู่ที่ `v1.1.0`
2. อัปเดต Unit Test ใน `artifacts/knight-basins/test/updates-page.test.ts`:
   - ตรวจว่ามีข้อความ `v1.1.0` และรายละเอียดหัวข้อของรุ่นใหม่ครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. เพิ่มประวัติรุ่น v1.1.0 บนสุดของไทม์ไลน์ใน artifacts/knight-basins/src/pages/UpdatesPage.tsx
  2. อัปเดต artifacts/knight-basins/test/updates-page.test.ts ให้ตรวจจับ v1.1.0

SCOPE:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/test/updates-page.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง App.tsx, StudioPage.tsx และ WorkshopProductionSheet.tsx
  - ห้ามลบรุ่นเดิม (v1.0.0, v0.9.0, v0.1.0) ออกจากไทม์ไลน์
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-updates-v110 แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 586 / pass 564 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใน test/updates-page.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-updates-v110 (เปิด PR เข้า main)
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ประวัติรุ่นเดิมทั้งหมด | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
