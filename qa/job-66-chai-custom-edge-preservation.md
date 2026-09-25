# ใบงาน 66 (ชัย) — ระบบป้องกันการลบทับขอบของผู้ใช้ (Custom Edge Preservation & Joint Guard)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ชัย

**ความต้องการ:** 
เจ้าของระบบ (คุณนพ) แจ้งว่าไม่สามารถเอา "ติดบัว / ปิดขอบ / ชิดผนัง" ออกจากผังได้ จากการตรวจสอบพบว่าระบบมี `applySimpleShapeEdgeDefaults` ที่แอบรันอัตโนมัติและเขียนทับสถานะขอบกลับไปเป็นค่าเริ่มต้นทุกครั้งที่ผู้ใช้พยายามแก้ไขหรือเปลี่ยนทรงเคาน์เตอร์ จึงต้องการให้ชัยเพิ่มกลไก `hasCustomEdges: boolean` ในตัวโมเดล `StudioPiece` และฟังก์ชันป้องกันการเขียนทับขอบของผู้ใช้ เพื่อให้ขอบที่ผู้ใช้ตั้งค่าไว้เองคงอยู่ถาวร 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts:
     - เพิ่มฟิลด์ใน `StudioPiece` interface:
       `hasCustomEdges?: boolean;` (เป็น true เมื่อผู้ใช้ปรับแต่งขอบเอง)
     - ปรับฟังก์ชัน Helper ที่ชัยเพิ่งสร้างใน Task 64:
       * `setStudioEdgeStatus(piece, rectangleId, side, status)`:
         ให้ตั้งค่า `hasCustomEdges: true` เสมอในชิ้นงานที่คืนกลับไป
       * `clearStudioEdgeStatus(piece, rectangleId, side)`:
         ให้ตั้งค่า `hasCustomEdges: true` เสมอในชิ้นงานที่คืนกลับไป
     - เพิ่มฟังก์ชันตรวจสอบ:
       * `isStudioPieceCustomized(piece: StudioPiece): boolean`:
         คืนค่า true ถ้า `piece.hasCustomEdges === true`
     - เพิ่มฟังก์ชันผสานขอบอย่างปลอดภัยเมื่อเปลี่ยนทรง:
       * `preserveCustomEdgesOnShapeChange(previousPiece: StudioPiece, nextPiece: StudioPiece): StudioPiece`:
         - ถ้า `previousPiece.hasCustomEdges === true`: ห้ามรีเซ็ตขอบเป็นค่าเริ่มต้น ให้คงค่า `hasCustomEdges: true` และคัดลอกสถานะขอบเดิมตามตำแหน่งแผ่น
         - ถ้าไม่ใช่ custom edges: จึงยอมให้รัน auto-map ค่าเริ่มต้นได้
     - เพิ่มตัวกรองความปลอดภัย:
       * ป้องกันไม่ให้ตั้งสถานะขอบบนด้านที่เป็นรอยต่อระหว่างแผ่น (Joint) ที่มี `exposedLengthMm === 0`
  2. เขียน Unit Tests ใน artifacts/knight-basins/test/studio-custom-edges-preservation.test.ts (ใหม่):
     - ทดสอบว่าการเรียก setStudioEdgeStatus และ clearStudioEdgeStatus ทำให้ hasCustomEdges เป็น true
     - ทดสอบ preserveCustomEdgesOnShapeChange ว่าคงค่าขอบที่ผู้ใช้ตั้งไว้ ไม่ถูกรีเซ็ตกลับเป็นค่าเริ่มต้น
     - ทดสอบว่ารอยต่อระหว่างแผ่นไม่สามารถตั้งสถานะขอบได้

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-custom-edges-preservation.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (ให้ทีม UI ทำ)
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-custom-edge-preservation แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 307 / pass 301 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-custom-edges-preservation.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-custom-edge-preservation (เปิด PR เข้า main)
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
| 11 | ทดสอบการคงสถานะขอบของผู้ใช้ครอบคลุมทุกกรณี | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ UI หรือ Studio Core Components | ✅ ผ่าน |
