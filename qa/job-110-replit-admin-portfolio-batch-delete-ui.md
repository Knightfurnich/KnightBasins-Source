# ใบงาน 110 (Replit) — เพิ่มระบบเลือกหลายรูปและปุ่มลบเป็นชุดในคลังผลงาน (Portfolio Multi-Select & Batch Delete UI)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Batch Actions) — เริ่มได้ทันที (ต่อยอดจาก Task 109 API ที่ชัยเพิ่ง deploy)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ชัยทำ API ลบรูปภาพพร้อมกันหลายรายการ (`POST /api/admin/portfolio/batch-delete`) ขึ้น Production VPS เรียบร้อยแล้วใน Task 109
เพื่ออำนวยความสะดวกให้คุณนพและทีมงานในการเคลียร์รูปซ้ำหรือจัดระเบียบคลังภาพ Replit จะรับหน้าที่ทำ UI ให้สามารถ **ติ๊กเลือกหลายๆ รูปพร้อมกันแล้วกดลบในคลิกเดียว**:

1. **โหมดเลือกหลายรูป (Multi-Select Mode):**
   * ในหน้า `/admin/portfolio` (`artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx`):
   * เพิ่มปุ่ม **`[ ☑️ เลือกหลายรูป ]`** ด้านบน (ข้างปุ่มเพิ่มรูป)
   * เมื่อเข้าสู่โหมดเลือกหลายรูป:
     - การ์ดทุกใบจะมี Checkbox ขึ้นที่มุมซ้ายบน
     - มีปุ่มทางลัด **`[ เลือกทั้งหมดในหน้านี้ ]`** และ **`[ ยกเลิกการเลือก ]`**
     - แถบด้านล่างหรือด้านบนจะขึ้นตัวเลข: *"เลือกแล้ว X รายการ"* (จำกัดไม่เกิน 50 รายการตามขีดจำกัดของ API)
2. **ปุ่มสั่งลบเป็นชุด `[ 🗑️ ลบที่เลือก (X) ]`:**
   * เมื่อคลิกปุ่มลบที่เลือก:
     - ต้องแสดง **กล่องยืนยันก่อนลบ (Confirmation Dialog)** เสมอ: `"คุณต้องการลบรูปภาพที่เลือกจำนวน X รูปอย่างถาวรใช่หรือไม่? รูปภาพและไฟล์จริงบนเซิร์ฟเวอร์จะถูกลบทันที"`
     - เมื่อกดยืนยัน: ยิง API `POST /api/admin/portfolio/batch-delete` พร้อม payload `{ ids: selectedIds }`
     - ระหว่างส่ง request: ปุ่ม disable + ขึ้น `กำลังลบ…` ป้องกันการกดซ้ำ
     - สำเร็จ: ล้างรายการที่เลือก, ปิดโหมดเลือกหลายรูป, รีเฟรชตารางรูปภาพอัตโนมัติ และแสดงข้อความแจ้งเตือนสีเขียว: `"ลบรูปภาพเรียบร้อยแล้ว X รายการ"`
3. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/admin-portfolio-batch-delete-ui.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx:
     - เพิ่มปุ่ม [ ☑️ เลือกหลายรูป ] data-testid="button-portfolio-toggle-multiselect"
     - แสดง Checkbox บนการ์ดแต่ละใบ data-testid="checkbox-portfolio-item-<id>"
     - แสดงปุ่มลบเป็นชุด [ 🗑️ ลบที่เลือก (X) ] data-testid="button-portfolio-batch-delete"
     - แสดงกล่องยืนยันก่อนลบเป็นชุดเสมอ (มีปุ่มยืนยัน data-testid="button-confirm-batch-delete")
     - เรียกใช้ API POST /api/admin/portfolio/batch-delete แล้ว invalidateQueries ให้กริดรีเฟรช
  2. สร้าง artifacts/knight-basins/test/admin-portfolio-batch-delete-ui.test.ts (ใหม่):
     - ทดสอบการเปิด/ปิดโหมดเลือกหลายรูป
     - ทดสอบการเลือกรูปและปุ่มลบเป็นชุดพร้อมตัวเลขนับจำนวน
     - ทดสอบว่ามีกล่องยืนยันก่อนลบจริงเสมอ
     - ทดสอบการยิง API batch-delete ด้วยรายการ ids ที่เลือก

SCOPE:
  - artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx
  - artifacts/knight-basins/test/admin-portfolio-batch-delete-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามใส่ปุ่มลบเป็นชุดลงในหน้าร้านสาธารณะทุกหน้า (อยู่เฉพาะ /admin/portfolio)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-portfolio-batch-delete-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 475 / pass 453 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-portfolio-batch-delete-ui.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานใน PR description

OUTPUT:
  - branch: feat/replit-admin-portfolio-batch-delete-ui (เปิด PR เข้า main)
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
| 11 | ต้องมีกล่องยืนยันก่อนลบเป็นชุดเสมอ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
