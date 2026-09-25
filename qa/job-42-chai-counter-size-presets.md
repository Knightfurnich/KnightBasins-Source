# ใบงาน 42 (ชัย) — Preset ขนาดเคาน์เตอร์สำเร็จรูป 4 ขนาดพร้อมฟังก์ชันจัดอ่างอัตโนมัติ

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของต้องการให้ 2D Studio ใช้งานง่ายขึ้น โดยมีขนาดเคาน์เตอร์สำเร็จรูปยอดนิยม 4 ขนาด (1.20 ม., 1.50 ม., 1.80 ม., 2.00 ม.) ให้ลูกค้าคลิกเลือกขนาดได้ทันที โดยไม่ต้องพิมพ์ตัวเลขเอง และระบบจะจัดวางอ่างที่มีอยู่ให้กลับมาอยู่กึ่งกลางขนาดใหม่โดยอัตโนมัติ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างชุดค่าคงที่ Preset ขนาดเคาน์เตอร์ และฟังก์ชันคำนวณปรับขนาด:
  1. ใน studio-model.ts:
     - ประกาศค่าคงที่ `STUDIO_COUNTER_PRESETS`:
       - `{ id: "1200", label: "1.20 ม. (เดี่ยวมาตรฐาน)", widthMm: 1200, depthMm: 600 }`
       - `{ id: "1500", label: "1.50 ม. (มีที่วางของ)", widthMm: 1500, depthMm: 600 }`
       - `{ id: "1800", label: "1.80 ม. (ยาวพิเศษ)", widthMm: 1800, depthMm: 600 }`
       - `{ id: "2000", label: "2.00 ม. (เคาน์เตอร์ใหญ่)", widthMm: 2000, depthMm: 600 }`
     - เพิ่มฟังก์ชัน `applyStudioSizePreset(state: StudioState, widthMm: number, depthMm?: number): StudioState`:
       - ปรับ dimensions.runAMm และความกว้างของสี่เหลี่ยมแผ่นหลัก (แผ่นแรก)
       - ปรับตำแหน่ง X ของอ่างล้างหน้าทุกใบที่วางอยู่บนแผ่นหลักให้อยู่กึ่งกลางขนาดใหม่ (หรือรักษาระยะปลอดภัย ≥ 100 มม. เสมอ)
  2. เพิ่ม Unit tests ใน studio-model.test.ts ครอบคลุมการปรับขนาดและตรวจสอบระยะปลอดภัย

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-model.test.ts

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (เป็นของ Replit)
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-counter-size-presets แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 196 / pass 191 / fail 2 / cancelled 3 (fail เฉพาะ 2 ตัวใน *.browser.test.ts)
     ชุดที่ไม่ใช่ browser ต้องผ่าน 191/191 ครบ 100%
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) เทสต์ใหม่ใน studio-model.test.ts ยืนยัน:
     - applyStudioSizePreset(state, 1200, 600) ปรับขนาดเป็น 1200×600 มม. ถูกต้อง
     - อ่างถูกจัดตำแหน่งกึ่งกลางใหม่ และระยะร่นจากขอบ ≥ 100 มม. เสมอ

OUTPUT:
  - branch: feat/chai-counter-size-presets (เปิด PR เข้า main รอตรวจ)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ non-browser ตกแม้แต่ตัวเดียว (ต้องผ่าน 100%)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน studio-model.ts:
     ```ts
     export interface StudioCounterPreset {
       id: string;
       label: string;
       widthMm: number;
       depthMm: number;
     }

     export const STUDIO_COUNTER_PRESETS: ReadonlyArray<StudioCounterPreset> = [
       { id: "1200", label: "1.20 ม.", widthMm: 1200, depthMm: 600 },
       { id: "1500", label: "1.50 ม.", widthMm: 1500, depthMm: 600 },
       { id: "1800", label: "1.80 ม.", widthMm: 1800, depthMm: 600 },
       { id: "2000", label: "2.00 ม.", widthMm: 2000, depthMm: 600 },
     ];

     export function applyStudioSizePreset(
       state: StudioState,
       widthMm: number,
       depthMm: number = 600
     ): StudioState
     ```
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ Preset ขนาดเคาน์เตอร์ 4 ขนาด + ฟังก์ชันปรับขนาด |
| 2 | GOAL วัดได้ | ✅ ค่าคงที่ 4 ขนาด + applyStudioSizePreset จัดกึ่งกลาง |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 196/191/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-counter-size-presets |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 196 / pass 191 / fail 2 |
| 9 | CONTRACT ระบุ interface และ presets ชัดเจน | ✅ ระบุ 4 ขนาด 1200/1500/1800/2000 มม. |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
