# ใบงาน 58 (ชัย) — หน้าคู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์ (/site-prep)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ทีมขายและผู้รับเหมาหน้างานเจอปัญหา "หน้างานไม่พร้อม" บ่อยครั้ง (โครงสร้างไม่รับน้ำหนัก ตำแหน่งท่อน้ำผิด ระยะไม่พอ) ทำให้ช่างไปถึงแล้วติดตั้งไม่ได้ ต้องเสียเที่ยว เดวิดต้องการหน้าคู่มือเตรียมหน้างานที่ทีมขายส่งลิงก์ให้ลูกค้า/ผู้รับเหมา/ช่างโครงการเปิดดูในมือถือได้ทันที โดยใช้ภาพถ่ายจริงจากงานติดตั้ง 59 ภาพ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างหน้าคู่มือเตรียมหน้างาน (/site-prep) ประกอบด้วย:
  1. Hero section: หัวข้อ "คู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์" + คำโปรยว่า
     "ส่งลิงก์นี้ให้ผู้รับเหมาหรือช่างโครงการเปิดดูได้เลย ก่อนวันเข้าติดตั้งจริง"
  2. Checklist 5 ข้อใหญ่ (การ์ดกดขยายได้) พร้อมไอคอน:
     - 💧 ระบบน้ำดี-น้ำเสีย: ตำแหน่งท่อต้องได้ระดับกึ่งกลางอ่างและระยะท่อระบายน้ำ
     - 🧱 โครงสร้างรับน้ำหนัก: โครงเหล็กหรือตู้ต้องรับน้ำหนักท็อปหินได้ ไม่แอ่น ไม่ยวบ
     - 📏 ระยะเผื่อขอบและผนัง: เผื่อระยะขอบและฉากผนังตามที่ตกลง
     - ⚡ ระบบไฟฟ้าและปลั๊ก: ตำแหน่งปลั๊กและสวิตช์ต้องพ้นแนวน้ำและไม่ถูกท็อปหินปิดทับ
     - 🚚 ทางเข้าหน้างานและลิฟต์: ทางเดินและลิฟต์ต้องมีขนาดกว้างพอให้ยกแผ่นหินยาวเข้าได้
  3. แกลเลอรี "ภาพตัวอย่างหน้างานจริง":
     - ดึงจาก API: `GET /api/portfolio?category=site_prep&limit=60`
     - แสดงรูปใน grid และคลิกเปิดดูภาพใหญ่ (Lightbox) ได้
  4. ปุ่มคัดลอกลิงก์หน้าคู่มือ: `[ 🔗 คัดลอกลิงก์ส่งให้ช่าง ]` (คัดลอก URL ของหน้า /site-prep)
  5. ปุ่มแชร์ผ่าน LINE: `[ 💬 ส่งใน LINE ]` เปิด LINE share (https://line.me/R/msg/text/?...)
  6. เพิ่ม route `/site-prep` ใน App.tsx
  7. เขียน Unit tests ใน `site-prep-page.test.ts` ครอบคลุม: การแสดงผล Checklist 5 ข้อ, ฟังก์ชันสร้างลิงก์แชร์ LINE, และการ render รูปภาพ

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/SitePrepPage.tsx (ใหม่)
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx (เพิ่ม route /site-prep เท่านั้น — ห้ามแก้อย่างอื่น)
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/test/site-prep-page.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแก้ไฟล์อื่นใน App.tsx นอกจากการเพิ่ม route /site-prep
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-site-prep-guide แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 252 / pass 247 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน site-prep-page.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-site-prep-guide (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. API ที่ใช้ (มีอยู่จริงบน production แล้ว ทดสอบแล้ว HTTP 200):
     ```json
     GET /api/portfolio?category=site_prep&limit=60
     {
       "updatedAt": "2026-09-25T13:00:00Z",
       "total": 360,
       "categories": [{ "slug": "site_prep", "name": "การเตรียมหน้างานและการติดตั้ง", "icon": "📐", "count": 59 }],
       "count": 59,
       "items": [
         { "id": "site_prep_001", "category": "site_prep", "categoryName": "การเตรียมหน้างานและการติดตั้ง",
           "icon": "📐", "url": "/api/uploads/portfolio/site_prep/site_prep_001_12489_0.webp",
           "width": 1600, "height": 1200, "title": "การเตรียมหน้างานและการติดตั้ง Knight Furnich" }
       ]
     }
     ```
  2. การสร้างลิงก์แชร์ LINE:
     `export function buildLineShareUrl(pageUrl: string, title: string): string`
     คืนค่า `https://line.me/R/msg/text/?` + encodeURIComponent(title + "\n" + pageUrl)
  3. ห้ามแสดงชื่อลูกค้า/รหัสงาน — API ส่งมาเฉพาะ URL รูป + ชื่อหมวดหมู่เท่านั้น
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ หน้าคู่มือเตรียมหน้างาน |
| 2 | GOAL วัดได้ | ✅ Checklist 5 ข้อ + แกลเลอรี + ปุ่มแชร์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 252/247/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-site-prep-guide |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 252 / pass 247 / fail 2 |
| 9 | CONTRACT ระบุ API response จริง | ✅ JSON จาก API จริง + buildLineShareUrl |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
