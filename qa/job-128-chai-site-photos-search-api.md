# ใบงาน 128 (ชัย) — เพิ่มการค้นหาข้อความรวมและการกรองช่วงเวลาใน API ภาพหน้างาน (Site Photos Universal Search & Date Range API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Admin API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในระบบภาพหน้างานช่าง หน้าบ้านกำลังต้องการระบบค้นหาที่ยืดหยุ่น (Universal Search) และการกรองช่วงเวลาที่ไม่ติดเฉพาะรายเดือน
ปัจจุบัน `GET /api/admin/site-photos` รับเฉพาะ `jobCode` (แบบตรงเป๊ะ) และ `month` (YYYY-MM)
ชัยจะรับหน้าที่ขยายความสามารถของ API นี้ให้รองรับ:
1. การค้นหาข้อความอิสระ (`q` หรือ `search`): ค้นหาด้วย `ILIKE` ใน `jobCode`, `description`, และ `senderName`
2. การกรองช่วงเวลาที่ยืดหยุ่น: รองรับ `startDate` และ `endDate` (ISO date หรือ YYYY-MM-DD) และรองรับ `days` (เช่น `days=30` สำหรับ 30 วันล่าสุด)

**รายละเอียดงานใน `artifacts/api-server/src/routes/admin-router.ts`:**
1. **ขยาย `GET /api/admin/site-photos`:**
   * รับ query params เพิ่มเติม:
     - `q` (string): ข้อความค้นหา หากมีค่า ให้สร้าง condition `or(ilike(sitePhotos.jobCode, %q%), ilike(sitePhotos.description, %q%), ilike(sitePhotos.senderName, %q%))`
     - `startDate` (string): วันที่เริ่มต้น (กรอง `gte(sitePhotos.capturedAt, startDate)`)
     - `endDate` (string): วันที่สิ้นสุด (กรอง `lte(sitePhotos.capturedAt, endDate)`)
     - `days` (integer string): หากระบุ (เช่น `30`) ให้คำนวณวันย้อนหลังจากปัจจุบัน `now - N days`
   * ยังคงความเข้ากันได้กับ query params เดิม 100% (`jobCode`, `stage`, `unassigned`, `month`, `limit`, `leadId`)
2. **สร้าง Automated Unit Tests ใน `artifacts/api-server/test/admin-site-photos-search-api.test.ts` (ใหม่):**
   * ทดสอบการค้นหาผ่าน query `q` (เจอจาก jobCode, เจอจาก description, เจอจาก senderName)
   * ทดสอบการกรองช่วงเวลาด้วย `startDate` / `endDate` และ `days=30`
   * ทดสอบการทำงานร่วมกันระหว่าง `q` + `stage` + `limit`
   * ทดสอบคงพฤติกรรมเดิมเมื่อไม่มีการส่ง query ใหม่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-site-photos-search-api แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. ปรับปรุง artifacts/api-server/src/routes/admin-router.ts ใน GET /admin/site-photos:
     - เพิ่มพารามิเตอร์ q สำหรับค้นหาใน jobCode, description, senderName
     - เพิ่มพารามิเตอร์ startDate, endDate, days สำหรับกรองช่วงเวลา
     - คง query params เดิมไว้ 100%
  2. สร้าง artifacts/api-server/test/admin-site-photos-search-api.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos-search-api.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามเปลี่ยนโครงสร้างตาราง sitePhotos หรือ database schema
  - ห้ามทำให้ query params เดิม (jobCode, stage, month, unassigned) เสียหาย
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-site-photos-search-api

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-site-photos-search-api
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/admin-site-photos-search-api.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 595 / pass 589 / fail 6 (pre-existing sandbox) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-site-photos-search-api (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline 6 ข้อเดิม
  - ถ้าแตะต้องไฟล์นอก SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์ schema ฐานข้อมูลและ query เดิม | ✅ ผ่าน |
| 11 | รองรับ Universal Search และ Date Range | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
