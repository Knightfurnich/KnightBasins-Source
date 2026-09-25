# ใบงาน 61 (ชัย) — ระบบคัดกรองและสลับซ่อน/แสดงภาพผลงานในคลังแอดมิน (/admin/portfolio)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ในคลังภาพผลงาน 671 ภาพ มีภาพระหว่างก่อสร้าง (WIP) ที่ไม่ควรเผยแพร่ออกสู่สาธารณะ เจ้าของระบบ (คุณนพ) ต้องการให้แอดมินมีปุ่มกดสลับ `[ 🟢 แสดงบนเว็บ ]` / `[ ⚪ ซ่อนไว้เฉพาะภายใน ]` บนการ์ดแต่ละภาพในหน้า `/admin/portfolio` และให้หน้าสาธารณะ `/portfolio` แสดงเฉพาะภาพที่ได้รับอนุมัติให้แสดงเท่านั้น เพื่อปกป้องภาพลักษณ์ของแบรนด์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. ใน api-server (`artifacts/api-server/src/routes/portfolio.ts`):
     - เพิ่ม endpoint `PATCH /api/admin/portfolio/:id/visibility` (requireAnyAdminPermission(["leads", "basins"])):
       รับ body: `{ visible: boolean }`
       บันทึกการตั้งค่าการแสดงผลของภาพนั้นลงในไฟล์ `/docker/knightbasins/uploads/portfolio/visibility.json` (หรือแคชระบบ)
     - ปรับ `GET /api/portfolio` (สำหรับบุคคลทั่วไป):
       กรองแสดงเฉพาะภาพที่ `visible !== false` (ภาพที่ถูกซ่อนจะไม่ถูกส่งออกทาง API สาธารณะ)
     - เพิ่ม query `?includeHidden=true` สำหรับแอดมิน ให้ดึงดูได้ครบทุกภาพ
  2. ในหน้าแอดมิน (`artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx`):
     - บนการ์ดแต่ละภาพและใน Lightbox เพิ่มปุ่มสลับสถานะ:
       * ถ้าแสดงอยู่: ปุ่มสีเขียว `[ 🟢 เผยแพร่บนเว็บ ]` (คลิกเพื่อซ่อน)
       * ถ้าซ่อนอยู่: ปุ่มสีเทา `[ ⚪ ซ่อนเฉพาะภายใน ]` (คลิกเพื่อเปิดเผยแพร่)
     - เมื่อคลิก สั่ง PATCH ไปยัง `/api/admin/portfolio/:id/visibility` และอัปเดตสถานะทันที
     - เพิ่มตัวกรองด้านบน: `[ ทั้งหมด ]` · `[ 🟢 เผยแพร่แล้ว ]` · `[ ⚪ ซ่อนอยู่ ]`
  3. เขียน Unit tests ใน `admin-portfolio-curation.test.ts` ครอบคลุม:
     - ฟังก์ชันกรองภาพตามสถานะ visibility
     - การสลับสถานะ toggleVisibility

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-portfolio-curation.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-portfolio-curation แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 261 / pass 255 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน admin-portfolio-curation.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-portfolio-curation (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. การเก็บสถานะ visibility:
     - เก็บเป็น Set หรือ Map ของ image id ที่ถูกซ่อน เช่น `{ "hiddenIds": ["bathroom_001", ...] }`
     - ถ้าภาพไม่อยู่ใน `hiddenIds` ถือเป็น `visible: true` โดยปริยาย (Default = true)
     - หรือถ้ามี `visibility.json` ให้อ่านและเขียนทับอย่างปลอดภัย
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบสลับซ่อน/แสดงภาพผลงานในคลังแอดมิน |
| 2 | GOAL วัดได้ | ✅ PATCH endpoint + ปุ่ม toggle + filter + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 261/255/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-portfolio-curation |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 261 / pass 255 / fail 2 |
| 9 | CONTRACT ระบุ endpoint และ format ชัด | ✅ PATCH visibility + hiddenIds ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
