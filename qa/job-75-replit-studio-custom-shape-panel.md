# ใบงาน 75 (Replit) — แผงกำหนดขนาดแผ่นจริง + ระบุขอบ 4 แบบ + ปุ่ม "ประกอบผังลงกระดาน"

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — รอ Task 74 (ชัย) merge ก่อนจึงเริ่ม

**ความต้องการ:** 
ยกเครื่องส่วน `studio-piece-shape-section` ในหน้า 2D Studio (`/studio`) ตามที่เจ้าของอนุมัติ:
1. **ลบปุ่ม "ขนาดเคาน์เตอร์หลัก" ออกทั้งหมด** — ตัด `STUDIO_COUNTER_PRESETS` UI (`[1.20 ม.] [1.50 ม.] [1.80 ม.] [2.00 ม.]`) ออกจากหน้าจอ 100%
2. **แสดงกล่องกรอกขนาดแยกรายแผ่นตามทรงที่เลือก:**
   - ทรง I → 1 แผ่น · ทรง L (ซ้าย/ขวา) → 2 แผ่น · ทรง U → 3 แผ่น
   - แต่ละแผ่นมีช่องกรอก `ความยาว (มม.)` และ `ความลึก (มม.)` พร้อมค่าตั้งต้นที่สมเหตุสมผล (ไม่ต้องพิมพ์จาก 0)
3. **ระบุสถานะขอบ 4 แบบข้าง ๆ ขนาดของแต่ละแผ่น:**
   - `ติดบัว ▲` · `ชิดผนัง ║` · `ขอบเปิด ⊗` · `ขอบปิด ⊞`
   - ด้านที่เป็นรอยต่อระหว่างแผ่น (joint) ต้อง **ล็อกอัตโนมัติ** แสดงเป็น `🔗 รอยต่อชนแผ่น` เลือกไม่ได้
4. **ป้ายด้านต้องบอกทิศทางกายภาพ ไม่ใช่ บน/ล่าง/ซ้าย/ขวา:**
   - ใช้ `ด้านชนผนัง` · `ด้านหน้า (คนยืน)` · `ด้านข้างซ้าย` · `ด้านข้างขวา`
   - เหตุผล: ทรง L/U มีแผ่นที่หันคนละทาง ป้ายตามหน้าจอทำให้ผู้ใช้ติ๊กผิดด้าน
5. **ห้ามคำนวณราคาสดระหว่างกรอก** (เจ้าของสั่งชัดเจน) — ต้องกดปุ่ม Action ก่อน
6. **ปุ่ม Action:** `[ 🎨 ประกอบผังลงกระดาน ]` (`data-testid="button-apply-custom-shape"`)
   - เมื่อกด: เรียก `buildCustomShapePiece` (จาก Task 74 ของชัย) สร้างแผ่น+ขอบลง state
   - กระดาน Canvas ด้านล่างวาดผังทันที พร้อมป้ายขอบตรงตามที่เลือก
   - พื้นที่ ตร.ม. และราคา (Live Estimate) อัปเดต ณ จุดนี้เท่านั้น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ลบ <div className="studio-size-presets"> (ปุ่ม STUDIO_COUNTER_PRESETS) ออกจาก studio-piece-shape-section
     - สร้างคอมโพเนนต์ย่อย StudioCustomShapePanel (หรือ inline) แสดงกล่องแผ่นงานตามจำนวนแผ่นของทรงที่เลือก:
       * ทรง i -> 1 แผ่น · l-left/l-right -> 2 แผ่น · u -> 3 แผ่น
       * แต่ละแผ่น: input data-testid="input-piece-{index}-length" และ "input-piece-{index}-depth"
       * แต่ละแผ่น: 4 ปุ่มเลือกขอบ data-testid="select-edge-{index}-{top|front|left|right}" พร้อมตัวเลือก 4 สถานะ + ล็อกรอยต่อ
       * ด้านรอยต่อแสดงเป็น "🔗 รอยต่อชนแผ่น" และปุ่มถูก disabled
     - เพิ่มปุ่ม [ 🎨 ประกอบผังลงกระดาน ] data-testid="button-apply-custom-shape"
       * onClick: เรียก buildCustomShapePiece(pieceId, preset, panels) จาก "@/data/studio-model" แล้ว setState
       * ห้ามคำนวณราคาระหว่าง onChange ของ input ใด ๆ
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์ .studio-custom-shape-panel, .studio-piece-card, .studio-piece-edge-row, .studio-edge-select
     - รองรับ Mobile: การ์ดเรียงเป็นคอลัมน์เดียว
  3. ใน artifacts/knight-basins/test/studio-custom-shape-ui.test.ts (ใหม่):
     - ทดสอบว่าซอร์สไม่มี studio-size-presets อีกแล้ว
     - ทดสอบว่ามี data-testid ของช่องกรอกขนาดรายแผ่น ปุ่มเลือกขอบ และปุ่ม button-apply-custom-shape
     - ทดสอบว่ามีการเรียก buildCustomShapePiece

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/studio-custom-shape-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง artifacts/knight-basins/src/data/studio-model.ts และ studio-export.ts (ของชัยใน Task 74)
  - ห้ามให้ราคา/พื้นที่ อัปเดตระหว่างกรอกขนาด — ต้องรอกดปุ่ม Action เท่านั้น
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-custom-shape-panel แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 363 / pass 357 / fail 2 / cancelled 3 / skipped 1 (ต้องรันจริงหลัง Task 74 merge แล้วรายงานตัวเลขจริง)
  4) เทสต์ใหม่ใน studio-custom-shape-ui.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงทั้งเดสก์ท็อป 1440px และมือถือ 390px แล้วแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-studio-custom-shape-panel (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้า buildCustomShapePiece ยังไม่มีใน main ให้รายงานแล้วรอ Task 74
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
| 11 | ทดสอบการลบปุ่มเดิม การกรอกขนาด และปุ่ม Action | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
