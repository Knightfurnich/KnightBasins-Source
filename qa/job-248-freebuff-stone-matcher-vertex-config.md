# ใบงาน 248-F (บอย/Freebuff) — ซ่อมตัวจับคู่สีหินจากภาพ (stone-matcher) ให้ใช้โมเดลจาก env

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้บอย (Freebuff) · เริ่มได้ทันที
**Branch:** `fix/freebuff-stone-matcher-vertex-config`
**ที่มา:** ชัยตรวจพบระหว่างทำใบงาน 240 ว่าฟีเจอร์นี้มีบั๊กชุดเดียวกับหน้า /sketch แต่ไม่อยู่ในขอบเขตของเขา จึงแยกเป็นใบงานนี้

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ artifacts/api-server/src/lib/stone-matcher.ts ซึ่งฝังชื่อโมเดลและพื้นที่ไว้ในโค้ด
     (โมเดล "gemini-3.8-flash" ที่โปรเจกต์ไม่มีจริง + location "asia-southeast1")
     ทำให้ฟีเจอร์ "จับคู่สีหินจากภาพ" ใช้งานไม่ได้เลย — โมเดลที่ถูกต้องต้องมาจาก env เท่านั้น
  2. ใช้ตัวช่วยที่มีอยู่แล้วจากใบงาน 240 (ไฟล์ src/lib/sketch-vision-config.ts) เพื่อไม่ให้มีสองมาตรฐาน:
     อ่านโมเดล/location จาก env (VERTEX_AI_MODEL, VERTEX_AI_FALLBACK_MODELS, VERTEX_VISION_LOCATION),
     ถอด prefix "google/" ที่ใช้ร่วมกับฟีเจอร์อื่น, และรองรับ location=global ที่ host ไม่มี prefix ของ region
  3. ส่งคำขอแบบผู้ใช้: contents ต้องมี role:"user" (ไม่มีแล้ว Vertex ตอบ HTTP 400 "Please use a valid role: user, model.")
  4. ถอยไปใช้โมเดลสำรองใน env อัตโนมัติเมื่อโมเดลที่ตั้งไว้ถูกเลิกใช้ (404 แบบ model not found)
  5. ข้อความ error ดิบของผู้ให้บริการ (ชื่อโปรเจกต์/region/พาธโมเดล) ต้องอยู่แค่ใน log — ลูกค้าเห็นข้อความไทยคงที่
  6. คงพฤติกรรมเดิม: ห้าม throw, ผู้ใช้ที่เรียกไม่สำเร็จต้องได้ผลลัพธ์ "จับคู่ไม่ได้" แบบสุภาพ ไม่ใช่ 500

ข้อกำหนดจำนวนครั้งในการทดสอบ (บอสกำหนด) — **ทดสอบยิงจริง 3 ครั้ง ไม่ใช่ 5** เหตุผล: ลิมิตคือ 5 คำขอ/10 นาทีต่อ IP
  และแต่ละครั้งกินเวลา 20-30 วิ + มีค่าใช้จ่าย · สิ่งที่ต้องพิสูจน์คือ "ครอบคลุมเคส" ไม่ใช่ "จำนวนครั้ง"
  ต้องเป็น 3 เคสที่ต่างกันจริง:
    (ก) ภาพที่มีสีใกล้เคียงในแคตตาล็อก → ต้องได้ผลลัพธ์ที่มีรายการแมตช์
    (ข) ภาพที่ไม่มีสีใกล้เคียง → ต้องได้รายการว่าง ไม่เดาสีมั่ว
    (ค) กรณีผู้ให้บริการล้ม (โมเดลผิด/เน็ตหลุด) → ต้องได้ผลลัพธ์ "จับคู่ไม่ได้" แบบสุภาพ + ไม่มีข้อความภายในหลุด
  นอกเหนือจากนั้นให้ใช้เทสต์ unit (mock) ครอบคลุมเคสอื่น ๆ ได้ไม่จำกัด

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/stone-matcher.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/stone-match-prompt.test.ts

FORBIDDEN:
  - ห้ามแตะ src/lib/sketch-vision.ts, src/lib/sketch-vision-config.ts, src/routes/leads.ts, test/sketch-vision.test.ts
    (ชัยถือไฟล์เหล่านี้อยู่ในใบงาน 247 — ถ้าจำเป็นต้องแก้ ให้รายงานเดวิดแล้วรอใบงานแยก)
  - ห้ามแตะไฟล์ UI ทุกไฟล์ (src/components/**, src/admin/**, src/index.css)
  - ห้าม hard-code ชื่อโมเดลหรือคีย์ในโค้ด (มาจาก env เท่านั้น)
  - ห้ามให้ข้อความ error ดิบของผู้ให้บริการหลุดถึงผู้ใช้
  - ห้ามแก้สูตรราคา · ห้ามเขียน/ลบข้อมูล Production · ห้าม push ตรง main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail
     (baseline บน Linux หลัง merge ใบงาน 240: 1074 tests / 1071 pass / 3 skipped / 0 fail)
  3) เทสต์ unit ใหม่ต้องครอบคลุม: role:"user" ใน contents · โมเดล/location มาจาก env · global host ไม่มี prefix ·
     ถอยโมเดลสำรองเมื่อ 404 · ข้อความ error ดิบไม่หลุดถึงผู้ใช้ · และต้องพิสูจน์ว่าเทสต์จับบั๊กได้จริง
     (ย้อนโค้ดกลับเป็นของ main แล้วเทสต์ต้องตก — แนบว่าตกกี่ข้อ)
  4) ยิงจริง 3 เคสตามข้อกำหนดด้านบน — แนบผลดิบทีละเคส (รหัส HTTP, เวลาที่ใช้, ผลลัพธ์ที่ได้)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/stone-matcher.ts
  - artifacts/api-server/test/stone-match-prompt.test.ts
  - PR เข้า main พร้อมหลักฐานตามข้อ EVIDENCE + สรุปว่าก่อน/หลังต่างกันอย่างไร

**การยิงจริง (บอส+เดวิดเคาะ 4 ต.ค. 69):** ห้ามผู้รับงานแตะ Production และห้ามพยายามอ่านไฟล์ความลับ (`.env` ถูกบล็อกโดยนโยบาย sandbox ของผู้รับงาน)
  — คีย์และสิทธิ์อยู่ฝั่งเดวิด · **เดวิดเป็นผู้ยิงจริง** แล้วส่งผลดิบ (HTTP code/เวลา/ผลลัพธ์) กลับให้ผู้รับงานแนบใน PR
  · เทสต์ unit ใช้ mock env ในตัวเทสต์ (ค่าปลอม) ห้ามอ่านค่าจริง · ให้อ่าน **ชื่อ** ตัวแปรจากโค้ด `sketch-vision-config.ts` เท่านั้น
  · รายงานตรง ๆ ว่า "ถูกบล็อกโดยนโยบาย และไม่ได้พยายามบายพาส" ถ้าเจอการบล็อก

STOP:
  - เมื่อ tsc 0 errors เทสต์ผ่านทั้งหมด ยิงจริงครบ 3 เคส และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แก้โมเดล/region + ใช้ตัวช่วยกลาง + role + error hygiene |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ (lib + test) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะไฟล์ของชัย (247) · UI · ห้ามฝังชื่อโมเดล |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + baseline + unit + ยิงจริง 3 เคส + index.css 0 diff |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + สรุปก่อน/หลัง |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี ``` ซ้อน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุ 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/freebuff-stone-matcher-vertex-config |
| 11 | ระบุจำนวนครั้งทดสอบจริง | ผ่าน | 3 เคสต่างกัน + เหตุผล (ลิมิต 5/10 นาที) |
| 12 | กันไฟล์ทับกับใบงาน 247 | ผ่าน | SCOPE ไม่ทับกับไฟล์ที่ชัยถืออยู่ |


## ข้อความส่งต่อ (บอส copy ส่งให้บอย)

[เดวิด → บอย]

รับทราบรายงานตรวจ PR #287 ครับ ตรงกัน 100% · งานถัดไป: ใบงาน 248-F — `qa/job-248-freebuff-stone-matcher-vertex-config.md`
1. ซ่อม `artifacts/api-server/src/lib/stone-matcher.ts` (จับคู่สีหินจากภาพ) — ฝัง gemini-3.8-flash + asia-southeast1 → ใช้งานไม่ได้
2. ใช้ตัวช่วยกลาง `src/lib/sketch-vision-config.ts` + role:"user" + ถอยโมเดลสำรองเมื่อ 404 + ห้าม error ดิบหลุดถึงลูกค้า
3. ห้ามแตะไฟล์ที่ชัยถืออยู่ (sketch-vision.ts, sketch-vision-config.ts, routes/leads.ts, test/sketch-vision.test.ts) และห้ามแตะ UI/index.css
4. ทดสอบยิงจริง 3 เคสต่างกัน (มีคู่/ไม่มีคู่/ผู้ให้บริการล้ม) — **เดวิดเป็นผู้ยิง** · ห้ามพยายามอ่าน `.env` หรือบายพาสการบล็อกของ sandbox (รายงานตรง ๆ ว่าถูกบล็อกโดยนโยบาย)
5. หลักฐาน: tsc 0 · เทสต์ชุดเต็ม (baseline 1074/1071/3/0) · ย้อนโค้ดแล้วเทสต์ต้องตก · index.css 0 diff · สาขา `fix/freebuff-stone-matcher-vertex-config`
