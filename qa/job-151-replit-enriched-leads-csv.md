# ใบงาน 151 (Replit) — ปรับปรุงการส่งออก Leads เป็น CSV ให้มีพิกัด Maps และสถานะสลิปการเงิน (Enriched Leads CSV Export)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Leads CSV Maintenance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในกล่องที่ 3 เราได้เพิ่มระบบพิกัดหน้างาน (`site_maps_url`, `site_lat`, `site_lng`) และระบบล็อกความปลอดภัยการเงิน (`has_matched_slip`, `payment_slip_count`) เข้าสู่ตาราง Lead เรียบร้อยแล้ว
แต่ฟังก์ชันส่งออก Excel/CSV สำหรับผู้บริหารและฝ่ายบัญชี (`exportLeadsToCsv` ใน `leads-utils.ts`) ยังเป็นฟอร์แมตเดิมที่ไม่มีคอลัมน์สำคัญเหล่านี้
งานนี้คือการปรับปรุงฟังก์ชันส่งออก CSV ให้ครบถ้วนสมบูรณ์:
1. เพิ่มคอลัมน์ในไฟล์ CSV:
   - 🧭 `ลิงก์ Google Maps หน้างาน` (siteMapsUrl)
   - 📍 `ละติจูด (Latitude)` (siteLat)
   - 📍 `ลองจิจูด (Longitude)` (siteLng)
   - 🔒 `มีสลิปการเงินผูกอยู่` ("มี" / "ไม่มี")
   - 🧾 `จำนวนสลิป (ใบ)` (paymentSlipCount)
2. ยังคงมาตรฐานเดิม: RFC 4180 CSV พร้อม UTF-8 BOM (`\uFEFF`) เพื่อให้เปิดใน Microsoft Excel ภาษาไทยได้ถูกต้อง ไม่เป็นภาษาต่างดาว

**รายละเอียดสิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/admin/leads-utils.ts`:
   - ปรับ `LEAD_CSV_COLUMNS` เพิ่ม 5 คอลัมน์ใหม่
   - ปรับ `leadToCsvRow(lead: CustomerLead)` ให้แมปค่า 5 คอลัมน์ใหม่
2. ปรับปรุงหรือเพิ่ม Unit Tests ใน `artifacts/knight-basins/test/leads-csv-export.test.ts` (ใหม่):
   - ทดสอบว่าหัวคอลัมน์ CSV มีคอลัมน์พิกัดและสลิปการเงินครบถ้วน
   - ทดสอบว่าข้อมูลแถวมีค่า `siteMapsUrl` และสถานะสลิปตรงตามข้อมูล Lead

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/leads-utils.ts:
     - เพิ่มคอลัมน์ Maps (siteMapsUrl, siteLat, siteLng) และสลิปการเงิน (hasMatchedSlip, paymentSlipCount) ในการส่งออก CSV
  2. สร้าง artifacts/knight-basins/test/leads-csv-export.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/leads-utils.ts
  - artifacts/knight-basins/test/admin-leads-utils.test.ts
  - artifacts/knight-basins/test/leads-csv-export.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง App.tsx, StudioPage.tsx และ WorkshopProductionSheet.tsx
  - ห้ามตัดคอลัมน์เดิมของ CSV ออกเด็ดขาด (เป็นการเพิ่มคอลัมน์ต่อท้ายเท่านั้น)
  - ห้ามลบ UTF-8 BOM ที่ทำให้ Excel ภาษาไทยอ่านได้ถูกต้อง
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) หรือ Unit Test ฟังก์ชันแท้ๆ เท่านั้น
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-enriched-leads-csv แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 597 / pass 575 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/leads-csv-export.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-enriched-leads-csv (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ UTF-8 BOM และคอลัมน์เดิมใน CSV | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
