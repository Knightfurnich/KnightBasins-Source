# ใบงาน 234 (Quote Number Format) — เปลี่ยนเลขที่ใบเสนอราคาเป็นรูปแบบรันเลขรายเดือนแยกประเภท QT-YYYYMM-TYPE-NNNN

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — เคาะรูปแบบทางการแล้ว)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · **ทำต่อจาก Job 233 เท่านั้น** (sequential)
**Branch:** `feat/chai-quote-number-sequential-format`
**ที่มา:** บอสเคาะรูปแบบเลขที่ใบเสนอราคามาตรฐานใหม่ของบริษัทอย่างเป็นทางการ:
**`QT-YYYYMM-TYPE-NNNN`**
- `QT` = คำย่อสากล Quotation
- `YYYYMM` = ปี ค.ศ. 4 หลัก และเดือน 2 หลัก ตามเวลาไทย (Asia/Bangkok)
- `TYPE` = ประเภทใบเสนอราคาตามมาตรฐานบริษัท:
  - `US` = ใบเสนอราคาแบบสรุปตามพื้นที่ (ตร.ม.)
  - `OF` = ใบเสนอราคาแบบรายละเอียดรายห้อง / จุดติดตั้ง
- `NNNN` = เลขรันลำดับ 4 หลัก (0001, 0002, 0003...) โดยแชร์ตัวนับลำดับงานรวมภายในเดือนเดียวกัน และรีเซ็ตกลับเป็น `0001` เมื่อขึ้นเดือนหรือปีใหม่
- ตัวอย่างจริง:
  - ใบแรกของเดือนตุลาคม 2026 (แบบ US) → `QT-202610-US-0001`
  - ใบที่สองของเดือนตุลาคม 2026 (แบบ OF) → `QT-202610-OF-0002`
  - ขึ้นเดือนพฤศจิกายน 2026 (ใบแรก) → `QT-202611-US-0001`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. Migration ใหม่ (additive ปลอดภัย รันซ้ำได้):
     - ไฟล์ deploy/hostinger/migrations/022_quote_number_counters.sql
     - สร้างตารางตัวนับรายเดือน (ใช้ CREATE TABLE IF NOT EXISTS เท่านั้น):
       CREATE TABLE IF NOT EXISTS quote_number_counters (
         period      text PRIMARY KEY,
         last_value  integer NOT NULL DEFAULT 0,
         updated_at  timestamptz NOT NULL DEFAULT now()
       );
     - ห้ามแก้หรือลบข้อมูลเดิมใด ๆ
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - เพิ่มฟังก์ชัน formatQuotePeriod(now): คืนค่า "YYYYMM" ตามเวลาไทย (Asia/Bangkok GMT+7)
     - เพิ่มฟังก์ชัน createNextQuoteNumber(database, quoteFormat: "US" | "OF" = "US", now = new Date()):
       - กำหนดค่า period = formatQuotePeriod(now)
       - รันเลขด้วย SQL Atomic เดียว (ป้องกัน race condition):
         INSERT INTO quote_number_counters (period, last_value)
         VALUES ($period, 1)
         ON CONFLICT (period)
         DO UPDATE SET last_value = quote_number_counters.last_value + 1, updated_at = now()
         RETURNING last_value;
       - คืนค่าสตริงรูปแบบ: `QT-${period}-${quoteFormat}-${String(lastValue).padStart(4, "0")}`
       - หากเกิน 9999 ใบ ให้ขยายหลักอัตโนมัติ (เช่น QT-202610-US-10000) ห้ามตัดทอนหลักทิ้ง
     - อัปเดตจุดที่ออกเลขที่ใบเสนอราคา (POST /api/leads และ PATCH /admin/leads/:id):
       - ตรวจสอบประเภท quoteFormat จาก studioData (ค่าเริ่มต้นคือ "US" หากระบุ "OF" ให้ใช้ "OF")
       - เรียก createNextQuoteNumber(database, format, now)
     - แทนที่และลบฟังก์ชันสุ่มเดิม (createUniqueQuoteNumber, createQuoteNumber, QUOTE_NUMBER_ATTEMPTS)
  3. ชุดทดสอบ:
     - artifacts/api-server/test/quote-number-sequential.test.ts:
       - ทดสอบ formatQuotePeriod ตามเวลาไทย (เช่น 2026-09-30T23:30:00Z -> "202610")
       - ทดสอบรูปแบบโครงสร้าง: ตรงตาม Regex `/^QT-\d{6}-(US|OF)-\d{4,}$/`
       - ทดสอบการรันลำดับต่อเนื่อง: 0001 -> 0002 -> 0003
       - ทดสอบการแยกประเภท: ส่ง "US" ได้ `QT-202610-US-0001`, ส่ง "OF" ได้ `QT-202610-OF-0002`
       - ทดสอบการรีเซ็ตข้ามเดือน: เมื่อเปลี่ยน period กลับมาเริ่ม 0001 ใหม่
       - Static source check: ยืนยันว่าใช้ INSERT ON CONFLICT RETURNING และไม่มีการใช้ COUNT(*)
  4. เอกสาร:
     - อัปเดตตัวอย่างใน artifacts/api-server/SECURITY_AUDIT_REPORT.md
     - อัปเดต UpdatesPage.tsx และ public/llms.txt + public/llms-full.txt ให้ระบุรูปแบบใหม่อย่างสอดคล้องกัน

SCOPE:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/quote-number-sequential.test.ts
  - artifacts/api-server/SECURITY_AUDIT_REPORT.md
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข artifacts/knight-basins/src/index.css เด็ดขาด (0 diff)
  - ห้ามนับเลขด้วย COUNT(*) หรือ SELECT MAX แล้วบวกเอง (ต้อง atomic เท่านั้น)
  - ห้ามแตะข้อมูลใบเสนอราคาเก่าในฐานข้อมูล (ห้าม UPDATE/DELETE quote_number ของแถวเดิม)
  - ห้ามใส่ UNIQUE INDEX บน customer_leads.quote_number ในใบงานนี้ (แยกเป็นขั้นรอบอสตัดสินใจข้อมูลซ้ำ)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-quote-number-sequential-format ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-number-sequential.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 956 ผ่าน / 0 ตก / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

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
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รูปแบบ QT-YYYYMM-TYPE-NNNN รันเลขรายเดือนแยกประเภท |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุไฟล์ครบถ้วน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้าม COUNT(*), ห้ามแตะข้อมูลเก่า, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 956 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) ทำต่อจาก Job 233 |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำตามรูปแบบที่บอสเคาะอนุมัติ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ปลอดภัยครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 234 เรียบร้อย |
