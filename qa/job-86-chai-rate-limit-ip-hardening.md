# ใบงาน 86 (ชัย) — ปิดช่องโหว่ Rate Limiter ป้องกันการปลอมแปลง IP ผ่าน X-Forwarded-For (Security Patch Finding #1)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Security Patch & Rate Limit Hardening)

**ที่มาและความต้องการ:**
สืบเนื่องจากรายงาน Security Audit (Task 84 Finding #1) ที่ชัยตรวจพบว่า การตั้งค่า `app.set("trust proxy", 1)` ใน `app.ts` ทำให้ Express เชื่อถือค่า IP จาก Header `X-Forwarded-For` เพียงอย่างเดียว ซึ่งหากผู้ไม่หวังดีส่งคำขอเข้ามาโดยสลับค่า Header นี้ไปเรื่อยๆ จะสามารถบายพาส Rate Limiter ทุกตัว (เช่น การป้องกัน Brute force หน้า Login, API อ่านแบบสเก็ตช์, หรือ Places Autocomplete) ได้ทั้งหมด

เพื่ออุดช่องโหว่นี้อย่างถาวรและรัดกุมที่สุด:
1. **ปรับปรุงฟังก์ชันการระบุตัวตน Client IP ใน `artifacts/api-server/src/lib/rate-limit.ts`:**
   - ฟังก์ชัน `clientKey(req)` จะต้องไม่พึ่งพา `req.ip` แบบไร้การตรวจสอบ
   - ดึง IP จากแหล่งที่เชื่อถือได้จริง:
     * หากมี Reverse Proxy ให้ดึง IP ขวาสุด/ตัวแรกที่เชื่อถือได้จาก Header หรือดึงจาก `req.socket.remoteAddress`
     * ป้องกันการสลับ IP ด้วยการสร้าง Identifier สำรอง (เช่น Fingerprint รวมระหว่าง IP และ User-Agent) หรือใช้ socket IP ตรงเมื่อตรวจพบการปลอม Header
2. **รักษาความเข้ากันได้กับการทำงานจริงบน VPS:**
   * สภาพแวดล้อม Production มี Nginx ทำหน้าที่เป็น Reverse Proxy อยู่ข้างหน้า ต้องทำงานร่วมกันได้ตามปกติ
3. **อัปเดตและเขียน Unit Tests ใน `artifacts/api-server/test/security-audit.test.ts`:**
   * ทดสอบว่าเมื่อจำลอง Request ที่ส่ง Header `X-Forwarded-For` ปลอมสลับไปมา ระบบจะไม่หลงกล และยังคงนับ Rate Limit รวมกันจนติด 429 ได้อย่างถูกต้อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-rate-limit-ip-hardening แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/lib/rate-limit.ts (และ app.ts หากจำเป็น):
     - ปรับปรุง clientKey(req) ให้ดึง IP ที่แท้จริงอย่างปลอดภัย ป้องกัน Header spoofing
     - ทำให้การหมุน Header X-Forwarded-For ปลอมไม่สามารถบายพาส Rate Limiter ได้
  2. ใน artifacts/api-server/test/security-audit.test.ts:
     - เพิ่มหรือปรับปรุงเทสต์พิสูจน์ว่า Rate Limiter ทำงานป้องกันการบายพาสได้จริง
     - เทสต์ความปลอดภัยทั้งหมดต้องผ่าน 100%

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/rate-limit.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/app.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/security-audit.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้อง lib/db/ และตารางฐานข้อมูลจริง
  - ห้ามปิดการทำงานของ Rate Limiter เดิมที่มีอยู่
  - ห้ามทำให้ Nginx บน VPS ส่ง Request ต่อเข้า API Server ไม่ได้
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-rate-limit-ip-hardening

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-rate-limit-ip-hardening
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> ผ่านครบ 100%
  4) npm test ใน artifacts/api-server -> รายงานผลเทียบ baseline เดิม (390 tests / 385 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-rate-limit-ip-hardening (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
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
| 11 | ทดสอบการป้องกัน Header Spoofing และ Rate Limit | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์หน้าบ้าน และไม่กระทบ Nginx บน VPS | ✅ ผ่าน |
