# ใบงาน 218-R (Replit) — ส่งออกรายงานจุดติดขัดลูกค้าเป็น CSV/Excel + กรองแยกหมวดหมู่ (Export Insights CSV)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันทีขณะที่ชัยกำลังทำ Job 211
**Branch:** `feat/replit-export-insights-csv`
**ที่มา:** ต่อเนื่องจาก Job 216-217 บอสและทีมบริหารต้องการปุ่มดาวน์โหลดรายงานจุดติดขัดลูกค้า (Customer Pain Points) ออกมาเป็นไฟล์ CSV (UTF-8 with BOM รองรับ Microsoft Excel ภาษาไทย) เพื่อนำไปเปิดดูใน Excel และใช้สรุปรายงานในที่ประชุมทีม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/admin/AdminLogsManager.tsx:
     - ในแท็บ [ 📊 สรุปจุดติดขัดลูกค้า (UX Insights) ]:
       - เพิ่มปุ่ม [ 📥 ส่งออกรายงานเป็น CSV (Excel) ] ถัดจากตัวเลือกช่วงเวลา [ 7 วัน | 30 วัน | 90 วัน ]
       - เมื่อคลิก ให้ดึงข้อมูลสรุปสถิติและตารางปัญหาจากหน้าจอ แปลงเป็นไฟล์ CSV มาตรฐาน RFC 4180 พร้อม UTF-8 BOM (\uFEFF) เพื่อให้เปิดใน Excel ภาษาไทยไม่เป็นภาษาต่างดาว
       - คอลัมน์ใน CSV: ลำดับ, รหัสปัญหา (Error Code), ชื่อปัญหาภาษาไทย, หมวดหมู่ (UX/การเงิน/ฟอร์ม), จำนวนครั้งที่พบ, % สัดส่วน, คำแนะนำการปรับปรุง
       - ตั้งชื่อไฟล์ดาวน์โหลดอัตโนมัติ: knight-customer-pain-points-{range}-{YYYY-MM-DD}.csv
  2. เพิ่มตัวกรองแยกตามหมวดหมู่ (Category Filter):
     - เพิ่มปุ่มหรือ Dropdown กรองปัญหา: [ ทั้งหมด | 🎨 ผังและขนาด (UX) | 💰 สลิปและการเงิน (Payment) | 📝 ข้อมูลฟอร์ม (Form) ]
     - เมื่อเลือกหมวดหมู่ ให้ตารางจัดอันดับปัญหาและรายงาน Action Tracker กรองแสดงผลเฉพาะหมวดนั้นแบบ Real-time
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/admin-logs-export-csv.test.ts:
       - ทดสอบว่าฟังก์ชันสร้าง CSV ใส่ UTF-8 BOM นำหน้าเสมอ
       - ทดสอบคอลัมน์และรูปแบบการ escape เครื่องหมายจุลภาค/คำพูด (RFC 4180)
       - ทดสอบการกดเปลี่ยนตัวกรองหมวดหมู่ในหน้า AdminLogsManager

SCOPE:
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-logs-export-csv.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / utility classes ที่มีอยู่ในระบบ)
  - ห้ามแตะ StudioPage.tsx, StudioFootprint.tsx หรือไฟล์ที่ชัยกำลังทำอยู่ใน Job 211
  - ห้ามแตะไฟล์ฝั่ง api-server (งานนี้เป็น client-side export ฝั่งแอดมิน)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-export-insights-csv ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/admin-logs-export-csv.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 863 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/admin/AdminLogsManager.tsx
  - artifacts/knight-basins/test/admin-logs-export-csv.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ปุ่มส่งออก CSV Excel + ตัวกรองหมวดหมู่ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน ไม่แตะส่วนอื่น |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ StudioPage, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline ตัวเลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำ UTF-8 BOM เปิด Excel ไทยไม่เพี้ยน |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | จำกัดสิทธิ์เฉพาะ Owner |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 218 เรียบร้อย |
