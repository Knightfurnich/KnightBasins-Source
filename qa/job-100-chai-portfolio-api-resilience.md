# ใบงาน 100 (ชัย) — จัดการข้อผิดพลาดและแคชของ Portfolio API ให้ทนทาน (Portfolio API Resilience & Fallback Guard)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / API Resilience & Error Handling) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
สืบเนื่องจากที่การตรวจสอบระบบพบว่าในบางสภาพแวดล้อม (เช่น Local Test Harness หรือเมื่อไฟล์ `catalog.json` ชั่วคราวหาไม่เจอ) endpoint `GET /api/portfolio/featured` และ `GET /api/portfolio` จะพ่น HTTP 500 error ออกมา ทำให้หน้าเว็บหรือเทสต์ชุดใหญ่ของเบราว์เซอร์ล้มเหลว
ชัยจะรับหน้าที่เพิ่ม **Resilience & Fallback Layer** ให้กับ `artifacts/api-server/src/routes/portfolio.ts`:

1. **ปัญหาที่ต้องแก้ไข:**
   * ในฟังก์ชัน `loadCatalog()`: หากไฟล์ `catalog.json` หาไม่เจอ (`ENOENT`) หรือไฟล์เสียหาย (`JSON parse error`) แทนที่จะ throw error จนกลายเป็น HTTP 500
   * ให้ fallback คืนค่าแคตตาล็อกเปล่าอย่างปลอดภัย: `{ updatedAt: new Date().toISOString(), total: 0, items: [] }` พร้อม log คำเตือน
   * ใน endpoint `GET /api/portfolio/featured`: หากไม่มีไฟล์ `featured.json` และแคตตาล็อกไม่มีรายการ ให้คืนค่า `{ updatedAt: ..., items: [] }` ด้วย HTTP 200 อย่างปลอดภัย ไม่พ่น 500
2. **การป้องกัน Race Condition ในการบันทึกการมองเห็นภาพ (`saveVisibilityMap`):**
   * ใน `POST /api/admin/portfolio/visibility`: ตรวจสอบการเขียนไฟล์ `visibility.json` ให้ปลอดภัย และจัดการข้อผิดพลาดไม่ให้เซิร์ฟเวอร์สะดุด
3. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/portfolio-resilience.test.ts` (ใหม่):**
   * ทดสอบจำลองกรณีไฟล์แคตตาล็อกไม่อยู่ ➔ API คืนค่า HTTP 200 รายการว่างอย่างปลอดภัย ไม่พ่น 500
   * ทดสอบจำลองกรณีไฟล์ featured.json ไม่อยู่ ➔ API คืนค่า HTTP 200 ปลอดภัย
   * ทดสอบ Normal Catalog Payload ยังคงทำงานได้ครบถ้วน 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-api-resilience แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/portfolio.ts:
     - ปรับปรุง loadCatalog() ให้ดักจับ ENOENT และ JSON parse error โดยคืน empty catalog ปลอดภัยแทนการ throw 500
     - ปรับปรุง GET /api/portfolio/featured ให้คืน HTTP 200 เสมอแม้ไม่มีไฟล์ fixture
     - ป้องกัน server crash ในทุก route ของ portfolio
  2. สร้าง artifacts/api-server/test/portfolio-resilience.test.ts (ใหม่):
     - ทดสอบ loadCatalog fallback เมื่อไฟล์สูญหาย
     - ทดสอบ GET /api/portfolio และ GET /api/portfolio/featured คืน 200 OK เสมอ

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/portfolio-resilience.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามทำให้ฟังก์ชันการแสดงภาพผลงานจริงบน Production ผิดเพี้ยน

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-portfolio-api-resilience
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/portfolio-resilience.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (470 tests / 465 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-portfolio-api-resilience (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
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
| 11 | จัดการ Fallback และ Resilience ของ Portfolio API | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
