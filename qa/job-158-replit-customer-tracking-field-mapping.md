# ใบงาน 158 (Replit) — ปรับปรุงการเชื่อมโยงฟิลด์รูปถ่ายหน้างานและข้อมูล Studio ในหน้าติดตามงานลูกค้า (/track Customer Tracking Field Mapping Polish)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Customer Tracking Polish UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อตอบสนองข้อเสนอแนะ Follow-up #296:
ในหน้าพอร์ทัลลูกค้าสำหรับติดตามงาน `/track` (`artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx`) ปัจจุบันฟังก์ชัน `parseTrackingPayload()` อ่านฟิลด์รูปถ่ายหน้างานจาก `payload.photos` แต่ API จริง (`GET /api/public/track` ใน `leads.ts:489`) ส่งกลับมาในชื่อฟิลด์ **`payload.sitePhotos`**
นอกจากนี้ โครงสร้าง `payload.studio` จาก API ส่งค่า `shape`, `dimensionsMm`, `stoneColor`, `basinSkus` ซึ่งหน้า `/track` ควรแมปและแสดงผลให้ครบถ้วนสวยงามแบบเดียวกับที่หน้า `/handover` (Task 156) ทำได้สมบูรณ์แล้ว

**สิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx`:
   * ในฟังก์ชัน `parseTrackingPayload(payload)`:
     - ปรับให้อ่านรายการรูปถ่ายหน้างานจาก **`envelope.sitePhotos`** (และ fallback ไป `envelope.photos` เพื่อความยืดหยุ่น)
     - ปรับการอ่านข้อมูลแบบร่าง `envelope.studio` ให้รองรับฟิลด์จริง: `shape`, `dimensionsMm`, `stoneColor`, `basinSkus` เคียงคู่กับฟิลด์เดิม
   * ตรวจสอบว่าแกลเลอรีรูปถ่ายส่งมอบ (`data-testid="gallery-completed-photos"`) เรนเดอร์รูปภาพจาก `sitePhotos` ได้อย่างถูกต้อง และคลิกขยายดูรูปขนาดใหญ่ (Lightbox) ได้ลื่นไหล
2. อัปเดต Unit Tests ใน `artifacts/knight-basins/test/customer-tracking-portal.test.ts`:
   * เพิ่มเทสต์เคสยืนยันว่าการประมวลผล payload ที่ส่ง `sitePhotos` และ `studio` (shape/dimensionsMm/stoneColor) ทำงานได้อย่างสมบูรณ์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx:
     - รองรับ envelope.sitePhotos และ envelope.studio (shape, dimensionsMm, stoneColor, basinSkus)
  2. อัปเดต artifacts/knight-basins/test/customer-tracking-portal.test.ts

SCOPE:
  - artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx
  - artifacts/knight-basins/test/customer-tracking-portal.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css, App.tsx, StudioPage.tsx
  - ห้ามแตะ backend หรือ artifacts/api-server/
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-customer-tracking-field-mapping แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 609 / pass 588 / fail 0 / skipped 21 (หลัง Task 154)
  4) เทสต์ใน test/customer-tracking-portal.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-customer-tracking-field-mapping (เปิด PR เข้า main)
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
| 11 | อนุรักษ์โครงสร้างหน้าจอพอร์ทัลลูกค้า | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
