# ใบงาน 92 (Replit) — รีเช็คและกวาดแก้บั๊ก UI/UX หน้า /sketch และ /studio (QA Sweep & Fix)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (QA & UX Bug Fix) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพ (Boss) สั่งการให้รีเช็คและตรวจสอบเชิงลึก 2 หน้าหลักของระบบ:
1. https://knightbasins.srv1964473.hstgr.cloud/sketch (ส่งแบบร่างด้วยมือ)
2. https://knightbasins.srv1964473.hstgr.cloud/studio (2D Studio ออกแบบเคาน์เตอร์)

เพื่อกวาดหาจุดติดขัดด้าน UI/UX (QA Bug Sweep) บนมือถือและเดสก์ท็อป พร้อมดำเนินการแก้ไขทันทีหากพบข้อบกพร่องตามแนวทางที่ได้รับความเห็นชอบ:

1. **หน้า `/sketch`:**
   * ตรวจสอบ Touch target ของปุ่มถ่ายภาพ / อัปโหลด และปุ่มคู่ด้านล่าง (`data-testid="button-bridge-to-studio"` และ `data-testid="button-submit-sketch-lead"`) ให้กดสะดวกบนจอมือถือ (360px - 414px)
   * ตรวจสอบสถานะ Disabled ขณะที่ระบบกำลังอ่านภาพหรือส่งข้อมูล ป้องกันการกดซ้ำซ้อน (double-click / race conditions)
   * ตรวจสอบความถูกต้องของการ์ดแจกแจงงานช่าง AI (Production Breakdown Card) และการกรอกขนาดด้วยตนเอง
2. **สะพานเชื่อม `/sketch` ➔ `/studio` (Studio Bridge):**
   * ตรวจสอบการส่ง Query Params (`shape`, `runAMm`, `depthMm`, `stoneColor`, `basinSku`) ให้โหลดและประกอบชิ้นงานลงกระดาน Studio ครบถ้วน
3. **หน้า `/studio`:**
   * ตรวจสอบแผง Custom Shape Configurator: การเลือกรูปทรง I / L-ซ้าย / L-ขวา / U และการตั้งขอบ 4 สถานะ (ติดบัว ▲ / ชิดผนัง ║ / ขอบเปิด ⊗ / ขอบปิด ⊞)
   * ตรวจสอบปุ่ม Action `[ 🎨 ประกอบผังลงกระดาน ]` ให้ทำงานถูกต้อง ไม่กระตุก และไม่มีการคำนวณราคาสดต่อแผ่นก่อนกดปุ่ม
   * ตรวจสอบการป้องกันค่าติดลบหรือตัวเลขไม่ถูกต้องในช่องขนาด
4. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/sketch-studio-qa-sweep.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ตรวจสอบและกวาดแก้บั๊ก UI/UX ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - รองรับจอแคบ 360px - 414px โดยไม่มี horizontal scrollbar เกินขอบจอ (no overflow-x)
     - คุมสถานะ disabled และ loading ของปุ่ม Action สำคัญในหน้า /sketch และ /studio ป้องกันการกดรัว
     - ตรวจสอบความสมบูรณ์ของ Studio Bridge URL params ให้เรนเดอร์ชิ้นงานและขอบได้อย่างถูกต้อง
     - ตรวจสอบ input validation ในกล่องกรอกขนาด (ไม่รับค่าติดลบ หรือค่าว่าง)
  2. สร้าง artifacts/knight-basins/test/sketch-studio-qa-sweep.test.ts (ใหม่):
     - ทดสอบ mobile responsive constraints, action button disabled states, bridge parameter loading, และ edge status integration

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/sketch-studio-qa-sweep.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง artifacts/api-server/ หรือฝั่ง backend ทุกไฟล์
  - ห้ามลบหรือเปลี่ยนชื่อ data-testid เดิมที่มีอยู่ในหน้าเว็บ
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-sketch-studio-qa-sweep แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 419 / pass 419 / fail 20 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/sketch-studio-qa-sweep.test.ts ผ่าน 100%
  5) ตรวจสอบบนเบราว์เซอร์จริงและแนบสรุปสิ่งที่พบและแก้ไขใน PR description

OUTPUT:
  - branch: feat/replit-sketch-studio-qa-sweep (เปิด PR เข้า main)
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
| 11 | ครอบคลุมการกวาดตรวจและแก้บั๊ก UI/UX ทั้งสองหน้า | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
