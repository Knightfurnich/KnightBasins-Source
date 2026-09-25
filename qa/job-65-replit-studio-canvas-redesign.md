# ใบงาน 65 (Replit) — ยกเครื่อง 2D Studio: กระดานกว้างเต็มจอ (Full-Width Canvas) + ถาดเครื่องมือลอย + แถบจัดการขอบ

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่งมอบให้ Replit (ปรับปรุงสเปกวิศวกรรมจากข้อเสนอแนะของชัยแล้ว)

**ความต้องการ:** 
เจ้าของระบบ (คุณนพ) ต้องการให้หน้า 2D Studio (`/studio`) มีพื้นที่กระดานวาดผัง (Canvas) กว้างขวางเต็มตา สไตล์โปรแกรมออกแบบสากล (Figma/Canva):
1. **ย้ายส่วน "เลือกสีหิน" และ "เลือกอ่าง"** ออกจากด้านข้าง/ด้านบนของกระดาน โดยทำเป็นปุ่มถาดลอย (Popover Drawers) บนแถบเครื่องมือด้านบน เมื่อคลิกจะเปิดถาดเลือกสี 74 สี หรือเลือกอ่าง 30 รุ่น เมื่อเลือกเสร็จถาดจะพับเก็บลงไป ทำให้กระดานมีพื้นที่เต็มจอ 100%
2. **แถบจัดการขอบ (Edge Finish Palette) เหนือกระดาน:**
   มี 5 ก้อนแม่เหล็ก:
   `[ 🟧 ติดบัว ▲ ]` · `[ 🟦 ชิดผนัง ║ ]` · `[ 🟪 ชิดผนัง+ติดบัว ║▲ ]` · `[ 🟩 ขอบเปิด ⊗ ]` · `[ ⚪ เอาออก (ล้างขอบ) ]`
   ใช้ Drag dataTransfer type: `application/x-studio-edge-status` (payload คือค่า SideStatus เช่น "upstand", "wall-flush", "wall-flush+upstand", "open-edge", "normal")
3. **ป้ายขอบบนกระดาน (Interactive Edge Badges):**
   ใน `StudioFootprint.tsx` เปลี่ยนป้ายขอบจากข้อความธรรมดา (`<span>`) ให้เป็นปุ่มคลิกได้ มีปุ่มกากบาทเล็ก ๆ `✕` ให้คลิกเดียวล้างสถานะขอบกลับเป็น "normal" ได้ทันที
   *ข้อสำคัญ:* วาดขอบและรับ drop เฉพาะด้านที่เปิดสู่อากาศ (`edge.exposedLengthMm > 0`) เท่านั้น ด้านที่เป็นรอยต่อระหว่างแผ่น (Joints) ห้ามเปิดให้ตั้งค่า โดยสามารถเรียกใช้ `touchingRectangleKeys(piece, rectangleId, side)` ในการตรวจสอบขอบที่ต่อชนกัน
   *หมายเหตุพิกัด:* ทิศทาง `top / right / bottom / left` ในระบบถูกคำนวณเป็น Screen-space (พิกัดตามสายตาบนหน้าจอ) เรียบร้อยแล้ว ไม่ต้องเขียนโค้ดหมุนแกนพิกัดตาม rotation ซ้ำซ้อน
4. **แก้ปัญหาขอบถูกรีเซ็ตอัตโนมัติ:**
   ใน `StudioPage.tsx` ฟังก์ชัน `applySimpleShapeEdgeDefaults` และ `useEffect` (บรรทัด ~2438): เมื่อผู้ใช้มีการแก้ไขขอบเองแล้ว ห้ามเขียนทับขอบของผู้ใช้กลับเป็นค่าเริ่มต้น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ปรับโครงสร้าง Layout หน้า Studio:
       * ขยายคอลัมน์กระดานผัง (Canvas) ให้เป็น Full-Width (กว้างเต็มจอ ไม่มีคอลัมน์ Shortlists มาบีบพื้นที่)
       * บนแถบเครื่องมือด้านบน เพิ่ม 2 ปุ่มถาด Popover:
         1) [ 🎨 สีหิน: {ชื่อสี} ({รหัส}) · {ราคา} บ./ตร.ม. ▾ ]
            เมื่อคลิก: เปิด Popover Dialog แสดงตัวกรองราคา (฿7,500/฿8,500/฿9,500) และรายการสี 74 สี เมื่อเลือกสีแล้ว Popover ปิดลงอัตโนมัติ
         2) [ 🛁 อ่างล้างหน้า: {รหัสอ่าง} ▾ ] หรือ [ ➕ เพิ่มอ่าง ]
            เมื่อคลิก: เปิด Popover Dialog แสดงอ่าง 30 รุ่น พร้อมรูป Top View จริง และปุ่ม "วางบนผัง"
       * เหนือกระดานผัง เพิ่มแถบระบุขอบ (Edge Finish Toolbar):
         [ 🟧 ติดบัว ▲ ] · [ 🟦 ชิดผนัง ║ ] · [ 🟪 ชิดผนัง+ติดบัว ║▲ ] · [ 🟩 ขอบเปิด ⊗ ] · [ ⚪ เอาออก (ล้างขอบ) ]
         รองรับ draggable โดยใส่ onDragStart: event.dataTransfer.setData("application/x-studio-edge-status", status)
       * ย้ายแถบสรุปราคา (Estimate Dock) ไว้ด้านล่างกระดานในแนวนอนอย่างกระชับ
       * แก้ไข useEffect และ applySimpleShapeEdgeDefaults ให้ไม่เขียนทับขอบที่ผู้ใช้ปรับแต่งเอง
  2. ใน artifacts/knight-basins/src/components/StudioFootprint.tsx:
     - ปรับปรุงการแสดงผลป้ายขอบ (`studio-edge-marker`):
       * เปลี่ยนให้เป็นปุ่มกดอินเทอร์แอคทีฟ (Interactive Button) มีปุ่มเล็ก ๆ [✕] เพื่อให้คลิกเดียวล้างสถานะขอบกลับเป็นปกติ
       * เฉพาะด้านที่ `edge.exposedLengthMm > 0` เท่านั้นที่แสดงป้ายขอบและรับ drop ได้ (ห้ามรับบนรอยต่อ ให้เรียกใช้ helper `touchingRectangleKeys(piece, rectangleId, side)` ในการตรวจสอบขอบที่ชนกัน)
       * ทิศทาง `top / right / bottom / left` เป็นพิกัดหน้าจอ (screen-space) เรียบร้อยแล้ว ไม่ต้องเขียนสูตรหมุนพิกัดตาม rotation ซ้ำ
       * รองรับ Drag & Drop: เพิ่ม onDragOver และ onDrop รับ `application/x-studio-edge-status` เพื่อเปลี่ยนสถานะขอบด้านนั้นทันที
  3. เขียน Unit Tests ใน artifacts/knight-basins/test/studio-canvas-redesign.test.ts (ใหม่):
     - ทดสอบการเปิด/ปิด Popover เลือกสีหินและเลือกอ่าง
     - ทดสอบการกดปุ่มลบป้ายขอบ [✕] บนแคนวาส
     - ทดสอบว่าด้านที่เป็นรอยต่อระหว่างแผ่นไม่แสดงป้ายขอบ

SCOPE (path สัมพัทธ์จาก root repo สำหรับ Replit):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/components/StudioFootprint.tsx
  3. artifacts/knight-basins/src/index.css
  4. artifacts/knight-basins/test/studio-canvas-redesign.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ lib/db/schema หรือ deploy/migrations
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-canvas-redesign แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 307 / pass 301 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน studio-canvas-redesign.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-studio-canvas-redesign (เปิด PR เข้า main)
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
| 11 | ทดสอบการเปิดปิด Popover และการลบป้ายขอบ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
