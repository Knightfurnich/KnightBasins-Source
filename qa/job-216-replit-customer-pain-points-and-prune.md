# ใบงาน 216-R (Replit) — Customer Pain Points Dashboard & Auto-Pruning Logs

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันทีขณะที่ชัยกำลังทำ Job 210
**Branch:** `feat/replit-customer-pain-points-and-prune`
**ที่มา:** ต่อเนื่องจากระบบ Audit Logs (Job 214-215 ที่ขึ้น Live แล้ว) บอสต้องการระบบสรุปจุดติดขัดที่ลูกค้าพบบ่อย (Customer Friction Insights) เพื่อนำไปปรับปรุงธุรกิจ พร้อมระบบล้าง Log เก่าอัตโนมัติ (Retention Policy 90 วัน)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ฝั่ง Backend API (artifacts/api-server/src/routes/admin-router.ts):
     - สร้าง endpoint: GET /api/admin/audit-logs/insights (สิทธิ์ requireAdminOwner)
       - รวบรวมสถิติจากตาราง system_audit_logs ในรอบ 30 วันที่ผ่านมา:
         1) สรุปยอดรวม: จำนวนเคสทั้งหมด, เคสที่สำเร็จ, เคสที่มีคำเตือน (warning), เคสที่ผิดพลาด (error)
         2) Top 5 Pain Points: จัดอันดับปัญหาที่ลูกค้าเจอบ่อยที่สุด (กรองเฉพาะ actor_type = 'customer' และ status IN ('warning', 'error')) กรุ๊ปตาม error_code หรือ action พร้อมนับจำนวนครั้งและคำอธิบายปัญหาภาษาไทย
         3) ปัญหาแยกตามหมวด: UX/ผังเคาน์เตอร์, สลิปการเงิน, ข้อมูลฟอร์ม
     - สร้าง endpoint สำหรับล้าง Log เก่า (Data Retention): POST /api/admin/audit-logs/prune
       - ลบ log ทั่วไป (status = 'success') ที่อายุเกิน 30 วัน
       - ลบ log ข้อผิดพลาด (status IN ('warning', 'error')) ที่อายุเกิน 90 วัน
       - คง log ทางการเงิน (action = 'slip.upload') และ admin actions ไว้ตรวจสอบ
  2. ฝั่ง Frontend Admin UI (artifacts/knight-basins/src/admin/AdminLogsManager.tsx):
     - เพิ่มแท็บด้านบนของหน้า /admin/logs:
       - แท็บ 1: [ ประวัติ Log ทั้งหมด ] (ตารางค้นหาเดิมที่ทำไว้ใน Job 215)
       - แท็บ 2: [ 📊 สรุปจุดติดขัดลูกค้า (UX Insights) ]
     - ในแท็บ UX Insights:
       - แสดงการ์ดสรุปตัวเลข 4 ช่อง: รายการทั้งหมด · สำเร็จ · จุดติดขัด · อัตราความราบรื่น (%)
       - แสดงตาราง/แถบกราฟ "5 ปัญหาที่ลูกค้าพบบ่อยที่สุดในรอบเดือน" พร้อมคำแนะนำเชิงธุรกิจ
       - มีปุ่ม [ ล้างประวัติ Log เก่า (>90 วัน) ] พร้อมแสดงผลจำนวนแถวที่ถูก prune ล่าสุด
  3. ชุดทดสอบ:
     - artifacts/api-server/test/audit-logs-insights.test.ts: ทดสอบ endpoint /insights และ /prune
     - artifacts/knight-basins/test/admin-logs-insights-ui.test.ts: ทดสอบแท็บสลับ, การ์ดสรุปตัวเลข, และตาราง Pain Points

SCOPE:
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/audit-logs-insights.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-logs-insights-ui.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามลบข้อมูล log ทางการเงิน (slip) ที่อายุยังไม่ถึง 1 ปี
  - ห้ามแตะไฟล์ StudioPage.tsx หรือไฟล์ที่ชัยกำลังทำอยู่ใน Job 210 เด็ดขาด

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-customer-pain-points-and-prune ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/audit-logs-insights.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/admin-logs-insights-ui.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/api-server (baseline: 807 ผ่าน / 0 ตก)
  7) npm test ใน artifacts/knight-basins (non-browser suite baseline: 782 ผ่าน / 0 ตก / 7 ข้าม)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/audit-logs-insights.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-logs-insights-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้งสองฝั่ง และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | สรุปจุดติดขัดลูกค้า + Auto Prune 90 วัน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน ไม่ชนกับ Job 210 |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ StudioPage.tsx, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำ Retention 90 วัน + สรุปปัญหาลูกค้า |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | จำกัดสิทธิ์เฉพาะ owner |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 216 เรียบร้อย |
