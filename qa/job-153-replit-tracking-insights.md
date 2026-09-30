# ใบงาน 153 (Replit) — แผงควบคุมและแสดงสถิติการเปิดดูลิงก์ติดตามงานของลูกค้า (Customer Tracking Insights & Quick Share UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Customer Tracking Insights UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 148 Replit ได้สร้างปุ่มคัดลอกลิงก์ติดตามงานเบื้องต้นไว้แล้ว และใน Task 152 ชัยกำลังเพิ่มระบบนับยอดการเปิดดูของลูกค้า (`trackingViewCount`, `trackingViewedAt`)
งานนี้คือการอัปเกรดหน้าจัดการ Lead (`/admin/leads`) ให้ฝ่ายขายรู้ความเคลื่อนไหวของลูกค้าแบบเรียลไทม์:
1. **แสดง Badge / สถานะการเปิดดูของลูกค้าบนแถว Lead:**
   - ถ้าลูกค้าเคยเปิดดูแล้ว (`lead.trackingViewCount > 0`):
     แสดง Badge สีเขียว: **`[ 👁️ เปิดดูแล้ว {trackingViewCount} ครั้ง ]`** พร้อม tooltip บอกเวลาล่าสุด
   - ถ้ายังไม่เคยเปิดดู (`trackingViewCount === 0` หรือ `null`):
     แสดงข้อความสีเทา: **`[ ยังไม่เคยเปิดดู ]`**
2. **ในส่วนขยายรายละเอียดงาน (Expanded Lead Details):**
   - เพิ่มกล่องข้อมูล **"การติดตามงานของลูกค้า (Customer Portal Tracking)"**:
     - แสดงลิงก์ติดตามงานเต็ม
     - วันเวลาที่ลูกค้าเปิดดูล่าสุด (ฟอร์แมตภาษาไทย เช่น `30 ก.ย. 69 14:22 น.`)
     - ปุ่ม **`[ 📲 ส่งลิงก์เข้า LINE ลูกค้า ]`**: เปิด `https://line.me/R/msg/text/?...` พร้อมข้อความมาตรฐานของ Knight:
       *"สวัสดีครับ สามารถติดตามสถานะงานสั่งทำเคาน์เตอร์หินสังเคราะห์ของคุณได้ตลอด 24 ชม. ที่ลิงก์นี้ครับ: [URL]"*
     - ปุ่ม **`[ 🔗 คัดลอกลิงก์ ]`** พร้อม Toast แจ้งเตือนภาษาไทย
   - หาก Lead ยังไม่มีเลขที่ใบเสนอราคา ให้แสดงคำแนะนำ: *"สร้างใบเสนอราคาเพื่อเปิดใช้งานลิงก์ติดตามงาน"*

**สิ่งที่ต้องทำ:**
1. ใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:
   - แสดง Badge สถานะการเปิดดู `trackingViewCount` บนการ์ดและแถวตาราง
   - เพิ่มแผง Customer Portal Tracking ในส่วนขยายรายละเอียดงาน
   - เพิ่มปุ่มแชร์ส่ง LINE และปุ่มคัดลอกลิงก์
2. สร้าง Unit Tests ใน `artifacts/knight-basins/test/admin-customer-tracking-insights.test.ts` (ใหม่):
   - ทดสอบด้วย Static Source Inspection (`readFileSync`):
     - ตรวจสอบ `data-testid` ครบถ้วนตามโจทย์
     - ตรวจสอบการฟอร์แมตข้อความส่ง LINE

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - แสดง Badge ยอดเปิดดูของลูกค้า (data-testid={`badge-tracking-views-${lead.id}`})
     - แผง Customer Tracking ในส่วนขยาย (data-testid="panel-customer-tracking-insights")
     - ปุ่มส่ง LINE ลูกค้า (data-testid={`button-share-track-line-${lead.id}`})
  2. สร้าง artifacts/knight-basins/test/admin-customer-tracking-insights.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-customer-tracking-insights.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง App.tsx, StudioPage.tsx และ WorkshopProductionSheet.tsx
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-tracking-insights แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 600 / pass 578 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-customer-tracking-insights.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-tracking-insights (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ระบบ Lead เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
