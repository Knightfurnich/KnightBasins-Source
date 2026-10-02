# ใบงาน 168 (Replit) — [ยกเลิก / Superseded by PR #121] ระบบ Generative Engine Optimization (GEO) สำหรับหน้าแสดงผลและโครงสร้างข้อมูลสินค้า (Product Schema & Clean Specs)

> ⚠️ **สถานะ: ยกเลิก / ปิดงานเรียบร้อย (Superseded by PR #121 commit `33fce8d`)**
> ฟีเจอร์นี้ได้รับการพัฒนา ตรวจสอบ และ Deploy ขึ้น Production Live แล้วผ่าน PR #121 (Job 169 โดย บอส / ชัย)
> Replit ตรวจพบการ Merge เรียบร้อยและหยุดการเปิด PR ซ้ำอย่างถูกต้อง 100%

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)

**ที่มาและความต้องการ:**
เพื่อยกระดับการค้นหาผ่าน AI Search Engines (ChatGPT Search, Claude, Google Gemini, Perplexity) ให้สามารถแนะนำสินค้าของ Knight Basins ได้แม่นยำระดับรายชิ้น (SKU) และหยิบข้อมูลสเปก/ราคาไปตอบลูกค้าได้ทันที
งานนี้ครอบคลุมการเพิ่ม Product Schema สำหรับอ่างล้างหน้า KF001–KF030 และปุ่มคัดลอกสเปกสรุปแบบ Clean Text

**รายละเอียดสิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/components/RouteStructuredData.tsx` หรือคอมโพเนนต์ที่เกี่ยวข้อง:
   - เพิ่มฟังก์ชันสร้าง JSON-LD ประเภท `@type: "Product"` สำหรับอ่างล้างหน้าสำเร็จรูป 30 รุ่น (ดึงจาก `basin-catalog.json`)
   - แต่ละ Product ต้องมี: `@type: "Product"`, `name`, `sku` (เช่น KF001), `description`, `image`, และ `offers` (`@type: "Offer"`, `price`, `priceCurrency: "THB"`, `availability: "https://schema.org/InStock"`)
2. ในการ์ดแสดงสินค้าอ่างล้างหน้า (`ProductCard` ใน `App.tsx` หรือคอมโพเนนต์แสดงผลอ่าง):
   - เพิ่มปุ่มเล็กๆ สำหรับคัดลอกสเปกสรุป `data-testid="button-copy-spec-${sku}"`
   - เมื่อกดปุ่ม ให้คัดลอกข้อความสเปกสรุปของรุ่นนั้น (ชื่อรุ่น, ขนาด, ราคา) ลง clipboard พร้อมแสดงข้อความ feedback สั้นๆ ว่าคัดลอกแล้ว
3. สร้าง Unit Test ใน `artifacts/knight-basins/test/product-schema-geo.test.ts` (ใหม่):
   - ตรวจสอบว่ามีฟังก์ชันสร้าง Product Schema ครบทั้ง 30 รุ่น พร้อมฟิลด์ sku, offers, priceCurrency "THB"
   - ตรวจสอบว่ามีปุ่ม copy spec และ attribute data-testid ถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง Product Schema (@type: Product) 30 รุ่น (KF001–KF030) ฝังใน JSON-LD เพื่อให้ AI Search ดึงราคาและสเปกรายชิ้นได้
  2. เพิ่มปุ่มคัดลอกสเปกสินค้า (Clean Text Copy) ที่การ์ดอ่างล้างหน้า data-testid="button-copy-spec-${sku}"
  3. สร้างไฟล์ทดสอบ artifacts/knight-basins/test/product-schema-geo.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/data/structured-data.ts
  - artifacts/knight-basins/src/components/RouteStructuredData.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/product-schema-geo.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx และ WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามกระทบ Formal Quotation print layout
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) หรือ Unit Test ฟังก์ชันแท้ๆ เท่านั้น
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-geo-product-schema แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 595 / pass 589 / fail 1 pre-existing / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/product-schema-geo.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-geo-product-schema (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 1 ข้อ (baseline มี fail เดิม 1 ข้อ)
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
| 11 | อนุรักษ์ Print Layout และคอมโพเนนต์สำคัญ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
