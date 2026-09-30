# ใบงาน 148 (Replit) — หน้าพอร์ทัลลูกค้าสำหรับติดตามสถานะงาน 24 ชม. (/track Customer Job Tracking Portal UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Customer Experience UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 12 ในคู่มือ KRAKEN ERP** (Customer Portal):
> *"ให้ลูกค้าเข้าดูงานของตัวเองได้โดยไม่ต้องโทรถาม: ดูแบบที่อนุมัติ, ความคืบหน้างานติดตั้ง, รูปถ่ายหน้างาน และยอดชำระ — เห็นเฉพาะข้อมูลของตัวเอง"*

งานนี้คือการสร้างหน้าเว็บพอร์ทัลหรูหราสำหรับลูกค้าที่เส้นทาง `/track` (`src/pages/CustomerTrackingPage.tsx`):
1. **การเข้าถึงที่ปลอดภัย (Token-based URL):**
   * ลูกค้าเปิดผ่านลิงก์เฉพาะ: `/track?token=<publicQuoteToken>`
   * ดึงข้อมูลสดจาก API: `GET /api/public/track?token=...` (ชัยกำลังพัฒนาใน Task 147)
2. **องค์ประกอบบนหน้าจอพอร์ทัลลูกค้า (`CustomerTrackingPage.tsx`):**
   * 🏷️ **หัวเอกสารแบรนด์พรีเมียม:** โลโก้ ไนท์ เฟอร์นิช, รหัสงาน/ใบเสนอราคา, วันที่ และชื่อโครงการ
   * ⏱️ **ไทม์ไลน์สถานะ 5 ขั้นตอน (Progress Stepper):**
     1. 📝 `รับออเดอร์/ยืนยันแบบ`
     2. 🏭 `กำลังตัดประกอบหิน`
     3. 📦 `ผลิตเสร็จ นัดหมายติดตั้ง`
     4. 🚚 `ทีมช่างเข้าติดตั้งหน้างาน`
     5. ✅ `ส่งมอบงานเรียบร้อย`
     *(แสดงไอคอนและสีสถานะชัดเจนว่าปัจจุบันอยู่ขั้นไหน ขั้นที่ผ่านแล้วเป็นสีเขียว)*
   * 📐 **การ์ดสรุปแบบเคาน์เตอร์ที่เลือก:** แสดงรุ่นอ่าง, ชนิดและสีหินสังเคราะห์, ขนาดแผ่น
   * 📸 **แกลเลอรีรูปถ่ายหน้างานส่งมอบ (Completed Work Gallery):**
     - ถ้ามีรูปถ่ายส่งมอบจากช่าง ให้แสดงเป็น Grid การ์ดรูปถ่ายหน้างานจริงสวยงาม คลิกดูรูปขนาดใหญ่ได้
     - ถ้ายังอยู่ในขั้นตอนผลิต ให้แสดงข้อความว่า *"อยู่ระหว่างการผลิตและเตรียมการติดตั้ง"*
   * 📲 **ปุ่มกดติดต่อฝ่ายขาย / LINE Official:** มีปุ่มกดแอด LINE `@789gcnhq` ทักหาน้องไนท์เพื่อสอบถามเพิ่มเติม
3. **ในหน้าจัดการ Lead (`/admin/leads`):**
   * บนแถว Lead ที่มี `publicQuoteToken` ให้เพิ่มปุ่ม:
     `<Button data-testid={`button-copy-track-link-${lead.id}`}>🔗 ลิงก์ติดตามงาน</Button>`
     กดคลิกเดียวคัดลอก URL `/track?token=...` เพื่อส่งให้ลูกค้าใน LINE ได้ทันที

**รายละเอียดไฟล์ที่เกี่ยวข้อง:**
1. สร้าง `artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx` (ใหม่)
2. แก้ไข `artifacts/knight-basins/src/App.tsx` เพื่อลงทะเบียน Route:
   `<Route path="/track" component={CustomerTrackingPage} />`
3. แก้ไข `artifacts/knight-basins/src/admin/LeadsManager.tsx` เพิ่มปุ่มคัดลอกลิงก์ติดตามงาน
4. สร้าง Unit Tests ใน `artifacts/knight-basins/test/customer-tracking-portal.test.ts` (ใหม่)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx:
     - มี data-testid="page-customer-tracking"
     - แสดงไทม์ไลน์ 5 ขั้นตอน (data-testid="timeline-job-tracking")
     - แสดงรายละเอียดงานและแกลเลอรีรูปถ่ายส่งมอบ (data-testid="gallery-completed-photos")
  2. แก้ไข artifacts/knight-basins/src/App.tsx เพิ่ม Route path="/track"
  3. แก้ไข artifacts/knight-basins/src/admin/LeadsManager.tsx เพิ่มปุ่มคัดลอกลิงก์ติดตามงาน
  4. สร้าง artifacts/knight-basins/test/customer-tracking-portal.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/pages/CustomerTrackingPage.tsx · (ใหม่)
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/customer-tracking-portal.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx และ WorkshopProductionSheet.tsx
  - ห้ามแสดงข้อมูลต้นทุน, ช่างภายใน, หรือ notes ให้ลูกค้าเห็น
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-customer-tracking-portal แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 587 / pass 566 / fail 21 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/customer-tracking-portal.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-customer-tracking-portal (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
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
| 11 | อนุรักษ์ความเป็นส่วนตัวของข้อมูลลูกค้า | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
