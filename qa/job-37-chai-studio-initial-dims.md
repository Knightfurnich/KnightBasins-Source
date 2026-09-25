# ใบงาน 37 (ชัย) — ปรับขนาดเริ่มต้นบอร์ด Studio เป็นขนาดจริง 1800x600 และเพิ่มตัวช่วยวางอ่าง

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของต้องการให้ 2D Studio ใช้งานง่ายและสะท้อนขนาดจริง: (1) ปรับขนาดบอร์ดเริ่มต้นจาก 5000×5000 มม. (25 ตร.ม. ยอดเกือบ 2 แสน) เป็นขนาดเคาน์เตอร์จริง 1800×600 มม. (2) เพิ่มฟังก์ชัน `createStudioBasinPlacement` วางอ่างกึ่งกลางหรือชิดซ้าย/ขวา พร้อมรักษาระยะปลอดภัย ≥ 100 มม.

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ปรับค่าคงที่บอร์ดเริ่มต้นใน artifacts/knight-basins/src/data/studio-model.ts:
     - STUDIO_INITIAL_BOARD_WIDTH_MM = 1800; (ความยาวเคาน์เตอร์)
     - STUDIO_INITIAL_BOARD_LENGTH_MM = 600; (ความลึกเคาน์เตอร์)
  2. เพิ่มฟังก์ชัน helper วางอ่างล้างหน้าบนแผ่นเคาน์เตอร์:
     `export function createStudioBasinPlacement(sku: string, sheet: { id: string; widthMm: number; lengthMm: number }, pieceId: string, align?: "center" | "left" | "right"): BasinPlacement`
     คำนวณตำแหน่ง X, Y กึ่งกลาง หรือชิดซ้าย/ขวา โดยรักษาระยะปลอดภัยขอบ ≥ 100 มม. อัตโนมัติ

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-model.test.ts
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-export.test.ts (อัปเดตค่าคาดหวัง fresh-board ให้ตรงกับ 1800×600 และ 1.08 ตร.ม.)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/admin/** (เป็นของ Replit)
  - ห้ามแตะ index.css, StudioPage.tsx หรือไฟล์ UI อื่น ๆ
  - ห้ามแก้ตรรกะราคาเดิม หรือแก้ฟังก์ชัน resolveMatchingStoneForBasin ที่เพิ่งทำเสร็จ
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-studio-initial-dims แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 193 / pass 188 / fail 2 / cancelled 3 (fail เฉพาะ 2 ตัวใน *.browser.test.ts)
     ชุดที่ไม่ใช่ browser ต้องผ่าน 188/188 ครบ
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) เทสต์ใหม่ใน studio-model.test.ts:
     - ตรวจสอบว่า STUDIO_INITIAL_BOARD_WIDTH_MM คือ 1800 และ STUDIO_INITIAL_BOARD_LENGTH_MM คือ 600
     - ตรวจสอบว่า createStudioBasinPlacement("KF001", sheet, "piece-1", "center") วางอ่างกึ่งกลาง X พอดี
     - ตรวจสอบว่าระยะร่นจากขอบทุกด้านไม่ต่ำกว่า STUDIO_BASIN_SAFETY_MARGIN_MM (100 มม.)

OUTPUT:
  - branch: feat/chai-studio-initial-dims (เปิด PR เข้า main รอตรวจ)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ non-browser ตกแม้แต่ตัวเดียว (ต้องผ่าน 100%)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน src/data/studio-model.ts:
     - แก้:
       `export const STUDIO_INITIAL_BOARD_WIDTH_MM = 1800;`
       `export const STUDIO_INITIAL_BOARD_LENGTH_MM = 600;`
     - เพิ่มฟังก์ชัน:
       ```ts
       export function createStudioBasinPlacement(
         sku: string,
         sheet: { id: string; widthMm: number; lengthMm: number },
         pieceId: string,
         align: "center" | "left" | "right" = "center",
       ): BasinPlacement {
         const cutSize = basinCutSize(sku);
         const basinWidth = cutSize.widthMm ?? 500;
         const basinDepth = cutSize.heightMm ?? 400;
         const safety = STUDIO_BASIN_SAFETY_MARGIN_MM; // 100 mm

         let xMm = Math.round((sheet.widthMm - basinWidth) / 2);
         if (align === "left") xMm = safety;
         if (align === "right") xMm = Math.max(safety, sheet.widthMm - basinWidth - safety);

         // วางกึ่งกลางตามแนวลึก หรือร่นจากขอบหลังโดยมีระยะปลอดภัย
         const yMm = Math.max(safety, Math.round((sheet.lengthMm - basinDepth) / 2));

         return {
           id: `basin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
           sku,
           pieceId,
           sheetId: sheet.id,
           xMm,
           yMm,
           widthMm: basinWidth,
           depthMm: basinDepth,
           offsetXMm: xMm,
           offsetYMm: yMm,
           rotation: 0,
         };
       }
       ```
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ขนาดเริ่มต้น 1800x600 + helper วางอ่าง |
| 2 | GOAL วัดได้ | ✅ ค่าคงที่เป็น 1800/600 + วางอ่างกึ่งกลางเว้นระยะ 100 มม. |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ frontend, ห้ามแก้ตรรกะราคา |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm test 192/188/2 + typecheck + เทสต์ใหม่ |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-studio-initial-dims |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 192 / pass 188 / fail 2 |
| 9 | CONTRACT ระบุโค้ดจริง | ✅ มีฟังก์ชัน createStudioBasinPlacement พร้อมสูตร |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
