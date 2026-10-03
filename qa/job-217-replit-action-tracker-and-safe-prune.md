# ใบงาน 217-R (Replit) — ระบบติดตามการแก้ไขปัญหา (Action Tracker), แนวโน้ม 7/30/90 วัน และการล้าง Log แบบปลอดภัย (Dry-run & Backup)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ Replit · ได้รับอนุมัติจากบอสโดยตรงแล้ว
**Branch:** `feat/replit-action-tracker-and-safe-prune`
**ที่มา:** บอสต้องการต่อยอดจากหน้า Insights (Job 216) ให้สามารถ "ติดตามการแก้ไขปัญหาได้จริง": ดูแนวโน้มปัญหาเทียบช่วงก่อนหน้า (7/30/90 วัน), สร้างรายการติดตามปัญหา (Action Tracker: รอตรวจสอบ/กำลังแก้/เสร็จแล้ว), และแสดงตัวอย่างก่อนลบ Log พร้อมดาวน์โหลดสำรอง (Dry-run & Backup)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ฝั่งฐานข้อมูลและ Backend API (lib/db & artifacts/api-server):
     - เพิ่มตาราง auditIssueTrackers ("audit_issue_trackers") ใน lib/db/src/schema/index.ts:
       - id: serial().primaryKey()
       - errorCode: varchar("error_code", { length: 64 }).notNull() // รหัสปัญหา เช่น EDGE_CLEARANCE_VIOLATION, SLIP_NOT_MATCH
       - title: varchar("title", { length: 200 }).notNull()
       - category: varchar("category", { length: 32 }).notNull() // 'ux', 'payment', 'form'
       - status: varchar("status", { length: 24 }).default("pending").notNull() // 'pending' (รอตรวจสอบ), 'in_progress' (กำลังแก้), 'resolved' (เสร็จแล้ว)
       - assignee: varchar("assignee", { length: 120 }).default("Owner")
       - notes: text("notes")
       - resolvedAt: timestamp("resolved_at", { withTimezone: true })
       - createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
       - updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
     - ใน artifacts/api-server/src/routes/admin-router.ts:
       - อัปเดต GET /api/admin/audit-logs/insights:
         - รับ query param: range = '7d' | '30d' | '90d' (ค่าเริ่มต้น '30d')
         - คำนวณยอดรวมเทียบกับช่วงเวลาก่อนหน้า (Previous Period Comparison เช่น 7 วันนี้ เทียบกับ 7 วันก่อน) เพื่อแสดง % แนวโน้ม (trend) เพิ่มขึ้นหรือลดลง
       - CRUD endpoints สำหรับ Action Tracker:
         - GET /api/admin/audit-issues: ดึงรายการติดตามปัญหาทั้งหมด
         - POST /api/admin/audit-issues: สร้างรายการติดตามใหม่จากปัญหาที่พบ
         - PATCH /api/admin/audit-issues/:id: อัปเดตสถานะ (pending/in_progress/resolved) และบันทึกหมายเหตุ
       - อัปเดตระบบล้าง Log (Safe Prune):
         - GET /api/admin/audit-logs/prune-preview: (Dry-run) คำนวณจำนวนแถวที่จะถูกลบแยกตามกฎ (success >30d, warning/error >90d) พร้อมช่วงวันที่ที่จะได้รับผลกระทบ โดยยังไม่ลบจริง
         - GET /api/admin/audit-logs/export: ดาวน์โหลดข้อมูล log ที่จะถูกลบออกมาเป็นไฟล์ JSON สำรอง
  2. ฝั่ง Frontend Admin UI (artifacts/knight-basins/src/admin/AdminLogsManager.tsx):
     - ในแท็บ [ 📊 สรุปจุดติดขัดลูกค้า (UX Insights) ]:
       - เพิ่มตัวเลือกช่วงเวลา: [ 7 วัน | 30 วัน | 90 วัน ] พร้อมป้ายแสดง % แนวโน้มเทียบกับช่วงก่อนหน้า (เช่น "🔺 เพิ่มขึ้น 12%" หรือ "🔻 ลดลง 25%")
       - ในตาราง "5 ปัญหาที่พบบ่อย": เพิ่มปุ่ม [+ สร้างรายการติดตาม] เพื่อเปิดฟอร์มสร้าง Action Item
       - เพิ่มส่วน "รายการติดตามการแก้ไข (Action Tracker)": แสดงการ์ดปัญหาพร้อมสถานะ [รอตรวจสอบ / กำลังแก้ / เสร็จแล้ว], ช่องบันทึกหมายเหตุ, และปุ่มปรับสถานะ
     - ในหน้าต่างล้าง Log เก่า (Prune Modal):
       - แสดงผลลัพธ์ Dry-run ก่อนลบจริง: บอกจำนวนแถวและช่วงวันที่ชัดเจน
       - มีปุ่ม [📥 ดาวน์โหลดสำรองก่อนลบ (JSON)]
       - ต้องกดยืนยันถึงจะเรียก POST prune จริง
  3. ชุดทดสอบ:
     - artifacts/api-server/test/audit-action-tracker.test.ts: ทดสอบ range comparison, issue tracker CRUD, และ prune preview/export
     - artifacts/knight-basins/test/admin-action-tracker-ui.test.ts: ทดสอบ UI ตัวเลือกช่วงเวลา, การสร้าง Action Item, และหน้าต่าง Prune Dry-run

SCOPE:
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/audit-action-tracker.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-action-tracker-ui.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามแตะ StudioPage.tsx หรือไฟล์ที่กำลังพัฒนาใน Job 210
  - ตารางใหม่ audit_issue_trackers ต้องเพิ่มแบบ additive ล้วน และสร้าง migration file deploy/hostinger/migrations/021_audit_issue_trackers.sql

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-action-tracker-and-safe-prune ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/audit-action-tracker.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/admin-action-tracker-ui.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/api-server (baseline: 807 ผ่าน / 0 ตก)
  7) npm test ใน artifacts/knight-basins (non-browser suite baseline: 782 ผ่าน / 0 ตก / 7 ข้าม)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - lib/db/src/schema/index.ts
  - deploy/hostinger/migrations/021_audit_issue_trackers.sql
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/audit-action-tracker.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-action-tracker-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้งสองฝั่ง และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Action Tracker + 7/30/90d Trend + Prune Preview/Export |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 6 ไฟล์ชัดเจน ไม่ชน Job 210 |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ StudioPage, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ครบทั้ง 3 ฟังก์ชันตามที่บอสสั่งเป๊ะ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | จำกัดสิทธิ์เฉพาะ Owner |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 217 เรียบร้อย |
