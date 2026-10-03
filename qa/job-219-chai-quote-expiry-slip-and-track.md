# ใบงาน 219 (Security Fix) — ปิดช่องโหว่อายุลิงก์ 45 วันในจุดอัปโหลดสลิปและการติดตามสถานะงาน

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ได้รับอนุมัติจากบอสโดยตรงแล้ว (ภารกิจแก้ไขความปลอดภัยอันดับ 1)
**Branch:** `fix/chai-quote-expiry-slip-and-track`
**ที่มา:** จากการทบทวนรอบงาน Job 213 พบว่าการเช็คอายุลิงก์ใบเสนอราคา 45 วัน (`isPublicQuoteTokenExpired`) ยังหลุดไป 2 จุดสำคัญ คือ endpoint อัปโหลดสลิปโอนเงิน (`POST /api/leads/payment-slip`) และ endpoint ติดตามสถานะงาน (`GET /api/public/track`) ทำให้ลูกค้าที่ถือลิงก์เก่าเกิน 45 วันยังสามารถโอนเงินแนบสลิปเข้ามาได้ ซึ่งกระทบความถูกต้องทางการเงินโดยตรง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/routes/leads.ts:
     - ใน POST /leads/payment-slip (บรรทัด ~830):
       - หลังดึงข้อมูล lead จากฐานข้อมูลสำเร็จ ให้ตรวจสอบอายุของเอกสารด้วยฟังก์ชัน isPublicQuoteTokenExpired(lead.createdAt)
       - หากเกิน 45 วัน ให้บันทึก Audit log: { action: "slip.upload", status: "warning", errorCode: "QUOTE_EXPIRED", targetId: access.quoteNumber, details: { reason: "payment slip rejected because quote link expired (>45 days)" } }
       - และปฏิเสธการอัปโหลดทันทีด้วย HTTP 410 (Gone) พร้อม payload:
         { "error": PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR, "message": PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE }
         (ห้ามดำเนินการบันทึกไฟล์สลิปหรือเรียก verifySlip เมื่อลิงก์หมดอายุแล้ว)
     - ใน GET /public/track (บรรทัด ~635):
       - หลังดึงข้อมูล lead จากฐานข้อมูลสำเร็จ ให้ตรวจสอบอายุด้วย isPublicQuoteTokenExpired(lead.createdAt)
       - หากเกิน 45 วัน ให้ปฏิเสธด้วย HTTP 410 (Gone) พร้อม payload:
         { "error": PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR, "message": PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE }
  2. ใน artifacts/knight-basins/src/App.tsx:
     - ใน PaymentSlipUpload คอมโพเนนต์: หากการอัปโหลดสลิปตอบกลับมาเป็น error code "quote_expired" หรือ HTTP 410 ให้แสดงข้อความแจ้งเตือนสีแดงชัดเจนว่า:
       "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) ไม่สามารถแนบสลิปได้ กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่"
  3. ชุดทดสอบ:
     - artifacts/api-server/test/quote-token-expiry.test.ts:
       - เพิ่มเทสต์เคสทดสอบ POST /leads/payment-slip ด้วย lead อายุ 10 วัน -> ผ่าน (หรือเข้าสู่กระบวนการตรวจสลิปปกติ)
       - เพิ่มเทสต์เคสทดสอบ POST /leads/payment-slip ด้วย lead อายุ 46 วัน -> ต้องถูกปฏิเสธด้วย HTTP 410 quote_expired ทันที และมี audit log บันทึก
       - เพิ่มเทสต์เคสทดสอบ GET /public/track ด้วย lead อายุ 46 วัน -> ต้องถูกปฏิเสธด้วย HTTP 410 quote_expired
     - artifacts/knight-basins/test/quote-security-and-expiry.test.ts:
       - ทดสอบ UI ของ PaymentSlipUpload เมื่อเจอสถานะ quote_expired แสดงข้อความแจ้งเตือนถูกต้อง

SCOPE:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-token-expiry.test.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-security-and-expiry.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามเปลี่ยนระยะเวลาอายุลิงก์ (ต้องเป็น 45 วัน หรือ PUBLIC_QUOTE_TOKEN_TTL_MS เท่าเดิม)
  - ห้ามเปลี่ยนจำนวนวันยืนราคาในเอกสาร (30 วันเท่าเดิมตามคำสั่งบอส)
  - ห้ามแตะ StudioPage.tsx หรือโมเดลคำนวณราคาใดๆ ทั้งสิ้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง fix/chai-quote-expiry-slip-and-track ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/quote-token-expiry.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/quote-security-and-expiry.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/api-server (baseline: 815 ผ่าน / 0 ตก)
  7) npm test ใน artifacts/knight-basins (non-browser suite baseline: 882 ผ่าน / 0 ตก / 7 ข้าม)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-token-expiry.test.ts
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-security-and-expiry.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้งสองฝั่ง และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ปิดช่องโหว่ 45 วันในจุดสลิปและติดตามงาน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, ไม่แตะ StudioPage |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ปิดช่องโหว่ทางการเงินให้รัดกุม 100% |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | บันทึก Audit log เมื่อมีคนพยายามส่งสลิปเก่า |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 219 เรียบร้อย |
