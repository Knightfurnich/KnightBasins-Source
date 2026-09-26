# ใบงาน 77 (Replit) — UI การ์ดแจกแจงงานช่าง AI + ปุ่มคู่ส่งเข้า 2D Studio บนหน้า /sketch

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — เริ่มเตรียมโครงสร้าง UI ได้ทันที

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ AI (Gemini Vision) ได้รับการอัปเกรดให้สามารถถอดแบบสเก็ตช์ได้ลึกถึงระดับ "แจกแจงงานช่าง" (แยกหลายชิ้นงานใน 1 ภาพ, แยกแผ่นหิน Panels, ถอดขอบ 4 แบบ, และจุดเจาะ)
หน้ารับแบบร่าง (`/sketch`) จะต้องนำเสนอข้อมูลนี้ให้สวยงาม และเชื่อมต่อไปยัง 2D Studio ได้อย่างไร้รอยต่อ ตามที่เจ้าของอนุมัติ:

1. **การ์ดแจกแจงงานช่าง (Production Breakdown Card) ในกล่องผลวิเคราะห์ AI:**
   - เมื่อ AI วิเคราะห์เสร็จ ให้แสดงผลแจกแจงเป็นหมวดหมู่อ่านง่าย:
     * **ภาพรวม:** จำนวนชิ้นงานที่พบ (เช่น `พบ 2 ชิ้นงานในภาพนี้`)
     * **รายชิ้นงาน:**
       - รูปทรงและมิติรวม: เช่น `ชิ้นงาน A: ทรงตรง (I) · 1,980 × 600 มม.` หรือ `ชิ้นงาน B: ทรงแอลขวา (L-Right) · 3,170 × 2,040 มม.`
       - แผ่นหิน (Panels): รายการแผ่นหินที่ต้องตัด (เช่น `แผ่น 1: 3,170 × 620 มม.` · `แผ่น 2: 1,420 × 620 มม.`)
       - ขอบที่ถอดได้: แสดงป้ายสัญลักษณ์ขอบ เช่น `ติดบัว ▲` `ชิดผนัง ║` `ขอบเปิด ⊗` `ขอบปิด ⊞`
       - งานเจาะ (Cutouts): จุดเจาะอ่าง/ก๊อก พร้อมหมายเหตุ `(คิดราคาเต็มผืน ไม่หักช่องเจาะ)`
2. **การแก้ไขแบบ Manual ยังคงทำได้ 100%:**
   - กล่อง `02 สเปกที่สนใจ` ผู้ใช้ยังคงพิมพ์ปรับตัวเลขความยาว ความลึก ได้อิสระตลอดเวลา
   - เมื่อพิมพ์แก้ ราคาในกล่อง Live Estimate จะคำนวณตามตัวเลขที่แก้ทันที
3. **ปุ่มคู่ท้ายหน้า (Button Pair) ในกล่องสรุปราคา Live Estimate:**
   - วางปุ่มคู่กันล่างสุดเคียงข้างกัน (บนมือถือเรียงซ้อนกันแนวตั้ง):
     * **ปุ่มหลัก:** `[ 🚀 ส่งภาพแบบร่างให้ทีมขายประเมินราคา ➔ ]` (`data-testid="button-submit-sketch-lead"`) — ส่ง Lead เข้าทีมขายตามเดิม
     * **ปุ่มขยายเข้า Studio:** `[ 🎨 นำขนาดเข้าสู่ 2D Studio ➔ ]` (`data-testid="button-bridge-to-studio"`)
   - **เมื่อกดปุ่มนำเข้า 2D Studio:**
     * นำค่ารูปทรง, ขนาดความยาว/ความลึก (ที่ AI กรอกหรือผู้ใช้แก้), สีหิน และอ่างที่เลือกไว้
     * ส่งผ่าน URL query หรือ navigation state ไปยัง `/studio`
     * หน้า `/studio` เปิดขึ้นมาพร้อมกับประกอบผังและขอบให้โดยอัตโนมัติ ไม่ต้องเริ่มจากศูนย์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ปรับปรุงการแสดงผลการ์ดวิเคราะห์ sketch ให้รองรับทั้ง format เดิมและ format ใหม่ (workpieces breakdown):
       * ถ้ามี workpieces: แสดงรายการชิ้นงาน, ขนาดแผ่นหิน, ป้ายขอบ (upstand/wall-flush/open-edge/closed-edge) และงานเจาะ
       * มีข้อความกำกับชัดเจน: "คิดราคาเต็มผืน ไม่หักช่องเจาะ"
     - ในกล่อง Live Estimate (โหมด sketch):
       * เพิ่มปุ่ม [ 🎨 นำขนาดเข้าสู่ 2D Studio ➔ ] data-testid="button-bridge-to-studio" วางข้างๆ หรือเหนือปุ่มส่งทีมขาย
       * เมื่อคลิก: นำทางไปยัง /studio พร้อมส่งพารามิเตอร์ shape, runAMm, depthMm, stoneColor, basinSku ไปยัง 2D Studio
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์ .studio-sketch-workpiece-card, .studio-sketch-panel-badge, .studio-sketch-button-pair
     - รองรับ Mobile (390px): ปุ่มคู่เรียงซ้อนกันแนวตั้งอย่างเป็นระเบียบ ไม่ล้นจอ
  3. ใน artifacts/knight-basins/test/sketch-workpiece-and-bridge.test.ts (ใหม่):
     - ทดสอบว่ามี data-testid="button-bridge-to-studio"
     - ทดสอบว่าปุ่มนำทางไปยัง /studio พร้อมพารามิเตอร์ที่ถูกต้อง
     - ทดสอบว่าการ์ดวิเคราะห์มีองค์ประกอบสำหรับแสดง workpieces และป้ายขอบ

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/sketch-workpiece-and-bridge.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้ามหักพื้นที่ช่องเจาะหลุมออกจากพื้นที่คำนวณราคาหินเด็ดขาด
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-sketch-workpiece-and-studio-bridge แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 367 / pass 361 / fail 2 / cancelled 3 / skipped 1
  4) เทสต์ใหม่ใน sketch-workpiece-and-bridge.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงทั้งเดสก์ท็อป 1440px และมือถือ 390px แล้วแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-sketch-workpiece-and-studio-bridge (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
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
| 11 | ทดสอบการ์ดชิ้นงาน, ปุ่มคู่ และการเชื่อมต่อไป Studio | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
