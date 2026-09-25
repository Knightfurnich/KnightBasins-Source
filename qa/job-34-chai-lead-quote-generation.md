# ใบงาน 34 (ชัย) — สร้าง quoteNumber และ quoteAccessSecret อัตโนมัติเมื่อบันทึก studioData ให้ Lead

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เมื่อลูกค้าส่งแบบร่างเข้ามา (orderMode === "sketch") Lead จะยังไม่มีเลขใบเสนอราคา (`quoteNumber` เป็น null) เมื่อทีมขายเปิด 2D Studio ขึ้นมาวาดผังและกดบันทึก (`studioData`) ระบบต้องสร้าง `quoteNumber` และ `quoteAccessSecret` ให้อัตโนมัติ เพื่อให้ทีมขายและลูกค้าสามารถเปิดดูและแชร์ใบเสนอราคาทางการได้ทันที

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด

GOAL:
  ขยาย `PATCH /api/admin/leads/:id` ใน artifacts/api-server:
  หาก Lead เดิมยังไม่มี `quoteNumber` (เป็น null หรือค่าว่าง) และมีการส่ง `studioData` เข้ามา:
  1. สร้าง `quoteNumber` ใหม่ด้วยฟังก์ชัน `createQuoteNumber()`
  2. สร้าง `quoteAccessSecret` ใหม่ด้วยฟังก์ชัน `createQuoteAccessSecret()`
  3. บันทึกลงฐานข้อมูลพร้อมกับ `studioData`
  4. Response คืนค่า lead ที่มี `quoteNumber`, `quoteAccessSecret` และ `publicQuoteToken` ให้หน้าบ้านนำไปแสดงผล

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  2. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-lead-studio-update.test.ts

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/** (Frontend ทั้งหมดเป็นของ Replit)
  - ห้ามสร้าง quoteNumber ซ้ำ หาก Lead นั้นมี quoteNumber อยู่แล้ว
  - ห้ามเปลี่ยน format ของ quoteNumber หรือ quoteAccessSecret
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-lead-quote-generation แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/api-server && npm test
     baseline อ้างอิง (วัดเองบน main 24 ก.ย. 69): tests 254 / pass 250 / fail 4
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) เทสต์ใหม่: PATCH /api/admin/leads/:id ส่ง studioData ให้ lead ที่ไม่มี quoteNumber -> ตรวจสอบว่า lead ได้รับ quoteNumber (รูปแบบ 'Mmm YY / US / NNNN') และ quoteAccessSecret จริง
  5) เทสต์ใหม่: PATCH /api/admin/leads/:id ให้ lead ที่มี quoteNumber อยู่แล้ว -> ตรวจสอบว่า quoteNumber เดิมไม่ถูกเปลี่ยน

OUTPUT:
  - branch: feat/chai-lead-quote-generation
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน 4 ตัวเดิมใน baseline
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน src/routes/admin-router.ts:
     - นำเข้า `createQuoteNumber` จาก `./leads.ts`
     - นำเข้า `createQuoteAccessSecret`, `createPublicQuoteToken` จาก `../lib/quote-access.ts`
     - ใน handler `PATCH /leads/:id`:
       ดึง `quoteNumber` และ `quoteAccessSecret` ของ lead เดิมจาก DB ด้วย
       ถ้า `!existing.quoteNumber && parsed.data.studioData !== undefined`:
         const newQuoteNumber = createQuoteNumber();
         const newSecret = createQuoteAccessSecret();
         อัปเดต set: { quoteNumber: newQuoteNumber, quoteAccessSecret: newSecret, ... }
       ใน response ส่งกลับ:
         หากมี quoteNumber และ quoteAccessSecret ให้แนบ `publicQuoteToken: createPublicQuoteToken(lead.quoteNumber, lead.quoteAccessSecret)` ไปใน response ด้วย
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ สร้าง quoteNumber ให้ lead อัตโนมัติเมื่อวาด studio |
| 2 | GOAL วัดได้ | ✅ มี quoteNumber + quoteAccessSecret ใน DB |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ frontend, ห้ามเปลี่ยน quoteNumber เดิม |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm test 254/250/4 + typecheck + 2 unit tests |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-lead-quote-generation |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 254 / pass 250 / fail 4 |
| 9 | CONTRACT ระบุพฤติกรรมจริง | ✅ ใช้ createQuoteNumber + createQuoteAccessSecret |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
