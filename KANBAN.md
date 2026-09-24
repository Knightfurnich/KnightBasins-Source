# 📋 KNIGHT BASINS — PROJECT KANBAN

> อัปเดตล่าสุด: 24 กันยายน 2569 (โดย เดวิด)  
> แหล่งรวมสถานะงานและการส่งมอบของทีมงาน (เดวิด / ชัย / Replit)

---

## 📌 สรุปภาพรวมสถานะ (Kanban Board)

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│       📝 TO DO          │     🔄 IN PROGRESS      │        ✅ DONE          │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Task 24 (Replit)      │ • ปรับแต่งคิวงานจริง     │ • Task 1-19 (ชัย):      │
│   สลับ hook จริง +      │   เข้าปฏิทิน 10 ทีม     │   Core, Slips, Places,  │
│   ลบไฟล์สะพาน           │                         │   Cockpit & Calendar API│
│ • Task 26 (Replit)      │                         │ • Replit: Dashboard,    │
│   โหมดง่ายหน้า Studio   │                         │   Cockpit, Calendar UI  │
│   (เจ้าของสั่ง 24 ก.ย.) │                         │ • Contact Info (Live)   │
│ • แจ้งเตือนอัตโนมัติ     │                         │ • Task 23 (ชัย)         │
│   (LINE/SMS/Email)      │                         │   technician_teams +    │
│   Coming Soon           │                         │   migration 012 (Live)  │
│                         │                         │ • รับภาพสเก็ตช์ (/sketch)│
│                         │                         │   ทดสอบปลายทางผ่านแล้ว   │
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
| **Task 24** | Replit | สลับไฟล์สะพาน -> hook จริง (`useListAdminTechnicianTeams`) + ลบไฟล์สะพาน | — | 🟡 มอบหมายแล้ว (`qa/job-24-replit-final.md`) |
| **Task 24-PREP** | Replit | เตรียมหน้าจอทีมช่าง + ปฏิทิน ผ่านไฟล์สะพานชั่วคราว (build เขียว, ไม่มี mock data) | — | 🟡 มอบหมายแล้ว (`qa/job-24prep-replit-technician-teams.md`) |
| **Task 24** | Replit | สลับไฟล์สะพาน -> generated hooks จริง + ลบไฟล์สะพาน + ทดสอบด้วยข้อมูลจริง | — | ⏸ รอ 23 merge + codegen |
| **Task 25A** | ชัย | ตัวจับคู่ชื่อทีมช่างทนการพิมพ์ผิด/ตัดคำ (fuzzy match) | — | 📝 ร่างครบ 12/12 ยังไม่ส่ง (รอ 23 merge ก่อน ไม่ให้ชน `admin-router.ts`) |
| **Task 26** | Replit | **โหมดง่ายหน้า Studio** — เจ้าของสั่ง 24 ก.ย. ("ทำแบบยุ่งยาก/เบื่อ/อ่านไม่ออก") ซ่อนคอนโทรลละเอียด เหลือ สี·รูปทรง+ขนาด·อ่าง·บัว → ผัง+ราคา | — | 🟡 มอบหมายแล้ว (`qa/job-26-replit-studio-simple-mode.md`) |
| **Sketch E2E** | เดวิด | ทดสอบ "รับภาพสเก็ตช์" ปลายทางบน production (ค้างตั้งแต่ 14 ก.ย.) | — | ✅ ผ่าน: HTTP 201 · lead เข้า DB · รูป 200 · ลบของทดสอบแล้ว |
| **Bug: ใบเสนอราคา** | — | ตัดรายการ 3 `WORKPIECES` (฿0) ออกจากใบเสนอราคา — เจ้าของสั่ง 24 ก.ย. | — | 🔴 ยังไม่แก้ (รออนุมัติ) |
| **Bug: ใบงานผลิต** | — | ใบงานพิมพ์ไม่บอกว่าอ่างหันแนวไหน (`StudioPlacementPreview` แสดงแค่ SKU) | — | 🔴 ยังไม่แก้ (รออนุมัติ) |
