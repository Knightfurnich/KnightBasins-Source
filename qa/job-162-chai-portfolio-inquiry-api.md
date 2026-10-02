# ใบงาน 162 (ชัย & บอส) — สร้าง API รับข้อมูลลูกค้าที่สนใจสั่งผลิตจาก Portfolio พร้อมส่งแจ้งเตือนเข้า Telegram (Portfolio Direct Inquiry API & Telegram Alert)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย / บอส (Backend / Portfolio Direct Inquiry API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อรองรับหน้าจอที่ทีมหน้าบ้านกำลังทำใน Task 160:
เมื่อลูกค้ากดปุ่ม `[ 💬 สั่งผลิตแบบนี้ / ขอราคา ]` บนรูปในหน้า `/portfolio` หน้าเว็บจะยิงข้อมูลมาที่ Endpoint หลังบ้าน
งานนี้คือการสร้าง Endpoint รับข้อมูล บันทึกลงตาราง Lead และส่งการ์ดแจ้งเตือนเข้าห้อง Telegram "KnightTeam" ทันที:
1. **สร้าง Endpoint ใน `artifacts/api-server/src/routes/portfolio.ts`:**
   * `POST /api/public/portfolio/inquiry` (Public Endpoint):
     - Body: `{ photoId: string, photoTitle: string, photoUrl: string, phone: string, name?: string, notes?: string, source?: string, sku?: string }`
     - ตรวจสอบ Validation: `phone` ต้องไม่ว่าง และต้องมีอย่างน้อย 9 ตัวอักษร (ถ้าว่าง/ผิด คืน 400 `{ message: "กรุณาระบุเบอร์โทรศัพท์ที่ติดต่อได้" }`)
     - `photoId` ต้องไม่ว่าง (ถ้าว่าง คืน 400)
2. **สร้าง Lead ใหม่ในตาราง `customer_leads` (ฐานข้อมูล PostgreSQL):**
   * บันทึก Lead ใหม่:
     - `lead_key`: สร้าง UUID ใหม่
     - `name`: `name` หรือ `"ลูกค้าสนใจสั่งผลิตจากภาพผลงาน"`
     - `phone`: `phone`
     - `source`: `"portfolio"`
     - `order_mode`: `"quick-purchase"`
     - `status`: `"new"`
     - `notes`: `[สนใจผลงาน]: ${photoTitle} (รหัสภาพ: ${photoId}) · บันทึกเพิ่มเติม: ${notes || '-'}`
     - `sketch_url`: `photoUrl` (บันทึกรูปผลงานที่ลูกค้าสนใจไว้ใน Lead ทันที)
3. **ส่งการ์ดแจ้งเตือนเข้า Telegram กลุ่ม KnightTeam:**
   * ใช้ฟังก์ชันส่ง Telegram ที่มีอยู่แล้วใน `artifacts/api-server/src/lib/sales-notifications.ts` หรือยิง `https://api.telegram.org/bot${token}/sendMessage`
   * ข้อความแจ้งเตือน:
     - `🎯 มีลูกค้าสนใจสั่งผลิตจากภาพผลงานจริง!`
     - `📸 ผลงาน: ${photoTitle} (รหัส ${photoId})`
     - `👤 ชื่อผู้ติดต่อ: ${name || 'ไม่ได้ระบุ'}`
     - `📞 เบอร์โทรศัพท์: ${phone}`
     - `📝 รายละเอียด/สถานที่: ${notes || '-'}`
     - `🔗 ดูภาพผลงาน: ${photoUrl}`
   * ส่งเข้า `TELEGRAM_SALES_CHAT_ID` (`-1004361494281` กลุ่ม KnightTeam)
   * คืนค่า HTTP 201 `{ success: true, leadId: lead.id, message: "บันทึกข้อมูลและส่งแจ้งเตือนเรียบร้อยแล้ว" }`
4. **เขียน Unit Tests ใน `artifacts/api-server/test/portfolio-inquiry-api.test.ts` (ใหม่):**
   * ทดสอบ POST ข้อมูลถูกต้อง คืน 201 และมีข้อความสำเร็จ
   * ทดสอบเบอร์โทรว่าง คืน 400
   * ทดสอบ photoId ว่าง คืน 400

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-inquiry-api แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. เพิ่ม POST /api/public/portfolio/inquiry ใน artifacts/api-server/src/routes/portfolio.ts
  2. บันทึก Lead ใหม่ลง customer_leads และส่ง Telegram เข้ากลุ่ม KnightTeam
  3. เขียนเทสต์ใน artifacts/api-server/test/portfolio-inquiry-api.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/portfolio-inquiry-api.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามแก้ตารางฐานข้อมูล customer_leads หรือลบคอลัมน์เดิม
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-portfolio-inquiry-api

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/portfolio-inquiry-api.test.ts -> ผ่าน 100% (baseline 3/3 ผ่าน)
  3) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE เท่านั้น

OUTPUT:
  - branch: feat/chai-portfolio-inquiry-api (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 3 ข้อ

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
| 10 | อนุรักษ์โครงสร้างตารางเดิมในฐานข้อมูล | ✅ ผ่าน |
| 11 | รองรับการแจ้งเตือนเข้า Telegram กลุ่ม KnightTeam | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
