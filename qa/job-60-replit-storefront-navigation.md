# ใบงาน 60 (Replit) — เพิ่มเมนู 'ผลงานจริง' และ 'คู่มือเตรียมหน้างาน' บนแถบนำทางหลัก (Navbar) ของเว็บไซต์

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้ลูกค้าที่เข้ามาหน้าเว็บสามารถเข้าถึงหน้า "คลังผลงานติดตั้งจริง" (/portfolio) และหน้า "คู่มือเตรียมหน้างาน" (/site-prep) ได้สะดวกจากแถบนำทางด้านบน (Header / MainNav) ทั้งบนหน้าจอคอมพิวเตอร์และบนมือถือ (Mobile Drawer)

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  1. เพิ่มลิงก์นำทางในแถบ Header หลักของหน้าร้าน (App.tsx):
     - `[ 📸 ผลงานจริง ]` (href="/portfolio", active เมื่ออยู่ที่ /portfolio)
     - `[ 📐 เตรียมหน้างาน ]` (href="/site-prep", active เมื่ออยู่ที่ /site-prep)
     - วางถัดจากเมนู "ส่งแบบร่าง" (/sketch) ก่อนปุ่มขอใบเสนอราคา
  2. ในมุมมองมือถือ (Mobile navigation):
     - เพิ่มทั้ง 2 ลิงก์เข้าไปในเมนูแถบด้านบนหรือปุ่มสลับเมนู ให้แตะเข้าไปดูได้สะดวก
  3. เขียน Unit tests ใน `storefront-nav-portfolio.test.ts` ยืนยัน:
     - Header มีลิงก์ /portfolio และ /site-prep ครบถ้วน
     - ลิงก์มี data-testid และ text ถูกต้อง

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/App.tsx (แก้เฉพาะส่วน MainNav / Header navigation links เท่านั้น — ห้ามแก้ส่วนอื่น)
  2. artifacts/knight-basins/test/storefront-nav-portfolio.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแก้ตรรกะใบเสนอราคาหรือการคำนวณใน App.tsx
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-storefront-navigation แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 261 / pass 255 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - แถบ Header บนเดสก์ท็อป แสดงเมนู "ผลงานจริง" และ "เตรียมหน้างาน"
     - แถบเมนูบนหน้าจอมือถือ

OUTPUT:
  - branch: feat/replit-storefront-navigation (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ เพิ่มลิงก์ผลงานจริงและเตรียมหน้างานบน Navbar |
| 2 | GOAL วัดได้ | ✅ ลิงก์ /portfolio + /site-prep บน Header + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 261/255/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-storefront-navigation |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 261 / pass 255 / fail 2 |
| 9 | CONTRACT ระบุ path และ placement ชัด | ✅ /portfolio และ /site-prep ถัดจาก /sketch |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
