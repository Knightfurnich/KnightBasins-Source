# ใบงาน 144 (Replit) — ปุ่มลบ Lead พร้อมระบบล็อกความปลอดภัยทางการเงิน (Lead Delete with Financial Safety Lock UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Lead Management UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 140 ชัยได้สร้าง API `DELETE /api/admin/leads/:id` และส่งฟิลด์ `hasMatchedSlip`, `paymentSlipCount` ใน `GET /api/admin/leads` ขึ้น Production VPS เรียบร้อยแล้ว (ถอดแบบกฎเหล็กข้อ 10 & 18 ของ KRAKEN ERP)
งานนี้คือการนำระบบล็อกความปลอดภัยทางการเงินนี้มาแสดงผลบนหน้าจอจัดการ Lead (`/admin/leads`):
1. **งานที่มีสลิปโอนเงินผูกอยู่ (`hasMatchedSlip === true`):**
   * แสดงป้ายล็อกความปลอดภัยทางการเงิน: **`[ 🔒 มีสลิปการเงิน ({paymentSlipCount}) ]`**
   * **ปุ่มลบถูก Disable (ปิดการใช้งาน)** พร้อม tooltip เตือนว่า *"ไม่สามารถลบงานนี้ได้เนื่องจากมีรายการโอนเงินในระบบ"*
2. **งานที่ไม่มีสลิปผูกอยู่ (`hasMatchedSlip === false`):**
   * มีปุ่ม **`[ 🗑️ ลบงาน ]`** ให้แอดมินกดได้
   * เมื่อกด ให้เด้งหน้าต่างยืนยัน (Confirmation Dialog) พร้อมแจ้งเตือนชื่อลูกค้าและรหัสงานเพื่อความปลอดภัย
   * เมื่อยืนยัน จะเรียก `DELETE /api/admin/leads/:id` และอัปเดตแคช (Invalidate Query) ทำให้แถวข้อมูลหายไปทันที

**รายละเอียดสิ่งที่ต้องทำ:**

1. **ใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:**
   * ในแถวของแต่ละ Lead (หรือในส่วนขยายรายละเอียดงาน):
     - ตรวจสอบค่า `lead.hasMatchedSlip` (boolean) และ `lead.paymentSlipCount` (number)
     - ถ้า `lead.hasMatchedSlip` เป็นจริง:
       - แสดง Badge: `<span data-testid={`badge-financial-lock-${lead.id}`}>🔒 มีสลิป {lead.paymentSlipCount} ใบ</span>`
       - ปุ่มลบ: `<Button disabled data-testid={`button-delete-lead-${lead.id}`} title="มีรายการเงินผูกอยู่ ไม่สามารถลบได้">🗑️ ลบงาน</Button>`
     - ถ้า `lead.hasMatchedSlip` เป็นเท็จ (หรือไม่มีสลิป):
       - ปุ่มลบสามารถคลิกได้: `<Button data-testid={`button-delete-lead-${lead.id}`}>🗑️ ลบงาน</Button>`
       - เปิด Dialog ยืนยันการลบ (`data-testid="dialog-confirm-delete-lead"`)
       - กดยืนยัน ➔ ส่งคำขอ `DELETE /api/admin/leads/${lead.id}` (Method DELETE, credentials: include)
       - แจ้ง Toast สำเร็จ และรีเฟรชข้อมูลในตาราง
2. **สร้าง Unit Tests ใน `artifacts/knight-basins/test/admin-financial-safety-lock-ui.test.ts` (ใหม่):**
   * ใช้รูปแบบ **Static Source Inspection** (`readFileSync`):
     - ตรวจสอบการตรวจเช็ค `hasMatchedSlip` และ `paymentSlipCount`
     - ตรวจสอบการปิดปุ่มลบ (`disabled`) เมื่อมีสลิป
     - ตรวจสอบ `data-testid` ครบถ้วนตามที่ระบุข้างต้น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. เพิ่มปุ่มลบ Lead พร้อมระบบล็อกความปลอดภัยทางการเงินใน artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - แสดง Badge ล็อกและปิดปุ่มลบ (disabled) เมื่องานมีสลิปโอนเงิน (hasMatchedSlip === true)
     - มีปุ่มลบและ Dialog ยืนยัน พร้อมยิง DELETE /api/admin/leads/:id เมื่องานไม่มีสลิป
  2. สร้าง artifacts/knight-basins/test/admin-financial-safety-lock-ui.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-financial-safety-lock-ui.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx, App.tsx และ WorkshopProductionSheet.tsx
  - ห้ามลบข้อมูลโดยไม่มีกล่องยืนยัน (Confirmation Dialog)
  - ห้ามใช้ dynamic import คอมโพเนนต์ในไฟล์เทสต์ (จะพังเพราะไม่มี import.meta.env)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-financial-safety-lock-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 580 / pass 558 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-financial-safety-lock-ui.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-financial-safety-lock-ui (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ระบบล็อกความปลอดภัยทางการเงิน (Financial Safety Lock) | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
