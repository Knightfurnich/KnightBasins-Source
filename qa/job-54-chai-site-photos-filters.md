# ใบงาน 54 (ชัย) — ระบบ API ตัวกรองภาพหน้างานขั้นสูง (Advanced Site Photos Filter API)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เพื่อรองรับภาพถ่ายหน้างานที่จะเพิ่มขึ้นเป็นหลายพันรูปในอนาคตตามที่คุณนพวางแผนไว้ ระบบต้องการตัวกรองขั้นสูงใน `GET /api/admin/site-photos` เพื่อให้สามารถกรองดูเฉพาะ "รูปที่ยังไม่ระบุรหัสงาน", "กรองตามเดือน (YYYY-MM)", และ "กรองตามชื่อทีมช่าง" ได้อย่างรวดเร็ว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่ม Query Parameters ใน `GET /api/admin/site-photos`:
  1. `unassigned`: boolean (ถ้าเป็น true ให้กรองเฉพาะรูปที่ `jobCode IS NULL` หรือเป็นค่าว่าง)
  2. `month`: string (เช่น `2026-09` กรองเฉพาะรูปที่ถ่ายในเดือนนั้น โดยเช็กจาก `capturedAt`)
  3. `senderName`: string (ค้นหา/กรองตามชื่อผู้ส่งหรือชื่อทีมช่าง)
  4. อัปเดต openapi.yaml + รัน codegen
  5. เขียน Unit tests ใน `admin-site-photos-filters.test.ts` ครอบคลุมการกรองทั้ง 3 ตัว

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos-filters.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-site-photos-filters แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 331 / pass 327 / fail 4 (ห้ามมี fail ใหม่)
  5) เทสต์ใหม่ใน admin-site-photos-filters.test.ts ยืนยัน:
     - กรอง unassigned=true ดึงเฉพาะรูปที่ไม่มี jobCode
     - กรอง month=2026-09 ดึงเฉพาะรูปในเดือนกันยายน
     - กรอง senderName ทำงานถูกต้อง

OUTPUT:
  - branch: feat/chai-site-photos-filters (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API fail > 4)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน openapi.yaml (GET /admin/site-photos):
     - เพิ่ม parameters: `unassigned` (type: boolean), `month` (type: string, pattern: `^\d{4}-\d{2}$`), `senderName` (type: string)
  2. ใน admin-router.ts:
     - ใช้ and() รวมเงื่อนไขของ unassigned, month, senderName เข้ากับ stage และ jobCode เดิม
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบ API ตัวกรองภาพหน้างานขั้นสูง |
| 2 | GOAL วัดได้ | ✅ unassigned + month + senderName + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 331/327/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-site-photos-filters |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 4 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 331 / pass 327 / fail 4 |
| 9 | CONTRACT ระบุ parameters และ pattern ชัด | ✅ unassigned, month, senderName ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
