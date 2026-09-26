# ใบงาน 74 (ชัย) — เพิ่มสถานะ "ขอบปิด ⊞" (closed-edge) และฟังก์ชันสร้างชิ้นงานตามขนาดแผ่นจริง

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย (Backend & Data Logic)

**ความต้องการ:** 
รองรับระบบกำหนดรูปทรงและขนาดแผ่นใหม่ของ 2D Studio:
1. **เพิ่มสถานะขอบ "closed-edge" (ขอบปิด ⊞):**
   - ใน `SideStatus`: เพิ่ม `"closed-edge"`
   - ใน `studioSideStatusLabel`: เพิ่ม label `"ขอบปิด ⊞"` (ด้านที่โชว์ปิดขอบให้เนียน)
   - ใน `studioSideStatusLabelForExport` (ของ `studio-export.ts`): เพิ่ม `"closed-edge": "ขอบปิด ⊞"`
   - ใน `STUDIO_EXPORT_LAYERS`: เพิ่ม `"CLOSED_EDGE"` และแมปใน `edgeLayer()`
   - ใน `renderStudioSvg`: เพิ่มสีขอบปิดใน `edgeColors`: ใช้สีน้ำเงินเข้ม `#1e40af`
2. **สร้างฟังก์ชันประกอบแผ่นและขอบ (Custom Shape & Edges Builder):**
   - ฟังก์ชัน `buildCustomShapePiece`:
     รับพารามิเตอร์: `pieceId`, `shape` ("I" | "l-left" | "l-right" | "u"), และรายการแผ่น `panels` (array ของ `{ widthMm, depthMm, edges: { top, bottom, left, right } }`):
     * สร้างสี่เหลี่ยมตามขนาดที่ส่งมา (1 แผ่นสำหรับ I, 2 แผ่นสำหรับ L, 3 แผ่นสำหรับ U)
     * ล็อกด้านที่เป็นรอยต่อระหว่างแผ่น (`exposedLengthMm === 0`) ไม่ให้มีสถานะขอบ
     * บันทึกสถานะขอบของแต่ละแผ่นลงใน `sideStatuses` ตามที่ระบุ พร้อมตั้ง `hasCustomEdges: true`
3. **เขียน Unit Tests 100% ใน `test/studio-closed-edge.test.ts`:**
   - ทดสอบว่า `"closed-edge"` มี label `"ขอบปิด ⊞"` ถูกต้อง
   - ทดสอบ `buildCustomShapePiece` กับทั้ง 3 รูปทรง (I 1 แผ่น, L 2 แผ่น, U 3 แผ่น)
   - ยืนยันว่าด้านรอยต่อระหว่างแผ่นถูกล็อก ไม่ถูกตั้งเป็นบัวหรือขอบเปิด

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts:
     - ขยาย type SideStatus เพิ่ม "closed-edge"
     - อัปเดต studioSideStatusLabel เพิ่ม "closed-edge": "ขอบปิด ⊞"
     - เพิ่มฟังก์ชัน buildCustomShapePiece(pieceId, shape, panels) เพื่อประกอบสี่เหลี่ยม 1, 2 หรือ 3 แผ่นพร้อมล็อกรอยต่อและตั้งสถานะขอบ
  2. ใน artifacts/knight-basins/src/data/studio-export.ts:
     - เพิ่ม "CLOSED_EDGE" ใน STUDIO_EXPORT_LAYERS
     - ใน edgeLayer(): แมป "closed-edge" -> "CLOSED_EDGE"
     - ใน studioSideStatusLabelForExport: เพิ่ม "closed-edge": "ขอบปิด ⊞"
     - ใน renderStudioSvg: เพิ่ม "closed-edge": "#1e40af" ใน edgeColors
  3. ใน artifacts/knight-basins/test/studio-closed-edge.test.ts (ใหม่):
     - เขียน Node-native unit tests ตรวจสอบความถูกต้องครบทั้ง 3 ข้อ

SCOPE:
  1) /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2) /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-export.ts
  3) /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-closed-edge.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง StudioPage.tsx หรือ App.tsx เด็ดขาด (เป็นงานของ Replit ใน Task 75)
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx
  - ห้ามแตะต้อง lib/db/schema หรือ API routes
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-studio-closed-edge แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npx pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 354 / pass 348 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-closed-edge.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-studio-closed-edge (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
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
| 7 | SCOPE ใช้ absolute path สำหรับเครื่องเรา | ✅ ผ่าน |
| 8 | กำหนด branch feat/chai-studio-closed-edge ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการล็อกรอยต่อและสถานะขอบปิดครบถ้วน | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
