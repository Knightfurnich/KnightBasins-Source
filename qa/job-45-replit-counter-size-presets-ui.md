# ใบงาน 45 (Replit) — ปุ่มเลือก Preset ขนาดเคาน์เตอร์สำเร็จรูป 4 ขนาดใน 2D Studio

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ชัยได้เตรียมค่าคงที่ `STUDIO_COUNTER_PRESETS` (4 ขนาด: 1.20 ม., 1.50 ม., 1.80 ม., 2.00 ม.) และฟังก์ชัน `applyStudioSizePreset` ไว้ใน `src/data/studio-model.ts` เรียบร้อยแล้ว ใบงานนี้คือให้ Replit นำมาต่อเชื่อมเป็นปุ่มกดเลือกขนาดด่วนบนหน้าจอ 2D Studio เพื่อให้ลูกค้าและทีมงานกดเลือกขนาดเคาน์เตอร์ได้ในคลิกเดียว

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มแถบปุ่มเลือกขนาดเคาน์เตอร์ด่วน 4 ขนาดใน 2D Studio:
  1. นำเข้า `STUDIO_COUNTER_PRESETS, applyStudioSizePreset` จาก `@/data/studio-model` ใน `StudioPage.tsx`
  2. แสดงแถบปุ่มเลือกขนาด `.studio-size-presets` ในหน้า Studio (มองเห็นได้ทั้งโหมดง่ายและโหมดปกติ):
     - ปุ่ม 4 ขนาด: `1.20 ม.` · `1.50 ม.` · `1.80 ม.` · `2.00 ม.`
     - ไฮไลต์ปุ่ม (active) ตามความกว้างปัจจุบันของแผ่นหลัก
  3. เมื่อคลิกปุ่มขนาดใด ให้เรียก `setState(current => applyStudioSizePreset(current, preset.widthMm, preset.depthMm))` เพื่อปรับขนาดผังและจัดตำแหน่งอ่างอัตโนมัติ

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแก้ไฟล์ studio-model.ts (ชัยทำเสร็จและ merge เข้า main แล้ว)
  - ห้ามแตะ index.html, App.tsx, WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-counter-size-presets-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 201 / pass 196 / fail 2 / cancelled 3 (non-browser tests 196/196 ผ่านครบ)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้า Studio แสดงปุ่ม 4 ขนาดเคาน์เตอร์ชัดเจน
     - ภาพหลังคลิกเลือกขนาด 1.20 ม. ผังปรับขนาดสั้นลงและอ่างอยู่กึ่งกลาง

OUTPUT:
  - branch: feat/replit-counter-size-presets-ui (เปิด PR เข้า main)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline (fail > 2)
  - ถ้าต้องแตะไฟล์นอก SCOPE

CONTRACT:
  1. ใน StudioPage.tsx:
     - Import:
       `import { STUDIO_COUNTER_PRESETS, applyStudioSizePreset } from "@/data/studio-model";`
     - แสดงแถบปุ่ม:
       ```tsx
       <div className="studio-size-presets" role="group" aria-label="เลือกขนาดเคาน์เตอร์สำเร็จรูป">
         <span className="studio-size-presets-label">ขนาดมาตรฐาน:</span>
         {STUDIO_COUNTER_PRESETS.map((p) => {
           const isActive = currentWidthMm === p.widthMm;
           return (
             <button
               type="button"
               key={p.id}
               className={`button button--outline studio-size-button ${isActive ? "is-active" : ""}`}
               onClick={() => setState((current) => applyStudioSizePreset(current, p.widthMm, p.depthMm))}
               aria-pressed={isActive}
               data-testid={`button-studio-size-preset-${p.id}`}
             >
               {p.label}
             </button>
           );
         })}
       </div>
       ```
     - ตำแหน่งที่วาง: วางไว้ใกล้กับส่วนเลือกรูปทรง (Shape Wizard) หรือเหนือผังผ้าใบ Canvas
  2. ใน index.css:
     - จัดสไตล์ `.studio-size-presets` ให้เรียบร้อย สวยงาม คุมโทน สะอาดตา
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปุ่มเลือกขนาดเคาน์เตอร์ด่วน 4 ขนาด |
| 2 | GOAL วัดได้ | ✅ 4 ปุ่มคลิกได้ + เรียก applyStudioSizePreset สำเร็จ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative path สำหรับ Replit |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแก้ studio-model.ts, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 201/196/2 + ภาพ 2 รูป |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-counter-size-presets-ui |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ 201 / pass 196 / fail 2 |
| 9 | CONTRACT ระบุโค้ดและ data-testid จริง | ✅ ระบุ button-studio-size-preset- และ import ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
