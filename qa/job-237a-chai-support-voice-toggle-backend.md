# ใบงาน 237-A (ปิด/เปิดฟีเจอร์เสียงน้องไนท์ — Backend) — สวิตช์ `enabled` ค่าเริ่มต้น = ปิด

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — "แก้ไขเลย บอสอนุมัติ")
**สถานะ:** มอบหมายให้ ชัย (Claude CLI)
**Branch:** `feat/chai-support-voice-toggle-backend`

**ที่มา:** `POST /api/support/speech` เป็นเส้นทางสาธารณะที่เรียก Google Cloud TTS ซึ่งมีค่าใช้จ่ายตามจำนวนตัวอักษร บอสสั่งให้มีสวิตช์เปิด-ปิดในหน้าหลังบ้าน `/admin/voice-settings` และ **ค่าเริ่มต้นต้องเป็น "ปิด"** เพื่อตัดความเสี่ยงด้านค่าใช้จ่าย ส่วนหน้าจอสวิตช์เป็นงานของใบ 237-B (ทีม frontend) — ใบนี้ทำเฉพาะฝั่ง API/DB/schema

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. Migration ใหม่ (additive เท่านั้น — ห้าม DROP/TRUNCATE/DELETE เพราะ deploy.yml จะปฏิเสธทั้งรอบ):
     deploy/hostinger/migrations/024_support_voice_enabled.sql
       ALTER TABLE support_voice_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
  2. lib/db/src/schema/index.ts — เพิ่มคอลัมน์ในตาราง supportVoiceSettings:
       enabled: boolean("enabled").notNull().default(false),
  3. artifacts/api-server/src/routes/admin-router.ts:
     - serializeSupportVoiceSetting คืนฟิลด์ enabled ด้วย (ไม่มีแถว = false) — ต้องเป็น row?.enabled ?? false
     - GET /admin/support-voice คืน enabled ใน current
     - PATCH /admin/support-voice รับ enabled ได้ (optional boolean) และบันทึกพร้อม voiceName
       โดยถ้าไม่ส่งมา ให้คงค่าเดิมไว้ (requestedEnabled ?? existing.enabled) และตอนสร้างแถวใหม่ใช้ requestedEnabled ?? false
  4. artifacts/api-server/src/routes/support.ts:
     - เพิ่มฟังก์ชันที่ export ได้ชื่อ isSupportVoiceEnabled(database = db) รับ database เป็นพารามิเตอร์
       เพื่อให้เทสต์ไม่ต้องใช้ Postgres จริง · อ่านค่าล่าสุดจาก supportVoiceSettings แล้วคืนค่า === true
       และต้อง "fail closed" — ถ้า query พังให้คืน false (ห้ามเปิดเองโดยบังเอิญ)
     - เพิ่มเส้นทางสาธารณะ GET /support/voice-status คืน { enabled: <ค่าจริง> } พร้อม Cache-Control: no-store
     - POST /support/speech ต้องตรวจสวิตช์ก่อนเรียก synthesizeSpeech ถ้าปิดให้ตอบ HTTP 503
       พร้อมข้อความไทยว่า "ฟีเจอร์เสียงน้องไนท์ปิดใช้งานอยู่"
     - คง rate limit เดิมของ /support/speech (20 ครั้ง/ชม.) ไว้เหมือนเดิม
  5. ขยายสัญญา API ให้ตรงกันทั้งชุด (ตามกฎโปรเจกต์):
     - lib/api-spec/openapi.yaml — เพิ่ม enabled (boolean, required) ใน SupportVoiceSetting,
       เพิ่ม enabled (boolean, optional) ใน SupportVoiceUpdateInput,
       เพิ่ม schema SupportVoiceStatus { enabled } และ endpoint GET /support/voice-status
     - lib/api-zod/src/generated/api.ts — เพิ่มฟิลด์/สคีมาให้ตรงกับ openapi
     - lib/api-client-react/src/generated/api.schemas.ts — เพิ่ม enabled ใน SupportVoiceSetting และ SupportVoiceUpdateInput + interface SupportVoiceStatus
     ห้ามรัน orval regenerate เต็มรูปแบบในใบนี้ (มี drift ค้าง ~145 บรรทัดที่ยังไม่ได้รับอนุมัติ)
  6. เทสต์ใหม่ artifacts/api-server/test/support-voice-toggle.test.ts — ต้องรันได้โดยไม่ต้องมี Postgres และไม่ต้องมี Google credentials:
     - isSupportVoiceEnabled คืน false เมื่อไม่มีแถว / enabled=false / query โยน error
     - คืน true เฉพาะเมื่อ enabled === true เท่านั้น
     - อ่านไฟล์ migration แล้วยืนยันว่าเป็น ADD COLUMN IF NOT EXISTS ... DEFAULT false และไม่มี DROP/TRUNCATE/DELETE
     - อ่านไฟล์ schema แล้วยืนยัน default(false)
     - อ่าน sources ของ support.ts แล้วยืนยันว่าด่าน 503 อยู่ "ก่อน" synthesizeSpeech และยังมี rate limit เดิม
     - อ่าน sources ของ admin-router.ts แล้วยืนยันว่ามีการบันทึก enabled ทั้งเส้นทาง update และ insert

SCOPE:
  - /opt/data/cache/kbsrc/deploy/hostinger/migrations/024_support_voice_enabled.sql (ใหม่)
  - /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/support.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/support-voice-toggle.test.ts (ใหม่)
  - /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  - /opt/data/cache/kbsrc/lib/api-zod/src/generated/api.ts
  - /opt/data/cache/kbsrc/lib/api-client-react/src/generated/api.schemas.ts

FORBIDDEN:
  - ห้ามใช้ DROP / TRUNCATE / DELETE ในไฟล์ migration ทุกรณี
  - ห้ามตั้งค่าเริ่มต้นเป็น true — ค่าเริ่มต้นต้องเป็น false เท่านั้น
  - ห้ามลบหรือผ่อน rate limit เดิมของ /support/speech (20 ครั้ง/ชม.)
  - ห้ามแตะ artifacts/knight-basins/src/index.css และห้ามแตะ AdminVoiceSettings.tsx / KnightSupport.tsx (เป็นงานของใบ 237-B)
  - ห้ามรัน orval regenerate เต็มรูปแบบ (ให้แก้ไฟล์ generated ด้วยมือเฉพาะจุดตาม SCOPE)
  - ห้ามแตะไฟล์เทสต์เดิมที่ไม่เกี่ยวกับงานนี้
  - ห้าม push เข้า main — ต้องเปิด PR เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-support-voice-toggle-backend ชัดเจน
  2) pnpm run typecheck:libs แล้วตามด้วย npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
     (ต้อง build libs ก่อน ไม่งั้นจะติด TS6305)
  3) node --experimental-strip-types --test test/support-voice-toggle.test.ts → ผ่านทุกข้อ ระบุจำนวนข้อจริง
  4) ชุดเต็มของ api-server (ตัด *.browser.test.ts ออก) → ระบุ ผ่าน/ตก/ข้าม และระบุว่า baseline มาจากไหน
     (CI Linux หรือเครื่อง Windows) พร้อม commit ที่วัด ห้ามใช้ตัวเลขจากความจำ
  5) diff ของ artifacts/knight-basins/src/index.css ต้องว่าง (0 diff)

OUTPUT:
  - deploy/hostinger/migrations/024_support_voice_enabled.sql
  - lib/db/src/schema/index.ts
  - artifacts/api-server/src/routes/admin-router.ts
  - artifacts/api-server/src/routes/support.ts
  - artifacts/api-server/test/support-voice-toggle.test.ts
  - lib/api-spec/openapi.yaml
  - lib/api-zod/src/generated/api.ts
  - lib/api-client-react/src/generated/api.schemas.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | สวิตช์ enabled + ด่าน 503 + สัญญา API |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุไฟล์ครบ รวม generated ทั้ง 3 |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้าม DROP/TRUNCATE, ห้าม default true |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + เตือน TS6305 + ระบุที่มา baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | บันทึกผลในตารางท้ายใบงาน |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (API/DB/schema) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ค่าเริ่มต้นปิด ตามที่บอสสั่ง |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีค่า secret ในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 237-A บันทึกใน KANBAN แล้ว |
