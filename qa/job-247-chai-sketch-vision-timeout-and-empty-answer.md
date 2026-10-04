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
