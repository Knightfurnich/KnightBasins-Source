# ใบงาน 240-C (ชัย) — เลือกผู้ให้บริการอ่านแบบร่างได้ (DeepSeek / Gemini) และย้ายไป DeepSeek

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย · เริ่มได้ทันที
**Branch:** `feat/chai-sketch-vision-deepseek-provider`
**วัตถุประสงค์:** ให้ AI อ่านแบบร่าง (/sketch) ใช้ **DeepSeek** ได้ และ **เลือกผู้ให้บริการได้** ด้วยค่าตั้ง ไม่ต้องแก้โค้ดอีกในอนาคต

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มผู้ให้บริการอ่านแบบร่าง "deepseek" ใน artifacts/api-server/src/lib/sketch-vision.ts โดยใช้ endpoint แบบ OpenAI-compatible
  2. ให้เลือกผู้ให้บริการได้ด้วย env: SKETCH_VISION_PROVIDER = deepseek | gemini | auto (ค่าเริ่มต้น auto)
     - auto = ใช้ตัวที่มีการตั้งค่าไว้ก่อน (deepseek ถ้ามีคีย์) แล้วถอยไปอีกตัวอัตโนมัติเมื่อตัวแรกพัง
     - เมื่อกำหนดเจาะจง (deepseek/gemini) ให้ใช้ตัวนั้นก่อน แล้วจึงถอยไปอีกตัว
  3. อ่านค่าจาก env เท่านั้น: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (ดีฟอลต์ https://api.deepseek.com),
     DEEPSEEK_VISION_MODEL (ดีฟอลต์ deepseek-flash)
  4. ส่งข้อมูลการใช้งานกลับมากับผลลัพธ์ (provider, model, promptTokens, completionTokens) แล้วให้ routes/leads.ts
     บันทึกต้นทุนตามจริง และเพิ่มเรตของ deepseek-flash ใน ai-cost-tracker
  5. คงพฤติกรรมเดิมทุกข้อ: ห้าม throw ห้าม reject, /api/sketch/analyze ต้องตอบ 200 เสมอ,
     ข้อความ error ดิบของผู้ให้บริการต้องอยู่แค่ใน log ไม่หลุดถึงลูกค้า, และต้องยังใช้ Gemini ได้เหมือนเดิม

ข้อมูลที่ตรวจสอบมาแล้ว (ใช้ได้เลย ห้ามเดา):
  - ปลายทาง DeepSeek: POST {DEEPSEEK_BASE_URL}/chat/completions · header Authorization: Bearer <key>
  - ชื่อโมเดล: deepseek-flash (ชื่อเก่า deepseek-v4-flash และ deepseek-v4-flash-vision-exp ถูกยกเลิกแล้ว)
  - รูปภาพส่งเป็น data URL ใน content array รูปแบบนี้:
      messages[0].content = [ { type: "text", text: <prompt เดิม> },
                              { type: "image_url", image_url: { url: "data:<mime>;base64,<base64>", detail: "high" } } ]
  - JSON mode: response_format = { type: "json_object" }
  - คำตอบ: choices[0].message.content (string ที่เป็น JSON) · จำนวนโทเคน: usage.prompt_tokens / usage.completion_tokens
  - ราคา DeepSeek V4.1 Flash: $0.15 input / $0.60 output ต่อ 1M โทเคน (off-peak) · ช่วง peak เป็น 2 เท่า
    ให้ตั้งเรตในตารางเป็นราคา peak ($0.30 / $1.20) เพื่อไม่ให้ประเมินต้นทุนต่ำกว่าความจริง
  - Gemini (ของเดิม) ยืนยันด้วยการยิงจริงจาก VPS: gemini-3.8-flash และ gemini-3-flash-preview ตอบ 200
    เฉพาะ location=global (regional ทั้งหมด 404) และต้องมี role:"user" ใน contents
  - Gemini 2.5 Flash ประกาศปิดตัว 16 ต.ค. 2026 จึงต้องมีทางเลือกอื่นเสมอ
  - คีย์ DeepSeek ยังไม่มีในเครื่องแอป (มีแต่คีย์ Google) — โค้ดต้องทำงานได้แม้ยังไม่มีคีย์ (ถอยไป Gemini)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/sketch-vision.test.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ai-cost-center.test.ts

FORBIDDEN:
  - ห้ามแก้สูตรราคาสินค้า/ใบเสนอราคา หรือตรรกะของ 2D Studio
  - ห้ามแตะ src/index.css และไฟล์ UI ใด ๆ (Replit เป็นเจ้าของ)
  - ห้าม hard-code ชื่อโมเดลหรือคีย์ลงในโค้ด — ต้องมาจาก env เท่านั้น
  - ห้ามแสดงข้อความ error ดิบของผู้ให้บริการต่อลูกค้า (log ฝั่งเซิร์ฟเวอร์เท่านั้น)
  - ห้ามเขียนหรือลบข้อมูลใน Production Database
  - ห้าม push ตรงเข้า main — ทำงานผ่าน branch แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-sketch-vision-deepseek-provider ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → 1034 tests / fail 0 (baseline หลัง PR #284)
  4) เทสต์ใหม่ต้องครอบคลุมและรันผ่าน:
     - ตั้ง SKETCH_VISION_PROVIDER=deepseek แล้วคำขอวิ่งไปที่ {base}/chat/completions ด้วยโมเดล deepseek-flash
     - ส่งรูปเป็น data URL พร้อม detail "high" และมี response_format แบบ json_object
     - auto: ใช้ deepseek ก่อนเมื่อมีคีย์ แล้วถอยไป gemini เมื่อ deepseek ตอบ 500 (ต้องได้ผลลัพธ์จาก gemini)
     - ไม่มีคีย์ทั้งสองเจ้า → ไม่เรียก fetch เลย และ notes เป็นข้อความไทย
     - ข้อความ error ของผู้ให้บริการ (เช่น project/model path) ต้องไม่ปรากฏใน notes ที่ลูกค้าเห็น
     - usage (model + โทเคน) ถูกบันทึกเข้า cost center และเรต deepseek-flash คิดเงินมากกว่า 0
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/sketch-vision.ts
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/src/lib/ai-cost-tracker.ts
  - artifacts/api-server/test/sketch-vision.test.ts
  - artifacts/api-server/test/ai-cost-center.test.ts
  - PR เข้า main พร้อมหลักฐานตามข้อ EVIDENCE

STOP:
  - เมื่อ tsc ผ่าน 0 errors, เทสต์ผ่านทั้งหมด (fail 0) และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุ DeepSeek + การเลือกผู้ให้บริการ + usage/cost |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 5 ไฟล์ฝั่ง api-server เท่านั้น |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/index.css, ห้าม hard-code คีย์, ห้าม push main |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งรันจริง + baseline ตัวเลข + เทสต์ที่ต้องมี |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์และ PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุเงื่อนไขหยุดและ 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | ใช้ /opt/data/cache/kbsrc/... ตามข้อกำหนดงานชัย |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | รูปแบบ JSON แสดงเป็นบรรทัดเยื้อง ไม่มี ``` ซ้อน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/chai-sketch-vision-deepseek-provider |
| 11 | ระบุค่าตั้ง env ที่ต้องใช้ | ผ่าน | SKETCH_VISION_PROVIDER / DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_VISION_MODEL |
| 12 | ระบุข้อห้ามเรื่องข้อมูลลูกค้า | ผ่าน | ห้าม error ดิบถึงลูกค้า, ห้ามแตะ Production DB |
