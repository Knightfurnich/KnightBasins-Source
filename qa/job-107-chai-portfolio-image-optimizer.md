# ใบงาน 107 (ชัย) — เพิ่มระบบบีบอัดและแปลงรูปภาพเป็น WebP อัตโนมัติ (Portfolio Automatic WebP Image Optimizer)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Image Optimization & Performance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 102 ชัยได้สร้าง API สำหรับรับไฟล์อัปโหลดรูปภาพเข้าคลังผลงาน (`POST /api/admin/portfolio/upload`) สำเร็จเรียบร้อยแล้ว
เพื่อประหยัดพื้นที่จัดเก็บข้อมูลบน Production VPS และทำให้หน้าเว็บของลูกค้าโหลดภาพผลงานได้เร็วระดับมิลลิวินาที:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/lib/image-optimizer.ts` (ใหม่):**
   * ฟังก์ชัน `optimizePortfolioImage(inputBuffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; width: number; height: number; format: string }>`
   * หากรูปที่อัปโหลดเข้ามาเป็น JPG หรือ PNG ให้แปลงเป็น `.webp` อัตโนมัติ พร้อมตั้งคุณภาพ (quality) ที่ 82–85% ซึ่งคมชัดสูงแต่ลดขนาดไฟล์ลงได้ถึง 60–80%
   * หากรูปมีขนาดกว้างเกิน 1920px ให้ resize สเกลสัดส่วนลงมาไม่เกิน 1920px (ระดับ Full HD สำหรับโชว์ผลงาน)
   * หากรูปเป็น `.webp` อยู่แล้วและขนาดไม่เกิน 1920px ให้อนุรักษ์ buffer เดิมไว้
2. **การนำไปใช้งานใน `artifacts/api-server/src/routes/portfolio.ts` (POST /upload):**
   * เมื่อรับ multipart file เข้ามา ก่อนบันทึกลงดิสก์และลงทะเบียนใน `catalog.json`
   * ให้ส่ง buffer ผ่าน `optimizePortfolioImage()` ก่อน
   * ไฟล์ที่บันทึกลงดิสก์จะมีนามสกุลเป็น `.webp` เสมอ และได้ค่า `width`, `height`, `bytes` ที่ถูกต้องตรงกับไฟล์จริง
3. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/image-optimizer.test.ts` (ใหม่):**
   * ทดสอบส่ง buffer จำลองของ PNG ➔ แปลงเป็น WebP สำเร็จ ขนาดเล็กลง
   * ทดสอบส่ง buffer จำลองของ JPEG ➔ แปลงเป็น WebP สำเร็จ
   * ทดสอบรูปที่มีขนาดกว้าง 2500px ➔ ถูกย่อลงมาไม่เกิน 1920px โดยสัดส่วนไม่เพี้ยน
   * ทดสอบ Normal Upload Flow ใน `portfolio.ts` ยังคงคืนค่า HTTP 201 ถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-image-optimizer แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/image-optimizer.ts (ใหม่):
     - ฟังก์ชัน optimizePortfolioImage() แปลง JPG/PNG เป็น WebP อัตโนมัติ (quality ~82-85%)
     - ปรับสเกลภาพที่กว้างเกิน 1920px ให้ไม่เกิน 1920px
  2. ปรับปรุง artifacts/api-server/src/routes/portfolio.ts:
     - ใช้งาน optimizePortfolioImage ใน POST /admin/portfolio/upload ก่อนบันทึกไฟล์
     - บันทึกไฟล์เป็น .webp และเก็บ width/height/bytes ที่แท้จริง
  3. สร้าง artifacts/api-server/test/image-optimizer.test.ts (ใหม่):
     - ทดสอบการแปลงภาพ PNG/JPG เป็น WebP
     - ทดสอบการคุมขนาดภาพไม่เกิน 1920px
     - ทดสอบ integration กับ POST /admin/portfolio/upload

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/image-optimizer.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/image-optimizer.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามทำให้ไฟล์ WebP เดิมที่อัปโหลดเข้ามาเสียหาย

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-portfolio-image-optimizer
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/image-optimizer.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (545 tests / 540 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-portfolio-image-optimizer (เปิด PR เข้า main)
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
| 10 | ไม่แตะต้อง Production Database จริง | ✅ ผ่าน |
| 11 | แปลง JPG/PNG เป็น WebP และคุมสเกล 1920px | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
