# ใบงาน 209 (ชัย) — Studio A1: Smart Basin Placement & Shape Change Resilience

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) · **ร่างเนื้อหาโดย:** ชัย (ตามที่เดวิดอนุมัติ)
**ผู้รับผิดชอบ:** ชัย (Programmer) · เริ่มได้ทันที
**Branch:** `feat/chai-studio-smart-placement-and-undo`
**ลำดับงาน:** 209 (A1) → 210 (A2) → 211 (B) · ใบงาน 212 (C) ทำขนานได้
**ที่มา:** PR #166 (job-208) กันอ่างหายแล้ว แต่ใช้ clamp พิกัดดิบ ทำให้อ่างชิดขอบ ขึ้นเตือน "ระยะขอบหินรอบอ่างต้องไม่น้อยกว่า 100 มม." ทันทีหลังเปลี่ยนทรง (ตรวจบนเว็บจริง I → L ขวา) ลูกค้าต้องลากแก้เอง ไม่มีข้อความบอกว่าอ่างถูกย้าย และกลับทรงเดิมไม่ได้
**วัตถุประสงค์:** เมื่อเปลี่ยนทรง อ่างต้องอยู่ครบ อยู่ในตำแหน่งที่สมเหตุสมผลตามกติการะยะขอบ ลูกค้ารู้ว่าเกิดอะไรขึ้น และย้อนกลับได้

```
GOAL:
  1. เพิ่มฟังก์ชัน pure ใน artifacts/knight-basins/src/data/studio-model.ts เช่น reanchorPlacementsToPiece(placements, oldPiece, newPiece) คืน { placements, notices } แล้วให้ applyCustomShape (StudioPage.tsx ~บรรทัด 1520–1540) เรียกใช้แทน clamp พิกัดดิบของ PR #166
     - เก็บสัดส่วนตำแหน่งกึ่งกลางอ่างบนแผ่นเดิม (เศษส่วนของความกว้าง/ยาว) แล้ววางที่ตำแหน่งเทียบเท่าบนแผ่นเป้าหมาย (แผ่นเดิมถ้ายังอยู่ ไม่งั้นแผ่นแรกของชิ้นงานใหม่)
     - เว้นระยะขอบ STUDIO_BASIN_SAFETY_MARGIN_MM เสมอ (ค่าคงที่เดียวกับ admin LeadsManager — ห้ามฝังเลข 100) อ้างแนวคิด clampAxis ของ createStudioBasinPlacement
     - ใช้ placementCutSize ตัดสินขนาดหลุมทุกครั้ง; ห้ามใช้ setBasinPlacementOrientation (legacy ที่สลับ width/depth ซ้ำ)
     - หลายอ่างในชิ้นงานเดียวกันต้องไม่ซ้อนกัน (แนวเดียวกับ basinPlacementOverlapWarnings / distributeBasins)
     - ห้ามลบอ่างทุกกรณี: ถ้าไม่พอดีผังใหม่ให้เก็บไว้ที่ตำแหน่งใกล้ที่สุดและคืน notice "no-fit"
  2. แจ้งลูกค้าหลังประกอบผัง: แถบสถานะ role="status" เช่น "ย้ายอ่าง KF003 ให้อยู่ในผังใหม่แล้ว — ตรวจตำแหน่ง" และกรณีไม่พอดี "อ่าง KF003 ใหญ่เกินผังใหม่" พร้อมทางเลือก ปรับขนาดผัง / เปลี่ยนรุ่นอ่าง / นำอ่างออก (เพิ่มข้อความใหม่เท่านั้น ห้ามแก้ข้อความไทยเดิมที่ลูกค้าเห็น)
  3. ย้อนกลับได้:
     - เก็บสถานะก่อนเปลี่ยนทรง แล้วขึ้น toast "เปลี่ยนทรงแล้ว · [ย้อนกลับ]" (~10 วินาที หรือจนลูกค้าแก้ผังต่อ)
     - ปุ่ม X ลบอ่างขึ้น toast "นำอ่าง <SKU> ออกจากผังแล้ว · [เลิกทำ]" แทนการลบเงียบ (ไม่ใช้กล่องยืนยัน)
  4. เทสต์
     - พฤติกรรมจริงของ reanchorPlacementsToPiece: I→L ขวา / L→I / I→U, อ่าง 1 และ 2 ตัว, อ่างแนวตั้ง (rotation 90), อ่างใหญ่เกินผัง; ผลลัพธ์เคารพ margin (basinPlacementsViolatingEdgeClearance ต้องว่าง เมื่อพอดี), ไม่ซ้อนกัน, id/sku/rotation ไม่เปลี่ยน
     - แบบร่างเก่าที่มีเฉพาะ orientation:"vertical" (ไม่มี rotation) ยังได้ footprint เดียวกับ placementCutSize
     - DXF: createStudioExportModel (data/studio-export.ts) กับอ่างหมุน 90° และอ่างที่ถูก re-anchor ต้องได้ widthMm/heightMm = placementCutSize
     - ผังส่งช่าง: อ่านค่าผ่าน FactoryCutListModal readPlacement ได้ footprint เดียวกัน (อย่างน้อยเทสต์ที่ placement หลัง re-anchor)
     - static: applyCustomShape เรียก reanchorPlacementsToPiece, ไม่มี .filter ลบอ่าง; ปุ่ม X มี toast เลิกทำ
     - ทดสอบแล้วว่าจับได้จริง (ใส่การถดถอยทีละแบบ → เทสต์ตก)

SCOPE:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/ (ไฟล์เทสต์ใหม่ + ปรับ studio-shape-change-keeps-basin.test.ts ให้สอดคล้อง)

FORBIDDEN:
  - ห้ามแตะ src/index.css (0 diff; ใช้ inline style) — ถ้าจำเป็นต้องใช้ CSS ให้รายงานกลับก่อน
  - ห้ามแก้สูตรราคา/พื้นที่, API, FactoryCutListModal, studio-export.ts (เพิ่มได้เฉพาะเทสต์)
  - ห้ามเพิ่มค่า rotation นอกเหนือ 0|90; ห้ามใช้ setBasinPlacementOrientation
  - ห้ามลบอ่างอัตโนมัติ; ห้ามฝังเลข 100 (ใช้ STUDIO_BASIN_SAFETY_MARGIN_MM)
  - ห้ามลบ/ปิดเทสต์เพื่อให้ผ่าน; ห้ามส่งใบเสนอราคาจริงหรือเขียนข้อมูล Production ตอนทดสอบสด
  - ทำงานผ่าน branch: feat/chai-studio-smart-placement-and-undo แล้วเปิด PR เข้า main

EVIDENCE (แนบผลรันจริงทุกข้อ):
  1) git status + branch
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) เทสต์ที่เพิ่ม/แตะ ผ่านทุกข้อ (ระบุไฟล์+จำนวน) · npm test non-browser เทียบ baseline ล่าสุดของ main (และ CI unit-tests บน GitHub)
  4) ทดสอบสดบน Production หลัง deploy ด้วยเบราว์เซอร์: I → L ขวา (อ่างอยู่ ไม่ขึ้นคำเตือนระยะขอบ), กดย้อนกลับแล้วกลับทรงเดิม, ลบอ่างแล้วเลิกทำได้
  5) git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css ว่าง

OUTPUT:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/ (ไฟล์เทสต์)

STOP:
  - เมื่อ tsc 0 errors, เทสต์ผ่านครบ, ทดสอบสดผ่าน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

## 📌 ข้อเท็จจริงที่ตรวจแล้ว (อ้างอิงโค้ดบน main)
* `studio-model.ts`: `STUDIO_BASIN_SAFETY_MARGIN_MM = 100` (บรรทัด ~212), `createStudioBasinPlacement` มี `clampAxis` เว้นขอบ (บรรทัด ~1640), `clampPlacementToSheet` ไม่เว้นขอบ (ที่ PR #166 ใช้), `basinPlacementsViolatingEdgeClearance` (บรรทัด ~1212), `placementCutSize` (~1729), `rotatePlacement` (~1798)
* `admin/LeadsManager.tsx` ใช้ `basinPlacementsViolatingEdgeClearance(state, STUDIO_BASIN_SAFETY_MARGIN_MM)` ตัดสินลีดที่มีอ่างชิดขอบ
* `data/studio-bridge.ts` ~172 สร้าง placement เมื่อเปิด Studio จากหน้าอ่าง ต้องไม่ขัดกับกติกานี้
* ฟังก์ชันหมุนมี 2 แบบขัดกัน: `rotatePlacement` (UI ใช้จริง เก็บ width/depth สลับที่ `placementCutSize`) กับ `setBasinPlacementOrientation` (legacy สลับ width/depth เอง → สลับซ้ำ 2 รอบ)
