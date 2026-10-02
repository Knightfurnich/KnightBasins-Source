# ใบงาน 197-R (Replit) — Fix Studio Saved Quote Stone Image & Slab Modal Focus (Bug Fix P2)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที
**Branch:** `feat/replit-fix-p2-bugs`
**วัตถุประสงค์:** แก้ไขข้อบกพร่องระดับ P2 สองรายการที่พบจากการสแกน Job 194:
1. เพิ่มการคัดลอก `imageUrl: item.imageUrl` ใน `App.tsx` เพื่อให้ใบเสนอราคาเดิมที่บันทึกไว้ (`/quote/view`) แสดงรูปภาพ Thumbnail หินได้ครบถ้วน
2. เพิ่มการจัดการ Keyboard Focus ใน `StoneSlabViewer.tsx` (ย้าย Focus เข้าปุ่มปิดเมื่อเปิด Modal และคืน Focus เมื่อปิด)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/App.tsx (บรรทัด ~1274-1290) ในการ map saved.notification.items เป็น formalItems ให้คัดลอก imageUrl: item.imageUrl มาด้วย
  2. ใน artifacts/knight-basins/src/components/StoneSlabViewer.tsx เพิ่มการจัดการ Focus ให้กับ Modal (Auto-focus ปุ่มปิดเมื่อเปิด Modal และคืน Focus เมื่อปิด)
  3. ปลดล็อค TODO ใน artifacts/knight-basins/test/job-194-bug-hunt.test.ts 2 ข้อแรก ให้เป็นเทสต์จริงและรันผ่าน 100%

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/components/StoneSlabViewer.tsx
  - artifacts/knight-basins/test/job-194-bug-hunt.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องสูตรการคำนวณราคาใดๆ ทั้งสิ้น
  - ห้ามเขียนหรือลบข้อมูลใน Production Database
  - ทำงานผ่าน branch: feat/replit-fix-p2-bugs แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-fix-p2-bugs ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/job-194-bug-hunt.test.ts ใน artifacts/knight-basins → 2 ข้อแรกผ่านเขียว
  4) npm test ใน artifacts/knight-basins (non-browser suite)
     baseline อ้างอิง: tests 660 / pass 659 / fail 0 / todo 1 (สำหรับ non-browser suite)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/components/StoneSlabViewer.tsx
  - artifacts/knight-basins/test/job-194-bug-hunt.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ทั้ง 2 ข้อผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุ 2 ข้อแก้ P2 และปลดล็อคเทสต์ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุเฉพาะ App.tsx, StoneSlabViewer.tsx, job-194 test |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามแตะสูตรราคา, บังคับ GitHub Connection |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่ง tsc, node test, npm test baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ 3 ไฟล์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 30 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path ของเครื่องเซิร์ฟเวอร์ |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดข้อบังคับครบถ้วน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/replit-fix-p2-bugs |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | 660 tests / 0 failures |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |
