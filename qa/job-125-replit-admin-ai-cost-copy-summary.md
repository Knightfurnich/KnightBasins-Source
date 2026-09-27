# ใบงาน 125 (Replit) — เพิ่มปุ่มคัดลอกสรุปต้นทุน AI ส่ง LINE (AI Cost Center Quick Summary Copy)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin AI Cost UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าจัดการต้นทุน AI รวมของบริษัท (`/admin/ai-cost`) ผู้บริหารต้องการ **"ปุ่มคัดลอกสรุปต้นทุน AI ด่วนสำหรับส่งเข้า LINE ผู้บริหาร"**
เพื่อให้สามารถกดคลิกเดียวแล้วได้ข้อความสรุปค่าใช้จ่าย AI ทั้งหมด (แยกตามบริการ: น้องไนท์, เฮอร์มีส, วิเคราะห์แบบร่าง และโมเดลที่ใช้) ไปรายงานในกลุ่มผู้บริหารได้ทันที โดยไม่ต้องแคปภาพหน้าจอหรือดาวน์โหลด CSV

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/AiCostCenterPage.tsx`:**
1. **เพิ่มปุ่ม `[ 📋 คัดลอกสรุปส่ง LINE ]` บนแถบเครื่องมือ:**
   * วางข้างปุ่มดาวน์โหลด CSV มี attribute `data-testid="button-ai-cost-copy-summary"`
   * เมื่อกดปุ่ม: รวมข้อมูลสรุปต้นทุน AI ตามช่วงเวลาที่เลือกอยู่ (วันนี้, 7 วัน, 30 วัน, หรือ ทั้งหมด) และจัดฟอร์แมตข้อความสรุป เช่น ยอดรวม, จำนวนคำขอ, โทเค็น, และแยกตามบริการ
   * คัดลอกลง Clipboard และแสดง Toast แจ้งเตือน: "คัดลอกสรุปต้นทุน AI เรียบร้อยแล้ว"
2. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-ai-cost-copy-summary.test.ts` (ใหม่):**
   * ทดสอบปุ่มคัดลอกสรุปต้นทุน AI แสดงผลถูกต้อง
   * ทดสอบการจัดฟอร์แมตข้อความสรุปต้นทุน AI ครบถ้วนทั้งยอดรวม, จำนวนครั้ง, และรายการแยกบริการ
   * ทดสอบการคัดลอกลง Clipboard พร้อม Toast

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/AiCostCenterPage.tsx:
     - เพิ่มปุ่มคัดลอกสรุปส่ง LINE (data-testid="button-ai-cost-copy-summary") บนแถบเครื่องมือข้างปุ่มดาวน์โหลด CSV
     - จัดฟอร์แมตข้อความสรุปต้นทุน AI ตามช่วงเวลาที่เลือก (ยอดรวม, จำนวนคำขอ, โทเค็น, และแยกบริการ) คัดลอกลง Clipboard พร้อม Toast
  2. สร้าง artifacts/knight-basins/test/admin-ai-cost-copy-summary.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/test/admin-ai-cost-copy-summary.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเปลี่ยนตรรกะการคำนวณต้นทุนหรือสูตรราคาเดิม
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-ai-cost-copy-summary แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 512 / pass 490 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-ai-cost-copy-summary.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-ai-cost-copy-summary (เปิด PR เข้า main)
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
| 11 | อนุรักษ์สูตรและตรรกะต้นทุน AI เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
