# ใบงาน 230 (Studio Model Bugfix) — แก้บั๊กการตรวจสอบราคาขอบเปิด openEdgePriceInvalid ใน studio-model.ts

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · บั๊กฟิกซ์ 1 บรรทัดกระทบทั้งเว็บและ API
**Branch:** `fix/chai-studio-openedge-price-check`
**ที่มา:** ชัยตรวจพบบั๊กเดิมใน `artifacts/knight-basins/src/data/studio-model.ts:1892`:
`Math.round(openEdgePrice * 100) !== openEdgePrice` ซึ่งลืมหาร 100 กลับ ทำให้ราคาขอบเปิดที่เป็นตัวเลขใดๆ ก็ตามที่ไม่ใช่ 0 (เช่น 150 บาท) ถูกตีความว่า "openEdgePriceInvalid" (ราคาผิด) เสมอ ส่งผลให้ใบเสนอราคาที่มีการระบุราคาขอบเปิดมี warning ติดมาตลอด และไม่สามารถบันทึกหรือออกใบเสนอราคาที่มีราคาขอบเปิดได้ตั้งแต่ Studio v2

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/data/studio-model.ts บรรทัด 1892:
     - แก้ไขเงื่อนไขตรวจสอบ openEdgePriceInvalid:
       เดิม: Math.round(openEdgePrice * 100) !== openEdgePrice
       ใหม่: Math.round(openEdgePrice * 100) / 100 !== openEdgePrice
       (เพื่อตรวจสอบว่าราคาขอบเปิดต่อเมตรมีทศนิยมไม่เกิน 2 ตำแหน่งอย่างถูกต้อง)
  2. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-openedge-price-validation.test.ts:
       - ทดสอบราคาขอบเปิดเป็นจำนวนเต็ม เช่น 150 -> openEdgePriceInvalid ต้องเป็น false
       - ทดสอบราคาขอบเปิดมีทศนิยม 2 ตำแหน่ง เช่น 150.50 -> openEdgePriceInvalid ต้องเป็น false
       - ทดสอบราคาขอบเปิดมีทศนิยม 3 ตำแหน่ง เช่น 150.555 -> openEdgePriceInvalid ต้องเป็น true
       - ทดสอบราคาขอบเปิดติดลบ เช่น -10 -> openEdgePriceInvalid ต้องเป็น true

SCOPE:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/test/studio-openedge-price-validation.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องฟังก์ชันหรือตัวแปรอื่นๆ ใน studio-model.ts

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง fix/chai-studio-openedge-price-check ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-openedge-price-validation.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 939 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/data/studio-model.ts
  - artifacts/knight-basins/test/studio-openedge-price-validation.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 15 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แก้ไขเงื่อนไขหาร 100 ใน openEdgePriceInvalid |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 15 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | แก้บั๊กราคาขอบเปิดตามที่ชัยรายงาน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 230 เรียบร้อย |
