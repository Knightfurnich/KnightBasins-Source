# ใบงาน 69 (Replit) — เชื่อมต่อระบบรักษาสถานะขอบใน StudioPage และเพิ่มปุ่มดูงานติดตั้งจริงบนการ์ดอ่าง

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ Replit

**ความต้องการ:** 
1. **เชื่อมต่อ helper functions จาก Task 66 เข้ากับ `StudioPage.tsx`:**
   - ใน `changeStatus` ให้เรียกใช้ `setStudioEdgeStatus` (เมื่อ status !== "normal") และ `clearStudioEdgeStatus` (เมื่อ status === "normal") จาก `src/data/studio-model.ts` เพื่อให้ระบบบันทึก `hasCustomEdges: true` และกันรอยต่อระหว่างแผ่นอัตโนมัติ
   - ใน `applySimpleShapeEdgeDefaults` ให้เรียกใช้ `preserveCustomEdgesOnShapeChange(previousPiece, nextPiece)` เพื่อให้เมื่อผู้ใช้สลับทรงเคาน์เตอร์ (I ↔ L ↔ U) สถานะขอบเดิมที่ผู้ใช้ตั้งไว้จะไม่ถูกลบทับกลับเป็นค่าเริ่มต้น
2. **เพิ่มปุ่มดูภาพผลงานติดตั้งจริงบนการ์ดอ่าง (`ProductCard` ใน `App.tsx`):**
   - บนการ์ดอ่างทั้ง 30 รุ่น ให้เพิ่มปุ่มลิงก์ `[ 📸 ดูภาพงานจริง ]` ชี้ไปยัง `/portfolio?category=bathroom` พร้อม `data-testid={`link-portfolio-basin-${sku}`}` เพื่อให้ลูกค้าที่ดูแคตตาล็อกหน้าแรกสามารถคลิกเข้าไปดูภาพงานติดตั้งจริงในห้องน้ำได้ทันที
   - จัดวางตำแหน่งใน `product-card-actions` หรือใต้สเปกอ่างให้สวยงาม ไม่ซ้อนทับกับปุ่ม "ซื้อเฉพาะอ่าง" หรือ "สั่งผลิตพร้อมท็อปเคาน์เตอร์"
3. **ตกแต่ง CSS ใน `index.css`:**
   - ปรับแต่งคลาสปุ่ม `product-portfolio-link` ให้ดูทันสมัย ตัวหนังสือชัดเจน และรองรับทั้งเดสก์ท็อปและมือถือ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - นำเข้า setStudioEdgeStatus, clearStudioEdgeStatus, preserveCustomEdgesOnShapeChange จาก src/data/studio-model
     - แก้ไขฟังก์ชัน changeStatus ให้เรียกใช้ setStudioEdgeStatus หรือ clearStudioEdgeStatus แทนการ mutate sideStatuses ตรง ๆ
     - แก้ไขฟังก์ชัน applySimpleShapeEdgeDefaults ให้เรียก preserveCustomEdgesOnShapeChange(previousPiece, nextPiece) เพื่อรักษาสถานะขอบเดิมของผู้ใช้ไว้
  2. ใน artifacts/knight-basins/src/App.tsx:
     - ในคอมโพเนนต์ ProductCard เพิ่มลิงก์ <Link href="/portfolio?category=bathroom" className="product-card-action product-card-action--portfolio" data-testid={`link-portfolio-basin-${sku}`}>📸 ดูภาพงานจริง</Link>
  3. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์สำหรับ .product-card-action--portfolio ให้คมชัด สวยงาม คล้ายปุ่มแอ็กชันอื่น ๆ
  4. สร้างไฟล์ artifacts/knight-basins/test/studio-edge-wiring.test.ts:
     - เขียน Node-native unit tests ตรวจสอบการทำงานของ changeStatus และการคงอยู่ของขอบเมื่อสลับทรง

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/studio-edge-wiring.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง lib/db/schema หรือ backend API
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-edge-wiring-and-basin-portfolio แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 333 / pass 327 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-edge-wiring.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-studio-edge-wiring-and-basin-portfolio (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการคงอยู่ของขอบและการคลิกลิงก์ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
