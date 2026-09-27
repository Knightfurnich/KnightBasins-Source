# ใบงาน 119 (Replit) — จัดการภาพหน้างานช่าง: ลบภาพ, ย้ายขั้นตอน, และแก้ไขคำอธิบายงาน (Site Photos Management UI)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Site Photos UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพต้องการให้หน้าจัดการภาพหน้างานช่าง (`/admin/site-photos`) มีความยืดหยุ่นในการจัดการภาพจริง:
1. **ลบภาพได้:** ภาพที่ไม่ถูกต้อง หรือภาพซ้ำ สามารถกดลบออกจากระบบได้ (มีปุ่มยืนยัน)
2. **ย้ายขั้นตอนได้ (Quick Stage Switcher):** บางภาพเป็น "วัดหน้างาน" แต่อยู่ผิดหมวด สามารถคลิกเปลี่ยนหมวดหมู่ (stage) ได้ทันที
3. **ระบุรายละเอียด/ชื่องาน/เจ้าของงานได้:** แก้ไขคำอธิบาย (`description`) เพื่อบอกว่าภาพนี้เป็นงานของใคร ที่ไหน

**API หลังบ้านที่พร้อมใช้งาน 100%:**
* `DELETE /api/admin/site-photos/:id` (ลบภาพและไฟล์จริง - Task 118 พร้อมใช้งาน)
* `PATCH /api/admin/site-photos/:id` (ส่ง `{ stage?: 'survey'|'installation'|'service'|'completed', description?: string }`)

**รายละเอียดงานที่ต้องทำใน `artifacts/knight-basins/src/admin/SitePhotosPage.tsx`:**
1. **เพิ่มปุ่มลบภาพ `[ 🗑️ ลบภาพ ]` บนการ์ดภาพแต่ละใบ:**
   * มี attribute `data-testid="button-delete-site-photo"`
   * เมื่อกด ให้แสดง Dialog หรือ Modal ยืนยันการลบ: *"คุณต้องการลบภาพนี้ออกจากระบบใช่หรือไม่?"*
   * เมื่อยืนยัน: ส่ง `DELETE /api/admin/site-photos/:id` และรีเฟรชข้อมูลในหน้านั้นทันที
2. **เพิ่มปุ่มดรอปดาวน์เลือกย้ายขั้นตอน (Stage Switcher):**
   * ที่ป้ายสถานะเดิม (เช่น "งานติดตั้ง", "เก็บงาน/เซอร์วิส") ให้มีดรอปดาวน์หรือปุ่ม `[ 🔀 ย้ายขั้นตอน ]`
   * มีตัวเลือก 4 ขั้นตอน:
     - 📐 `survey` (วัดหน้างาน)
     - 🔧 `installation` (งานติดตั้ง)
     - 🛠️ `service` (เก็บงาน/เซอร์วิส)
     - ✅ `completed` (เสร็จสมบูรณ์)
   * เมื่อเลือก: ส่ง `PATCH /api/admin/site-photos/:id` ด้วย `{ stage: newStage }`
3. **เพิ่มปุ่มแก้ไขคำอธิบาย `[ ✏️ แก้ไขข้อมูลงาน ]`:**
   * ให้เปิดช่องกรอกข้อความสำหรับแก้ `description` เช่น "บ้านเดี่ยว คุณสมชาย ซอยราชพฤกษ์ 15"
   * กดบันทึกแล้วส่ง `PATCH /api/admin/site-photos/:id` ด้วย `{ description: text }`
4. **สร้าง Automated Unit Tests ใน `artifacts/knight-basins/test/admin-site-photos-manage.test.ts` (ใหม่):**
   * ทดสอบการแสดงปุ่มลบ, ย้ายขั้นตอน และแก้ไขคำอธิบาย
   * ทดสอบการกดลบและกล่องยืนยัน
   * ทดสอบการเปลี่ยน stage ผ่าน PATCH

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/SitePhotosPage.tsx:
     - เพิ่มปุ่มลบภาพพร้อมกล่องยืนยัน เรียก DELETE /api/admin/site-photos/:id (data-testid="button-delete-site-photo")
     - เพิ่มดรอปดาวน์เปลี่ยนขั้นตอน (survey, installation, service, completed) เรียก PATCH /api/admin/site-photos/:id
     - เพิ่มช่องทางแก้ไขคำอธิบายงาน (description) เพื่อระบุชื่องาน/สถานที่
  2. สร้าง artifacts/knight-basins/test/admin-site-photos-manage.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/SitePhotosPage.tsx
  - artifacts/knight-basins/test/admin-site-photos-manage.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้องหน้าร้านสาธารณะ
  - ห้ามลบภาพโดยไม่มีกล่องยืนยัน (Confirmation Dialog)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-site-photos-manage แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 491 / pass 469 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-site-photos-manage.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-site-photos-manage (เปิด PR เข้า main)
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | มีกล่องยืนยันก่อนลบภาพเพื่อความปลอดภัย | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
