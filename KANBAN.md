# 📋 KNIGHT BASINS — PROJECT KANBAN

> อัปเดตล่าสุด: 24 กันยายน 2569 (โดย เดวิด)  
> แหล่งรวมสถานะงานและการส่งมอบของทีมงาน (เดวิด / ชัย / Replit)

---

## 📌 สรุปภาพรวมสถานะ (Kanban Board)

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│       📝 TO DO          │     🔄 IN PROGRESS      │        ✅ DONE          │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Task 24 (Replit)      │ • แจ้งเตือนอัตโนมัติ     │ • Task 31 (Replit)      │
│   สลับ hook จริง         │   (LINE/SMS/Email)      │   Studio over sketch    │
│ • Nesting / Sheet Calc  │   Coming Soon           │ • Task 34 (ชัย)         │
│   หินลายหินอ่อน/สายแร่  │                         │   Auto Quote Gen LIVE   │
│   9,500 บ./ตร.ม.        │                         │ • Task 33 (ชัย) Hardening│
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 🚀 รายการใบงานทั้งหมด (Detailed Work Orders Ledger)

### ✅ COMPLETED (เสร็จสิ้นและ Deploy ขึ้น Production แล้ว)

| ใบงาน | ผู้รับผิดชอบ | หัวข้อ / ขอบเขต | Commit / Branch | สถานะ |
|:---:|:---:|:---|:---:|:---:|
| **Task 1** | ชัย | ค้นหา Unassigned Slips (`leads-utils.ts`) | `736ff6f` | ✅ Merge & Deployed |
| **Task 2** | ชัย | Smart auto-match จับคู่สลิปกับ Lead อัตโนมัติ | `5d70b0a` | ✅ Merge & Deployed |
| **Task 3** | ชัย | Topological Attachment Solver 4 ทิศทาง (`studio-model.ts`) | `4d7d246` | ✅ Merge & Deployed |
| **Task 4** | Replit | Studio Attachment Inspector UI ต่อแผ่น 4 ทิศทาง (`StudioPage.tsx`) | `b01324a` / `7c0fc90` | ✅ Merge & Deployed |
| **Task 5** | ชัย | Server-side matching endpoint (`admin-router.ts`) | `3c288aa` | ✅ Merge & Deployed |
| **Task 6** | ชัย | Bulk assign slips endpoint (`admin-router.ts`) | `11902bb` | ✅ Merge & Deployed |
| **Task 7** | ชัย | เพิ่มปุ่ม `[✓ ผูกอัตโนมัติทั้งหมด]` ในหน้า Admin Leads | `5c19e3d` | ✅ Merge & Deployed |
| **Task 8** | ชัย | เพิ่มปุ่ม `[ยกเลิกสลิป (Void)]` ในการ์ดสลิปรอระบุงาน | `91a68c7` / `dc0402b` | ✅ Merge & Deployed |
| **Task 9** | ชัย | Google Places Autocomplete Route (New API Endpoint) | `0c95923` / `f53d3eb` | ✅ Merge & Deployed |
| **Task 10** | ชัย | ปุ่มและฟังก์ชัน Export Leads เป็น Excel / CSV (RFC 4180 + UTF-8 BOM) | `c422f77` / `a41da7d` | ✅ Merge & Deployed |
| **Task 11** | ชัย | API Endpoint `GET /api/admin/dashboard-stats` (Hybrid Dashboard) | `d08cd6b` / `88bdf62` | ✅ Merge & Deployed |
| **Task 12** | ชัย | ตรวจสอบความถูกต้องเรขาคณิต 2D Studio (Attachment, Cycles, Cutout, DXF) | `9048c14` / `67ab234` | ✅ เทสต์ผ่าน 19/19 ข้อ |
| **Task 13** | ชัย | ระบบตรวจระยะขอบปลอดภัยหลุมเจาะอ่าง 100 มม. (`STUDIO_BASIN_SAFETY_MARGIN_MM`) | `5f3c8e8` | ✅ เทสต์ผ่าน 13/13 ข้อ |
| **Task 14** | ชัย | เพิ่ม `popularItems` และ `recentActivities` ใน Dashboard API | `5efd0ba` / `ee4235d` | ✅ Merge & Deployed |
| **Task 15** | ชัย | Cockpit Engine (ตัวกรองช่วงเวลา, เปรียบเทียบ 3 เดือน, เรดาร์ 10 ทีม) | `a250b38` / `a15458e` | ✅ Merge & Deployed |
| **Task 17** | ชัย | Quick Leads Status Action (`PATCH /admin/leads/:id/status`) | `3df36d5` / `24e09fc` | ✅ Merge & Deployed |
| **Task 19** | ชัย | Migration 011, `GET /admin/technician-calendar`, `PATCH /admin/leads/:id/technician` | PR #3 / `424743f` | ✅ Applied & Deployed |
| **Maps UI** | Replit | เชื่อมโยง Places Autocomplete ใน `/quote` + ปุ่ม `🗺️ เปิดแผนที่ Google Maps` | `37fe2cd` / `8a33647` | ✅ Merge & Deployed |
| **Cockpit UI**| Replit | Executive & Team Cockpit UI (3 เดือน, เรดาร์ 10 ทีม, ส่งสรุป LINE) | `08bd790` / `3487119` | ✅ Merge & Deployed |
| **Calendar UI**| Replit/เดวิด | ปฏิทินคิวช่าง WOW Cockpit: เรดาร์ 10 ทีมช่างด้านข้าง + สลับมุมมองรายเดือน/รายสัปดาห์ (PR #18) | `4c4384d` | ✅ **Live บน VPS** · แถบเรดาร์ 10 ทีม, มุมมองสัปดาห์, ป้ายช่างบนช่องวัน |
| **Calendar v2**| เดวิด | ติ๊กถูกเลือกทีม + Dropdown เลือกเดือน/ปี พ.ศ. + ป้ายประเภทงาน (วัดงาน/ติดตั้ง/เก็บงาน/ส่งลูกค้า) + ตัวกรองประเภทงาน + ปุ่มนำทาง Google Maps | `89810a5` | ✅ **Live บน VPS** · ติ๊กถูก, dropdown เดือน/ปี, ป้าย+กรองประเภทงาน, นำทาง Maps |
| **LINE Morning**| เดวิด | สรุปคิวช่างประจำวันส่งเข้ากลุ่ม LINE ทีมงานอัตโนมัติ 07:30 น. (cron `fe03ab2ac30e`) | `bin/line_dispatch_brief.py` | ✅ **Live** · ทดสอบส่งจริง HTTP 200 · 4 งาน/3 ทีม |
| **Contact Info**| เดวิด | เพิ่มข้อมูลติดต่อและที่ตั้งสำนักงานใหญ่/โรงงานที่ `/readme` และ Storefront Footer | `8827761` | ✅ Live บน VPS |
| **Task 20** | ชัย | ขยาย `PATCH .../technician` รองรับเลื่อนวันติดตั้ง + `GET /admin/leads?technicianTeamCode=` | PR #4 / `37f9859` | ✅ 32/32 tests & Deployed |
| **Readme UX** | เดวิด | ปรับขนาดฟอนต์หัวเรื่องให้พอดี, เปลี่ยนหัวเรื่องเป็น "โดย ไนท์ เฟอร์นิช", การ์ด 3 ช่องทางคลิกไปหน้าจริง | `42226a2` / `1f3f077` | ✅ Live บน VPS |
| **Type Scale** | เดวิด | รวมขนาดฟอนต์ทั้งเว็บเป็น pattern เดียว (`--type-size-hero/heading-xl/heading-lg/heading-md/stat`) ลบ clamp ซ้ำซ้อน 6 จุด | `f2a289f` / `fdf9477` | ✅ Live บน VPS |
| **Task 21** | Replit | Studio ซ่อน X/Y เมื่อมีแผ่นเดียว + ลบเตือน 900 มม. · ปฏิทินคิวช่างย้ายทีม/ปลดคิว/เลื่อนวันติดตั้ง (Asia/Bangkok) | `a941aff` / `6529d4e` | ✅ ตรวจรับ & Live บน VPS |
| **Quote copy** | เดวิด | ใบเสนอราคา: `ธนาคารกรุงศรีอยุธยา` → `ธ.กรุงศรีอยุธยา` และตัดจุดคั่นหน้า "สาขา" | `d2e3e6f` / `7b57533` | ✅ Live บน VPS |
| **Task 22** | เดวิด | แก้ชื่อทีมช่าง 6/10 รหัสให้ตรง `TEAM.md` (CM/KF/PM/TJ/AM/CL) + alias ทีมออฟฟิศ/ออฟฟิต | `4bb5267` | ✅ 204 tests (200 pass) & Deployed |
| **Task 23** | ชัย | ย้ายรายชื่อทีมช่างเข้า DB (`technician_teams`) + API เพิ่ม/แก้/ปิดใช้งานทีม | `027bbd2` / merge `8cc10a7` | ✅ **Merged & Deployed** · Migration 012 applied · Acceptance 11/11 |
| **Task 24-PREP** | Replit | เตรียมหน้าจอทีมช่าง + ปฏิทิน ผ่านไฟล์สะพาน (build เขียว, ไม่มี mock data) | `54b8ccb` | ✅ เสร็จ (draft) |
| **Task 24** | Replit | สลับไฟล์สะพาน -> hook จริง (`useListAdminTechnicianTeams`) + ลบไฟล์สะพาน (PR #11) | `3c9a5a3` | ✅ **Live บน VPS** · หน้าจัดการ 10 ทีมช่างจริง + เชื่อมต่อปฏิทินสำเร็จ |
| **TTS Phase 1** | ชัย | น้องไนท์ พูดออกเสียงได้ via Google Cloud TTS (PR #12) | `877af6e` | ✅ **Live บน VPS** · ปุ่มฟังเสียง + เสียง Kore + POST /api/support/speech |
| **TTS Phase 2** | ชัย | ระบบเลือกโทนเสียงน้องไนท์ในหน้าแอดมิน (ล็อกหญิง 5 โทนอารมณ์, migration 013, API, UI) (PR #14) | `4b4daf0` | ✅ **Live บน VPS** · หน้าเลือก 5 โทนเสียงหญิง + API Preview/Save + fallback Kore |
| **Task 38** | Replit | Top View อ่างเสมือนจริง + ท็อปเปลี่ยนสีตามหิน + ปุ่ม 2 ทางบนการ์ดอ่าง (PR #13) | `8a52a0d` | ✅ **Live บน VPS** · ปุ่ม 2 ทางบนการ์ดอ่าง, ผังแสดงเนื้อหิน, Top view อ่างมีสะดือ |
| **Task 40** | Replit | สะพานเชื่อม 2 ทาง Studio ↔ ส่งแบบร่างมือ พร้อมปรับ UX หน้าสเก็ตช์ (PR #16) | `abb02b6` | ✅ **Live บน VPS** · แบนเนอร์ 2 ทาง, หน้าสเก็ตช์ซ่อนปุ่มวางผัง/แก้ helper |
| **Task 31** | Replit | ระบบทีมขายวาด 2D Studio จากแบบร่างลูกค้า (ปุ่มใน Admin + Split View ดูรูปคู่ขนาน) (PR #9) | `ac8a8e6` | ✅ **Live บน VPS** · เปิดวาดจาก Lead, ดูรูปคู่ขนาน, บันทึกผังเข้า Lead |
| **Task 33** | ชัย | ยกระดับความปลอดภัย API Server ตามรายงาน Security Audit (PR #7) | `f4de3d9` | ✅ **Live บน VPS** · Sweep Map >1k, Secure cookie, Rate limit GET /quotes · 254 tests ผ่าน |
| **Task 34** | ชัย | สร้าง quoteNumber/quoteAccessSecret อัตโนมัติเมื่อทีมขายบันทึก studioData (PR #8) | `e7967e7` | ✅ **Live บน VPS** · สร้างเลขที่ใบเสนอราคา+โทเค็นอัตโนมัติ · 256 tests ผ่าน |
| **Task 35** | ชัย | Auto-match สีหินตามรุ่นอ่าง + คิดราคาพร้อมติดตั้งอัตโนมัติ (PR #10) | `8f2b7da` | ✅ **Live บน VPS** · KF001->VS311, KF009->NB091 8,500 บ./ตร.ม. · 192 tests ผ่าน |
| **Task 37** | ชัย | ปรับขนาดเริ่มต้นบอร์ด Studio เป็นขนาดจริง 1800x600 และเพิ่มตัวช่วยวางอ่าง (PR #15) | `a3dd79c` | ✅ **Live บน VPS** · ขนาดเริ่ม 1800x600, createStudioBasinPlacement วางกึ่งกลางร่นขอบ >=100mm |
| **Task 41** | ชัย | ปลดล็อกคำนวณราคาหินลายหินอ่อน 9,500 บ./ตร.ม. ใน 2D Studio ตามพื้นที่จริง (PR #17) | `733cbd6` | ✅ **Live บน VPS** · หินลาย 9,500 คิดตามพื้นที่จริง (1.08 ตร.ม. = 10,260 บ.) |
| **Task 42** | ชัย | Preset ขนาดเคาน์เตอร์สำเร็จรูป 4 ขนาด + ฟังก์ชันจัดอ่างอัตโนมัติ (PR #18) | `b6cb061` | ✅ **Live บน VPS** · STUDIO_COUNTER_PRESETS 4 ขนาด + applyStudioSizePreset จัดกึ่งกลางขอบ >=100mm |
| **Task 43** | Replit | ปุ่มบันทึก/แชร์ผังเคาน์เตอร์เป็นรูปภาพ PNG เด่นชัดทั้ง 2 โหมด (PR #19) | `876f633` | ✅ **Live บน VPS** · ปุ่ม 📷 บันทึกภาพผัง (PNG) เด่นชัดในทั้งโหมดง่ายและโหมดปกติ |
| **Data Backfill** | เดวิด | เติมข้อมูลจริงจากประวัติแชท LINE: ที่อยู่หน้างาน/เบอร์โทร 9 งาน + สร้าง Lead จากหลักฐาน PDF + ผูกสลิปครบ 100% | `bin/data_backfill_pipeline.py` + `pass2` | ✅ **เสร็จ** · สลิปผูกครบ 53/53 (เหลือ 0) · 13 Lead มีที่อยู่ · 20 งานมีคิวช่าง |
| **Task 44** | ชัย | ระบบฐานข้อมูลและ API ภาพหน้างานช่าง (Migration 014 + GET/POST/PATCH) | `feat/chai-site-photos-api` | ✅ **Live บน VPS** · PR #20 merge + migration 014 applied · GET /api/admin/site-photos ตอบ 200 OK |
| **Task 46** | ชัย | หน้าแกลเลอรีภาพหน้างานช่างในหน้าแอดมิน (/admin/site-photos) | `feat/chai-site-photos-ui` | ✅ **Live บน VPS** · PR #22 merge + deploy · 51 รูปจริง + Lightbox แก้ไขได้ |
| **Task 47** | ชัย | ระบบปักหมุดภาพ Top View สำหรับอ่างในฐานข้อมูลและ API (Migration 015) | `feat/chai-basin-topview-backend` | ✅ **Live บน VPS** · PR #23 merge + migration 015 applied · topViewImageUrl ครบ 30 รุ่น |
| **Task 48** | Replit | ตัวเลือกเดือน/ปี (Month & Year Selector) ในหน้าปฏิทินคิวช่าง (/admin/calendar) | `feat/replit-calendar-month-picker` | ✅ **Live บน VPS** · PR #25 merge + deploy · ดรอปดาวน์เดือน/ปี พ.ศ. ใช้งานได้จริง |
| **Task 49** | ชัย | เพิ่มปุ่มปักหมุด 'กำหนดเป็นภาพ Top View' ในหน้าแก้ไขอ่าง (/admin/basins) | `feat/chai-basin-topview-ui` | ✅ **Live บน VPS** · PR #24 merge + deploy · ปุ่ม 🔝 Top View บนทุกรูป |
| **Thai Holidays** | เดวิด | แสดงวันหยุดนักขัตฤกษ์ไทย (ป้ายแดง 🚩 + ข้อความเตือนคอนโด) บนปฏิทินคิวช่าง | `883d833` | ✅ **Live บน VPS** · ครอบคลุม 2568-2570 · วันที่ 13, 23 ต.ค. ขึ้นป้ายพร้อมข้อความเตือน |
| **Task 50** | Replit | ปุ่มคัดลอกลิงก์แชร์ผังเคาน์เตอร์ 2D Studio (1-Click Share Link) | `feat/replit-studio-share-link` | ✅ **Live บน VPS** · PR #28 merge + deploy · ปุ่ม 🔗 คัดลอกลิงก์ผังนี้ ใช้งานได้จริง |
| **Task 51** | ชัย | เชื่อมต่อภาพถ่ายหน้างานจริง (Site Photos) แสดงในการ์ด Lead (/admin/leads) | `feat/chai-leads-site-photos` | ✅ **Live บน VPS** · PR #26 merge + deploy · รูปหน้างานแสดงในการ์ด Lead พร้อม Lightbox |
| **Task 52** | ชัย | ระบบ API สำรองและส่งออกข้อมูลสำหรับแอดมิน (/api/admin/backup/*) | `feat/chai-backup-api` | ✅ **Live บน VPS** · PR #27 merge + deploy · GET /api/admin/backup/* ตอบ 200 OK |
| **Task 53** | Replit | หน้าศูนย์สำรองข้อมูลสำหรับแอดมิน (/admin/backup) | `feat/replit-backup-vault` | ✅ **Live บน VPS** · PR #29 merge + deploy · หน้าสำรองข้อมูล 4 หมวดใช้งานได้จริง |
| **DB Dump** | เดวิด | ปุ่มดาวน์โหลดฐานข้อมูลเต็ม (.sql.gz) + cron สำรองทุกคืน เก็บย้อนหลัง 14 ชุด | `feat/david-backup-dump` | ✅ **Live บน VPS** · Owner โหลดได้จริง 36 KB · GET /admin/backup/database-dump → 200 |
| **Disaster Recovery** | เดวิด | ชุดกู้ชีพฉุกเฉินระดับ SLA ≤ 4 ชม. (.tar.gz 46 MB) กู้คืนระบบ 100% ใน 15 นาที | `feat/david-backup-dump` | ✅ **Live บน VPS** · รวม DB + uploads + คู่มือ 3 ขั้นตอน |
| **Task 54** | ชัย | ระบบ API ตัวกรองภาพหน้างานขั้นสูง (unassigned + month + sender) | `feat/chai-site-photos-filters` | ✅ **Merged & Live (PR #30)** · ผ่าน 11/11 tests · API /admin/site-photos รองรับครบ 3 filter |
| **Task 55** | Replit | เพิ่มแถบตัวกรอง 'ยังไม่ระบุรหัสงาน' และตัวเลือกเดือน ในหน้าคลังภาพ (/admin/site-photos) | `feat/replit-site-photos-filters` | ✅ **Merged & Live (PR #31)** · ผ่าน 6/6 tests · ปุ่ม unassigned + ดรอปดาวน์เดือนใช้งานได้จริงบนจอ |
| **Task 56** | ชัย | ระบบ API สต็อกหินสังเคราะห์ Read-Only ดึงสดจาก Google Drive Service Account (`GET /api/admin/stock`) | `feat/chai-stock-api` | 🔄 มอบหมายแล้ว (`qa/job-56-chai-stock-api.md`) |
| **Task 57** | Replit | สร้างหน้าจอสต็อกหินสังเคราะห์ Real-Time ในระบบแอดมิน (`/admin/stock`) | `feat/replit-stock-inventory-ui` | 🔄 มอบหมายแล้ว (`qa/job-57-replit-stock-ui.md`) |
| **Portfolio API** | เดวิด | `GET /api/portfolio` คลังภาพผลงานจริง 360 ภาพ แยก 17 หมวดหมู่ | `main` (c9ef002) | ✅ **Live บน VPS** · ทดสอบ HTTP 200 · คืนครบ 360 ภาพ |
| **Task 58** | Replit | หน้าคู่มือเตรียมหน้างานก่อนติดตั้ง (`/site-prep`) ใช้ภาพจริง 59 ภาพ | `feat/replit-site-prep-guide` | 🔄 มอบหมายแล้ว (`qa/job-58-replit-site-prep-guide.md`) |
| **Task 59** | ชัย | คลังภาพผลงานทีมขายในแอดมิน (`/admin/portfolio`) + ปุ่มคัดลอกส่งลูกค้า | `feat/chai-admin-portfolio-gallery` | ✅ **Merged & Live (PR #33)** · ผ่าน 10/10 tests · page + เมนูใช้งานได้จริงบนจอ |
| **readme v2** | เดวิด | ปรับหน้า `/readme` เป็นคู่มือมาตรฐานระบบบริการและสเปกวัสดุ 6 หมวด | `main` (bc5d3ad) | ✅ **Live บน VPS** · เพิ่มจุดเด่นวัสดุ 4 ด้าน · Safety Margin 100 มม. · Maps โรงงาน |
| **Featured Showcase** | เดวิด | แถบเลื่อนภาพผลงานจริง 10 ภาพวนลูปต่อเนื่อง + Lightbox บนหน้าแรก | `main` (4a7a72c) | ✅ **Live บน VPS** · ดึงภาพชุด Masterpiece 10 ภาพวนลูปอัตโนมัติ · ปุ่มเลื่อนซ้าย/ขวา |
| **Task 57 (Stock UI)** | Replit | หน้าจอสต็อกหินสังเคราะห์ Real-Time ในระบบแอดมิน (`/admin/stock`) | `feat/replit-stock-inventory-ui` | ✅ **Merged & Live (PR #34)** · Staron 63 / Zen 47 สต็อกสดเรียลไทม์ |
| **Task 58 (Site Prep)** | ชัย | หน้าคู่มือเตรียมหน้างานก่อนติดตั้ง (`/site-prep`) ใช้ภาพจริง 59 ภาพ | `feat/chai-site-prep-guide` | ✅ **Merged & Live (PR #35)** · ผ่าน 8/8 tests · /site-prep ใช้งานได้จริงบนจอ |
| **Task 60 (Navbar)** | Replit | เพิ่มเมนู 'ผลงานจริง', 'เตรียมหน้างาน', 'ส่งแบบร่าง' บน Navbar (PR #37) | `feat/replit-storefront-navigation` | ✅ **Merged & Live (PR #37)** · เมนูเดสก์ท็อป + แถบเลื่อนมือถือ 100% |
| **Task 61 (Curation)** | ชัย | ระบบคัดกรองและสลับซ่อน/แสดงภาพผลงานในคลังแอดมิน (`/admin/portfolio`) (PR #36) | `feat/chai-portfolio-curation` | ✅ **Merged & Live (PR #36)** · ผ่าน 8/8 tests · สลับเปิด/ปิดภาพสด |
| **Task 62 (Portfolio UI)** | Replit | เพิ่มระบบค้นหาภาพและปุ่มสอบถามทาง LINE จากคลังผลงาน (`/portfolio`) (PR #39) | `feat/replit-portfolio-inquiry-search` | ✅ **Merged & Live (PR #39)** · ค้นหาภาษาไทยได้ 18/18 ครัว · ปุ่ม LINE ใน Lightbox |
| **Portfolio Search Fix** | เดวิด | แก้บั๊กค้นหา: ส่งคำค้นไป API แทนกรองเฉพาะหน้าที่โหลด (เดิมค้น "ครัว" ได้ 0 ภาพ) + debounce 350ms | `6345b19` | ✅ **Live บน VPS** · ผ่าน 9/9 tests · ค้น "ครัว" ได้ 18 ภาพจริง |
| **Task 63 (Stock Export & Search)** | ชัย | ระบบดาวน์โหลดสต็อกหินสังเคราะห์ (CSV Export) และ API ค้นหาภาพผลงาน (`?q=`) | `feat/chai-stock-export-portfolio-search` | ✅ **Merged & Live (PR #38)** · ผ่าน 11/11 tests · CSV UTF-8 BOM + ?q= search |
| **Task 64 (Edge Logic)** | ชัย | ระบบคำนวณและฟังก์ชันจัดการขอบเคาน์เตอร์ 2D Studio (ติดบัว/ชิดผนัง/ขอบเปิด/ล้างขอบ) (PR #40) | `feat/chai-studio-edge-finishes-logic` | ✅ **Merged & Live (PR #40)** · ผ่าน 10/10 tests · รองรับ wall-flush+upstand + helpers |
| **Task 65 (Studio Redesign)** | Replit | ยกเครื่อง 2D Studio: กระดานกว้างเต็มจอ (Full-Width Canvas) + ถาดเครื่องมือลอย + แถบจัดการขอบ (PR #41) | `feat/replit-studio-canvas-redesign` | ✅ **Merged & Live (PR #41)** · ถาดลอย 5 สถานะขอบ + ป้ายคลิก/กด ✕ ได้จริง |
| **Studio Guide** | เดวิด | คู่มือใช้งาน 2D Studio สำหรับลูกค้า 3 ขั้นตอน (`/studio-guide`) + HowTo schema + sitemap + llms | `92f3b97` | ✅ **Live บน VPS** · 3 ขั้นตอน + ตาราง 5 สถานะขอบ + FAQ 4 ข้อ |
| **Task 66 (Edge Preservation)** | ชัย | ระบบป้องกันการลบทับขอบของผู้ใช้ (Custom Edge Preservation & Joint Guard) (PR #42) | `feat/chai-custom-edge-preservation` | ✅ **Merged & Live (PR #42)** · ผ่าน 9/9 tests · hasCustomEdges + preserveCustomEdges |
| **Task 68 (Edge Breakdown)** | ชัย | สรุปสถานะขอบรายด้านสำหรับใบสั่งผลิตโรงงาน (PR #43) | `feat/chai-edge-finish-breakdown` | ✅ **Merged & Live (PR #43)** · ผ่าน 5/5 tests · studioEdgeFinishBreakdown + studioEdgeFinishSummary |
| **Task 69 (Studio Edge & Basin Portfolio)** | Replit | เชื่อมต่อระบบรักษาสถานะขอบใน StudioPage และเพิ่มปุ่มดูงานจริงบนการ์ดอ่าง (PR #44) | `feat/replit-studio-edge-wiring-and-basin-portfolio` | ✅ **Merged & Live (PR #44)** · ผ่าน 4/4 tests · ขอบไม่หายเมื่อเปลี่ยนทรง + ปุ่มดูภาพจริง |
| **Task 70 (Export Edge Finishes)** | ชัย | รองรับสถานะขอบคู่ (WALL_FLUSH_UPSTAND) ในระบบ Export DXF/SVG ส่งโรงงาน (PR #45) | `feat/chai-export-edge-finishes` | ✅ **Merged & Live (PR #45)** · ผ่าน 6/6 tests · DXF Layer + SVG สรุปขอบรายด้าน |
| **Task 71 (Sketch Page Redesign)** | Replit | ยกเครื่องจัด Layout หน้า 'ส่งแบบร่างด้วยมือ' (/sketch) เป็น 3-Step Guided Flow (PR #46) | `feat/replit-sketch-page-redesign` | ✅ **Merged & Live (PR #46)** · ผ่าน 4/4 tests · 3-Step Guided Flow + Dropzone เต็มจอ |
| **Sketch Pricing & URLs** | เดวิด | คำนวณราคาอ่าง+พื้นที่จริงในโหมดส่งแบบร่าง + กล่องกรอกขนาดเคาน์เตอร์ + ซิงก์ URL สั่งซื้อ | `1c20868` | ✅ **Live บน VPS** · ผ่าน 2/2 tests · คิดราคาอ่าง KF025 + พื้นที่ 1.98x0.45m เป๊ะ |
| **Task 72 (Sketch Vision API)** | ชัย/เดวิด | API วิเคราะห์ภาพแบบร่างด้วย AI (Gemini 3.8 Flash Vision อ่านลายมือ ถอดทรง I/L/U และมิติ) (PR #47) | `feat/chai-sketch-vision-api` | ✅ **Live บน VPS** · ผ่าน 11/11 tests · อ่านภาพสเก็ตช์ 1980x450mm สำเร็จจริงบน Production |
| **Task 73 (Sketch Camera & AI UI)** | Replit | ปุ่มถ่ายรูปกล้องสด + จำกัด 3 รูป + แถบสถานะ AI + กรอกมิติอัตโนมัติ (PR #48) | `feat/replit-sketch-camera-capture` | ✅ **Merged & Live (PR #48)** · ผ่าน 4/4 tests · กล้องสด `capture=environment` + ตัดกล่องเทียบหินออก |
| **Task 74 (Closed Edge & Builder)** | ชัย | เพิ่มสถานะ "ขอบปิด ⊞" (closed-edge) และฟังก์ชันสร้างชิ้นงานตามขนาดแผ่นจริง | `feat/chai-studio-closed-edge` | ✅ **Merged (PR #49)** `a3da536` · typecheck 0 errors · เทสต์ใหม่ 5/5 · `buildCustomShapePiece` + `CLOSED_EDGE` layer พร้อมใช้ |
| **Task 75 (Custom Shape Panel UI)** | Replit | ลบปุ่มขนาดสำเร็จรูป · กล่องกรอกขนาดรายแผ่น (I=1/L=2/U=3) · เมนูขอบ 4 แบบล็อกรอยต่อ · ปุ่ม Action `[ 🎨 ประกอบผังลงกระดาน ]` (PR #50) | `feat/replit-studio-custom-shape-panel` | ✅ **Merged & Live (PR #50)** `d277623` · typecheck 0 errors · เทสต์ใหม่ 4/4 · ผ่านการทดสอบจริง I/L/U ครบถ้วน |
| **Task 76 (Vision Multi-Workpiece)** | ชัย | ขยาย Gemini Vision API ถอดแยกชิ้นงานหลายชิ้น + แผ่นหิน (Panels) + ขอบ 4 แบบ + จุดเจาะ (ไม่หักพื้นที่) (PR #51) | `feat/chai-sketch-vision-workpiece-breakdown` | ✅ **Merged & Live (PR #51)** `3094f08` · typecheck 0 errors · เทสต์ใหม่ 22/22 ผ่าน · deploy live สำเร็จ |
| **Task 77 (Sketch Breakdown & Studio Bridge)** | Replit | การ์ดแจกแจงงานช่าง AI + แก้ไขขนาดอิสระ + ปุ่มคู่ `[ 🎨 นำขนาดเข้าสู่ 2D Studio ➔ ]` เคียงข้างปุ่มส่งทีมขาย (PR #53) | `feat/replit-sketch-workpiece-and-studio-bridge` | ✅ **Merged & Live (PR #53)** `00bee44` · typecheck 0 errors · เทสต์ใหม่ 3/3 · การ์ดแจกแจงชิ้นงาน + ปุ่มคู่ Live บน Production |
| **Task 78 (Studio Bridge Logic)** | ชัย | สะพานเชื่อมข้อมูล URL query จาก /sketch สู่ 2D Studio (`studio-bridge.ts` ถอดมิติ + ประกอบชิ้นงาน) (PR #52) | `feat/chai-studio-bridge` | ✅ **Merged & Live (PR #52)** `50bf7c9` · typecheck 0 errors · เทสต์ใหม่ 17/17 ผ่าน · deploy live สำเร็จ |
| **Task 79 (Unified AI Cost Center)** | ชัย/เดวิด | แดชบอร์ดสรุปต้นทุนและการใช้งาน AI รวมทั้งบริษัท (น้องไนท์ LINE + เฮอร์มีส + Blueprint Vision) | — | 🔀 **แยกเป็น Task 82 (ชัย · API) + Task 83 (Replit · UI)** · ใบงานพร้อมแล้ว |
| **Task 80 (Stock Summary Row Filtering)** | ชัย | กรองแถว "รวมแผ่นทั้งหมด" ออกจาก API สต็อก Staron/Zen Stone + คืนยอด totalSheets จริง (PR #54) | `feat/chai-stock-exclude-summary-row` | ✅ **Merged & Live (PR #54)** `595a2ce` · typecheck 0 errors · เทสต์ใหม่ 8/8 ผ่าน · ตัดแถวสูตรสำเร็จรูปเรียบร้อย |
| **Task 81 (Stock Sorting & Copy Actions)** | Replit | เรียงลำดับตารางสต็อกรายคอลัมน์ (No/Name/Qty) + การ์ดยอดแผ่นรวม + ปุ่ม 1-Click คัดลอกส่ง LINE (PR #56) | `feat/replit-stock-table-sorting` | ✅ **Merged & Live (PR #56)** `761f3a9` · typecheck 0 errors · เทสต์ใหม่ 11/11 ผ่าน · เรียงตาราง+คัดลอก LINE สำเร็จ |
| **Task 82 (Unified AI Cost API)** | ชัย | API สรุปต้นทุน AI รวม 3 บริการ (น้องไนท์/Blueprint/เฮอร์มีส) + คำนวณเงินบาทต่อโมเดล (PR #55) | `feat/chai-ai-cost-center-api` | ✅ **Merged & Live (PR #55)** `5e0e090` · typecheck 0 errors · เทสต์ใหม่ 12/12 ผ่าน · deploy live สำเร็จ |
| **Task 83 (AI Cost Center UI)** | Replit | หน้าจอแดชบอร์ดต้นทุน AI ในหลังบ้าน (`/admin/ai-cost`) + Period Tabs + ตารางสรุป 3 เสาหลัก (PR #57) | `feat/replit-ai-cost-center-ui` | ✅ **Merged & Live (PR #57)** `4e27cbf` · typecheck 0 errors · เทสต์ใหม่ 4/4 ผ่าน · แดชบอร์ดต้นทุน AI Live บน Production |
| **Task 84 (Security & Vulnerability Audit)** | ชัย | ตรวจสอบความปลอดภัยและช่องโหว่ Source Code 5 ด้านหลัก + รายงานและเทสต์ความปลอดภัย (PR #58) | `feat/chai-security-audit-report` | ✅ **Merged (PR #58)** `cf82a9b` · typecheck 0 errors · เทสต์ใหม่ 6/6 ผ่าน · รายงานช่องโหว่ส่งมอบแล้ว |
| **Security Patch (Error Hygiene)** | เดวิด | ตัด error.message ดิบใน `sketch-vision.ts` ไม่ให้หลุดสู่ลูกค้าภายนอก (แก้ตาม Finding #2) | `main` | ✅ **Live บน VPS** · ป้องกัน Internal Info Disclosure สำเร็จ 100% |
| **Task 85 (Dashboard AI Cost Widget)** | Replit | ฝังการ์ดสรุปต้นทุน AI บนหน้าแรก Admin Dashboard (`/admin`) + ป้ายสถานะ 3 บริการ + ปุ่มลิงก์ลัด (PR #60) | `feat/replit-dashboard-ai-cost-widget` | ✅ **Merged & Live (PR #60)** `766725e` · typecheck 0 errors · เทสต์ใหม่ผ่าน · การ์ดสรุปต้นทุน AI Live บน Admin Dashboard |
| **Task 86 (Rate Limit IP Hardening)** | ชัย | ปิดช่องโหว่ Rate Limiter ป้องกันการปลอมแปลง IP ผ่าน X-Forwarded-For (แก้ตาม Finding #1) (PR #59) | `feat/chai-rate-limit-ip-hardening` | ✅ **Merged & Live (PR #59)** `35ea29b` · typecheck 0 errors · เทสต์ใหม่ 10/10 ผ่าน · ปิดช่องโหว่บายพาส IP ถาวร |
| **Task 87 (Final Security Verification)** | ชัย | ทดสอบและตรวจยืนยันความปลอดภัยรอบสุดท้าย (Security Regression & Final Sign-off) (PR #61) | `feat/chai-final-security-verification` | ✅ **Merged (PR #61)** `08c6ae3` · typecheck 0 errors · เทสต์ใหม่ 18/18 ผ่าน · ปิดรายงานความปลอดภัย 100% |
| **Task 88 (Export AI Cost to CSV)** | Replit | ปุ่มส่งออกรายงานต้นทุน AI เป็นไฟล์ CSV รองรับภาษาไทย (UTF-8 BOM) ในหน้า `/admin/ai-cost` (PR #62) | `feat/replit-ai-cost-export-csv` | ✅ **Merged & Live (PR #62)** `11b43aa` · typecheck 0 errors · เทสต์ใหม่ผ่าน · ปุ่มส่งออก CSV ภาษาไทย Live บน Production |
| **Task 89 (Fix Test Harness & Schema Drift)** | Replit | วินิจฉัยและซ่อมแซม Test Harness (แก้ Postgres 42703 + HTTP 502) ให้รัน Browser Tests ได้จริง (PR #63) | `feat/replit-fix-test-harness-schema` | ✅ **Merged (PR #63)** `4f0e380` · typecheck 0 errors · รัน Migration 015 สำเร็จแก้ 42703 ถาวร |
| **Task 90 (Studio Mobile Touch UX)** | Replit | ปรับปรุง Touch Target ปุ่มเลือกขอบและเลย์เอาต์ 2D Studio บนมือถือจอแคบ (360px - 390px) (PR #64) | `feat/replit-studio-mobile-touch` | ✅ **Merged & Live (PR #64)** `7e42fc0` · typecheck 0 errors · ปุ่มขอบสูง 43px + ปุ่ม Action 48px ไม่มีล้นขอบจอ |
| **Task 91 (Print Stock Report A4)** | Replit | ปุ่มพิมพ์รายงานสต็อกหิน A4 พร้อม Print Layout ทางการสำหรับเดินตรวจนับในโกดัง (PR #65) | `feat/replit-stock-print-report` | ✅ **Merged & Live (PR #65)** `1fbeb8f` · typecheck 0 errors · เทสต์ใหม่ 3/3 ผ่าน · พิมพ์รายงาน A4 สวยงาม Live บน Production |
| **Studio Guide Gallery** | เดวิด | คลังภาพหมุนวนอัตโนมัติบนหน้า `/studio-guide` (6 ภาพที่เจ้าของส่งมา · cross-fade 4.5 วิ · ป้ายทรง/ประเภท + คำบรรยายใต้ภาพ · หยุดหมุนเมื่อ hover/แตะจุด) | `main` | ✅ **Live บน VPS** · เทสต์ใหม่ 11/11 · รูปทุกใบ HTTP 200 `image/webp` · ไฟล์ `src/data/studio-guide-gallery.ts` |
| **Task 92 (Sketch & Studio QA Sweep)** | Replit | รีเช็คและกวาดแก้บั๊ก UI/UX หน้า /sketch และ /studio (Touch target, disabled states, Bridge params, validation) | `feat/replit-sketch-studio-qa-sweep` | ✅ **Merged & Live (PR #66)** `0aa2dd3` · typecheck 0 errors · เทสต์ใหม่ 3/3 ผ่าน + related 16/16 · ล็อกปุ่มกดรัว + ล็อกราคาก่อนประกอบผัง 100% |
| **Task 93 (Client Security & Data Tampering)** | Replit | ตรวจสอบและปิดช่องโหว่การแอบแก้ราคา (Data Tampering) และ XSS Injection ในช่องกรอกข้อมูลลูกค้า (PR พร้อมเทสต์) | `feat/replit-security-data-tampering` | ✅ **Merged & Live (PR #69)** `d6b8efe` · typecheck 0 errors · เทสต์ใหม่ 3/3 ผ่าน · sanitize ข้อความไทย + ล็อกราคาและมิติฝั่งหน้าบ้าน 100% |
| **Task 94 (Server-Side Price Integrity Guard)** | ชัย | สร้างระบบตรวจสอบราคาและมิติชิ้นงานฝั่งเซิร์ฟเวอร์ ป้องกัน Tampered Payloads / ปลอมแปลงราคาติดลบ (PR พร้อมเทสต์) | `feat/chai-server-price-integrity` | ✅ **Merged & Live (PR #67)** `62ac160` · typecheck 0 errors · เทสต์ใหม่ 20/20 ผ่าน · HTTP 400 ดักจับราคาติดลบ/ปลอมแปลงสำเร็จบน VPS |
| **Task 95 (Fabrication Geometry & Cutout Clash)** | ชัย | สร้างโมดูลตรวจสอบเรขาคณิตชิ้นงานเคาน์เตอร์และระยะขอบเจาะปลอดภัยขั้นต่ำ 100 มม. (Clash Detection) (PR พร้อมเทสต์) | `feat/chai-fabrication-geometry-validator` | ✅ **Merged & Live (PR #68)** `ea9f1f7` · typecheck 0 errors · เทสต์ใหม่ 28/28 ผ่าน · ล็อกระยะปลอดภัย 100 มม. และตรวจจุดชนรอยต่อสำเร็จ |
| **Task 96 (Studio Basin Clash Warning UI)** | Replit | เชื่อมต่อ UI แจ้งเตือนระยะเจาะปลอดภัยขั้นต่ำ 100 มม. และเตือนวางอ่างทับรอยต่อแผ่นหินในหน้า 2D Studio | `feat/replit-studio-basin-clash-ui` | ✅ **Merged & Live (PR #71)** `8dc6a62` · typecheck 0 errors · เทสต์ใหม่ 3/3 ผ่าน · ล็อกระยะปลอดภัย 100 มม. + เตือนทับรอยต่อ + ปิดปุ่มส่งเมื่อเกิด Clash บน VPS |
| **Task 97 (Leads Fabrication Safety Audit)** | ชัย | เชื่อมต่อระบบตรวจสอบความปลอดภัยงานช่าง (ขอบ 100 มม. + รอยต่อ) เข้ากับ Lead API ทั้งฝั่งลูกค้าและแอดมิน | `feat/chai-leads-fabrication-audit` | ✅ **Merged & Live (PR #70)** `a20231b` · typecheck 0 errors · เทสต์ใหม่ 7/7 ผ่าน · บันทึก fabricationWarnings สู่ Lead จริงบน VPS |
| **Task 98 (Admin Leads Fabrication Badges)** | Replit | แสดงป้ายเตือนจุดเสี่ยงงานช่างบนการ์ด Lead หลังบ้าน + ตัวกรองคัดกรองงานช่างก่อนลงมือผลิต | `feat/replit-admin-leads-fabrication-badge` | ✅ **Merged & Live (PR #74)** `733bf10` · typecheck 0 errors · เทสต์ใหม่ 4/4 ผ่าน · ป้ายเตือนจุดเสี่ยงงานช่าง + ตัวกรอง บน VPS |
| **Task 99 (API Body & Payload Size Guard)** | ชัย | วางระบบตรวจสอบขนาด Body และป้องกัน Nested Object / JSON Bomb DoS บน API Server | `feat/chai-payload-size-guard` | ✅ **Merged & Live (PR #72)** `7221c8c` · typecheck 0 errors · เทสต์ใหม่ 13/13 ผ่าน · ป้องกัน Large Payload 256KB + Nested Bomb 10 ชั้น บน VPS |
| **Task 100 (Portfolio API Resilience & Fallback)** | ชัย | เสริม Resilience ให้ Portfolio API คืน 200 OK ปลอดภัยเมื่อขาดไฟล์ Fixture ป้องกัน Error 500 | `feat/chai-portfolio-api-resilience` | ✅ **Merged & Live (PR #73)** `7348b5e` · typecheck 0 errors · เทสต์ใหม่ 7/7 ผ่าน · API คืน 200 OK ปลอดภัย 100% บน VPS |
| **Task 101 (Network Offline & Error Resilience UI)** | Replit | เพิ่มตัวตรวจจับสถานะเน็ตหลุด (Offline Banner) และ Graceful Error Boundary ป้องกันหน้าขาว | `feat/replit-network-resilience-ui` | 📋 **เตรียมพร้อมแล้ว** (`qa/job-101-replit-network-resilience-ui.md`) |
| **Task 102 (Portfolio Add & Delete API)** | ชัย | API เพิ่มรูป (upload) และลบรูป (delete + ลบไฟล์จริง) + ตรวจจับรูปซ้ำ ในคลังผลงาน | `feat/chai-portfolio-admin-write` | 🟡 **มอบหมายแล้ว** (`qa/job-102-chai-portfolio-admin-write.md`) |
| **Task 103 (Admin Portfolio Add/Delete UI)** | Replit | ปุ่ม ➕ เพิ่มรูป และ 🗑 ลบรูป ในหน้า `/admin/portfolio` + ป้าย 🔁 รูปซ้ำ + ตัวกรอง | `feat/replit-admin-portfolio-write-ui` | 📋 **เตรียมพร้อมแล้ว** (รอ Task 102 merge) (`qa/job-103-replit-admin-portfolio-write-ui.md`) |
| **Studio Basin 5-Col** | เดวิด | ขยายถาดเลือกอ่างใน 2D Studio เป็น 5 คอลัมน์ (จาก 3) + กว้าง 1080px | `482ada0` | ✅ **Live บน VPS** · 5 คอลัมน์/การ์ด 194px · มือถือ 2 คอลัมน์ |
| **Address Input Fix** | เดวิด | แก้ช่อง "ที่อยู่/สถานที่ติดตั้ง" พิมพ์ต่อไม่ได้ + เลิกขึ้น "กำลังค้นหาตำแหน่ง" หลอกทุกคีย์ | `30de2ba` | ✅ **Live บน VPS** · ผ่าน 2/2 tests · พิมพ์เร็ว 4 ตัวติดครบ + suggestions 5 รายการ |
| **Readme Hub & Showcase** | เดวิด | ฝังภาพผลงานจริงเลื่อนวนใน /readme + การ์ดทางลัด 3 ศูนย์ข้อมูล (คลังภาพ/หน้างาน/Studio) | `b432217` | ✅ **Live บน VPS** · ผ่าน 3/3 tests · ภาพเลื่อนจริง + ลิงก์ 3 Hubs |
| **TopView Live** | เดวิด | เชื่อมภาพ Top View จริง 30 รุ่นของคุณนพลงบน 2D Studio ทุกทรงเคาน์เตอร์ (อัปเกรด V2 ไร้ขอบ 30/30 รุ่น) | `87a6bc5` + VPS V2 | ✅ **Live บน VPS** · ภาพ Top View ตัดขอบเนียน 100% ครบทั้ง 30 รุ่นใน Production |
| **Sales Msg** | เดวิด | ปุ่ม 1-Click คัดลอกข้อความน้องไนท์ (ค่ะ/ดิฉัน) ส่งลูกค้าทาง LINE | `d893aed` | ✅ **Live บน VPS** · ปุ่ม "ข้อความส่งลูกค้า" บนทุก Lead (72 ราย) |
| **Task 45** | Replit | ปุ่มเลือก Preset ขนาดเคาน์เตอร์สำเร็จรูป 4 ขนาดใน 2D Studio | `feat/replit-counter-size-presets-ui` | ✅ **Live บน VPS** · PR #21 merge + deploy · ปุ่ม 1.2/1.5/1.8/2.0ม. ใช้งานได้จริง |
| **Task 24-PREP** | Replit | เตรียมหน้าจอทีมช่าง + ปฏิทิน ผ่านไฟล์สะพานชั่วคราว (build เขียว, ไม่มี mock data) | — | 🟡 มอบหมายแล้ว (`qa/job-24prep-replit-technician-teams.md`) |
| **Task 24** | Replit | สลับไฟล์สะพาน -> generated hooks จริง + ลบไฟล์สะพาน + ทดสอบด้วยข้อมูลจริง | — | ⏸ รอ 23 merge + codegen |
| **Task 25A/B** | ชัย/เดวิด | ตัวจับคู่ชื่อทีมช่างทนการสะกดผิด/ตัดคำ (fuzzy match) + confidence (manual/exact/prefix/fuzzy) | `fff0e71` / `91070c2` | ✅ **Live บน VPS** · เทสต์ 29/29 ผ่าน 100% · OpenAPI schema ครบ |
| **Task 30** | ชัย/เดวิด | ขยาย PATCH /admin/leads/:id ให้บันทึก/merge studioData ครบชุดโดยไม่ลบ sketchUrls | `3e255b6` | ✅ **Live บน VPS** · เทสต์ผ่าน ยืนยัน sketchUrls คงอยู่ครบ 100% |
| **Footer** | เดวิด | ยุบขนาด Footer ลดความสูงจาก 346px -> 175px (ลดพื้นที่ 50%) padding 72->20px | `f11b485` | ✅ **Live บน VPS** · จัดวางแบรนด์+ข้อมูลติดต่อ 2 คอลัมน์ |
| **Task 26** | Replit | **โหมดง่ายหน้า Studio** — เจ้าของสั่ง 24 ก.ย. ("ทำแบบยุ่งยาก/เบื่อ/อ่านไม่ออก") ซ่อนคอนโทรลละเอียด เหลือ สี·รูปทรง+ขนาด·อ่าง·บัว → ผัง+ราคา | — | 🟡 มอบหมายแล้ว (`qa/job-26-replit-studio-simple-mode.md`) |
| **Sketch E2E** | เดวิด | ทดสอบ "รับภาพสเก็ตช์" ปลายทางบน production (ค้างตั้งแต่ 14 ก.ย.) | — | ✅ ผ่าน: HTTP 201 · lead เข้า DB · รูป 200 · ลบของทดสอบแล้ว |
| **Task 27** | เดวิด | แก้ 2 บั๊กจากที่เจ้าของทดสอบ: (1) ตัดบรรทัด `WORKPIECES` ฿0 ออกจากใบเสนอราคา (2) ผังพิมพ์บอกแนวอ่าง+ขนาดหลุม — **เจ้าของอนุมัติ · เดวิดทำเอง** | `14cf0e8` / merge `9c8f6f3` | ✅ **Live บน VPS** · ผังพิมพ์ขึ้น `KF009 · 350×500 มม. · แนวนอน` |
| **Notify calc** | เดวิด | ข้อความแจ้งทีมขายแสดง **วิธีคำนวณ** ต่อบรรทัด + ป้าย "อ่างที่ลูกค้าสนใจ (ยังไม่ได้เลือกเข้าออเดอร์)" — เจ้าของสั่ง 24 ก.ย. | `dcc743a` | ✅ **Live บน VPS** · tests 15/15 |
| **verify_deploy** | เดวิด | ชี้เป้าสคริปต์ตรวจสุขภาพจาก knightdesign → **Knight Basins** — เลิกสัญญาณหลอก 7 ข้อ | `bin/verify_deploy.py` | ✅ **22/22 passed** |
| **KB pricing** | เดวิด | บันทึก: ขาย 3 ประเภท + หน่วยราคา + ที่ไหนบนเว็บ · ลำดับการตอบราคา · 4 กลุ่มสี 3 เรต · ขายแผ่นไม่คูณอะไร | `pricing.md` + HANDOFF §3 | ✅ sync เข้า prompt บอทแล้ว (LINE 29,391 chars) |
| **Task 26** | Replit | โหมดง่ายหน้า Studio (ซ่อนคอนโทรลละเอียด) — เจ้าของอนุมัติ deploy | `da4e7a3` / merge `3e4c914` | ✅ **Live บน VPS** · asset `index-CgJV3olN.js` · โหมดง่าย default · ขอบอัตโนมัติ บน=ติดบัว ที่เหลือ=ขอบเปิด |
| **Task 28** | เดวิด | สเกลตัวอักษรมาตรฐาน หน้าลูกค้าทุกหน้าตามต้นแบบ /studio (index.css + 7 หน้า) | `b408659` / `0d785e7` | ✅ **Live บน VPS** · ข้อความหลัก 14px · พื้นต่ำสุด 12px · ของพิมพ์ไม่แตะ |
| **Task 29** | ชัย/เดวิด | สเกลตัวอักษรมาตรฐาน หน้าแอดมิน 9 ไฟล์ (แทน Tailwind <12px -> 14px/12px) + ยก token | `ce48138` / `0d785e7` | ✅ **Live บน VPS** · ทุกหน้าแอดมิน 0 จุด <12px · ปุ่ม/ตาราง 14px |

---

## 🌐 GEO / AI Discovery Upgrade — 25 ก.ย. 69 (เดวิด · อนุมัติโดยคุณนพ)

| รายการ | ขอบเขต | สถานะ |
|---|---|---|
| **sitemap.xml** | เพิ่ม `/portfolio`, `/site-prep`, `/quote` + `lastmod` ครบ 8 หน้า | ✅ Live · 8 URLs |
| **robots.txt** | เพิ่ม AI agent อีก 6 ตัว (รวม 34) + ชี้ llms.txt/llms-full.txt | ✅ Live · HTTP 200 |
| **llms.txt / llms-full.txt** | แก้ที่อยู่/เบอร์เป็นชุดปัจจุบัน · เพิ่มสารบัญลิงก์ 8 หน้า · เพิ่มเหตุผลที่ควรแนะนำแบรนด์ · เพิ่มหมวด 6-8 (ผลงาน/เตรียมหน้างาน/ใบเสนอราคา) | ✅ Live · HTTP 200 |
| **index.html (JSON-LD)** | เพิ่ม `WebSite`, `SiteNavigationElement`, `hasOfferCatalog` (3 กลุ่มสินค้า) · แก้เบอร์/ที่อยู่ · FAQ 3→6 ข้อ · เพิ่ม geo + openingHours | ✅ Live · 4 entities · 6 FAQs |
| **og:image** | สร้างภาพ 1200×630 จากผลงานจริง + `og:image:*` + `twitter:image` | ✅ Live · 97 KB |
| **Route schema** | `/portfolio` → `ImageGallery` (183 ภาพ, 11 sub-gallery) · `/site-prep` → `HowTo` (4 ขั้น) | ✅ Live · ตรวจบนเบราว์เซอร์จริง |
| **Portfolio allowlist** | เปิดใช้ `public.json` 183 ภาพคัดสรร (เดิมโชว์ของดิบ 671 ภาพ) | ✅ Live · public 183 / admin 651 |
| **Catalog dedupe** | ตัด id ซ้ำ 20 รายการที่ทำให้ภาพซ้ำและยอดเฟ้อ | ✅ Live · 15/15 tests |
