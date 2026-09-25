# ใบงาน 59 (ชัย) — คลังภาพผลงานสำหรับทีมขายในหน้าจอแอดมิน (/admin/portfolio) พร้อมปุ่มคัดลอกส่งลูกค้า

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ทีมขายต้องการเครื่องมือตอบลูกค้าใน LINE ได้ทันที เมื่อลูกค้าถามว่า "ขอดูตัวอย่างงานเคาน์เตอร์ห้องน้ำ / ไอส์แลนด์ครัว / เคาน์เตอร์คลินิก" ทีมขายต้องค้นหาและคัดลอกลิงก์รูปส่งให้ลูกค้าใน 1 วินาที โดยไม่ต้องเปิดหาในมือถือตัวเอง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างหน้าคลังภาพผลงานสำหรับทีมขายในแอดมิน (/admin/portfolio):
  1. เพิ่มเมนู "คลังภาพผลงานขาย" (permission: leads, icon: Images/Image) + route /admin/portfolio ใน AdminApp.tsx
  2. สร้างหน้าจอ PortfolioGalleryPage.tsx:
     - แถบค้นหาด่วน: พิมพ์คำค้น เช่น "ครัว", "ไอส์แลนด์", "เคาน์เตอร์", "คลินิก", "บันได" หรือชื่อหมวดหมู่
     - แท็บหมวดหมู่: แสดงทุก category ที่ API ส่งมา (ดึงจาก `categories` array) + แท็บ "ทั้งหมด"
     - Grid รูปภาพ: แสดง thumbnail ทุกภาพของหมวดที่เลือก (ดึงจาก API `GET /api/portfolio?limit=200` หรือ `?category=<slug>&limit=200`)
     - คลิกที่รูปใดก็ได้ -> เปิด Lightbox ดูภาพเต็มความละเอียด
     - ใน Lightbox มี 2 ปุ่มสำคัญ:
       * `[ 📋 คัดลอกลิงก์รูป ]` — คัดลอก URL รูปเต็ม (absolute URL เช่น https://knightbasins.srv1964473.hstgr.cloud/api/uploads/portfolio/...)
       * `[ 💬 คัดลอกข้อความส่งลูกค้า ]` — คัดลอกข้อความพร้อมรูป โดยใช้รูปแบบ:
         "ภาพตัวอย่างผลงาน{ชื่อหมวดหมู่}จริงจากโรงงาน Knight Furnich ครับ\n{absolute URL รูป}"
     - แสดง toast/ข้อความยืนยัน "คัดลอกแล้ว ✓" เป็นเวลา 2 วินาที หลังกดปุ่มทั้งสอง
  3. เขียน Unit tests ใน `admin-portfolio-gallery.test.ts` ครอบคลุม: ฟังก์ชันสร้าง absolute URL, ฟังก์ชันสร้างข้อความส่งลูกค้า, และการกรองตามคำค้น

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/PortfolioGalleryPage.tsx (ใหม่)
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-portfolio-gallery.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ SitePhotosPage.tsx (หน้าภาพหน้างานเดิม — คนละหน้าจอ)
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-admin-portfolio-gallery แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 242 / pass 237 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน admin-portfolio-gallery.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-admin-portfolio-gallery (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. API ที่ใช้ (มีอยู่จริงบน production และ local dev แล้ว ทดสอบแล้ว HTTP 200):
     - `GET /api/portfolio?limit=200` -> คืนทุกหมวดหมู่
     - `GET /api/portfolio?category=kitchen&limit=200` -> เฉพาะหมวดงานครัว
     ```json
     {
       "updatedAt": "2026-09-25T13:00:00Z",
       "total": 360,
       "categories": [
         { "slug": "bathroom", "name": "งานห้องน้ำ", "icon": "🛁", "count": 5 },
         { "slug": "counter", "name": "เคาน์เตอร์ต้อนรับ/ธุรกิจ", "icon": "🏢", "count": 64 },
         { "slug": "kitchen", "name": "งานครัวและไอส์แลนด์", "icon": "🍳", "count": 38 }
       ],
       "count": 360,
       "items": [
         { "id": "bathroom_001", "category": "bathroom", "categoryName": "งานห้องน้ำ", "icon": "🛁",
           "url": "/api/uploads/portfolio/bathroom/bathroom_001_FB_IMG_1775031708681.webp",
           "width": 1600, "height": 1200, "title": "งานห้องน้ำ Knight Furnich" }
       ]
     }
     ```
  2. การสร้าง absolute URL ให้ใช้ origin ของหน้าปัจจุบัน (window.location.origin) นำหน้า path ที่ API ส่งมา:
     - `url` จาก API เป็น relative เช่น `/api/uploads/portfolio/...`
     - ต้องแปลงเป็น absolute ก่อนคัดลอก เช่น `https://knightbasins.srv1964473.hstgr.cloud/api/uploads/portfolio/...`
     - ให้เขียนเป็นฟังก์ชัน pure export แยก เช่น `export function toAbsolutePhotoUrl(relativeUrl: string, origin: string): string`
  3. ห้ามแสดงชื่อลูกค้า/รหัสงาน — API ส่งมาเฉพาะ URL รูป + ชื่อหมวดหมู่เท่านั้น
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ คลังภาพผลงานทีมขาย + ปุ่มคัดลอก |
| 2 | GOAL วัดได้ | ✅ ค้นหา + แท็บหมวด + Lightbox + 2 ปุ่มคัดลอก |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, SitePhotosPage, Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 242/237/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-admin-portfolio-gallery |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 242 / pass 237 / fail 2 |
| 9 | CONTRACT ระบุ API response จริง + ฟังก์ชัน pure | ✅ JSON จริง + toAbsolutePhotoUrl ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
