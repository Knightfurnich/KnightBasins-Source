# ใบงาน 213 (Security & UX) — ซ่อนใบสั่งผลิตช่างจากหน้าสาธารณะ + อายุลิงก์ใบเสนอราคา 45 วัน

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) / Replit · ได้รับอนุมัติจากบอสโดยตรงแล้ว
**Branch:** `feat/quote-view-security-and-token-expiry`
**ที่มา:** Replit และเดวิดตรวจพบช่องโหว่ความปลอดภัยว่าหน้า `/quote/view` สาธารณะมีปุ่ม "พิมพ์ใบสั่งผลิตช่าง" และแท็บสลับดูใบสั่งผลิตโรงงาน ซึ่งเป็นข้อมูลภายใน และลิงก์ไม่มีวันหมดอายุจริงใน API บอสสั่งให้ออกใบงานแก้ไขทันที โดยกำหนดอายุลิงก์เป็น 45 วัน แต่คงการกำหนดยืนราคาในเอกสารไว้ 30 วันเท่าเดิม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/App.tsx ในคอมโพเนนต์ SavedQuotePage:
     - นำปุ่ม "พิมพ์ใบสั่งผลิตช่าง" (data-testid="button-print-saved-workshop") ออกจากหน้าลูกค้า
     - นำแท็บสลับดูใบสั่งผลิตช่าง (data-testid="button-saved-sheet-mode-workshop" และคอนเทนเนอร์ quote-sheet-type-switch) ออกจากหน้าลูกค้า ให้แสดงเฉพาะใบเสนอราคา FormalQuote เท่านั้น
     - ข้อมูลใบสั่งผลิตช่าง WorkshopProductionSheet ให้ดูและพิมพ์ได้เฉพาะผ่านระบบหลังบ้าน /admin/leads เท่านั้น
     - ข้อความยืนราคาในเอกสาร "ใช้ได้ถึง ... 30 วัน" ยังคงเป็น 30 วันเท่าเดิม ห้ามแก้
     - หาก API ตอบสถานะว่าลิงก์หมดอายุ (HTTP 410 หรือ error code "quote_expired") ให้แสดงหน้าแจ้งเตือนสุภาพว่า "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) กรุณาติดต่อทีมขายเพื่อขอรับลิงก์หรือประเมินราคาใหม่" พร้อมปุ่มติดต่อทีมขาย
  2. ใน artifacts/api-server/src/routes/leads.ts และ artifacts/api-server/src/lib/quote-access.ts:
     - ตรวจสอบอายุของเอกสารใน GET /api/quotes โดยเทียบ createdAt ของ lead กับเวลาปัจจุบัน:
       const PUBLIC_QUOTE_TOKEN_TTL_MS = 45 * 24 * 60 * 60 * 1000; // 45 วัน
     - หาก Date.now() - new Date(lead.createdAt).getTime() > PUBLIC_QUOTE_TOKEN_TTL_MS ให้ตอบ HTTP 410 พร้อม payload:
       { "error": "quote_expired", "message": "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่" }
     - ใน POST /public/quotes/promptpay-qr และ POST /api/quotes/notify หากโทเค็นมีอายุเกิน 45 วัน ให้ปฏิเสธด้วย HTTP 410 เช่นกัน
  3. เพิ่มเทสต์อัตโนมัติ:
     - artifacts/knight-basins/test/quote-security-and-expiry.test.ts: ยืนยันว่าหน้า SavedQuotePage ไม่มีปุ่ม/แท็บใบสั่งผลิตช่าง และข้อความยืนราคายังคงเป็น 30 วัน
     - artifacts/api-server/test/quote-token-expiry.test.ts: ทดสอบว่า lead อายุ 10 วัน, 44 วัน ตอบ 200 ปกติ ส่วน lead อายุ 46 วัน ตอบ 410 quote_expired

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-security-and-expiry.test.ts
  - artifacts/api-server/src/lib/quote-access.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-token-expiry.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามเปลี่ยนจำนวนวันยืนราคาในเอกสารใบเสนอราคา (ต้องคงไว้ 30 วันเท่าเดิมตามคำสั่งบอส สิ่งที่เปลี่ยนเป็น 45 วันคืออายุลิงก์เข้าดูข้อมูลเท่านั้น)
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx นอกเหนือจากการซ่อนไม่ให้แสดงใน SavedQuotePage
  - ห้ามแตะต้องสูตรราคา หรือ endpoint อื่นที่ไม่เกี่ยวข้อง
  - ทำงานผ่าน branch: feat/quote-view-security-and-token-expiry แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/quote-view-security-and-token-expiry ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  4) node --test test/quote-security-and-expiry.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/quote-token-expiry.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/knight-basins (non-browser suite baseline: 760 ผ่าน / 0 ตก / 7 ข้าม)
  7) npm test ใน artifacts/api-server (baseline: 782 ผ่าน / 0 ตก)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-security-and-expiry.test.ts
  - artifacts/api-server/src/lib/quote-access.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-token-expiry.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้งสองโปรเจกต์ และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ซ่อนใบสั่งผลิต + ลิงก์หมดอายุ 45 วัน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 5 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามแก้ 30 วันในเอกสาร |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) หรือ Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ยืนราคา 30 วันเท่าเดิม อายุลิงก์ 45 วัน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ซ่อนเอกสารภายในโรงงานจากลูกค้า |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 213 เรียบร้อย |
