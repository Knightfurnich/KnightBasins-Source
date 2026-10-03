# ใบงาน 210 (ชัย) — Studio A2: Basin Rotation Sync & Instant Stone Selection

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) · **ร่างเนื้อหาโดย:** ชัย (ตามที่เดวิดอนุมัติ)
**ผู้รับผิดชอบ:** ชัย (Programmer) · **เริ่มหลังใบงาน 209 merge** (แตะ StudioPage.tsx เดียวกัน)
**Branch:** `feat/chai-studio-basin-rotation-and-stone-picker`
**ที่มา:** ข้อสังเกตของบอส — (1) วางอ่างแนวตั้งแล้วรูปอ่างยังหันทิศเดิม (2) เลือกสีหินแล้วผังไม่เปลี่ยน
**ผลตรวจบนเว็บจริง:** (1) กรอบอ่างสลับขนาดตาม rotation ถูกต้อง แต่ `BasinTopView` ไม่หมุนรูป (2) การกดสีในรายการเป็น "เพิ่มเข้าแถวกำลังคำนวณ" ผังและราคาตามเฉพาะสีที่ active (ตัวแรก) ต้องกดชิปอีกครั้ง

```
GOAL:
  1. หมุนรูปอ่างตาม rotation: BasinTopView (StudioPage.tsx ~บรรทัด 3194) รับข้อมูลแนวตั้ง/ขนาดหลุม แล้วหมุนภาพ 90° ในกรอบที่สลับขนาดแล้ว
     - ใช้ inline style: child กว้าง = (heightMm/widthMm)*100%, สูง = (widthMm/heightMm)*100%, translate(-50%,-50%) rotate(90deg)
     - ครอบคลุมทุกที่ที่วาดอ่าง: ผังหลัก (StudioPage ~2372 และ ~2778) และ StudioPlacementPreview (พิมพ์ A4 / แบบร่าง)
     - rotation ยังเป็น 0 | 90 เท่านั้น; ใช้ placementCutSize + rotation เสมอ (ห้าม setBasinPlacementOrientation)
  2. แก้ SavedQuotePage (App.tsx ~1050–1062 หน้า /quote/view): วาดกล่องอ่างด้วย placementCutSize แทน placement.widthMm/depthMm ตรงๆ (อ่างแนวตั้งต้องวาดแนวตั้ง) และส่งรายการสีสดให้ stoneColorByName
  3. กดสีหินในรายการ = ตั้งเป็นสีหลักทันที: แก้ toggleStone (StudioPage.tsx ~1987) ให้สีที่เพิ่งกดกลายเป็น activeStone (ถ้ายังไม่เลือกให้เพิ่มแล้ว active); ชิปแถว "กำลังคำนวณด้วย" ยังสลับ/เปรียบเทียบได้เหมือนเดิม; ถ้าเอาสีที่ active ออก ให้ active ตกไปสีที่เหลือ
  4. เพิ่มป้าย "สีที่แสดงบนผัง: <ชื่อ> (<รหัส>)" ใกล้ผัง
  5. แก้จุดแฝง: ส่งรายการสีสด (stoneColors) ให้ stoneColorByName ที่ StudioPage.tsx ~2368 และ ~3167 (ปัจจุบันตกไปใช้รายการเก่า 80 สี → รหัสสด VW342 หลุดไปใช้สีสำรอง)
  6. เทสต์
     - behavioural: ฟังก์ชันที่ตัดสินใจ active หลัง toggleStone (เพิ่ม/ถอด/สีเดิม)
     - SavedQuotePage ใช้ placementCutSize (static) และรับรายการสีสด
     - stoneColorByName กับรหัสสดที่ไม่อยู่ในรายการเก่า (VW342) ได้สีถูกเมื่อส่งรายการสีสด
     - static: BasinTopView มีการหมุนเมื่อ rotation 90 ในทั้ง 3 จุดที่วาดอ่าง
     - ทดสอบแล้วว่าจับได้จริง (ใส่การถดถอยทีละแบบ → เทสต์ตก)

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/App.tsx (เฉพาะ SavedQuotePage)
  - artifacts/knight-basins/src/components/StudioFootprint.tsx (ถ้าจำเป็น)
  - artifacts/knight-basins/test/ (ไฟล์เทสต์ใหม่)

FORBIDDEN:
  - ห้ามแตะ src/index.css (0 diff; ใช้ inline style) — ถ้าจำเป็นต้องใช้ CSS ให้รายงานกลับก่อน
  - ห้ามแก้สูตรราคา/พื้นที่, API, studio-model.ts (ยกเว้นเพิ่มฟังก์ชัน pure ที่จำเป็นต่อข้อ 3 โดยรายงานในรายงานสรุป), FactoryCutListModal, studio-export.ts
  - ห้ามเพิ่มค่า rotation นอกเหนือ 0|90; ห้ามใช้ setBasinPlacementOrientation
  - ห้ามแก้ข้อความไทยเดิมที่ลูกค้าเห็น (เพิ่มป้ายใหม่ได้)
  - ห้ามลบ/ปิดเทสต์เพื่อให้ผ่าน; ห้ามส่งใบเสนอราคาจริงหรือเขียนข้อมูล Production ตอนทดสอบสด
  - ทำงานผ่าน branch: feat/chai-studio-basin-rotation-and-stone-picker แล้วเปิด PR เข้า main

EVIDENCE (แนบผลรันจริงทุกข้อ):
  1) git status + branch
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) เทสต์ที่เพิ่ม/แตะ ผ่านทุกข้อ (ระบุไฟล์+จำนวน) · npm test non-browser เทียบ baseline ล่าสุดของ main (และ CI unit-tests บน GitHub)
  4) ทดสอบสดบน Production หลัง deploy ด้วยเบราว์เซอร์: หมุนอ่างแล้วรูปหมุนตาม, กดสี Neo Black แล้วผังเปลี่ยนทันที, ป้ายสีที่แสดงตรงกับสีที่กด
  5) git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css ว่าง

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/ (ไฟล์เทสต์)

STOP:
  - เมื่อ tsc 0 errors, เทสต์ผ่านครบ, ทดสอบสดผ่าน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

## 📌 ข้อเท็จจริงที่ตรวจแล้ว
* `/quote/view` (`SavedQuotePage`) วาดผังจริง ต่างจากที่เคยเข้าใจว่าไม่วาด; ใบเสนอราคา A4 (Formal Quotation) ไม่ได้วาดผัง
* รหัสสด 68 รหัส มี 1 รหัสที่หลุดไปสีสำรองเมื่อไม่ส่งรายการสีสด: `VW342` (รายการเก่าเป็น `V342`)
* การกดสีในรายการเพิ่มสีเข้าแถว "กำลังคำนวณด้วย" แต่ไม่เปลี่ยน activeStone (ทดสอบบนเว็บจริงแล้ว: กดชิปแล้วผังเปลี่ยนถูกต้อง `#dfe5e8` → `#1c1d1a` → `#090a09`)
