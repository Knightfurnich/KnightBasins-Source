# ใบงาน 108 (Replit) — แปลงและบีบอัดรูปภาพเป็น WebP ฝั่งเบราว์เซอร์ก่อนอัปโหลด (Client-Side WebP Optimizer on Admin Upload)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Image Optimization) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 103 บอสได้ปุ่ม [ ➕ เพิ่มรูปเข้าคลัง ] บนหน้า /admin/portfolio เรียบร้อยแล้ว
แต่รูปถ่ายจากกล้องมือถือในปัจจุบันมักมีขนาดใหญ่มาก (3MB - 10MB ต่อรูป) หากผู้ใช้อัปโหลดหลายรูปพร้อมกันโดยไม่มีการบีบอัด จะทำให้เปลืองแบนด์วิดท์และเสียเวลาอัปโหลดนาน
Replit จะรับหน้าที่เพิ่มระบบ บีบอัดและแปลงรูปภาพเป็น WebP ฝั่งเบราว์เซอร์ (Client-Side Preprocessing) ก่อนส่งไปยัง API:

1. **การบีบอัดและปรับสเกลภาพก่อนอัปโหลด (Canvas / OffscreenCanvas API):**
   * ในฟังก์ชันอัปโหลดของ artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx
   * เมื่อผู้ใช้เลือกรูปภาพ (JPG, PNG, หรือไฟล์รูปทั่วไป):
     - โหลดภาพลงใน canvas ในหน่วยความจำ
     - หากภาพมีมิติด้านที่ยาวที่สุดเกิน 1920px ให้ย่อสัดส่วนลงมาให้ด้านยาวสุดพอดี 1920px (สเกล Full HD คมชัดสูงสำหรับหน้าเว็บ)
     - แปลงและ Export เป็น image/webp ที่คุณภาพ 82% (quality: 0.82)
     - หากเบราว์เซอร์ไม่รองรับ WebP หรือไฟล์มีขนาดเล็กอยู่แล้ว ให้ fallback ใช้ไฟล์ต้นฉบับอย่างปลอดภัย
   * ผลลัพธ์: ขนาดไฟล์จะลดลง 60–80% (จาก 5MB เหลือเพียง ~100KB-300KB) ทำให้การอัปโหลดเร็วขึ้นอย่างเห็นได้ชัด
2. **การแสดงสถานะและขนาดไฟล์ที่ประหยัดได้ (UX Enhancement):**
   * ในหน้าต่าง Upload Dialog: เมื่อเลือกรูปภาพ ให้แสดงขนาดไฟล์ก่อนและหลังบีบอัด เช่น 5.2 MB -> 180 KB (-96%) เพื่อให้ผู้ใช้เห็นความฉับไว
3. **เขียน Automated Test ยืนยันใน artifacts/knight-basins/test/admin-portfolio-webp-optimizer.test.ts (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx:
     - เพิ่ม helper ฟังก์ชันสำหรับบีบอัดและแปลงรูปภาพเป็น WebP ฝั่งเบราว์เซอร์ (Max width/height 1920px, quality 0.82)
     - แปลงรูปภาพที่เลือกก่อนส่งเข้า formData ใน uploadPortfolioItem()
     - แสดงขนาดไฟล์ที่ลดลงใน Upload Dialog ให้ผู้ใช้ทราบ
  2. สร้าง artifacts/knight-basins/test/admin-portfolio-webp-optimizer.test.ts (ใหม่):
     - ทดสอบฟังก์ชันการคำนวณและปรับขนาดภาพไม่เกิน 1920px
     - ทดสอบ fallback เมื่อรูปเป็น WebP อยู่แล้วหรือไม่ต้องการบีบอัด
     - ทดสอบการส่ง payload ไปยัง endpoint /api/admin/portfolio/upload

SCOPE:
  - artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx
  - artifacts/knight-basins/test/admin-portfolio-webp-optimizer.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้ปุ่มอัปโหลด/ลบรูปเดิมเสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-portfolio-webp-optimizer แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 475 / pass 453 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-portfolio-webp-optimizer.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานใน PR description

OUTPUT:
  - branch: feat/replit-admin-portfolio-webp-optimizer (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
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
| 11 | บีบอัดรูปภาพเป็น WebP ฝั่งเบราว์เซอร์ก่อนส่ง | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
