# ใบงาน 247-C (ชัย) — หน้า /sketch ต้องไม่ค้าง 504 + OpenRouter ต้องตอบข้อความจริง

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย · **ด่วน** (ฟีเจอร์ AI อ่านแบบร่างบน production ยังใช้ไม่ได้)
**Branch:** `fix/chai-sketch-vision-timeout-and-empty-answer`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ "OpenRouter ตอบไม่มีข้อความ" — หลัง deploy ใบงาน 240 แล้ว ทดสอบจริงบน production ได้ HTTP 504
     และ log คอนเทนเนอร์ขึ้น: [sketch-vision] openrouter failed: OpenRouter deepseek/deepseek-v4.1-flash sent no text
     ต้องหาสาเหตุจริงและแก้ให้อ่านข้อความได้ เช่น อ่านฟิลด์ข้อความให้ครบตามรูปแบบที่ OpenRouter ส่งกลับ
     (content / reasoning), กำหนด max_tokens ให้เพียงพอต่อการคิดก่อนตอบ, และถ้าได้ผลลัพธ์ที่ไม่ใช่ข้อความ
     ให้จบอย่างรวดเร็วพร้อม log ที่บอกสาเหตุได้ (ไม่ค้าง)
  2. บังคับงบเวลารวมของทั้งคำขอ (เคยค้างถึง 60 วิ แล้วถูก proxy ตัดเป็น 504):
     - timeout ต่อผู้ให้บริการหนึ่งเจ้าไม่เกิน 20 วิ
     - เพดานเวลารวมทั้งคำขอต้องจบก่อน 45 วิ (proxy ตัดที่ 60 วิ) ถ้าเกินให้หยุดและตอบผลลัพธ์แบบ "อ่านไม่ได้" ทันที
     - รักษาสัญญาเดิม: /api/sketch/analyze ต้องตอบ 200 เสมอ และห้ามค้างจน proxy ตัด
  3. ยิงทดสอบจริงกับผู้ให้บริการจริง (มีคีย์ OpenRouter อยู่ใน /docker/knightbasins/.env แล้ว) อย่างน้อย 1 ภาพ
     และแนบผลจริงว่าได้ข้อความ/JSON กลับมา พร้อมเวลาที่ใช้

เพิ่มข้อกำหนด (บอสสั่ง 4 ต.ค. 69 — ใช้ gemini-3.1-flash-lite เป็นโมเดลหลักของเส้นทางภาพ):
  - เพิ่ม env เฉพาะทาง VERTEX_VISION_MODEL สำหรับเส้นทางอ่านภาพ โดยถ้าไม่ตั้งให้ใช้ VERTEX_AI_MODEL ตามเดิม
    เหตุผล: VERTEX_AI_MODEL ถูกใช้ร่วมกับบอทซัพพอร์ตเว็บ (vertex-gemini.ts) ซึ่งเรียกผ่าน endpoint คนละแบบ
    และ gemini-3.1-flash-lite ไม่มีให้ใช้ใน regional (404) → ถ้าเปลี่ยน VERTEX_AI_MODEL ตรง ๆ บอทซัพพอร์ตจะพัง
  - ต้องไม่แตะ vertex-gemini.ts และไม่เปลี่ยนพฤติกรรมของบอทซัพพอร์ต
  - หลัง merge จะตั้ง: VERTEX_VISION_MODEL=gemini-3.1-flash-lite · VERTEX_VISION_LOCATION=global
  หลักฐานจากเดวิด (ยิงจริง 3 ภาพผ่าน Vertex global, prompt สั้น):
    ภาพ 170KB: 2.5-flash 4.1s/1915 tok → I 1980x600 conf high · lite 4.0s/1184 tok → ผลเดียวกันเป๊ะ (โทเคนน้อยกว่า 38%)
    ภาพ 261KB: 2.5-flash ตอบข้อความว่าง · lite ตอบ JSON ได้ (I, runA 300)
    ภาพ 326KB: 2.5-flash ตอบข้อความว่าง · lite ตอบ JSON ได้ (L-right, runA 2040) ใน 2.6s
    → lite เร็ว/ถูกกว่า และในตัวอย่างนี้ "ตอบได้ครบกว่า" 2.5-flash

ข้อมูลจากเอกสาร OpenRouter (เดวิดตรวจเพิ่มให้ 4 ต.ค. 69) — ใช้หาเหตุ "sent no text":
  - ปลายทางถูกแล้ว: POST {base}/chat/completions โดย base = https://openrouter.ai/api/v1
  - header ที่จำเป็นคือ Authorization: Bearer เท่านั้น · HTTP-Referer และ X-OpenRouter-Title เป็นตัวเลือก
    (โค้ดปัจจุบันส่ง X-Title ซึ่งชื่อตามเอกสารใหม่คือ X-OpenRouter-Title — ไม่กระทบผลลัพธ์ แต่ควรแก้ให้ตรง)
  - อ่านข้อความจาก choices[0].message.content ถูกต้องแล้ว แต่เมื่อได้ข้อความว่าง ให้เก็บหลักฐานเพิ่ม:
    finish_reason · usage.completion_tokens · และ message.reasoning (โมเดลแบบ thinking อาจคืนคำตอบไว้ที่นั่น
    หรือถูกตัดกลางทางเพราะโทเคนไม่พอ)
  - แนวทางที่ควรลองและวัดผล: กำหนด max_tokens ให้เพียงพอ (เช่น 4096) · ลองไม่ส่ง response_format json_object
    ในเส้นทาง OpenRouter (prompt บังคับ JSON อยู่แล้ว) เพราะผู้ให้บริการบางรายคืน content ว่างเมื่อเปิด json_object
  - ต้อง log ก้อนคำตอบเต็มเมื่อข้อความว่าง เพื่อให้รอบต่อไปเห็นสาเหตุได้ทันที

ห้ามทำในใบงานนี้ (แยกใบงานต่างหากถ้าพบ): บั๊กเดียวกันใน stone-matcher.ts (ฝังชื่อโมเดล Gemini เก่า + region ผิด)
  และเรื่องนโยบายความเป็นส่วนตัวของการส่งภาพออกไป OpenRouter (รอเจ้าของตัดสิน)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision-config.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/sketch-vision.test.ts

FORBIDDEN:
  - ห้ามแตะไฟล์ UI ทุกไฟล์ (src/components/**, src/admin/**, src/index.css)
  - ห้ามแตะสูตรราคา/ใบเสนอราคา
  - ห้าม hard-code ชื่อโมเดลหรือคีย์ในโค้ด (มาจาก env เท่านั้น)
  - ห้ามให้ข้อความ error ดิบของผู้ให้บริการหลุดถึงลูกค้า (log เท่านั้น)
  - ห้ามเขียน/ลบข้อมูล Production · ห้าม push ตรง main (ใช้ branch + PR)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail
     (baseline ที่ชัยวัดเองบน Linux: 1074 tests / 1071 pass / 3 skipped / 0 fail)
  3) เทสต์ใหม่ต้องจำลองกรณี: (ก) OpenRouter ตอบ 200 แต่ไม่มีข้อความ → ต้องไม่ค้างและถอยไปผู้ให้บริการถัดไป
     (ข) ผู้ให้บริการค้างเกิน 20 วิ → ต้องตัดทิ้งแล้วไปต่อ (ค) งบเวลารวมเกิน 45 วิ → ต้องจบด้วยข้อความไทย
     และพิสูจน์ว่าเทสต์จับบั๊กได้จริง (ย้อนโค้ดกลับแล้วเทสต์ต้องตก)
  4) ยิงจริง (แนบหลักฐานดิบ): POST ไป OpenRouter ด้วยภาพสเก็ตช์ 1 ภาพ → ได้ข้อความ/JSON + เวลาจริง
     และยิงผ่าน production  https://knightbasins.srv1964473.hstgr.cloud/api/sketch/analyze
     → ต้องได้ HTTP 200 (ไม่ใช่ 504) และเวลารวม < 45 วิ (แนบทั้งรหัส HTTP และเวลาที่วัดได้)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - ไฟล์ตาม SCOPE + PR เข้า main
  - สรุปใน PR: สาเหตุจริงของ "sent no text" · งบเวลาที่ใช้ · ตัวเลข HTTP/เวลาจริงจากการยิง production

**การยิงจริง (บอส+เดวิดเคาะ 4 ต.ค. 69):** ห้ามผู้รับงานแตะ Production และห้ามพยายามอ่านไฟล์ความลับ (`.env` ถูกบล็อกโดยนโยบาย sandbox ของผู้รับงาน)
  — คีย์และสิทธิ์อยู่ฝั่งเดวิด · **เดวิดเป็นผู้ยิงจริง** แล้วส่งผลดิบ (HTTP code/เวลา/ผลลัพธ์) กลับให้ผู้รับงานแนบใน PR
  · เทสต์ unit ใช้ mock env ในตัวเทสต์ (ค่าปลอม) ห้ามอ่านค่าจริง · ให้อ่าน **ชื่อ** ตัวแปรจากโค้ด `sketch-vision-config.ts` เท่านั้น
  · รายงานตรง ๆ ว่า "ถูกบล็อกโดยนโยบาย และไม่ได้พยายามบายพาส" ถ้าเจอการบล็อก

STOP:
  - เมื่อ tsc 0 errors เทสต์ผ่านทั้งหมด และยิง production ได้ HTTP 200 ภายใน 45 วิ แล้วเปิด PR
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ + สาเหตุที่ยังหาไม่เจอ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แก้ no-text + งบเวลา + ยิงจริง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ฝั่ง api-server |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/index.css · ห้ามฝังคีย์ · ห้าม push main |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + baseline + ยิง production HTTP/เวลา |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + สรุปสาเหตุ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี ``` ซ้อน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุ 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-sketch-vision-timeout-and-empty-answer |
| 11 | มี baseline ตัวเลข | ผ่าน | 1074/1071/3/0 (Linux) |
| 12 | แยกเรื่องอื่นออกจากใบงาน | ผ่าน | stone-matcher + PDPA ระบุให้รอเจ้าของตัดสิน |


## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

งาน 240/241 merge เข้า main แล้ว · งานถัดไป: ใบงาน 247 (ด่วน) — `qa/job-247-chai-sketch-vision-timeout-and-empty-answer.md`
1. หน้า /sketch ยังพัง: OpenRouter/DeepSeek ตอบ "sent no text" → ค้าง 60 วิ → HTTP 504
2. คุมงบเวลารวมให้จบก่อน 45 วิ (timeout ต่อผู้ให้บริการ ≤ 20 วิ)
3. แนวทางหาเหตุ: กำหนด max_tokens ให้พอ · ลองปิด response_format json_object ในเส้นทาง OpenRouter · log finish_reason + usage + message.reasoning เมื่อข้อความว่าง · header ที่เอกสารระบุคือ X-OpenRouter-Title
4. เพิ่มค่าตั้ง VERTEX_VISION_MODEL (เฉพาะเส้นทางภาพ) — ปัจจุบันใช้ VERTEX_AI_MODEL=google/gemini-3.1-flash-lite + VERTEX_VISION_LOCATION=global อยู่จริง ห้ามทำบอทซัพพอร์ตพัง
5. **การยิงจริง: เดวิดเป็นผู้ยิง** (คีย์/สิทธิ์อยู่ฝั่งเดวิด) — ห้ามแตะ Production เอง · ส่งคำสั่ง+รูปแบบผลที่ต้องการ แล้วผมยิงให้ ส่งผลดิบกลับให้แนบใน PR
6. หลักฐาน: tsc 0 · เทสต์ชุดเต็ม · HTTP 200 ภายใน 45 วิ (แนบเวลาจริง) · index.css 0 diff
