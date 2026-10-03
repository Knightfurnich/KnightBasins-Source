# ใบงาน 211 (Studio UX) — พื้นผิวหินจริงบนผัง 2D Studio (Real Stone Texture Canvas)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ต่อเนื่องจาก Job 210 (ทำได้ทันที)
**Branch:** `feat/chai-studio-real-stone-texture`
**ที่มา:** ปัจจุบันผังเคาน์เตอร์ 2D แสดงเฉพาะเฉดสีเรียบ (Tone) ทำให้สีหินค่อนไปทางขาวกว่า 29 สีดูคล้ายกันมาก บอสต้องการให้นำภาพลายหินจริง (slabImageUrl) มาเป็นพื้นผิวบนผังเพื่อให้ลูกค้าเห็นลวดลายจริงก่อนสั่งผลิต

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ดึงภาพลายหินจริงจาก slabImageUrl (ขนาดเบา ~42KB ต่อสี) ของสีหลักที่กำลังใช้งาน (Active Stone) มาแสดงเป็น background-image บนชิ้นงานเคาน์เตอร์ (StudioFootprint / StudioPiece)
     - โหลดภาพแบบ Lazy Load เฉพาะสีหลักที่เลือกใช้งาน 1 รูป ไม่โหลดพร้อมกันทั้งแคตตาล็อก
     - เพิ่มป้ายกำกับโปร่งใสที่มุมล่างของกระดาน Canvas: "ลายหินตัวอย่างเพื่อการแสดงผล · หน้างานจริงขึ้นกับลายแร่ธรรมชาติ"
     - โหมดพิมพ์ (Print Layout): ยังคงใช้เฉดสีแบนราบ (Flat Tone) เหมือนเดิมตามคำสั่งบอส เพื่อไม่ให้เปลืองหมึกและลายหินกลายเป็นปื้นดำทับเส้นบอกขนาด
  2. การตกแต่งและข้อยกเว้น CSS:
     - ใช้ inline style (style={{ backgroundImage: ... }}) เป็นหลักเพื่อรักษา src/index.css ให้ได้ 0 diff
     - หากจำเป็นต้องแตะคลาส .studio-piece-rectangle หรือ .studio-footprint อนุญาตเป็นข้อยกเว้นเฉพาะจุด (Scoped Exemption) โดยไม่กระทบเลย์เอาต์ส่วนอื่น
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-real-stone-texture.test.ts:
       - ทดสอบว่าชิ้นงานบน Canvas มี background-image ชี้ไปยัง slabImageUrl ของ active stone
       - ทดสอบว่ามุมมองพิมพ์ StudioPrintLayout ไม่ใช้ background-image ลายหิน
       - ทดสอบการแสดงป้ายข้อความกำกับลายหินตัวอย่าง

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-real-stone-texture.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css นอกเหนือจากข้อยกเว้นเฉพาะจุด (แนะนำใช้ inline style 0 diff)
  - ห้ามโหลดภาพ quoteImageUrl ที่มีขนาดใหญ่ (~1-2MB) ให้ใช้ slabImageUrl (~42KB) เท่านั้น
  - ห้ามกระทบสูตรคำนวณราคา หรือการส่งออกไฟล์ DXF/PDF
  - ห้ามแตะไฟล์ที่กำลังทำอยู่ใน Job 216 หรือ Job 217

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-studio-real-stone-texture ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-real-stone-texture.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 856 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-real-stone-texture.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ลายหินจริงบนผัง + โหมดพิมพ์คงโทนแบน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ใช้ slabImageUrl เบา 42KB, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | แสดงลายหินเฉพาะสีหลัก + โหมดพิมพ์ไม่ใช้ลายหิน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้รูปสาธารณะจาก CDN |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 211 เรียบร้อย |
