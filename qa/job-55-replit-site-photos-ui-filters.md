# ใบงาน 55 (Replit) — เพิ่มแถบตัวกรอง 'ยังไม่ระบุรหัสงาน' และตัวเลือกเดือน ในหน้าคลังภาพหน้างาน (/admin/site-photos)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ในหน้าคลังภาพหน้างาน เมื่อมีรูปเพิ่มขึ้นเป็นจำนวนมาก เจ้าของระบบ (คุณนพ) ต้องการให้มีปุ่มคัดกรองด่วนเพื่อแยกดูเฉพาะ "รูปที่ยังไม่ระบุรหัสงาน" เพื่อให้แอดมินเข้าไปไล่ใส่รหัสงานได้ง่าย และตัวเลือกเลือกดูตามเดือน เพื่อไม่ให้รูปปนกันจนแน่นจอ

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มตัวกรองเสริมในหน้าคลังภาพหน้างาน (/admin/site-photos):
  1. เพิ่มปุ่มตัวกรอง: `[ ⚠️ ยังไม่ระบุรหัสงาน ]` ข้างปุ่มสถานะเดิม
     - เมื่อคลิก จะแสดงเฉพาะรูปภาพที่ยังไม่มี `jobCode` (jobCode เป็น null หรือว่าง)
  2. เพิ่มดรอปดาวน์เลือกเดือน (เช่น ทุกเดือน, ก.ย. 69, ส.ค. 69, ก.ค. 69)
     - กรองเฉพาะรูปภาพที่มี `capturedAt` อยู่ในเดือนที่เลือก
  3. เขียน Unit tests ใน `admin-site-photos-extra-filters.test.ts` ยืนยันการทำงานของตัวกรอง

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/admin/SitePhotosPage.tsx
  2. artifacts/knight-basins/test/admin-site-photos-extra-filters.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-site-photos-filters แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 236 / pass 231 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้าคลังภาพแสดงปุ่ม `[ ⚠️ ยังไม่ระบุรหัสงาน ]` และดรอปดาวน์เลือกเดือน
     - ภาพหลังคลิกกรองเฉพาะรูปที่ยังไม่ระบุรหัสงาน

OUTPUT:
  - branch: feat/replit-site-photos-filters (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน SitePhotosPage.tsx:
     - เพิ่มสถานะ `onlyUnassigned` (boolean) ใน state:
       เมื่อเปิด ให้ filter รูปภาพเฉพาะที่ `!photo.jobCode || photo.jobCode.trim() === ""`
     - เพิ่มปุ่มในแถบตัวกรอง:
       ```tsx
       <button
         type="button"
         onClick={() => setOnlyUnassigned((prev) => !prev)}
         className={`h-9 px-3 text-xs font-bold border transition ${
           onlyUnassigned
             ? "bg-amber-500 text-white border-amber-600"
             : "bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-amber-500"
         }`}
         data-testid="button-filter-unassigned"
       >
         ⚠️ ยังไม่ระบุรหัสงาน
       </button>
       ```
     - ดรอปดาวน์เลือกเดือน กรองตาม `photo.capturedAt`
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ เพิ่มตัวกรองยังไม่ระบุงานและเลือกเดือนในคลังภาพ |
| 2 | GOAL วัดได้ | ✅ ปุ่ม unassigned + dropdown เดือน + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 236/231/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-site-photos-filters |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 236 / pass 231 / fail 2 |
| 9 | CONTRACT ระบุ state และ JSX ชัด | ✅ onlyUnassigned และปุ่มสีอำพันชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
