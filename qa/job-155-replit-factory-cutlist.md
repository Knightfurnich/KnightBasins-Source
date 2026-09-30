# ใบงาน 155 (Replit) — แผงตารางตัดหินโรงงานและเช็คลิสต์ช่างตัดประกอบ (Factory Stone Cut-List Modal & Print Sheet UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Production Engineering UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 07 ในคู่มือ KRAKEN ERP** (งานผลิต Production Engineering):
> *"แปลงแบบที่อนุมัติแล้วเป็นข้อมูลสำหรับผลิต: ตรวจรายการชิ้นงาน (ขนาด/วัสดุ/จำนวน) ให้ตรงกับแบบ ใช้เครื่องมือตรวจสอบและส่งออกข้อมูลให้โรงงาน/ช่างตัด"*

ปัจจุบันงานที่ออกแบบผ่าน 2D Studio มีข้อมูลอยู่ใน `lead.studioData` ครบถ้วน (ขนาดแผ่น, ขอบ 4 ด้าน, ระยะเจาะหลุมอ่าง) แต่ช่างโรงงานยังไม่มีหน้าจอสรุป **ตารางตัดหิน (Cut-List)** ที่ชัดเจน ทำให้อาจต้องเสียเวลามานั่งไล่ดูแบบเอง
งานนี้คือการสร้าง:
1. คอมโพเนนต์ใหม่ `artifacts/knight-basins/src/admin/FactoryCutListModal.tsx`:
   - กล่องหน้าต่าง Modal แสดงตารางตัดหินโรงงาน (`data-testid="modal-factory-cutlist"`)
   - อ่านข้อมูลจาก `lead.studioData`
   - ตารางรายการแผ่นหินที่ต้องตัด (`data-testid="table-cutlist-pieces"`):
     * ลำดับแผ่น (เช่น แผ่น A, แผ่น B)
     * ขนาดตัดจริง: กว้าง × ยาว (มม.)
     * สี/รหัสหินสังเคราะห์
     * สถานะขอบ 4 ด้าน: ด้านบน, ล่าง, ซ้าย, ขวา (ติดบัว ▲ / ชิดผัง ║ / ขอบเปิด ⊗ / ขอบปิด ⊞)
     * ข้อมูลหลุมเจาะอ่าง: รุ่นอ่าง, ขนาดหลุม (มม.), ระยะขอบปลอดภัย (ต้อง ≥ 100 มม. สีเขียว)
   - สรุปพื้นที่รวม (ตร.ม.)
   - ปุ่ม **`[ 🖨️ พิมพ์ใบสั่งตัดโรงงาน ]`** (`data-testid="button-print-cutlist"`) สั่ง `window.print()`
2. ใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:
   * บนแถว Lead ที่มี `studioData` (หรืองานที่มีแบบร่าง) ให้เพิ่มปุ่ม:
     `<Button data-testid={`button-open-cutlist-${lead.id}`}>📐 ใบสั่งตัดโรงงาน</Button>`
   * คลิกแล้วเปิด `FactoryCutListModal` ขึ้นมา
3. ⚠️ **กฎเหล็กเพื่อความปลอดภัยสูงสุด:**
   * **ห้ามแตะต้องไฟล์ `src/components/WorkshopProductionSheet.tsx` เด็ดขาด** (ไฟล์สงวนโดยบอส)
   * โค้ดทั้งหมดต้องเป็นคอมโพเนนต์ใหม่แยกต่างหาก

**สิ่งที่ต้องทำ:**
1. สร้าง `artifacts/knight-basins/src/admin/FactoryCutListModal.tsx` (ใหม่)
2. แก้ไข `artifacts/knight-basins/src/admin/LeadsManager.tsx` เพิ่มปุ่มเปิด Modal
3. สร้าง Unit Tests ใน `artifacts/knight-basins/test/admin-factory-cutlist.test.ts` (ใหม่)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/admin/FactoryCutListModal.tsx:
     - modal แสดงตารางตัดหิน (data-testid="modal-factory-cutlist")
     - ตารางตัดชิ้นงาน กว้างxยาว, สีหิน, ขอบ 4 ด้าน, หลุมเจาะ (data-testid="table-cutlist-pieces")
     - ปุ่มสั่งพิมพ์ใบตัด (data-testid="button-print-cutlist")
  2. ใน artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - เพิ่มปุ่มเปิด modal (data-testid={`button-open-cutlist-${lead.id}`})
  3. สร้าง artifacts/knight-basins/test/admin-factory-cutlist.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/FactoryCutListModal.tsx · (ใหม่)
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-factory-cutlist.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx และ App.tsx
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-factory-cutlist แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 604 / pass 583 / fail 21 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-factory-cutlist.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-factory-cutlist (เปิด PR เข้า main)
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
| 10 | ปกป้องไฟล์สงวน WorkshopProductionSheet.tsx 100% | ✅ ผ่าน |
| 11 | อนุรักษ์กฎระยะปลอดภัยขอบเจาะ 100 มม. | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
