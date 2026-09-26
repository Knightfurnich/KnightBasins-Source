# ใบงาน 81 (Replit) — ระบบเรียงลำดับตารางสต็อกรายคอลัมน์ + การ์ดสต็อกแผ่นรวม + ปุ่มคัดลอกสถานะสต็อกทาง LINE

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — เริ่มเตรียมโค้ดได้ทันที

**ที่มาและความต้องการ:**
ยกระดับหน้าจอคลังสต็อกแผ่นหินสังเคราะห์ (`/admin/stock`) ให้ทีมงานและผู้บริหารใช้งานได้อย่างมีประสิทธิภาพสูงสุด:

1. **ระบบเรียงลำดับตารางรายคอลัมน์ (Interactive Column Sorting):**
   - ในตารางสต็อก ให้ผู้ใช้สามารถคลิกที่หัวตารางเพื่อสลับการเรียงลำดับได้ (Sort Column & Direction):
     * **No. (ลำดับ):** เรียงตามลำดับ 1, 2, 3...
     * **รหัส / ชื่อสี:** เรียงตามตัวอักษร A-Z หรือ Z-A
     * **Qty (แผ่น):** เรียงตามจำนวนสต็อก จากมากไปน้อย (เช็คหินพร้อมขาย) หรือ น้อยไปมาก (เช็คหินหมดสต็อก)
     * **Scrap / Lot No. / หมายเหตุ:** เรียงตามตัวอักษร
   - แสดงสัญลักษณ์บอกทิศทางบนหัวคอลัมน์ที่กำลังเรียง เช่น `▲` (น้อยไปมาก) หรือ `▼` (มากไปน้อย)
2. **การ์ด KPI สรุปยอดแผ่นรวมทั้งโกดัง (Total Sheets KPI Card):**
   - เพิ่มการ์ดสรุปยอดที่ 4 บนแถบ KPI ด้านบน:
     * `สีทั้งหมด` · `มีสต็อก` · `หมดสต็อก` · **`สต็อกรวม (แผ่น)`**
     * ตัวเลขสต็อกรวม คำนวณจากผลรวมจำนวนแผ่นของทุกสีในแบรนด์นั้น (เช่น Staron = 991 แผ่น, Zen Stone = 1,061 แผ่น)
3. **ปุ่ม 1-Click คัดลอกสถานะสต็อกส่งลูกค้าทาง LINE:**
   - ในแต่ละแถวของตาราง เพิ่มปุ่มไอคอนคัดลอก (Copy / MessageSquare) เมื่อคลิกแล้วจะคัดลอกข้อความสุภาพเข้า Clipboard เช่น:
     `"หิน Staron รหัส AA 625 (Aspen Alder) สต็อกโรงงานพร้อมส่ง 12 แผ่นค่ะ"` (หรือ `"...ปัจจุบันหมดสต็อกค่ะ"`)
   - มี Feedback สั้นๆ เช่น ไอคอนเปลี่ยนเป็นเครื่องหมายถูก `✓ คัดลอกแล้ว`
4. **แถบสีสถานะสต็อกแบบ Quick Visual (Traffic Light):**
   - จำนวนแผ่น QTY มีสีบ่งบอกสถานะชัดเจน:
     * $\ge 10$ แผ่น: สีเขียว (สต็อกพร้อมส่ง)
     * $1 - 9$ แผ่น: สีส้ม (สต็อกเหลือน้อย)
     * $0$ แผ่น: สีแดงจาง (หมดสต็อก)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/StockInventoryPage.tsx:
     - เพิ่ม State สำหรับจัดเรียง: sortColumn ("no" | "name" | "qty" | "scrap" | "lots" | "note") และ sortDirection ("asc" | "desc")
     - ปรับปรุงฟังก์ชัน filterStockItems / เพิ่ม sortStockItems เพื่อเรียงข้อมูลก่อนแสดงผลในตาราง
     - หัวตารางทุกคอลัมน์มีปุ่มคลิกจัดเรียง พร้อม aria-sort และไอคอนลูกศร
     - เพิ่มการ์ด KPI สรุป "สต็อกรวมทั้งหมด (แผ่น)"
     - ในแต่ละแถว เพิ่มปุ่ม [ 📋 คัดลอกข้อความ LINE ] data-testid={`button-copy-stock-${item.no}`} สำหรับคัดลอกสถานะสต็อกพร้อมส่งลูกค้า
  2. ใน artifacts/knight-basins/test/stock-sorting-and-copy.test.ts (ใหม่):
     - ทดสอบการเรียงลำดับตาม name, qty, no ทั้ง asc และ desc
     - ทดสอบการคำนวณยอดแผ่นรวมในการ์ด KPI
     - ทดสอบว่ามีปุ่มคัดลอกข้อความ LINE และฟอร์แมตข้อความถูกต้อง
  3. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์สำหรับ Sort Headers, Traffic light badges และปุ่ม Copy status

SCOPE:
  - artifacts/knight-basins/src/admin/StockInventoryPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/stock-sorting-and-copy.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-stock-table-sorting แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 384 / pass 378 / fail 2 / cancelled 3 / skipped 1
  4) เทสต์ใหม่ใน stock-sorting-and-copy.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงและแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-stock-table-sorting (เปิด PR เข้า main)
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
| 11 | ทดสอบการ Sort, การ์ด KPI และปุ่มคัดลอกข้อความ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
