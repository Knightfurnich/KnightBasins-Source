# ใบงาน 234-R (Quote Number Format & Comprehensive Support Security) — Replit Version: รันเลขรายเดือนแยกประเภท QT-YYYYMM-TYPE-NNNN พร้อมระบบป้องกันการสุ่มเลข

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — ให้ Replit ทำงานต่อเนื่อง)
**สถานะ:** มอบหมายให้ Replit · **พัฒนาผ่าน GitHub Connection เท่านั้น**
**Branch:** `feat/replit-quote-number-sequential-format`
**ที่มา:** บอสเคาะรูปแบบเลขที่ใบเสนอราคามาตรฐานใหม่:
**`QT-YYYYMM-TYPE-NNNN`** (เช่น `QT-202610-US-0001`, `QT-202610-OF-0002`)
และนำข้อคิดเห็นด้านความปลอดภัยของชัยมาปรับปรุงให้รอบเดียวจบ:
- ปัจจุบันเส้นทาง `POST /support/payment-slip` มี Rate limit 5 ครั้ง/10 นาที/IP อยู่แล้ว (support.ts:437) **ห้ามผ่อนคลายให้หลวมกว่าเดิมเด็ดขาด**
- เพิ่มการตรวจจับการสุ่มเลข (Failed Attempt Lockout): หากยิงผิดเกิน 5 ครั้งต่อเลขที่ใบเสนอราคาหรือเบอร์โทรภายใน 1 ชั่วโมง ให้ปฏิเสธ HTTP 429
- เพิ่มการตรวจอายุ 45 วัน (`isPublicQuoteTokenExpired`) และตรวจสอบราคาจริง (`checkQuoteBeforePayment`) ในเส้นทางนี้ด้วย
- อัปเดตข้อความตัวอย่างทั้งหมดในระบบให้เป็น "QT-202610-US-0001"

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. Migration ตารางตัวนับ (additive ปลอดภัย):
     - deploy/hostinger/migrations/022_quote_number_counters.sql
       CREATE TABLE IF NOT EXISTS quote_number_counters (
         period      text PRIMARY KEY,
         last_value  integer NOT NULL DEFAULT 0,
         updated_at  timestamptz NOT NULL DEFAULT now()
       );
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - formatQuotePeriod(now): คืนค่า "YYYYMM" ตามเวลาไทย (Asia/Bangkok GMT+7)
     - createNextQuoteNumber(database, quoteFormat: "US" | "OF" = "US", now = new Date()):
       - INSERT INTO quote_number_counters (period, last_value) VALUES ($period, 1)
         ON CONFLICT (period) DO UPDATE SET last_value = quote_number_counters.last_value + 1, updated_at = now()
         RETURNING last_value;
       - คืนค่า `QT-${period}-${quoteFormat}-${String(lastValue).padStart(4, "0")}`
       - ดึง quoteFormat จาก studioData (ถ้าเป็น quick-purchase ดูจาก studioData.quoteFormat หรือถ้าเป็น studio กำหนดเป็น "US")
     - จุดออกเลข (POST /api/leads และ PATCH /admin/leads/:id): เรียก createNextQuoteNumber(database, format, now)
  3. ใน artifacts/api-server/src/routes/support.ts:
     - ห้ามปรับ rate limit หลวมกว่า 5 ครั้ง/10 นาที/IP (คง supportPaymentSlipRateLimit เดิมไว้)
     - เพิ่มตัวตรวจจับการสุ่มเลข (Failed Attempt Tracking): หากยิงผิด (ไม่พบใบเสนอราคา หรือเบอร์โทรไม่ตรง) เกิน 5 ครั้งต่อเลขที่หรือต่อเบอร์ภายใน 1 ชั่วโมง ให้ปฏิเสธ HTTP 429
     - เพิ่มการตรวจสอบความปลอดภัยทางการเงินใน POST /support/payment-slip:
       - ตรวจสอบอายุ 45 วัน: if (isPublicQuoteTokenExpired(lead.createdAt)) return 410 quote_expired
       - ตรวจสอบราคาจริงบนเซิร์ฟเวอร์ก่อนรับสลิป: checkQuoteBeforePayment(...)
     - อัปเดตข้อความตัวอย่างบรรทัด ~464 เป็น "QT-202610-US-0001"
  4. ใน artifacts/knight-basins/src/components/KnightSupport.tsx:
     - อัปเดตข้อความตัวอย่างคำแนะนำเป็น "QT-202610-US-0001"
  5. ชุดทดสอบ:
     - artifacts/api-server/test/quote-number-sequential.test.ts:
       - ทดสอบรันลำดับต่อเนื่อง (0001 -> 0002) และการรีเซ็ตข้ามเดือน
       - ทดสอบฟังก์ชัน pipelineOrderType แยก us/of จากเลขใหม่
       - ทดสอบ static check ยืนยันใช้ INSERT ON CONFLICT RETURNING และไม่มี COUNT(*)
       - ทดสอบการล็อกเมื่อสุ่มผิดเกิน 5 ครั้งใน /support/payment-slip
       - ทดสอบว่า /support/payment-slip ปฏิเสธ 410 เมื่อใบเสนอราคาอายุเกิน 45 วัน
  6. เอกสาร:
     - อัปเดต UpdatesPage.tsx, public/llms.txt และ public/llms-full.txt ให้ระบุรูปแบบใหม่อย่างสอดคล้องกัน

SCOPE:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/support.ts
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/api-server/test/quote-number-sequential.test.ts
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข artifacts/knight-basins/src/index.css เด็ดขาด (0 diff)
  - ห้ามนับเลขด้วย COUNT(*) หรือ SELECT MAX แล้วบวกเอง (ต้อง atomic เท่านั้น)
  - ห้ามปรับ Rate limit ใน support.ts ให้หลวมกว่า 5 ครั้ง/10 นาที
  - ห้ามแตะข้อมูลใบเสนอราคาเก่าในฐานข้อมูล (ห้าม UPDATE/DELETE quote_number ของแถวเดิม)
  - ห้ามใส่ UNIQUE INDEX บน customer_leads.quote_number ในใบงานนี้
  - Migration ต้องเป็น CREATE TABLE IF NOT EXISTS เท่านั้น ห้าม DROP/TRUNCATE/DELETE

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) branch แสดง feat/replit-quote-number-sequential-format ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-number-sequential.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test (ตัด browser tests ออก) ใน api-server (baseline: 966 ผ่าน / 0 ตก / 0 ข้าม) และ knight-basins (baseline: 963 ผ่าน / 0 ตก / 7 ข้าม)
  5) diff artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - deploy/hostinger/migrations/022_quote_number_counters.sql
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/support.ts
  - artifacts/knight-basins/src/components/KnightSupport.tsx
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
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รันเลขรายเดือน + ปิดช่องโหว่ Support slip |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุไฟล์ครบถ้วน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามปรับ rate limit หลวม, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 966/963 จริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit (ทำงานต่อเนื่อง ไม่สับสน) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทบทวนละเอียดรอบเดียวจบตามคำสั่งบอส |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ปลอดภัยครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ปรับปรุง Task 234 เรียบร้อย |
