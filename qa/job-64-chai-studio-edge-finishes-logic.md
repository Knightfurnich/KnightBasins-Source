# ใบงาน 64 (ชัย) — ระบบคำนวณและฟังก์ชันจัดการขอบเคาน์เตอร์ 2D Studio (ติดบัว/ชิดผนัง/ขอบเปิด/ล้างขอบ)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ชัย

**ความต้องการ:** 
เจ้าของระบบ (คุณนพ) ต้องการให้ระบบ 2D Studio รองรับการปรับแต่งขอบเคาน์เตอร์อย่างยืดหยุ่น:
1. รองรับขอบที่เป็นทั้ง "ชิดผนัง + ติดบัว" (`wall-flush+upstand`) ในด้านเดียวกัน
2. มีฟังก์ชันคำนวณความยาวบัวและการเปิดขอบที่แม่นยำเมื่อมีสถานะแบบผสม
3. มีฟังก์ชัน Helper สำหรับตั้งค่าขอบ สลับสถานะ และล้างขอบ (`clearEdgeStatus`, `setEdgeStatus`, `cycleEdgeStatus`) เพื่อให้ระบบ UI ส่วนหน้าเรียกใช้งานได้ง่ายและปลอดภัย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts:
     - ขยาย `SideStatus` type รองรับ `"wall-flush+upstand"`:
       `export type SideStatus = "upstand" | "open-edge" | "wall-flush" | "wall-flush+upstand" | "normal";`
     - ปรับฟังก์ชัน `studioSideStatusLabel(status: SideStatus)`:
       * "wall-flush+upstand" -> "ชิดผนัง+ติดบัว ║▲"
     - ปรับการคำนวณความยาวบัว (`estimateUpstandLength` / `studioEstimate`):
       * ด้านที่เป็น `"upstand"` หรือ `"wall-flush+upstand"` ให้นับเป็นความยาวบัว (Upstand Length) เพื่อคิดค่าบัวในใบเสนอราคา
     - ปรับการคำนวณขอบเปิด (`estimateOpenEdgeLength`):
       * เฉพาะด้านที่เป็น `"open-edge"` เท่านั้นที่นับเป็นขอบเปิด
     - เพิ่ม Helper Functions:
       * `setStudioEdgeStatus(piece: StudioPiece, rectangleId: string, side: StudioSide, status: SideStatus): StudioPiece`
       * `clearStudioEdgeStatus(piece: StudioPiece, rectangleId: string, side: StudioSide): StudioPiece` (เปลี่ยนเป็น "normal")
       * `cycleStudioEdgeStatus(current: SideStatus): SideStatus` (วนลูป: normal -> upstand -> wall-flush -> wall-flush+upstand -> open-edge -> normal)
  2. เขียน Unit Tests ใน artifacts/knight-basins/test/studio-edge-finishes.test.ts (ใหม่):
     - ทดสอบการคำนวณความยาวบัวเมื่อมีด้านที่เป็น "wall-flush+upstand"
     - ทดสอบ Helper functions: setStudioEdgeStatus, clearStudioEdgeStatus, cycleStudioEdgeStatus
     - ทดสอบ label แสดงผลภาษาไทยถูกต้องครบทุกสถานะ

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-edge-finishes.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (ให้ Replit ทำ UI)
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-studio-edge-finishes-logic แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 291 / pass 285 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-edge-finishes.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-studio-edge-finishes-logic (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

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
| 7 | SCOPE ใช้ absolute path ที่มีอยู่จริงในเครื่องสำหรับชัย | ✅ ผ่าน |
| 8 | มีข้อห้ามแตะต้องไฟล์ Print Layout และ DB Migration | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการทำงานครอบคลุมสถานะขอบทั้ง 5 รูปแบบ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ UI หรือ Studio Core Components | ✅ ผ่าน |
