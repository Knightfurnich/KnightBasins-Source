# ใบงาน 220-R (Replit) — ระบบเฝ้าระวังอัตโนมัติแจ้งเตือนฉุกเฉิน Telegram & สรุปสถิติประจำสัปดาห์ (UX Digest & Auto-Alerts)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ Replit · ได้รับอนุมัติจากบอสโดยตรงแล้ว (ภารกิจแก้ไขอันดับ 2)
**Branch:** `feat/replit-ux-digest-and-auto-alerts`
**ที่มา:** บอสต้องการให้ระบบ Audit Logs & Insights (Job 214-218) ทำงานเชิงรุก (Proactive Automation): แจ้งเตือนฉุกเฉินเข้า Telegram เมื่อเกิดปัญหาสลิปซ้ำหรืออัปโหลดล้มเหลวติดต่อกันเกินเกณฑ์ (Threshold Alert) พร้อมระบบสร้างสรุปรายงาน Knight UX Digest ประจำสัปดาห์ส่งเข้า Telegram บอสโดยตรง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/lib/incident-alerts.ts:
     - สร้าง service ตรวจสอบความผิดปกติเชิงรุก (Anomaly & Threshold Detection):
       - เมื่อเกิดเหตุการณ์ slip.upload มี status = 'error' (สลิปสแกนไม่ติด, สลิปซ้ำ, หรือยอดไม่ตรง) ให้ตรวจสอบจำนวนข้อผิดพลาดในรอบ 1 ชั่วโมงล่าสุด:
         - ถ้าพบปัญหาการเงินซ้ำเกิน 3 ครั้งใน 1 ชั่วโมง -> ให้เรียกฟังก์ชันส่งแจ้งเตือนฉุกเฉินเข้า Telegram (ใช้ TELEGRAM_BOT_TOKEN และ TELEGRAM_SALES_CHAT_ID ที่มีอยู่ในระบบ)
         - รูปแบบข้อความฉุกเฉิน:
           "🚨 [แจ้งเตือนด่วน Knight Basins] พบปัญหาสลิปการเงินล้มเหลว 3 ครั้งในรอบ 1 ชม. ล่าสุด! กรุณาตรวจสอบที่ /admin/logs"
       - มีกลไก Rate-limit กันบอทส่งแจ้งเตือนฉุกเฉินซ้ำซ้อน (ห้ามส่งเตือนเรื่องเดิมเกิน 1 ครั้งใน 30 นาที)
  2. ใน artifacts/api-server/src/routes/admin-router.ts:
     - สร้าง endpoint: POST /api/admin/audit-logs/send-weekly-digest (สิทธิ์ requireAdminOwner):
       - รวบรวมสถิติจากตาราง system_audit_logs ในรอบ 7 วันล่าสุด:
         - จำนวนลูกค้าขอใบเสนอราคาทั้งหมด (quote_requested)
         - จำนวนรายการสำเร็จ / ติดขัด (%)
         - Top 3 ปัญหาที่พบบ่อยที่สุด พร้อมคำแนะนำการพัฒนาสั้นๆ
       - ส่งข้อความสรุปรูปแบบสวยงามเข้า Telegram:
         "📊 สรุปจุดติดขัดลูกค้า (Knight UX Digest) ประจำสัปดาห์
         👥 สร้างใบเสนอราคา: X ราย
         ⚠️ จุดติดขัดที่พบ: Y ราย (Z%)
         🔍 3 ปัญหาที่พบบ่อยที่สุด:
         1. ...
         2. ...
         3. ...
         💡 ข้อเสนอแนะเพื่อพัฒนา: ...
         🔗 ดูรายละเอียดทั้งหมดที่: https://knightbasins.srv1964473.hstgr.cloud/admin/logs"
       - รองรับ query dryRun=1: คืนค่า JSON ข้อความสรุปโดยไม่ส่งออก Telegram จริง (สำหรับใช้พรีวิวและรันเทสต์)
  3. ใน artifacts/knight-basins/src/admin/AdminLogsManager.tsx:
     - ในแท็บ [ 📊 สรุปจุดติดขัดลูกค้า (UX Insights) ]:
       - เพิ่มปุ่ม [ 📱 ส่งสรุปรายงานเข้า Telegram ตอนนี้ ]
       - เมื่อกด ให้แสดง Modal พรีวิวข้อความสรุป และปุ่มกดยืนยันส่งเข้า Telegram
  4. ชุดทดสอบ:
     - artifacts/api-server/test/incident-alerts-and-digest.test.ts:
       - ทดสอบ Threshold Alert: เมื่อจำลอง error สลิปครบ 3 ครั้ง ระบบส่งแจ้งเตือนฉุกเฉิน และติด cooldown กันส่งซ้ำ
       - ทดสอบ Weekly Digest endpoint: ส่งข้อมูลสรุปถูกต้อง ครบถ้วนตามโครงสร้าง
     - artifacts/knight-basins/test/admin-digest-ui.test.ts:
       - ทดสอบปุ่มและ Modal พรีวิวรายงานสรุป Telegram บนหน้าจอ AdminLogsManager

SCOPE:
  - artifacts/api-server/src/lib/incident-alerts.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/incident-alerts-and-digest.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-digest-ui.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามแตะ StudioPage.tsx หรือไฟล์ที่ชัยกำลังทำอยู่ใน Job 219 เด็ดขาด
  - ห้ามส่งข้อความสแปมเข้า Telegram (ต้องมี cooldown และตัวกันส่งซ้ำเสมอ)
  - การทดสอบใน node --test ต้อง mock Telegram API ห้ามยิงข้อความจริงออกไประหว่างรันเทสต์

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-ux-digest-and-auto-alerts ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/incident-alerts-and-digest.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวน)
  5) node --test test/admin-digest-ui.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  6) npm test ใน artifacts/api-server (baseline: 815 ผ่าน / 0 ตก)
  7) npm test ใน artifacts/knight-basins (non-browser suite baseline: 882 ผ่าน / 0 ตก / 7 ข้าม)
  8) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/incident-alerts.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/test/incident-alerts-and-digest.test.ts
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-digest-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors ทั้งสองฝั่ง และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แจ้งเตือนฉุกเฉิน 3 สลิป + UX Digest Telegram |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 5 ไฟล์ชัดเจน ไม่ชน Job 219 |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ StudioPage, index.css 0 diff, mock telegram เทสต์ |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำระบบเฝ้าระวังอัตโนมัติตามภารกิจที่ 2 |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | จำกัดสิทธิ์เฉพาะ Owner |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 220 เรียบร้อย |
