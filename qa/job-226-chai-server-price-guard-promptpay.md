# ใบงาน 226 (Financial Security & Server Price Guard) — บังคับคำนวณราคาจริงบนเซิร์ฟเวอร์ก่อนออก Dynamic PromptPay QR

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจความปลอดภัยทางการเงิน (Quick-Fix Sprint)
**Branch:** `feat/chai-server-price-guard-promptpay`
**ที่มา:** จากการตรวจสอบร่วมกันระหว่างชัย, Replit และเดวิด พบช่องโหว่ความเสี่ยงสูงด้านการเงิน: ปัจจุบันเส้นทาง `POST /public/quotes/promptpay-qr` นำค่า `lead.studioData.totalPrice` (ซึ่งส่งมาจากเบราว์เซอร์ของลูกค้า) ไปสร้าง PromptPay QR Code โดยเซิร์ฟเวอร์เช็คเพียงว่าเป็นตัวเลข 0–50 ล้านบาทเท่านั้น ยังไม่มีการคำนวณราคาใหม่จากแคตตาล็อกจริงบนเซิร์ฟเวอร์ ทำให้ผู้โจมตีอาจดัดแปลงยอดเงินก่อนส่งขอราคา แล้วได้ QR Code ยอดเงินต่ำกว่าราคาจริงไปสแกนจ่าย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/lib/price-integrity.ts:
     - เพิ่มฟังก์ชัน recalculateServerQuoteTotal(lead: Pick<CustomerLead, "orderMode" | "studioData">): Promise<{ calculatedTotal: number | null; isTampered: boolean }>
       - ดึงรายการราคาจริงจากฐานข้อมูล (installedStonePrices / sheetStonePrices / basinPrices) มาคำนวณยอดรวมที่แท้จริงตามขนาดและวัสดุ
       - หากยอดที่ส่งมาจากลูกค้า studioData.totalPrice แตกต่างจากยอดที่คำนวณได้จริงเกินเกณฑ์ความคลาดเคลื่อน (Tolerance > 1 บาท):
         - ให้ตั้งค่า isTampered = true
         - บันทึก System Audit Log: action="quote.price_tamper_detected", status="warning"
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - ในเส้นทาง POST /public/quotes/promptpay-qr:
       - ก่อนสร้าง QR Code ให้ตรวจสอบความถูกต้องของราคากับฟังก์ชันฝั่งเซิร์ฟเวอร์
       - หากตรวจพบ isTampered = true หรือยอดเงินไม่ถูกต้อง:
         - ปฏิเสธ HTTP 400 Bad Request ด้วยรหัส {"error": "PRICE_VERIFICATION_FAILED", "message": "ยอดเงินไม่ตรงกับราคาที่คำนวณจริงจากระบบ กรุณาติดต่อเจ้าหน้าที่"}
         - ห้ามสร้างและห้ามส่งคืน PromptPay QR Payload เด็ดขาด
  3. ชุดทดสอบ:
     - artifacts/api-server/test/server-price-guard-promptpay.test.ts:
       - ทดสอบกรณีส่งยอดตรงกับราคาคำนวณจริง -> สามารถออก QR Code ได้ตามปกติ
       - ทดสอบกรณีส่ง studioData ที่แกล้งแก้ totalPrice ให้ต่ำกว่าจริง (เช่น สินค้า 25,000 แก้เป็น 100 บาท) -> ถูกปฏิเสธ 400 PRICE_VERIFICATION_FAILED และไม่มี QR Payload หลุดออกมา
       - ทดสอบว่ามีการบันทึก Audit log เมื่อตรวจพบราคาไม่ตรง

SCOPE:
  - artifacts/api-server/src/lib/price-integrity.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/server-price-guard-promptpay.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามกระทบลูกค้าที่ใช้งานและคำนวณราคาตามปกติ (ลูกค้าปกติที่ไม่ได้แก้ payload ต้องออก QR ได้ 100%)
  - ห้ามฮาร์ดโค้ดราคาในโค้ด ต้องอ้างอิงจากฐานข้อมูลหรือโมเดลราคามาตรฐานของระบบ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-server-price-guard-promptpay ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/server-price-guard-promptpay.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 831 ผ่าน / 0 ตก / 0 ข้าม)
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
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Server price guard ก่อนออก PromptPay QR |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ลูกค้าปกติไม่กระทบ, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 831 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ปิดช่องโหว่ความเสี่ยงสูงด้านการเงิน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบสิทธิ์และ audit log ครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 226 เรียบร้อย |
