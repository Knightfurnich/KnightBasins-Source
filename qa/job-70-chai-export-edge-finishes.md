# ใบงาน 70 (ชัย) — รองรับสถานะขอบคู่ (WALL_FLUSH_UPSTAND) ในระบบ Export DXF/SVG ส่งโรงงาน

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย

**ความต้องการ:** 
ในระบบส่งออกไฟล์แบบ CAD/DXF และเวกเตอร์ SVG (`artifacts/knight-basins/src/data/studio-export.ts`) ยังขาดการรองรับสถานะขอบใหม่ `wall-flush+upstand` (ชิดผนัง+ติดบัว ║▲) ที่เพิ่มเข้ามาใน Task 64:
1. ใน `STUDIO_EXPORT_LAYERS`: เพิ่ม Layer `"WALL_FLUSH_UPSTAND"` เข้าไปในรายการเลเยอร์มาตรฐาน CAD
2. ใน `edgeLayer(edge)`: คืนค่า `"WALL_FLUSH_UPSTAND"` เมื่อ `edge.status === "wall-flush+upstand"`
3. ใน `renderStudioSvg`:
   - เพิ่มสีของ `wall-flush+upstand` ใน `edgeColors`: ใช้สีม่วง `#7c3aed` (ตรงกับสีของปุ่มในหน้า Studio)
   - นำ `studioEdgeFinishSummary(piece.piece)` (จาก `studio-model.ts`) มาแสดงเป็นข้อความสรุปขอบรายด้านในแบบ SVG
4. เขียน Node-native unit tests ตรวจสอบความถูกต้อง 100% ใน `artifacts/knight-basins/test/studio-export-edge-finishes.test.ts`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-export.ts:
     - เพิ่ม "WALL_FLUSH_UPSTAND" ใน STUDIO_EXPORT_LAYERS
     - ใน edgeLayer(edge): ถ้า edge.status === "wall-flush+upstand" ให้คืนค่า "WALL_FLUSH_UPSTAND"
     - ใน renderStudioSvg:
       * เพิ่ม "wall-flush+upstand": "#7c3aed" ใน edgeColors
       * นำ studioEdgeFinishSummary มาแสดงใน SVG เพื่อให้โรงงานอ่านสรุปขอบรายด้านได้ทันที
  2. ใน artifacts/knight-basins/test/studio-export-edge-finishes.test.ts:
     - เขียน Node-native unit tests ยืนยันว่า:
       1) STUDIO_EXPORT_LAYERS มี "WALL_FLUSH_UPSTAND"
       2) renderStudioDxf ส่งออกเลเยอร์ WALL_FLUSH_UPSTAND เมื่อมีขอบ wall-flush+upstand
       3) renderStudioSvg มีสีม่วง #7c3aed และมีข้อความสรุปขอบ

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-export.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-export-edge-finishes.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง StudioPage.tsx หรือ App.tsx เด็ดขาด (เป็นงานของ Replit)
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx
  - ห้ามแตะต้อง lib/db/schema หรือ API routes
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-export-edge-finishes แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 333 / pass 327 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-export-edge-finishes.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-export-edge-finishes (เปิด PR เข้า main)
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ monorepo | ✅ ผ่าน |
| 8 | กำหนด branch feat/chai-export-edge-finishes ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการเรนเดอร์ DXF และ SVG ครบถ้วน | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
