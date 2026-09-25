# ใบงาน 56 (ชัย) — ระบบ API สต็อกหินสังเคราะห์ Read-Only ดึงสดจาก Google Drive Service Account

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้ดึงข้อมูลสต็อกหินสังเคราะห์ Staron และ Zen Stone จาก Google Drive มาแสดงในหน้า Admin เพื่อให้ทีมขาย ผู้บริหาร และเจ้าของตรวจสอบสต็อกได้ทันทีใน 1 วินาที โดยเชื่อมต่อผ่าน Service Account ในโหมด Read-Only

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้าง API endpoint `GET /api/admin/stock` ใน api-server:
  1. ดึงข้อมูลจาก Google Drive ผ่าน Service Account (ไฟล์คีย์: `/docker/knightbasins/google-credentials.json` บนเซิร์ฟเวอร์ หรือ `/opt/data/.google-credentials.json` บนเครื่อง dev หรืออ่านผ่านตัวแปร `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS`):
     - Staron (File ID: `12g_xKizhTAFz0wheAVV3LtLvzBuoCItR`, ชีท: `สต๊อคหินStaron`)
     - Zen Stone (File ID: `1Reo4DQlsXddm19ksEw3xhrfvhY06QjvP`, ชีท: `หน้าโชว์สต๊อคหิน Zen Stone`)
  2. Parse ข้อมูลตารางออกมาเป็น JSON:
     - no (ลำดับ), name (รหัสและชื่อสี), qty (ยอดคงเหลือแผ่น), scrap (เศษคงเหลือ), lots (array ของ Lot No.), note (หมายเหตุ)
  3. แคชผลลัพธ์ในหน่วยความจำ 5 นาที (TTL 300 วินาที) และรองรับ query parameter `refresh=true` เพื่อบังคับดึงสดทันที
  4. อัปเดต openapi.yaml + รัน codegen
  5. เขียน Unit tests ใน `admin-stock-api.test.ts` (Mock Google Drive API และทดสอบ Response format + refresh query)

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-stock-api.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-stock-api แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 342 / pass 338 / fail 4 (ห้ามมี fail ใหม่)
  5) เทสต์ใหม่ใน admin-stock-api.test.ts ผ่าน 100% ยืนยัน:
     - คืนโครงสร้าง staron และ zen ครบถ้วน
     - query ?refresh=true สั่งดึงสดใหม่
     - มีการป้องกันสิทธิ์ requireAnyAdminPermission(["leads", "basins"])

OUTPUT:
  - branch: feat/chai-stock-api (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API fail > 4)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. โครงสร้าง Response ของ `GET /api/admin/stock`:
     ```json
     {
       "updatedAt": "2026-09-25T11:50:00Z",
       "staron": {
         "title": "สต๊อคแผ่นหินสังเคราะห์ Staron",
         "total": 63,
         "inStockCount": 41,
         "items": [
           { "no": 1, "name": "AA 625 (Aspen Alder)", "qty": 21, "scrap": "", "lots": [], "note": "" }
         ]
       },
       "zen": {
         "title": "สต๊อคแผ่นหินสังเคราะห์ Zen Stone",
         "total": 47,
         "inStockCount": 29,
         "items": [
           { "no": 1, "name": "AP 100 (Apex)", "qty": 3, "scrap": "", "lots": [], "note": "" }
         ]
       }
     }
     ```
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบ API สต็อกหินสังเคราะห์ Read-Only |
| 2 | GOAL วัดได้ | ✅ Staron + Zen Stone + แคช 5 นาที + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 342/338/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-stock-api |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 4 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 342 / pass 338 / fail 4 |
| 9 | CONTRACT ระบุ schema และ JSON ชัด | ✅ โครงสร้าง staron + zen ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
