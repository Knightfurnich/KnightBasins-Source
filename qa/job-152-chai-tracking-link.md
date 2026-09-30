# ใบงาน 152 (ชัย) — ระบบสร้างลิงก์ติดตามงานลูกค้าแบบคัดลอกใช้ซ้ำได้ในหน้าจัดการ Lead (Customer Tracking Link & Status API)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Customer Portal & Link Management API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เรามีหน้าพอร์ทัลลูกค้า `/track?token=...` (Task 148) และ API `GET /api/public/track` (Task 147) แล้ว
แต่ยังมีช่องว่างเชิงปฏิบัติ: **แอดมินต้องคัดลอกลิงก์เองจากหน้าเว็บ และไม่รู้ว่าลูกค้าเปิดดูไปแล้วหรือยัง** งานนี้จะปิดช่องว่างนั้น

1. **Endpoint ใหม่สำหรับแอดมิน: `GET /api/admin/leads/:id/tracking-link`** — guard `requireAdminPermission("leads")`
   * เรียก `publicQuoteTokenForLead(lead)`
   * **ถ้า Lead ยังไม่มี `quoteAccessSecret`:** ให้สร้างขึ้นมาอัตโนมัติ (ใช้ helper เดิมใน `quote-access.ts` ไม่เขียนใหม่) บันทึกลง DB แล้วคืนลิงก์ที่ใช้ได้จริง (ปัจจุบันหน้า `/admin/leads` สร้างให้เฉพาะ Lead ที่มี `quoteNumber` เท่านั้น)
   * คืน `200` `{ available: true, path: "/track?token=...", token, quoteNumber, createdAt }`
   * **ถ้า Lead ไม่มี `quoteNumber` (จึงสร้างลิงก์ไม่ได้):** คืน `200` `{ available: false, reason: "ยังไม่มีเลขที่ใบเสนอราคา" }` — **ห้ามคืน 500**
   * ไม่พบ Lead → `404`

2. **บันทึกประวัติการเปิดดูล่าสุดของลูกค้า (Tracking View Log):**
   * เพิ่มคอลัมน์ nullable ในตาราง `customer_leads`: `tracking_view_count` (integer, default 0), `tracking_viewed_at` (timestamptz, nullable)
   * สร้างไฟล์ migration ถัดไปใน `deploy/hostinger/migrations/` (ตรวจเลขล่าสุดก่อนสร้าง — ห้ามเดาเลข)
   * ใน `GET /api/public/track` (ไฟล์ `src/routes/leads.ts`) ให้ **เพิ่มจำนวนครั้งที่ลูกค้าเปิดดู** (`tracking_view_count + 1`) และตั้ง `tracking_viewed_at = now()`
   * ⚠️ การเขียนครั้งนี้เป็นการอัปเดต **2 คอลัมน์นี้เท่านั้น** ห้ามเปลี่ยนสถานะงานหรือข้อมูลอื่นของ Lead
   * ⚠️ ต้องไม่ทำให้ Endpoint สาธารณะล้มเหลว ถ้าอัปเดตไม่สำเร็จ ให้บันทึก log แล้ว **ยังคงตอบข้อมูลให้ลูกค้าตามปกติ** (ห้าม 500)

3. **ส่งข้อมูลย้อนกลับให้แอดมิน:**
   * ใน `GET /api/admin/leads` เพิ่ม `trackingViewCount` และ `trackingViewedAt` ในการตอบกลับ

4. **เทสต์ใน `artifacts/api-server/test/customer-tracking-link.test.ts` (ใหม่):**
   * Lead ที่มี `quoteNumber` แต่ยังไม่มี secret → สร้างสำเร็จและคืน `available: true`
   * Lead ที่ไม่มี `quoteNumber` → คืน `available: false` (ไม่ใช่ 500)
   * เรียก `GET /api/public/track` แล้ว `tracking_view_count` เพิ่มขึ้นจริง
   * ยืนยันว่า `GET /api/public/track` **ไม่เปลี่ยน `status`** ของ Lead
   * ไม่พบ Lead → `404`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-tracking-link แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. เพิ่ม GET /api/admin/leads/:id/tracking-link สร้าง secret อัตโนมัติและคืนลิงก์ /track
  2. เพิ่มคอลัมน์ tracking_view_count, tracking_viewed_at + migration และนับยอดเปิดดูใน GET /api/public/track
  3. ส่ง trackingViewCount, trackingViewedAt กลับใน GET /api/admin/leads
  4. เขียนเทสต์ใน artifacts/api-server/test/customer-tracking-link.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  - /opt/data/cache/kbsrc/deploy/hostinger/migrations/ · (ไฟล์ migration ใหม่ 1 ไฟล์)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/customer-tracking-link.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/ และ lib/db/
  - ห้ามเขียน helper สร้าง token ใหม่ซ้ำ ให้ใช้ publicQuoteTokenForLead() เดิมใน quote-access.ts
  - ห้ามให้ GET /api/public/track เปลี่ยนสถานะงาน (status) หรือข้อมูลอื่นนอกจาก 2 คอลัมน์ที่ระบุ
  - ห้ามให้ Endpoint สาธารณะคืน 500 เมื่อการนับยอดเปิดดูล้มเหลว
  - ห้ามแตะต้องตรรกะราคาใน fabrication-geometry.ts และ price-integrity.ts
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-tracking-link

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/customer-tracking-link.test.ts -> ผ่าน 100% (baseline: 6 เทสต์ใหม่ ผ่านครบ)
  3) node --experimental-strip-types --test artifacts/api-server/test/public-job-tracking.test.ts -> ผ่าน 100% (baseline 13/13 ต้องไม่พังจาก Task 147)
  4) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  5) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE เท่านั้น

OUTPUT:
  - branch: feat/chai-tracking-link (เปิด PR เข้า main)
  - ไฟล์ตามรายการ SCOPE (ใหม่ 2 + แก้ 3)
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะไฟล์นอก SCOPE เกิน 0 ไฟล์ (ให้หยุดและรายงานก่อน ไม่ต้องแก้เอง)
  - ถ้าพบว่าตาราง customer_leads มีคอลัมน์ tracking_view_count อยู่แล้ว — ให้หยุดรายงานทันที ห้ามสร้างซ้ำ
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
| 6 | EVIDENCE อ้างไฟล์เทสต์ของงานก่อนหน้าเพื่อกัน regression | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ห้ามให้ public endpoint คืน 500 (กฎความเสถียรหน้าลูกค้า) | ✅ ผ่าน |
| 11 | กำหนดให้ตรวจเลข migration ก่อนสร้าง | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
