# ใบงาน 140 (ชัย) — Financial Safety Lock API & ล็อกการลบงานที่มีสลิปการเงิน (Lead Financial Safety Lock)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Database & Financial Safety) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบกฎเหล็กทางการเงิน **ข้อ 10 และ 18 ในคู่มือ KRAKEN ERP**:
> *"ใบเสนอราคาที่มีรายการรับชำระแล้ว (หรือผูกกับสลิปโอนเงิน) จะถูกลบไม่ได้ (ระบบกันไว้) — เพื่อป้องกันการทำลายประวัติการเงินและป้องกันข้อผิดพลาดทางบัญชี"*

ปัจจุบันระบบ Knight Basins เริ่มมี endpoint สำหรับลบ Lead ในอนาคต หรือการยกเลิก/ล้างงาน แต่ยังไม่มี **Financial Safety Floor** ที่คอยสกัดกั้นการลบงานที่มีธุรกรรมการเงินผูกอยู่
งานนี้คือการสร้าง:
1. ฟังก์ชันตรวจสอบความปลอดภัยทางการเงิน: `checkLeadFinancialLock(leadId: number): Promise<{ isLocked: boolean; reason?: string; slipCount: number; totalAmountThb: number }>`
2. เพิ่มฟิลด์ `hasMatchedSlip: boolean` และ `paymentSlipCount: number` ในผลลัพธ์ของ `GET /api/admin/leads` เพื่อให้หน้าจอ Frontend (Task 141) นำไปแสดงป้ายล็อกและปิดปุ่มลบได้
3. สร้าง Endpoint ลบ Lead แบบมีระบบล็อกทางการเงิน:
   `DELETE /api/admin/leads/:id` (Guard: `requireAdminPermission("leads", "edit")`)
   - **กรณียังไม่มีสลิปผูกอยู่ (`slipCount === 0`):** อนุญาตให้ลบได้ (Soft delete หรือ ลบแถวอย่างปลอดภัย)
   - **กรณีมีสลิปการเงินผูกอยู่ (`slipCount > 0`):** ปฏิเสธทันทีด้วย HTTP `403 Forbidden` หรือ `409 Conflict` พร้อมข้อความไทยชัดเจน:
     `"ไม่สามารถลบงานนี้ได้เนื่องจากมีสลิปโอนเงินผูกอยู่จำนวน X ใบ (ยอดรวม X บาท) ตามกฎความปลอดภัยทางการเงิน"`

**ตารางที่เกี่ยวข้องในฐานข้อมูล:**
* ตาราง `payment_slips`: มีคอลัมน์ `lead_id` ที่ชี้ไปยัง `customer_leads.id`
* ตาราง `customer_leads`: ตารางหลักของงาน

**สิ่งที่ต้องทำ:**
1. ใน `artifacts/api-server/src/lib/financial-safety.ts` (ใหม่):
   * สร้างฟังก์ชัน `checkLeadFinancialLock(database, leadId: number)`
   * ตรวจสอบว่าในตาราง `payment_slips` มีรายการที่ `leadId === id` หรือไม่
   * คืนผลลัพธ์ `{ isLocked, reason, slipCount, totalAmountThb }`
2. ใน `artifacts/api-server/src/routes/admin-router.ts`:
   * ใน `GET /admin/leads`: เพิ่มฟิลด์ `hasMatchedSlip: boolean` และ `paymentSlipCount: number` ในข้อมูลของ Lead แต่ละแถว (คำนวณจากความสัมพันธ์กับ `payment_slips`)
   * เพิ่ม `DELETE /api/admin/leads/:id`:
     - เรียก `checkLeadFinancialLock()`
     - ถ้าติดล็อก → คืน `409 Conflict` พร้อมข้อความแจ้งเหตุผลและจำนวนเงิน
     - ถ้าไม่ติดล็อก → ลบ Lead ออกจากฐานข้อมูล และคืน `200` `{ success: true, deletedId: id }`
3. เขียน Unit Tests ใน `artifacts/api-server/test/financial-safety-lock.test.ts` (ใหม่):
   * ทดสอบ:
     - Lead ที่ไม่มีสลิป: `checkLeadFinancialLock` คืน `isLocked: false` และสามารถลบได้สำเร็จ
     - Lead ที่มีสลิปโอนเงินผูกอยู่: `checkLeadFinancialLock` คืน `isLocked: true`, ปฏิเสธการลบด้วย 409 Conflict
     - ข้อความปฏิเสธต้องระบุจำนวนสลิปและยอดเงินอย่างถูกต้อง
     - ตรวจสอบว่า `GET /admin/leads` ส่ง `hasMatchedSlip` กลับมาถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-financial-safety-lock แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง artifacts/api-server/src/lib/financial-safety.ts มี checkLeadFinancialLock()
  2. เพิ่ม DELETE /api/admin/leads/:id ที่บล็อกการลบเมื่อมีสลิปโอนเงินผูกอยู่ (คืน 409 Conflict)
  3. เพิ่มฟิลด์ hasMatchedSlip และ paymentSlipCount ใน GET /api/admin/leads
  4. เขียนเทสต์ใน artifacts/api-server/test/financial-safety-lock.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/financial-safety.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/financial-safety-lock.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามลบคอลัมน์หรือเปลี่ยนโครงสร้างเดิมของ payment_slips และ customer_leads
  - ห้ามแตะต้อง fabrication-geometry.ts, price-integrity.ts หรือระบบราคา
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-financial-safety-lock

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/financial-safety-lock.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 3 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-financial-safety-lock (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

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
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎความปลอดภัยการเงิน (Financial Safety Lock) | ✅ ผ่าน |
| 11 | อนุรักษ์ระบบราคาและโมเดลเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
