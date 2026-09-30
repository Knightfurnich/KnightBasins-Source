# ใบงาน 157 (ชัย) — บันทึกต้นทุนการใช้งานเสียง Google TTS ใน AI Cost Center (Track Google TTS Usage in AI Cost Center)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / AI Cost Tracking & Audio Service) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ปัจจุบันในระบบสรุปต้นทุน AI (`ai-cost-tracker.ts`) เรามี 4 เสาหลัก:
`"sales_bot" | "sketch_vision" | "hermes_ops" | "vertex_gemini"`
แต่การเรียกอ่านออกเสียงของน้องไนท์ผ่าน **Google Cloud Text-to-Speech (Chirp3-HD / Neural2)** ที่ทำงานใน `artifacts/api-server/src/lib/google-tts.ts` (`synthesizeSpeech`) **ยังไม่เคยถูกบันทึกต้นทุนลงใน Cost Center เลย!** ทำให้ต้นทุนก้อนนี้มองไม่เห็น 100%

งานนี้คือการอุดรอยรั่วนี้ให้สมบูรณ์:
1. **ใน `artifacts/api-server/src/lib/ai-cost-tracker.ts`:**
   * ขยาย Type `AiUsageService` เพิ่มบริการที่ 5: `"google_tts"`
   * เพิ่มชื่อบริการภาษาไทยใน `SERVICE_LABELS`:
     `google_tts: "เสียงผู้ช่วยขาย (Google Cloud TTS)"`
   * เพิ่มลำดับใน `SERVICE_ORDER`: เพิ่ม `"google_tts"` ต่อท้าย
   * กำหนดอัตราคิดราคาใน `MODEL_PRICING` หรือตารางราคา:
     - Google Cloud Text-to-Speech Chirp3-HD / Neural2 คิดราคาตามจำนวนตัวอักษร:
       ประมาณ $16.00 ต่อ 1,000,000 ตัวอักษร (หรือ ~฿0.56 ต่อ 1,000 ตัวอักษร)
     - รองรับโมเดลเสียง เช่น `"th-TH-Chirp3-HD-Kore"`, `"google-tts"`, `"text-to-speech"`
   * ให้ฟังก์ชัน `recordAiUsage()` คำนวณราคาจากจำนวนตัวอักษร (`characters` หรือแปลงเป็นโทเคน/หน่วยที่ระบบใช้คำนวณ) ได้อย่างถูกต้อง
2. **ใน `artifacts/api-server/src/lib/google-tts.ts`:**
   * นำเข้า `recordAiUsage` จาก `./ai-cost-tracker.ts`
   * ในฟังก์ชัน `synthesizeSpeech(text, voiceNameOverride)`:
     - จับเวลา `startedAt = Date.now()`
     - เมื่อได้รับผลลัพธ์จาก Google TTS สำเร็จ (`response.ok`):
       เรียก `recordAiUsage({ service: "google_tts", model: voice.voiceName, durationMs: Date.now() - startedAt, success: true, promptTokens: trimmed.length })`
     - หากล้มเหลว (catch หรือ response error):
       บันทึก `recordAiUsage` ด้วย `success: false` เพื่อตรวจจับข้อผิดพลาด
   * ⚠️ **ข้อบังคับ:** ห้ามแก้ Signature ของ `synthesizeSpeech()` เดิมเด็ดขาด (หน้าจอที่เรียกใช้ต้องไม่พัง)
3. **อัปเดตหรือเพิ่ม Unit Tests ใน `artifacts/api-server/test/google-tts-cost.test.ts` (ใหม่):**
   * ทดสอบว่าเมื่อเรียก `synthesizeSpeech()` สำเร็จ จะมี event บันทึกลง Cost Tracker
   * ทดสอบว่า `GET /api/admin/ai-cost-center` มีบริการ `google_tts` ปรากฏในผลลัพธ์
   * ทดสอบว่า `test/security-audit.test.ts` และ `test/ai-cost-center.test.ts` ผ่าน 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-tts-cost-tracking แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. เพิ่มบริการ google_tts เป็นเสาหลักที่ 5 ใน artifacts/api-server/src/lib/ai-cost-tracker.ts
  2. เรียก recordAiUsage() ใน synthesizeSpeech() ของ artifacts/api-server/src/lib/google-tts.ts
  3. เขียนเทสต์ใน artifacts/api-server/test/google-tts-cost.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/google-tts.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/google-tts-cost.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามเปลี่ยน signature หรือ return type ของ synthesizeSpeech()
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามลบหรือเปลี่ยนค่าบริการเดิม 4 ตัวใน ai-cost-tracker.ts
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-tts-cost-tracking

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/google-tts-cost.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 3 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-tts-cost-tracking (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์ signature ของ synthesizeSpeech 100% | ✅ ผ่าน |
| 11 | เพิ่มเสาหลักที่ 5 google_tts ปลอดภัย | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
