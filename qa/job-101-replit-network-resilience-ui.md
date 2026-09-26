# ใบงาน 101 (Replit) — จัดการข้อผิดพลาดและสถานะการเชื่อมต่อเครือข่ายของแอปพลิเคชัน (Network Offline & Error Boundary Resilience)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend UX & Network Resilience) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อยกระดับความทนทานของแอปพลิเคชัน (Frontend Chaos & Network Resilience) เมื่อลูกค้าหรือทีมงานใช้งานผ่านมือถือในจุดที่สัญญาณอินเทอร์เน็ตไม่เสถียร (เช่น หน้างานก่อสร้าง หรือในโกดังโรงงาน):

1. **การแจ้งเตือนสถานะออฟไลน์ / เน็ตหลุด (Network Offline Banner):**
   * ในหน้าหลักของระบบ (`App.tsx` หรือคอมโพเนนต์หลัก) เพิ่มตัวตรวจจับสถานะ `navigator.onLine`
   * เมื่อสัญญาณเน็ตขาดหาย: ให้แสดงแถบเตือนสีเหลือง/ส้มด้านบนอย่างสุภาพ: `"⚠️ สัญญาณอินเทอร์เน็ตขาดหาย กรุณาตรวจสอบการเชื่อมต่อ ข้อมูลร่างใน Studio จะยังคงบันทึกไว้ในเครื่อง"`
   * เมื่อสัญญาณกลับมา: สลับเป็นแถบสีเขียว `"เชื่อมต่ออินเทอร์เน็ตเรียบร้อยแล้ว"` สั้นๆ 3 วินาทีแล้วจางหายไป
2. **การป้องกันหน้าขาวเมื่อ API มีปัญหา (Graceful Error Fallback):**
   * ตรวจสอบให้มั่นใจว่าเมื่อมีข้อผิดพลาดที่ไม่คาดคิดในระดับ Component จะมี Error Boundary ดักจับและแสดงปุ่ม `[ 🔄 โหลดหน้านี้ใหม่ ]` หรือ `[ 🏠 กลับสู่หน้าหลัก ]` พร้อมแสดงเบอร์ติดต่อทีมงาน (094-496-1949) โดยไม่ปล่อยให้เกิดหน้าขาว (White Screen of Death)
3. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/network-resilience-ui.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/App.tsx:
     - เพิ่ม Network Offline Banner แจ้งเตือนเมื่อสัญญาณเน็ตหลุด พร้อมยืนยันว่าข้อมูลร่างไม่สูญหาย
     - ตรวจสอบ Error Boundary ให้แสดงข้อความภาษาไทยที่สุภาพและช่องทางติดต่อทีมงาน
  2. สร้าง artifacts/knight-basins/test/network-resilience-ui.test.ts (ใหม่):
     - ทดสอบการแสดงผล Offline Banner เมื่อ offline event ทำงาน
     - ทดสอบ Error Boundary fallback เมื่อเกิด exception ในระดับ UI

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/network-resilience-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง Formal Quotation Layout หรือ CSS สำหรับพิมพ์ใบเสนอราคาเดิมใน App.tsx เด็ดขาด
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-network-resilience-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 420 / pass 420 / fail 20 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/network-resilience-ui.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานบนหน้าเว็บใน PR description

OUTPUT:
  - branch: feat/replit-network-resilience-ui (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ไม่แตะต้อง Formal Quotation Layout ใน App.tsx | ✅ ผ่าน |
| 11 | จัดการสถานะ Offline และ Error Fallback ของแอป | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
