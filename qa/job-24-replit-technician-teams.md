# ใบงานที่ 24 (Replit) — หน้าจัดการทีมช่าง + dropdown จาก API · Frontend

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL      : (1) สร้างหน้าใหม่ /admin/technician-teams ให้แอดมินเพิ่ม / แก้ชื่อ / เปิด-ปิดใช้งาน
            ทีมช่างติดตั้ง (2) หน้าปฏิทินคิวช่างเลิกใช้รายชื่อทีมที่ฝังในโค้ด -> ดึงจาก API

SCOPE     : /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TechnicianTeamsManager.tsx  (ใหม่)
            /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
            /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
            /opt/data/cache/kbsrc/lib/api-client-react/**  (จาก codegen เท่านั้น ห้ามแก้มือ)

FORBIDDEN : ห้ามแตะ artifacts/api-server/** (งานของชัย — ใบงานที่ 23)
            ห้ามแตะ index.css · print layout · ใบเสนอราคา (App.tsx ส่วน formal-*)
            ห้ามแตะ StudioPage.tsx (ปิดงานแล้วในใบงานที่ 21)
            ห้าม hardcode รายชื่อทีมกลับเข้าไปในโค้ดอีก
            ห้ามใส่ font-size เป็น px ใหม่ — ใช้ <h1>/<h2>/<h3> แล้วให้ CSS type scale จัดการ
            ห้าม push เข้า main ตรง ๆ

EVIDENCE  : 1) pnpm run typecheck จาก root -> 0 errors
            2) PORT=3000 pnpm run --filter @workspace/knight-basins build -> ผ่าน + verify-production-assets OK
            3) screenshot หน้า /admin/technician-teams ที่มีทีมจริงแสดงอยู่
            4) screenshot dropdown "ทีมช่าง" ในปฏิทิน ที่ดึงชื่อจาก API
            5) branch + commit hash

OUTPUT    : ลิงก์ branch/PR · ไฟล์ที่แก้ + จำนวนบรรทัด · หลักฐาน 4 ข้อข้างบน

STOP      : หยุดแล้วรายงานถ้า typecheck ไม่ผ่านและแก้ไม่ได้ใน 1 รอบ ห้ามเดาต่อ
```

**Branch:** `feat/replit-technician-teams-manager`

**เอกสารแนบ (สัญญา API + โค้ดเต็มไฟล์ 100% ทำตามได้เลย ไม่ต้องถามกลับ):**
`knight-design-kb/qa/job-24-replit-technician-teams-spec.md`

**สรุปหัวใจของสเปก (รายละเอียดเต็มอยู่ในเอกสารแนบ):**
- สัญญา API พร้อมใช้ทันที: `GET /api/admin/technician-teams` (+`?includeInactive=1`) ·
  `POST /api/admin/technician-teams` · `PATCH /api/admin/technician-teams/:id`
  (แก้ `code` ไม่ได้ · รหัส = `^[A-Z]{2,8}$` · ไม่มี DELETE — ลดทีมใช้ `active: false`)
- โค้ด `TechnicianTeamsManager.tsx` เต็มไฟล์อยู่ในเอกสารแนบ พร้อม `data-testid` ทุกจุด
- ปฏิทิน: ลบอาร์เรย์ `TECHNICIAN_TEAMS` ที่ฝังในไฟล์ออกทั้งก้อน แล้วใช้
  `useGetAdminTechnicianTeams()` — ห้ามเขียนรายชื่อสำรองไว้ในโค้ด
- `AdminApp.tsx`: เพิ่มเมนู `{ href: "/admin/technician-teams", label: "ทีมช่างติดตั้ง", exact: false, permission: "leads" }`
  + route ที่มี `AdminPermissionGate permission="leads"`
- ใช้ token/CSS เดิมทั้งหมด (`var(--line)`, `var(--card-paper)`, `var(--ink)`, `var(--brand-blue)`) และ `rounded-none`
