# ใบงาน 193-R (Replit) — AI Visual Matcher เฟส 1: คลังจับคู่สีหินจากภาพห้อง (Backend Library)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที (งานนี้เป็น Backend ล้วน ไม่มีงาน UI)

> ⚠️ **ประกาศกันงานซ้ำ:** ใบงาน 193 นี้ **มอบหมายให้ Replit เพียงผู้เดียว** — ชัยรับเฉพาะใบงาน 192 (LINE stone photo) ห้ามทำใบนี้ซ้ำ

**ที่มาและความต้องการ:**
บอสต้องการต่อยอดคลัง "ภาพเต็มแผ่น" ของหินทั้ง 64 สี ให้ AI ช่วยจัดอันดับสีที่ใกล้เคียงกับภาพห้องที่ลูกค้าส่งมา (AI Visual Matcher)
ใบงานนี้ทำ **เฟส 1 เฉพาะชั้น Library + เทสต์** (ยังไม่เปิด endpoint / ไม่มี UI) เพื่อให้ทีมตรวจคุณภาพคำตอบและคุมค่าใช้จ่าย AI ก่อนต่อยอด

**ข้อกำหนดด้านความปลอดภัยของคำตอบ (ห้ามละเมิด):**
1. AI **เลือกได้เฉพาะรหัสหินที่เราส่งเข้าไปใน prompt** — ห้ามสร้างรหัส/ชื่อใหม่
2. AI **ห้ามคิดราคา** — ราคาผูกจากแถวแคตตาล็อกของเราเองเท่านั้น
3. ตอบไม่เกิน 3 สี เรียงตามความใกล้เคียง, ต้องเป็น JSON ที่ parse ได้ และถ้า parse ไม่ได้ให้คืนรายการว่าง (ห้าม throw)
4. ถ้ายังไม่ตั้งค่า Vertex AI ให้คืน `{ status: "not-configured" }` ไม่ใช่ error

**รายละเอียดสิ่งที่ต้องทำ (2 ไฟล์):**
1. `artifacts/api-server/src/lib/stone-matcher.ts` (ปัจจุบันเป็น SCAFFOLD — เขียนทับ)
   - คง type และ signature ที่ประกาศไว้: `StoneMatchCandidate`, `StoneMatch`, `StoneMatchResult` และ `suggestStonesForPhoto(imageBuffer, mimeType, candidates)`
   - เรียก Gemini Vision ตามแบบที่พิสูจน์แล้วใน `artifacts/api-server/src/lib/sketch-vision.ts` (ฟังก์ชัน `analyzeSketchImage`): ส่งภาพเป็น base64 ผ่าน `inline_data` + `generationConfig: { responseMimeType: "application/json" }` และใช้ตัวช่วย config/token ที่มีอยู่แล้ว (ห้ามคัดลอกหรือ hardcode secret)
   - มี timeout ของคำขอ (ดู `REQUEST_TIMEOUT_MS` ใน `sketch-vision.ts`) และแปลง timeout เป็น `{ status: "failed", message }` ที่อ่านรู้เรื่อง
   - prompt ต้องมีรายชื่อหินที่อนุญาตเป็นบรรทัด `- <code> · <name>` และสั่งให้ตอบ JSON `{"matches":[{"code":"...","reason":"..."}]}`
   - หลังได้คำตอบ ให้กรองด้วยรหัสที่ส่งเข้าไปจริง (ทิ้งรหัสที่ AI คิดเอง) และ dedupe ก่อนคืนค่า
2. `artifacts/api-server/test/stone-match-prompt.test.ts` (ปัจจุบันเป็น SCAFFOLD — เขียนทับ)
   - prompt ที่สร้างต้องมีรหัสหินที่ส่งเข้าทุกตัว
   - ถ้า AI ตอบรหัสที่ไม่มีในรายการ ต้องตัดทิ้งและคืนเฉพาะรหัสที่ถูกต้อง
   - ถ้าคำตอบไม่ใช่ JSON ต้องคืนรายการว่าง ไม่ throw
   - จำกัดผลลัพธ์ไม่เกิน 3 รายการตามลำดับที่ AI จัดอันดับ
   - **ต้อง mock `fetch` ทั้งหมด** ห้ามเรียก Google จริงในเทสต์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. เขียน suggestStonesForPhoto ใน artifacts/api-server/src/lib/stone-matcher.ts โดยใช้รูปแบบ Gemini Vision เดียวกับ lib/sketch-vision.ts
  2. บังคับว่าคำตอบเลือกได้เฉพาะรหัสหินที่ส่งเข้าไป ห้ามคิดรหัสใหม่ ห้ามคิดราคา จำกัดไม่เกิน 3 รายการ
  3. เพิ่ม Unit Test ครอบคลุม prompt, การกรองรหัสปลอม, JSON เสีย และการจำกัดจำนวน

SCOPE:
  - artifacts/api-server/src/lib/stone-matcher.ts
  - artifacts/api-server/test/stone-match-prompt.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามเปิด endpoint หรือแก้ router ใดๆ ในใบงานนี้ (นั่นคือเฟสถัดไป)
  - ห้ามใส่ API key / token / client_email ลงในไฟล์หรือ log
  - ห้ามเรียก AI จริงใน unit test (ต้อง mock fetch ทั้งหมด เพื่อไม่ให้เสียค่าใช้จ่าย)
  - ห้ามแตะ artifacts/knight-basins/ ทุกไฟล์ และห้ามแตะ src/index.css
  - ทำงานผ่าน branch: feat/replit-stone-visual-matcher แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-stone-visual-matcher ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/stone-match-prompt.test.ts → ผ่านทุกข้อ
  4) npm test ใน artifacts/api-server (รันจากโฟลเดอร์ artifacts/api-server)
     baseline อ้างอิง: tests 760 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น
  5) ระบุชัดว่าในเทสต์มีการ mock fetch ไม่มีการเรียก Google จริง (และไม่มีค่าใช้จ่ายเกิดขึ้น)

OUTPUT:
  - branch: feat/replit-stone-visual-matcher (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ตกเกิน 9 ข้อ (baseline เดิม)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าจำเป็นต้องเปิด endpoint เพื่อทดสอบ (ให้หยุดและรายงานก่อน)
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
| 7 | SCOPE ใช้ path สัมพัทธ์ตามมาตรฐาน Replit | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ห้ามบอกให้ AI คิดราคาเอง (ข้อกำหนดธุรกิจ) | ✅ ผ่าน |
| 11 | บังคับ mock เทสต์ ไม่ให้เสียค่าใช้จ่าย AI | ✅ ผ่าน |
| 12 | ประกาศกันงานซ้ำ (Replit เท่านั้น ชัยทำ 192) | ✅ ผ่าน |
