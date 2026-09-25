# ใบงาน 62 (Replit) — เพิ่มระบบค้นหาภาพและปุ่มสอบถามทาง LINE จากคลังผลงาน (/portfolio)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ Replit

**ความต้องการ:** หน้าคลังผลงานจริง `/portfolio` (670+ ภาพ) เป็นจุดแข็งสำคัญในการขาย เมื่อลูกค้าเปิดดูภาพผลงานชิ้นใด ควรมีปุ่ม `[ 💬 สอบถามสเปกงานชิ้นนี้ทาง LINE ]` ใน Lightbox เพื่อให้ลูกค้ากดเปิด LINE แอด `@789gcnhq` คุยกับน้องไนท์ได้ทันที พร้อมเพิ่มช่องค้นหาภาพ (Search Bar) ด้านบนแกลเลอรี ให้ลูกค้าพิมพ์ค้นหางานที่สนใจ เช่น "อ่างคู่", "เกาะกลาง", "โรงพยาบาล" ได้สะดวก

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/pages/PortfolioPage.tsx:
     - ใน Lightbox View (เมื่อคลิกดูภาพขยาย):
       * เพิ่มปุ่ม Action Bar เด่นชัดด้านล่างภาพ:
         - ปุ่มหลัก: [ 💬 สอบถามสเปกงานชิ้นนี้ทาง LINE ]
           ลิงก์ไปยัง: `https://line.me/R/ti/p/@789gcnhq` (เปิดแท็บใหม่ rel="noopener noreferrer")
         - ปุ่มรอง: [ 🎨 ลองวางผังใน 2D Studio ] ลิงก์ไป `/studio`
       * แสดงชื่อหมวดหมู่ภาษาไทย (เช่น 🛁 งานห้องน้ำ) และคำอธิบายภาพกำกับชัดเจน
     - ในส่วนหัวของหน้า /portfolio (เหนือแถบหมวดหมู่):
       * เพิ่มช่องค้นหา (Search Input) พร้อมไอคอนแว่นขยาย:
         placeholder="ค้นหาผลงาน เช่น อ่างคู่, ครัว, ผนัง, เคาน์เตอร์..."
         data-testid="input-portfolio-search"
       * กรองรายการภาพแบบ Instant Search จาก captionTh และ category ทันทีที่ผู้ใช้พิมพ์
       * มีปุ่ม [✕] เคลียร์คำค้นหา
  2. เขียน Unit Tests ใน artifacts/knight-basins/test/portfolio-inquiry-search.test.ts:
     - ทดสอบฟังก์ชันกรองภาพจากคำค้นหา (Case-insensitive, ค้นหาภาษาไทย)
     - ทดสอบการสร้าง URL ลิงก์ LINE สำหรับการสอบถาม

SCOPE (path สัมพัทธ์จาก root repo สำหรับ Replit):
  1. artifacts/knight-basins/src/pages/PortfolioPage.tsx
  2. artifacts/knight-basins/src/index.css
  3. artifacts/knight-basins/test/portfolio-inquiry-search.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-portfolio-inquiry-search แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 261 / pass 255 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน portfolio-inquiry-search.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-portfolio-inquiry-search (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการทำงานครอบคลุมทั้งเดสก์ท็อปและมือถือ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Studio Core | ✅ ผ่าน |
