# ใบงาน 226 (Financial Security & Server Price Guard) — บังคับคำนวณราคาจริงบนเซิร์ฟเวอร์ ไม่อนุญาตส่วนลดจากลูกค้า และครอบคลุมทุกโหมดการสั่งซื้อ

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจความปลอดภัยทางการเงินสูงสุด (ปรับปรุงขยายขอบเขตตามคำสั่งบอส)
**Branch:** `feat/chai-server-price-guard-promptpay`
**ที่มา:** บอสตัดสินเห็นชอบข้อเสนอของชัยและเดวิดครบทั้ง 3 ข้อ: (1) ลูกค้าทั่วไปไม่มีสิทธิ์กำหนดส่วนลด (discountTHB) หรือราคาขอบเปิดเองบนเซิร์ฟเวอร์ ให้คิดเป็น 0 และราคามาตรฐานเสมอ (2) ขยายการตรวจให้ครอบคลุมทั้งโหมด `studio` และ `quick-purchase` (3) ตรวจสอบความถูกต้องของราคาตั้งแต่ต้นทางตอนสร้างคำขอ (`POST /api/leads`) ต่อเนื่องไปจนถึงการออก Dynamic PromptPay QR (`POST /public/quotes/promptpay-qr`)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. การคำนวณราคาจริงบนเซิร์ฟเวอร์ (Server-side Canonical Recalculation):
     - ใน artifacts/api-server/src/lib/price-integrity.ts:
       - นำเข้าฟังก์ชันคำนวณราคาบริสุทธิ์จาก studio-model.ts (เช่น studioEstimate)
       - สร้างฟังก์ชัน verifyAndRecalculateQuoteTotal(orderMode: string, payload: unknown): Promise<{ calculatedTotal: number | null; isTampered: boolean; reason?: string }>
         - กฎเหล็กส่วนลด (บอสสั่ง): สำหรับลูกค้าสาธารณะ ให้บังคับ discountTHB = 0 เสมอ และราคาขอบเปิด (openEdgePricePerMTHB) ต้องไม่ถูกดัดแปลง (ใช้ค่าเริ่มต้น 0 หรือค่ามาตรฐานของระบบ)
         - สำหรับโหมด "studio": คำนวณยอดเงินรวมแท้จริงจากชิ้นงาน (ขนาด กว้าง×ยาว), สีหินจาก DB, รุ่นอ่างจาก DB, ค่าแรงติดตั้ง, ค่างานเล็ก, และ VAT 7%
         - สำหรับโหมด "quick-purchase": คำนวณราคาจากจำนวนสินค้า × ราคาจริงในแคตตาล็อก
         - ตรวจสอบยอดเงินที่ส่งมาจากหน้าบ้าน (total / estimate.totalTHB / notification.total) เทียบกับ calculatedTotal:
           - หากยอดต่างกันเกิน 1 บาท ให้ตั้ง isTampered = true
  2. การบังคับใช้ในระบบ API (Enforcement Points):
     - ใน artifacts/api-server/src/routes/leads.ts:
       - จุดที่ 1 (POST /api/leads): ตรวจสอบความถูกต้องของราคา หากพบว่าราคาถูกดัดแปลง (isTampered = true) ให้บันทึก Audit log เตือนภัย quote.price_tamper_detected และบันทึกยอดที่คำนวณจริงลงในฐานข้อมูล (ห้ามใช้ยอดปลอมที่ลูกค้าส่งมา) หรือปฏิเสธคำขอ
       - จุดที่ 2 (POST /public/quotes/promptpay-qr): ตรวจสอบซ้ำก่อนสร้าง PromptPay QR หากพบราคาไม่ตรง หรือถูกตั้งส่วนลดเอง ให้ปฏิเสธ HTTP 400 ด้วย {"error": "PRICE_VERIFICATION_FAILED", "message": "ยอดเงินไม่ตรงกับราคาที่คำนวณจริงจากระบบ กรุณาติดต่อเจ้าหน้าที่"} และห้ามส่งคืน QR Payload เด็ดขาด
  3. ชุดทดสอบ:
     - artifacts/api-server/test/server-price-guard-promptpay.test.ts:
       - ทดสอบกรณีส่งราคาตรงกับที่คำนวณจริง -> ผ่าน 100% ออก QR Code ได้ปกติ
       - ทดสอบกรณีลูกค้าแอบกรอก discountTHB ในหน้า Studio -> เซิร์ฟเวอร์ไม่ยอมรับส่วนลด คิดเป็น 0 เสมอ
       - ทดสอบกรณีแกล้งแก้ total ให้ต่ำกว่าจริง (เช่น 25,000 แก้เป็น 100 บาท) -> ถูกสกัดกั้น 400 PRICE_VERIFICATION_FAILED
       - ทดสอบครอบคลุมทั้งโหมด studio และ quick-purchase
       - ทดสอบการบันทึก Audit Log เตือนภัยเมื่อพบการดัดแปลงราคา

SCOPE:
  - artifacts/api-server/src/lib/price-integrity.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/server-price-guard-promptpay.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามยอมรับ discountTHB ที่ส่งมาจากลูกค้าสาธารณะโดยเด็ดขาด (ถือเป็น 0 เสมอ)
  - ห้ามกระทบลูกค้าทั่วไปที่คำนวณราคาตามสูตรปกติ (ลูกค้าปกติที่ไม่ได้ดัดแปลงยอดต้องผ่านและออก QR ได้ราบรื่น 100%)
  - ห้ามฮาร์ดโค้ดราคา ให้ดึงราคาหินและอ่างจาก DB หรือโมเดลมาตรฐานของระบบ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-server-price-guard-promptpay ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/server-price-guard-promptpay.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 858 ผ่าน / 3 ตก Windows path / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/price-integrity.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/server-price-guard-promptpay.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ server-price-guard ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Server price guard ครอบคลุม studio, quick-purchase และตัดสิทธิ์ส่วนลด |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามยอมรับส่วนลดลูกค้า, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 858 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ปิดช่องโหว่ความปลอดภัยทางการเงินครบ 3 ข้อตามที่บอสตัดสิน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบสิทธิ์และ audit log ครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ปรับปรุง KANBAN Task 226 เรียบร้อย |
