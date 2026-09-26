# ใบงาน 87 (ชัย) — ตรวจสอบและทดสอบยืนยันความปลอดภัยรอบสุดท้ายก่อนเปิดใช้งานจริง (Final Security Verification & Sanity Check)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Security Verification & Hardening Sign-off)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่มีการแพตช์อุดช่องโหว่ความปลอดภัยสำคัญ 2 จุดไปแล้ว:
1. การปิดช่องโหว่ Rate Limiter ปลอมแปลง IP (Task 86 / Finding #1)
2. การปิดช่องโหว่ Error Leakage ไม่ให้ข้อความดิบหลุดสู่ภายนอก (Finding #2)

เพื่อให้คุณนพและทีมงานมั่นใจ 100% ว่าไม่มีผลข้างเคียง (Side Effects) หรือจุดเปราะบางใดหลงเหลืออยู่:
1. **ทดสอบ Regression และยืนยันความปลอดภัยครบวงจร (Security Regression Testing):**
   - รันเทสต์ชุดความปลอดภัยทั้งหมดใน `artifacts/api-server/test/security-audit.test.ts`
   - ทดสอบ End-to-End จำลองการเรียก API สำคัญของระบบ:
     * `POST /api/sketch/analyze` — อัปโหลดภาพสเก็ตช์ปกติ, อัปโหลดเกิน 3 ไฟล์ (400), ยิงเกิน Rate Limit (429)
     * `GET /api/places/autocomplete` — ตรวจสอบการจำกัด Rate Limit และการส่งค่าค้นหาว่าง
     * `POST /admin/session` (Login) — ตรวจสอบการจำกัด Brute Force 5 ครั้ง/นาที
     * `GET /admin/ai-cost-center` — ตรวจสอบการปฏิเสธเมื่อไม่มี Session (401) และสิทธิ์ถูกต้อง (200)
2. **ตรวจสอบสรุปความปลอดภัยขั้นสุดท้าย (Security Sign-off Summary):**
   - อัปเดตและลงนามในเอกสาร `artifacts/api-server/SECURITY_AUDIT_REPORT.md`:
     * ปรับสถานะ Finding #1 และ Finding #2 เป็น **`[RESOLVED & VERIFIED]`** พร้อมระบุ commit ที่แก้
     * สรุปผลการทดสอบรอบสุดท้ายว่าไม่มีช่องโหว่ระดับ Critical หรือ High หลงเหลืออยู่
3. **กฎเหล็ก:**
   - ตรวจสอบผ่านการรัน Local Unit Test และ Local Test Server เท่านั้น **ห้ามยิงโจมตีใส่ Production Server จริงเด็ดขาด**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-final-security-verification แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/test/security-audit.test.ts:
     - เพิ่ม/ปรับปรุงเทสต์ยืนยันความปลอดภัยรอบสุดท้าย (Final Sanity Suite)
     - ครอบคลุม Rate Limiting, Admin Auth, Error Sanitization และ Multipart Limits
  2. ใน artifacts/api-server/SECURITY_AUDIT_REPORT.md:
     - อัปเดตตารางสรุปสถานะ Finding #1 และ #2 เป็น RESOLVED
     - สรุปผล Final Security Sign-off ก่อนเปิดใช้งานจริง
  3. รันเทสต์เต็มชุด ยืนยันว่าไม่มีบั๊กถอยหลังใดๆ

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/SECURITY_AUDIT_REPORT.md
  - /opt/data/cache/kbsrc/artifacts/api-server/test/security-audit.test.ts

FORBIDDEN:
  - ห้ามยิงโจมตีหรือรันสคริปต์ก่อกวนใส่เซิร์ฟเวอร์ Production จริงเด็ดขาด
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้อง lib/db/ และตารางฐานข้อมูลจริง
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-final-security-verification

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-final-security-verification
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> ผ่านครบ 100%
  4) npm test ใน artifacts/api-server -> รายงานผลเทียบ baseline เดิม (394 tests / 389 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-final-security-verification (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ใน artifacts/api-server มี fail เพิ่มจาก baseline เดิม (fail > 5)
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
| 11 | ทดสอบ Regression ความปลอดภัย และอัปเดตรายงาน | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์หน้าบ้าน และไม่โจมตี Production จริง | ✅ ผ่าน |
