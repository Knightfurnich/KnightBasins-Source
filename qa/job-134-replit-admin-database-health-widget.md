# ใบงาน 134 (Replit) — เพิ่มวิดเจ็ตแสดงสถานะฐานข้อมูลและ Latency บน Admin Dashboard (Database Health & Latency Widget)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Dashboard UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ชัยได้สร้าง API ตรวจสอบสุขภาพฐานข้อมูลและ Connection Latency `GET /api/admin/database/health` (Task 114) เสร็จสมบูรณ์และ Deploy Live แล้ว
ใบงานนี้คือการ **เพิ่มวิดเจ็ตแสดงสถานะสุขภาพฐานข้อมูล (Database Health Widget)** บนหน้าแดชบอร์ดหลักของแอดมิน (`/admin` ใน `AdminDashboard.tsx`) ข้างๆ วิดเจ็ต Storage & Backup Health เดิม เพื่อให้ผู้บริหารและทีมงาน:
1. เห็นสถานะการเชื่อมต่อของฐานข้อมูล PostgreSQL แบบเรียลไทม์ (`● พร้อมใช้งาน / Healthy`)
2. เห็นค่าเวลาตอบสนองการ Query (Latency ms เช่น `12 ms`) คอยเฝ้าระวังไม่ให้ระบบหน่วง
3. แสดงจำนวนตารางหลักในระบบ (`tablesCount` เช่น `18 ตาราง`) และเวลาตรวจสอบล่าสุด

**API หลังบ้านที่พร้อมใช้งาน 100%:**
* `GET /api/admin/database/health`
  - คืนค่า: `{ status: "healthy", latencyMs: number, database: "postgres", timestamp: string, tablesCount: number }`

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/AdminDashboard.tsx`:**
1. **เพิ่มการ์ดวิดเจ็ต `DATABASE & CONNECTION HEALTH`:**
   * วางในตำแหน่งแผงแสดงสถานะระบบ (ข้างๆ หรือในแถวเดียวกับ Storage & Backup Health Widget)
   * มี attribute `data-testid="widget-database-health"`
   * เรียกข้อมูลจาก `GET /api/admin/database/health`
   * การแสดงผล:
     - Badge สถานะ: สีเขียว `● พร้อมใช้งาน (Healthy)` หรือ `● ตอบสนองช้า (Degraded)` หาก latency สูง
     - แสดงค่า Latency: ตัวเลขมิลลิวินาทีขนาดใหญ่ เช่น `15 ms` (`data-testid="db-latency-value"`) พร้อมป้าย "เวลาตอบสนอง (Query Latency)"
     - แสดงข้อมูลฐานข้อมูล: ชนิด PostgreSQL, จำนวนตารางหลัก (`data-testid="db-tables-count"` เช่น `18 ตาราง`), และเวลาตรวจสอบล่าสุด
     - ปุ่มรีเฟรชข้อมูลสถานะด่วน (`data-testid="button-refresh-db-health"`)
2. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-database-health-widget.test.ts` (ใหม่):**
   * ทดสอบการเรนเดอร์การ์ดวิดเจ็ต `widget-database-health`
   * ทดสอบการดึงข้อมูลจาก `GET /api/admin/database/health` และแสดงค่า Latency/Tables
   * ทดสอบการแสดงผลสถานะ Healthy และปุ่มรีเฟรช

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/AdminDashboard.tsx:
     - เพิ่มวิดเจ็ต Database & Connection Health (data-testid="widget-database-health")
     - ดึงข้อมูลจาก GET /api/admin/database/health แสดงสถานะ, latencyMs, tablesCount และปุ่มรีเฟรช
  2. สร้าง artifacts/knight-basins/test/admin-database-health-widget.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/AdminDashboard.tsx
  - artifacts/knight-basins/test/admin-database-health-widget.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้วิดเจ็ต Storage & Backup Health หรือชิ้นส่วนอื่นบน Dashboard เสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-database-health-widget แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 555 / pass 533 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-database-health-widget.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-database-health-widget (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์วิดเจ็ต Dashboard เดิมทั้งหมด | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
