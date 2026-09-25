# ใบงาน 30 (ชัย) — ขยาย PATCH /api/admin/leads/:id ให้บันทึก studioData ครบชุด

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ทีมขายต้องสามารถเปิด Studio ขึ้นมาวาดแบบเคาน์เตอร์ตามภาพร่างของลูกค้า แล้วบันทึกผัง Studio (`studioData` ทั้งก้อน) กลับเข้า Lead เดิมของลูกค้าได้ เพื่อให้ออกใบเสนอราคาและผังส่งช่างได้ทันที

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด

GOAL:
  ขยาย `PATCH /api/admin/leads/:id` และ schema `AdminLeadUpdateInput` ให้รองรับฟิลด์ `studioData` (JSON object)
  เพื่อบันทึกและ merge ผัง 2D Studio ที่ทีมขายวาดเข้ากับ lead เดิมได้ โดยไม่ลบข้อมูลภาพสเก็ตช์เดิม (`sketchUrls`)

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-route.test.ts

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/** (Frontend ทั้งหมดเป็นของ Replit)
  - ห้ามแตะไฟล์ CSS, index.css, @media print หรือ .formal-*
  - ห้ามลบฟิลด์เดิมใน studioData (เช่น sketchUrls, staffDimensions) — ต้อง merge กับของเดิม
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-lead-studio-update แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ):
  1) git branch --show-current (ต้องไม่ใช่ main) + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen -> build สำเร็จ
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     เกณฑ์ผ่าน: ต้องไม่มี fail นอก 4 ตัวเดิมใน baseline
     baseline อ้างอิง (วัดเองบน main 24 ก.ย. 69): tests 250 / pass 246 / fail 4
  5) เทสต์ใหม่: PATCH /api/admin/leads/:id ส่ง studioData แล้วบันทึกเข้า DB และคืนค่ากลับมาถูกต้อง
  6) ยืนยันว่าไม่ลบของเดิม: เทสต์กรณี lead มี sketchUrls อยู่ก่อน เมื่อ PATCH studioData ใหม่แล้ว sketchUrls เดิมยังอยู่ครบ

OUTPUT:
  - branch: feat/chai-lead-studio-update
  - ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 6 ข้อ

STOP (หยุดทันทีแล้วรายงาน):
  - ถ้าเทสต์ตกเกิน 4 ตัวเดิมใน baseline
  - ถ้าต้องแก้ไฟล์นอก SCOPE
  - ถ้า pnpm run typecheck มี error

CONTRACT:
  1. ใน lib/api-spec/openapi.yaml ที่ schema `AdminLeadUpdateInput`:
     เพิ่ม property:
       studioData:
         type: object
         description: "Full studio design state (pieces, dimensions, shape, sink placement, estimate, etc.)"
         additionalProperties: true
  2. รัน codegen: `pnpm --filter @workspace/api-spec run codegen`
  3. ใน artifacts/api-server/src/routes/admin-router.ts ที่ handler `PATCH /leads/:id`:
     รองรับ `parsed.data.studioData`:
     - ดึง `existing.studioData` จาก DB
     - ทำ shallow merge:
       `studioData = { ...(existing?.studioData as Record<string, unknown> ?? {}), ...(parsed.data.studioData as Record<string, unknown> ?? {}) }`
     - ถ้ามี `parsed.data.staffDimensions` ก็นำมารวมด้วย
     - อัปเดตลงฟิลด์ `customerLeads.studioData`
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ขยาย PATCH lead รองรับ studioData |
| 2 | GOAL วัดได้ | ✅ PATCH รับ studioData และ merge ลง DB |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ absolute |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ frontend, ห้ามลบ sketchUrls เดิม |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 250/246/4 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-lead-studio-update |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 250 / pass 246 / fail 4 |
| 9 | CONTRACT ระบุบรรทัดจริง | ✅ ระบุ schema + shallow merge |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
