# ใบงาน 53 (Replit) — หน้าศูนย์สำรองข้อมูลสำหรับแอดมิน (/admin/backup)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบบ (คุณนพ) ต้องการให้มีหน้าจอสำรองและส่งออกข้อมูล (Data Backup & Vault) ในหน้าแอดมิน โดยให้ Admin และ Owner มองเห็นเมนูนี้ร่วมกัน เพื่อให้สามารถกดดาวน์โหลดสำรองข้อมูลลูกค้า สเปกอ่าง และสถานะฐานข้อมูลเก็บไว้บนเครื่องคอมพิวเตอร์ได้ในคลิกเดียว

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างหน้าจอสำรองข้อมูล `/admin/backup` สำหรับ Admin / Owner:
  1. สร้างคอมโพเนนต์ `BackupVaultPage.tsx` ใน `artifacts/knight-basins/src/admin/`:
     - แสดงการ์ดสำรองข้อมูล 4 หมวดหมู่ชัดเจน:
       ก) 👥 ข้อมูลลูกค้าและคำสั่งซื้อ (Customer Leads): ปุ่มดาวน์โหลด CSV (Excel)
       ข) 📸 ภาพถ่ายหน้างานจริง (Site Photos): สถิติจำนวนภาพ พร้อมปุ่มไปยังคลังภาพหน้างาน
       ค) 🏷️ แคตตาล็อกอ่าง 30 รุ่นและราคา (Basins Catalog): ปุ่มดาวน์โหลดข้อมูลอ่าง CSV
       ง) 🗄️ ฐานข้อมูลระบบ (Database Status): แสดงสถานะความสมบูรณ์และคำแนะนำการกู้คืน
     - มีป้ายกำกับสิทธิ์: `🛡️ เข้าถึงโดย: ผู้ดูแลระบบ (Admin / Owner)`
  2. ผูก Route และเมนูด้านข้างใน `AdminApp.tsx`:
     - เพิ่มรายการเมนู `"สำรองข้อมูล"` ใน `NAV_ITEMS` (แสดงเฉพาะผู้ที่มีสิทธิ์ Admin หรือ Owner: `access.role === 'owner' || access.canManageTeam`)
     - เพิ่ม `<Route path="/admin/backup" component={AdminBackupRoute} />`
  3. เขียน Unit tests ใน `admin-backup-vault.test.ts` ยืนยันการแสดงผลครบทั้ง 4 หมวดหมู่และการตรวจสิทธิ์

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/admin/BackupVaultPage.tsx (ใหม่)
  2. artifacts/knight-basins/src/admin/AdminApp.tsx
  3. artifacts/knight-basins/test/admin-backup-vault.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-backup-vault แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 233 / pass 228 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - แถบเมนูด้านข้างแสดงเมนู "สำรองข้อมูล"
     - หน้าจอ `/admin/backup` แสดงการ์ดครบทั้ง 4 หมวดหมู่

OUTPUT:
  - branch: feat/replit-backup-vault (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน AdminApp.tsx:
     - ใน `NAV_ITEMS`:
       `{ href: "/admin/backup", label: "สำรองข้อมูล", exact: false, permission: null, adminOnly: true }`
     - แสดงเมนูเฉพาะเมื่อ:
       `("adminOnly" in item && item.adminOnly) ? (access.role === "owner" || access.canManageTeam) : ...`
     - Route:
       ```tsx
       function AdminBackupRoute() {
         const access = useAdminAccess();
         if (access.role !== "owner" && !access.canManageTeam) {
           return <div className="p-8 text-center text-[var(--ink-soft)]">หน้านี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin / Owner)</div>;
         }
         return <BackupVaultPage />;
       }
       ```
  2. ปุ่มดาวน์โหลดใน BackupVaultPage.tsx:
     - ปุ่มดาวน์โหลดลูกค้า: ลิงก์หรือเรียก `/api/admin/backup/leads-export`
     - ปุ่มดาวน์โหลดอ่าง: ลิงก์หรือเรียก `/api/admin/backup/basins-export`
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ หน้าศูนย์สำรองข้อมูลสำหรับแอดมิน (/admin/backup) |
| 2 | GOAL วัดได้ | ✅ 4 หมวดการ์ด + AdminApp route + Role gate + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 233/228/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-backup-vault |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 233 / pass 228 / fail 2 |
| 9 | CONTRACT ระบุการล็อกสิทธิ์และ Route ชัด | ✅ โค้ด JSX และ adminOnly ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
