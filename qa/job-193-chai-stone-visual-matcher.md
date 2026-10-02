# ใบงาน 193 (ชัย / Claude Code) — AI Visual Matcher: จับคู่สีหินจากภาพห้องของลูกค้า (Backend Library)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend AI) · เริ่มได้ทันที (เฟส 1: คลังคำสั่ง ไม่มี UI)

**ที่มาและความต้องการ:**
บอสต้องการต่อยอดคลัง "ภาพเต็มแผ่น" ของหินทั้ง 64 สี ให้ AI ช่วยแนะนำสีที่ใกล้เคียงกับภาพห้องที่ลูกค้าส่งมา (แนวคิด AI Visual Matcher)
ใบงานนี้ทำ **เฟส 1 เฉพาะชั้น Library + เทสต์** (ยังไม่เปิด endpoint/UI) เพื่อให้ทีมตรวจคุณภาพคำตอบและคุมค่าใช้จ่าย AI ก่อนต่อยอดเป็นฟีเจอร์เต็ม

**ข้อกำหนดสำคัญด้านความปลอดภัยของคำตอบ (ห้ามละเมิด):**
1. AI **เลือกได้เฉพาะรหัสหินที่เราส่งเข้าไปใน prompt** เท่านั้น — ห้ามสร้างรหัส/ชื่อใหม่
2. AI **ห้ามคิดราคา** — ราคาผูกจากแถวแคตตาล็อกของเราเองเท่านั้น
3. ตอบได้ไม่เกิน 3 สี เรียงตามความใกล้เคียง และต้องเป็น JSON ที่ parse ได้ ถ้า parse ไม่ได้ให้คืนรายการว่าง (ห้าม throw)
4. ถ้ายังไม่ตั้งค่า Vertex AI ให้คืน `{ status: "not-configured" }` ไม่ใช่ error

**รายละเอียดสิ่งที่ต้องทำ (2 ไฟล์):**
1. `artifacts/api-server/src/lib/stone-matcher.ts` (มี SCAFFOLD อยู่แล้ว — เขียนทับ)
   - คง type ที่ประกาศไว้: `StoneMatchCandidate`, `StoneMatch`, `StoneMatchResult` และ signature ของ `suggestStonesForPhoto(imageBuffer, mimeType, candidates)`
   - เรียก Gemini Vision ตามแบบที่พิสูจน์แล้วใน `lib/sketch-vision.ts` (ฟังก์ชัน `analyzeSketchImage`): ใช้ `inline_data` ส่งภาพ base64 + `generationConfig: { responseMimeType: "application/json" }` และใช้ตัวช่วย config/token จากไฟล์นั้นหรือ `lib/google-service-account.ts` (ห้ามคัดลอก secret ลงไฟล์ใหม่)
   - มี timeout ของคำขอ (ดู `REQUEST_TIMEOUT_MS` ใน sketch-vision.ts) และแปลง timeout เป็น `{ status: "failed", message }` ที่อ่านรู้เรื่อง ไม่ให้ผู้เรียกพัง
   - ส่งรายชื่อหินที่อนุญาตเข้า prompt เป็นบรรทัด `- <code> · <name>` และสั่งให้ตอบ JSON `{"matches":[{"code":"...","reason":"..."}]}`
   - หลังได้คำตอบ ให้กรองด้วยรหัสที่ส่งเข้าไปจริง (ทิ้งรหัสที่ AI คิดเอง) และ dedupe ก่อนคืนค่า
2. `artifacts/api-server/test/stone-match-prompt.test.ts` (มี SCAFFOLD อยู่แล้ว — เขียนทับ)
   - ทดสอบสร้าง prompt แล้วต้องมีรหัสหินที่ส่งเข้าทุกตัว
   - ทดสอบว่าเมื่อ AI ตอบรหัสที่ไม่มีในรายการ ระบบต้องตัดทิ้งและคืนเฉพาะรหัสที่ถูกต้อง
   - ทดสอบว่าเมื่อคำตอบไม่ใช่ JSON ระบบคืนรายการว่าง ไม่ throw
   - ทดสอบว่าจำกัดผลลัพธ์ไม่เกิน 3 รายการตามลำดับที่ AI จัดอันดับ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. เขียน suggestStonesForPhoto ใน lib/stone-matcher.ts โดยใช้รูปแบบ Gemini Vision เดียวกับ lib/sketch-vision.ts
  2. บังคับว่าคำตอบต้องเลือกได้เฉพาะรหัสหินที่ส่งเข้าไป ห้ามคิดรหัสใหม่ ห้ามคิดราคา จำกัดไม่เกิน 3 รายการ
  3. เพิ่ม Unit Test ครอบคลุม prompt, การกรองรหัสปลอม, JSON เสีย และการจำกัดจำนวน

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/stone-matcher.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/stone-match-prompt.test.ts

FORBIDDEN:
  - ห้ามเปิด endpoint หรือแก้ router ใดๆ ในใบงานนี้ (นั่นคือเฟสถัดไป)
  - ห้ามใส่ API key / token / client_email ลงในไฟล์หรือ log
  - ห้ามเรียก AI จริงใน unit test (ต้อง mock fetch ทั้งหมด เพื่อไม่ให้เสียค่าใช้จ่าย)
  - ห้ามแตะ artifacts/knight-basins/ ทุกไฟล์ และห้ามแตะ src/index.css
  - ทำงานผ่าน branch: feat/chai-stone-visual-matcher แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-stone-visual-matcher ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/stone-match-prompt.test.ts → ผ่านทุกข้อ
  4) npm test ใน artifacts/api-server
     baseline อ้างอิง: tests 760 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น
  5) ระบุชัดว่าในเทสต์มีการ mock fetch ไม่มีการเรียก Google จริง (และไม่มีค่าใช้จ่ายเกิดขึ้น)

OUTPUT:
  - branch: feat/chai-stone-visual-matcher (เปิด PR เข้า main)
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
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ห้ามบอกให้ AI คิดราคาเอง (ข้อกำหนดธุรกิจ) | ✅ ผ่าน |
| 11 | บังคับ mock เทสต์ ไม่ให้เสียค่าใช้จ่าย AI | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
