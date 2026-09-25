# ใบงาน 58 (Replit) — หน้าคู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์ (/site-prep)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ทีมขายและผู้รับเหมาหน้างานเจอปัญหา "หน้างานไม่พร้อม" บ่อยครั้ง (โครงสร้างไม่รับน้ำหนัก ตำแหน่งท่อน้ำผิด ระยะไม่พอ) ทำให้ช่างไปถึงแล้วติดตั้งไม่ได้ ต้องเสียเที่ยว เดวิดต้องการหน้าคู่มือเตรียมหน้างานที่ทีมขายส่งลิงก์ให้ลูกค้า/ผู้รับเหมา/ช่างโครงการเปิดดูในมือถือได้ทันที โดยใช้ภาพถ่ายจริงจากงานติดตั้ง 59 ภาพ

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างหน้าคู่มือเตรียมหน้างาน (/site-prep) ประกอบด้วย:
  1. Hero section: หัวข้อ "คู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์" + คำโปรยว่า
     "ส่งลิงก์นี้ให้ผู้รับเหมาหรือช่างโครงการเปิดดูได้เลย ก่อนวันติดตั้ง"
  2. Checklist 5 ข้อใหญ่ (การ์ดกดขยายได้) พร้อมไอคอน:
     - 💧 ระบบน้ำดี-น้ำเสีย: ตำแหน่งท่อต้องถูกต้องตามระยะที่ตกลง
     - 🧱 โครงสร้างรับน้ำหนัก: ต้องรับน้ำหนักท็อปหินได้ ไม่แอ่น ไม่ยวบ
     - 📏 ระยะเผื่อขอบและผนัง: เผื่อช่องว่างตามที่กำหนด
     - ⚡ ระบบไฟฟ้าและปลั๊ก: ตำแหน่งปลั๊กต้องไม่ถูกท็อปหินปิดทับ
     - 🚚 ทางเข้าหน้างานและลิฟต์: ต้องส่งแผ่นหินขนาดใหญ่ขึ้นได้
  3. แกลเลอรี "ภาพตัวอย่างหน้างานที่พร้อมติดตั้ง" ดึงจาก API ที่มีอยู่แล้ว:
     `GET /api/portfolio?category=site_prep&limit=60`
     แสดงรูปใน grid + Lightbox (คลิกขยายได้)
  4. ปุ่มคัดลอกลิงก์หน้าคู่มือ: `[ 🔗 คัดลอกลิงก์ส่งให้ช่าง ]` (คัดลอก URL ของหน้า /site-prep)
  5. ปุ่มแชร์ผ่าน LINE: `[ 💬 ส่งใน LINE ]` เปิด LINE share

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/pages/SitePrepPage.tsx (ใหม่)
  2. artifacts/knight-basins/src/App.tsx (เพิ่ม route /site-prep เท่านั้น — ห้ามแก้อย่างอื่น)
  3. artifacts/knight-basins/test/site-prep-page.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแก้ไฟล์อื่นใน App.tsx นอกจากการเพิ่ม route /site-prep
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-site-prep-guide แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 248 / pass 243 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้าคู่มือเตรียมหน้างาน (/site-prep) แสดง Checklist 5 ข้อ
     - แกลเลอรีภาพตัวอย่างหน้างานพร้อม Lightbox ที่เปิดอยู่

OUTPUT:
  - branch: feat/replit-site-prep-guide (เปิด PR เข้า main)
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
  2. ห้ามแสดงชื่อลูกค้า/รหัสงาน — API ส่งมาเฉพาะ URL รูป + ชื่อหมวดหมู่เท่านั้น
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ หน้าคู่มือเตรียมหน้างาน |
| 2 | GOAL วัดได้ | ✅ Checklist 5 ข้อ + แกลเลอรี + ปุ่มแชร์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 248/243/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-site-prep-guide |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 248 / pass 243 / fail 2 |
| 9 | CONTRACT ระบุ API response จริง | ✅ JSON ตัวอย่างจาก API จริงบน production |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
