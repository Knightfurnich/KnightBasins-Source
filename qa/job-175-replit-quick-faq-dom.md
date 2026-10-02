# ใบงาน 175 (Replit) — ปรับปรุง QuickFAQ Accordion ให้ Render คำตอบลง DOM เสมอ (Crawler Accessible) และดึงข้อมูลจาก faq-data.ts

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / UI Maintenance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน `QuickFAQ.tsx` ปัจจุบัน คำตอบถูกเรนเดอร์แบบ `{isOpen && <p>...}` ทำให้คำตอบที่ยังไม่ถูกกดเปิด ไม่มีตัวตนอยู่ใน DOM เลย ส่งผลให้ AI และ Web Crawlers ไม่สามารถดึงคำตอบไปอ่านหรือทำดัชนีได้
งานนี้คือการปรับปรุง Accordion ให้เรนเดอร์คำตอบลง DOM เสมอ (ใช้ CSS ซ่อน/เปิดผ่าน class `.is-open` ที่มีอยู่แล้ว หรือแอททริบิวต์ `hidden={!isOpen}`) และดึงข้อมูลคำถาม-คำตอบจาก `@/data/faq-data` แทนการเขียนฮาร์ดโค้ดในคอมโพเนนต์

**รายละเอียดสิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/components/QuickFAQ.tsx`:
   - เปลี่ยนจากการประกาศ `FAQ_ITEMS` ภายในไฟล์ เป็นการ `import { KNIGHT_FAQ_ITEMS } from "@/data/faq-data";`
   - ปรับการเรนเดอร์คำตอบ: นำเงื่อนไข `{isOpen && ...}` ออก เพื่อให้ `<p className="quick-faq-answer">` คงอยู่ใน DOM เสมอทุกข้อ
   - ควบคุมการแสดงผลการพับ/กางผ่านคลาส `.quick-faq-item.is-open` หรือใส่แอททริบิวต์ `hidden={!isOpen}` ที่คำตอบ เพื่อให้อ่านใน DOM ได้ตลอดเวลา
   - ปรับปรุงการสลับสถานะไอคอน `ChevronDown` ให้หมุน 180 องศาเมื่อเปิด
2. เพิ่ม Unit Test ใน `artifacts/knight-basins/test/quick-faq-dom.test.ts` (ใหม่):
   - เทสต์แบบ Static Source Inspection: ตรวจสอบว่าไม่มี `{isOpen &&` ครอบ `<p className="quick-faq-answer"`
   - ตรวจสอบว่ามีการ import ข้อมูลจาก `@/data/faq-data`
   - ตรวจสอบว่ามี data-testid `faq-question-` และ `faq-answer-` ครบทุกข้อ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับ QuickFAQ.tsx ให้ render คำตอบ <p className="quick-faq-answer"> ลงใน DOM เสมอทุกข้อ (เอา {isOpen && ...} ออก)
  2. ดึงข้อมูลคำถาม-คำตอบจาก artifacts/knight-basins/src/data/faq-data.ts
  3. สร้างไฟล์ทดสอบ artifacts/knight-basins/test/quick-faq-dom.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/components/QuickFAQ.tsx
  - artifacts/knight-basins/test/quick-faq-dom.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง App.tsx, StudioPage.tsx และ WorkshopProductionSheet.tsx
  - ห้ามกระทบ Formal Quotation print layout
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-quick-faq-dom แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 664 / pass 624 / fail 0 / cancelled 0 / skipped 40
  4) เทสต์ใหม่ใน test/quick-faq-dom.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-quick-faq-dom (เปิด PR เข้า main)
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
| 11 | อนุรักษ์ Print Layout และคอมโพเนนต์สำคัญ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
