# ใบงาน 93 (Replit) — ตรวจสอบและปิดช่องโหว่ Client-Side Data Tampering & XSS Injection

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend Security & Validation) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพ (Boss) สั่งการให้ตรวจสอบและหาช่องโหว่ความปลอดภัยฝั่งหน้าบ้าน (Client-Side Security) ในจุดที่สำคัญต่อธุรกิจและข้อมูลลูกค้า 2 ด้านหลัก:
1. **การป้องกันการแอบแก้ราคากลางทาง (Price & Payload Tampering):**
   * ตรวจสอบโมเดลการคำนวณและส่งข้อมูล Lead / Studio Quote ว่า payload ที่ส่งออกจากหน้าบ้านมีการส่งตัวเลขราคาดิบที่ผู้ใช้อาจ tamper ผ่าน DevTools หรือไม่
   * ตรวจสอบ `input-sanitizers.ts` และส่วนประกอบที่รับข้อมูลตัวเลข (ราคา, ขนาดความยาว/ความลึก, จำนวนชิ้นงาน) ว่าป้องกันค่าติดลบ (`negative numbers`), ค่าที่ไม่ใช่ตัวเลข (`NaN / Infinity`), และตัวเลขอักขระแปลกปลอมได้อย่างรัดกุม
2. **การป้องกัน XSS & Script Injection ในทุก Form Input:**
   * ทดสอบช่องกรอกข้อมูลลูกค้าในหน้าเว็บ (ชื่อลูกค้า, เบอร์โทรศัพท์, ที่อยู่สถานที่ติดตั้ง, หมายเหตุเพิ่มเติม, ชื่อชิ้นงานใน Studio)
   * ต้องไม่มีจุดใดที่นำ input ของผู้ใช้ไป render ผ่าน `dangerouslySetInnerHTML` หรือสร้าง HTML แบบดิบโดยไม่มี sanitization / React escaping
   * เพิ่ม helper ฟังก์ชันสำหรับ sanitize ข้อความตัวอักษรใน `artifacts/knight-basins/src/data/input-sanitizers.ts` เพื่อตัดอักขระ HTML tags และ script payloads
3. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/security-data-tampering.test.ts` (ใหม่):**
   * ทดสอบ payload tampering (ค่าติดลบ, ค่าผิดปกติ)
   * ทดสอบ XSS sanitization (สคริปต์, 태그 HTML, event handlers เช่น `<img src=x onerror=alert(1)>`)
   * ทดสอบการคงอยู่ของตัวเลขที่ถูกต้องและข้อความภาษาไทยปกติ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/data/input-sanitizers.ts:
     - เพิ่มฟังก์ชัน sanitizeTextInput() สำหรับทำความสะอาดข้อความ ป้องกัน XSS / Script Injection (ตัดหรือ encode HTML tags, scripts, javascript: protocol)
     - เพิ่มฟังก์ชัน sanitizeIntegerRange() ป้องกันค่าติดลบ, ตัวเลขทศนิยมผิดที่, หรือค่าหลุดช่วงที่กำหนด
  2. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - นำ sanitizer ไปใช้กับช่องกรอกข้อมูลลูกค้า (ชื่อ, ที่อยู่, หมายเหตุ) ก่อนสร้าง payload ส่งขอราคา
     - ตรวจสอบว่าไม่มีการส่งฟิลด์ราคาแบบที่เชื่อถือ client-side override อย่างผิดปกติ
  3. สร้าง artifacts/knight-basins/test/security-data-tampering.test.ts (ใหม่):
     - ทดสอบ XSS sanitization ครอบคลุม script tags, HTML tags, event handlers
     - ทดสอบ numeric boundary sanitization (ป้องกันค่าติดลบ, NaN, ตัวเลขเกินขอบเขต)
     - ยืนยันว่าข้อความภาษาไทยปกติและตัวเลขมิติงานจริงไม่ถูกทำลาย

SCOPE:
  - artifacts/knight-basins/src/data/input-sanitizers.ts
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/security-data-tampering.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (CSS หลักถูกแช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์ (งานนี้เป็น client-side hardening)
  - ห้ามลบหรือแก้ไข data-testid เดิมที่มีอยู่ในหน้าเว็บ
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-security-data-tampering แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 420 / pass 420 / fail 20 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/security-data-tampering.test.ts ผ่าน 100%
  5) ตรวจสอบและสรุปผลการทดสอบด้าน Security ใน PR description

OUTPUT:
  - branch: feat/replit-security-data-tampering (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
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
| 11 | ครอบคลุมการทดสอบ Data Tampering และ XSS Injection | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่แตะ CSS แช่แข็ง | ✅ ผ่าน |
