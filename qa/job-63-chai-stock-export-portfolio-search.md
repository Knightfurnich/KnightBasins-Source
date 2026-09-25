# ใบงาน 63 (ชัย) — ระบบดาวน์โหลดสต็อกหินสังเคราะห์ (CSV Export) และ API ค้นหาภาพผลงาน

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ชัย

**ความต้องการ:** 
1. ทีมขายและฝ่ายจัดซื้อต้องการดาวน์โหลดสต็อกหินสังเคราะห์ (Staron 63 รายการ และ Zen Stone 47 รายการ) ออกมาเป็นไฟล์ Excel/CSV (UTF-8 with BOM) ด้วยการคลิกเพียงปุ่มเดียวจากหน้า `/admin/stock`
2. API สาธารณะ `GET /api/portfolio` ควรรับพารามิเตอร์ `?q=` เพื่อรองรับการค้นหาภาพตามคีย์เวิร์ด (เช่น "ห้องน้ำ", "เคาน์เตอร์", "โค้ง") จากฝั่งเซิร์ฟเวอร์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน api-server:
     - ใน artifacts/api-server/src/routes/admin-router.ts:
       * เพิ่ม endpoint `GET /api/admin/stock/export` (requireAnyAdminPermission(["leads", "basins"])):
         - ดึงข้อมูลสต็อกหินสังเคราะห์ล่าสุดจาก Staron และ Zen Stone
         - แปลงเป็น CSV ตามมาตรฐาน RFC 4180 พร้อม UTF-8 BOM (`\uFEFF`) เพื่อให้อ่านภาษาไทยใน Microsoft Excel ได้ถูกต้อง 100%
         - กำหนด Header:
           `Content-Type: text/csv; charset=utf-8`
           `Content-Disposition: attachment; filename="knight_stone_stock_YYYY-MM-DD.csv"`
         - คอลัมน์ใน CSV: ยี่ห้อ, รหัสสี, ชื่อสี, ขนาดแผ่น, ความหนา, จำนวนคงเหลือ, หมายเหตุ, วันที่อัปเดต
     - ใน artifacts/api-server/src/routes/portfolio.ts:
       * ใน endpoint `GET /api/portfolio`:
         - รองรับ query parameter `?q=` (string)
         - กรองค้นหาข้อความจาก `captionTh`, `category`, และ `id` (case-insensitive)
  2. ใน artifacts/knight-basins/src/admin/StockInventoryPage.tsx:
     - เพิ่มปุ่ม [ 📥 ส่งออกสต็อกเป็น CSV ] ด้านขวาบนของตารางสต็อก
     - เมื่อคลิก สั่งดาวน์โหลดจาก `/api/admin/stock/export`
  3. เขียน Unit Tests ใน artifacts/knight-basins/test/stock-export-and-portfolio-search.test.ts:
     - ทดสอบการแปลงข้อมูลสต็อกเป็นฟอร์แมต CSV (UTF-8 BOM, escape comma/quotes)
     - ทดสอบการค้นหาภาพด้วยคำค้นหาใน portfolio filter function

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/StockInventoryPage.tsx
  4. /opt/data/cache/kbsrc/artifacts/knight-basins/test/stock-export-and-portfolio-search.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-stock-export-portfolio-search แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 261 / pass 255 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน stock-export-and-portfolio-search.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-stock-export-portfolio-search (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ใช้ absolute path ที่มีอยู่จริงในเครื่องสำหรับชัย | ✅ ผ่าน |
| 8 | มีข้อห้ามแก้ไขไฟล์ Print Layout และ DB Migration | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการ export CSV รองรับภาษาไทย UTF-8 BOM | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Studio Core | ✅ ผ่าน |
