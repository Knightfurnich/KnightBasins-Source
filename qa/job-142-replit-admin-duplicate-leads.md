# ใบงาน 142 (Replit) — ระบบตรวจจับลูกค้าและเบอร์โทรซ้ำซ้อนในหน้าจัดการ Lead (Smart Duplicate Lead & Customer Detection UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Sales Management UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 03 ในคู่มือ KRAKEN ERP**: *"ห้ามสร้างลูกค้าซ้ำซ้อน — ถ้าชื่อคล้ายกันให้ค้นหาก่อน (ค้นด้วยชื่อ/รหัส CUS/เบอร์โทร)"*
ปัจจุบันในหน้าจัดการ Lead (`/admin/leads`) เมื่อฝ่ายขายมีลูกค้าทักเข้ามาซ้ำ หรือมี Lead จากโครงการเดียวกัน อาจทำให้เกิดงานซ้ำซ้อน
งานนี้คือการสร้าง **ระบบตรวจจับลูกค้าซ้ำซ้อนอัจฉริยะ (Smart Duplicate Checker)** บนหน้าจอจัดการ Lead:
1. วิเคราะห์และตรวจจับ Lead ที่มี **เบอร์โทรศัพท์เดียวกัน** หรือ **ชื่อลูกค้า/ชื่อโครงการเดียวกัน** (ตรวจในฝั่ง Frontend Client จากรายการ Leads ที่โหลดมาแล้วได้ทันที ไม่ต้องรอ backend ใหม่)
2. บนแถวรายการ Lead ที่ตรวจพบว่ามีประวัติซ้ำ ให้แสดง Badge เตือนสีส้ม **`[ ⚠️ พบประวัติซ้ำ (X) ]`**
3. เมื่อคลิกที่ Badge หรือขยายดูรายละเอียด จะแสดงกล่อง **"ประวัติที่เกี่ยวข้องของลูกค้ารายนี้"** พร้อมแสดงรหัสงานเดิม, วันที่ และสถานะ ช่วยให้ฝ่ายขายติดตามงานต่อได้ทันทีโดยไม่เปิดงานซ้ำ

**รายละเอียดสิ่งที่ต้องทำ:**

1. **ใน `artifacts/knight-basins/src/admin/leads-utils.ts`:**
   * เพิ่มฟังก์ชันตรวจจับความซ้ำซ้อน:
     `export function findDuplicateLeads(currentLead: CustomerLead, allLeads: CustomerLead[]): CustomerLead[]`
   * กฎการตรวจจับ:
     - เบอร์โทรศัพท์ตรงกัน (เมื่อตัดช่องว่างและขีดออกแล้ว เช่น `081-234-5678` ตรงกับ `0812345678`) โดยเบอร์ต้องมีความยาวอย่างน้อย 8 ตัวอักษร
     - หรือ ชื่อลูกค้าตรงกันเป๊ะ (Case-insensitive และตัดช่องว่างหัวท้าย) เมื่อชื่อยาวเกิน 3 ตัวอักษร
     - ต้องไม่นับตัวเองซ้ำ (`lead.id !== currentLead.id`)
2. **ใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:**
   * ในแต่ละแถวของ Lead ถ้าพบรายการซ้ำ ให้แสดง Badge:
     `<span data-testid={`badge-duplicate-lead-${lead.id}`}>⚠️ มีประวัติเดิม {duplicates.length} รายการ</span>`
   * ในส่วนขยายรายละเอียดงาน (Expanded Lead Details) ให้แสดงการ์ดประวัติเดิม:
     - กล่อง `data-testid="panel-duplicate-leads"`
     - ลิสต์แสดงรหัสงานเดิม เช่น `JB26/1012`, วันที่, และสถานะ
     - มีปุ่มคลิกเพื่อกระโดดหรือไฮไลต์ไปยังงานนั้นได้
3. **สร้าง Unit Tests ใน `artifacts/knight-basins/test/admin-duplicate-leads.test.ts` (ใหม่):**
   * ทดสอบฟังก์ชัน `findDuplicateLeads` ใน `leads-utils.ts`:
     - เบอร์โทรฟอร์แมตต่างกันแต่เลขเหมือนกันต้องจับคู่ได้
     - ชื่อตรงกันต้องจับคู่ได้
     - คนละเบอร์คนละชื่อต้องไม่จับคู่
     - ต้องไม่จับคู่กับตัวเอง
   * ทดสอบ UI ด้วย Static Source Inspection (`readFileSync`):
     - ตรวจสอบ `data-testid` ที่เกี่ยวข้องครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. เพิ่มฟังก์ชัน findDuplicateLeads ใน artifacts/knight-basins/src/admin/leads-utils.ts
  2. แสดง Badge เตือนประวัติซ้ำและการ์ดรายการเดิมใน artifacts/knight-basins/src/admin/LeadsManager.tsx
  3. สร้าง artifacts/knight-basins/test/admin-duplicate-leads.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/leads-utils.ts
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-duplicate-leads.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx, App.tsx และ WorkshopProductionSheet.tsx
  - ห้ามใช้ dynamic import คอมโพเนนต์ในไฟล์เทสต์ (จะพังเพราะไม่มี import.meta.env)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-duplicate-leads แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 574 / pass 552 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-duplicate-leads.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-duplicate-leads (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
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
| 11 | รองรับตรรกะความซ้ำซ้อนระดับ Client ปลอดภัย | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
