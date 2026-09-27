# ใบงาน 117 (Replit) — เพิ่มปุ่มบันทึกแบบร่างและเปิดแบบร่างต่อผ่าน URL บนหน้า 2D Studio (Studio Draft Save & Resume UI)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Studio UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ชัยได้สร้าง API ฝั่งเซิร์ฟเวอร์ `POST /api/studio/draft` และ `GET /api/studio/draft/:draftKey` (Task 115) เสร็จสมบูรณ์และ Deploy Live แล้ว
ใบงานนี้คือการ **ต่อสายหน้าจอ 2D Studio (`/studio`)** ให้ผู้ใช้สามารถ:
1. กดปุ่มบันทึกแบบร่างที่วาดค้างไว้ เพื่อรับลิงก์นำกลับมาทำต่อได้ตลอด 30 วัน
2. เมื่อเปิดหน้า `/studio?draft=dft_xxx` ระบบจะดึงข้อมูลเดิม (ทรงเคาน์เตอร์, ขนาดมิติ, สีหิน, รุ่นอ่าง, ตำแหน่งหลุมเจาะ, และสถานะขอบ 4 ด้าน) กลับคืนมาบนหน้าจออัตโนมัติ

**รายละเอียดงาน:**
1. **ปุ่ม `[ 💾 บันทึกแบบร่างไว้ทำต่อ ]` บนหน้า `/studio`:**
   * วางในตำแหน่ง Action Toolbar หรือแถบควบคุม Studio ใน `artifacts/knight-basins/src/components/StudioPage.tsx`
   * มี attribute `data-testid="button-studio-save-draft"`
   * เมื่อกดปุ่ม: ส่งข้อมูลผังปัจจุบันไปยัง `POST /api/studio/draft`
   * เมื่อได้รับ `draftKey` และ `resumeUrl` สำเร็จ: แสดง Dialog หรือ Modal พร้อมลิงก์เต็ม (เช่น `https://knightbasins.srv1964473.hstgr.cloud/studio?draft=dft_xxx`) และมีปุ่ม `[ 📋 คัดลอกลิงก์ ]` เพื่อให้ลูกค้าส่งเข้า LINE หรือเปิดข้ามเครื่องได้
2. **ระบบเปิดแบบร่างอัตโนมัติจาก URL Param (`?draft=dft_xxx`):**
   * เมื่อผู้ใช้เข้าหน้า `/studio` และมีพารามิเตอร์ `draft` ใน URL
   * ให้เรียก `GET /api/studio/draft/:draftKey`
   * นำข้อมูลที่ได้ (shape, dimensions, stoneColor, basinSku, basinPlacements, edges) มาอัปเดต state ของ Studio เพื่อกู้คืนแบบร่างเดิมบนหน้าจอ 100%
   * หาก `draftKey` ไม่ถูกต้องหรือหมดอายุ (API ตอบ 404): แสดง Toast หรือข้อความแจ้งเตือนอย่างสุภาพว่า "ไม่พบแบบร่างหรือลิงก์หมดอายุแล้ว" และโหลดค่าเริ่มต้นปกติ
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/studio-draft-resume-ui.test.ts` (ใหม่):**
   * ทดสอบการกดปุ่มบันทึกแบบร่าง และการแสดงผล dialog ลิงก์ resume
   * ทดสอบการโหลดข้อมูลจาก query param `?draft=` และการกู้คืน state
   * ทดสอบการรับมือกรณี API 404

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/components/StudioPage.tsx:
     - เพิ่มปุ่มบันทึกแบบร่าง data-testid="button-studio-save-draft"
     - เรียก POST /api/studio/draft เมื่อกดบันทึก พร้อมกล่อง Dialog แสดงลิงก์ resume และปุ่มคัดลอก
     - เพิ่ม useEffect ตรวจจับ URL param ?draft= และเรียก GET /api/studio/draft/:draftKey เพื่อกู้คืนผังเดิม
  2. สร้าง artifacts/knight-basins/test/studio-draft-resume-ui.test.ts (ใหม่):
     - ทดสอบปุ่มบันทึก, การส่ง payload, การแสดง dialog ลิงก์, และการโหลด draft กลับคืนมา

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-draft-resume-ui.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเปลี่ยนตรรกะการคำนวณราคาหินและอ่างเดิม
  - ห้ามลดระยะปลอดภัยหลุมเจาะ (MIN_BASIN_CLEARANCE_MM = 100)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-studio-draft-resume-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 485 / pass 463 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/studio-draft-resume-ui.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-studio-draft-resume-ui (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
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
| 11 | อนุรักษ์ระยะปลอดภัย 100 มม. | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
