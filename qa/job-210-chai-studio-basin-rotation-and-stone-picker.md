# ใบงาน 210 (Studio UX) — จำขนาดเคาน์เตอร์ข้ามทรง + กำหนดตำแหน่งอ่าง 7 ระดับ + กดสีเปลี่ยนทันที + หมุนอ่างอัตโนมัติ + เสริมแกร่งระบบสี & DXF

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ได้รับอนุมัติจากบอสให้เสริมจุดสำคัญเพิ่ม
**Branch:** `feat/chai-studio-basin-rotation-and-stone-picker`
**ที่มา:** บอสสั่งทบทวนและเสริมจุดที่เกี่ยวข้องทั้งหมดเข้าใน Job 210 เพื่อให้หน้า 2D Studio และการแสดงผลผังสมบูรณ์แบบในใบงานเดียว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. จำขนาดเคาน์เตอร์เดิมเมื่อสลับทรง (Preserve Dimensions across Shape Change):
     - ใน StudioPage.tsx: เมื่อลูกค้าสลับทรงเคาน์เตอร์ (I ↔ L ซ้าย ↔ L ขวา ↔ U) ห้ามเรียก studioCustomShapeDefaults มารีเซ็ตขนาดเดิม
     - แผ่นหลัก (แผ่นที่ 1): ต้องคงค่า lengthMm และ depthMm เดิมที่ลูกค้ากรอกไว้เสมอ
     - แผ่นขา (แผ่นที่ 2 และ 3): ให้สืบทอดความลึก depthMm จากแผ่นหลักอัตโนมัติ
  2. กำหนดตำแหน่งอ่างอัจฉริยะ 7 ระดับ (7-Step Snap Grid Positioner):
     - ในแผงควบคุมตำแหน่งอ่าง เพิ่มปุ่มเลือกระดับ [ 1 | 2 | 3 | 4 | 5 | 6 | 7 ] สำหรับแผ่นที่เลือก โดยคำนวณช่วงปลอดภัยจากขอบซ้ายถึงขอบขวา (เว้น STUDIO_BASIN_SAFETY_MARGIN_MM = 100 มม. ทั้งสองฝั่ง):
       - ระดับ 1: ชิดซ้ายสุด (เว้น 100 มม. พอดี)
       - ระดับ 2: ค่อนซ้ายมาก (~16.6%)
       - ระดับ 3: ค่อนซ้าย (~33.3% หรือ 1 ใน 3 ฝั่งซ้าย)
       - ระดับ 4: กึ่งกลางแผ่นพอดี (Center 50% - ค่าเริ่มต้น)
       - ระดับ 5: ค่อนขวา (~66.6% หรือ 1 ใน 3 ฝั่งขวา)
       - ระดับ 6: ค่อนขวามาก (~83.3%)
       - ระดับ 7: ชิดขวาสุด (เว้น 100 มม. พอดี)
     - เมื่อกดเลือกระดับ อ่างจะวิ่งเข้าล็อกพิกัด xMm ทันที และเมื่อสลับทรงเคาน์เตอร์ ให้อ่างจำระดับที่เลือกไว้และคำนวณตำแหน่งใหม่บนแผ่นเดิมให้โดยอัตโนมัติ
  3. กดเลือกสีหิน = ผังเปลี่ยนสีหลักทันที (Instant Active Stone Selection):
     - เมื่อลูกค้าคลิกที่ตัวอย่างสีหินใดๆ ในแผงเลือกสี ให้สีนั้นกลายเป็นสีหลัก (Active Stone) ทันที ผังบน Canvas 2D ต้องเปลี่ยนสีตามทันทีโดยไม่ต้องกดปุ่มอื่นซ้ำ
     - แสดงป้ายชื่อและรหัสสีหินที่กำลังแสดงผลอยู่อย่างชัดเจน
  4. หมุนอ่างอัตโนมัติให้สอดคล้องกับความลึกแผ่น (Auto-Rotate Basin to Fit Depth):
     - สำหรับอ่างที่มีขนาดหลุมยาวกว่ากว้าง (เช่น KF003 หลุม 350 × 500 มม.) เมื่อนำมาวางบนแผ่นที่มีความลึก 600 มม. ให้ระบบตั้งค่าเริ่มต้นหมุน 90° (แนวนอน) ให้อัตโนมัติ เพื่อให้ด้าน 350 มม. อยู่ในแนวลึก และเหลือขอบหินหน้า-หลัง ≥ 100 มม. ทันทีโดยไม่ติดเตือนสีแดง
  5. แก้ไขจุดแฝง stoneColorByName และการวาดผังใน SavedQuotePage (App.tsx):
     - ใน App.tsx บรรทัด 1058: วาดผังโดยคำนวณขนาดอ่างผ่าน placementCutSize(placement) เพื่อให้แสดงผลทิศทางการหมุนถูกต้อง
     - ใน StudioPage.tsx (~2356, ~3067, ~3198) และ App.tsx (~1039, ~1055): ส่ง catalogStoneColors.all ให้ฟังก์ชัน stoneColorByName ทุกจุด ป้องกันกรณีสีหินตกไปใช้สี fallback สีขาว
  6. ทดสอบ DXF Export ครอบคลุมอ่างหมุน:
     - เพิ่มเทสต์ใน test/studio-export.test.ts หรือ test/studio-smart-positioning-and-picker.test.ts ยืนยันว่าการ Export DXF (studio-export.ts) บันทึกตำแหน่งและมิติของอ่างที่หมุน 90° และอ่างที่ถูกสแน็ป 7 ระดับได้อย่างถูกต้อง

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/studio-smart-positioning-and-picker.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามฮาร์ดโค้ดตัวเลขระยะขอบ ให้ใช้ค่าคงที่ STUDIO_BASIN_SAFETY_MARGIN_MM เสมอ
  - ห้ามแตะสูตรราคาและการคำนวณเงินใน studioEstimate
  - ห้ามใช้ setBasinPlacementOrientation (legacy ที่สลับ width/depth ซ้ำซ้อน) ให้ใช้ placementCutSize เสมอ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-studio-basin-rotation-and-stone-picker ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-smart-positioning-and-picker.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 782 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/studio-smart-positioning-and-picker.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | จำขนาด + 7 ระดับ + สีทันที + หมุนออโต้ + จุดแฝงสี/DXF |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามใช้ legacy rotation |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ครอบคลุมทั้ง 7 ระดับ, สีสด, และขนาดเดิม |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลสิทธิ์ครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 210 เรียบร้อย |
