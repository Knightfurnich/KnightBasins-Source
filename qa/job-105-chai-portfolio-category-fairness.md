# ใบงาน 105 (ชัย) — แก้บั๊กการแบ่งหน้าและความเป็นธรรมของหมวดหมู่ใน Portfolio API (Portfolio Pagination & Category Fairness Fix)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Portfolio API) — **งานด่วน แก้บั๊กที่คุณนพเจอ**

**ที่มาและความสาเหตุ (หลักฐานจากการทดสอบจริงบน Production):**
คุณนพแจ้งว่า *"ดูทั้งหมด เหมือนว่าไม่มีภาพในหมวดของ งานดีไซน์คัสตอม"* — เดวิดทดสอบยิง API จริงบนเซิร์ฟเวอร์แล้วพบสาเหตุแน่ชัด:

```
GET /api/portfolio?includeHidden=true&limit=200  → ได้ 200 รายการ เป็น bathroom ทั้ง 200 รายการ
GET /api/portfolio?includeHidden=true&limit=600  → ได้ 600 รายการ เริ่มมีหมวดอื่นปนมา (เรียงตาม CATEGORY_ORDER)
GET /api/portfolio (สาธารณะ, limit default 60)   → ได้ 60 รายการ เป็น bathroom ทั้ง 60 รายการ
```

**สาเหตุที่แท้จริง:** `GET /portfolio` เรียงรายการตาม `CATEGORY_ORDER` **ก่อน** แล้วค่อยตัดด้วย `limit/offset`
หมวด `bathroom` มี 312 รายการ (และ 69 รายการบนหน้าสาธารณะ) จึงกินโควตาทั้งหน้าจนหมด
ทำให้ **หมวดอื่นทั้งหมด (ดีไซน์คัสตอม 47 · เคาน์เตอร์ 59 · ครัว 33 · ผนัง 34 ฯลฯ) ไม่เคยขึ้นเลย** ทั้งในหน้าแอดมินและ**หน้าร้านสาธารณะของลูกค้า**

นอกจากนี้ยังพบ `Math.min(limitRaw, 600)` ตัดเพดานไว้ที่ 600 ซึ่งน้อยกว่าขนาดจริงของคลัง (647 รายการ) → ไม่มีทางดึงครบได้เลย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-category-fairness แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/portfolio.ts (GET /portfolio):
     - เมื่อ "ไม่ระบุ category": ให้กระจายรายการแบบเป็นธรรมตามหมวดหมู่ (round-robin ตาม CATEGORY_ORDER)
       แทนการเรียงพ่วงกันแล้วตัด limit ทิ้ง — เพื่อให้ทุกหมวดมีโอกาสขึ้นเท่ากันในหน้าจอ "ทั้งหมด"
     - ยกเพดาน limit: รองรับ limit=all หรือสูงสุด 2000 เพื่อให้หน้าแอดมินดึงได้ครบทั้ง 647 รายการ
     - เรียงลำดับให้เสถียรและทำซ้ำได้ (tiebreak ด้วย id) เพื่อไม่ให้ผลลัพธ์สลับไปมาในแต่ละครั้ง
     - ตอบฟิลด์เพิ่ม: hasMore (boolean) และ nextOffset (number|null) เพื่อให้หน้าบ้านทำ "โหลดเพิ่ม" ได้
     - คงความหมายฟิลด์เดิมให้ชัดเจน: total = จำนวนรายการที่มองเห็นทั้งหมดหลังกรอง · count = จำนวนหลังค้นหา/กรองหมวด (ก่อนตัด limit)
  2. เมื่อ "ระบุ category": ยังคงกรองตามหมวดเดิมเหมือนเดิม ไม่ต้องเปลี่ยนพฤติกรรม
  3. เพิ่มหรือปรับ artifacts/api-server/test/portfolio-category-fairness.test.ts (ไฟล์ใหม่):
     - เคสสำคัญ: สร้าง catalog จำลองที่มี bathroom จำนวนมาก + design/kitchen อย่างละไม่กี่รายการ
       แล้วยิง GET /portfolio?limit=<ค่าน้อย> ต้อง "มีรายการของ design และ kitchen ขึ้นมาด้วย" (นี่คือ regression test ของบั๊กนี้)
     - เคส limit=all/2000: ต้องได้ครบทุกหมวดตามจำนวนจริงใน catalog จำลอง
     - เคสระบุ category ยังกรองถูกต้อง (กติกาเดิมไม่พัง)
     - เคส hasMore/nextOffset สอดคล้องกับจำนวนที่ดึงได้จริง
     - ห้ามทำเทสต์เดิมของ portfolio ล้มเหลว (ดูไฟล์ test/portfolio*.test.ts ที่มีอยู่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/portfolio-category-fairness.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (งานหน้าบ้านเป็นของ Replit)
  - ห้ามลบ/แก้แคตตาล็อกหรือไฟล์รูปจริงบนเซิร์ฟเวอร์
  - ห้ามเปลี่ยนกติกาการซ่อน/แสดงรูป (visibility map) หรือ allowlist ของหน้าสาธารณะ
  - ห้ามแตะต้องไฟล์นอกรายการ SCOPE

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-portfolio-category-fairness
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/portfolio-category-fairness.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (536 tests / 531 pass / 5 fail เดิม)
  5) แนบผลยิง API จริง: GET /api/portfolio?limit=60 ต้องเห็นหลายหมวดใน 60 รายการแรก (ไม่ใช่ bathroom ล้วน)

OUTPUT:
  - branch: feat/chai-portfolio-category-fairness (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์เดิมของ api-server ล้มเหลวเกิน 5 ข้อเดิม
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าการกรองตาม category ที่ระบุชัดเจนเปลี่ยนพฤติกรรมไปจากเดิม
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
| 10 | แนบหลักฐานบั๊กจริงจาก Production | ✅ ผ่าน |
| 11 | มี regression test สำหรับบั๊กหมวดหมู่ถูกกลืน | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
