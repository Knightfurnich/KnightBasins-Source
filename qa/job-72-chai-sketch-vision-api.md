# ใบงาน 72 (ชัย) — API วิเคราะห์ภาพแบบร่างด้วย AI (Sketch Vision OCR / Dimension Extraction)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย (Backend & Data)

**ความต้องการ:** 
สร้าง API Endpoint สำหรับรับภาพแบบร่าง (สเก็ตช์มือ/แปลน) แล้วใช้ AI Vision (Gemini 2.5 Flash) อ่านลายมือ ถอดรูปทรงเคาน์เตอร์ และดึงตัวเลขมิติออกมาเป็น JSON เพื่อให้หน้า `/sketch` นำไปกรอกอัตโนมัติ (ลูกค้า/ทีมขายตรวจทานและแก้ไขได้)

**รายละเอียด:**
1. **Endpoint:** `POST /api/sketch/analyze` (multipart, รับ `file` ได้สูงสุด 3 ไฟล์)
2. **ผลลัพธ์ JSON ที่ต้องคืน (ต่อ 1 ภาพ):**
   - items[].index — ลำดับภาพ (0-based)
   - items[].shape — "I" | "L-left" | "L-right" | "U" | "unknown"
   - items[].runAMm / runBMm / runCMm — ความยาวแต่ละด้าน หน่วยมิลลิเมตร
   - items[].depthMm — ความลึก หน่วยมิลลิเมตร
   - items[].basinCount — จำนวนอ่างที่วาดในภาพ
   - items[].stoneHint — รหัสสีหินถ้าอ่านเจอ (หรือ null)
   - items[].rawText — ข้อความที่อ่านได้จากภาพ
   - items[].confidence — "high" | "medium" | "low"
   - items[].notes — หมายเหตุจาก AI ถ้ามี
3. **ตรรกะการแปลงหน่วย:**
   - `1.98` / `1.98 m` / `198 cm` → `1980` มม.
   - `45` / `45 cm` / `0.45 m` → `450` มม.
   - ถ้าอ่านตัวเลขไม่ได้เลย → คืน `shape: "unknown"` และค่า null ห้ามเดาตัวเลข
4. **Fallback ปลอดภัย:** ถ้าเรียก AI ไม่สำเร็จ/ไม่มี Key → คืน HTTP 200 พร้อม `shape: "unknown"` และทุกค่าเป็น null พร้อม `notes` อธิบาย (ห้ามให้หน้าเว็บพัง)
5. **ความปลอดภัย:** ต้องมี Rate limit และห้าม log เนื้อหาภาพ/ข้อมูลลูกค้า

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

GOAL:
  1. สร้างไฟล์ artifacts/api-server/src/lib/sketch-vision.ts:
     - ฟังก์ชัน analyzeSketchImage(buffer, mimeType) เรียก Gemini 2.5 Flash Vision
     - ใช้ prompt แบบช่างหินสังเคราะห์: ระบุรูปทรง (I / L-left / L-right / U), ความยาวด้าน A/B/C, ความลึก, จำนวนอ่างที่วาด
     - บังคับให้ AI ตอบเป็น JSON ตาม schema ด้วย responseMimeType: "application/json"
     - ห้ามเดาตัวเลข: ถ้าไม่ชัดให้คืน null
  2. เพิ่ม route POST /api/sketch/analyze ใน artifacts/api-server/src/routes/leads.ts (หรือไฟล์ route ที่เหมาะสม)
     - รับ multipart สูงสุด 3 ไฟล์ (ใช้ MAX_SKETCH_FILES = 3)
     - อ่าน GOOGLE_API_KEY จาก process.env
     - ถ้าไม่มี key หรือเรียก AI ล้มเหลว ให้คืน 200 พร้อม unknown shape และ notes
     - ต้องมี rate limit เช่นเดียวกับ /leads/sketch
  3. เขียนเทสต์ใน artifacts/api-server/test/sketch-vision.test.ts:
     - ทดสอบว่า parseSketchVisionResponse แปลง "1.98 m" -> 1980 และ "45 cm" -> 450 ได้
     - ทดสอบว่า response ที่ผิดรูปแบบ (ไม่ใช่ JSON) คืน fallback unknown โดยไม่ throw
     - ทดสอบว่าไม่มี GOOGLE_API_KEY แล้ว endpoint คืน 200 + shape unknown

SCOPE:
  1) /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts (ใหม่)
  2) /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  3) /opt/data/cache/kbsrc/artifacts/api-server/test/sketch-vision.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (เป็นงานของ Replit)
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx และ App.tsx
  - ห้าม log เนื้อหาภาพ ข้อความจากภาพ หรือข้อมูลส่วนตัวลูกค้าลง log
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-sketch-vision-api แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npx pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 349 / pass 343 / fail 2 / cancelled 3 / skipped 1
  4) cd artifacts/api-server && npm test (แนบตัวเลข tests/pass/fail จริง)
  5) เทสต์ใหม่ใน artifacts/api-server/test/sketch-vision.test.ts ผ่าน 100%
  6) ทดสอบยิง endpoint จริง 1 ครั้งด้วยภาพตัวอย่าง แล้วแนบ HTTP code + JSON ที่ได้

OUTPUT:
  - branch: feat/chai-sketch-vision-api (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 6 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าต้องใส่ API key ลงในโค้ดหรือไฟล์ที่ commit
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ monorepo | ✅ ผ่าน |
| 8 | กำหนด branch feat/chai-sketch-vision-api ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการแปลงหน่วยและ fallback ครบถ้วน | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
