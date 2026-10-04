# ใบงาน 257-C (ชัย) — ด่วน: "ผู้ช่วย AI ประจำระบบ" ตอบไม่ได้ (mode dashboard/cost → HTTP 500)

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) · **ความสำคัญ: ด่วน**
**สถานะ:** มอบหมายให้ **ชัย (Claude Code CLI)** · 1 ใบงาน = 1 สาขา = 1 PR
**Branch:** `fix/chai-ops-assistant-payment-date-crash`
**ที่มา:** บอสแจ้งว่า ผู้ช่วย AI ประจำระบบ (หน้า /admin) ตอบไม่ได้เลย
**หลักฐานจริงที่เดวิดเก็บแล้ว (log คอนเทนเนอร์ production + ยิง API จริง 4 ต.ค. 69):**
  - `POST /api/admin/assistant/ask` mode=dashboard → **HTTP 500** · mode=cost → **HTTP 500** · mode=leads → HTTP 200 ตอบได้ปกติ
  - log: `TypeError: latestPayment.createdAt.slice is not a function` at `src/lib/ops-assistant.ts:104` (ผ่าน buildOpsContextSummary:175 → askOpsAssistant:188)
  - สาเหตุ: ค่าจากฐานข้อมูลเป็น **Date object** (ไม่ใช่ string) แต่โค้ดเรียก `.slice()` ตรง ๆ → พังทั้งโหมดที่ดึงข้อมูลการชำระเงิน
  - หมายเหตุ: ปัญหาโมเดล AI (VERTEX_AI_MODEL ชี้รุ่นที่ endpoint ไม่ให้บริการ) เดวิดแก้บน production แล้ว — ส่งผลให้โหมด leads ตอบได้อีกครั้ง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ TypeError ใน /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ops-assistant.ts บรรทัด ~104 ที่เรียก .slice() กับค่าที่มาจากฐานข้อมูลโดยตรง
     - ค่าที่มาจาก DB (createdAt/updatedAt/paidAt ฯลฯ) อาจเป็น Date | string | null → ต้องแปลงอย่างปลอดภัยก่อนใช้งาน (เช่น ฟังก์ชันช่วย format เป็น YYYY-MM-DD รองรับ Date, ISO string, null/undefined)
     - ตรวจทั้งไฟล์ว่ามีจุดอื่นที่เรียกเมธอดของ string กับค่าจาก DB อีกหรือไม่ (grep `.slice(` `.toLowerCase(` `.trim(` ที่ผูกกับค่าจาก query) แล้วแก้ให้ปลอดภัยเท่ากัน
     - ห้ามเปลี่ยนข้อความ/output ที่ผู้ช่วยตอบ (ยกเว้นวันที่ที่ต้องแสดงเป็นรูปแบบเดิม) · ห้าม throw ออกไปข้างนอก (โหมดต้องตอบ 200 ok=true เสมอเมื่อผู้ช่วยทำงานได้)
  2. เพิ่มเทสต์กันถอยหลัง: จำลองแถวการชำระเงินที่ createdAt เป็น **Date object จริง** → buildOpsContextSummary/askOpsAssistant ต้องไม่ throw และวันที่ต้องออกมาเป็น YYYY-MM-DD
     (ปัจจุบันเทสต์เดิมไม่จับ เพราะ mock เป็น string)
  3. **รองรับ location=global ในตัวเรียก Vertex ของผู้ช่วย** (`artifacts/api-server/src/lib/vertex-gemini.ts`)
     - URL ปัจจุบันประกอบเป็น `https://{location}-aiplatform.googleapis.com/...` → ใช้ได้กับโซนภูมิภาค แต่ถ้าตัั้ง `VERTEX_AI_LOCATION=global` จะได้ host `global-aiplatform...` → **404**
     - แก้เป็น: ถ้า location = `global` → `https://aiplatform.googleapis.com/...` (ไม่มี prefix) · อื่น ๆ คงเดิม
     - หลักฐานที่เดวิดยิงจริงด้วย service account เดียวกัน (4 ต.ค. 69):
       · `https://aiplatform.googleapis.com/v1/projects/{P}/locations/global/endpoints/openapi/chat/completions` + `google/gemini-3.1-flash-lite` → **HTTP 200** (ตอบ "pong")
       · `https://global-aiplatform.googleapis.com/...` (แบบที่โค้ดปัจจุบันสร้าง) → **404**
       · `https://asia-southeast1-aiplatform.googleapis.com/...` + `google/gemini-3.1-flash-lite` → **404**
     - เพิ่มการ **ถอยรุ่นอัตโนมัติ**: ถ้ารุ่นที่ตั้งไว้ได้ 404 ให้ลองรุ่นถัดไปจาก `VERTEX_AI_FALLBACK_MODELS` (ถ้ามี) แล้ว log เตือน — ห้ามให้กล่องตอบ "ไม่พร้อมใช้งาน" เพราะตั้งชื่อรุ่นผิดตัวเดียว
   เป้าหมายปลายทาง: `VERTEX_AI_MODEL=google/gemini-3.1-flash-lite` + `VERTEX_AI_LOCATION=global` → ตัวช่วยและตัวอ่านแบบร่างใช้รุ่นเดียวกัน (เร็วทั้งคู่) · เดวิดจะยิงทดสอบหลัง deploy
   (ยังไม่ต้องแก้ router ของผู้ช่วย)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ops-assistant.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/vertex-gemini.ts (รองรับ location=global + ถอยรุ่นอัตโนมัติ)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ (ไฟล์เทสต์ของ ops-assistant — ถ้ายังไม่มี ให้สร้างใหม่และรายงานชื่อไฟล์)

FORBIDDEN:
  - ห้ามแตะ UI ทุกไฟล์ (artifacts/knight-basins/**) รวม src/index.css · src/admin/**
  - ห้ามแตะไฟล์ของใบงานอื่น: sketch-vision*.ts (ยังใช้ได้ตามเดิม) · routes/leads.ts · ai-cost-tracker.ts · admin-router.ts (เว้นแต่จำเป็นจริงและต้องระบุเหตุผลในPR) · และห้ามแตะ UI ทุกไฟล์ของใบงาน 258
  - ห้าม hard-code วันที่/ข้อมูลตัวอย่างลงในโค้ดผลิต · ห้ามแตะ Production · ห้าม push ตรง main

EVIDENCE:
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail
     ตัวเลขอ้างอิงตั้งต้นล่าสุด: 1126 tests / 1123 pass / 3 fail (ชุด incident-alerts เดิมของ Windows) / 0 skip
  3) เทสต์หน่วยสำหรับตัวสร้าง URL ของ vertex-gemini: location=global → host ต้องเป็น `aiplatform.googleapis.com` และ location=asia-southeast1 → `asia-southeast1-aiplatform.googleapis.com` (พิสูจน์ด้วยเทสต์ ไม่ใช่คำรับรอง)
  4) รันเทสต์ไฟล์ใหม่/ที่แก้โดยตรง → ผ่าน และ **พิสูจน์ว่าจับบั๊กได้**: ย้อน ops-assistant.ts เป็นของ main แล้วรันเทสต์นี้ → ต้องตก (แนบข้อความ error ที่ได้ ซึ่งควรมีคำว่า "slice is not a function")
  5) ยิงจริงหลัง deploy (เดวิดจะยิงให้): `POST /api/admin/assistant/ask` ด้วย body {"question":"สรุปภาพรวมให้หน่อย","mode":"dashboard"} และ mode=cost → ต้องได้ HTTP 200 และ ok=true ทั้งสองโหมด
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - ops-assistant.ts ที่ไม่พังกับค่าจาก DB
  - vertex-gemini.ts ที่รองรับ `VERTEX_AI_LOCATION=global` + ถอยรุ่นอัตโนมัติเมื่อ 404
  - เทสต์ใหม่ที่จำลอง Date object จริง
  - PR เข้า main พร้อมผลรันจริง · ผล grep จุดอื่นที่เสี่ยง · และยืนยันว่าเทสต์เดิมยังผ่าน

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่าน (ยกเว้น 3 ข้อ incident-alerts เดิม) · พิสูจน์จับบั๊กได้ · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 20 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | แก้ TypeError + เทสต์กันถอยหลัง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ops-assistant.ts + เทสต์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/ไฟล์ใบงานอื่น |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + เทสต์ + พิสูจน์จับบั๊ก + ยิงจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + หลักฐาน |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 20 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-ops-assistant-payment-date-crash |
| 11 | อ้างตัวเลข baseline | ผ่าน | 1126/1123/3 |
| 12 | ไม่ทับไฟล์กับใบงานอื่น | ผ่าน | 254 = ai-cost-tracker · 256 = StudioPage |

## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

**งานด่วน (เล็ก):** ใบงาน 257 — `qa/job-257-chai-ops-assistant-payment-date-crash.md` · สาขา `fix/chai-ops-assistant-payment-date-crash`
บอสแจ้งว่าผู้ช่วย AI ประจำระบบตอบไม่ได้ · ผมตรวจ log production + ยิง API จริงแล้ว:
- mode=dashboard → **HTTP 500** · mode=cost → **HTTP 500** · mode=leads → 200 ปกติ
- error: `TypeError: latestPayment.createdAt.slice is not a function` ที่ `src/lib/ops-assistant.ts:104` (DB คืนค่าเป็น Date object แต่โค้ดเรียก .slice() ตรง ๆ)
งาน: แปลงค่าจาก DB อย่างปลอดภัย (Date|string|null → YYYY-MM-DD) + ตรวจจุดอื่นในไฟล์ที่เรียกเมธอดของ string กับค่าจาก DB + เพิ่มเทสต์ที่จำลอง Date object จริง (เทสต์เดิม mock เป็น string จึงไม่จับ)
หลักฐาน: tsc 0 · ชุด api-server (baseline 1126/1123/3) · ย้อนโค้ดแล้วเทสต์ต้องตกพร้อมข้อความ "slice is not a function" · หลัง deploy ผมจะยิง dashboard/cost ให้ต้องได้ 200 ok=true
หมายเหตุ: ผมแก้ปัญหาโมเดลบน production ชั่วคราวแล้ว (VERTEX_AI_MODEL=google/gemini-2.5-flash) — โหมด leads กลับมาตอบได้แล้ว
ข้อ 3 (รองรับ global + ถอยรุ่นอัตโนมัติ): ให้ `vertex-gemini.ts` สร้าง URL แบบนี้ — ถ้า `VERTEX_AI_LOCATION=global` ใช้ host `aiplatform.googleapis.com` (ไม่มี prefix ภูมิภาค) · ถ้าเป็นโซนอื่นคงเดิม `{location}-aiplatform.googleapis.com` · เพิ่มเทสต์ตัวสร้าง URL ทั้งสองแบบ · และถ้ารุ่นที่ตั้งไว้ได้ 404 ให้ลองรุ่นถัดไปจาก `VERTEX_AI_FALLBACK_MODELS` แล้ว log เตือน (ห้ามให้กล่องตอบ "ไม่พร้อมใช้งาน" เพราะชื่อรุ่นผิดตัวเดียว)
หลักฐานสดที่ผมยิงเอง: `lite @aiplatform/global compat` = **200** (ตอบ pong) · `global-aiplatform…` = **404** · `asia-southeast1-aiplatform…` = **404**
ปลายทาง: ให้ตัวช่วย AI + น้องไนท์ (LINE) + ตัวอ่านแบบร่าง ใช้ `google/gemini-3.1-flash-lite` รุ่นเดียวกัน (เร็วทั้งคู่) — ผมจะสลับ env หลัง deploy แล้วยิงทดสอบ dashboard/cost/leads ให้ครบเอง
