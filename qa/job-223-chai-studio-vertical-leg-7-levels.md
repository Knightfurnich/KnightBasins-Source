# ใบงาน 223 (Studio UX Polish) — ปุ่มตำแหน่งอ่าง 7 ระดับรองรับแผ่นขาแนวตั้ง (ชิ้นงานตัว L/U)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · งานต่อเนื่องเพื่อความสมบูรณ์ของ 2D Studio
**Branch:** `feat/chai-studio-vertical-leg-7-levels`
**ที่มา:** จากการตรวจรับ Job 210 ชัยได้ให้ข้อสังเกตไว้ว่า ปุ่มตำแหน่งอ่าง 7 ระดับปัจจุบันคำนวณสแน็ปตามแกนยาวของแผ่นหลัก (แกน X แนวนอน) เท่านั้น หากลูกค้าเลือกวางอ่างบน "แผ่นขาแนวตั้ง" ของชิ้นงานทรงตัว L หรือตัว U ปุ่ม 7 ระดับจะไม่วิ่งตามความยาวของขา บอสและเดวิดจึงเปิดใบงานนี้เพื่อเก็บรายละเอียดให้ปุ่ม 7 ระดับรองรับทุกแผ่นอย่างสมบูรณ์แบบ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts:
     - ปรับปรุงฟังก์ชันคำนวณตำแหน่ง 7 ระดับ (positionPlacementAtLevel):
       - ให้รับรู้ทิศทางหลักของแผ่นเป้าหมาย (Host Rectangle):
         - หากแผ่นเป้าหมายเป็นแนวนอน (ความกว้าง widthMm > ความยาว lengthMm เช่น แผ่นหลัก): ให้คำนวณสแน็ปตามแกน X (ซ้าย -> ขวา) เหมือนเดิม
         - หากแผ่นเป้าหมายเป็นแนวตั้ง (ความยาว lengthMm > ความกว้าง widthMm เช่น แผ่นขาของตัว L หรือ U): ให้คำนวณสแน็ปตามแกน Y (บน -> ล่าง) หรือตามความยาวของขา โดยเว้นระยะปลอดภัย STUDIO_BASIN_SAFETY_MARGIN_MM = 100 มม. ทั้งสองฝั่ง (ระดับ 1 = ชิดบนสุด 100 มม. / ระดับ 4 = กึ่งกลางขา 50% / ระดับ 7 = ชิดล่างสุด 100 มม.)
       - รักษาระยะปลอดภัย STUDIO_BASIN_SAFETY_MARGIN_MM = 100 มม. เสมอในทุกแกนและทุกระดับ
  2. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ใน Inspector ป้ายกำกับแถบ 7 ระดับ: หากเลือกแผ่นแนวตั้ง ให้แสดงคำแนะนำทิศทางให้สอดคล้อง เช่น "บนสุด ◄--- กึ่งกลาง ---► ล่างสุด"
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-vertical-leg-positioning.test.ts:
       - ทดสอบการกดปุ่มระดับ 1 ถึง 7 บนแผ่นขาแนวตั้งของเคาน์เตอร์ทรง L
       - ยืนยันว่าพิกัด yMm วิ่งตั้งแต่ระยะ 100 มม. จากขอบบน จนถึง 100 มม. จากขอบล่าง
       - ยืนยันว่าไม่หลุดระยะปลอดภัย 100 มม. ในทุกระดับ
       - ทดสอบการสลับทรง I <-> L อ่างบนแผ่นขายังคงจำระดับตำแหน่งได้ถูกต้อง

SCOPE:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-vertical-leg-positioning.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามฮาร์ดโค้ดตัวเลข ให้ใช้ค่าคงที่ STUDIO_BASIN_SAFETY_MARGIN_MM เสมอ
  - ห้ามกระทบพฤติกรรมเดิมของแผ่นหลักแนวนอน (แผ่นหลักต้องทำงานถูกต้องเหมือนเดิม 100%)
  - ห้ามแตะ StudioFootprint.tsx หรือโมเดลคำนวณราคาใดๆ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-studio-vertical-leg-7-levels ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-vertical-leg-positioning.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 910 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-vertical-leg-positioning.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ปุ่ม 7 ระดับรองรับแผ่นขาแนวตั้งตัว L/U |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน ไม่แตะส่วนอื่น |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, คงพฤติกรรมแผ่นหลักเดิม |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | เก็บรายละเอียดข้อสังเกตจาก Job 210 |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลสิทธิ์ครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 223 เรียบร้อย |
