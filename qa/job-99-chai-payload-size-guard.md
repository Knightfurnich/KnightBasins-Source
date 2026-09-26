# ใบงาน 99 (ชัย) — เพิ่มระบบจำกัดขนาด Payload และป้องกัน DoS ขนาดไฟล์ (API Body & JSON Payload Size Guard)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Security & Rate Limit) — รันต่อได้ทันทีเมื่อพร้อม

**ที่มาและความต้องการ:**
เพื่อยกระดับความปลอดภัยของ Production API Server ให้แข็งแกร่งยิ่งขึ้นตามมาตรฐาน Security Best Practices ชัยจะรับหน้าที่วางมาตรการป้องกัน **Payload Bomb / Large JSON DoS Attacks**:

1. **ปัญหาที่ต้องป้องกัน:**
   * ในการส่งข้อมูล JSON เข้าสู่ API Server (เช่น `POST /api/leads` หรือ `/api/leads/sketch`) หากมีบ็อตหรือผู้ไม่หวังดียิงก้อน JSON ขนาดยักษ์ (เช่น 50MB+) หรืออาเรย์ซ้อนกันหลายแสนชั้น อาจทำให้ Event Loop ของ Node.js ทำงานหนักและหน่วยความจำเต็ม (Out of Memory)
2. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/lib/payload-guard.ts` (ใหม่):**
   * ฟังก์ชัน `validatePayloadDepthAndSize(payload: unknown, maxDepth?: number, maxKeys?: number): { safe: boolean; reason?: string }`
   * ตรวจสอบว่าโครงสร้าง JSON มีความลึกไม่เกิน 10 ชั้น และจำนวนคีย์รวมไม่เกิน 500 คีย์ เพื่อป้องกันการโจมตีแบบ Nested Object Bomb
3. **การนำไปใช้งานใน `artifacts/api-server/src/app.ts` หรือ Middleware:**
   * ตรวจสอบให้มั่นใจว่า Middleware `express.json()` มีการกำหนด `limit` ที่ปลอดภัยและเหมาะสม (เช่น `2mb` สำหรับ JSON ปกติ)
   * ดักจับและคืนค่า HTTP 413 Payload Too Large พร้อมข้อความที่สุภาพเมื่อได้รับข้อมูลเกินขนาด
4. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/payload-guard.test.ts` (ใหม่):**
   * ทดสอบ JSON ปกติ ➔ ผ่าน 100%
   * ทดสอบ JSON ที่มีความลึกเกิน 10 ชั้น ➔ ตรวจจับและปฏิเสธ
   * ทดสอบ JSON ที่มีจำนวนคีย์มหาศาล ➔ ตรวจจับและปฏิเสธ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-payload-size-guard แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/payload-guard.ts (ใหม่):
     - ฟังก์ชัน validatePayloadDepthAndSize() ตรวจจับ Nested Object Bomb และ JSON ขนาดยักษ์
  2. ปรับปรุง artifacts/api-server/src/app.ts:
     - ตรวจสอบและกำหนด limit ของ express.json() อย่างรัดกุม ป้องกัน Large Payload DoS
     - รองรับการคืนค่า HTTP 413 Payload Too Large อย่างปลอดภัย
  3. สร้าง artifacts/api-server/test/payload-guard.test.ts (ใหม่):
     - ทดสอบการตรวจจับ Object ที่ซ้อนกันลึกผิดปกติ (Deeply Nested JSON)
     - ทดสอบการตรวจจับ Object ที่มี Key เกินเกณฑ์ปลอดภัย
     - ทดสอบ Normal Business Payloads ผ่านราบรื่น

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/payload-guard.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/app.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/payload-guard.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้
  - ห้ามทำให้ request ปกติของหน้าบ้าน (Studio, Sketch, Admin) ใช้งานไม่ได้

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-payload-size-guard
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/payload-guard.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (450 tests / 445 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-payload-size-guard (เปิด PR เข้า main)
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
| 11 | ป้องกัน Payload Bomb และ DoS ในระดับ Server | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
