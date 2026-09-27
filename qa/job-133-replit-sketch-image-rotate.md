# ใบงาน 133 (Replit) — เพิ่มปุ่มหมุนภาพแบบร่าง 90° ก่อนส่งให้ AI อ่าน (Sketch Image Rotate Before AI Analysis)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Sketch & Studio UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เวลาลูกค้าหรือช่างถ่ายภาพสเก็ตช์มาทางมือถือ ภาพมักเอียง 90° (ถ่ายแนวนอนแต่แบบเป็นแนวตั้ง หรือกลับกัน) ทำให้ AI อ่านรูปทรงและตัวเลขผิดพลาด แล้วลูกค้าต้องถ่ายใหม่ทั้งที่แบบถูกต้องอยู่แล้ว
เดวิดต้องการปุ่ม **"หมุนภาพ 90°"** บนการ์ดตัวอย่างภาพแบบร่าง เพื่อให้ผู้ใช้หมุนภาพให้ตรงก่อน/หลังส่งวิเคราะห์ โดยไม่ต้องออกไปหมุนในแอปมือถือเอง

**บริบทโค้ดปัจจุบัน (`artifacts/knight-basins/src/components/StudioPage.tsx`):**
* รายการไฟล์อยู่ใน `sketchFiles` (state) และ `sketchFilesRef.current` (ref ที่ใช้ตรวจว่าภาพยังอยู่ไหม)
* พรีวิวอยู่ใน `sketchPreviewUrls`
* ฟังก์ชันวิเคราะห์คือ `analyzeSketch(files)` (เรียก `POST /api/sketch/analyze` แบบทีละไฟล์)
* การ์ดพรีวิว/ผลวิเคราะห์เรนเดอร์ที่บรรทัด ~4641-4700 (`studio-sketch-analysis-card`)
* ค่าคงที่ `MAX_SKETCH_FILES = 3` และมี `submissionInFlightRef` สำหรับล็อกปุ่มระหว่างส่งข้อมูล

**รายละเอียดงาน:**
1. **เพิ่มปุ่มหมุนภาพ 90° บนการ์ดภาพแบบร่างแต่ละใบ:**
   * ไอคอน `RotateCw` (จาก lucide-react) พร้อมข้อความสั้น **"หมุน 90°"**
   * attribute `data-testid="button-rotate-sketch-${index}"` และ `aria-label="หมุนภาพแบบร่าง 90 องศา"`
   * ปุ่มต้องมีขนาดแตะได้บนมือถือ (สูง ≥ 40px) และ **ถูก disable ระหว่าง `submissionInFlightRef.current` เป็น true หรือระหว่างกำลังวิเคราะห์** (กันกดรัวตามกฎโปรเจกต์)
2. **ตรรกะการหมุน (ต้องเป็นฟังก์ชันบริสุทธิ์ที่ทดสอบได้):**
   * สร้างฟังก์ชันช่วยเช่น `rotateSketchFile(file: File): Promise<File>` ที่:
     - วาดภาพลง `<canvas>` แล้วหมุน 90° ตามเข็มนาฬิกา (สลับความกว้าง/ความสูง)
     - จำกัดด้านยาวสุดไม่เกิน 1920px (เท่าแนวทางเดิมของระบบ)
     - คืนค่าเป็น `File` ใหม่ ชื่อไฟล์เดิม, ชนิดไฟล์ `image/jpeg` (หรือคงชนิดเดิมถ้าเป็น PNG/WEBP)
     - ใช้ `canvas.toBlob` — **ห้ามใช้ไลบรารีใหม่** (ห้ามเพิ่ม dependency)
   * หลังหมุนสำเร็จ: แทนที่ไฟล์เดิมที่ตำแหน่งเดิมใน `sketchFiles` + `sketchFilesRef.current`, อัปเดตพรีวิว (`sketchPreviewUrls`) แล้ว **เรียกวิเคราะห์ไฟล์นั้นใหม่** ผ่านกลไกคิวเดิม (`sketchAnalysisQueueRef`) เพื่อให้ค่าที่ AI อ่านตรงกับภาพที่หมุนแล้ว
   * ล้างผลวิเคราะห์เดิมของไฟล์นั้นออกก่อนวิเคราะห์ใหม่ (อย่าให้ค่าเก่าค้าง)
3. **ข้อความช่วยเหลือผู้ใช้:**
   * ใต้หัวข้อแนบภาพแบบร่าง เพิ่มข้อความสั้น: **"ภาพเอียง? กดปุ่ม 'หมุน 90°' ที่การ์ดภาพก่อนให้ AI อ่าน"** (`data-testid="text-sketch-rotate-hint"`)
4. **Automated Unit Tests ใน `artifacts/knight-basins/test/sketch-image-rotate.test.ts` (ใหม่):**
   * ทดสอบว่ามีปุ่มหมุนบนการ์ดภาพทุกใบ พร้อม data-testid และ aria-label
   * ทดสอบฟังก์ชันคำนวณขนาดหลังหมุน (สลับกว้าง/ยาว) และการจำกัดด้านยาวสุด 1920px
   * ทดสอบว่าปุ่มถูก disable ระหว่างกำลังส่ง/วิเคราะห์
   * ทดสอบว่าข้อความช่วยเหลือ "หมุน 90°" ปรากฏ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/components/StudioPage.tsx:
     - เพิ่มปุ่มหมุนภาพ 90 องศา (data-testid="button-rotate-sketch-*") บนการ์ดภาพแบบร่าง พร้อม disable ระหว่าง busy
     - เพิ่มฟังก์ชัน rotateSketchFile() ด้วย canvas (ไม่เพิ่ม dependency) แล้ววิเคราะห์ไฟล์นั้นใหม่หลังหมุน
     - เพิ่มข้อความช่วยเหลือ (data-testid="text-sketch-rotate-hint")
  2. สร้าง artifacts/knight-basins/test/sketch-image-rotate.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/sketch-image-rotate.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเพิ่ม dependency ใหม่ใน package.json (ห้ามใส่ไลบรารีหมุนภาพ)
  - ห้ามแตะ FormalQuotation.tsx, WorkshopProductionSheet.tsx หรือเลย์เอาต์งานพิมพ์
  - ห้ามแตะตรรกะราคา ระยะปลอดภัยหลุมเจาะ 100 มม. และกฎไม่หักช่องเจาะ
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-sketch-image-rotate แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 555 / pass 533 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/sketch-image-rotate.test.ts ผ่าน 100%
  5) ยืนยันใน PR ว่าไม่มี dependency ใหม่ถูกเพิ่ม (git diff ของ package.json ต้องว่าง)

OUTPUT:
  - branch: feat/replit-sketch-image-rotate (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css หรือเพิ่ม dependency เพื่อให้ฟีเจอร์ทำงาน
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
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | ห้ามเพิ่ม dependency (ใช้ Canvas ของเบราว์เซอร์เท่านั้น) | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
