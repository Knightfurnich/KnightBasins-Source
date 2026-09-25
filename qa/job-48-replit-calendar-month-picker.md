# ใบงาน 48 (Replit) — ตัวเลือกเดือน/ปี (Month & Year Selector Dropdown) ในหน้าปฏิทินคิวช่าง (/admin/calendar)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้หน้าปฏิทินคิวช่างมีตัวเลือกแบบเลื่อนเดือนได้โดยตรง แทนที่จะต้องกดปุ่ม "ก่อนหน้า" หรือ "ถัดไป" ทีละเดือน เพื่อให้แอดมินและทีมงานสามารถกระโดดไปดูคิวงานล่วงหน้าหรือย้อนหลังในเดือนใดก็ได้ทันทีใน 1 คลิก

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มดรอปดาวน์เลือกเดือนและปีในหน้าปฏิทินคิวช่าง (/admin/calendar):
  1. เพิ่มตัวเลือกเดือน (มกราคม - ธันวาคม) และปี พ.ศ. (2568, 2569, 2570) ไว้ข้างปุ่ม "ก่อนหน้า / ถัดไป"
  2. เมื่อเลือกเดือนหรือปี ให้ปรับเปลี่ยนมุมมองปฏิทินไปยังเดือน/ปีที่เลือกทันที
  3. เขียน Unit tests ใน technician-calendar-month-picker.test.ts ยืนยันการทำงานของฟังก์ชันเลือกเดือน/ปี

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  2. artifacts/knight-basins/test/technician-calendar-month-picker.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-calendar-month-picker แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 213 / pass 208 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้าปฏิทินแสดงดรอปดาวน์เลือกเดือน/ปี ชัดเจน
     - ภาพหลังเลือกเดือนอื่น (เช่น ตุลาคม 2569) ปฏิทินแสดงเดือนนั้นทันที

OUTPUT:
  - branch: feat/replit-calendar-month-picker (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน TechnicianCalendarPage.tsx:
     - ระหว่างปุ่ม "ก่อนหน้า / ถัดไป" และปุ่ม "วันนี้":
       เพิ่มกลุ่มเลือกเดือนและปี:
       ```tsx
       <div className="flex items-center gap-1.5" role="group" aria-label="เลือกเดือนและปี">
         <select
           value={currentMonth}
           onChange={(e) => selectMonth(Number(e.target.value))}
           className="h-9 px-2 text-xs border border-[var(--line)] bg-[var(--paper)] font-medium rounded-none"
           aria-label="เลือกเดือน"
           data-testid="select-calendar-month"
         >
           {THAI_MONTHS.map((name, idx) => (
             <option key={name} value={idx}>{name}</option>
           ))}
         </select>
         <select
           value={currentYear}
           onChange={(e) => selectYear(Number(e.target.value))}
           className="h-9 px-2 text-xs border border-[var(--line)] bg-[var(--paper)] font-medium rounded-none"
           aria-label="เลือกปี"
           data-testid="select-calendar-year"
         >
           {[2025, 2026, 2027].map((y) => (
             <option key={y} value={y}>{y + 543}</option>
           ))}
         </select>
       </div>
       ```
     - ฟังก์ชัน `selectMonth` และ `selectYear`:
       ปรับ `currentDate` ไปยังเดือน/ปีที่ระบุ โดยรักษาวันที่ 1 หรือวันปัจจุบันไว้ และอัปเดตมุมมองทั้งรายเดือนและรายสัปดาห์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ตัวเลือกเดือน/ปี ในหน้าปฏิทินคิวช่าง |
| 2 | GOAL วัดได้ | ✅ Dropdown เดือน/ปี + เปลี่ยนมุมมอง + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 213/208/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-calendar-month-picker |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 213 / pass 208 / fail 2 |
| 9 | CONTRACT ระบุโค้ด JSX และตัวเลือก | ✅ รายชื่อเดือนไทยและปี พ.ศ. ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
