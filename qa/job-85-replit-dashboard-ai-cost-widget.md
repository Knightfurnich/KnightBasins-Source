# ใบงาน 85 (Replit) — ฝังการ์ดสรุปต้นทุน AI (AI Operations & Cost Widget) บนหน้าแรก Admin Dashboard

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ระบบแดชบอร์ดต้นทุน AI (`/admin/ai-cost`) พัฒนาเสร็จสมบูรณ์แล้ว เพื่อให้ผู้บริหารและทีมงานเห็นภาพรวมค่าใช้จ่าย AI ในหน้าแรกของหลังบ้าน (`/admin`) ทันทีโดยไม่ต้องคลิกหลายหน้า:

1. **เพิ่มการ์ดสรุปย่อ `AI Operations & Cost Widget` ใน `artifacts/knight-basins/src/admin/AdminDashboard.tsx`:**
   * ดึงข้อมูลสรุปจาก `GET /api/admin/ai-cost-center?period=30d` (ใช้ React Query)
   * แสดงผลในการ์ดสวยงาม เข้ากับธีมของ Admin Dashboard:
     - **หัวข้อ:** `06 / AI OPERATIONS` · **ชื่อการ์ด:** `ต้นทุน & ปริมาณงาน AI รวม (30 วัน)`
     - **ยอดรวมเงินบาท:** ฟอร์แมตใหญ่ชัดเจน เช่น `฿221.20`
     - **ปริมาณงาน:** แสดงจำนวนคำขอรวมและสถานะ 3 เสาหลัก (เช่น `5,750 คำขอ · 3 บริการ Active`)
     - **ชิปสถานะ 3 เสาหลัก (Mini Badges):**
       * น้องไนท์ (LINE Bot)
       * Blueprint Reader (อ่านแบบร่าง)
       * เฮอร์มีส (งานระบบ)
     - **ปุ่มทางลัด (Deep Link):** `[ ➔ ดูรายละเอียดต้นทุน AI ]` (`data-testid="link-dashboard-ai-cost"`) ลิงก์ตรงไปยัง `/admin/ai-cost`
   * มีสถานะ Loading (Skeleton) และถ้าโหลดไม่สำเร็จ ให้ขึ้นสถานะจางๆ ไม่ทำให้หน้า Dashboard หลักพัง
2. **ปรับปรุงสไตล์ CSS ใน `artifacts/knight-basins/src/index.css`:**
   * เพิ่มคลาสสำหรับ Widget นี้ เช่น `.dashboard-ai-cost-card`, `.dashboard-ai-badges`
   * รองรับ Responsive: จัดวางอย่างลงตัวทั้ง Desktop และ Mobile
3. **เขียน Unit Tests ใน `artifacts/knight-basins/test/admin-dashboard-ai-cost.test.ts` (ใหม่):**
   * ทดสอบว่ามี data-testid="panel-dashboard-ai-cost" และ data-testid="link-dashboard-ai-cost"
   * ทดสอบว่ามีการเรียก API /api/admin/ai-cost-center?period=30d
   * ทดสอบว่าปุ่มทางลัดชี้ไปยัง /admin/ai-cost ถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/AdminDashboard.tsx:
     - เพิ่มการ์ด AI Operations & Cost Widget ในส่วนภาพรวมของ Dashboard
     - ดึงข้อมูลจาก GET /api/admin/ai-cost-center?period=30d
     - แสดงยอดเงินรวม (THB), จำนวนคำขอรวม และสถานะ 3 เสาหลัก
     - เพิ่มปุ่มลิงก์ทางลัดไปยัง /admin/ai-cost (data-testid="link-dashboard-ai-cost")
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์ CSS สำหรับ AI Operations Widget ให้สอดคล้องกับพาเนลอื่นๆ ของ Dashboard
  3. สร้าง artifacts/knight-basins/test/admin-dashboard-ai-cost.test.ts (ใหม่):
     - ทดสอบการแสดงผล Widget, ลิงก์ไปยัง /admin/ai-cost และ data-testid ครบถ้วน

SCOPE:
  - artifacts/knight-basins/src/admin/AdminDashboard.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/admin-dashboard-ai-cost.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้หน้า Admin Dashboard พังหาก API สรุปต้นทุน AI ตอบช้าหรือ error
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-dashboard-ai-cost-widget แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 402 / pass 394 / fail 2 / cancelled 3 / skipped 3
  4) เทสต์ใหม่ใน admin-dashboard-ai-cost.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงและแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-dashboard-ai-cost-widget (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
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
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบ Widget ลิงก์ทางลัด และความปลอดภัยเมื่อ API ล้มเหลว | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
