# ใบงาน 89 (Replit) — วินิจฉัยและซ่อมแซม Test Harness ให้รัน Browser Tests ได้จริง (Fix Local Test Suite & PostgreSQL Schema Drift)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (DevOps & Test Infrastructure)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ทุกครั้งที่มีการรันเทสต์เต็มชุด (`npm test`) ในสภาพแวดล้อม Replit มักจะพบปัญหาซ้ำเดิม:
`API Server failed catalog initialization with Postgres error 42703 (Undefined Column)... 20 browser tests failed/timed out... HTTP 502`
ทำให้ Replit ไม่สามารถรัน Browser Integration Tests กับ API Server ได้จริง ต้องเลี่ยงไปใช้การจำลอง (Fixture/Mocked) แทน

เพื่อให้ชุดการทดสอบใน Replit แข็งแกร่ง สามารถรัน E2E และ Browser Tests ได้จริง 100%:
1. **วินิจฉัยสาเหตุของข้อผิดพลาด PostgreSQL 42703:**
   - ตรวจสอบว่าตารางและคอลัมน์ใดใน Local Test Database ที่ไม่ตรงกับโค้ดปัจจุบัน (เช่น ตรวจสอบ migrations ใน `deploy/hostinger/migrations/` ว่ามี migration ใดที่ Local DB ยังไม่ได้ apply)
   - ตรวจสอบ `scripts/` หรือโค้ดตั้งต้นของ Test Database ใน `artifacts/api-server/`
2. **ปรับปรุงกระบวนการเตรียมฐานข้อมูลทดสอบ (Test Setup / Migration Runner):**
   - ทำให้กระบวนการเริ่มต้น Test Database ทำการรัน Migration ครบทุกไฟล์ หรือรัน DDL Schema ล่าสุดก่อนเริ่มรันเทสต์
   - ป้องกันไม่ให้เกิด Schema Drift ระหว่าง Production และ Replit Workspace
3. **ผลลัพธ์ที่คาดหวัง:**
   - Local API Server สามารถสตาร์ทติดสำเร็จโดยไม่ล้มเหลวด้วย SQLSTATE 42703
   - คำขอ HTTP ไปยัง Local API Server ไม่ตอบ 502 Bad Gateway
   - ชุดการทดสอบที่ไม่ใช่ Browser (`non-browser tests`) ผ่าน 100% (0 failures)
   - ชุดการทดสอบ Browser สามารถรันและเชื่อมต่อ Local API Server ได้จริง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. วินิจฉัยข้อผิดพลาด PostgreSQL 42703 (undefined_column) ใน Local Test Database
  2. อัปเดต Schema / Migration script ของ Test Harness ให้ตรงกับ Production 100%
  3. ทำให้ Local API Server สตาร์ทสำเร็จและตอบคำขอ HTTP ได้โดยไม่พัง (แก้ปัญหา HTTP 502)
  4. พิสูจน์ผลลัพธ์: รัน npm test ใน artifacts/knight-basins และรายงานผลการรันจริง

SCOPE:
  - deploy/hostinger/migrations/ (หากมี migration เพิ่มเติม)
  - artifacts/api-server/scripts/ (scripts เตรียม test DB)
  - artifacts/api-server/src/ (หากมีการดักจับข้อผิดพลาดตอน init)
  - artifacts/knight-basins/test/ (ปรับปรุง harness setup)

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง App.tsx และหน้าบ้านหลักที่ใช้งานอยู่
  - ห้ามเชื่อมต่อหรือดัดแปลง Production Database บน Hostinger VPS จริงเด็ดขาด
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-fix-test-harness-schema แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) สาเหตุที่แท้จริงของข้อผิดพลาด 42703 (ระบุชื่อตารางและคอลัมน์ที่ขาดหาย)
  4) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 406 / pass 396 / fail 2 / cancelled 3 / skipped 5
     (ต้องรายงานตัวเลขเปรียบเทียบหลังแก้ไข โดย non-browser tests ต้องผ่าน 100%)
  5) แนบภาพหน้าจอหรือผลรัน Browser Test ที่ผ่านสำเร็จ

OUTPUT:
  - branch: feat/replit-fix-test-harness-schema (เปิด PR เข้า main)
  - ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการแก้ปัญหา 42703 และความเสถียรของ Local API | ✅ ผ่าน |
| 12 | ไม่แตะ Production DB และไฟล์ Print Layout | ✅ ผ่าน |
