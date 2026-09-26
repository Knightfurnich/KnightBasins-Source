# ใบงาน 94 (ชัย) — เพิ่มระบบตรวจสอบและป้องกันการดัดแปลงราคาฝั่งเซิร์ฟเวอร์ (Server-Side Price Integrity & Anti-Tampering Guard)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / API & Security) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพ (Boss) สั่งการให้ปิดช่องโหว่ความปลอดภัยด้าน Data Tampering ให้ครบวงจร ขณะที่ลูกมืออีกท่านรับผิดชอบฝั่ง Client ชัยจะรับผิดชอบ **หัวใจสำคัญฝั่ง Server-Side** เพื่อให้ระบบมีสถาปัตยกรรมแบบ Zero-Trust (ไม่เชื่อตัวเลขราคาจาก Client โดยตรง):

1. **ปัญหาที่ต้องป้องกัน:**
   * ในการส่งข้อมูล Lead / ขอใบเสนอราคา (`POST /api/leads` และ `PATCH /admin/leads/:id`) ฟิลด์ `total` หรือ `studioData` อาจถูกผู้ไม่ประสงค์ดีหรือ Bot ดัดแปลง payload โดยตรง เช่น ส่งราคาติดลบ, ราคา 0 บาท, หรือตัวเลขที่ไม่สัมพันธ์กับขนาดพื้นที่และเรตราคาหินจริง
2. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/lib/price-integrity.ts` (ใหม่):**
   * ฟังก์ชัน `verifyAndSanitizeQuoteTotal(studioData: unknown): { verifiedTotal: number | null; isTampered: boolean }`
   * ตรวจสอบว่าถ้า `total` มีค่าผิดปกติ (เช่น ติดลบ, เป็น NaN/Infinity, หรือต่ำกว่าต้นทุนขั้นต่ำของสินค้าที่เลือก) ให้ตรวจจับสถานะ `isTampered: true`
   * ฟังก์ชัน `validateNumericDimensions(widthMm: number, depthMm: number): boolean` ตรวจสอบความถูกต้องของขนาดแผ่นหิน ป้องกันค่าติดลบหรือขนาดทะลุขอบเขตความปลอดภัย
3. **การนำไปใช้งานใน `artifacts/api-server/src/routes/leads.ts`:**
   * นำ `price-integrity` ไปตรวจสอบใน `quoteTotalTHB` หรือก่อนบันทึก `total` / `studioData` ลงฐานข้อมูล
   * หากพบว่าตัวเลขราคาถูกดัดแปลงเป็นค่าติดลบ หรือค่าที่ผิดปกติ ให้ reject ด้วย HTTP 400 Bad Request หรือ override ด้วยราคาที่ปลอดภัย พร้อมบันทึกคำเตือนใน log
4. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/price-integrity.test.ts` (ใหม่)**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ให้สร้าง feature branch feat/chai-server-price-integrity จาก main ล่าสุด รันการทดสอบให้ผ่านครบถ้วน และเปิด PR เข้า main พร้อมแนบหลักฐานการรันจริง (EVIDENCE) ครบทุกข้อ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/price-integrity.ts (ใหม่):
     - ฟังก์ชัน verifyAndSanitizeQuoteTotal() ตรวจสอบความถูกต้องของราคาก่อนบันทึก
     - ป้องกันค่าราคาติดลบ, NaN, Infinity, หรือตัวเลขหลุดโลก (Tampered Payloads)
     - ฟังก์ชัน validateNumericDimensions() ป้องกันมิติขนาดติดลบ
  2. ปรับปรุง artifacts/api-server/src/routes/leads.ts:
     - ใช้งาน price-integrity ในการตรวจสอบ payload ของ POST /leads และฟังก์ชัน quoteTotalTHB
     - ปฏิเสธ payload ที่จงใจส่งราคาติดลบ (HTTP 400) หรือ sanitize ให้ถูกต้องก่อนบันทึก
  3. สร้าง artifacts/api-server/test/price-integrity.test.ts (ใหม่):
     - ทดสอบการตรวจจับราคาติดลบ, NaN, string injection ในฟิลด์ราคา
     - ทดสอบการคำนวณและคงอยู่ของราคาปกติ (Normal Business Payloads)
     - ทดสอบ Endpoint POST /api/leads ด้วย payload ที่ถูกดัดแปลงราคา

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/price-integrity.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/price-integrity.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามเปลี่ยนโครงสร้างของ response JSON ที่กระทบกับหน้าบ้านเดิม
  - ห้ามบายพาส TypeScript typecheck หรือใส่ any ที่เลี่ยงความปลอดภัย

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-server-price-integrity
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/price-integrity.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (394 tests / 389 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-server-price-integrity (เปิด PR เข้า main)
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
| 11 | ครอบคลุมการป้องกัน Price Tampering ฝั่ง Server | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
