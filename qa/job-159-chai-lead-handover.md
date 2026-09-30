# ใบงาน 159 (ชัย) — ระบบบันทึกและจัดการประวัติการส่งมอบงานหลังการขายในตาราง Lead (Lead Handover & Warranty Records API)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Database & Handover Records) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อรองรับระบบใบส่งมอบงานและรับประกันดิจิทัล (`/handover` ใน Task 156) ให้สมบูรณ์แบบครบวงจร:
ปัจจุบันเมื่อช่างติดตั้งเสร็จสิ้นและส่งมอบงานให้ลูกค้า ข้อมูลวันส่งมอบงานจริง (`handover_date`), เลขที่ใบรับประกัน (`warranty_no`), และหมายเหตุการส่งมอบ ยังไม่ได้ถูกบันทึกเป็นสัดส่วนลงในตาราง Lead
งานนี้คือการเพิ่มฟิลด์และ Endpoint หลังบ้านสำหรับบันทึกและดึงข้อมูลการส่งมอบงาน:
1. **คอลัมน์ใหม่ในตาราง `customer_leads`:**
   - `handover_date` (varchar 10 หรือ date, nullable) — วันที่ส่งมอบงานจริง (ISO Date เช่น `2026-09-30`)
   - `warranty_no` (varchar 64, nullable) — เลขที่ใบรับประกัน (เช่น `KB-WAR-26/1012`)
   - `warranty_period_months` (integer, default 12, not null) — ระยะเวลารับประกัน (ค่าเริ่มต้น 12 เดือน / 1 ปี)
   - `handover_notes` (text, nullable) — บันทึกการส่งมอบงาน
   - สร้างไฟล์ migration ใหม่ใน `deploy/hostinger/migrations/` (ตรวจเลขล่าสุดก่อนสร้าง)
2. **Endpoint ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   * `PATCH /api/admin/leads/:id/handover` (guard `requireAdminPermission("leads", "edit")`):
     - รับ Body: `{ handoverDate?: string, warrantyNo?: string, warrantyPeriodMonths?: number, handoverNotes?: string }`
     - ตรวจสอบฟอร์แมตวันที่ `YYYY-MM-DD`
     - อัปเดตข้อมูลลงฐานข้อมูล คืนค่า Lead ที่อัปเดตแล้ว
3. **ส่งข้อมูลคืนใน `GET /admin/leads` และ `GET /public/track`:**
   * ใน `GET /admin/leads` ส่งฟิลด์ `handoverDate`, `warrantyNo`, `warrantyPeriodMonths`, `handoverNotes` กลับไปด้วย
   * ใน `GET /public/track` (หน้าพอร์ทัลลูกค้าและหน้าใบรับประกัน) ส่ง `handoverDate`, `warrantyNo`, `warrantyPeriodMonths` กลับไปด้วย (เฉพาะข้อมูลที่ลูกค้าต้องเห็น เพื่อให้หน้า `/handover` นำไปแสดงเลขที่รับประกันและวันหมดอายุได้จริง!)
4. **เขียน Unit Tests ใน `artifacts/api-server/test/lead-handover.test.ts` (ใหม่):**
   * ทดสอบ PATCH บันทึกข้อมูลส่งมอบงานสำเร็จ
   * ทดสอบ GET /public/track มีข้อมูลรับประกันส่งกลับมา
   * ทดสอบ validation วันที่ผิดฟอร์แมต

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-lead-handover แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. เพิ่มคอลัมน์ handover_date, warranty_no, warranty_period_months, handover_notes ใน customer_leads + migration
  2. เพิ่ม PATCH /api/admin/leads/:id/handover บันทึกข้อมูลส่งมอบงานและใบรับประกัน
  3. ส่งข้อมูลรับประกันกลับใน GET /admin/leads และ GET /public/track
  4. เขียนเทสต์ใน artifacts/api-server/test/lead-handover.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  - /opt/data/cache/kbsrc/deploy/hostinger/migrations/ · (ไฟล์ migration ใหม่ 1 ไฟล์)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/lead-handover.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/ และ lib/db/
  - ห้ามลบคอลัมน์หรือเปลี่ยนชนิดคอลัมน์เดิมใน customer_leads
  - ห้ามแตะต้อง ai-cost-tracker.ts หรือระบบราคา
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-lead-handover

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/lead-handover.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/public-job-tracking.test.ts -> ผ่าน 100% (baseline 13/13 ต้องไม่พัง)
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE เท่านั้น

OUTPUT:
  - branch: feat/chai-lead-handover (เปิด PR เข้า main)
  - 5 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์โครงสร้างตารางเดิมในฐานข้อมูล | ✅ ผ่าน |
| 11 | รองรับข้อมูลใบรับประกันและการส่งมอบครบถ้วน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
