# ใบงาน 214 (Backend) — ตาราง Audit Logs & ตัวดักจับบันทึกประวัติเพื่อ Troubleshooting

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ได้รับอนุมัติจากบอสโดยตรงแล้ว
**Branch:** `feat/chai-backend-audit-logging`
**ที่มา:** บอสต้องการระบบเก็บ Log เหตุการณ์และปัญหาเชิงลึกแยกตามผู้กระทำ (ลูกค้า, ทีมงาน, แอดมิน) เพื่อใช้สืบค้นแก้ไขปัญหา (Troubleshooting) และเตรียมข้อมูลสำหรับสรุปจุดติดขัดของลูกค้าเพื่อพัฒนาในอนาคต

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน lib/db/src/schema/index.ts:
     - เพิ่มตาราง systemAuditLogs ("system_audit_logs") สำหรับเก็บประวัติการทำงานและข้อผิดพลาด:
       - id: serial().primaryKey()
       - actorType: varchar("actor_type", { length: 20 }).notNull() // 'customer' | 'staff' | 'admin' | 'system'
       - actorName: varchar("actor_name", { length: 160 }) // ชื่อ, เบอร์โทรลูกค้า, หรือชื่อทีมงาน
       - action: varchar("action", { length: 64 }).notNull() // เช่น 'quote_submit', 'slip_verify', 'price_update', 'lead_delete'
       - targetId: varchar("target_id", { length: 64 }) // เลขที่ใบเสนอราคา (quoteNumber) หรือ leadId
       - status: varchar("status", { length: 16 }).notNull() // 'success' | 'warning' | 'error'
       - errorCode: varchar("error_code", { length: 64 }) // เช่น 'SLIP_NOT_MATCH', 'EDGE_CLEARANCE_VIOLATION'
       - details: jsonb("details") // เก็บ parameter, error payload หรือ diff ข้อมูล
       - ipAddress: varchar("ip_address", { length: 45 })
       - userAgent: text("user_agent")
       - createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
     - สร้าง index บน targetId, actorType, status, และ createdAt เพื่อให้ค้นหาได้รวดเร็ว
  2. ใน artifacts/api-server/src/lib/audit-logger.ts:
     - สร้าง service logAuditEvent(...) สำหรับบันทึก log ลงตาราง systemAuditLogs แบบ async ปลอดภัย (ไม่บล็อกและไม่ throw error กระทบ flow หลัก)
     - มีระบบ sanitize/redact อัตโนมัติ: ตัด password, token, sessionSecret, และเลขบัตรประชาชนเต็ม 13 หลัก
  3. ฝังตัวดักจับบันทึกเหตุการณ์ในจุดสำคัญ (Interceptors):
     - POST /api/leads: บันทึกตอนลูกค้าขอใบเสนอราคา (และบันทึก error เมื่อผังไม่ผ่าน)
     - POST /api/leads/slips: บันทึกตอนอัปโหลดสลิปโอนเงิน (บันทึก error ดิบจาก SlipOK กรณีสลิปไม่ตรง/ซ้ำ)
     - การแก้ไขข้อมูลราคาหรือลบ Lead ของ Admin: บันทึกการกระทำและชื่อผู้กระทำ
  4. ใน artifacts/api-server/src/routes/admin-router.ts:
     - สร้าง endpoint: GET /api/admin/audit-logs
       - กรองด้วย query params: targetId (ค้นด้วยเลขที่ใบเสนอราคา), actorType, status, limit, offset
       - สิทธิ์การเข้าถึง: requireAdminPermission("leads", "view") หรือ staff/owner
  5. ชุดทดสอบ:
     - artifacts/api-server/test/system-audit-logging.test.ts: ทดสอบการบันทึก log, การ sanitize ข้อมูลความลับ, และการเรียกดูผ่าน GET /api/admin/audit-logs พร้อม pagination/filtering

SCOPE:
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/lib/audit-logger.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/system-audit-logging.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามสั่งรัน migration ทำลายข้อมูลใน production db เด็ดขาด (ตารางใหม่เพิ่มแบบ additive)
  - ห้ามพิมพ์หรือบันทึกค่า secret, token, key หรือรหัสผ่านลงในฟิลด์ details เด็ดขาด
  - การบันทึก log ต้องมี try/catch ครอบ ห้ามทำให้ flow การทำงานหลักของลูกค้าล้มเหลวเพราะ log db ล้ม
  - ห้ามแตะสูตรราคาและการคำนวณเงิน

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-backend-audit-logging ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/system-audit-logging.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/api-server (baseline: 782 ผ่าน / 0 ตก)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/lib/audit-logger.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/system-audit-logging.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ตาราง system_audit_logs + helper + interceptors |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 5 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามรั่ว secret, ไม่บล็อก flow หลัก |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | บันทึกแยกประเภทลูกค้า/ทีมงาน/แอดมิน + error details |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | กำหนด redact ข้อมูล sensitive อัตโนมัติ |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 214 เรียบร้อย |
