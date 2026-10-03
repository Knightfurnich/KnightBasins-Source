# ใบงาน 235 (น้องไนท์ Web — Guest Scope) — บอกขอบเขตการตอบของโหมดไม่ล็อกอิน + เชิญเข้าสู่ระบบ LINE

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — เลือกทางเลือกที่ 1)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI)
**Branch:** `feat/chai-support-guest-scope-message`

**ที่มา:** บอสพบว่าลูกค้าถามคำถามเดียวกัน "โอนเงินที่ไหน" แล้วหน้าเว็บกับ LINE ตอบไม่เหมือนกัน เพราะหน้าเว็บสำหรับผู้ที่ยังไม่ล็อกอิน LINE จะตอบได้เฉพาะค้นหา SKU ในแคตตาล็อก ส่วน LINE ใช้ AI เต็มรูปแบบ บอสเลือกแนวทางที่ 1: แสดงขอบเขตให้ชัด + ชวนเข้าสู่ระบบ LINE เพื่อปลดล็อกโหมดเต็ม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/routes/support.ts ที่ปลายทางสุดท้ายของ POST /support/chat
     (ปัจจุบันข้อความคือ "ดิฉันช่วยค้นหา SKU อ่างล้างหน้า รหัสสีหิน ราคา ขนาด และวิดีโอ 3D 360° ได้ค่ะ ...")
     เปลี่ยนเป็นข้อความที่บอกขอบเขตตามจริง โดยใช้ข้อความนี้:
     "ตอนนี้คุณกำลังใช้โหมดทั่วไป (ยังไม่เข้าสู่ระบบ LINE) ดิฉันตอบได้เฉพาะข้อมูลสินค้าในแคตตาล็อก เช่น \"KF023\" หรือ \"BW010\" ค่ะ\n\nหากต้องการปรึกษาการออกแบบ การชำระเงิน สถานะใบเสนอราคา หรือข้อมูลอื่น ๆ กรุณาเข้าสู่ระบบด้วย LINE ที่ปุ่มด้านบน เพื่อคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE ค่ะ\n\nหรือติดต่อฝ่ายขาย 094-496-1949 · 089-762-2209"
  2. เพิ่มฟิลด์ใหม่ใน response ของ POST /support/chat ชื่อ loginRequired: boolean
     - true เมื่อผู้ใช้ยังไม่ได้ล็อกอิน LINE และข้อความไม่ตรงแคตตาล็อก (คือเส้นทาง fallback นี้)
     - ไม่ต้องส่งฟิลด์นี้ (หรือส่ง false) ในกรณีที่ตอบจากฐานข้อมูลสินค้า หรือตอบผ่าน Hermes
  3. ขยาย Zod/OpenAPI: ต้อง extend schema ของ response POST /support/chat ให้มี loginRequired
     เป็น optional boolean และ sync client ที่ artifacts/knight-basins ใช้ (ตามกฎโปรเจกต์)
  4. เพิ่มเทสต์ใน artifacts/api-server/test/support-route.test.ts:
     - POST /support/chat แบบไม่มี cookie (ผู้เยี่ยมชม) ด้วยข้อความทั่วไป เช่น "โอนเงินที่ไหน"
       → 200, reply มีคำว่า "เข้าสู่ระบบด้วย LINE" และ loginRequired === true
     - POST /support/chat ด้วยข้อความที่เป็นรหัสสินค้าจริง เช่น "KF001" → loginRequired ไม่เป็น true
     - ตรวจว่าไม่มีคำว่า "ป้องกันการสุ่ม" หรือข้อความเดิม "ดิฉันช่วยค้นหา SKU อ่างล้างหน้า" หลงเหลือในไฟล์

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/support.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/support-route.test.ts
  - /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  - /opt/data/cache/kbsrc/lib/api-zod/src/generated/api.ts
  - /opt/data/cache/kbsrc/lib/api-client-react/src/generated/api.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะ artifacts/knight-basins/src/components/KnightSupport.tsx (เป็นงานของใบงาน 236)
  - ห้ามเปลี่ยนพฤติกรรมของเส้นทางที่ล็อกอินแล้ว หรือเส้นทางที่ตอบจากแคตตาล็อก
  - ห้ามเพิ่มคอลัมน์หรือแก้ schema ของฐานข้อมูลในใบงานนี้
  - ห้ามแก้หรือลบเทสต์เดิมที่ไม่เกี่ยวกับงานนี้

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-support-guest-scope-message ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors (ต้องรัน pnpm run typecheck:libs ก่อน)
  3) node --experimental-strip-types --test test/support-route.test.ts (ใน artifacts/api-server) → ผ่านทุกข้อ ระบุจำนวน
  4) npm test ของ api-server ตัด *.browser.test.ts → ระบุจำนวน ผ่าน/ตก/ข้าม และ baseline แหล่งที่มา (CI Linux)
  5) diff artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/support.ts
  - artifacts/api-server/test/support-route.test.ts
  - lib/api-spec/openapi.yaml
  - lib/api-zod/src/generated/api.ts
  - lib/api-client-react/src/generated

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ข้อความ scope + ฟิลด์ loginRequired |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | รวม OpenAPI/Zod/client sync |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, ไม่แตะไฟล์ของใบ 236 |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + ต้อง build libs ก่อน tsc |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (API + schema) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ตามทางเลือกที่ 1 ที่บอสเลือก |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีข้อมูลลับในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 235 บันทึกแล้ว |
