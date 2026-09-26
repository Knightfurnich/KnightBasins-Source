# ใบงาน 83 (Replit) — หน้าจอแดชบอร์ดสรุปต้นทุน AI รวมทั้งบริษัท (Unified AI Cost Center UI)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — รอ Task 82 (ชัย) merge ก่อนจึงเริ่ม

**ที่มาและความต้องการ:**
สร้างหน้าจอผู้บริหารในหลังบ้าน (`/admin/ai-cost`) เพื่อให้คุณนพเห็นต้นทุนการใช้ AI ของทั้งบริษัทในหน้าจอเดียว โดยดึงข้อมูลจาก API ที่ชัยสร้างใน Task 82 (`GET /admin/ai-cost-center`):

1. **หน้าใหม่ `artifacts/knight-basins/src/admin/AiCostCenterPage.tsx`:**
   - **แถบเลือกช่วงเวลา (Period Tabs):** `วันนี้` · `7 วัน` · `30 วัน` · `ทั้งหมด`
   - **การ์ด KPI 4 ใบด้านบน:**
     * `ต้นทุนรวม (บาท)` — ยอดรวมค่า AI ทั้งบริษัท
     * `จำนวนคำขอทั้งหมด` — จำนวนครั้งที่เรียกใช้ AI
     * `โทเค็นรวม` — จำนวน token ทั้งหมด
     * `ต้นทุนเฉลี่ยต่อคำขอ` — คำนวณเป็นสตางค์ต่อครั้ง
   - **ตารางสรุปแยกตามบริการ (3 เสาหลัก):** บริการ · จำนวนคำขอ · โทเค็น · ต้นทุน (บาท) · สถานะ
     * น้องไนท์ (LINE Bot ผู้ช่วยขาย)
     * AI Blueprint Reader (อ่านแบบร่าง)
     * เฮอร์มีส (งานบริหารระบบ & งานช่าง)
   - **ตารางแยกตามโมเดล (Model Breakdown):** โมเดล · จำนวนคำขอ · ต้นทุน (บาท)
   - ปุ่ม `รีเฟรช` ดึงข้อมูลใหม่
   - แสดงสถานะกำลังโหลด (skeleton) และสถานะข้อผิดพลาดพร้อมปุ่มลองใหม่
2. **เชื่อมเมนูหลังบ้าน:**
   - เพิ่มรายการเมนู `ต้นทุน AI` ในแถบนำทางของหลังบ้าน พร้อม route `/admin/ai-cost`
   - ต้องเคารพระบบสิทธิ์เดิม (`requireAdminPermission("leads")`) — ถ้าไม่มีสิทธิ์ให้ขึ้นข้อความแจ้ง ไม่ใช่หน้าว่าง
3. **ห้ามมีข้อมูลลับบนหน้าจอ:**
   - ห้ามแสดง API key, token ของผู้ให้บริการ, หรือข้อมูลส่วนตัวลูกค้าใดๆ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/admin/AiCostCenterPage.tsx (ใหม่):
     - เรียก GET /api/admin/ai-cost-center?period=<today|7d|30d|all>
     - แสดง Period Tabs, การ์ด KPI 4 ใบ, ตาราง services และตาราง modelBreakdown
     - มี data-testid: "ai-cost-page", "tab-ai-cost-period-<period>", "card-ai-cost-total",
       "card-ai-cost-requests", "card-ai-cost-tokens", "card-ai-cost-average",
       "table-ai-cost-services", "table-ai-cost-models", "button-ai-cost-refresh"
     - จัดรูปแบบตัวเลขเงินบาทแบบไทย (th-TH) ทศนิยม 2 ตำแหน่ง
  2. เพิ่ม route และเมนูใน artifacts/knight-basins/src/App.tsx:
     - path "/admin/ai-cost" -> AiCostCenterPage
     - เพิ่มเมนูชื่อ "ต้นทุน AI" ในกลุ่มเมนูหลังบ้าน (ไม่กระทบเมนูเดิม)
  3. สร้าง artifacts/knight-basins/test/ai-cost-center-ui.test.ts (ใหม่):
     - ทดสอบว่ามี data-testid ตามรายการข้างบนครบ
     - ทดสอบว่ามีการเรียก /api/admin/ai-cost-center พร้อม query period
     - ทดสอบว่ามีการจัดรูปแบบเงินบาทและไม่แสดงค่า key/token ใดๆ
  4. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์สำหรับหน้าต้นทุน AI (การ์ด KPI, ตาราง, แถบช่วงเวลา) ให้สอดคล้องธีมเดิมของหลังบ้าน

SCOPE:
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/src/admin/AdminApp.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/ai-cost-center-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้ามแสดง API key, token หรือข้อมูลส่วนตัวลูกค้าบนหน้าจอ
  - ห้ามลบหรือแก้เมนูหลังบ้านเดิมที่มีอยู่
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-ai-cost-center-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 387 / pass 381 / fail 2 / cancelled 3 / skipped 1
  4) เทสต์ใหม่ใน ai-cost-center-ui.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริง พร้อมแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-ai-cost-center-ui (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้า GET /admin/ai-cost-center ยังไม่พร้อมใช้งาน ให้รายงานแล้วรอ Task 82
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการ์ด KPI ตารางสรุป และการเลือกช่วงเวลา | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
