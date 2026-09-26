# ใบงาน 91 (Replit) — ปุ่มพิมพ์รายงานสต็อกหิน A4 พร้อม Print Layout ทางการ (Print Stock Inventory Report)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Print Layout) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่ออำนวยความสะดวกให้ฝ่ายจัดซื้อ คลังสินค้า และทีมตรวจนับหน้างาน ในหน้าคลังสต็อกแผ่นหินสังเคราะห์ (`/admin/stock`) ต้องการเพิ่มปุ่มพิมพ์รายงานสรุปสต็อกออกมาเป็นกระดาษ A4 หน้าตาเป็นทางการ สำหรับใช้เดินตรวจเช็คของจริงในโกดังโรงงาน:

1. **เพิ่มปุ่ม `[ 🖨️ พิมพ์รายงาน A4 ]` ใน `artifacts/knight-basins/src/admin/StockInventoryPage.tsx`:**
   * วางอยู่ข้างปุ่ม "ส่งออกสต็อกเป็น CSV" (`data-testid="button-stock-print"`)
   * มีไอคอน `Printer` สวยงาม เข้ากับสไตล์เดิม
   * เมื่อคลิก: เรียกคำสั่ง `window.print()`
2. **ออกแบบ Print Stylesheet (@media print) สำหรับรายงานสต็อก:**
   * **ส่วนหัวเอกสารที่พิมพ์ (Print Header):**
     - แสดงโลโก้ / ชื่อบริษัท "KNIGHT FURNICH — รายงานสต็อกแผ่นหินสังเคราะห์"
     - แสดงแบรนด์ที่กำลังเลือก (Staron หรือ Zen Stone)
     - แสดงสรุปตัวเลข: วันที่พิมพ์รายงาน (เวลาไทย), จำนวนสีทั้งหมด, สต็อกรวม (แผ่น)
   * **การซ่อนสิ่งที่ไม่จำเป็นขณะพิมพ์ (No UI clutter):**
     - ซ่อนแถบนำทาง (Navbar), แถบเลือกแท็บแบรนด์, ช่องค้นหา, ปุ่มฟิลเตอร์, ปุ่มดาวน์โหลด/ปุ่มรีเฟรช และคอลัมน์ปุ่ม LINE ในตาราง
   * **การจัดหน้ากระดาษ A4 คมชัดและประหยัดพื้นที่:**
     - ตารางสต็อกแสดงเส้นตารางคมชัด (`border: 1px solid #333; print-color-adjust: exact;`)
     - รองรับการแบ่งหน้ากระดาษ (Page Break) อย่างเรียบร้อย หัวตาราง (`thead`) ต้องซ้ำทุกหน้าเมื่อตารางยาวเกิน 1 หน้า A4 (`break-inside: avoid`)
3. **เขียน Unit Tests ใน `artifacts/knight-basins/test/stock-print-report.test.ts` (ใหม่):**
   * ทดสอบว่ามีปุ่ม data-testid="button-stock-print"
   * ทดสอบว่ามี `@media print` rule ที่ซ่อนองค์ประกอบ UI ที่ไม่จำเป็นขณะพิมพ์
   * ทดสอบว่ามีส่วนหัวรายงานสำหรับพิมพ์ที่ระบุแบรนด์และวันที่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/StockInventoryPage.tsx:
     - เพิ่มปุ่ม [ 🖨️ พิมพ์รายงาน A4 ] data-testid="button-stock-print" ข้างปุ่ม export CSV
     - เพิ่มบล็อก print-only header แสดงหัวรายงานบริษัท แบรนด์ วันที่พิมพ์ และยอดรวม
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่ม @media print rules สำหรับ .stock-inventory-page:
       * ซ่อน search, filters, action buttons, และคอลัมน์ LINE
       * แสดงตารางคมชัด font อ่านง่าย สบายตา เหมาะสำหรับกระดาษ A4
       * thead repeat across pages (break-inside: avoid)
  3. สร้าง artifacts/knight-basins/test/stock-print-report.test.ts (ใหม่):
     - ทดสอบปุ่มพิมพ์รายงาน A4, print styles, และ print-header ครบถ้วน

SCOPE:
  - artifacts/knight-basins/src/admin/StockInventoryPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/stock-print-report.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง App.tsx และ artifacts/api-server/ ทุกไฟล์
  - ห้ามกระทบ @media print ของ Formal Quotation เดิมใน App.tsx
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-stock-print-report แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 406 / pass 396 / fail 2 / cancelled 3 / skipped 5
  4) เทสต์ใหม่ใน stock-print-report.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงและแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-stock-print-report (เปิด PR เข้า main)
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
| 11 | ทดสอบปุ่มพิมพ์รายงาน Print CSS และ Print Header | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core เดิม | ✅ ผ่าน |
