# ใบงาน 103 (Replit) — ปุ่มเพิ่มและลบรูปในหน้าคลังผลงานหลังบ้าน (Add & Delete Photo UI on /admin/portfolio)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Upload/Delete Flow) — เริ่มได้หลัง Task 102 merge

**ที่มาและความต้องการ:**
คุณนพสั่งการตรงๆ ว่า *"ทำให้สามารถเพิ่ม และ ลบ ในหน้านี้ให้หน่อย"* หลังเปิดดูหน้า `/admin/portfolio` (KNIGHT ADMIN · คลังภาพผลงาน)
ปัจจุบันหน้านี้ทำได้แค่ ซ่อน/แสดง รูป และคัดลอกลิงก์ส่งลูกค้า — ต้องเพิ่มความสามารถเขียนจริง โดยใช้ API ที่ชัยสร้างใน Task 102

1. **ปุ่มเพิ่มรูป — `[ ➕ เพิ่มรูปเข้าคลัง ]` (ด้านบนของหน้า):**
   * เลือกหมวดหมู่งานก่อนอัปโหลด (ดึงรายการจาก `categories` ที่ API คืนมาแล้ว — bathroom / counter / kitchen / …)
   * เลือกไฟล์ได้หลายรูปพร้อมกัน (`accept="image/*"`, `multiple`) และลากไฟล์มาวางได้ (drag & drop zone)
   * แสดงตัวอย่างรูปที่เลือก + ช่องชื่อเรื่อง (title) ต่อรูป (ไม่บังคับ)
   * ระหว่างอัปโหลด: ปุ่ม disable + แสดง `กำลังอัปโหลด… (1/3)` กันกดรัว
   * สำเร็จ: เรียก `queryClient.invalidateQueries` ให้ตารางรีเฟรชเอง แล้วขึ้นข้อความ `เพิ่มรูปสำเร็จ`
   * ล้มเหลว: แสดงข้อความไทยที่สุภาพตาม error ที่ API ส่งกลับ (ไฟล์ไม่ใช่ภาพ / ใหญ่เกิน 10MB / ไม่มีสิทธิ์)
2. **ปุ่มลบรูป — บนการ์ดแต่ละใบ และใน Lightbox:**
   * ไอคอนถังขยะมุมบนขวาของการ์ด (`data-testid="button-delete-portfolio-item-<id>"`)
   * ต้องมี **กล่องยืนยันก่อนลบจริงเสมอ**: `ลบรูปนี้ออกจากคลังผลงานถาวร? รูปจะหายจากหน้าเว็บและลบไฟล์ออกจากเซิร์ฟเวอร์`
   * ลบสำเร็จ: รูปหายจาก grid ทันที + ข้อความ `ลบรูปเรียบร้อย`
3. **ป้ายรูปซ้ำ (Duplicate Badge) จาก `GET /api/admin/portfolio/duplicates`:**
   * รูปที่อยู่ในกลุ่มซ้ำ ให้ติดป้าย `🔁 รูปซ้ำ` ที่มุมการ์ด เพื่อให้คุณนพไล่ลบได้เร็ว
   * เพิ่มตัวกรอง `[ 🔁 ดูเฉพาะรูปซ้ำ ]` ในแถบฟิลเตอร์
4. **ห้ามแตะต้องหน้าร้านสาธารณะ:** ปุ่มเพิ่ม/ลบ ต้องอยู่เฉพาะหลังบ้าน `/admin/portfolio` เท่านั้น (ห้ามโผล่ในหน้า `/portfolio` ของลูกค้าเด็ดขาด)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx:
     - เพิ่มปุ่ม [ ➕ เพิ่มรูปเข้าคลัง ] data-testid="button-open-portfolio-upload" พร้อม dialog เลือกหมวดหมู่ + เลือก/ลากไฟล์หลายรูป + ช่อง title
     - ยิง POST /api/admin/portfolio/upload (multipart, field "file") แล้ว invalidate query ให้ grid รีเฟรช
     - เพิ่มปุ่มลบต่อการ์ด data-testid="button-delete-portfolio-item-<id>" และใน Lightbox พร้อมกล่องยืนยันก่อนลบ
     - ยิง DELETE /api/admin/portfolio/:id แล้ว invalidate query
     - ดึง GET /api/admin/portfolio/duplicates แล้วติดป้าย 🔁 รูปซ้ำ + เพิ่มตัวกรองดูเฉพาะรูปซ้ำ
     - disable ปุ่มระหว่างส่ง request ทุกจุด กันกดรัว (double-submit)
  2. สร้าง artifacts/knight-basins/test/admin-portfolio-write-ui.test.ts (ใหม่):
     - ทดสอบว่ามีปุ่มเพิ่ม/ลบและ data-testid ครบ เรียก endpoint ถูก path
     - ทดสอบว่ามีกล่องยืนยันก่อนลบ (ไม่มีทางลบด้วยคลิกเดียว)
     - ทดสอบป้ายรูปซ้ำ + ตัวกรองรูปซ้ำ
     - ทดสอบว่าปุ่มอัปโหลด/ลบไม่ปรากฏในหน้าสาธารณะ (ตรวจจากไฟล์หน้าที่ใช้ร่วมกัน)

SCOPE:
  - artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx
  - artifacts/knight-basins/test/admin-portfolio-write-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์ (ใช้ API จาก Task 102 เท่านั้น)
  - ห้ามใส่ปุ่มอัปโหลด/ลบลงหน้าร้านสาธารณะทุกหน้า
  - ห้ามให้ปุ่มลบทำงานโดยไม่มีกล่องยืนยัน
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-portfolio-write-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 460 / pass 438 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-portfolio-write-ui.test.ts ผ่าน 100%
  5) แนบภาพหน้าจอหน้า /admin/portfolio ที่มีปุ่มเพิ่มและปุ่มลบให้เห็นชัด

OUTPUT:
  - branch: feat/replit-admin-portfolio-write-ui (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าปุ่มลบสามารถลบได้โดยไม่ผ่านกล่องยืนยัน
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
| 10 | ห้ามปุ่มอัปโหลด/ลบโผล่ในหน้าสาธารณะ | ✅ ผ่าน |
| 11 | ต้องมีกล่องยืนยันก่อนลบทุกครั้ง | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
