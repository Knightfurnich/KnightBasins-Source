# ใบงาน 97 (ชัย) — เพิ่มระบบเชื่อมต่อตรวจสอบความปลอดภัยงานช่างใน Lead API (Integrate Fabrication Geometry Guard into Leads API)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / API & Safety Integration) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 95 ชัยได้สร้างโมดูล `fabrication-geometry.ts` (ตรวจระยะขอบเจาะ $\ge 100$ มม. และตรวจจุดชนรอยต่อแผ่น) สำเร็จครบถ้วนแล้ว
เพื่อให้ระบบหลังบ้านนำโมดูลนี้มาคุ้มกันข้อมูลจริง ชัยจะรับหน้าที่ **เชื่อมต่อ (Integrate) โมดูลนี้เข้าสู่ `POST /api/leads` และ `PATCH /admin/leads/:id`**:

1. **พฤติกรรมที่ต้องคุ้มกันใน API Server:**
   * เมื่อมี request ส่ง `studioData` เข้ามาใน `POST /api/leads` หรืออัปเดตผ่าน `PATCH /admin/leads/:id`
   * หาก `studioData` มีการระบุตำแหน่งอ่างและมิติเคาน์เตอร์:
     - ให้เรียกใช้ `validateBasinClearance()` ตรวจสอบว่าระยะเนื้อหินรอบอ่างมีด้านใดน้อยกว่า 100 มม. หรือไม่
     - หากเคาน์เตอร์เป็นทรง L หรือ U และมีรอยต่อแผ่นหิน ให้เรียก `checkCutoutJointClash()` ตรวจว่าหลุมเจาะทับรอยต่อหรือไม่
   * **การตอบสนอง:**
     - หากตรวจพบว่าเป็นการส่งแบบร่างที่มี Clash ร้ายแรง ให้บันทึก Flag ในฐานข้อมูล/สตูดิโอ หรือคืนคำเตือน `fabricationWarnings` ใน response เพื่อให้ทีมขายและช่างเห็นทันทีในหน้า Admin
     - ป้องกันไม่ให้ผังที่มีความเสี่ยงหินแตกผ่านเข้าสู่สถานะยืนยันการผลิตโดยไม่ผ่านสายตาแอดมิน
2. **สิ่งที่ต้องปรับปรุงใน `artifacts/api-server/src/routes/leads.ts` และ `artifacts/api-server/src/routes/admin-router.ts`:**
   * Import `validateBasinClearance` และ `checkCutoutJointClash` จาก `../lib/fabrication-geometry`
   * สร้าง helper `auditStudioFabrication(studioData: unknown): { safe: boolean; warnings: string[] }`
   * เพิ่มการตรวจสอบความปลอดภัยของงานช่างและแนบผลสรุปคำเตือนเข้ากับข้อมูล Lead
3. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/leads-fabrication-audit.test.ts` (ใหม่):**
   * ทดสอบส่ง Lead ที่มีระยะขอบอ่าง 150 มม. ➔ ปลอดภัย `safe: true`, ไม่มี warnings
   * ทดสอบส่ง Lead ที่มีระยะขอบอ่าง 50 มม. ➔ ตรวจพบคำเตือนระยะปลอดภัยต่ำกว่า 100 มม.
   * ทดสอบส่ง Lead ที่อ่างวางทับแนว Joint Line ของทรง L ➔ ตรวจพบคำเตือนวางทับรอยต่อ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-leads-fabrication-audit แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/leads.ts:
     - นำ validateBasinClearance และ checkCutoutJointClash มาตรวจสอบ studioData
     - สร้าง helper auditStudioFabrication() เพื่อตรวจจับความเสี่ยงหินแตกก่อนบันทึก
  2. ใน artifacts/api-server/src/routes/admin-router.ts (ถ้ามีจุด PATCH/อัปเดต studioData):
     - เชื่อมต่อการตรวจสอบความปลอดภัยงานช่างในจุดบันทึกผังของแอดมิน
  3. สร้าง artifacts/api-server/test/leads-fabrication-audit.test.ts (ใหม่):
     - ทดสอบส่ง Lead ด้วยผังปกติ -> safe: true
     - ทดสอบส่ง Lead ด้วยผังที่ระยะเจาะ < 100mm -> แจ้งเตือนระยะต่ำกว่ามาตรฐาน 100 มม.
     - ทดสอบส่ง Lead ด้วยผังที่เจาะทับรอยต่อทรง L/U -> แจ้งเตือนหลุมเจาะชนแนวรอยต่อ

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/leads-fabrication-audit.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามลดระยะขอบเจาะปลอดภัยต่ำกว่า 100 มม. เด็ดขาด (กฎเหล็ก Knight Furnich)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-leads-fabrication-audit
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/leads-fabrication-audit.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (450 tests / 445 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-leads-fabrication-audit (เปิด PR เข้า main)
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
| 10 | ยึดระยะขอบปลอดภัยขั้นต่ำ 100 มม. ตามกฎบริษัท | ✅ ผ่าน |
| 11 | เชื่อมต่อ Fabrication Safety เข้ากับ Leads API | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
