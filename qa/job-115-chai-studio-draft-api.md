# ใบงาน 115 (ชัย) — เพิ่ม API บันทึกและดึงแบบร่าง Studio/Sketch กลับมาทำต่อผ่านลิงก์ (Studio Draft Save & Resume API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Studio Draft & Persistence) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพ (Boss) อนุมัติแนวทางสร้างระบบ **Draft Resume** เพื่อให้ลูกค้าหรือทีมขายที่ออกแบบเคาน์เตอร์ในหน้า `/studio` หรือ `/sketch` สามารถบันทึกแบบร่างไว้ และได้รับลิงก์สำหรับเปิดกลับมาแก้ไขต่อได้ตลอดเวลาโดยข้อมูลไม่สูญหาย:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/routes/studio-draft.ts` (ใหม่):**
   * Endpoint `POST /api/studio/draft`:
     - รับ Payload `{ draftKey?: string, shape: string, dimensions: object, stoneColor?: string, basinSku?: string, basinPlacements?: array, edges?: object, customerInfo?: object }`
     - หากไม่มี `draftKey` ให้สร้างใหม่ด้วย `randomBytes(12).toString("hex")` (เช่น `dft_a1b2c3d4e5f6`)
     - กำหนดอายุของแบบร่าง (TTL): เก็บไว้ 30 วัน
     - บันทึกลงในไฟล์ JSON แคชบนดิสก์ (`uploads/studio_drafts/<draftKey>.json`) หรือในตาราง DB ที่ปลอดภัย
     - คืนค่า HTTP 200/201: `{ draftKey: string, resumeUrl: string, expiresAt: string }` โดย `resumeUrl` จะชี้ไปที่ `/studio?draft=<draftKey>`
   * Endpoint `GET /api/studio/draft/:draftKey`:
     - ค้นหาแบบร่างจาก `draftKey` (ตรวจ Path Traversal อย่างเคร่งครัด)
     - หากพบ: คืนค่าข้อมูลผังทั้งหมดเพื่อให้หน้าบ้านนำไป Restore ลงกระดาน Studio
     - หากไม่พบหรือหมดอายุ: คืน HTTP 404 `{ message: "แบบร่างไม่พบหรือหมดอายุแล้ว" }`
2. **การนำไปต่อสายใน `artifacts/api-server/src/routes/index.ts`:**
   * ลงทะเบียน `studioDraftRouter` เข้ากับ Express app ที่ prefix `/api`
3. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/studio-draft-api.test.ts` (ใหม่):**
   * ทดสอบ POST บันทึกแบบร่างใหม่ ➔ ได้ draftKey และ resumeUrl
   * ทดสอบ GET ดึงแบบร่างด้วย draftKey ➔ ได้ข้อมูลมิติ, ทรง, สีหิน, และตำแหน่งอ่างตรงตามที่เซฟ
   * ทดสอบป้องกัน Path Traversal ใน draftKey (เช่น `../../etc/passwd` ต้องถูก 400/404 ปฏิเสธ)
   * ทดสอบดึง draftKey ที่ไม่มีจริง ➔ คืน HTTP 404 ปลอดภัย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-studio-draft-api แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/routes/studio-draft.ts (ใหม่):
     - POST /api/studio/draft: บันทึกผังแบบร่าง คืน draftKey และ resumeUrl
     - GET /api/studio/draft/:draftKey: ดึงข้อมูลผังกลับมาเพื่อ Restore
     - ป้องกัน Path Traversal ใน draftKey อย่างเคร่งครัด
  2. ลงทะเบียนใน artifacts/api-server/src/routes/index.ts
  3. สร้าง artifacts/api-server/test/studio-draft-api.test.ts (ใหม่):
     - ทดสอบ Save & Resume roundtrip ถูกต้องครบถ้วน
     - ทดสอบ 404 เมื่อไม่พบ draftKey
     - ทดสอบ Path Traversal rejection

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/studio-draft.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/index.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/studio-draft-api.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามเปิดช่องโหว่ Path Traversal ในการอ่านไฟล์ draftKey เด็ดขาด

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-studio-draft-api
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/studio-draft-api.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (550 tests / 545 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-studio-draft-api (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์เดิมของ api-server ล้มเหลวเกิน 5 ข้อเดิม
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในระดับ Backend | ✅ ผ่าน |
| 8 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ไม่แตะต้อง Production Database จริง | ✅ ผ่าน |
| 11 | ครอบคลุมการบันทึกและดึงแบบร่าง Resume Draft | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
