# ใบงาน 102 (ชัย) — API สำหรับเพิ่มและลบรูปในคลังผลงาน (Portfolio Admin Write API: Add & Delete)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Portfolio Catalog Write) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพสั่งการให้หน้า `/admin/portfolio` สามารถ **เพิ่มรูปใหม่** และ **ลบรูปที่ไม่ต้องการ (รวมถึงรูปซ้ำ)** ได้เอง โดยไม่ต้องให้เดวิดอัปโหลดผ่าน SFTP มือ
ปัจจุบัน API มีแต่การอ่าน (GET) และการซ่อน/แสดง (PATCH visibility) — ยังไม่มี endpoint สำหรับเขียน/ลบไฟล์จริง ชัยจะรับหน้าที่สร้างให้ครบ:

1. **เพิ่มรูปใหม่ — `POST /api/admin/portfolio/upload`:**
   * รับ multipart form: ไฟล์ภาพ (`file` หรือ `image`) + `category` (slug ใน `CATEGORY_ORDER`) + `title` (ไม่บังคับ — ถ้าไม่ส่งให้ใช้ชื่อหมวดเป็นชื่อเริ่มต้น)
   * ตรวจความปลอดภัยเหมือน `/leads/sketch`: magic byte จริง (ไม่เชื่อ MIME ที่ client ส่ง), อนุญาตเฉพาะ JPG/PNG/WEBP/GIF, ขนาด ≤ `MAX_IMAGE_UPLOAD_BYTES` (10MB)
   * บันทึกไฟล์ลง `uploads/portfolio/<category>/` ด้วยชื่อ `<category>_<serial>_<hash>.<ext>` (ห้ามใช้ชื่อไฟล์จาก client ตรงๆ — กัน path traversal)
   * เพิ่มรายการใหม่เข้า `catalog.json` พร้อม `id` ที่ไม่ซ้ำกับของเดิม, `url` = `/api/uploads/portfolio/<category>/<filename>`, `width/height/bytes`
   * ตอบกลับ 201 พร้อม item ที่สร้าง (โครงเดียวกับ GET /portfolio)
2. **ลบรูป — `DELETE /api/admin/portfolio/:id`:**
   * ลบรายการออกจาก `catalog.json` **และลบไฟล์จริงออกจากดิสก์** พร้อมลบ entry ใน `visibility.json` (ถ้ามี)
   * ต้อง reject ถ้า path ของไฟล์ที่คำนวณได้ไม่อยู่ใต้ `uploads/portfolio/` เด็ดขาด (กัน `../../` ไปลบไฟล์ระบบ)
   * ถ้าไม่พบ id → 404 · ลบสำเร็จ → 200 `{ id, deleted: true, fileRemoved: boolean }`
3. **ตรวจจับรูปซ้ำ — `GET /api/admin/portfolio/duplicates`:**
   * ตรวจสองระดับ: (ก) ไฟล์เหมือนกันเป๊ะ (MD5) (ข) ขนาดภาพ + จำนวนไบต์ตรงกันเป๊ะ (สัญญาณว่ารูปเดียวกันถูกนำเข้าซ้ำ)
   * คืนกลุ่มรูปที่น่าสงสัย เพื่อให้หน้าแอดมินติดป้าย `🔁 รูปซ้ำ` แล้วลบได้ทันที
4. **ทั้งหมดต้องมี admin guard** (`createAdminAuthMiddleware()` + `requireAnyAdminPermission(["leads", "basins"])`) และ **log การลบทุกครั้ง** (ใคร/เมื่อไหร่/id ไหน) เพื่อตรวจย้อนหลังได้

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-portfolio-admin-write แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/portfolio-catalog.ts (ใหม่):
     - อ่าน/เขียน catalog.json แบบ atomic (เขียนไฟล์ temp แล้ว rename) กันไฟล์เสียหายกลางคัน
     - generatePortfolioId(category, existingIds) สร้าง id ใหม่ที่ไม่ชนของเดิม
     - resolvePortfolioFilePath(category, filename) ที่ปฏิเสธ path ออกนอก uploads/portfolio/
  2. ปรับปรุง artifacts/api-server/src/routes/portfolio.ts:
     - POST /api/admin/portfolio/upload (multipart) — เพิ่มรูปใหม่ + append เข้า catalog
     - DELETE /api/admin/portfolio/:id — ลบรายการ + ลบไฟล์ + ลบ visibility entry
     - GET /api/admin/portfolio/duplicates — กลุ่มรูปซ้ำ (MD5 ตรงกัน หรือ width/height/bytes ตรงกัน)
  3. สร้าง artifacts/api-server/test/portfolio-admin-write.test.ts (ใหม่):
     - เพิ่มรูปสำเร็จ -> ไฟล์ถูกเขียนจริง + catalog มีรายการใหม่ + id ไม่ซ้ำ
     - ปฏิเสธไฟล์ที่ไม่ใช่ภาพ / ไฟล์ใหญ่เกิน 10MB / ไฟล์ที่ magic byte ไม่ตรง
     - ลบรูปสำเร็จ -> รายการหายจาก catalog + ไฟล์หายจากดิสก์ + visibility entry หาย
     - ปฏิเสธ id ที่พยายามชี้ไฟล์นอก uploads/portfolio (path traversal) และ id ที่ไม่มีจริง (404)
     - duplicates: จับคู่ MD5 เดียวกันและคู่ที่ (w,h,bytes) ตรงกัน

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/portfolio-catalog.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/portfolio-admin-write.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามลบหรือแก้ไฟล์ผลงานจริงบน Production VPS ระหว่างพัฒนา/ทดสอบ (ให้ทดสอบบนโฟลเดอร์ temp เท่านั้น)
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามเปิด endpoint เขียน/ลบโดยไม่มี admin guard เด็ดขาด
  - ห้ามลบไฟล์นอก uploads/portfolio/ ไม่ว่ากรณีใด (path traversal = ต้อง reject)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-portfolio-admin-write
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/portfolio-admin-write.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (477 tests / 472 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-portfolio-admin-write (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์เดิมของ api-server ล้มเหลวเกิน 5 ข้อเดิม
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าพบว่า endpoint ใหม่สามารถลบไฟล์นอก uploads/portfolio/ ได้
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
| 10 | มี Admin Guard และ Audit Log ทุกการลบ | ✅ ผ่าน |
| 11 | ป้องกัน Path Traversal และไฟล์ต้องห้าม | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
