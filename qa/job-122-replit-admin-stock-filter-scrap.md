# ใบงาน 122 (Replit) — เพิ่มตัวกรองเศษหินและปุ่มคัดลอกสรุปสต็อกด่วน (Stock Scraps Filter & Quick Copy)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Stock UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าสต็อกหินสังเคราะห์ (`/admin/stock`) ทีมขายและฝ่ายผลิตมักต้องการตรวจสอบ:
1. **สีที่มีเศษหิน (scrap):** เพื่อนำเศษหินมาใช้ในงานเคาน์เตอร์ขนาดเล็กหรืองานท็อปอ่าง ไม่ต้องตัดแผ่นใหม่
2. **ปุ่มคัดลอกสรุปสต็อกด่วนสำหรับส่ง LINE:** แอดมินต้องการคัดลอกรายการสต็อกที่กำลังกรองอยู่ไปตอบลูกค้าใน LINE ได้ทันทีโดยไม่ต้องแคปภาพ

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/StockInventoryPage.tsx`:**
1. **เพิ่มตัวกรองมีเศษหินในแถบฟิลเตอร์:**
   * ในแถบตัวกรองเดิม (`ทั้งหมด`, `qty > 0`, `qty = 0`)
   * เพิ่มปุ่มตัวกรอง `[ มีเศษหิน ]` (`data-testid="button-stock-filter-has-scrap"`)
   * เมื่อเลือก: กรองแสดงเฉพาะรายการที่ฟิลด์ `scrap` มีค่า (ไม่เป็น "—", ไม่ว่าง, และไม่ใช่ "0")
2. **เพิ่มปุ่ม `[ 📋 คัดลอกสรุปส่ง LINE ]` บนแถบเครื่องมือ:**
   * วางข้างปุ่มพิมพ์รายงาน A4 มี attribute `data-testid="button-stock-copy-summary"`
   * เมื่อกดปุ่ม: รวมรายการสีและจำนวนแผ่น/เศษที่กำลังแสดงอยู่บนหน้าจอ จัดฟอร์แมตข้อความสรุปอ่านง่าย
   * คัดลอกลง Clipboard และแสดง Toast แจ้งเตือน: "คัดลอกข้อความสรุปสต็อกเรียบร้อยแล้ว"
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-stock-filter-scrap.test.ts` (ใหม่):**
   * ทดสอบปุ่มตัวกรองมีเศษหินแสดงผลและกรองข้อมูลได้ถูกต้อง
   * ทดสอบปุ่มคัดลอกสรุปส่ง LINE

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/StockInventoryPage.tsx:
     - เพิ่มปุ่มตัวกรอง "มีเศษหิน" (data-testid="button-stock-filter-has-scrap")
     - เพิ่มปุ่มคัดลอกสรุปส่ง LINE (data-testid="button-stock-copy-summary") จัดฟอร์แมตข้อความสรุปสต็อกลง Clipboard
  2. สร้าง artifacts/knight-basins/test/admin-stock-filter-scrap.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/StockInventoryPage.tsx
  - artifacts/knight-basins/test/admin-stock-filter-scrap.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเปลี่ยนตรรกะการคำนวณจำนวนแผ่นหรือ API สต็อกเดิม
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-stock-filter-scrap แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 499 / pass 477 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-stock-filter-scrap.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-stock-filter-scrap (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ตรรกะสต็อกเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
