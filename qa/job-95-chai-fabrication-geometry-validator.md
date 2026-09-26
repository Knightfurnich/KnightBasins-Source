# ใบงาน 95 (ชัย) — เพิ่มโมดูลตรวจสอบความถูกต้องของเรขาคณิตชิ้นงานเคาน์เตอร์และหลุมเจาะ (Fabrication Geometry & Cutout Clash Validator)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Fabrication Logic & Safety) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพ (Boss) ให้ความสำคัญสูงสุดกับความถูกต้องของงานผลิตจริงในโรงงานและการป้องกันช่างตัดหินแตกหน้างาน
เมื่อมีการส่งผังเคาน์เตอร์ (`studioData` หรือข้อมูลแบบร่าง) เข้ามาในระบบ ต้องมีตัวตรวจสอบความปลอดภัยเชิงเรขาคณิต (Fabrication Geometry Guard) ในระดับ Backend Data Model:

1. **ปัญหาหน้างานที่ต้องตรวจจับและบล็อก:**
   * **Basin Cutout Clearance Clash:** ระยะห่างระหว่างขอบหลุมเจาะอ่างกับขอบเคาน์เตอร์หินทุกด้าน ต้องมีระยะเนื้อหินปลอดภัย **ขั้นต่ำ 100 มม.** (กฎเหล็กของ Knight Furnich) หากเจาะชิดขอบเกินไปหินจะเปราะและแตกหักง่าย
   * **Basin On Joint Clash:** ตำแหน่งหลุมเจาะต้องไม่อยู่คร่อมรอยต่อระหว่างแผ่นหิน (Joint boundary) ของทรง L หรือทรง U เพราะจะทำให้จุดประกบกาวอ่อนแอ
   * **Extreme Geometry & Aspect Ratio:** ตรวจจับขนาดแผ่นหินที่ผิดธรรมชาติ เช่น ความยาว < 100 มม. หรือ > 10,000 มม. (10 เมตร), ความลึก < 100 มม. หรือ > 3,000 มม.
2. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/lib/fabrication-geometry.ts` (ใหม่):**
   * ฟังก์ชัน `validateBasinClearance(counterWidthMm: number, counterDepthMm: number, basinWidthMm: number, basinDepthMm: number, xMm: number, yMm: number): { valid: boolean; minClearanceMm: number }`
     - ยืนยันว่าระยะขอบทั้ง 4 ด้าน (ซ้าย, ขวา, หน้า, หลัง) $\ge 100$ มม.
   * ฟังก์ชัน `validatePieceFabrication(piece: { shape: string; runAMm: number; depthMm: number; runBMm?: number; runCMm?: number }): { valid: boolean; reason?: string }`
     - ตรวจสอบความถูกต้องของรูปทรง I, L, U และขนาดความยาว/ความลึก
   * ฟังก์ชัน `checkCutoutJointClash(cutoutX: number, cutoutY: number, cutoutW: number, cutoutH: number, joints: Array<{ x: number; y: number }>): boolean`
3. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/fabrication-geometry.test.ts` (ใหม่):**
   * ทดสอบระยะปลอดภัย 100 มม. (กรณีผ่าน 100 มม. เป๊ะ, ผ่าน >100 มม., และตกเมื่อระยะ < 100 มม.)
   * ทดสอบตำแหน่งเจาะคร่อมรอยต่อแผ่น
   * ทดสอบขอบเขตขนาดมิติของรูปทรง I, L, U

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-fabrication-geometry-validator แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/fabrication-geometry.ts (ใหม่):
     - ฟังก์ชัน validateBasinClearance() ตรวจระยะขอบเจาะปลอดภัยขั้นต่ำ 100 มม. ทุกด้าน
     - ฟังก์ชัน checkCutoutJointClash() ตรวจจับหลุมเจาะคร่อมรอยต่อแผ่น
     - ฟังก์ชัน validatePieceFabrication() ตรวจสอบความสมบูรณ์ของทรง I, L, U
  2. สร้าง artifacts/api-server/test/fabrication-geometry.test.ts (ใหม่):
     - ทดสอบระยะ clearance 100 มม. (Edge cases: 99mm -> fail, 100mm -> pass, 150mm -> pass)
     - ทดสอบ cutout ทับ joint line
     - ทดสอบมิติและสัดส่วนทรง I, L, U
     - ทดสอบการคำนวณพิกัดและขนาดหลุมเจาะทรงกลมและสี่เหลี่ยม

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/fabrication-geometry.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/fabrication-geometry.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามลดระยะขอบเจาะปลอดภัยต่ำกว่า 100 มม. เด็ดขาด (กฎเหล็ก Knight Furnich)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-fabrication-geometry-validator
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/fabrication-geometry.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (422 tests / 417 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-fabrication-geometry-validator (เปิด PR เข้า main)
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
| 10 | ยึดระยะขอบปลอดภัยขั้นต่ำ 100 มม. ตามกฎบริษัท | ✅ ผ่าน |
| 11 | ครอบคลุมการตรวจ Fabrication Geometry & Cutout Clash | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
