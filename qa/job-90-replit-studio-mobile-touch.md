# ใบงาน 90 (Replit) — ปรับปรุง Mobile UX/Touch ใน 2D Studio หน้าจอแคบ (360px - 390px)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Mobile Responsiveness)

**ที่มาและความต้องการ:**
ในหน้า 2D Studio (`/studio`) หลังจากที่เราได้นำระบบกำหนดขนาดรายแผ่นและเลือกขอบ 4 สถานะ (Custom Shape Panel) มาใช้งาน แม้ว่าจะทำงานได้ดีบนเดสก์ท็อป แต่เมื่อทดสอบบนมือถือหน้าจอแคบ (ขนาด 360px - 390px เช่น iPhone SE, Android ทั่วไป):
1. **ช่องเลือกขอบ 4 ด้าน (.studio-piece-edge-row):**
   - เดิมถูกบังคับเป็น 2 คอลัมน์ (`grid-template-columns: repeat(2, minmax(0, 1fr))`) ทำให้ข้อความป้ายชื่อด้าน (`ด้านชนผนัง`, `ด้านหน้า (คนยืน)`) และสถานะขอบถูกบีบแคบจนตัวหนังสือเบียด หรือปุ่มกดยากด้วยนิ้วโป้ง
2. **ปรับปรุง Touch Target และ Layout สำหรับ Mobile:**
   - บนหน้าจอความกว้าง $\le 480px$:
     * ให้ `.studio-piece-edge-row` สลับเป็น 1 คอลัมน์ หรือ 2 คอลัมน์ที่ขยาย padding และ min-height ของปุ่มเลือกขอบ (`.studio-edge-select`) เป็นอย่างน้อย 42px เพื่อให้กดด้วยนิ้วโป้งได้แม่นยำ (Thumb-Friendly Touch Target ตามมาตรฐาน WCAG)
     * ตัวเลือกสถานะขอบ (`.studio-edge-options button`) ให้มีระยะห่างและพื้นที่กดอย่างน้อย 38px
     * ปุ่ม Action `[ 🎨 ประกอบผังลงกระดาน ]` ให้มีความสูงเด่นชัด ไม่เบียดชิดขอบจอ
3. **ตรวจสอบว่าไม่กระทบหน้าจอเดสก์ท็อป:**
   - หน้าจอเดสก์ท็อป ($\ge 1024px$) ต้องคงเลย์เอาต์เดิมที่สวยงามและกะทัดรัดไว้ 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/index.css:
     - เพิ่ม Media Query สำหรับหน้าจอแคบ (@media (max-width: 480px)):
       * ปรับปรุง .studio-piece-edge-row, .studio-edge-select, .studio-edge-options
       * เพิ่มความสูงขั้นต่ำ (min-height >= 42px) สำหรับปุ่มเลือกขอบบนมือถือ
       * ป้องกันการตัดคำล้นขอบแนวนอน (Zero horizontal overflow)
  2. ใน artifacts/knight-basins/test/studio-mobile-touch.test.ts (ใหม่):
     - ทดสอบว่ามี CSS rule สำหรับ touch-target min-height >= 42px บนมือถือ
     - ทดสอบว่าไม่มี horizontal overflow บน viewport 360px และ 390px

SCOPE:
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/studio-mobile-touch.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง App.tsx และ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้เลย์เอาต์บนเดสก์ท็อป (>= 1024px) เปลี่ยนแปลงหรือแตก
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-mobile-touch แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 406 / pass 396 / fail 2 / cancelled 3 / skipped 5
  4) เทสต์ใหม่ใน studio-mobile-touch.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงที่ 360px และ 390px พร้อมแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-studio-mobile-touch (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
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
| 11 | ทดสอบการรองรับมือถือ 360px และ Touch target | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
