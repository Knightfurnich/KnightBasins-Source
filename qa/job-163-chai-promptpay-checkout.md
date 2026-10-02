# ใบงาน 163 (ชัย & บอส) — ระบบสร้าง PromptPay QR ฝังยอดมัดจำ และปรับสถานะ Lead เป็น Confirmed อัตโนมัติเมื่อ SlipOK ตรวจผ่าน (Studio Direct Payment API & SlipOK Auto-Close)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) ร่วมกับคุณนพ (บอส)
**สถานะ:** มอบหมายให้ ชัย / บอส (Backend API / PromptPay & SlipOK Automation) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อเปลี่ยนระบบ 2D Studio และหน้าใบเสนอราคาจากการ "รอพนักงานส่งเลขบัญชี" ให้กลายเป็น "ระบบชำระเงินปิดการขายอัตโนมัติ (Automated Checkout)":
1. **ระบบสร้าง PromptPay QR ฝังยอดเงิน (Dynamic PromptPay QR):**
   * สร้าง Helper ใน `artifacts/api-server/src/lib/promptpay.ts` (ใหม่):
     - คำนวณ CRC16 และสร้าง PromptPay Payload มาตรฐาน EMVCo (รองรับทั้งเลขประจำตัวผู้เสียภาษี 13 หลัก `0135553014114` หรือเบอร์โทรศัพท์/เลขบัญชีบริษัท ไนท์ เฟอร์นิช จำกัด)
     - สามารถสร้าง SVG หรือ Data URL ของ QR Code สำหรับยอดเงินที่ระบุ (มัดจำ 50% หรือ 30% หรือยอดเต็ม)
   * เพิ่ม Endpoint: `POST /api/public/quotes/promptpay-qr` (Public Endpoint):
     - รับ Body: `{ token: string, paymentType?: "deposit_50" | "deposit_30" | "full" }`
     - ถอดรหัส token เพื่ออ่าน Lead และยอดเงินสุทธิจาก `lead.studioData`
     - คำนวณยอดเงินตามประเภทการชำระ:
       * `deposit_50`: 50% ของยอดรวมสุทธิ (ปัดเศษจำนวนเต็ม)
       * `deposit_30`: 30% ของยอดรวมสุทธิ
       * `full`: 100% ของยอดรวมสุทธิ
     - คืนค่า JSON: `{ qrPayload: string, amountThb: number, paymentType: string, companyAccount: { bankName, bankAccountName, bankAccountNumber, taxId } }`
2. **ระบบ SlipOK Auto-Confirm ปิดการขายอัตโนมัติ (ใน `artifacts/api-server/src/routes/leads.ts`):**
   * ในเส้นทาง `POST /leads/slips` (บรรทัด 654-680):
     - เมื่อ `result.ok === true` (SlipOK ตรวจสอบสลิปผ่าน 100%):
       * ตรวจสอบว่ายอดเงินที่สลิปโอนจริง (`result.amount`) สอดคล้องกับยอดมัดจำหรือยอดเต็ม (ไม่น้อยกว่ายอดที่กำหนด)
       * ปรับสถานะของ Lead จาก `"new"` หรือ `"quoted"` ให้กลายเป็น **`"confirmed"`** โดยอัตโนมัติทันที!
       * บันทึกหมายเหตุใน Lead: `[ระบบอัตโนมัติ]: ชำระเงินมัดจำเรียบร้อยแล้วผ่าน SlipOK (ยอด ${result.amount} บาท)`
       * ส่งแจ้งเตือนเข้า Telegram กลุ่ม KnightTeam พร้อมป้าย **`✅ [ชำระเงินมัดจำสำเร็จ - เริ่มเปิดคิวผลิตอัตโนมัติ]`**
3. **เขียน Unit Tests ใน `artifacts/api-server/test/promptpay-slipok-checkout.test.ts` (ใหม่):**
   * ทดสอบการสร้าง PromptPay payload ด้วยยอดเงินจริง
   * ทดสอบ Endpoint `/api/public/quotes/promptpay-qr`
   * ทดสอบ SlipOK ตรวจสอบผ่านแล้วอัปเดตสถานะ Lead เป็น `"confirmed"` อัตโนมัติ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด & คุณนพ

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-promptpay-checkout แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง artifacts/api-server/src/lib/promptpay.ts คำนวณ PromptPay QR ฝังยอดมัดจำ
  2. เพิ่ม POST /api/public/quotes/promptpay-qr สร้าง QR รับเงินมัดจำ
  3. ปรับ POST /leads/slips เมื่อ SlipOK ตรวจผ่าน (result.ok) ให้อัปเดตสถานะ Lead เป็น "confirmed" อัตโนมัติ
  4. เขียนเทสต์ใน artifacts/api-server/test/promptpay-slipok-checkout.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/promptpay.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/promptpay-slipok-checkout.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามลบคอลัมน์หรือแก้ตารางฐานข้อมูล customer_leads
  - ห้ามเปลี่ยนสถานะเป็น confirmed ถ้า SlipOK ตรวจไม่ผ่าน (result.ok === false)
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-promptpay-checkout

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/promptpay-slipok-checkout.test.ts -> ผ่าน 100% (baseline 4/4 ผ่าน)
  3) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE เท่านั้น

OUTPUT:
  - branch: feat/chai-promptpay-checkout (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 3 ข้อ

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
| 8 | มีข้อบังคับสาขาสำหรับผู้ทำ | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์เงื่อนไขความปลอดภัยทางการเงิน | ✅ ผ่าน |
| 11 | รองรับระบบ SlipOK Auto-Confirm แม่นยำ 100% | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
