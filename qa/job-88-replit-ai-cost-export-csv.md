# ใบงาน 88 (Replit) — ปุ่มส่งออกสรุปต้นทุน AI เป็นไฟล์ CSV (Export AI Cost Summary to CSV)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Export Feature) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่ออำนวยความสะดวกให้ผู้บริหารและฝ่ายบัญชีในการจัดทำรายงานค่าใช้จ่ายประจำเดือน ในหน้าแดชบอร์ดต้นทุน AI (`/admin/ai-cost`) ต้องการเพิ่มฟังก์ชันการส่งออกข้อมูล (Export) เป็นไฟล์ CSV รองรับภาษาไทยและเปิดใน Microsoft Excel ได้อย่างถูกต้อง:

1. **เพิ่มปุ่ม `[ 📥 ส่งออกเป็น CSV ]` ใน `artifacts/knight-basins/src/admin/AiCostCenterPage.tsx`:**
   * วางปุ่มข้างๆ ปุ่มรีเฟรช (`data-testid="button-ai-cost-export-csv"`)
   * มีไอคอน `Download` สวยงาม เข้ากับธีมของหน้า
2. **ฟังก์ชันสร้างไฟล์ CSV (Client-side RFC 4180 with UTF-8 BOM):**
   * ฟังก์ชันสร้างเนื้อหา CSV ที่ใส่ `\uFEFF` (UTF-8 BOM) นำหน้า เพื่อให้ Excel บน Windows/Mac เปิดภาษาไทยได้สระไม่เพี้ยน
   * โครงสร้างตารางใน CSV สรุปข้อมูลตามช่วงเวลาที่กำลังเลือกอยู่ (`period: today/7d/30d/all`):
     - **ส่วนที่ 1 — หัวรายงาน:** ชื่องาน, ช่วงเวลาที่เลือก, วันที่สร้างรายงาน, ยอดเงินรวม (บาท), จำนวนคำขอรวม, โทเค็นรวม
     - **ส่วนที่ 2 — แจกแจงตามบริการ:** รหัสบริการ, ชื่อบริการ, จำนวนคำขอ, จำนวนโทเค็น, ต้นทุน (บาท), สถานะ
     - **ส่วนที่ 3 — แจกแจงตามโมเดล AI:** ชื่อโมเดล, จำนวนคำขอ, ต้นทุน (บาท)
   * เมื่อคลิก ให้เบราว์เซอร์ดาวน์โหลดไฟล์อัตโนมัติ ตั้งชื่อไฟล์ตามช่วงเวลาและวันที่ เช่น:
     `knight-basins-ai-cost-30d-2026-09-26.csv`
3. **ความปลอดภัยและขอบเขต:**
   * ห้ามแสดงหรือนำ API Key, Secret หรือข้อมูลส่วนตัวลูกค้าใส่ลงในไฟล์ CSV เด็ดขาด
4. **เขียน Unit Tests ใน `artifacts/knight-basins/test/ai-cost-export-csv.test.ts` (ใหม่):**
   * ทดสอบว่ามีปุ่ม data-testid="button-ai-cost-export-csv"
   * ทดสอบว่าฟังก์ชันสร้าง CSV มี Header UTF-8 BOM (`\uFEFF`)
   * ทดสอบว่าเนื้อหา CSV มีสรุปบริการทั้ง 3 เสาหลัก และโมเดลครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/AiCostCenterPage.tsx:
     - เพิ่มฟังก์ชัน exportAiCostToCsv(data, period)
     - สร้างไฟล์ CSV ที่มี UTF-8 BOM (\uFEFF) และจัดรูปแบบตาม RFC 4180
     - มีปุ่ม [ 📥 ส่งออกเป็น CSV ] data-testid="button-ai-cost-export-csv" วางข้างปุ่มรีเฟรช
     - เมื่อกด: ทริกเกอร์เบราว์เซอร์ดาวน์โหลดไฟล์ชื่อ knight-basins-ai-cost-<period>-<YYYY-MM-DD>.csv
  2. ใน artifacts/knight-basins/src/index.css:
     - สไตล์ปุ่มส่งออก CSV ให้เข้าคู่กับปุ่มรีเฟรชเดิม
  3. สร้าง artifacts/knight-basins/test/ai-cost-export-csv.test.ts (ใหม่):
     - ทดสอบปุ่ม export, การสร้าง CSV, UTF-8 BOM, และโครงสร้างคอลัมน์ภาษาไทย

SCOPE:
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/ai-cost-export-csv.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง App.tsx และ artifacts/api-server/ ทุกไฟล์
  - ห้ามใส่ Secret, API Key หรือข้อมูลส่วนตัวลูกค้าลงใน CSV
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-ai-cost-export-csv แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 404 / pass 395 / fail 2 / cancelled 3 / skipped 4
  4) เทสต์ใหม่ใน ai-cost-export-csv.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงและแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-ai-cost-export-csv (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
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
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการสร้างไฟล์ CSV, UTF-8 BOM และการดาวน์โหลด | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
