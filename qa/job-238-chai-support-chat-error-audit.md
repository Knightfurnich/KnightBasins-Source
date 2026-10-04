# ใบงาน 238 (Audit Error ของ /support/chat) — ให้เหตุการณ์ที่แชทล้มเหลือร่องรอยตรวจย้อนหลังได้

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — "แก้ไขเลย บอสอนุมัติ")
**สถานะ:** มอบหมายให้ ชัย (Claude CLI)
**Branch:** `feat/chai-support-chat-error-audit`

**ที่มา:** เมื่อ 3 ต.ค. เกิดบั๊ก ReferenceError ในปลายทางของ `POST /support/chat` แต่ตรวจย้อนหลังไม่ได้ว่าเกิดกี่ครั้ง เพราะเส้นทางนี้ไม่เขียนอะไรลง DB และไม่เรียก audit เลย (grep `audit` ใน support.ts ได้ 0 รายการ) ตอนนั้นจึงสรุปได้แค่ "ไม่พบร่องรอย แต่ระบบไม่ได้บันทึกไว้" ใบนี้ปิดช่องนั้น — บันทึก **เฉพาะเหตุการณ์ข้อผิดพลาด** ไม่เก็บข้อความของลูกค้าและไม่เก็บข้อมูลส่วนตัวใด ๆ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. artifacts/api-server/src/routes/support.ts — บันทึก audit เมื่อเกิดข้อผิดพลาดใน POST /support/chat
     - ใช้ logAuditEvent() ที่มีอยู่แล้วจาก ../lib/audit-logger (ห้ามเขียน INSERT เอง)
     - action ต้องเป็นชื่อคงที่ค่าเดียว: "support.chat.error"
     - actorType: "customer"
     - status: "error"
     - errorCode: ชื่อคลาสของ error เช่น error.constructor.name หรือ "unknown_error" (ห้ามใส่ error.message ตรง ๆ
       เพราะข้อความ exception อาจมี SQL/พาธ/ข้อมูลภายในติดมา — ถ้าต้องการรายละเอียด ให้ส่ง errorName เท่านั้น)
     - targetId: ใช้รหัสที่ไม่ระบุตัวลูกค้า ถ้ามี account ให้ใช้ account.id แปลงเป็นสตริง ไม่มีให้เป็น null
       (ห้ามใช้ชื่อ เบอร์โทร อีเมล หรือข้อความแชท)
     - details: อนุญาตให้มีได้เฉพาะคีย์ที่ไม่ใช่ข้อมูลส่วนตัวและไม่ใช่เนื้อความแชท เช่น { messageLength: <จำนวนตัวอักษร> }
       ห้ามส่ง req.body, message, หรือข้อความของผู้ใช้ลง details ทุกรณี
     - ใส่ ipAddress/userAgent ด้วย auditRequestContext(req) ตามรูปแบบที่ไฟล์อื่นในโปรเจกต์ใช้
     - การบันทึก audit ต้องไม่ทำให้คำตอบของลูกค้าพัง: logAuditEvent ไม่ throw อยู่แล้ว ให้เรียกแบบ fire-and-forget
       (void logAuditEvent(...)) ในเส้นทาง catch ของ /support/chat และต้องเรียก next(error) ต่อตามเดิม
  2. ขยายเอกสารสัญญาเท่าที่จำเป็น: ไม่ต้องเพิ่ม endpoint หรือสคีมาใหม่
     ถ้า openapi.yaml อธิบาย response ของ /support/chat ไว้ ให้คงเดิม (ใบนี้ไม่เปลี่ยนสัญญาที่ลูกค้าเห็น)
  3. เทสต์ใหม่ artifacts/api-server/test/support-chat-error-audit.test.ts — ต้องรันได้โดยไม่ต้องมี Postgres:
     - อ่านซอร์สของ support.ts แล้วยืนยันว่ามีการเรียก logAuditEvent ด้วย action "support.chat.error"
       และ status "error" อยู่ในเส้นทาง catch ของ /support/chat
     - ยืนยันว่าไม่มีการส่งตัวแปร message หรือ req.body ลงใน details ของ event นั้น (assert.doesNotMatch)
     - ยืนยันว่า errorCode ที่บันทึกเป็นชื่อคลาส ไม่ใช่ error.message
     - ยืนยันว่าเส้นทางยังคงเรียก next(error) หลังบันทึก audit

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/support.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/support-chat-error-audit.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามเก็บข้อความแชทของผู้ใช้ เบอร์โทร ชื่อ ที่อยู่ อีเมล หรือเลขผู้เสียภาษี ลงใน audit ทุกรณี
  - ห้ามเก็บ error.message ดิบ ๆ ลงในฟิลด์ใด ๆ (ให้ใช้ชื่อคลาสของ error)
  - ห้ามเปลี่ยนพฤติกรรมที่ลูกค้าเห็นของ POST /support/chat (คำตอบและ HTTP code ต้องเหมือนเดิม)
  - ห้ามแตะ artifacts/knight-basins/** ทุกไฟล์
  - ห้ามแตะ artifacts/knight-basins/src/index.css เด็ดขาด (0 diff)
  - ห้ามแก้ระบบ redaction ของ audit-logger.ts ให้อ่อนลง
  - ห้าม push เข้า main — ต้องเปิด PR เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-support-chat-error-audit ชัดเจน
  2) pnpm run typecheck:libs แล้วตามด้วย npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
     (ต้อง build libs ก่อน ไม่งั้นจะติด TS6305)
  3) node --experimental-strip-types --test test/support-chat-error-audit.test.ts → ผ่านทุกข้อ ระบุจำนวนข้อจริง
  4) ชุดเต็มของ api-server (ตัด *.browser.test.ts ออก) → ระบุ ผ่าน/ตก/ข้าม และระบุที่มา baseline
     (CI Linux หรือเครื่อง Windows) พร้อม commit ที่วัด ห้ามใช้ตัวเลขจากความจำ
  5) ยืนยันว่าไม่มีการใช้คำว่า message ใน details ของ event ใหม่ (แนบผลการค้นหรือผลเทสต์)
  6) diff ของ artifacts/knight-basins/src/index.css ต้องว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/support.ts
  - artifacts/api-server/test/support-chat-error-audit.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | audit เฉพาะ error ไม่เก็บข้อมูลส่วนตัว |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ ไม่ลาม |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามเก็บข้อความแชท/error.message |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + เตือน TS6305 + ระบุที่มา baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | บันทึกผลในตารางท้ายใบงาน |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (API/audit) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ตามข้อเสนอที่ชัยให้ไว้ 3 ต.ค. 69 |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีค่า secret ในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 238 บันทึกใน KANBAN แล้ว |
