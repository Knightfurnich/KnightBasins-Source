# ใบงาน 98 (Replit) — แสดงป้ายเตือนความเสี่ยงงานช่างในการ์ด Lead หลังบ้าน (Fabrication Safety Badges in Admin Leads Manager)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Safety Badges) — รันต่อได้ทันทีเมื่อพร้อม

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ชัยทำ Task 97 (ระบบตรวจสอบความเสี่ยงงานช่าง `fabricationWarnings` ใน Lead API)
เพื่อให้ทีมขายและแอดมินในหน้าจัดการลูกค้า (`/admin/leads`) มองเห็นความเสี่ยงด้านงานช่างได้ทันทีโดยไม่ต้องคลิกเข้าไปดูทีละใบเสนอราคา Replit จะรับหน้าที่เพิ่มป้ายสถานะความปลอดภัยงานช่างบนหน้าจอ Admin:

1. **การแสดงป้ายความเสี่ยงงานช่าง (Fabrication Warning Badge):**
   * ในการ์ดหรือแถวตารางของ Lead แต่ละรายใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`
   * หาก Lead นั้นมี `fabricationWarnings` หรือตรวจพบระยะขอบเจาะ < 100 มม. หรือวางทับรอยต่อ
   * ให้แสดง Badge สีส้ม/แดงเตือนชัดเจน: `"⚠️ มีจุดเสี่ยงงานช่าง"` พร้อมแสดง Tooltip หรือข้อความสรุปเมื่อคลิก/hover
2. **การกรอง Lead ตามความเสี่ยงงานช่าง (Fabrication Safety Filter):**
   * เพิ่มตัวเลือกในตัวกรอง (Filter bar): "ทั้งหมด" / "ปกติ" / "⚠️ มีจุดเสี่ยงงานช่าง" เพื่อให้หัวหน้าช่างหรือฝ่ายผลิตสามารถกดกรองดูเฉพาะเคสที่ต้องตรวจสอบแบบก่อนลงมือผลิตได้อย่างรวดเร็ว
3. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/admin-leads-fabrication-badge.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - แสดงป้ายเตือน Fabrication Safety Badge (สีส้ม/แดง) ในการ์ด Lead ที่มีจุดเสี่ยงงานช่าง (ระยะเจาะ < 100 มม. หรือทับรอยต่อ)
     - เพิ่มตัวกรอง (Filter) ให้คัดกรองดู Lead ที่มีจุดเสี่ยงงานช่างได้สะดวก
  2. สร้าง artifacts/knight-basins/test/admin-leads-fabrication-badge.test.ts (ใหม่):
     - ทดสอบการแสดงป้ายเตือนเมื่อ Lead มีข้อมูล fabricationWarnings
     - ทดสอบการทำงานของตัวกรองความเสี่ยงงานช่าง

SCOPE:
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-leads-fabrication-badge.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-leads-fabrication-badge แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 420 / pass 420 / fail 20 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-leads-fabrication-badge.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานบนหน้า Admin ใน PR description

OUTPUT:
  - branch: feat/replit-admin-leads-fabrication-badge (เปิด PR เข้า main)
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
| 11 | แสดงป้ายเตือนงานช่างและตัวกรองในหน้า Leads Manager | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
