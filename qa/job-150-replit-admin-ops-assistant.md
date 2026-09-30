# ใบงาน 150 (Replit) — วิดเจ็ตผู้ช่วย AI ประจำระบบหลังบ้าน (Internal AI Assistant Widget UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin AI Assistant UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 15 ในคู่มือ KRAKEN ERP** (ผู้ช่วย AI):
> *"เปิดปุ่มผู้ช่วย AI (มุมล่างขวาของหน้าจอ) → เลือกโหมดงาน → ถามเป็นภาษาไทยได้เลย"*
> *"ถ้า AI ตอบไม่ได้/ไม่แน่ใจ: ใช้ปุ่ม ส่งต่อให้เจ้าหน้าที่"*

งานนี้คือการสร้างวิดเจ็ตผู้ช่วย AI ลอยที่มุมล่างขวาของระบบหลังบ้าน (`/admin`) ให้บอสและแอดมินถาม-ตรวจข้อมูลได้ทันทีโดยไม่ต้องเปิดหน้าอื่น

**API ที่รองรับ (ชัยกำลังพัฒนาใน Task 149):**
* `POST /api/admin/assistant/ask`
  * Body: `{ question: string (1..500 ตัวอักษร), mode: "dashboard" | "leads" | "calendar" }`
  * สำเร็จ → `200` `{ ok: true, reply, mode }`
  * AI ไม่พร้อม → `200` `{ ok: false, message: "..." }`
  * คำถามว่าง/ยาวเกิน → `400`

> ⚠️ **หมายเหตุการเริ่มงาน:** Endpoint นั้นจะออนไลน์บน `main` หลัง Task 149 merge
> ถ้าเริ่มงานแล้วทดสอบเรียกแล้วยังได้ `404` → **ให้หยุดแล้วรายงานทันที** (ตามเงื่อนไข STOP)
> ระหว่างนี้ให้สร้าง UI ทั้งหมดตามสัญญา API ข้างบนได้เลย

**สิ่งที่ต้องสร้าง:**

1. **`artifacts/knight-basins/src/admin/OpsAssistantWidget.tsx` (ใหม่):**
   * ปุ่มลอยมุมล่างขวา: `data-testid="button-open-ops-assistant"` แสดงไอคอน 🤖 (หรือ Sparkles)
   * เมื่อกดเปิด แผงแชท: `data-testid="panel-ops-assistant"`
   * ตัวเลือกโหมด 3 ปุ่ม (ตาม KRAKEN): `data-testid="assistant-mode-dashboard"` (ภาพรวม), `assistant-mode-leads` (งาน/ลูกค้า), `assistant-mode-calendar` (คิวช่าง)
     - โหมดที่เลือกต้องมีสถานะ active ชัดเจน (`aria-pressed`)
   * ช่องกรอกคำถาม: `data-testid="input-ops-assistant-question"` (จำกัด 500 ตัวอักษร + แสดงตัวนับ)
   * ปุ่มส่ง: `data-testid="button-ask-ops-assistant"` (ปิดการใช้งานเมื่อคำถามว่างหรือกำลังโหลด)
   * พื้นที่แสดงประวัติคำถาม-คำตอบ: `data-testid="list-assistant-messages"` พร้อมสถานะกำลังโหลด (spinner)
   * แสดงข้อความเมื่อ AI ไม่พร้อม: `data-testid="assistant-unavailable"` (จาก `ok: false` ให้แสดงข้อความไทยที่อ่านรู้เรื่อง ห้ามโชว์ error ดิบ)
   * **ปุ่ม "ส่งต่อให้เจ้าหน้าที่"** (ตาม KRAKEN): `data-testid="button-assistant-escalate"` — เปิด LINE `@789gcnhq` ในแท็บใหม่
   * **หมายเหตุกำกับใต้แผง:** *"คำตอบของ AI ใช้เป็นข้อมูลประกอบ ควรตรวจสอบกับข้อมูลจริงอีกครั้ง"* (`data-testid="assistant-disclaimer"`)
   * ตัวอย่างคำถามแนะนำ 3 ข้อ (`data-testid="assistant-suggestions"`) เช่น *"งานติดตั้งในเดือนนี้มีกี่งาน"*

2. **เชื่อมเข้าสู่ระบบหลังบ้าน (`artifacts/knight-basins/src/admin/AdminApp.tsx`):**
   * แสดง `OpsAssistantWidget` ในหน้า `/admin` ทุกหน้าจอหลังเข้าสู่ระบบ (ห้ามแสดงหน้า Login)
   * **ห้ามรบกวน layout เดิม** (sidebar, ตาราง, วิดเจ็ต Dashboard ต้องไม่เสียหาย)

3. **เทสต์ใน `artifacts/knight-basins/test/admin-ops-assistant.test.ts` (ใหม่):**
   * ใช้รูปแบบ **Static Source Inspection** (`readFileSync` + `assert.match`) เท่านั้น
   * ❌ ห้าม `dynamic import` คอมโพเนนต์ (จะพังเพราะ `node:test` ไม่มี `import.meta.env.BASE_URL` ของ Vite)
   * ตรวจว่ามี `data-testid` ครบทุกตัวตามรายการข้างบน
   * ตรวจว่ามีข้อความข้อจำกัดคำตอบ AI (disclaimer) และปุ่มส่งต่อเจ้าหน้าที่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/admin/OpsAssistantWidget.tsx (วิดเจ็ต AI ลอยมุมล่างขวา โหมด 3 แบบ)
  2. แสดงวิดเจ็ตใน artifacts/knight-basins/src/admin/AdminApp.tsx เฉพาะเมื่อเข้าสู่ระบบแล้ว
  3. สร้าง artifacts/knight-basins/test/admin-ops-assistant.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/OpsAssistantWidget.tsx · (ใหม่)
  - artifacts/knight-basins/src/admin/AdminApp.tsx
  - artifacts/knight-basins/test/admin-ops-assistant.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx, App.tsx และ WorkshopProductionSheet.tsx
  - ห้ามแสดงวิดเจ็ตบนหน้า Login ของแอดมิน
  - ห้ามทำให้ sidebar หรือ layout เดิมของแอดมินเสียหาย
  - ห้ามใช้ dynamic import คอมโพเนนต์ในไฟล์เทสต์ (จะพังเพราะไม่มี import.meta.env)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-ops-assistant แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 592 / pass 570 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-ops-assistant.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-ops-assistant (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าเรียก POST /api/admin/assistant/ask แล้วได้ 404 (Task 149 ยังไม่ merge) ให้หยุดรายงานทันที
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
| 11 | มีข้อจำกัดคำตอบ AI และปุ่มส่งต่อเจ้าหน้าที่ตามข้อ 15 | ✅ ผ่าน |
| 12 | กำหนด STOP เมื่อ API ต้นทางยังไม่พร้อม | ✅ ผ่าน |
