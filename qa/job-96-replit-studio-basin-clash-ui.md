# ใบงาน 96 (Replit) — เชื่อมต่อการแจ้งเตือนระยะปลอดภัยหลุมเจาะ 100 มม. และป้องกันการวางทับรอยต่อแผ่น (Client-Side Basin Clearance & Joint Clash Alert)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Studio UI & Validation Alert) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ชัยทำโมดูลฝั่งหลังบ้าน (Task 95 — Fabrication Geometry) เรียบร้อยแล้ว เพื่อให้ประสบการณ์การใช้งาน (UX) ของลูกค้าและทีมขายในหน้า 2D Studio (`/studio`) ไร้รอยต่อ และไม่ส่งงานที่ผิดพลาดเข้าโรงงาน Replit จะรับหน้าที่เชื่อมต่อระบบแจ้งเตือนแบบเรียลไทม์บนกระดาน Studio:

1. **การแจ้งเตือนระยะเจาะปลอดภัยขั้นต่ำ 100 มม. (Basin Margin Warning):**
   * ในหน้า 2D Studio เมื่อมีการลากหรือวางอ่างล้างหน้าลงบนผังเคาน์เตอร์:
   * หากขอบอ่างด้านใดด้านหนึ่ง (ซ้าย, ขวา, หน้า, หลัง) มีระยะเนื้อหินเหลือจากขอบเคาน์เตอร์ **น้อยกว่า 100 มม.** (กฎเหล็ก Knight Furnich)
   * ต้องแสดงกรอบเตือนหรือแถบข้อความเตือนสีส้ม/แดงทันที: `"⚠️ ระยะขอบหินรอบอ่างต้องไม่น้อยกว่า 100 มม. (ปัจจุบันเหลือน้อยเกินไป) เพื่อป้องกันหินแตกระหว่างเจาะ"`
2. **การแจ้งเตือนวางอ่างทับรอยต่อแผ่นหิน (Joint Clash Warning):**
   * สำหรับเคาน์เตอร์ทรง L (2 แผ่น) และทรง U (3 แผ่น)
   * หากตำแหน่งหลุมเจาะของอ่างวางพาดหรือคร่อมรอยต่อระหว่างแผ่นหิน (Joint Line)
   * ต้องแสดงข้อความเตือนชัดเจน: `"⚠️ ตำแหน่งอ่างวางทับแนวรอยต่อแผ่นหิน กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียวกัน"`
3. **การล็อกปุ่ม Action เมื่อพบข้อผิดพลาดด้านงานช่าง:**
   * หากมีระยะขอบน้อยกว่า 100 มม. หรือวางทับรอยต่อ ปุ่ม `[ ส่งขอราคา ]` หรือปุ่ม Export ต้องถูก Disable พร้อมมี Tooltip/ข้อความแจ้งเตือน เพื่อไม่ให้ผังที่ผลิตจริงไม่ได้หลุดเข้าสู่กระบวนการสั่งซื้อ
4. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/studio-basin-clash-ui.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - เพิ่มการตรวจสอบและแสดง UI Warning เมื่อระยะขอบเจาะอ่างน้อยกว่า 100 มม. (MIN_BASIN_CLEARANCE_MM = 100)
     - เพิ่มการตรวจสอบและแสดง UI Warning เมื่อวางอ่างทับแนวรอยต่อแผ่นหินในทรง L หรือ U
     - ปิดการทำงาน (disable) ของปุ่มส่งขอราคาเมื่อตรวจพบ Basin Clash จนกว่าผู้ใช้จะขยับอ่างให้อยู่ในระยะปลอดภัย
  2. สร้าง artifacts/knight-basins/test/studio-basin-clash-ui.test.ts (ใหม่):
     - ทดสอบการแสดงผล Warning เมื่อระยะขอบเจาะ < 100 มม.
     - ทดสอบการตรวจจับหลุมเจาะวางทับแนว Joint Line
     - ทดสอบสถานะ disabled ของปุ่ม Action เมื่อเกิด Clash

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-basin-clash-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามลดระยะขอบเจาะปลอดภัยต่ำกว่า 100 มม. เด็ดขาด (กฎเหล็ก Knight Furnich)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-basin-clash-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 420 / pass 420 / fail 20 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/studio-basin-clash-ui.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานบนหน้า Studio ใน PR description

OUTPUT:
  - branch: feat/replit-studio-basin-clash-ui (เปิด PR เข้า main)
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
| 11 | ยึดระยะขอบปลอดภัยขั้นต่ำ 100 มม. ตามกฎบริษัท | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
