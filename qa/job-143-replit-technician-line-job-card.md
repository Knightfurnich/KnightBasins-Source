# ใบงาน 143 (Replit) — ปุ่มสร้างการ์ดงานช่างส่งเข้า LINE ในหน้าปฏิทินติดตั้ง (Technician LINE Job Dispatch Card UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Logistics & Operations UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่ออำนวยความสะดวกให้ทีมช่างหน้างานและหัวหน้าช่าง: ปัจจุบันเมื่อถึงคิวงานติดตั้ง ช่างหน้างานต้องการข้อมูลสรุปงานที่กระชับเพื่อนำไปเปิดดูในมือถือขณะขับรถหรือเตรียมของ
งานนี้คือการเพิ่มปุ่ม **`[ 📲 คัดลอกการ์ดงานส่ง LINE ช่าง ]`** บนการ์ดงานแต่ละงานในหน้าปฏิทินช่าง (`/admin/calendar`):
1. บนการ์ดงานติดตั้ง (`JobCard`) เพิ่มปุ่มคัดลอกข้อความสรุปงานสำหรับการส่งเข้า LINE ของทีมช่าง
2. ข้อความที่คัดลอกจะประกอบด้วย:
   - 📌 **รหัสงานและโครงการ:** เช่น `JB26/1012`
   - 👤 **ชื่อลูกค้า:**
   - 📍 **ที่อยู่หน้างาน:**
   - 🧭 **ลิงก์ Google Maps สำหรับนำทาง:** (ดึงจากลิงก์แผนที่ที่มีในงาน)
   - 🛠️ **ประเภทงาน/ขั้นตอน:** เช่น `วัดงาน`, `ติดตั้ง`, `เก็บงาน`
   - 📞 **เบอร์ติดต่อลูกค้า:** (ถ้ามีในข้อมูลงาน)
3. เมื่อคลิกปุ่ม ให้คัดลอกข้อความลง Clipboard ทันที พร้อมแสดง Toast แจ้งเตือนภาษาไทยว่า *"คัดลอกการ์ดงานสำหรับส่ง LINE ช่างเรียบร้อย"*
4. ตรรกะการจัดฟอร์แมตข้อความทั้งหมดทำงานฝั่ง Frontend 100% ไม่ต้องพึ่งพา backend เพิ่มเติม

**รายละเอียดสิ่งที่ต้องทำ:**

1. **ใน `artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx`:**
   * สร้างฟังก์ชันผู้ช่วยสำหรับจัดฟอร์แมตข้อความ:
     `export function formatTechnicianJobCard(job: CalendarJobItem, dateIso: string): string`
     - จัดรูปแบบข้อความให้อ่านง่าย มี emoji กำกับชัดเจนตามมาตรฐานของ Knight
     - มีลิงก์ Google Maps กำกับในข้อความเพื่อให้ช่างกดแตะนำทางจากในห้องแช็ต LINE ได้ทันที
   * บนการ์ดงานติดตั้งแต่ละใบ (`JobCard`) เพิ่มปุ่ม:
     `<Button data-testid={`button-copy-technician-card-${job.id}`}>📲 การ์ดงานช่าง</Button>`
   * มีสถานะแจ้งผลเมื่อคัดลอกสำเร็จ
2. **สร้าง Unit Tests ใน `artifacts/knight-basins/test/technician-line-job-card.test.ts` (ใหม่):**
   * ทดสอบฟังก์ชัน `formatTechnicianJobCard`:
     - ต้องมีรหัสงาน, ชื่อลูกค้า, ที่อยู่ และลิงก์ Google Maps
     - กรณีไม่มีเบอร์โทรหรือที่อยู่ ต้องไม่ขึ้น `undefined` หรือ `null`
   * ทดสอบ UI ด้วย Static Source Inspection (`readFileSync`):
     - ตรวจสอบ `data-testid` ปุ่มคัดลอกการ์ดงานช่างครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. เพิ่มฟังก์ชัน formatTechnicianJobCard ใน artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  2. เพิ่มปุ่มคัดลอกการ์ดงานส่ง LINE ช่างบน JobCard ใน artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  3. สร้าง artifacts/knight-basins/test/technician-line-job-card.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  - artifacts/knight-basins/test/technician-line-job-card.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx, App.tsx และ WorkshopProductionSheet.tsx
  - ห้ามลบหรือแก้ไขฟังก์ชันการจัดคิวหรือปุ่มแผนที่เดิม
  - ห้ามใช้ dynamic import คอมโพเนนต์ในไฟล์เทสต์ (จะพังเพราะไม่มี import.meta.env)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-technician-line-job-card แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 580 / pass 558 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/technician-line-job-card.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-technician-line-job-card (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ระบบปฏิทินและแผนที่เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
