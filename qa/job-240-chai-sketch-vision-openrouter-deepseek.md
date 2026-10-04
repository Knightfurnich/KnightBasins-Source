# ใบงาน 240-C (ชัย) — Sketch Vision: เลือกผู้ให้บริการได้ (DeepSeek / Gemini) + ซ่อมสาเหตุที่ AI อ่านแบบร่างตาย

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย · เริ่มได้ทันที
**Branch:** `feat/chai-sketch-vision-openrouter-deepseek`
**ที่มา:** บอสสั่ง "ใช้ Openrouter เลือก DeepSeek 4.1 Flash" (เดิมสั่งใช้ DeepSeek ตรง) + "เพิ่ม ให้สามารถเลือกได้" และใบงานนี้รวมงานซ่อมจาก PR #284 ที่ **ปิดไปโดยไม่ merge** (ของยังพังอยู่บน main)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ซ่อมสาเหตุที่ AI อ่านแบบร่างใช้ไม่ได้บน Production ให้ครบ (ยังพังอยู่จริงบน main):
     - อย่าฝังชื่อโมเดลไว้ในโค้ด ให้อ่านจาก env เท่านั้น
     - ส่ง contents เป็นผู้ใช้: ต้องมี role:"user" (ไม่มีแล้ว Vertex ตอบ 400 "Please use a valid role: user, model.")
     - รองรับ location=global ซึ่ง host ไม่มี prefix ของ region (global-aiplatform.googleapis.com ไม่มีอยู่จริง)
     - ถ้าโมเดลที่ตั้งไว้ถูกเลิกใช้ ให้ถอยไปใช้ตัวสำรองใน env อัตโนมัติ + เขียน log เตือน
     - ข้อความ error ของผู้ให้บริการ (มีชื่อโปรเจกต์/region/พาธโมเดล) ต้องอยู่แค่ใน log เท่านั้น ห้ามหลุดถึงลูกค้า
  2. เพิ่มผู้ให้บริการ "openrouter" สำหรับอ่านแบบร่าง (endpoint แบบ OpenAI-compatible) โดยตั้งโมเดลเป็น DeepSeek V4.1 Flash
  3. ให้เลือกผู้ให้บริการได้ด้วย env: SKETCH_VISION_PROVIDER = openrouter | gemini | auto (ค่าเริ่มต้น auto)
     - auto = ใช้ตัวที่มีการตั้งค่าไว้ก่อน แล้วถอยไปอีกตัวอัตโนมัติเมื่อตัวแรกพัง
     - กำหนดเจาะจง = ใช้ตัวนั้นก่อน แล้วจึงถอยไปอีกตัว
  4. อ่านค่าจาก env: OPENROUTER_API_KEY · OPENROUTER_BASE_URL (ดีฟอลต์ https://openrouter.ai/api/v1) ·
     OPENROUTER_VISION_MODEL (ดีฟอลต์ deepseek/deepseek-v4.1-flash) · VERTEX_AI_MODEL · VERTEX_AI_FALLBACK_MODELS · VERTEX_VISION_LOCATION
  5. ส่ง usage (provider, model, promptTokens, completionTokens) กลับมากับผลลัพธ์ แล้วให้ routes/leads.ts
     บันทึกต้นทุนตามจริง + เพิ่มเรต deepseek-v4.1-flash ใน ai-cost-tracker (คีย์ที่ OpenRouter ส่งกลับคือ deepseek/deepseek-v4.1-flash)
  6. คงพฤติกรรมเดิม: ห้าม throw ห้าม reject · /api/sketch/analyze ต้องตอบ 200 เสมอ · ไม่มีคีย์ทั้งสองเจ้า = ไม่เรียก fetch

ข้อมูลที่ตรวจสอบมาแล้ว (ใช้ได้เลย ห้ามเดา):
  - ยิงจริงจาก VPS ด้วย Service Account ของ production: gemini-3.8-flash และ gemini-3-flash-preview
    ตอบ 200 เฉพาะ location=global · regional (asia-southeast1/us-central1/europe-west1) = 404 ทั้งคู่
    และ gemini-2.5-flash ตอบ 200 ทุก region แต่จะปิดตัว 16 ต.ค. 2026
  - ภาพสเก็ตช์ลูกค้าจริง 1 ใบ: 3.8-flash 8.5 วิ / 3,531 โทเคน · 2.5-flash 36.1 วิ / 9,881 โทเคน (อ่านได้ผลเดียวกัน)
  - OpenRouter (ใช้คีย์ตัวเดียวกับที่ระบบอื่นของเราใช้อยู่): POST {OPENROUTER_BASE_URL}/chat/completions
    header Authorization: Bearer <key> · ชื่อโมเดล deepseek/deepseek-v4.1-flash
    รูปส่งเป็น data URL ใน content array รูปแบบนี้:
      messages[0].content = [ { type: "text", text: <prompt เดิม> },
                              { type: "image_url", image_url: { url: "data:<mime>;base64,<base64>", detail: "high" } } ]
    JSON mode: response_format = { type: "json_object" }
    คำตอบ: choices[0].message.content (string JSON) · โทเคน: usage.prompt_tokens / usage.completion_tokens
  - ยิงจริงผ่าน OpenRouter ด้วยภาพสเก็ตช์ลูกค้าจริง 1 ใบ (170 KB) แล้วสำเร็จ:
    HTTP 200 · 21.8 วิ · โทเคนเข้า 1,847 / ออก 5,509 · อ่านได้ shape=I · conf=medium · runA=1980 · depth=600 · 1 ชิ้นงาน · 4 ขอบ
    (เทียบ Gemini 3.8 Flash ใบเดียวกัน: 8.5 วิ · 3,531 โทเคน · conf=high — ช้ากว่าแต่ต้นทุนต่อรูปใกล้เคียงกัน)
  - ราคา DeepSeek V4.1 Flash (ฐานจาก OpenRouter): $0.15 input / $0.60 output ต่อ 1M (off-peak) · peak = 2 เท่า
    ให้ตั้งเรตในตารางเป็นราคา peak ($0.30 / $1.20) เพื่อไม่ให้ประเมินต้นทุนต่ำกว่าความจริง
  - ฝั่งแอปยังไม่มีคีย์ OpenRouter (มีแต่คีย์ Google) โค้ดจึงต้องทำงานได้ด้วย Gemini เมื่อไม่มีคีย์
  - มีสาขาอ้างอิงที่ปิดไปแล้วซึ่งแก้ฝั่ง Gemini ไว้และผ่านเทสต์ (PR #284 · fix/david-sketch-vision-model-and-hygiene)
    จะใช้เป็นจุดตั้งต้นหรือเขียนใหม่ก็ได้ แต่ต้องมีเทสต์และหลักฐานของตัวเองครบตามข้อ EVIDENCE

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts
     (จะแยกตัวช่วยอ่าน env เป็นไฟล์ใหม่ในโฟลเดอร์ lib/ ก็ได้ — ระบุชื่อไฟล์ใน PR)
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
  1) git status และ branch แสดง feat/chai-sketch-vision-openrouter-deepseek ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → 1034 tests / pass 1034 / fail 0 (baseline บน main ณ 4 ต.ค. 69)
  4) เทสต์ใหม่ต้องครอบคลุมและรันผ่าน:
     - ตั้ง SKETCH_VISION_PROVIDER=openrouter แล้วคำขอวิ่งไป {base}/chat/completions ด้วยโมเดล deepseek/deepseek-v4.1-flash
     - ส่งรูปเป็น data URL + detail "high" และมี response_format แบบ json_object
     - auto: ใช้ openrouter ก่อนเมื่อมีคีย์ แล้วถอยไป gemini เมื่อ openrouter ตอบ 500 (ต้องได้ผลลัพธ์จาก gemini)
     - ตั้ง VERTEX_VISION_LOCATION=global แล้ว URL ต้องเป็น aiplatform.googleapis.com (ไม่มี prefix region)
     - contents ต้องมี role:"user"
     - ไม่มีคีย์ทั้งสองเจ้า → ไม่เรียก fetch เลย และ notes เป็นข้อความไทย
     - ข้อความ error ของผู้ให้บริการต้องไม่ปรากฏใน notes ที่ลูกค้าเห็น
     - usage (model + โทเคน) ถูกบันทึกเข้า cost center และเรต deepseek/deepseek-v4.1-flash คิดเงินมากกว่า 0
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - ไฟล์ตาม SCOPE + PR เข้า main พร้อมหลักฐานตามข้อ EVIDENCE
  - สรุปใน PR: ค่าตั้ง env ที่ต้องใส่บน VPS (SKETCH_VISION_PROVIDER / OPENROUTER_API_KEY / OPENROUTER_VISION_MODEL / VERTEX_VISION_LOCATION / VERTEX_AI_MODEL)

STOP:
  - เมื่อ tsc ผ่าน 0 errors, เทสต์ผ่านทั้งหมด (fail 0) และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ซ่อมสาเหตุที่พัง + DeepSeek + เลือกผู้ให้บริการ + usage/cost |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 6 ไฟล์ฝั่ง api-server (มี (ใหม่) ระบุชัด) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/index.css, ห้าม hard-code คีย์, ห้าม push main |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | คำสั่งรันจริง + เทสต์ที่ต้องมี + index.css 0 diff |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ตาม SCOPE + PR + ค่าตั้ง env |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุเงื่อนไขหยุดและ 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | ใช้ /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | รูปแบบ JSON แสดงเป็นบรรทัดเยื้อง |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุ 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/chai-sketch-vision-openrouter-deepseek |
| 11 | ระบุค่าตั้ง env ที่ต้องใช้ | ผ่าน | ครบทั้ง OpenRouter และ Vertex |
| 12 | ระบุข้อห้ามเรื่องข้อมูลลูกค้า | ผ่าน | ห้าม error ดิบถึงลูกค้า, ห้ามแตะ Production DB |
