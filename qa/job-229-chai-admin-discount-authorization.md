# ใบงาน 229 (Admin Discount Authorization & Staff Price Override) — ระบบตรวจสอบสิทธิ์พนักงานในการให้ส่วนลดและบันทึกใบเสนอราคา

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจระบบสิทธิ์การค้าและส่วนลดเจ้าหน้าที่ (Admin Authorization)
**Branch:** `feat/chai-admin-discount-authorization`
**ที่มา:** บอสได้มีคำตัดสินทางเลือก B: "อนุญาตให้พนักงาน/เซลส์สามารถใส่ส่วนลดพิเศษให้ลูกค้าได้ โดยต้องผ่านการตรวจสอบสิทธิ์แอดมิน (Admin Authentication)" ปัจจุบันฝั่งเซิร์ฟเวอร์ใน `price-integrity.ts` บังคับ `discountTHB = 0` ทุกกรณี ทำให้เมื่อเจ้าหน้าที่แก้ไขใบเสนอราคาผ่านระบบหลังบ้าน ส่วนลดจะไม่ถูกบันทึกและไม่สามารถออก PromptPay QR ได้ ดังนั้นจึงต้องพัฒนาระบบตรวจสอบสิทธิ์ เพื่อให้เจ้าหน้าที่ที่มีสิทธิ์สามารถใส่ส่วนลด (approved discount) ได้อย่างปลอดภัย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/lib/price-integrity.ts:
     - ปรับปรุงฟังก์ชัน canonicalStudioState:
       - ให้รับพารามิเตอร์เพิ่มเติม: staffDiscountTHB?: number | null
       - หากมี staffDiscountTHB ที่ผ่านการรับรองสิทธิ์ของแอดมิน (staffDiscountTHB > 0):
         - ให้นำส่วนลดนี้มาคำนวณหักลบใน canonicalStudioState เพื่อหายอดแท้จริงหลังหักส่วนลดของเจ้าหน้าที่
       - สำหรับลูกค้าสาธารณะทั่วไป (ไม่มี staff session): ยังคงบังคับ discountTHB = 0 เสมอตามเดิม 100%
  2. ใน artifacts/api-server/src/routes/admin-router.ts (PATCH /admin/leads/:id):
     - เมื่อเจ้าหน้าที่แอดมินแก้ไขแบบในโหมด isLeadLinkedMode และมีการส่ง studioData.state.discountTHB เข้ามา:
       - ระบบต้องตรวจสอบสิทธิ์ requireAdminPermission("leads", "edit")
       - บันทึก staffDiscountTHB เข้าสู่ฐานข้อมูล customerLeads.studioData พร้อมระบุ actorType="staff", staffEmail
       - บันทึก System Audit Log: action="lead.discount_applied", details: { discountTHB, previousTotal, newTotal }
  3. ใน artifacts/api-server/src/routes/leads.ts (POST /public/quotes/promptpay-qr):
     - ในการคำนวณราคาซ้ำก่อนออก PromptPay QR Code:
       - หากใบเสนอราคานั้นมี staffDiscountTHB ที่บันทึกโดยเจ้าหน้าที่แอดมิน ให้ยอมรับยอดส่วนลดนั้นในการออก QR Code ได้อย่างถูกต้อง
  4. ชุดทดสอบ:
     - artifacts/api-server/test/admin-discount-authorization.test.ts:
       - ทดสอบกรณีลูกค้าทั่วไปยิงขอราคาพร้อม discountTHB -> ถูกเซิร์ฟเวอร์ตัดเป็น 0 เสมอ
       - ทดสอบกรณีเจ้าหน้าที่แอดมินล็อกอินแล้วส่ง PATCH /admin/leads/:id พร้อม discountTHB -> ยอมรับส่วนลด และบันทึกยอดใหม่อย่างถูกต้อง
       - ทดสอบกรณีลูกค้าเปิดใบเสนอราคาที่แอดมินให้ส่วนลดแล้ว -> สามารถออก Dynamic PromptPay QR Code ตามยอดเงินสุทธิหลังหักส่วนลดได้สำเร็จ
       - ทดสอบว่ามีการบันทึก Audit Log ชัดเจนว่าใครเป็นผู้ให้ส่วนลด

SCOPE:
  - artifacts/api-server/src/lib/price-integrity.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/admin-discount-authorization.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามให้ลูกค้าสาธารณะ (Unauthenticated) ตั้งส่วนลดเองได้เด็ดขาด (ลูกค้าทั่วไปต้องเป็น 0 เสมอ)
  - ห้ามกระทบลูกค้าทั่วไปที่ไม่มีส่วนลด (ต้องคำนวณและออก QR ได้ตามปกติ)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-admin-discount-authorization ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/admin-discount-authorization.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 905 ผ่าน / 3 ตก Windows path / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/price-integrity.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/admin-discount-authorization.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ admin-discount-authorization ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบบตรวจสอบสิทธิ์แอดมินในการให้ส่วนลด |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ลูกค้าทั่วไปห้ามตั้งส่วนลด, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 905 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำตามคำตัดสินทางเลือก B ของบอส |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้ requireAdminPermission ตรวจสอบสิทธิ์ |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 229 เรียบร้อย |
