# ใบงาน 135 (ชัย) — บันทึกต้นทุนการใช้งาน Vertex AI Gemini เข้า Unified AI Cost Center (Track Vertex AI Usage in Cost Center)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / AI Cost Architecture) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพเห็นชอบ: **"นำการใช้งาน Vertex AI Gemini มารวมในการคำนวณต้นทุน AI โดยแยกเป็นเสาหลักชัดเจน และบันทึก Token จริง"**
ปัจจุบันระบบมี AI Cost Center (`ai-cost-tracker.ts`) แต่โมดูล `vertex-gemini.ts` และ `sketch-vision.ts` ยังไม่ได้ส่ง event เข้าบันทึก ทำให้ค่าใช้จ่ายจาก Vertex AI ไม่ปรากฏบนแดชบอร์ด
ชัยจะรับหน้าที่เชื่อมต่อการบันทึกต้นทุน:
1. ขยาย `AiUsageService` ใน `artifacts/api-server/src/lib/ai-cost-tracker.ts` เพิ่มบริการ `"vertex_gemini"`: "ระบบปัญญาประดิษฐ์ Vertex AI (Gemini)"
2. ใน `artifacts/api-server/src/lib/vertex-gemini.ts`: เมื่อยิง Chat Completion สำเร็จ ให้ดึง `usage.prompt_tokens` และ `usage.completion_tokens` แล้วเรียก `recordAiUsage()` บันทึก service, model, tokens, durationMs, success
3. ใน `artifacts/api-server/src/lib/sketch-vision.ts` / `routes/leads.ts`: รองรับการส่งข้อมูล model และ token จริงจากการอ่านแบบร่างเข้าสู่ `recordAiUsage()`
4. ตารางราคา `MODEL_PRICING` ใน `ai-cost-tracker.ts`: มีเรตของ `google/gemini-2.5-flash` / `gemini-2.5-flash` รองรับการคำนวณเงินบาทถูกต้อง

**รายละเอียดงานใน `artifacts/api-server/src/lib/ai-cost-tracker.ts` และ `vertex-gemini.ts`:**
1. **ปรับปรุง `ai-cost-tracker.ts`:**
   * เพิ่ม `"vertex_gemini"` เข้าใน `AiUsageService`
   * ใน `SERVICE_LABELS` เพิ่ม `vertex_gemini: "ผู้ช่วย AI (Vertex AI Gemini)"`
   * ใน `SERVICE_ORDER` เพิ่ม `"vertex_gemini"`
   * ตรวจสอบว่า `MODEL_PRICING` มีการแมปราคา `google/gemini-2.5-flash` (Input ฿0.002625/1k tokens, Output ฿0.0105/1k tokens)
2. **ปรับปรุง `vertex-gemini.ts`:**
   * นำเข้า `recordAiUsage` จาก `./ai-cost-tracker.ts`
   * วัด `durationMs = Date.now() - startedAt`
   * เมื่อได้รับผลลัพธ์จาก Vertex AI: ดึง `payload.usage?.prompt_tokens`, `payload.usage?.completion_tokens`, `payload.usage?.total_tokens` แล้วเรียก `recordAiUsage()` บันทึก event
   * หากมี error ก็ยังบันทึก `success: false`
3. **สร้าง/ปรับปรุง Automated Unit Tests:**
   * ใน `artifacts/api-server/test/vertex-gemini.test.ts`: ทดสอบว่าเมื่อ `askGemini()` สำเร็จ มีการเรียกบันทึก event พร้อม token และ duration เข้า `ai-cost-tracker`
   * ใน `artifacts/api-server/test/ai-cost-center.test.ts`: ทดสอบว่าบริการ `vertex_gemini` แสดงผลในสรุปต้นทุน และคำนวณยอดเงินบาทถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-vertex-ai-cost-tracking แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. ขยาย artifacts/api-server/src/lib/ai-cost-tracker.ts เพิ่ม service "vertex_gemini" พร้อมเรตราคา
  2. ปรับปรุง artifacts/api-server/src/lib/vertex-gemini.ts ให้เรียก recordAiUsage() ทุกครั้งที่ใช้งานพร้อมบันทึก tokens จริง
  3. ปรับปรุง artifacts/api-server/test/vertex-gemini.test.ts และ test/ai-cost-center.test.ts ให้เทสต์ผ่าน 100%

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/vertex-gemini.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/vertex-gemini.test.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ai-cost-center.test.ts

FORBIDDEN:
  - ห้ามเปลี่ยน signature หรือผลลัพธ์ของ askGemini()
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามเขียนทับ event log ด้วยวิธีอื่นนอกจาก recordAiUsage()
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-vertex-ai-cost-tracking

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-vertex-ai-cost-tracking
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/vertex-gemini.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 625 / pass 619 / fail 6 (pre-existing sandbox) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-vertex-ai-cost-tracking (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline 6 ข้อเดิม
  - ถ้าแตะต้องไฟล์นอก SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์ signature ของ askGemini เดิม 100% | ✅ ผ่าน |
| 11 | เพิ่มเสาหลักที่ 4 vertex_gemini ปลอดภัย | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
