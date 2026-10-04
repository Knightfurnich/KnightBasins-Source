# ใบงาน 241-C (ชัย) — ซ่อมตรรกะ 2D Studio (โมเดล): อ่างหมุนกลับ + offsets ไม่ย้ายตามการย่อกระดาน

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย · เริ่มได้ทันที
**Branch:** `fix/chai-studio-model-basin-rotation-and-offsets`
**ที่มา:** บั๊กที่ตรวจพบและพิสูจน์ซ้ำได้ด้วยการรันโมดูลจริง (งานซ่อมเดิมอยู่ใน PR #285 ที่ปิดไปโดยไม่ merge)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ replaceStudioBasin ใน /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
     อาการ: อ่างที่หัน 90 องศา (แนวตั้ง) พอเปลี่ยนรุ่น ฟังก์ชันสลับ widthMm/depthMm ซ้ำกับการหมุน
     ทำให้ขนาดตัดจริงย้อนกลับ เช่น 500x350 กลายเป็น 350x500 และอาจหลุดระยะปลอดภัย 100 มม.
     ที่ถูกต้อง: ค่า widthMm/depthMm ที่เก็บคือขนาดของอ่างเอง ส่วนการหมุนให้ placementCutSize คิด
     จึงต้องใส่ขนาดดิบของรุ่นใหม่ลงไปโดยไม่สลับ
  2. แก้ applyStudioSizePreset ในไฟล์เดียวกัน อาการ: ย่อ/ขยายกระดานแล้วอัปเดตแค่ xMm
     แต่ตัววาดผังและช่องกรอก "ระยะ X" อ่านตำแหน่งจาก offsetXMm/offsetYMm (calculateBasinCoordinates)
     ผลคืออ่างยังถูกวาดที่พิกัดเดิม นอกแผ่นใหม่ (เช่น กระดาน 1800 -> 400 แต่อ่างยังวาดที่ x=725)
     ที่ถูกต้อง: เมื่อจัดอ่างใหม่กลางแผ่น ต้องคำนวณ offsets ใหม่ให้พิกัดที่วาดตรงกับ xMm
     (ใช้ calculateBasinOffsets) และไม่แตะอ่างที่ไม่มี offsets อยู่เดิม
  3. เพิ่มเทสต์กันถอยหลังใน /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-model.test.ts
     โดยยืนยันผลด้วย placementCutSize / calculateBasinCoordinates ไม่ใช่แค่ค่าในออบเจกต์

หมายเหตุสำคัญ (ห้ามพลาด): ฟังก์ชัน setBasinPlacementOrientation เป็นของเก่าที่ระบบไม่ใช้แล้ว
  และมีเทสต์ห้ามเรียกอยู่ (test/studio-smart-positioning-and-picker.test.ts) — ห้ามเรียกกลับมาใช้
  ห้ามแก้ให้มัน "ดูถูก" แล้วอ้างว่านั่นคือการซ่อม (ตัวจริงที่ต้องแก้คือ replaceStudioBasin)

ข้อมูลที่พิสูจน์แล้ว (รันโมดูลจริง):
  - ก่อนแก้: replaceStudioBasin บนอ่างแนวตั้ง KF003 (350x500, rotation 90) -> placementCutSize เปลี่ยนจาก 500x350 เป็น 350x500
  - ก่อนแก้: applyStudioSizePreset(400) บนอ่างที่ xMm=725/offsetXMm=725 -> xMm=100 แต่วาดที่ {xMm:725}
  - มีสาขาอ้างอิงที่แก้และผ่านเทสต์แล้ว (PR #285 · fix/david-studio-2d-verified-bugs) จะใช้เป็นจุดตั้งต้นหรือเขียนใหม่ก็ได้
    แต่ต้องมีเทสต์และหลักฐานของตัวเองครบตามข้อ EVIDENCE

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-model.test.ts

FORBIDDEN:
  - ห้ามแตะไฟล์ UI: src/components/**, src/admin/**, src/index.css (Replit เป็นเจ้าของ)
  - ห้ามแตะไฟล์ฝั่ง api-server (ชัยมีใบงาน 240 อยู่แล้ว ห้ามรวมสองงานใน PR เดียว)
  - ห้ามแก้สูตรราคา/เรตหิน หรือเงื่อนไขการคิดเงินใด ๆ
  - ห้ามเรียก setBasinPlacementOrientation กลับมาใช้ในโค้ดใหม่
  - ห้าม push ตรงเข้า main — ทำงานผ่าน branch แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง fix/chai-studio-model-basin-rotation-and-offsets ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --experimental-strip-types --test test/studio-model.test.ts → ผ่านทั้งหมด (แนบตัวเลข tests/pass/fail)
  4) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts → fail 0 (baseline ปัจจุบัน 413 pass / 0 fail / 2 skip)
  5) เทสต์ใหม่ต้องจับบั๊กได้จริง: ลองย้อนโค้ดกลับไปแบบเดิมแล้วเทสต์ต้องตก (แนบผลว่ารันแล้วตกกี่ข้อ)
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/test/studio-model.test.ts
  - PR เข้า main พร้อมหลักฐาน และอธิบายว่าก่อน/หลังค่าเปลี่ยนอย่างไร

STOP:
  - เมื่อ tsc ผ่าน 0 errors, เทสต์ผ่านทั้งหมด และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 25 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุ 2 บั๊กพร้อมพฤติกรรมที่ถูกต้อง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ (src/data + test) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/index.css/api-server + ห้ามเรียกฟังก์ชันเก่า |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | คำสั่งรันจริง + baseline + พิสูจน์ว่าเทสต์จับบั๊กได้ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์และ PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 25 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | ใช้ /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี ``` ซ้อน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุ 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-studio-model-basin-rotation-and-offsets |
| 11 | ระบุข้อเท็จจริงที่พิสูจน์แล้ว | ผ่าน | แนบค่าก่อนแก้จากการรันจริง |
| 12 | กันการแก้งานซ้ำซ้อน | ผ่าน | สั่งห้ามแตะ api-server (มีใบงาน 240 แยก) |
