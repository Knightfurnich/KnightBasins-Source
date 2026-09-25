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
| **Calendar UI**| Replit/เดวิด | หน้าปฏิทินคิวช่าง `/admin/calendar` + Side Drawer 10 ทีม + Live API Wire | `b3f2bdc` / `00d7a79` | ✅ Live บน VPS |
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
| **TTS Phase 2** | ชัย | ระบบเลือกโทนเสียงน้องไนท์ในหน้าแอดมิน (ล็อกหญิง 5 โทนอารมณ์, migration 013, API, UI) | `feat/chai-support-voice-settings` | 🟡 ออกใบงานแล้ว (`qa/job-39-chai-support-voice-settings.md`) |
| **Task 38** | Replit | Top View อ่างเสมือนจริง + ท็อปเปลี่ยนสีตามหิน + ปุ่ม 2 ทางบนการ์ดอ่าง (PR #13) | `8a52a0d` | ✅ **Live บน VPS** · ปุ่ม 2 ทางบนการ์ดอ่าง, ผังแสดงเนื้อหิน, Top view อ่างมีสะดือ |
| **Task 31** | Replit | ระบบทีมขายวาด 2D Studio จากแบบร่างลูกค้า (ปุ่มใน Admin + Split View ดูรูปคู่ขนาน) (PR #9) | `ac8a8e6` | ✅ **Live บน VPS** · เปิดวาดจาก Lead, ดูรูปคู่ขนาน, บันทึกผังเข้า Lead |
| **Task 33** | ชัย | ยกระดับความปลอดภัย API Server ตามรายงาน Security Audit (PR #7) | `f4de3d9` | ✅ **Live บน VPS** · Sweep Map >1k, Secure cookie, Rate limit GET /quotes · 254 tests ผ่าน |
| **Task 34** | ชัย | สร้าง quoteNumber/quoteAccessSecret อัตโนมัติเมื่อทีมขายบันทึก studioData (PR #8) | `e7967e7` | ✅ **Live บน VPS** · สร้างเลขที่ใบเสนอราคา+โทเค็นอัตโนมัติ · 256 tests ผ่าน |
| **Task 35** | ชัย | Auto-match สีหินตามรุ่นอ่าง + คิดราคาพร้อมติดตั้งอัตโนมัติ (PR #10) | `8f2b7da` | ✅ **Live บน VPS** · KF001->VS311, KF009->NB091 8,500 บ./ตร.ม. · 192 tests ผ่าน |
| **Task 37** | ชัย | ปรับขนาดเริ่มต้นบอร์ด Studio เป็นขนาดจริง 1800x600 และเพิ่มตัวช่วยวางอ่าง | `feat/chai-studio-initial-dims` | 🟡 ออกใบงานแล้ว (`qa/job-37-chai-studio-initial-dims.md`) |
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
