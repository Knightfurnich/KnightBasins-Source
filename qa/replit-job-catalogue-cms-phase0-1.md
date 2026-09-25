# ใบงานส่ง Replit — ระบบจัดการแคตตาล็อกหลังบ้าน & Publish Pipeline (Catalogue CMS - Phase 0 & 1)

> 13 ก.ย. 2026 · กำหนดสถาปัตยกรรมและกติกาข้อบังคับธุรกิจ (Business Validation Rules) สำหรับแอดมินจัดการสินค้า/ราคา

---

## 🎯 GOAL
สร้างระบบหลังบ้านจัดการแคตตาล็อกสินค้า (สีหินสังเคราะห์, อ่างล้างหน้า, อุปกรณ์เสริม) โดยมีระบบ **Draft -> Preview -> Publish -> Archive**, ระบบ Versioning และ Audit Log โดยเมื่อกด **Publish** ระบบต้องอัปเดตไฟล์ KB (`pricing.public.json` และ Markdown KB) ฝั่งเซิร์ฟเวอร์เพื่อให้บอทน้องไนท์และ API คำนวณราคาได้ถูกต้องตรงกัน 100%

---

## 📐 ARCHITECTURE & SINGLE SOURCE OF TRUTH (Phase 0)
1. **Database แอปเป็นแหล่งจริงหลัก (App DB = Master Source of Truth):**
   - ข้อมูลสินค้า/ราคาอยู่ในตารางแคตตาล็อกของ Database มีสถานะ `draft`, `published`, `archived`
2. **Publish Pipeline (ซิงก์กลับ KB ถาวร):**
   - เมื่อแอดมินกด **Publish**:
     1) สแน็ปช็อตเวอร์ชันใหม่ลง DB (`catalog_versions`)
     2) เขียนไฟล์ทับ `/opt/data/knight-design-kb/pricing.public.json` และ `/opt/data/knight-design-kb/pricing.json` ฝั่ง Server
     3) อัปเดต Version Tag (`?v=<timestamp>`) บน URL รูปภาพ/วิดีโอเพื่อล้างแคช
     4) รันคำสั่ง `sync-kb.py` เพื่อฉีดข้อมูลเข้า Platform Hints ของน้องไนท์ (บอท LINE/Web)
3. **ใบเสนอราคาเก่าไม่เปลี่ยน (Immutable Issued Quotes):**
   - ใบเสนอราคาที่ออกไปแล้ว ต้องอ่านราคาจาก `calculation_snapshots` ของตนเองเท่านั้น ไม่เปลี่ยนตามการ Publish แคตตาล็อกใหม่

---

## ⚠️ BUSINESS VALIDATION RULES (5 กติกาเหล็ก ห้ามละเมิดเด็ดขาด)

### Rule 1 · อัปเดต 2 ทางเสมอ (Dual Publish)
- การกด Publish ต้องอัปเดตทั้ง **Published Version ใน DB** และ **ไฟล์ KB (`pricing.public.json`)**
- ห้ามให้มีสถานะที่ DB แอปมีราคาใหม่แต่ KB เป็นราคาเก่าเด็ดขาด

### Rule 2 · รหัสสี = ตัวตนของสี (Immutable Colour Code)
- รหัสสี (เช่น `KZ802`, `KZ802N`, `BW010`) เป็นกุญแจเชื่อมต่อภาพ/วิดีโอ/ประวัติใบเสนอราคา
- เมื่อสร้างสินค้าแล้ว **ห้ามแก้ไขช่อง Code ตรงๆ (Read-only)** 
- การเปลี่ยนรหัสต้องทำผ่านฟังก์ชัน *"Change Code & Re-link Assets"* ที่บันทึก Audit Log ชัดเจนเท่านั้น

### Rule 3 · อ่างทรงกลมต้องใช้สัญลักษณ์ `Ø` เท่านั้น
- สำหรับขนาดอ่างทรงกลม (เช่น KF023-KF026) ต้องเก็บบ่งบอกทรงกลมด้วยอักษร `Ø` เช่น `Ø350x150` เท่านั้น
- ระบบ Input ต้องรับอักษร `Ø`, `ø`, `D`, `d`, `⌀` ได้ แต่เมื่อบันทึกลง DB ต้องจัดฟอร์แมตทรงกลมให้เป็น `Ø` ห้ามเปลี่ยนเป็นตัวอักษร `D` (เพราะ Canvas Renderer แยกทรงกลมด้วยตัวอักษร `Ø`)

### Rule 4 · `bowl_mm = null` หมายถึง "แคตตาล็อกไม่ระบุ"
- สำหรับอ่างรุ่นที่ไม่มีขนาดหลุมระบุ (เช่น `KF029`, `KF030`):
- ฟิลด์ `bowl_mm` ใน DB ต้องเก็บเป็น `null` ชัดเจน **ห้ามบังคับกรอก ห้ามเปลี่ยนเป็น 0 หรือสตริงว่าง**

### Rule 5 · การย้ายกลุ่ม/Tier = การเปลี่ยนราคา
- สีหินถูกจัดกลุ่มตาม Tier ราคา (เช่น 7,500 / 8,500 / 9,500 บาท/ตร.ม.)
- การย้ายสีข้าม Tier ถือเป็นการเปลี่ยนราคา ต้องบังคับผ่านกระบวนการ Draft -> Publish และบันทึก Version ใหม่พร้อม Audit Log

---

## 🛠️ DATABASE SCHEMA & API SPEC (Phase 1)

### 1. Tables (`artifacts/api-server/src/db/schema.ts`)
- `catalogue_items`: (id, category['colour'|'sink'|'accessory'], code, name, tierId, price, unit, sizeMm, bowlMm, imageUrl, slabImageUrl, videoUrl, status['draft'|'published'|'archived'], createdAt, updatedAt)
- `catalogue_versions`: (id, versionNumber, snapshotJson, publishedBy, publishedAt)
- `catalogue_audit_logs`: (id, userId, action, targetCode, changesJson, timestamp)

### 2. Endpoints (`artifacts/api-server/src/routes/admin-catalogue.ts`)
- `GET /api/admin/catalogue` — ดึงรายการสินค้าทั้งหมด (รวม draft/published/archived) [Admin Guard]
- `POST /api/admin/catalogue/item` — เพิ่มสินค้าใหม่ [Admin Guard]
- `PATCH /api/admin/catalogue/item/:id` — แก้ไขร่างสินค้า (Draft) [Admin Guard]
- `POST /api/admin/catalogue/publish` — กด Publish สแน็ปเวอร์ชัน + ซิงก์ KB + ล้างแคช [Admin Guard]
- `GET /api/admin/catalogue/versions` — ดูประวัติเวอร์ชัน [Admin Guard]

---

## 📋 เกณฑ์ตรวจรับ (Phase 0 & 1 Verification)
```
1. รัน API Test: สามารถ Create Draft -> Patch -> Publish ได้สมบูรณ์
2. เมื่อกด Publish -> ไฟล์ pricing.public.json บน Server ถูกอัปเดต และมี version tag ?v= ใหม่
3. ตรวจสอบ Rule 2: ไม่สามารถ PATCH เปลี่ยน code ตรงๆ ได้หลังสร้าง
4. ตรวจสอบ Rule 3: อ่างทรงกลมอัปเดตขนาดแล้วคงค่าเป็น Ø350x150
5. ตรวจสอบ Rule 4: อ่าง KF029 คืนค่า bowl_mm เป็น null
6. Admin Auth Guard: Endpoint ทั้งหมดปฏิเสธการเข้าถึงหากไม่ได้ล็อกอิน Admin
```

## ⛔ ข้อห้าม
- ห้าม hard delete ข้อมูลสินค้า (ใช้สถานะ archived แทน)
- ห้ามให้ Frontend ส่งราคามาบันทึกตรงๆ
- ห้ามดึงตัวเลขจากใบเสนอราคาตัวอย่างมาใช้ในการ Import
