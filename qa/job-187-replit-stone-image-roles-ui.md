# ใบงาน 187 (Replit) — Stone Image Roles UI (3 บทบาทภาพหิน + แกลเลอรี เหมือนอ่างล้างหน้า)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / UI) · ทำต่อหลังจาก Backend API (Job 186) เสร็จ

**ที่มาและความต้องการ:**
ปรับปรุงหน้าจอจัดการหินสังเคราะห์ในฝั่งแอดมิน ทั้งสองหน้า:
1. `SheetStonesManager.tsx` (หินขายแผ่น `/admin/sheet-stones`)
2. `InstalledStonesManager.tsx` (หินพร้อมติดตั้ง `/admin/installed-stones`)

ให้เปลี่ยนจากช่องอัปโหลดรูปภาพเดิม (ImageUploadField รูปเดียว) มาใช้ระบบ **จัดการภาพ 3 บทบาทชัดเจน (เหมือนกับหน้า BasinsManager ของอ่างล้างหน้า)**:
- กล่องที่ 1 (กรอบสีอำพัน ★): **1. ภาพแสดงหน้าร้าน (/stone)** — ภาพแรกสุดในแกลเลอรี
- กล่องที่ 2 (กรอบสีเขียวมรกต 📄): **2. ภาพใบเสนอราคา** — ระบุภาพที่จะพิมพ์ลงใบเสนอราคา (หรือใช้ภาพหลักอัตโนมัติ)
- กล่องที่ 3 (กรอบสีน้ำเงิน 🔲): **3. ภาพแสดงเต็มแผ่น (Full Slab)** — ระบุภาพลายเต็มแผ่นใหญ่สำหรับลูกค้าดูลายก่อนตัดชิ้นงาน
- พร้อมแถบ Gallery ด้านล่าง รองรับปุ่ม `+ เพิ่มภาพใหม่`, เลื่อนซ้าย-ขวา, ตั้งเป็นภาพหลัก, สลับบทบาท และปุ่มลบ

**รายละเอียดสิ่งที่ต้องทำ (4 ไฟล์):**
1. สร้างคอมโพเนนต์ `StoneImageManagerField.tsx` ใน `artifacts/knight-basins/src/admin/`:
   - ถอดแบบโครงสร้างจาก `BasinImageManagerField.tsx` มาทั้งหมด
   - ปรับกล่องที่ 3 จาก "ภาพ Top View" ➔ เปลี่ยนเป็น **"3. ภาพแสดงเต็มแผ่น (Full Slab)"**
     - ข้อความกำกับ: "ใบเสนอราคา/ดูลาย" หรือ "ดูลายเต็มแผ่น"
     - คำอธิบายใต้กล่อง: "ภาพถ่ายลายหินเต็มแผ่นใหญ่ สำหรับประกอบการตัดสินใจและดูลายก่อนตัดชิ้นงาน"
   - เปลี่ยนปุ่มบนรูปภาพจาก "✓ ตั้งเป็น Top View" ➔ **"✓ ตั้งเป็นภาพเต็มแผ่น"**
   - Props รับ: `images`, `quoteImageUrl`, `slabImageUrl`, `onImagesChange`, `onQuoteImageChange`, `onSlabImageChange`
2. ปรับปรุง `artifacts/knight-basins/src/admin/SheetStonesManager.tsx`:
   - ใน `stoneSchema` รองรับ `galleryImageUrls: z.array(z.string()).default([])`, `quoteImageUrl: z.string().nullable().optional()`, `slabImageUrl: z.string().nullable().optional()`
   - แทนที่ `ImageUploadField` ด้วย `StoneImageManagerField` ในฟอร์มแก้ไข/เพิ่มหิน
3. ปรับปรุง `artifacts/knight-basins/src/admin/InstalledStonesManager.tsx`:
   - รองรับฟิลด์ภาพทั้ง 3 บทบาท และแทนที่ด้วย `StoneImageManagerField` เช่นเดียวกัน
4. เพิ่มเทสต์ `artifacts/knight-basins/test/stone-image-manager-field.test.ts`:
   - ใช้ Static Source Inspection (`fs.readFileSync`) ตรวจสอบว่า `StoneImageManagerField` มีข้อความ 3 บทบาท ("ภาพแสดงหน้าร้าน", "ภาพใบเสนอราคา", "ภาพแสดงเต็มแผ่น") และถูกนำไป mount ในทั้ง `SheetStonesManager` และ `InstalledStonesManager`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. สร้าง StoneImageManagerField.tsx โดยถอดแบบจาก BasinImageManagerField แต่ปรับบทบาทที่ 3 เป็น "ภาพแสดงเต็มแผ่น (Full Slab)"
  2. เชื่อม StoneImageManagerField เข้ากับ SheetStonesManager.tsx
  3. เชื่อม StoneImageManagerField เข้ากับ InstalledStonesManager.tsx
  4. เพิ่ม Unit Test ตรวจสอบ markup และการ mount ใน artifacts/knight-basins/test/stone-image-manager-field.test.ts

SCOPE:
  - artifacts/knight-basins/src/admin/StoneImageManagerField.tsx
  - artifacts/knight-basins/src/admin/SheetStonesManager.tsx
  - artifacts/knight-basins/src/admin/InstalledStonesManager.tsx
  - artifacts/knight-basins/test/stone-image-manager-field.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็ก: ห้ามแตะต้อง src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องคอมโพเนนต์หน้าร้านและหน้า Studio
  - ห้ามลบช่องระบุราคาหรือฟิลด์เดิมในฟอร์มออก
  - ทำงานผ่าน branch: feat/replit-stone-image-roles-ui แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-stone-image-roles-ui ชัดเจน
  2) pnpm run typecheck → 0 errors
  3) git diff --stat src/index.css → 0 diff (ต้องไม่แตะเลย)
  4) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 659 / pass 659 / fail 0
  5) เทสต์ใหม่ใน test/stone-image-manager-field.test.ts ผ่านครบถ้วน

OUTPUT:
  - branch: feat/replit-stone-image-roles-ui (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้า src/index.css มี diff เกิน 0 บรรทัด
  - ถ้าเทสต์ตกเกิน 0 ข้อ (จาก baseline 659 ผ่าน)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง อย่างเคร่งครัด | ✅ ผ่าน |
| 11 | มอบอำนาจขอบเขต UI แยกจาก Backend ชัดเจน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
