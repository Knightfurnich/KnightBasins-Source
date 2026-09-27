# ใบงาน 112 (ชัย) — เพิ่ม API สรุปสถานะพื้นที่ดิสก์และสุขภาพระบบจัดเก็บไฟล์ (Disk Storage & File Health Stats API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / System Monitoring & Storage Health) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อสนับสนุนการบริหารจัดการระบบระยะยาวและการทำงานร่วมกับระบบสำรองข้อมูล (Task 111) และคลังผลงาน (Task 102/109)
ชัยจะรับหน้าที่สร้าง Endpoint **`GET /api/admin/storage/stats`** เพื่อสรุปพื้นที่ดิสก์และสุขภาพไฟล์บนเซิร์ฟเวอร์แบบเรียลไทม์:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/routes/admin-router.ts` (หรือแยกใน `src/lib/storage-stats.ts`):**
   * Endpoint: `GET /api/admin/storage/stats`
   * บังคับใช้ Admin Auth Guard (`requireAnyAdminPermission(["leads", "basins"])`)
   * รวบรวมสถิติการใช้งานพื้นที่จัดเก็บไฟล์ (Storage Statistics):
     - `portfolio`: จำนวนไฟล์รูปภาพทั้งหมด, ขนาดรวม (bytes), และขนาดเฉลี่ยต่อรูป
     - `backups`: จำนวนไฟล์แบ็กอัป, ขนาดรวม (bytes), วันที่ของแบ็กอัปใหม่สุดและเก่าสุด
     - `diskUsage`: เช็คพื้นที่ว่างและพื้นที่ใช้ไปของพาร์ติชัน (free / total bytes) โดยใช้ `statfs` หรือคำนวณจากไดเรกทอรีจัดเก็บ
   * คืนค่า JSON Response:
     `{ portfolio: { count: number, totalBytes: number }, backups: { count: number, totalBytes: number, oldestDate: string, newestDate: string }, status: "healthy" | "warning" }`
2. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/admin-storage-stats.test.ts` (ใหม่):**
   * ทดสอบคืนค่าสถิติพื้นที่ portfolio และ backups ได้อย่างถูกต้อง
   * ทดสอบคืน HTTP 401 เมื่อไม่มีสิทธิ์ Admin
   * ทดสอบกรณีไม่มีไฟล์แบ็กอัปหรือ portfolio ว่าง ให้ fallback เป็น 0 อย่างปลอดภัย ไม่พ่น error

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-storage-stats แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/admin-router.ts (และ src/lib/storage-stats.ts):
     - เพิ่ม endpoint GET /api/admin/storage/stats สรุปจำนวนและขนาดไฟล์ portfolio, backups
     - บังคับ Admin Auth Guard
  2. สร้าง artifacts/api-server/test/admin-storage-stats.test.ts (ใหม่):
     - ทดสอบการคำนวณสถิติพื้นที่ถูกต้อง
     - ทดสอบ Admin Auth Guard (401)
     - ทดสอบ empty directory fallback

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/storage-stats.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-storage-stats.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-storage-stats
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/admin-storage-stats.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (550 tests / 545 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-storage-stats (เปิด PR เข้า main)
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
| 11 | ครอบคลุมการรายงานสถิติ Storage Health | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
