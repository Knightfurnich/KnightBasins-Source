# ใบงาน 164 (Replit) — กล่องชำระเงินมัดจำ PromptPay QR Code พร้อมอัปโหลดสลิปบน 2D Studio และหน้าใบเสนอราคา (Studio PromptPay QR Checkout Modal UI)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) ร่วมกับคุณนพ (บอส)
**สถานะ:** มอบหมายให้ Replit (Frontend / Studio PromptPay Checkout UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อเปลี่ยน 2D Studio และหน้าใบเสนอราคา (`/quote/view`) ให้ลูกค้าสามารถ "กดจ่ายมัดจำจบในตัว" ได้ทันที ไม่ต้องรอฝ่ายขายทักมาส่งเลขบัญชี:
1. **เพิ่มปุ่มชำระเงินมัดจำใน 2D Studio (`StudioPage.tsx`):**
   * บนแถบ Action สรุปราคาของ Studio:
     - เพิ่มปุ่มเด่นชัด: `[ 💳 ชำระเงินมัดจำ / ยืนยันการสั่งผลิต ]` (`data-testid="button-open-promptpay-checkout"`)
2. **หน้าต่างป๊อปอัปชำระเงิน (`StudioCheckoutModal.tsx` ใหม่):**
   * หัวข้อ: *"ชำระเงินมัดจำเพื่อเริ่มสั่งตัดหินทันที"* (`data-testid="modal-studio-checkout"`)
   * ตัวเลือกประเภทการชำระ:
     - `[ 🟢 ชำระมัดจำ 50% ]` (ค่าเริ่มต้น — แนะนำ)
     - `[ ชำระมัดจำ 30% ]`
     - `[ ชำระเต็มจำนวน 100% ]`
   * แสดงตัวเลขยอดเงินชัดเจน:
     - ยอดเงินมัดจำที่ต้องชำระทันที (บาท)
     - ยอดคงเหลือที่ชำระวันติดตั้งหน้างาน (บาท)
   * แสดง **PromptPay QR Code** พร้อมรูปภาพและโลโก้ PromptPay:
     - มีปุ่ม `[ 📥 บันทึกรูป QR ลงมือถือ ]`
     - แสดงชื่อบัญชี: *บริษัท ไนท์ เฟอร์นิช จำกัด*
     - เลขที่บัญชี: *ธ.กรุงศรีอยุธยา 574-1-18925-4*
   * **กล่องอัปโหลดสลิปโอนเงิน (Slip Upload Box):**
     - ช่องอัปโหลดรูปภาพสลิป (`data-testid="input-checkout-slip"`)
     - ปุ่มกดส่งสลิป: `[ 🚀 ยืนยันการชำระเงิน ]` (`data-testid="button-submit-checkout-slip"`)
     - เรียก `POST /api/leads/payment-slip` (ส่ง multipart fields: file, token, kind="deposit") ที่มีอยู่แล้วในระบบจริง
   * **สถานะความสำเร็จ (Real-time Success State):**
     - เมื่อสลิปผ่านการตรวจสอบ (verified):
       * แสดงอนิเมชั่นติ๊กถูกสีเขียวขนาดใหญ่
       * ข้อความ: *"ชำระเงินมัดจำเรียบร้อยแล้ว! รหัสงานของคุณคือ ... ระบบกำลังเปิดคิวผลิตอัตโนมัติ"*
       * มีปุ่ม `[ 📱 ติดตามสถานะงานของคุณ (/track) ]` นำทางไปยังพอร์ทัลติดตามสถานะงาน
3. **เขียน Static Source Tests ใน `test/studio-checkout-modal.test.ts` (ใหม่):**
   * ตรวจสอบองค์ประกอบสำคัญใน `StudioCheckoutModal.tsx`
   * ตรวจสอบปุ่ม `button-open-promptpay-checkout` ด้วย Static Source Inspection

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด & คุณนพ

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้างคอมโพเนนต์ artifacts/knight-basins/src/components/StudioCheckoutModal.tsx:
     - modal-studio-checkout, button-open-promptpay-checkout, input-checkout-slip, button-submit-checkout-slip
     - รองรับตัวเลือกมัดจำ 50%, 30%, เต็มจำนวน และแสดง QR PromptPay ฝังยอดเงิน
     - เชื่อมต่อการอัปโหลดสลิปเข้า POST /api/leads/payment-slip (multipart: file, token, kind="deposit")
  2. เพิ่มปุ่มใน StudioPage.tsx: button-open-promptpay-checkout
  3. เขียนเทสต์ใน artifacts/knight-basins/test/studio-checkout-modal.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/components/StudioCheckoutModal.tsx
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-checkout-modal.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css, App.tsx
  - ห้ามแตะ backend หรือ artifacts/api-server/
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-checkout แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: non-browser tests ต้องผ่าน 100% (581+ ผ่าน)
  4) เทสต์ใน test/studio-checkout-modal.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-studio-checkout (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์โครงสร้างระบบ Studio เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
