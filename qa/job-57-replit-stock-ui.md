# ใบงาน 57 (Replit) — สร้างหน้าจอสต็อกหินสังเคราะห์ Real-Time ในระบบแอดมิน (/admin/stock)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้มีหน้าจอ "สต็อกหินสังเคราะห์" ในระบบแอดมิน เพื่อให้ทีมขาย ผู้บริหาร และเจ้าของสามารถเปิดดูยอดสต็อกแผ่นหินสังเคราะห์ Staron และ Zen Stone ได้แบบเรียลไทม์ ค้นหาได้เร็วใน 1 วินาที พร้อมปุ่มดึงข้อมูลสดจาก Google Sheets

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. เพิ่มเมนู "สต็อกหินสังเคราะห์" ในแถบนำทางแอดมิน (`AdminApp.tsx`):
     - path: `/admin/stock`
     - icon: Layers (หรือ Database/Boxes)
     - permission: `basins` (หรือ `leads`)
  2. สร้างหน้าจอ `StockInventoryPage.tsx`:
     - ดึงข้อมูลจาก `GET /api/admin/stock` (พร้อมปุ่ม `[ 🔄 ดึงข้อมูลสด ]` ยิง `?refresh=true`)
     - แสดงป้ายกำกับ: `Google Drive Service Account · เชื่อมต่อเรียลไทม์ (Read-Only 🔒)`
     - แท็บสลับ 2 แบรนด์: `[ Staron (63 รายการ) ]` และ `[ Zen Stone (47 รายการ) ]`
     - การ์ดสรุป KPI ด้านบน: จำนวนสีทั้งหมด · สีที่มีสินค้าพร้อมผลิต (>0) · สีที่หมดสต็อก (0)
     - ช่องค้นหาด่วน (Search): พิมพ์รหัสสี เช่น `BW 010`, `AA 625` หรือชื่อลาย เช่น `Bright White`, `Black River` กรองทันที
     - ตัวกรองสถานะ: `[ ทั้งหมด ]`, `[ 🟢 มีสินค้าพร้อมผลิต ]`, `[ 🔴 หมดสต็อก ]`
     - ตารางแสดงผล: ลำดับ · รหัส/ชื่อสีหิน · ยอดคงเหลือ (แผ่น) · เศษคงเหลือ · Lot No. · หมายเหตุ
       - ป้ายยอดคงเหลือ: > 10 แผ่น สีเขียว, 1-9 แผ่น สีส้ม/เหลือง, 0 แผ่น สีแดง
  3. เขียน Unit tests ใน `admin-stock-inventory.test.ts` ครอบคลุมการแสดงผลและการกรองค้นหา

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/admin/AdminApp.tsx
  2. artifacts/knight-basins/src/admin/StockInventoryPage.tsx (ใหม่)
  3. artifacts/knight-basins/test/admin-stock-inventory.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-stock-inventory-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 242 / pass 237 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้าสต็อกหินแท็บ Staron แสดงการ์ด KPI, ช่องค้นหา และตาราง
     - หน้าสต็อกหินแท็บ Zen Stone พร้อมผลการกรองค้นหา

OUTPUT:
  - branch: feat/replit-stock-inventory-ui (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ หน้าจอสต็อกหินสังเคราะห์ Real-Time |
| 2 | GOAL วัดได้ | ✅ Staron + Zen Stone + Search + KPI + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 242/237/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-stock-inventory-ui |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 242 / pass 237 / fail 2 |
| 9 | CONTRACT ระบุเส้นทางและ components ชัด | ✅ /admin/stock และ NAV_ITEMS ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
