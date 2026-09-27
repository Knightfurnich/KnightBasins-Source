# ใบงาน 123 (Replit) — เพิ่มปุ่มคัดลอกสรุปคิวช่างรายวันส่ง LINE (Daily Technician Schedule LINE Copy)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Calendar UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าปฏิทินคิวช่างติดตั้ง (`/admin/calendar`) เมื่อแอดมินคลิกเลือกดูคิวงานของแต่ละวันในแผงรายละเอียด (Day Details Sheet / Drawer)
แอดมินต้องการ **"ปุ่มคัดลอกสรุปคิวช่างของวันนั้น เพื่อส่งเข้ากลุ่ม LINE ทีมงานด่วน"** โดยจัดรูปแบบให้อ่านง่าย มีข้อมูลทีมช่าง, ชื่องาน, โครงการ, และสถานที่ติดตั้ง พร้อมใช้งานได้ทันที

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx`:**
1. **เพิ่มปุ่ม `[ 📋 คัดลอกคิวงานส่ง LINE ]` ในแผงรายละเอียดประจำวัน (Day Sheet / Drawer):**
   * วางในตำแหน่งส่วนหัวของแผงรายละเอียดวันที่เลือก (เช่น ข้างๆ สรุปจำนวนงาน หรือใน SheetHeader)
   * มี attribute `data-testid="button-calendar-copy-daily-schedule"`
   * เมื่อกดปุ่ม: รวมข้อมูลงานของวันที่เลือก และจัดฟอร์แมตข้อความสรุปแยกตามทีมช่าง (ชื่องาน, โครงการ, สถานที่) พร้อมหมายเหตุสภาพอากาศถ้ามี
   * หากวันนั้นไม่มีคิวงาน ให้จัดฟอร์แมตแจ้งว่า "ไม่มีคิวงานติดตั้งในวันนี้"
   * คัดลอกข้อความลง Clipboard และแสดง Toast แจ้งเตือน: "คัดลอกสรุปคิวงานส่ง LINE เรียบร้อยแล้ว"
2. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-calendar-copy-schedule.test.ts` (ใหม่):**
   * ทดสอบปุ่มคัดลอกคิวงานแสดงผลในแผงรายละเอียดของวัน
   * ทดสอบการจัดฟอร์แมตข้อความสรุปคิวงานที่มีข้อมูลทีมช่างและชื่องานถูกต้อง
   * ทดสอบกรณีวันที่ไม่มีคิวงาน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx:
     - เพิ่มปุ่มคัดลอกสรุปคิวงานส่ง LINE (data-testid="button-calendar-copy-daily-schedule") ในแผงรายละเอียดวันที่เลือก
     - จัดฟอร์แมตข้อความสรุปคิวงานแยกตามทีมช่าง พร้อมวันเวลาภาษาไทยและสภาพอากาศ คัดลอกลง Clipboard พร้อม Toast
  2. สร้าง artifacts/knight-basins/test/admin-calendar-copy-schedule.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  - artifacts/knight-basins/test/admin-calendar-copy-schedule.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเปลี่ยนตรรกะการคำนวณคิวงานหรือ API ปฏิทินเดิม
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-calendar-copy-schedule แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 507 / pass 485 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-calendar-copy-schedule.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-calendar-copy-schedule (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ตรรกะปฏิทินและวันหยุดเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
