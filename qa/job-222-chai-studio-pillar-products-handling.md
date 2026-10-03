# ใบงาน 222 (UX & Catalog) — ปรับสถานะเสาวางของตั้งพื้น KF029/KF030 แยกออกจากอ่างเจาะเคาน์เตอร์ Studio

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) / Replit · ได้รับอนุมัติจากบอสโดยตรงแล้ว
**Branch:** `feat/studio-pillar-products-handling`
**ที่มา:** บอสชี้แจงข้อเท็จจริงของสินค้าว่า KF029 และ KF030 คือ "เสาสี่เหลี่ยมวางของสำเร็จรูปตั้งพื้น (ไม่มีหลุมอ่าง)" ลูกค้าซื้อเป็นชุดสำเร็จ ไม่ได้นำไปเจาะวางบนท็อปเคาน์เตอร์ครัว แต่ปัจจุบันระบบ 2D Studio ยังเสนอให้ลูกค้าเลือกวางลงบนผังเคาน์เตอร์ ทำให้เกิดกล่อง "ขนาดหลุมไม่ระบุ" ชวนสับสน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ในรายการเลือกอ่างวางบนผังเคาน์เตอร์: กรองสินค้าที่ไม่ใช่อ่างเจาะเคาน์เตอร์ (KF029, KF030 หรือสินค้าที่ไม่มีหลุมอ่างและเป็นทรงตั้งพื้น) ออกจากแท็บเลือกอ่างที่จะนำมาวางบนผัง หรือแสดงป้ายกำกับชัดเจนว่าเป็น "ชุดเสาตั้งพื้นสำเร็จรูป (ไม่ต้องเจาะเคาน์เตอร์)" และไม่เปิดให้ลากวางลงบนกระดาน 2D Canvas
     - หากมีการเปิด URL ตรงมาที่ /studio?basin=KF029 หรือ KF030 ให้แสดงข้อความแจ้งเตือนสุภาพว่า "สินค้านี้เป็นชุดเสาสำเร็จรูปตั้งพื้น ไม่ต้องเจาะเคาน์เตอร์ สามารถสั่งซื้อเป็นชุดสำเร็จรูปได้ทันที" พร้อมปุ่มนำทางไปหน้าขอใบเสนอราคา
  2. ใน artifacts/knight-basins/src/data/catalog.ts และ App.tsx:
     - ปรับคำอธิบายหมวดหมู่และป้ายของ KF029 และ KF030 ให้ชัดเจน:
       - แสดงป้าย "เสาวางของตั้งพื้น (ชุดสำเร็จรูป)" แทนคำว่า "ทรงสูง" ธรรมดา
       - ระบุข้อความชัดเจน: "ชุดสำเร็จรูป ไม่ต้องเจาะเคาน์เตอร์"
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-pillar-products.test.ts:
       - ทดสอบว่ารายการอ่างสำหรับเจาะผังใน 2D Studio ไม่มี KF029 และ KF030
       - ทดสอบข้อความและป้ายกำกับของ KF029/030 ในหน้ารายการสินค้าและใบเสนอราคา
       - ทดสอบว่าการสั่งซื้อเป็นชุดสำเร็จรูปผ่านหน้าหลักและหน้าใบเสนอราคายังทำงานได้ปกติ 100%

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/data/catalog.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/studio-pillar-products.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามลบ KF029 และ KF030 ออกจากฐานข้อมูลแคตตาล็อกสินค้าหลัก (ลูกค้ายังต้องสั่งซื้อเป็นชุดสำเร็จรูปได้)
  - ห้ามแตะสูตรราคา 16,000 บาทของทั้งสองรุ่น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/studio-pillar-products-handling ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-pillar-products.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 882 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/data/catalog.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/studio-pillar-products.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แยกเสาวางของ KF029/030 ออกจากผังเจาะเคาน์เตอร์ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบสินค้า, ไม่แตะสูตรราคา, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) หรือ Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ตรงตามลักษณะสินค้าจริงที่บอสชี้แจง |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลสิทธิ์ครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 222 เรียบร้อย |
