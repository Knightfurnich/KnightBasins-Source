# 📋 KNIGHT BASINS — PROJECT KANBAN

> อัปเดตล่าสุด: 24 กันยายน 2569 (โดย เดวิด)  
> แหล่งรวมสถานะงานและการส่งมอบของทีมงาน (เดวิด / ชัย / Replit)

---

## 📌 สรุปภาพรวมสถานะ (Kanban Board)

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│       📝 TO DO          │     🔄 IN PROGRESS      │        ✅ DONE          │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • แจ้งเตือนระยะ 100mm   │ • Task 13 (ชัย):       │ • Task 1-12 (ชัย):      │
│   บนหน้า 2D Studio UI   │   ระบบตรวจระยะขอบอ่าง   │   ฟังก์ชัน Core, Slips, │
│                         │   100 มม.               │   Places API, Dashboard │
│ • ระบบแจ้งเตือนงาน      │                         │   Stats & Export CSV    │
│   ติดตั้งเข้า LINE ทีม  │ • Replit Dashboard:     │                         │
│                         │   Executive & Team      │ • Replit Studio UI:     │
│                         │   Dashboard (รอ push)   │   Attachment 4 ทิศทาง   │
│                         │                         │   และ Google Maps Links │
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
| **Task 10** | ชัย | ปุ่มและฟังก์ชัน Export Leads เป็น Excel / CSV (RFC 4180 + UTF-8 BOM) | `c422f77` / `a41da7d` | ✅ Merge เข้า main แล้ว |
| **Task 11** | ชัย | API Endpoint `GET /api/admin/dashboard-stats` (Hybrid Dashboard) | `d08cd6b` / `88bdf62` | ✅ Merge & Deployed |
| **Task 12** | ชัย | ตรวจสอบความถูกต้องเรขาคณิต 2D Studio (Attachment, Cycles, Cutout, DXF) | `9048c14` / `67ab234` | ✅ เทสต์ผ่าน 19/19 ข้อ |
| **Maps UI** | Replit | เชื่อมโยง Places Autocomplete ใน `/quote` + ปุ่ม `🗺️ เปิดแผนที่ Google Maps` ใน Admin Leads และใบสั่งผลิต | `37fe2cd` / `8a33647` | ✅ Merge & Deployed |
| **DB Sync** | เดวิด | เคลียร์สลิปจริงตกค้าง 7 ใบสุดท้าย ผูกกับ Leads 100% (Unassigned = 0) | Direct DB | ✅ ยอดเงิน 1.46M บาท |

---

### 🔄 IN PROGRESS (กำลังดำเนินการ)

| ใบงาน | ผู้รับผิดชอบ | หัวข้อ / ขอบเขต | ความคืบหน้า |
|:---:|:---:|:---|:---|
| **Task 13** | ชัย | ระบบตรวจระยะขอบปลอดภัยหลุมเจาะอ่าง 100 มม. (`STUDIO_BASIN_SAFETY_MARGIN_MM`) | `5f3c8e8` | ✅ เทสต์ผ่าน 13/13 ข้อ |
| **Task 15** | ชัย | API Cockpit Engine (ตัวกรอง 3 เดือน, เปรียบเทียบ 3 เดือน, เรดาร์ 10 ทีม, LINE briefing) | `a250b38` / `79b1ded` | ✅ Merge & Deployed บน VPS |

---

### 📝 UPCOMING BACKLOG (งานถัดไป)

1. **2D Studio Visual Warning (UI):** แสดงป้ายเตือนสีส้มบน Canvas เมื่อตำแหน่งหลุมอ่างห่างจากขอบน้อยกว่า 100 มม. (นำฟังก์ชันจาก Task 13 ของชัยไปต่อยอดบนหน้า UI)
2. **LINE Notify Installation Queue:** แจ้งเตือนคิวติดตั้งล่วงหน้า 1 วันเข้ากลุ่ม LINE ทีมงานอัตโนมัติ
