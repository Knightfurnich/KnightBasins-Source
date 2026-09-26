# ใบงาน 78 (ชัย) — สะพานเชื่อมข้อมูลจากโหมดส่งแบบร่างเข้าสู่ 2D Studio (Studio Bridge)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Data Model & Logic)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่ระบบหน้า `/sketch` มีปุ่ม `[ 🎨 นำขนาดเข้าสู่ 2D Studio ➔ ]` เพื่อพาสเปกที่ AI ถอดได้ (หรือที่ผู้ใช้แก้ไขแล้ว) ข้ามไปเปิดและวาดผังบน 2D Studio (`/studio`)
เพื่อให้การรับส่งข้อมูลผ่าน URL Query String ปลอดภัย แม่นยำ และไม่พึ่งพา State ชั่วคราว:
1. **สร้างโมดูล `artifacts/knight-basins/src/data/studio-bridge.ts` (ใหม่):**
   - ฟังก์ชันสร้าง URL: `buildStudioBridgeUrl(params: StudioBridgeParams): string`
     * รับ: `shape` ("i" | "l-left" | "l-right" | "u"), `lengthMm`, `depthMm`, `legBMm?`, `legCMm?`, `stoneColor?`, `basinSku?`, `source?`
     * สร้าง URL string สำหรับพาผู้ใช้ไป เช่น `/studio?from=sketch&shape=i&runA=1980&depth=450&stone=NB091&basin=KF025`
   - ฟังก์ชันถอดรหัส URL: `parseStudioBridgeParams(search: string | URLSearchParams): StudioBridgeParams | null`
     * ป้องกันค่าแปลกปลอม (NaN, ค่าติดลบ, ค่าว่าง, ตัวอักษรแปลกปลอม)
     * บังคับขนาดขั้นต่ำและสูงสุดที่สมเหตุสมผล (เช่น lengthMm ระหว่าง 400 ถึง 6000 มม., depthMm ระหว่าง 300 ถึง 1200 มม.)
     * คืนค่า `null` อย่างปลอดภัยถ้าไม่มี query ที่เกี่ยวข้อง หรือ query ไม่ถูกต้อง
   - ฟังก์ชันประกอบ State: `applyStudioBridgeToState(state: StudioState, params: StudioBridgeParams): StudioState`
     * นำค่ารูปทรงและมิติที่ถอดได้ เรียก `buildCustomShapePiece` (จาก Task 74) เพื่อประกอบแผ่นหินและปักหมุดขอบลงใน state.pieces ทันที
     * อัปเดต `stoneColors`, `activeStone` หากมีการระบุหิน
     * อัปเดต `basinSkus` และเพิ่ม placement อ่างตัวแรกหากมีการระบุรุ่นอ่าง
2. **เขียน Unit Tests 100% ใน `artifacts/knight-basins/test/studio-bridge.test.ts` (ใหม่):**
   - ทดสอบการสร้าง URL query ครบทุกกรณี (ทรง I, L, U)
   - ทดสอบการ parse query params ทั้งกรณีปกติ, กรณีมีหน่วย (1.98m/198cm), กรณีค่าขยะ/ค่าลบ
   - ทดสอบการนำค่าไปแปลงเป็น StudioState ว่าได้ชิ้นงานที่ถูกต้อง มีขนาดตรงเป๊ะ และมีขอบล็อกรอยต่อครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-studio-bridge แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/knight-basins/src/data/studio-bridge.ts (ใหม่):
     - Export Type StudioBridgeParams: {
         shape: "i" | "l-left" | "l-right" | "u";
         runAMm: number;
         depthMm: number;
         runBMm?: number;
         runCMm?: number;
         stoneColor?: string;
         basinSku?: string;
         source?: string;
       }
     - Export Function buildStudioBridgeUrl(params: StudioBridgeParams): string
     - Export Function parseStudioBridgeParams(search: string | URLSearchParams): StudioBridgeParams | null
     - Export Function applyStudioBridgeToState(state: StudioState, params: StudioBridgeParams): StudioState
     - ใช้ buildCustomShapePiece จาก "@/data/studio-model" ในการสร้างชิ้นงาน
  2. สร้าง artifacts/knight-basins/test/studio-bridge.test.ts (ใหม่):
     - ทดสอบ buildStudioBridgeUrl -> คืน URL สัมพัทธ์ที่ถูกต้อง
     - ทดสอบ parseStudioBridgeParams -> parse ทรง I/L/U ถูกต้อง, reject ค่าติดลบ/NaN
     - ทดสอบ applyStudioBridgeToState -> สร้าง piece ที่มีขนาดและขอบตรงตาม params

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-bridge.ts (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-bridge.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/components/StudioPage.tsx เด็ดขาด (Replit กำลังทำงาน)
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx และ App.tsx เด็ดขาด
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-studio-bridge

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-studio-bridge
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test artifacts/knight-basins/test/studio-bridge.test.ts -> ผ่านครบทุกข้อ 100%
  4) cd artifacts/knight-basins && npm test -> รายงานผลเทียบ baseline เดิม (367 tests / 361 pass / 2 fail เดิม)

OUTPUT:
  - branch: feat/chai-studio-bridge (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser มี fail เพิ่มจาก baseline เดิม (fail > 2)
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
| 7 | SCOPE ใช้ path เต็มสำหรับเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับเรื่อง branch และ PR | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการสร้าง URL, การ Parse และการประกอบ State | ✅ ผ่าน |
| 12 | ไม่แตะ StudioPage.tsx และ WorkshopProductionSheet.tsx | ✅ ผ่าน |
