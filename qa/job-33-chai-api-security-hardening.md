# ใบงาน 33 (ชัย) — ยกระดับความปลอดภัย API Server ตามรายงาน Security Audit (Task 33)

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** แก้ไข 3 จุดเสี่ยงความปลอดภัย API ตามข้อวิเคราะห์ในรายงาน `docs/security-audit-api-2026-09-25.md` ของชัย (PR #6): (1) ป้องกัน memory leak ใน Rate Limiter ด้วยการล้าง entry ที่หมดอายุอัตโนมัติ (2) ปรับปรุง Cookie Secure flag ให้ตรวจ `req.secure` จริง (3) เพิ่ม Rate Limit ให้กับ `GET /quotes`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด

GOAL:
  แก้ 3 จุดเสี่ยงความปลอดภัย API ใน artifacts/api-server ตามรายงานของชัย (PR #6):
  1. `src/lib/rate-limit.ts`: เพิ่มกลไก Auto-sweep / TTL pruning สำหรับ entry ที่หมดอายุ ป้องกัน RAM โตไม่จำกัด
  2. `src/middlewares/admin-auth.ts`: ปรับ `adminCookieOptions(req?: Request)` ให้รองรับ `req?.secure`
  3. `src/routes/leads.ts`: เพิ่ม rate limiter ให้ endpoint `GET /quotes` ป้องกันการสแกนค้นหาใบเสนอราคา

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/artifacts/api-server/src/lib/rate-limit.ts
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/middlewares/admin-auth.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  4. /opt/data/cache/kbsrc/artifacts/api-server/test/rate-limit.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามติดตั้งแพ็กเกจภายนอกเพิ่ม (ไม่ลง redis หรือไลบรารีใหม่) — ใช้ pure TypeScript และ stdlib
  - ห้ามแตะ artifacts/knight-basins/** (Frontend ทั้งหมด)
  - ห้ามเปลี่ยน signature หรือทำลาย backward-compatibility ของฟังก์ชันเดิม
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-api-security-hardening แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/api-server && npm test
     baseline อ้างอิง (วัดเองบน main 24 ก.ย. 69): tests 251 / pass 247 / fail 4
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) เทสต์ใหม่ใน rate-limit.test.ts ยืนยันว่า entry ที่หมดอายุแล้วถูก sweep/ล้างออกจาก Map จริง
  5) เทสต์ใหม่ใน leads หรือ rate-limit ยืนยันว่า GET /quotes ถูกจำกัดอัตราเมื่อเรียกเกินโควต้า

OUTPUT:
  - branch: feat/chai-api-security-hardening
  - 4 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน 4 ตัวเดิมใน baseline
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน src/lib/rate-limit.ts:
     - เมื่อมีการเรียกใช้ rate limit ให้ทำการ prune entries ที่ `entry.resetAt < now`
     - หากจำนวน keys ใน Map เกิน 1,000 entries ให้กวาดล้าง expired keys ทั้งหมดทันที
     - เพิ่มฟังก์ชัน `export function clearRateLimitStore(): void` สำหรับใช้ในชุดเทสต์
  2. ใน src/middlewares/admin-auth.ts:
     - ปรับ `adminCookieOptions(req?: Request)`:
       `secure: Boolean(req?.secure || process.env["NODE_ENV"] === "production" || process.env["COOKIE_SECURE"] === "true")`
  3. ใน src/routes/leads.ts:
     - ที่ `router.get("/quotes", ...)`:
       เพิ่ม middleware `createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: "rl:quotes:get" })`
       (จำกัด 60 ครั้ง ต่อ 10 นาที ต่อ IP)
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปรับปรุงความปลอดภัย API 3 จุด |
| 2 | GOAL วัดได้ | ✅ Auto-sweep rate limit + Secure cookie + Rate limit GET /quotes |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 4 ไฟล์ absolute |
| 4 | FORBIDDEN ชัด | ✅ ห้ามลงแพ็กเกจเพิ่ม, ห้ามแตะ frontend, ห้าม push main |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm test 251/247/4 + typecheck + เทสต์ใหม่ |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-api-security-hardening |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 251 / pass 247 / fail 4 |
| 9 | CONTRACT ระบุพฤติกรรมจริง | ✅ Prune Map + Secure cookie + 60req/10min |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
