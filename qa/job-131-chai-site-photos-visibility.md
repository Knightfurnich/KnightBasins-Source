# ใบงาน 131 (ชัย) — เพิ่มระบบซ่อน/แสดงภาพหน้างานช่างแบบไม่ทำลายข้อมูล (Site Photos Visibility & Soft-Hide API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Admin API) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพเห็นชอบแนวทาง: **"ซ่อนไม่ให้แสดง (Soft Hide / Visibility) ยืดหยุ่นและปลอดภัยกว่าการลบทิ้งทำลายไฟล์จริง"**
เพื่อไม่ให้ข้อมูลภาพหน้างานสูญหาย และสามารถกู้คืนกลับมาแสดงได้ตลอดเวลา ชัยจะรับหน้าที่สร้างระบบจัดการการแสดงผลของภาพหน้างาน:
1. รองรับการตั้งค่าซ่อน/แสดงภาพ: `PATCH /api/admin/site-photos/:id/visibility` (รับ `{ isVisible: boolean }`)
2. `GET /api/admin/site-photos` ค่าเริ่มต้นจะดึงเฉพาะภาพที่แสดงอยู่ (`isVisible: true`) และรองรับ `?visibility=hidden` หรือ `?visibility=all` เพื่อให้แอดมินดูภาพที่ซ่อนไว้ได้
3. เก็บสถานะความปลอดภัยแบบ Non-Destructive: เก็บไฟล์ JSON mapping `site_photos_visibility.json` ในโฟลเดอร์ uploads อย่างปลอดภัย (แพตเทิร์นเดียวกับที่ทำสำเร็จแล้วใน `portfolio.ts` ของระบบคลังภาพ) โดยไม่ต้องแก้ไข schema ของฐานข้อมูลเดิม

**รายละเอียดงานใน `artifacts/api-server/src/routes/admin-router.ts` (หรือแยกใน `src/lib/site-photos-visibility.ts`):**
1. **สร้างระบบจัดการ Visibility ของ Site Photos:**
   * บันทึกสถานะการซ่อน/แสดงลงใน JSON file (Atomic write + In-memory cache หรืออ่านเขียนอย่างปลอดภัย)
   * ค่าเริ่มต้นของทุกภาพ = `isVisible: true` (แสดงตามปกติ)
2. **เพิ่ม Endpoint `PATCH /api/admin/site-photos/:id/visibility`:**
   * บังคับสิทธิ์แอดมิน: `requireAdminPermission("leads", "edit")`
   * รับ `{ isVisible: boolean }`
   * บันทึกสถานะและตอบกลับ `{ success: true, id: number, isVisible: boolean }`
3. **ปรับปรุง `GET /api/admin/site-photos`:**
   * เพิ่มพารามิเตอร์ `visibility` (`"visible"` | `"hidden"` | `"all"` โดยค่าเริ่มต้นคือ `"visible"`)
   * กรองภาพตามสถานะ visibility ที่ระบุ
4. **สร้าง Automated Unit Tests ใน `artifacts/api-server/test/admin-site-photos-visibility.test.ts` (ใหม่):**
   * ทดสอบการซ่อนภาพ (`isVisible: false`) และการกู้คืนภาพ (`isVisible: true`)
   * ทดสอบ `GET /admin/site-photos` กรองเฉพาะภาพที่ visible ตามค่าเริ่มต้น
   * ทดสอบ `GET /admin/site-photos?visibility=hidden` คืนเฉพาะภาพที่ถูกซ่อน
   * ทดสอบการบล็อกผู้ใช้ที่ไม่มีสิทธิ์แอดมิน (401)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-site-photos-visibility แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. สร้าง PATCH /api/admin/site-photos/:id/visibility ใน artifacts/api-server/src/routes/admin-router.ts
     - รับ { isVisible: boolean } เพื่อซ่อนหรือแสดงภาพแบบ Soft Hide ไม่ทำลายไฟล์
  2. ปรับปรุง GET /api/admin/site-photos ให้รองรับพารามิเตอร์ visibility ("visible" | "hidden" | "all") ค่าเริ่มต้น = "visible"
  3. สร้าง test/admin-site-photos-visibility.test.ts (ใหม่) ครอบคลุมการซ่อน, กู้คืน, กรองค่าเริ่มต้น, และสิทธิ์ 401

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-site-photos-visibility.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามลบไฟล์ภาพจริงบนดิสก์เด็ดขาด (ต้องเป็นการซ่อน Soft Hide 100%)
  - ห้ามเปลี่ยน database schema ของตาราง sitePhotos
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-site-photos-visibility

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-site-photos-visibility
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test test/admin-site-photos-visibility.test.ts -> ผ่าน 100%
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 617 / pass 611 / fail 6 (pre-existing sandbox) / cancelled 0 / skipped 0

OUTPUT:
  - branch: feat/chai-site-photos-visibility (เปิด PR เข้า main)
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
| 10 | อนุรักษ์ไฟล์จริงและ schema เดิม 100% | ✅ ผ่าน |
| 11 | ระบบ Soft Hide ปลอดภัยต่อข้อมูล | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
