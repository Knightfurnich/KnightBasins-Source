# ใบงาน 73 (Replit) — ปุ่มถ่ายรูปกล้องสด + จำกัด 3 รูป + แถบสถานะ AI + กรอกมิติอัตโนมัติ (หน้า /sketch)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components) — เริ่มได้ทันที

**ความต้องการ:** 
ยกเครื่องกล่อง "แนบภาพแบบร่าง" บนหน้า `/sketch` ให้เป็นระบบรับภาพอัจฉริยะ ตามที่เจ้าของสั่งการ:

1. **📷 ปุ่มถ่ายรูปจากกล้องสด (Camera Capture):**
   - เพิ่มปุ่ม `[ 📷 ถ่ายรูปจากกล้องทันที ]` ใช้ `<input type="file" accept="image/*" capture="environment">` เพื่อเปิดกล้องหลังบนมือถือ/แท็บเล็ต

2. **📁 ปุ่มเลือกไฟล์ (คงไว้):**
   - ปุ่ม `[ 📁 เลือกภาพจากเครื่อง ]` สำหรับเลือกไฟล์จากคลังภาพ/เอกสาร

3. **🔢 จำกัดสูงสุด 3 รูปต่อรอบการคำนวณ:**
   - เปลี่ยน `const MAX_SKETCH_FILES = 5` เป็น `const MAX_SKETCH_FILES = 3`
   - แสดงข้อความนับ เช่น "แนบแล้ว 2 / 3 รูป" และซ่อนปุ่มเพิ่มเมื่อครบ 3 รูป

4. **⏳ แถบสถานะระหว่างประมวลผล (Live Processing Status):**
   - เมื่อผู้ใช้แนบ/ถ่ายภาพ ต้องมีแถบสถานะพร้อมไอคอนหมุน แสดงข้อความตามขั้นตอน ห้ามให้หน้าจอดูค้าง:
     - `[1/3] 📤 กำลังอัปโหลดภาพเข้าสู่ระบบ…`
     - `[2/3] 🧠 AI กำลังวิเคราะห์ลายมือและรูปทรงเคาน์เตอร์…`
     - `[3/3] 📐 AI ถอดขนาดสำเร็จ กำลังคำนวณราคา…`
     - `✅ ตรวจสอบตัวเลขที่ AI อ่านได้ แล้วแก้ไขได้ทันที`
   - ต้องมี `role="status"` + `aria-live="polite"` และ `data-testid="status-sketch-analysis"`

5. **📐 การ์ดผลวิเคราะห์ต่อภาพ + กรอกมิติอัตโนมัติ:**
   - เรียก `POST /api/sketch/analyze` (จาก Task 72 ของชัย) เมื่อมีรูปใหม่
   - ค่าเริ่มต้น: ถ้า endpoint ยังไม่พร้อม ให้แสดง `shape: unknown` และให้ผู้ใช้กรอกเอง (ห้ามทำให้หน้าเว็บพัง)
   - เมื่อได้ผลลัพธ์ ให้นำ `runAMm` / `depthMm` มากรอกลงช่อง `input-sketch-length` และ `input-sketch-depth` อัตโนมัติ พร้อมอัปเดต `state.pieces[0].rectangles[0]`
   - ต้องแก้ไขตัวเลขทับได้ตลอดเวลา (controlled input)
   - แสดงรูปทรงที่ตรวจพบเป็นป้าย เช่น `[ 🟦 ทรงตรง (I) ]` / `[ 🟨 ทรงแอลซ้าย (L) ]` / `[ 🟪 ทรงตัวยู (U) ]`
   - แสดง `confidence` และ `notes` จาก AI ให้ผู้ใช้รู้ว่าควรตรวจทานตรงไหน

6. **📱 Responsive:**
   - บนมือถือ ปุ่มถ่ายรูปและปุ่มเลือกไฟล์ต้องแตะง่าย ไม่ล้นจอ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - เปลี่ยน MAX_SKETCH_FILES จาก 5 เป็น 3
     - เพิ่ม useRef ของ input กล้อง (cameraInputRef) และ input type="file" accept="image/*" capture="environment" data-testid="input-sketch-camera"
     - เพิ่มปุ่ม "📷 ถ่ายรูปจากกล้องทันที" (data-testid="button-sketch-camera") และ "📁 เลือกภาพจากเครื่อง" (data-testid="button-sketch-file")
     - เพิ่มตัวนับรูป "แนบแล้ว n / 3 รูป" (data-testid="text-sketch-file-count")
     - เพิ่มแถบสถานะประมวลผล (data-testid="status-sketch-analysis") role="status" aria-live="polite" แสดงข้อความตามขั้นตอน
     - เพิ่มฟังก์ชัน analyzeSketch(files) เรียก fetch("/api/sketch/analyze", { method: "POST", body: formData })
       * ระหว่างรอ ให้ setSketchStatus ตามขั้นตอนที่ 1-3
       * เมื่อได้ผล ให้ setState อัปเดต pieces[0].rectangles[0].widthMm / lengthMm และ dimensions.runAMm / depthMm
       * ถ้า fetch ล้มเหลวหรือได้ shape unknown ให้ตั้งสถานะ "ไม่สามารถอ่านขนาดจากภาพได้ กรุณากรอกด้วยตนเอง"
     - เพิ่มการ์ดแสดงผลวิเคราะห์ต่อภาพ (data-testid="card-sketch-analysis-{index}") แสดงรูปทรง + confidence + notes
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่มสไตล์ .studio-sketch-actions (ปุ่ม 2 ปุ่มเรียงคู่), .studio-sketch-status (แถบสถานะพร้อมอนิเมชันหมุน), .studio-sketch-analysis-card
     - รองรับ Mobile: ปุ่มเรียงเป็นคอลัมน์เดียวบนจอแคบ
  3. ใน artifacts/knight-basins/test/sketch-camera-capture.test.ts (ใหม่):
     - ทดสอบว่ามี capture="environment" ในซอร์สโค้ด
     - ทดสอบว่า MAX_SKETCH_FILES = 3
     - ทดสอบว่ามี data-testid ของปุ่มกล้อง ปุ่มไฟล์ แถบสถานะ และการ์ดผลวิเคราะห์

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/sketch-camera-capture.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง artifacts/api-server/ ทุกไฟล์ (เป็นงานของชัยใน Task 72)
  - ห้ามแตะต้อง lib/db/schema หรือ deploy/migrations
  - ห้ามเปลี่ยน data-testid เดิมของ sketch slots (slot-studio-sketch-N, img-studio-sketch-preview-N, button-remove-studio-sketch-N, input-studio-sketch, grid-studio-sketch-slots)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-sketch-camera-capture แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 349 / pass 343 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน sketch-camera-capture.test.ts ผ่าน 100%
  5) ตรวจบนเบราว์เซอร์จริงทั้งเดสก์ท็อป 1440px และมือถือ 390px แล้วแนบภาพหน้าจอ

OUTPUT:
  - branch: feat/replit-sketch-camera-capture (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้า endpoint /api/sketch/analyze ยังไม่พร้อม ให้ทำ UI ทั้งหมดโดยใช้ fallback unknown แล้วรายงานว่าส่วนเชื่อมต่อรอ Task 72
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
| 11 | ทดสอบการถ่ายรูป แถบสถานะ และการกรอกมิติอัตโนมัติ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
