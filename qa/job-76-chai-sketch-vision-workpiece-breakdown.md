# ใบงาน 76 (ชัย) — ขยาย AI Blueprint Vision ถอดโครงสร้างชิ้นงาน แผ่นหิน ขอบ 4 แบบ และงานเจาะ

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (API & Data Model)

**ที่มาและความต้องการ:**
จากการทดสอบภาพสเก็ตช์จริงของลูกค้า พบว่าโมเดล Gemini Vision สามารถอ่านรายละเอียดได้ลึกมาก (แยกชิ้นงานบน/ล่าง, อ่านขอบบัว, ระยะหลุมเจาะ) แต่เดิมโครงสร้าง JSON รับได้แค่ชิ้นเดียวแบบผิวเผิน (`runAMm`, `depthMm`)
ดังนั้น ใบงานนี้จะขยายขีดความสามารถของ AI ในการถอดแบบหน้างาน ให้เป็น "การ์ดแจกแจงงานช่าง" ระดับมืออาชีพ:
1. **ระบุจำนวนชิ้นงานในภาพ:** แยกรายชิ้นงานได้ (`workpieces: [...]`) เช่น ใน 1 ภาพมีชิ้นล่าง (ทรง L) + ชิ้นบน (ทรงตรง)
2. **แจกแจงแผ่นหินแยกตามทรง (Stone Panels):**
   - แต่ละชิ้นงานระบุรูปทรง `I` | `L-left` | `L-right` | `U` | `unknown`
   - แจกแจงแผ่นหินที่ต้องตัด: `panels: [{ panelIndex, lengthMm, depthMm }]`
3. **ถอดสถานะขอบ 4 แบบ (Edge Symbols):**
   - ถอดสัญลักษณ์ที่ลูกค้า/สถาปนิกเขียนกำกับ:
     * `upstand` (ติดบัว ▲) — ด้านที่ชนผนังปูน มีบัวกันน้ำ
     * `wall-flush` (ชิดผนัง ║) — ด้านแนบผนัง ไม่มีบัว
     * `open-edge` (ขอบเปิด ⊗) — ด้านโชว์ลอย ขัดขอบเนียน
     * `closed-edge` (ขอบปิด ⊞) — ด้านบังหน้า/ปิดขอบโชว์เนียน (เช่น บังหน้าสูง 145 มม. หรือ ขอบ 24x30 มม.)
     * `joint` (🔗 รอยต่อชนแผ่น) — ล็อกอัตโนมัติตรงจุดเชื่อมแผ่น
4. **รายละเอียดงานเจาะ (Cutout Details):**
   - ถอดจุดเจาะอ่าง/ก๊อก/เตา: `cutouts: [{ type: "basin" | "hob" | "other", description, distanceMm }]`
   - **กฎเหล็ก Knight Furnich:** คิดราคาเต็มพื้นที่ กว้าง × ยาว เสมอ **ห้ามหักพื้นที่ช่องเจาะออก**
5. **รักษา Backward Compatibility:**
   - ฟิลด์ระดับบน (`shape`, `runAMm`, `runBMm`, `depthMm`, `basinCount`, `stoneHint`) ยังคงมีอยู่เหมือนเดิม โดยดึงค่าสรุปจากชิ้นงานแรก เพื่อไม่ให้กระทบฟอร์มเดิม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-sketch-vision-workpiece-breakdown แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/lib/sketch-vision.ts:
     - เพิ่ม Type definitions:
       * SketchWorkpiecePanel: { panelIndex: number; label: string; lengthMm: number | null; depthMm: number | null; }
       * SketchWorkpieceEdge: { side: "top" | "front" | "left" | "right"; status: "upstand" | "wall-flush" | "open-edge" | "closed-edge" | "joint" | "unknown"; note?: string; }
       * SketchWorkpieceCutout: { type: "basin" | "hob" | "other"; description: string; count: number; }
       * SketchWorkpiece: { id: string; shape: SketchVisionShape; label: string; dimensionsSummary: string; panels: SketchWorkpiecePanel[]; edges: SketchWorkpieceEdge[]; cutouts: SketchWorkpieceCutout[]; notes?: string; }
     - ขยาย SketchVisionItem ให้มี:
       * workpieceCount: number;
       * workpieces: SketchWorkpiece[];
     - ปรับปรุง SKETCH_VISION_PROMPT:
       * สั่งให้อ่านจำนวนชิ้นงานทั้งหมดในภาพ
       * แจกแจงมิติรายแผ่น (Panels) และความลึก
       * ถอดสัญลักษณ์ขอบ (บัว/ชิดผนัง/ขอบเปิด/ขอบปิดหรือบังหน้า)
       * ถอดงานเจาะหลุม (ระบุชัดเจนว่าไม่หักพื้นที่ราคาหิน)
     - ปรับปรุง parseSketchVisionResponse() ให้ parse โครงสร้างใหม่ได้อย่างปลอดภัย ไม่โยน error แม้ JSON ตอบมาไม่ครบ
  2. ใน artifacts/api-server/test/sketch-vision.test.ts:
     - เพิ่ม unit tests ทดสอบการ parse โครงสร้างชิ้นงานหลายชิ้น (multi-workpiece)
     - ทดสอบการแปลงหน่วยมิลลิเมตรของ panels
     - ทดสอบการ map สถานะขอบ 4 แบบ + รอยต่อ
     - ทดสอบ fallback เมื่อ AI ตอบ JSON เปล่าหรือไม่สมบูรณ์

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/sketch-vision.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้อง lib/db/ และ artifacts/api-server/src/routes/ ทุกไฟล์
  - ห้าม log ข้อมูล Base64, ภาพ, หรือข้อมูลลับลงใน console/log
  - ห้ามหักพื้นที่ช่องเจาะหลุมออกจากพื้นที่คำนวณราคาหินเด็ดขาด
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-sketch-vision-workpiece-breakdown

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-sketch-vision-workpiece-breakdown
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test artifacts/api-server/test/sketch-vision.test.ts -> ผ่านครบทุกข้อ 100%
  4) npm test ใน artifacts/api-server -> รายงานผลเทียบ baseline เดิม (359 tests / 354 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-sketch-vision-workpiece-breakdown (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ใน artifacts/api-server มี fail เพิ่มจาก baseline เดิม (fail > 5)
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับเรื่อง branch และ PR | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบ Multi-workpiece, Panels, ขอบ 4 แบบ และ Fallback | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์นอก Scope และไม่แตะ Production DB | ✅ ผ่าน |
