# ใบงาน 68 (ชัย) — สรุปสถานะขอบรายด้านสำหรับใบสั่งผลิตโรงงาน (Per-Side Edge Finish Breakdown)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ชัย

**ความต้องการ:** 
ปัจจุบันใบสั่งผลิตโรงงาน (`WorkshopProductionSheet.tsx`) มีเพียงบรรทัดเช็คลิสต์กว้าง ๆ ว่า "ตรวจสอบงานลบมุม ลบเหลี่ยม ขอบเปิด และบัวกันน้ำ" และรายการแจ้งเตือนทีมขายส่งค่าบัวเป็น **ความยาวรวม** เท่านั้น (เช่น "บัวยาว 2.0 ม.") ซึ่งไม่บอกว่าด้านไหนต้องติดบัว ด้านไหนขอบเปิด

หลังเพิ่มสถานะขอบ 5 แบบ (รวม `ชิดผนัง+ติดบัว`) ช่างโรงงานตัดแผ่นและเก็บขอบไม่ได้ เพราะไม่รู้ว่าด้านใดต้องการอะไร จึงต้องมีฟังก์ชันสรุปสถานะขอบ **รายด้าน** ในตัวโมเดล

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts:
     - เพิ่มฟังก์ชัน `studioEdgeFinishBreakdown(piece: StudioPiece)` คืนค่าเป็น array ของ:
       `{ side: StudioSide; sideLabel: string; status: SideStatus; statusLabel: string; lengthMm: number }`
       * `sideLabel` ใช้คำเดียวกับที่มีอยู่แล้วในระบบ: "บน" / "ขวา" / "ล่าง" / "ซ้าย"
       * `statusLabel` ใช้ค่าจาก `studioSideStatusLabel(status)` ตัวเดิม (ห้ามเขียนชุด label ซ้ำใหม่)
       * ต้องกรองเฉพาะด้านที่ `exposedLengthMm > 0` เท่านั้น (ด้านที่เป็นรอยต่อระหว่างแผ่นต้องไม่โผล่ในรายการ)
       * ด้านที่ status เป็น "normal" ให้คงอยู่ในรายการได้ (ช่างต้องรู้ว่าเป็นขอบปกติ) แต่ต้องเรียงลำดับให้อ่านง่าย
     - เพิ่มฟังก์ชัน `studioEdgeFinishSummary(piece: StudioPiece): string`
       * คืนข้อความไทยบรรทัดเดียวสำหรับใส่ใน description ของใบสั่งผลิต เช่น
         `ขอบ: บน ติดบัว 1.5 ม. · ซ้าย ชิดผนัง 0.6 ม. · ล่าง ขอบเปิด 0.6 ม.`
       * ด้านที่เป็น "normal" ให้เขียนว่า "ปกติ" และความยาวทศนิยม 2 ตำแหน่ง
       * ถ้าไม่มีด้านที่ exposed เลย ให้คืนสตริงว่าง ""
       * ฟังก์ชันนี้ต้องเป็น pure function ไม่แตะ DOM และไม่เรียก React
  2. เขียน Unit Tests ใน artifacts/knight-basins/test/studio-edge-finish-breakdown.test.ts (ใหม่):
     - ทดสอบว่าด้านที่เป็นรอยต่อระหว่างแผ่น (exposedLengthMm = 0) ไม่ปรากฏในผลลัพธ์
     - ทดสอบว่า statusLabel ของ "wall-flush+upstand" แสดง "ชิดผนัง+ติดบัว ║▲" ตรงกับ studioSideStatusLabel
     - ทดสอบ studioEdgeFinishSummary ว่าความยาวถูกต้องและเรียงตาม บน / ขวา / ล่าง / ซ้าย
     - ทดสอบว่าแผ่นที่ไม่มีด้าน exposed เลย คืนสตริงว่าง ""

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-edge-finish-breakdown.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (ให้ทีม UI ทำ)
  - ห้ามแตะ WorkshopProductionSheet.tsx หรือ App.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-edge-finish-breakdown แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 328 / pass 322 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-edge-finish-breakdown.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-edge-finish-breakdown (เปิด PR เข้า main)
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
| 11 | ทดสอบว่าด้านที่เป็นรอยต่อไม่โผล่ในรายการขอบ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ UI หรือ Studio Core Components | ✅ ผ่าน |
