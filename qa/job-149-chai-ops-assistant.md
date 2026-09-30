# ใบงาน 149 (ชัย) — ผู้ช่วย AI ประจำระบบหลังบ้าน อ่านข้อมูลอย่างเดียว (Internal AI Operations Assistant API)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / AI Operations Assistant) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 15 ในคู่มือ KRAKEN ERP** (ผู้ช่วย AI):
> *"ตัวช่วยตอบคำถามและค้นข้อมูลในระบบ — ใช้เพื่อ 'ถาม-ตรวจ' ไม่ใช่เพื่อสั่งแก้ข้อมูล"*
> *"✅ ตอบคำถามเกี่ยวกับข้อมูลในระบบ · ✅ ช่วยสรุปขั้นตอนการทำงาน · ❌ ไม่สร้าง/แก้/ลบข้อมูลในระบบ · ❌ ไม่ให้ข้อมูลเกินสิทธิ์ของผู้ใช้ที่ล็อกอิน"*

เรามี **Vertex AI Gemini (asia-southeast1)** ที่ใช้งานได้จริงแล้ว (Task 124/126/135) พร้อมระบบบันทึกต้นทุนอัตโนมัติ — งานนี้คือการสร้าง Endpoint ผู้ช่วย AI ประจำระบบหลังบ้าน ที่ตอบคำถามภาษาไทยจากข้อมูลจริงในฐานข้อมูล **แบบอ่านอย่างเดียว (Read-Only) 100%**

**สิ่งที่ต้องสร้าง:**

1. **`artifacts/api-server/src/lib/ops-assistant.ts` (ใหม่):**
   * ฟังก์ชัน `buildOpsContextSummary(mode): Promise<string>` — สรุปข้อมูลจริงจากฐานข้อมูลเป็นข้อความสั้น ๆ ให้ AI ใช้ตอบ
     - โหมด `"dashboard"`: จำนวน Lead ทั้งหมด, สถานะแต่ละช่วง (เช่น `พร้อมผลิต`, `ปิดการขาย`), ยอดเงินที่รับชำระแล้วล่าสุด
     - โหมด `"leads"`: งานล่าสุด 10 รายการ (รหัสงาน, ชื่อลูกค้า, สถานะ, วันติดตั้ง)
     - โหมด `"calendar"`: จำนวนงานติดตั้งแยกตามทีมช่างในเดือนปัจจุบัน
   * **ข้อจำกัดสำคัญ:** ให้สรุปเฉพาะข้อมูลที่จำเป็น ไม่เกิน ~2,000 ตัวอักษร (ประหยัดโทเคน) และ **ห้ามใส่ข้อมูลอ่อนไหว** (เลขบัญชี, รหัสภาษีเต็ม, token, secret)
   * ฟังก์ชัน `askOpsAssistant(question, mode)` เรียก `askGemini({ message, contextSummary })` แล้วคืนผลลัพธ์ในรูปแบบ `{ ok, reply }` / `{ ok: false, message }`
   * **System prompt ต้องล็อกกฎเหล็ก:** *"คุณเป็นผู้ช่วยตอบคำถามข้อมูลภายในของบริษัท ไนท์ เฟอร์นิช ตอบเป็นภาษาไทย กระชับ ใช้เฉพาะข้อมูลที่ให้มา หากไม่มีข้อมูลให้บอกว่าไม่พบข้อมูล ห้ามเดาตัวเลข ห้ามแนะนำการแก้ไขข้อมูลในระบบ"*

2. **Endpoint ใหม่ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   * `POST /api/admin/assistant/ask` — guard ด้วย `requireAdminPermission("leads")`
   * Body: `{ question: string (1..500 ตัวอักษร), mode?: "dashboard" | "leads" | "calendar" }`
   * สำเร็จ → `200` `{ ok: true, reply, mode }`
   * คำถามว่างหรือยาวเกิน → `400`
   * AI ยังไม่ตั้งค่า / ไม่ตอบ → `200` `{ ok: false, message: "ผู้ช่วย AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }` (ห้าม 500)
   * ต้องมี Rate Limit (สร้าง limiter ใหม่เหมือน pattern เดิมในไฟล์)

3. **เทสต์ใน `artifacts/api-server/test/ops-assistant.test.ts` (ใหม่):**
   * ทดสอบ `buildOpsContextSummary()` ไม่มีข้อมูลอ่อนไหวหลุด (ไม่พบ token/secret/เลขบัญชี)
   * ทดสอบว่า Endpoint คืน `400` เมื่อคำถามว่างหรือยาวเกิน 500 ตัวอักษร
   * ทดสอบว่า Endpoint **ไม่เขียนข้อมูลใด ๆ ลงฐานข้อมูล** (ยืนยันว่าเป็น read-only — เช็คว่าจำนวนแถวไม่เปลี่ยนหลังเรียก)
   * ทดสอบเส้นทาง AI ไม่พร้อมใช้งาน คืน `ok: false` (ไม่ใช่ 500)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-ops-assistant แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง artifacts/api-server/src/lib/ops-assistant.ts — buildOpsContextSummary() + askOpsAssistant()
  2. เพิ่ม POST /api/admin/assistant/ask (guard leads, rate limit, read-only 100%)
  3. เขียนเทสต์ใน artifacts/api-server/test/ops-assistant.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ops-assistant.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ops-assistant.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแก้ signature ของ askGemini() ใน lib/vertex-gemini.ts (ให้เรียกใช้แบบเดิมเท่านั้น)
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามให้ Endpoint นี้เขียน/แก้/ลบข้อมูลในฐานข้อมูลเด็ดขาด (read-only เท่านั้น)
  - ห้ามใส่ข้อมูลอ่อนไหว (token, secret, เลขบัญชีเต็ม, รหัสภาษีเต็ม) ลงใน context summary
  - ห้ามแตะต้องตรรกะราคาใน fabrication-geometry.ts และ price-integrity.ts
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-ops-assistant

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/ops-assistant.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 3 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-ops-assistant (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไฟล์นอก SCOPE เกิน 0 ไฟล์ (ให้หยุดและรายงานก่อน ไม่ต้องแก้เอง)
  - ถ้าจำเป็นต้องเขียนข้อมูลลงฐานข้อมูลเพื่อให้ฟีเจอร์ทำงาน — ให้หยุดทันที เพราะขัดกับเจตนารมณ์ของใบงาน
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎ AI อ่านเท่านั้น (Read-Only) ตามข้อ 15 ของ KRAKEN | ✅ ผ่าน |
| 11 | มีเทสต์ยืนยันว่าข้อมูลอ่อนไหวไม่หลุด | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
