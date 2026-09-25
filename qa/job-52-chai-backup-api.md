# ใบงาน 52 (ชัย) — ระบบ API สำรองและส่งออกข้อมูลสำหรับแอดมิน (/api/admin/backup/*)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้มีระบบสำรองข้อมูลสำคัญในหน้าแอดมิน เพื่อให้ Admin และ Owner สามารถกดดาวน์โหลดสำเนาข้อมูลสำคัญ (ข้อมูลลูกค้า, แคตตาล็อกอ่าง 30 รุ่น, สถานะฐานข้อมูล) เก็บไว้บนเครื่องคอมพิวเตอร์ได้ตลอดเวลา

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่ม Endpoint ส่งออกข้อมูลสำรองสำหรับ Admin/Owner:
  1. `GET /api/admin/backup/summary`:
     - ส่งคืนข้อมูลสถิติภาพรวม: จำนวน Leads ทั้งหมด, จำนวนภาพหน้างาน, จำนวนอ่าง, จำนวนสลิปโอนเงิน, และเวลาปัจจุบัน
  2. `GET /api/admin/backup/leads-export`:
     - ส่งออกข้อมูลลูกค้าและคำสั่งซื้อทั้งหมดเป็น CSV (UTF-8 พร้อม BOM เพื่อให้เปิดใน Microsoft Excel ภาษาไทยได้ไม่เพี้ยน)
     - มีคอลัมน์: รหัสงาน, ชื่อลูกค้า, โครงการ, ที่อยู่, ทีมช่าง, วันที่นัด, สถานะ, ยอดเงิน, วันที่สร้าง
  3. `GET /api/admin/backup/basins-export`:
     - ส่งออกข้อมูลอ่างทั้งหมดเป็น CSV: SKU, ชื่อสี, รหัสสี, ราคา, ขนาด, ขนาดหลุม, ลิงก์ภาพหลัก, ลิงก์ภาพ Top View
  4. ทุก Endpoint ถูกล็อกสิทธิ์เฉพาะบทบาท Admin หรือ Owner (`owner` หรือ `staff` ที่มีสิทธิ์)
  5. เขียน Unit tests ใน `admin-backup-api.test.ts` ครอบคลุมทั้ง 3 Endpoint และการตรวจสิทธิ์ (Permission Gate)

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-backup-api.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-backup-api แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 315 / pass 311 / fail 4 (ห้ามมี fail ใหม่)
  5) เทสต์ใหม่ใน admin-backup-api.test.ts ยืนยัน:
     - GET /admin/backup/summary คืนค่าตัวเลขสถิติครบถ้วน
     - GET /admin/backup/leads-export คืนค่า Content-Type text/csv และมี UTF-8 BOM
     - GET /admin/backup/basins-export ส่งออกครบทุกรุ่น
     - ปฏิเสธการเข้าถึง (401/403) หากไม่ได้ล็อกอินหรือสิทธิ์ไม่เพียงพอ

OUTPUT:
  - branch: feat/chai-backup-api (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API fail > 4)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน openapi.yaml:
     - เพิ่ม path: `/admin/backup/summary`, `/admin/backup/leads-export`, `/admin/backup/basins-export`
  2. ไฟล์ CSV ส่งออก:
     - ใช้ Header `Content-Type: text/csv; charset=utf-8`
     - ใส่ Header `Content-Disposition: attachment; filename="filename.csv"`
     - บรรทัดแรกสุดของเนื้อหาใส่ UTF-8 BOM `\uFEFF` เพื่อให้ Excel ภาษาไทยอ่านได้ถูกต้อง
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบ API สำรองและส่งออกข้อมูลสำหรับแอดมิน |
| 2 | GOAL วัดได้ | ✅ 3 Endpoints (summary, leads, basins) + BOM + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 315/311/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-backup-api |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 4 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 315 / pass 311 / fail 4 |
| 9 | CONTRACT ระบุ header และ BOM ชัด | ✅ text/csv, Content-Disposition, \uFEFF ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
