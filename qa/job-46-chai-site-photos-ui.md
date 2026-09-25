# ใบงาน 46 (ชัย) — หน้าแกลเลอรีภาพหน้างานช่างในหน้าแอดมิน (/admin/site-photos)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** หลังจากที่ชัยได้สร้างระบบฐานข้อมูลและ API ภาพหน้างาน (Migration 014) สำเร็จแล้ว ขั้นตอนนี้คือการสร้างหน้าจอแกลเลอรีภาพหน้างานสำหรับแอดมินและทีมงาน เพื่อให้สามารถเปิดดูภาพถ่ายหน้างานจริงจากช่าง, ค้นหาตามรหัสงาน (เช่น JB26/1080), กรองตามขั้นตอน (วัดงาน/ติดตั้ง/เสร็จสมบูรณ์), และคลิกดูรูปขยายใหญ่ได้สะดวก

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างหน้าจอแกลเลอรีภาพหน้างาน `/admin/site-photos`:
  1. สร้างคอมโพเนนต์ `SitePhotosPage.tsx` ใน `artifacts/knight-basins/src/admin/`:
     - ใช้ React Query hook `useGetAdminSitePhotos` (และ `useUpdateAdminSitePhoto` สำหรับแก้ไข)
     - แถบค้นหารหัสงาน (`jobCode`) และปุ่มตัวกรองขั้นตอนงาน (`stage`: ทั้งหมด, วัดหน้างาน, งานติดตั้ง, เก็บงาน/เซอร์วิส, ติดตั้งเสร็จสมบูรณ์)
     - แสดงภาพถ่ายเป็น Photo Grid (การ์ดรูปภาพ) พร้อมป้าย Stage, รหัสงาน, วันที่ถ่าย, ชื่อผู้ส่ง และคำบรรยาย AI
     - คลิกที่รูปภาพเพื่อเปิด Modal / Lightbox ดูภาพขนาดใหญ่ความละเอียดเต็ม
     - ปุ่มล้างตัวกรอง และปุ่มรีเฟรชข้อมูล
  2. ผูก Route และเมนูด้านข้างใน `AdminApp.tsx`:
     - เพิ่มรายการเมนู `"ภาพหน้างาน"` ใน `NAV_ITEMS` (สิทธิ์ `permission: "leads"`)
     - เพิ่ม `<Route path="/admin/site-photos" component={AdminSitePhotosRoute} />`
  3. เขียน Unit tests ใน `admin-site-photos-ui.test.ts` ครอบคลุมการแสดงผล, การกรองตาม stage และการค้นหา

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/SitePhotosPage.tsx (ใหม่)
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-site-photos-ui.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/ หรือ deploy/
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-site-photos-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 201 / pass 196 / fail 2 / cancelled 3 (non-browser tests 196/196 ผ่านครบ)
  4) เทสต์ใหม่ใน admin-site-photos-ui.test.ts ยืนยัน:
     - render คอมโพเนนต์ SitePhotosPage สำเร็จ
     - การกรองสถานะ stage และการค้นหา jobCode ทำงานถูกต้อง

OUTPUT:
  - branch: feat/chai-site-photos-ui (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (fail > 2)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน SitePhotosPage.tsx:
     - ป้ายสถานะ (Stage Badges):
       - `survey`: สีฟ้า ("📐 วัดหน้างาน")
       - `installation`: สีส้ม/อำพัน ("🛠️ งานติดตั้ง")
       - `service`: สีม่วง ("🔧 เก็บงาน/เซอร์วิส")
       - `completed`: สีเขียว ("✅ เสร็จสมบูรณ์")
     - รูปภาพแสดงด้วย `<img src={photo.imageUrl} alt={photo.description || photo.jobCode || "ภาพหน้างาน"} />`
     - มี Modal แสดงรูปขยายพร้อมปุ่มปิด (Esc หรือคลิกพื้นหลัง)
  2. ใน AdminApp.tsx:
     - ใน `NAV_ITEMS`:
       `{ href: "/admin/site-photos", label: "ภาพหน้างาน", exact: false, permission: "leads" }`
     - ประกาศฟังก์ชัน Route:
       ```tsx
       function AdminSitePhotosRoute() {
         return (
           <AdminPermissionGate permission="leads" resource="ภาพหน้างานช่าง">
             <SitePhotosPage />
           </AdminPermissionGate>
         );
       }
       ```
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ หน้าแกลเลอรีภาพหน้างานช่างในหน้าแอดมิน |
| 2 | GOAL วัดได้ | ✅ SitePhotosPage + AdminApp route + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 201/196/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-site-photos-ui |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 201 / pass 196 / fail 2 |
| 9 | CONTRACT ระบุ stage badges และ route | ✅ กำหนด 4 สถานะและโค้ด route ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
