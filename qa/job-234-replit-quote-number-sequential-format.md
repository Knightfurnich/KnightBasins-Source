# ใบงาน 234-R (Quote Number Format) — Replit Version: รันเลขรายเดือนแยกประเภท QT-YYYYMM-TYPE-NNNN

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — ให้ Replit ทำแทนชัย)
**สถานะ:** มอบหมายให้ Replit · **พัฒนาผ่าน GitHub Connection เท่านั้น**
**Branch:** `feat/replit-quote-number-sequential-format`
**ที่มา:** บอสเคาะรูปแบบเลขที่ใบเสนอราคามาตรฐานใหม่อย่างเป็นทางการ:
**`QT-YYYYMM-TYPE-NNNN`** (เช่น `QT-202610-US-0001`, `QT-202610-OF-0002`)
- รัน 0001 ขึ้นไปในเดือนนั้น และรีเซ็ตกลับเป็น 0001 เมื่อขึ้นเดือนหรือปีใหม่
- บอสอนุมัติให้ Replit รับหน้าที่พัฒนางานนี้แทนชัยผ่าน GitHub Connection

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. Migration ใหม่ (additive ปลอดภัย รันซ้ำได้):
     - สร้างไฟล์ deploy/hostinger/migrations/022_quote_number_counters.sql
     - คำสั่ง SQL (CREATE TABLE IF NOT EXISTS เท่านั้น):
       CREATE TABLE IF NOT EXISTS quote_number_counters (
         period      text PRIMARY KEY,
         last_value  integer NOT NULL DEFAULT 0,
         updated_at  timestamptz NOT NULL DEFAULT now()
       );
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - เพิ่มฟังก์ชัน formatQuotePeriod(now): คืนค่า "YYYYMM" ตามเวลาไทย (Asia/Bangkok GMT+7)
     - เพิ่มฟังก์ชัน createNextQuoteNumber(database, quoteFormat: "US" | "OF" = "US", now = new Date()):
       - กำหนดค่า period = formatQuotePeriod(now)
       - รันเลขด้วย SQL Atomic:
         INSERT INTO quote_number_counters (period, last_value)
         VALUES ($period, 1)
         ON CONFLICT (period)
         DO UPDATE SET last_value = quote_number_counters.last_value + 1, updated_at = now()
         RETURNING last_value;
       - คืนค่าสตริง: `QT-${period}-${quoteFormat}-${String(lastValue).padStart(4, "0")}`
       - หากเกิน 9999 ใบ ให้ขยายหลักอัตโนมัติ (เช่น QT-202610-US-10000) ห้ามตัดทอนหลักทิ้ง
     - ปรับจุดออกเลขที่ใบเสนอราคา (POST /api/leads และ PATCH /admin/leads/:id):
       - ดึง quoteFormat จาก studioData (ค่าเริ่มต้น "US")
       - เรียก createNextQuoteNumber(database, format, now)
       - ปิดช่อง client-supplied quoteNumber: ละทิ้งค่า parsed.data.quoteNumber ที่ client ส่งมาเอง
  3. ชุดทดสอบ:
     - artifacts/api-server/test/quote-number-sequential.test.ts:
       - ทดสอบ formatQuotePeriod ตามเวลาไทย
       - ทดสอบรูปแบบตรงตาม Regex `/^QT-\d{6}-(US|OF)-\d{4,}$/`
       - ทดสอบการรันลำดับต่อเนื่อง (0001 -> 0002) และการรีเซ็ตข้ามเดือน
       - ทดสอบ static source check ยืนยันการใช้ INSERT ON CONFLICT RETURNING
  4. เอกสาร:
     - อัปเดตตัวอย่างใน artifacts/api-server/SECURITY_AUDIT_REPORT.md
     - อัปเดต UpdatesPage.tsx, public/llms.txt และ public/llms-full.txt ให้ระบุรูปแบบใหม่อย่างสอดคล้องกัน

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
  - ห้ามใส่ UNIQUE INDEX บน customer_leads.quote_number ในใบงานนี้
  - Migration ต้องเป็น CREATE TABLE IF NOT EXISTS เท่านั้น ห้าม DROP/TRUNCATE/DELETE

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) branch แสดง feat/replit-quote-number-sequential-format ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-number-sequential.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test (ตัด browser tests ออก) ใน api-server (baseline: 956 ผ่าน / 0 ตก / 0 ข้าม) และ knight-basins (baseline: 963 ผ่าน / 0 ตก / 7 ข้าม)
  5) diff artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/quote-number-sequential.test.ts
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รูปแบบ QT-YYYYMM-TYPE-NNNN รันเลขรายเดือนแยกประเภท |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุไฟล์ครบถ้วน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | กฎ GitHub Connection, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline จริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit (ทำแทนชัยตามคำสั่งบอส) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำตามรูปแบบที่บอสเคาะ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ปลอดภัยครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 234-R เรียบร้อย |
