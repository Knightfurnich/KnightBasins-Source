# ใบงาน 227 (Resource Protection & Auto Cleanup) — เพิ่ม Rate Limit และระบบกวาดล้างไฟล์แบบร่าง Studio Draft อัตโนมัติ

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ Replit · ภารกิจป้องกันทรัพยากรระบบดิสก์ (Quick-Fix Sprint)
**Branch:** `feat/replit-studio-draft-rate-limit-and-cleanup`
**ที่มา:** จากการตรวจพบร่วมกันระหว่างชัยและ Replit พบว่าเส้นทาง `POST /api/studio/draft` เปิดสาธารณะให้สร้างไฟล์ลงในดิสก์ได้โดยไม่มี Rate limit เฉพาะ และไฟล์ที่หมดอายุเกิน 30 วันยังไม่มีระบบกวาดล้าง (Sweeper) อัตโนมัติ ทำให้เสี่ยงต่อการถูกบอทยิงฟลัดเพื่อกินพื้นที่จัดเก็บของเซิร์ฟเวอร์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/routes/studio-draft.ts:
     - เพิ่ม Rate Limiter เฉพาะสำหรับเส้นทางบันทึก draft:
       const studioDraftCreateRateLimit = createRateLimiter({
         name: "rl:studio-draft-create",
         max: 20, // สูงสุด 20 ครั้ง
         windowMs: 15 * 60 * 1000, // ภายใน 15 นาที ต่อ IP
       });
       และนำไปผูกกับ router.post("/studio/draft", studioDraftCreateRateLimit, ...)
     - สร้างฟังก์ชันกวาดล้างไฟล์แบบร่างที่หมดอายุ:
       export async function cleanupExpiredStudioDrafts(retentionDays = 30): Promise<{ scanned: number; deleted: number }>
       - ตรวจสอบไฟล์ในโฟลเดอร์จัดเก็บ draft
       - ลบไฟล์ที่อายุเกิน retentionDays วัน (ตรวจสอบจาก timestamp หรือ mtime ของไฟล์)
  2. ใน artifacts/api-server/src/index.ts (หรือ background scheduler):
     - เรียกใช้งาน cleanupExpiredStudioDrafts() เมื่อแอปพลิเคชันเริ่มทำงาน และตั้งรอบการทำงานทุก 24 ชั่วโมง (หรือเมื่อเริ่มเซิร์ฟเวอร์ใน production)
  3. ชุดทดสอบ:
     - artifacts/api-server/test/studio-draft-rate-limit-and-cleanup.test.ts:
       - ทดสอบว่าการยิง POST /api/studio/draft เกินโควตา 20 ครั้งจะได้รับ HTTP 429 Too Many Requests
       - ทดสอบว่าฟังก์ชัน cleanupExpiredStudioDrafts สามารถลบไฟล์จำลองที่มีอายุเกิน 30 วันได้อย่างถูกต้อง และไม่แตะต้องไฟล์ที่ยังไม่หมดอายุ

SCOPE:
  - artifacts/api-server/src/routes/studio-draft.ts
  - artifacts/api-server/src/index.ts
  - artifacts/api-server/test/studio-draft-rate-limit-and-cleanup.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามลบไฟล์ draft ที่ยังไม่หมดอายุ (ต้องรักษาไฟล์ที่ยังอยู่ภายใน 30 วันไว้ครบถ้วน)
  - ห้ามกระทบผู้ใช้งานทั่วไปที่บันทึก draft ตามปกติ (โควตา 20 ครั้ง/15 นาที เพียงพอสำหรับลูกค้าทั่วไป)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-studio-draft-rate-limit-and-cleanup ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-draft-rate-limit-and-cleanup.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 831 ผ่าน / 0 ตก / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/studio-draft.ts
  - artifacts/api-server/src/index.ts
  - artifacts/api-server/test/studio-draft-rate-limit-and-cleanup.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ studio-draft-rate-limit ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Rate limit + Auto cleanup สำหรับ Studio draft |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบไฟล์ที่ยังไม่หมดอายุ, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 831 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ป้องกันการฟลัดข้อมูลกินพื้นที่ดิสก์เซิร์ฟเวอร์ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้ rate limiter มาตรฐาน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 227 เรียบร้อย |
