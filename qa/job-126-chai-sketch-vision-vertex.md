# ใบงาน 126 (ชัย) — ปรับ Sketch Vision ให้ใช้ Google Service Account (Vertex AI) แทน API Key (Migrate Sketch Vision to Vertex AI Service Account)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / AI Architecture) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ปัจจุบันโมดูล `artifacts/api-server/src/lib/sketch-vision.ts` ยังพึ่งพา `GOOGLE_API_KEY` และยิงไปที่ `generativelanguage.googleapis.com` 
เพื่อความปลอดภัยตามมาตรฐานระดับองค์กรและรวมศูนย์ Credentials ไว้ที่จุดเดียว 
ชัยจะรับหน้าที่ปรับปรุงให้ `sketch-vision.ts` หันมาใช้ **Google Service Account (`google-service-account.ts`)** ร่วมกับโมดูล Vertex AI ที่ทำไว้ใน PR #90

**รายละเอียดงาน:**
1. **ปรับปรุง `artifacts/api-server/src/lib/sketch-vision.ts`:**
   * ให้รองรับการตรวจสอบสิทธิ์ผ่าน `loadGoogleServiceAccountCredentials()` จาก `google-service-account.ts`
   * การเรียกใช้งาน:
     - ใช้ Bearer Token ที่สร้างจาก Service Account
     - ปลายทาง Endpoint: เรียกผ่าน Vertex AI endpoint (สิงคโปร์ `asia-southeast1` หรือตาม `VERTEX_AI_LOCATION`, โปรเจกต์ตาม `VERTEX_AI_PROJECT_ID`)
     - รองรับ Fallback: หากยังมี `GOOGLE_API_KEY` ให้คงความสามารถเดิมไว้เป็นทางเลือกสำรอง (Graceful fallback) หรือใช้ Service Account เป็นหลัก
   * คง Signature เดิมของฟังก์ชัน `analyzeSketchImage(buffer: Buffer, mimeType: string, index?: number): Promise<SketchVisionItem>` และ `sketchVisionConfigured(): boolean` ไว้ 100% เพื่อไม่ให้กระทบ Route `/api/sketch/analyze` และหน้าเว็บ
   * รักษากฎความปลอดภัย: ไม่ throw error ออกไปสู่ภายนอก หาก AI ล้มเหลวหรือ timeout ให้คืน `unknownItem` พร้อมข้อความภาษาไทยสุภาพเหมือนเดิม
2. **ปรับปรุง Automated Unit Tests ใน `artifacts/api-server/test/sketch-vision.test.ts`:**
   * อัปเดต Mock และเทสต์เคสให้ครอบคลุมการทำงานผ่าน Service Account (Bearer Token exchange)
   * ทดสอบกรณีไม่มี Credentials หรือ Token exchange ล้มเหลว
   * ทดสอบการแปลงผลลัพธ์ JSON ของแบบร่าง I, L, U และสถานะขอบ 4 ด้านเหมือนเดิมครบถ้วน 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-sketch-vision-vertex แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. ปรับปรุง artifacts/api-server/src/lib/sketch-vision.ts:
     - ใช้ Service Account Bearer Token จาก google-service-account.ts และ Vertex AI endpoint
     - คง signature analyzeSketchImage() และ sketchVisionConfigured() เดิมไว้ 100%
  2. อัปเดต artifacts/api-server/test/sketch-vision.test.ts ให้ทดสอบทั้ง Service Account flow และผลการอ่านแบบร่าง

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sketch-vision.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/sketch-vision.test.ts

FORBIDDEN:
  - ห้ามเปลี่ยน signature หรือผลลัพธ์ของ analyzeSketchImage ที่หน้าจอและ route คาดหวัง
  - ห้ามลบกฎระยะปลอดภัย 100 มม. หรือกฎการคิดราคาเต็มพื้นที่ไม่หักช่องเจาะ
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-sketch-vision-vertex

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-sketch-vision-vertex
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/sketch-vision.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 595 / pass 589 / fail 6 (pre-existing sandbox) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-sketch-vision-vertex (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline 6 ข้อเดิม
  - ถ้าแตะต้องไฟล์นอก SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์กฎระยะปลอดภัย 100 มม. และไม่หักช่องเจาะ | ✅ ผ่าน |
| 11 | อนุรักษ์ signature ของ analyzeSketchImage | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
