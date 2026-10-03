# ใบงาน 212 (Assets & Styling) — ชุดภาพอ่างพื้นหลังโปร่งใส 30 รุ่น & ตกแต่ง CSS ไร้กรอบ

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) / เดวิด · ได้รับอนุมัติผล Pilot Contact Sheet แล้ว
**Branch:** `feat/chai-studio-transparent-basin-assets`
**ที่มา:** ภาพ Top View ของอ่าง 30 รุ่นเดิมเป็น JPG สี่เหลี่ยมพื้นหลังเทา ทำให้เวลานำไปวางบนผังหินสังเคราะห์จะเห็นเป็นกรอบสี่เหลี่ยมทับลายหิน บอสต้องการเปลี่ยนเป็น PNG พื้นหลังโปร่งใส (Alpha Transparency) และปรับแต่ง CSS ให้ภาพอ่างกลืนเข้ากับผังอย่างเป็นธรรมชาติ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. การจัดเตรียมและอัปเดตชุดภาพอ่างโปร่งใส 30 รุ่น (Transparent PNG Assets):
     - ประมวลผลภาพ Top View 30 รุ่น (KF001 - KF030) ให้เป็น PNG พื้นหลังโปร่งใส ตัดกรอบสี่เหลี่ยมสีเทาออก ด้วยอัลกอริทึม Geometric Edge Masking ตามผลทดสอบ Pilot Contact Sheet V2
     - จัดทำ Contact Sheet รวม 30 รุ่น และ manifest.json ตรวจสอบความถูกต้อง
     - อัปเดต URL ภาพ topViewImageUrl ของอ่างทั้ง 30 รุ่นในแคตตาล็อกผ่านระบบจัดการภาพหลังบ้าน
  2. การปรับแต่ง CSS ใน src/index.css (ข้อยกเว้นเฉพาะจุดที่ได้รับอนุมัติ):
     - อนุญาตให้แก้เฉพาะบล็อกคลาส .studio-basin-* และ .studio-placement-visual ใน src/index.css:
       - ปรับ .studio-basin-real-topview-img ให้ใช้ object-fit: contain (แทน cover)
       - นำ border และ background สีทึบของรูปภาพออก เพื่อให้แสดงเฉพาะตัวหลุมอ่างโปร่งใส
       - ใส่ drop-shadow เล็กน้อย (filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25))) เพื่อสร้างมิติหลุมอ่างบนหน้าท็อปเคาน์เตอร์หิน
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-transparent-basins.test.ts:
       - ทดสอบว่าภาพ Top View ทั้ง 30 รุ่นเป็นไฟล์ PNG หรือ WebP ที่มี Alpha Channel
       - ทดสอบกฎ CSS เฉพาะจุดใน index.css มีการใช้ object-fit: contain และ drop-shadow ถูกต้อง
       - ยืนยันว่าไม่มี CSS รั่วไหลกระทบส่วนอื่นนอกเหนือจากคลาส .studio-basin-*

SCOPE:
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/studio-transparent-basins.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้อง CSS ส่วนอื่นใน src/index.css นอกเหนือจากคลาส .studio-basin-* และ .studio-placement-visual (Scoped Exemption)
  - ห้ามลบหรือแก้ไขภาพถ่ายสินค้าต้นฉบับในคลัง (ไฟล์โปร่งใสสร้างเป็นไฟล์ใหม่คู่ขนาน)
  - ห้ามแตะ StudioPage.tsx หรือไฟล์ที่กำลังพัฒนาใน Job 216 และ Job 217

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-studio-transparent-basin-assets ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-transparent-basins.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 856 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css แสดงเฉพาะการแก้ในบล็อก .studio-basin-* เท่านั้น

OUTPUT:
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/studio-transparent-basins.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ภาพโปร่งใส 30 รุ่น + ตกแต่ง CSS ไร้กรอบ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | แก้เฉพาะคลาส .studio-basin-*, ไม่แตะส่วนอื่น |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | ได้รับ Scoped Exemption เฉพาะบล็อกอ่าง |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) / เดวิด |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ไดคัท 30 รุ่น + ตัดขอบสี่เหลี่ยมเทาออก |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้ภาพสินค้าลิขสิทธิ์ของ Knight Furnich |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 212 เรียบร้อย |
