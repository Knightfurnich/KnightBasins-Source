# 📋 KNIGHT BASINS — PROJECT KANBAN

> อัปเดตล่าสุด: 24 กันยายน 2569 (โดย เดวิด)  
> แหล่งรวมสถานะงานและการส่งมอบของทีมงาน (เดวิด / ชัย / Replit)

---

## 📌 สรุปภาพรวมสถานะ (Kanban Board)

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│       📝 TO DO          │     🔄 IN PROGRESS      │        ✅ DONE          │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • ระบบแจ้งเตือนอัตโนมัติ  │ • ปรับแต่งคิวงานจริง     │ • Task 1-19 (ชัย):      │
│   (LINE/SMS/Email)      │   เข้าปฏิทิน 10 ทีม     │   Core, Slips, Places,  │
│   Coming Soon           │                         │   Cockpit & Calendar API│
│                         │                         │ • Replit: Dashboard,    │
│                         │                         │   Cockpit, Calendar UI  │
│                         │                         │ • Contact Info (Live)   │
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
