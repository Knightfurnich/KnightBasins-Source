# ใบงาน 234 (Quote Number Format) — เปลี่ยนเลขที่ใบเสนอราคาเป็นรูปแบบรันเลขรายเดือน QT-YYYYMM-NNN

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — เลือกรูปแบบแล้ว)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · **ทำต่อจาก Job 233 เท่านั้น** (sequential)
**Branch:** `feat/chai-quote-number-sequential-format`
**ที่มา:** บอสกำหนดกติกาเลขที่ใบเสนอราคาใหม่เอง: ให้ใช้รูปแบบ **`QT-YYYYMM-NNN`** (QT = Quotation, ปี ค.ศ. 4 หลัก, เดือน 2 หลัก, ลำดับ 3 หลัก) โดย **รันเลข 001 ขึ้นไปเรื่อย ๆ ภายในเดือนนั้น และรีเซ็ตกลับเป็น 001 เมื่อขึ้นเดือนใหม่** — ตัวอย่าง:
- ใบแรกของตุลาคม 2026 → `QT-202610-001`
- ใบที่ 85 ของเดือนเดียวกัน → `QT-202610-085`
- ขึ้นเดือนพฤศจิกายน 2026 → รีเซ็ตเป็น `QT-202611-001`
- ขึ้นปี 2027 → `QT-202701-001`

> เงื่อนไขบังคับ: **ห้ามใช้การนับด้วย `COUNT(*)` หรือการอ่านค่าล่าสุดแล้วบวกเอง** เพราะมีโอกาสชนกันเมื่อมีคำขอเข้ามาพร้อมกัน ต้องใช้กลไก atomic ของฐานข้อมูล (ตารางตัวนับ + `INSERT ... ON CONFLICT ... RETURNING`)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. Migration ใหม่ (additive ปลอดภัย รันซ้ำได้):
     - ไฟล์ deploy/hostinger/migrations/022_quote_number_counters.sql
     - สร้างตารางตัวนับ (ใช้ CREATE TABLE IF NOT EXISTS เท่านั้น):
       CREATE TABLE IF NOT EXISTS quote_number_counters (
         period      text PRIMARY KEY,
         last_value  integer NOT NULL DEFAULT 0,
         updated_at  timestamptz NOT NULL DEFAULT now()
       );
     - ห้ามแก้หรือลบข้อมูลเดิมใด ๆ
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - เพิ่มฟังก์ชัน formatQuotePeriod(now) คืนค่า "YYYYMM" ตามเวลาไทย (Asia/Bangkok GMT+7) โดยใช้ THAI_TIME_ZONE
     - เพิ่มฟังก์ชัน createNextQuoteNumber(database, now = new Date()):
       - ใช้ SQL แบบ atomic เดียว ไม่แยก select แล้ว update:
         INSERT INTO quote_number_counters (period, last_value)
         VALUES ($period, 1)
         ON CONFLICT (period)
         DO UPDATE SET last_value = quote_number_counters.last_value + 1, updated_at = now()
         RETURNING last_value;
       - คืนค่า `QT-${period}-${String(lastValue).padStart(3, "0")}`
       - กรณี lastValue > 999 (เดือนนั้นมีใบเกิน 999 ใบ) ให้ขยายหลักโดยไม่ตัดตัวเลขทิ้ง (เช่น QT-202610-1000) ห้ามปัดหรือเริ่มใหม่ทับ
     - เปลี่ยนผู้เรียกทั้งหมด (POST /api/leads และ PATCH /admin/leads/:id ที่เดิมเรียก createUniqueQuoteNumber) มาใช้ createNextQuoteNumber
     - ลบ createUniqueQuoteNumber และ QUOTE_NUMBER_ATTEMPTS ที่ไม่ใช้แล้ว (หรือคงไว้เฉพาะถ้ายังมีผู้เรียกจริง — ถ้าลบ ให้ลบเทสต์ที่อ้างถึงด้วย)
     - เก็บ createQuoteNumber เดิมไว้เฉพาะกรณีที่ยังมีเทสต์อ้างถึง มิฉะนั้นให้ลบทิ้งพร้อมเทสต์
  3. ใน artifacts/knight-basins/src/admin/LeadsManager.tsx และหน้าอื่นที่แสดงเลขที่:
     - ตรวจว่าไม่มีโค้ดใดแยกวิเคราะห์ (parse) เลขที่ใบเสนอราคาแบบรูปแบบเก่า มาคำนวณวันที่ (ถ้ามี ให้ใช้ createdAt จากฐานข้อมูลแทน)
  4. ชุดทดสอบ:
     - artifacts/api-server/test/quote-number-sequential.test.ts:
       - formatQuotePeriod: วันที่ 2026-09-30T23:30:00Z (เที่ยงคืนไทย 1 ต.ค.) → "202610"; 2026-10-31T17:00:00Z → "202611"
       - รูปแบบ: ใบแรกของเดือน → "QT-<period>-001", ใบที่ 85 → "-085"
       - การรีเซ็ตข้ามเดือน: เรียกด้วย period ใหม่ได้ค่า 001 อีกครั้ง (ใช้ database ปลอมที่แยกคีย์ตาม period)
       - พิสูจน์ว่าใช้ SQL atomic เดียว: ตรวจว่ามีคำสั่ง ON CONFLICT ... RETURNING ในซอร์ส (static source inspection) และไม่มีการนับด้วย COUNT(*)
       - เกิน 999: lastValue = 1000 → "QT-202610-1000" (ไม่ตัดเหลือ 000)
     - อัปเดต/ลบเทสต์เดิม quote-number-allocation.test.ts ให้สอดคล้อง (ถ้าฟังก์ชันเดิมถูกลบ)
  5. เอกสาร:
     - อัปเดต artifacts/api-server/SECURITY_AUDIT_REPORT.md addendum: เปลี่ยนจาก "unique quote numbers" เป็นรูปแบบรันเลขรายเดือน
     - อัปเดตหน้า /updates (UpdatesPage.tsx) และ public/llms.txt + public/llms-full.txt ให้ระบุรูปแบบใหม่ **พร้อมกันทั้ง 3 ไฟล์** (ตาม CONTRIBUTING ข้อ 8)

SCOPE:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/quote-number-sequential.test.ts
  - artifacts/api-server/test/quote-number-allocation.test.ts
  - artifacts/api-server/SECURITY_AUDIT_REPORT.md
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข artifacts/knight-basins/src/index.css เด็ดขาด (0 diff)
  - ห้ามนับเลขด้วย COUNT(*) หรือ SELECT ค่าสูงสุดแล้วบวกเอง (ต้อง atomic เท่านั้น)
  - ห้ามแตะข้อมูลใบเสนอราคาเก่าในฐานข้อมูล (ห้าม UPDATE/DELETE quote_number ของแถวเดิม)
  - ห้ามแก้ไขหรือเปลี่ยนเลขที่ใบเสนอราคาที่มีอยู่แล้วในระบบ
  - ห้ามใส่ UNIQUE INDEX บน customer_leads.quote_number ในใบงานนี้ (แยกเป็นขั้นรอบอสตัดสินใจข้อมูลซ้ำ)
  - Migration ต้องเป็น CREATE TABLE IF NOT EXISTS เท่านั้น ห้าม DROP/TRUNCATE/ALTER

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-quote-number-sequential-format ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-number-sequential.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 956 ผ่าน / 0 ตก / 0 ข้าม) และ knight-basins (963 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)
  6) ตรวจ migration ว่าไม่มี DROP/TRUNCATE/DELETE: grep -aiE 'drop|truncate|delete' deploy/hostinger/migrations/022_quote_number_counters.sql ต้องไม่พบคำสั่งอันตราย (คำในคอมเมนต์ให้เขียนเลี่ยงคำเหล่านี้)

OUTPUT:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/quote-number-sequential.test.ts
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รูปแบบ QT-YYYYMM-NNN รันเลขรายเดือน รีเซ็ตเมื่อขึ้นเดือน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุไฟล์ชัดเจนครบ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะข้อมูลเก่า, ห้ามห้าม COUNT(*), index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 956/963 จริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) ทำต่อจาก Job 233 |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำตามรูปแบบที่บอสเลือกเอง |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีข้อมูลลับในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 234 เรียบร้อย |
