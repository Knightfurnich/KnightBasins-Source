# ใบงาน 136 (Replit) — เพิ่มแสดงผลบริการ Vertex AI Gemini ในหน้าศูนย์ต้นทุน AI (AI Cost Center Vertex Gemini Pillar UI)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin AI Cost UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ชัยกำลังเชื่อมต่อระบบบันทึกต้นทุน `vertex_gemini` เข้าสู่ Unified AI Cost Center (Task 135)
ใบงานนี้คือการ **ปรับปรุงหน้าจอแสดงผลต้นทุน AI ทั้ง 2 จุด** เพื่อให้บอสและผู้บริหารเห็นสถิติของ Vertex AI Gemini:
1. ในหน้าศูนย์ต้นทุน AI (`/admin/ai-cost` ใน `AiCostCenterPage.tsx`): แสดงการ์ดบริการเสาหลักที่ 4 `vertex_gemini` พร้อมจำนวนคำขอ, โทเค็น, และค่าใช้จ่าย (บาท)
2. ในแผง Dashboard (`/admin` ใน `AdminDashboard.tsx`): แสดงป้ายสถานะ Badge ของ `vertex_gemini` เคียงคู่กับ น้องไนท์, อ่านแบบร่าง, และ Hermes

**API หลังบ้านที่รองรับ:**
* `GET /api/admin/ai-cost-center?period=...` จะคืน `services` ที่มี id `"vertex_gemini"` พร้อม `name: "ผู้ช่วย AI (Vertex AI Gemini)"`

**รายละเอียดงานใน Frontend:**
1. **ใน `artifacts/knight-basins/src/admin/AiCostCenterPage.tsx`:**
   * ตรวจสอบให้แน่ใจว่าการ์ดบริการใน `services` เรนเดอร์บริการ `vertex_gemini` ได้อย่างสมบูรณ์แบบ (มีไอคอน Sparkles/Brain สวยงาม)
   * เมื่อกดปุ่ม "📋 คัดลอกสรุปส่ง LINE" ให้รวมยอดของ Vertex AI Gemini เข้าไปในข้อความสรุปด้วย
2. **ใน `artifacts/knight-basins/src/admin/AdminDashboard.tsx`:**
   * ในอาร์เรย์ `aiCostServices` เพิ่มรายการ:
     `{ id: "vertex_gemini", label: "Vertex AI", detail: "Gemini 2.5 Flash" }`
   * แสดง Badge สถานะเชื่อมต่อ Active ของ Vertex AI บนแดชบอร์ด
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-ai-cost-vertex-ui.test.ts` (ใหม่):**
   * ทดสอบการแสดงผลบริการ `vertex_gemini` บนหน้า `/admin/ai-cost`
   * ทดสอบการแสดง Badge `vertex_gemini` บนแดชบอร์ดหน้าแรก
   * ทดสอบฟอร์แมตข้อความคัดลอกส่ง LINE รวม Vertex AI ถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/AiCostCenterPage.tsx:
     - รองรับการแสดงผลบริการ vertex_gemini ในหน้ารายงานต้นทุน AI และรวมในข้อความสรุป LINE
  2. ปรับปรุง artifacts/knight-basins/src/admin/AdminDashboard.tsx:
     - เพิ่มรายการ vertex_gemini ใน aiCostServices แสดง Badge บนแดชบอร์ด
  3. สร้าง artifacts/knight-basins/test/admin-ai-cost-vertex-ui.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/src/admin/AdminDashboard.tsx
  - artifacts/knight-basins/test/admin-ai-cost-vertex-ui.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้บริการเดิม (sales_bot, sketch_vision, hermes_ops) เสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-ai-cost-vertex-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 555 / pass 533 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-ai-cost-vertex-ui.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-ai-cost-vertex-ui (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์เสาหลักเดิมทั้ง 3 เสา | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
