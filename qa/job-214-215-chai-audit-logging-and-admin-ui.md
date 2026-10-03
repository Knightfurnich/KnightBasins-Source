# ใบงาน 214-215 (Full Stack) — ระบบ Audit Logs & หน้าจอ Troubleshooting สำหรับแอดมิน

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) / Replit · ได้รับอนุมัติจากบอสให้ทำพร้อมกัน
**Branch:** `feat/chai-audit-logging-and-admin-ui`
**ที่มา:** บอสสั่งรวมใบงาน 214 (Backend Logging) และ 215 (Admin UI) เพื่อทำจบครบวงจรในรอบเดียว ทั้งการสร้างตารางบันทึก log, ตัวดักจับปัญหาลูกค้า/ทีมงาน/แอดมิน, API สำหรับสืบค้น, และหน้าจอ `/admin/logs` บนเว็บแอดมิน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ฝั่งฐานข้อมูล (lib/db/src/schema/index.ts):
     - เพิ่มตาราง systemAuditLogs ("system_audit_logs") ฟิลด์: id, actorType, actorName, action, targetId, status, errorCode, details (jsonb), ipAddress, userAgent, createdAt พร้อม Indexes
  2. ฝั่ง Backend API (artifacts/api-server/):
     - สร้าง service logAuditEvent ใน src/lib/audit-logger.ts พร้อมตัดข้อมูลความลับอัตโนมัติ (password, token, sessionSecret, taxId)
     - ฝังตัวดักจับใน POST /api/leads, POST /api/leads/slips, และการแก้ราคา/สต็อก/ลบ Lead ใน routes/admin-router.ts
     - เปิด endpoint: GET /api/admin/audit-logs (รองรับ filter: targetId, actorType, status, limit, offset) พร้อมล็อกสิทธิ์เข้าถึง
  3. ฝั่ง Frontend Admin UI (artifacts/knight-basins/src/admin/):
     - เพิ่มแท็บเมนู "Logs ตรวจสอบ" ใน Admin Sidebar ภายใต้หมวด SYSTEM (Route: /admin/logs)
     - สร้างคอมโพเนนต์หน้า AdminLogsManager:
       - กล่องค้นหาแบบ Real-time: ค้นหาด้วยเลขที่ใบเสนอราคา, เบอร์โทรลูกค้า, หรือชื่อทีมงาน
       - ตัวกรองสถานะ: ทั้งหมด / สำเร็จ / คำเตือน / ข้อผิดพลาด
       - ตารางแสดงรายการพร้อมสีสถานะ (เขียว/ส้ม/แดง)
       - ปุ่มกดดูรายละเอียด (Detail Drawer): กางดู JSON ข้อมูลเชิงลึก, ข้อความ Error ดิบ, และลิงก์คลิกไปดูหน้า Lead นั้น
  4. ชุดทดสอบ:
     - artifacts/api-server/test/system-audit-logging.test.ts: ทดสอบ logging service และ API endpoint
     - artifacts/knight-basins/test/admin-audit-logs-ui.test.ts: ทดสอบ static UI assertions (nav item, route, detail drawer)

SCOPE:
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/lib/audit-logger.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/system-audit-logging.test.ts
  - artifacts/knight-basins/src/admin/AdminApp.tsx
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-audit-logs-ui.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามสั่งรัน migration ทำลายข้อมูลใน production db (ตารางใหม่เพิ่มแบบ additive)
  - ห้ามพิมพ์หรือบันทึกค่า secret, token, key หรือรหัสผ่านลงในฟิลด์ details เด็ดขาด
  - การบันทึก log ต้องมี try/catch ครอบ ห้ามทำให้ flow การทำงานหลักของลูกค้าล้มเหลวเพราะ log db ล้ม
  - ห้ามแตะสูตรราคาและการคำนวณเงิน

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-audit-logging-and-admin-ui ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/system-audit-logging.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/admin-audit-logs-ui.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/api-server (baseline: 782 ผ่าน / 0 ตก)
  7) npm test ใน artifacts/knight-basins (non-browser suite baseline: 760 ผ่าน / 0 ตก / 7 ข้าม)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/lib/audit-logger.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/system-audit-logging.test.ts
  - artifacts/knight-basins/src/admin/AdminApp.tsx
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-audit-logs-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้ง 2 ฝั่ง และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Backend Log + Frontend Troubleshooting UI |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 8 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามรั่ว secret, ไม่บล็อก flow หลัก |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) หรือ Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | รวม Backend + Frontend ให้จบในลูปเดียว |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | กำหนด redact ข้อมูล sensitive อัตโนมัติ |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 214-215 เรียบร้อย |
