# ใบงาน 169 (บอส / Claude Code) — ระบบ Generative Engine Optimization (GEO) สำหรับหน้าแสดงผลและโครงสร้างข้อมูลสินค้า (Product Schema & Clean Specs)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ บอส / ชัย (Claude Code CLI / Frontend Maintenance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อยกระดับการค้นหาผ่าน AI Search Engines (ChatGPT Search, Claude, Google Gemini, Perplexity) ให้สามารถแนะนำสินค้าของ Knight Basins ได้แม่นยำระดับรายชิ้น (SKU) และหยิบข้อมูลสเปก/ราคาไปตอบลูกค้าได้ทันที
งานนี้ครอบคลุมการเพิ่ม Product Schema สำหรับอ่างล้างหน้า KF001–KF030 และปุ่มคัดลอกสเปกสรุปแบบ Clean Text

**รายละเอียดสิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/data/structured-data.ts`:
   - เพิ่มฟังก์ชัน `buildBasinProductsJsonLd()` สำหรับสร้าง JSON-LD `@type: "Product"` จากแคตตาล็อกอ่างล้างหน้าทั้ง 30 รุ่น
   - แต่ละ Product ต้องมี:
     - `@type`: "Product"
     - `name`: ชื่อรุ่น (เช่น "Knight Basins KF001")
     - `sku`: รหัสรุ่น (เช่น "KF001")
     - `description`: คำอธิบายขนาดและลักษณะอ่าง
     - `image`: URL ภาพอ่าง
     - `offers`: `@type: "Offer"`, `price`: ตัวเลขราคาบาท (เช่น 16000), `priceCurrency`: "THB", `availability`: "https://schema.org/InStock"
2. ใน `artifacts/knight-basins/src/components/RouteStructuredData.tsx`:
   - เรียกใช้ `buildBasinProductsJsonLd()` ใน route หน้าแรก (`/`) เพื่อฉีด Script JSON-LD ชุดนี้
3. ใน `ProductCard` (ใน `artifacts/knight-basins/src/App.tsx`):
   - เพิ่มปุ่มเล็กๆ สำหรับคัดลอกสเปกสรุป:
     - Attribute: `data-testid={`button-copy-spec-${sku}`}`
     - เมื่อคลิก ให้คัดลอกสเปกสรุป (เช่น `KF001 | ขนาด 800x500 มม. | ราคา 16,000 บาท`) ลงใน `navigator.clipboard.writeText()`
     - แสดงสถานะชั่วคราวว่า "คัดลอกแล้ว" เพื่อให้ผู้ใช้ทราบ
4. สร้าง Unit Test ใน `artifacts/knight-basins/test/product-schema-geo.test.ts` (ใหม่):
   - ตรวจสอบว่า `buildBasinProductsJsonLd()` คืนค่าสินค้าครบ 30 ชิ้น และมีโครงสร้าง Product + Offer ครบถ้วน
   - ตรวจสอบว่าใน `App.tsx` มีการเรนเดอร์ปุ่ม `button-copy-spec-` พร้อม attribute ถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. สร้าง Product Schema (@type: Product) 30 รุ่น (KF001–KF030) ฝังใน JSON-LD เพื่อให้ AI Search ดึงราคาและสเปกรายชิ้นได้
  2. เพิ่มปุ่มคัดลอกสเปกสินค้า (Clean Text Copy) ที่การ์ดอ่างล้างหน้า data-testid="button-copy-spec-${sku}"
  3. สร้างไฟล์ทดสอบ artifacts/knight-basins/test/product-schema-geo.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteStructuredData.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/product-schema-geo.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx และ WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามกระทบ Formal Quotation print layout
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) หรือ Unit Test ฟังก์ชันแท้ๆ เท่านั้น
  - ทำงานผ่าน worktree หรือ branch: feat/chai-geo-product-schema แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง branch ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 595 / pass 589 / fail 1 pre-existing / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/product-schema-geo.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-geo-product-schema (เปิด PR เข้า main)
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
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ Print Layout และคอมโพเนนต์สำคัญ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
