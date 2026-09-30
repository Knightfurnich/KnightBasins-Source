# ใบงาน 147 (ชัย) — Public Job Tracking & Customer Portal API (Client Job Tracking Endpoint)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Customer Tracking & Portal API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ถอดแบบบทเรียน **ข้อ 12 ในคู่มือ KRAKEN ERP** (Customer Portal):
> *"ให้ลูกค้าเข้าดูงานของตัวเองได้โดยไม่ต้องโทรถาม: ดูแบบที่อนุมัติ, ความคืบหน้างานติดตั้ง, รูปถ่ายหน้างาน และยอดชำระ — เห็นเฉพาะข้อมูลของตัวเอง"*

ปัจจุบันระบบเรามี `publicQuoteToken` สำหรับดูใบเสนอราคา (`GET /api/quotes?token=...`) อยู่แล้ว แต่ยังไม่มี **Public Tracking API** ที่ส่งข้อมูลสถานะงาน ไทม์ไลน์ และรูปถ่ายหน้างานส่งมอบให้ลูกค้าดูอย่างปลอดภัย
งานนี้คือการสร้าง:
1. Endpoint ใหม่: `GET /api/public/track` (Public Route มี Rate Limit ไม่ต้องล็อกอินแอดมิน)
   - พารามิเตอร์รับ: `?token=<publicQuoteToken>` (หรือ `?leadKey=<leadKey>` ร่วมกับ token เพื่อความปลอดภัย)
   - ถอดรหัส token ผ่าน `verifyPublicQuoteToken(token)`
   - ค้นหา Lead จาก `quoteNumber` และตรวจสอบ `quoteAccessSecret` ตรงเป๊ะ 100%
2. คืนผลลัพธ์ข้อมูลเฉพาะที่ลูกค้าจำเป็นต้องเห็น (Mask ข้อมูลอ่อนไหว):
   - 📌 **ข้อมูลพื้นฐาน:** `jobCode` (หรือ `quoteNumber`), `customerName` (ชื่อลูกค้า), `projectName`
   - ⏱️ **ไทม์ไลน์สถานะ 5 ขั้นตอน (Track Stages):**
     1. `quote_accepted` — รับออเดอร์/ยืนยันแบบ
     2. `in_production` — โรงงานกำลังตัดประกอบหิน
     3. `ready_to_install` — งานผลิตเสร็จ นัดหมายช่าง
     4. `installing` — ช่างเข้าติดตั้งหน้างาน
     5. `completed` — ส่งมอบงานเรียบร้อย
     *(แปลงจากฟิลด์ `lead.status` ปัจจุบันเป็นขั้นตอนพร้อมวันที่และสถานะ active/done)*
   - 📐 **แบบร่าง Studio (ถ้ามี):** สรุปข้อมูลหิน, ขนาด, อ่างที่เลือก (ไม่เปิดเผยต้นทุนหรือกำไร)
   - 📸 **รูปถ่ายหน้างานส่งมอบ (Completed Site Photos):**
     - ดึงรูปภาพจากตาราง `site_photos` ที่ผูกกับ `leadId` นี้ (เฉพาะรูปที่ `isVisible === true` และขั้นตอน `completed` หรือส่งมอบ)
     - คืนเฉพาะ `{ id, imageUrl, stage, caption, takenAt }`
   - 🛡️ **ข้อมูลที่ต้องซ่อนเด็ดขาด (Security Masking):**
     - ซ่อนเบอร์โทร (mask เป็น 081***5678)
     - ไม่ส่งข้อมูลช่างภายใน, ไม่ส่งต้นทุน, ไม่ส่งบันทึกภายในของแอดมิน (`notes`)

**สิ่งที่ต้องทำ:**
1. ใน `artifacts/api-server/src/routes/leads.ts`:
   - เพิ่ม `router.get("/public/track", trackGetRateLimit, async (req, res, next) => { ... })`
   - เรียก `verifyPublicQuoteToken()` และค้นหา Lead
   - ดึง `site_photos` เฉพาะรูปที่ `isVisible = true` ของ lead นี้
   - จัดฟอร์แมต Response ให้สะอาด ปลอดภัย ไร้ข้อมูลภายใน
2. เขียน Unit Tests ใน `artifacts/api-server/test/public-job-tracking.test.ts` (ใหม่):
   - ทดสอบ:
     - Token ถูกต้อง: คืนสถานะ 200 พร้อมไทม์ไลน์, ข้อมูลแบบร่าง และรูปหน้างาน
     - Token ผิดหรือปลอมแปลง: คืน 404
     - ข้อมูลเบอร์โทรต้องถูก Mask ปลอดภัย
     - รูปภาพที่ถูกซ่อน (`isVisible: false`) ต้องไม่หลุดออกไปในผลลัพธ์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-public-job-tracking แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง GET /api/public/track ใน artifacts/api-server/src/routes/leads.ts
  2. ดึงสถานะงาน ไทม์ไลน์ 5 ขั้นตอน และรูปถ่ายส่งมอบงานที่เปิดแสดง (isVisible: true)
  3. Mask ข้อมูลส่วนตัว ปลอดภัยตามหลัก Privacy ไม่ส่งข้อมูลต้นทุน/ช่างภายใน
  4. เขียนเทสต์ใน artifacts/api-server/test/public-job-tracking.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/public-job-tracking.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามเปิดเผยข้อมูลต้นทุนหิน, กำไร, หรือบันทึกภายใน (notes) ให้ลูกค้าเห็น
  - ห้ามส่งภาพหน้างานที่ถูกซ่อน (isVisible: false) ออกไปใน API สาธารณะเด็ดขาด
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-public-job-tracking

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/public-job-tracking.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 2 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-public-job-tracking (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎความปลอดภัยข้อมูลส่วนบุคคล (Privacy Masking) | ✅ ผ่าน |
| 11 | อนุรักษ์ระบบ Token และ Quote เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
