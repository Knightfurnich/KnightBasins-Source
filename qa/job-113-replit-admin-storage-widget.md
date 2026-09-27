# ใบงาน 113 (Replit) — เพิ่มวิดเจ็ตแสดงสถานะพื้นที่จัดเก็บข้อมูลบน Admin Dashboard (Storage Health Widget on Admin Dashboard)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Dashboard Widget) — เริ่มได้ทันที (ต่อยอดจาก Task 112 API ที่ชัยเพิ่ง deploy)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ชัยทำ API สรุปสถิติพื้นที่จัดเก็บรูปภาพและไฟล์สำรองข้อมูล (`GET /api/admin/storage/stats`) ขึ้น Production VPS เรียบร้อยแล้วใน Task 112
เพื่ออำนวยความสะดวกให้ผู้บริหารและแอดมินสามารถตรวจสอบสุขภาพพื้นที่ดิสก์, จำนวนภาพในคลังผลงาน, และสถานะไฟล์แบ็กอัปได้ตั้งแต่หน้าแรกของระบบหลังบ้าน (`/admin`) Replit จะรับหน้าที่เพิ่มการ์ดวิดเจ็ตใหม่บนแดชบอร์ด:

1. **การ์ดวิดเจ็ต `STORAGE & BACKUP HEALTH` บน `AdminDashboard.tsx`:**
   * ในหน้า `artifacts/knight-basins/src/admin/AdminDashboard.tsx`:
   * เพิ่มการ์ดใหม่ในกริดแดชบอร์ด (เช่น แผงหมายเลข 07 ถัดจาก AI OPERATIONS):
     - **ส่วนคลังภาพ (Portfolio):** แสดงจำนวนรูปทั้งหมด (เช่น `647 รูป`) และขนาดพื้นที่จัดเก็บรวม (เช่น `43.7 MB`) พร้อมปุ่มลิงก์ลัด `[ จัดการคลังภาพ ➔ ]` ไปยัง `/admin/portfolio`
     - **ส่วนไฟล์สำรอง (Backup Vault):** แสดงจำนวนชุดแบ็กอัปที่เก็บอยู่ (เช่น `4 ชุด`), วันที่สำรองล่าสุด, และป้ายสถานะสีเขียว `● พร้อมกู้ภัย (RTO ≤ 4h)`
     - **ป้ายสถานะภาพรวม:** แสดง Badge `● สถานะพื้นที่ปกติ (Healthy)`
   * ป้องกัน Error / Crash: หาก API โหลดไม่สำเร็จหรือส่งข้อมูลว่าง ให้แสดงสถานะโหลดหรือ fallback ปลอดภัย โดยไม่ทำให้หน้า Dashboard พัง
2. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/admin-storage-widget.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/AdminDashboard.tsx:
     - ดึงข้อมูลจาก GET /api/admin/storage/stats
     - เพิ่มการ์ด Storage & Backup Health Widget data-testid="widget-storage-health"
     - แสดงสถิติรูปภาพ portfolio, สถิติไฟล์แบ็กอัป, และปุ่มลิงก์ลัดไปยัง /admin/portfolio
  2. สร้าง artifacts/knight-basins/test/admin-storage-widget.test.ts (ใหม่):
     - ทดสอบการเรนเดอร์การ์ด Storage Health Widget
     - ทดสอบการแสดงผลข้อมูลสถิติภาพและแบ็กอัป
     - ทดสอบปุ่มลิงก์ไปยังหน้าคลังภาพ

SCOPE:
  - artifacts/knight-basins/src/admin/AdminDashboard.tsx
  - artifacts/knight-basins/test/admin-storage-widget.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้วิดเจ็ตเดิมบนแดชบอร์ด (Leads, Stock, AI Cost) เสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-storage-widget แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 485 / pass 463 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-storage-widget.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทำงานบนหน้า Admin ใน PR description

OUTPUT:
  - branch: feat/replit-admin-storage-widget (เปิด PR เข้า main)
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
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | แสดงวิดเจ็ต Storage & Backup Health บน Dashboard | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
