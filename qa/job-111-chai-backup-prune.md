# ใบงาน 111 (ชัย) — เพิ่มระบบตรวจสอบและตัดเก็บไฟล์สำรองฐานข้อมูลอัตโนมัติ (Database Backup Vault Retention & Prune API)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Database & Disaster Recovery) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในระบบ Production มีการสำรองฐานข้อมูล PostgreSQL อัตโนมัติ (`/docker/knightbasins/backups/`)
แต่ปัจจุบันไฟล์แบ็กอัปจะสะสมไปเรื่อยๆ หากไม่มีการจัดการตัดเก็บ (Retention Policy) จะทำให้ฮาร์ดดิสก์ของ VPS เต็มในระยะยาว
ชัยจะรับหน้าที่สร้าง Endpoint **`POST /api/admin/backup/prune`** และโมดูลตรวจสอบความสมบูรณ์ของไฟล์แบ็กอัป:

1. **สิ่งที่ต้องสร้างใน `artifacts/api-server/src/routes/admin-router.ts` (หรือแยกโมดูลใน `src/lib/backup-vault.ts`):**
   * Endpoint: `POST /api/admin/backup/prune`
   * บังคับใช้ Admin Auth Guard (`requireAnyAdminPermission(["leads", "basins"])`)
   * นโยบายการตัดเก็บไฟล์แบ็กอัป (Retention Policy):
     - ค้นหาไฟล์ `.sql.gz` หรือ `.dump` ในไดเรกทอรีแบ็กอัป
     - กฎเหล็ก: **ต้องเก็บไฟล์แบ็กอัปไว้อย่างน้อย 7 วันล่าสุดเสมอ (Minimum 7 days retention) ห้ามลบไฟล์ใหม่เด็ดขาด**
     - หากไฟล์มีอายุเก่าเกิน **30 วัน**: ให้ทำการลบออกจากดิสก์อย่างปลอดภัย
     - ต้องเหลือไฟล์แบ็กอัปที่สมบูรณ์ไว้อย่างน้อย 3 ชุดเสมอ แม้ไฟล์จะเก่าเกิน 30 วัน (Safety Floor: Never delete all backups)
   * การตอบกลับ (Response):
     - คืน HTTP 200: `{ prunedCount: number, keptCount: number, freedBytes: number, totalBackups: number }`
     - มี Audit Log บันทึกการตัดเก็บทุกครั้ง
2. **เขียน Automated Test ยืนยันใน `artifacts/api-server/test/admin-backup-prune.test.ts` (ใหม่):**
   * ทดสอบจำลองไฟล์แบ็กอัปอายุ 35 วัน ➔ ถูกลบจริงและคืน freedBytes ถูกต้อง
   * ทดสอบจำลองไฟล์แบ็กอัปอายุ 3 วัน ➔ ไม่ถูกลบ (ปลอดภัย)
   * ทดสอบ Safety Floor: ถ้ามีไฟล์เหลือแค่ 2 ไฟล์ แม้จะเก่าเกิน 30 วัน ระบบต้องไม่ยอมลบ (รักษานโยบายกู้ภัย)
   * ทดสอบ Admin Auth Guard (HTTP 401 ถ้าไม่มี session)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-backup-prune แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/admin-router.ts (และ src/lib/backup-vault.ts):
     - เพิ่ม endpoint POST /api/admin/backup/prune จัดการลบไฟล์แบ็กอัปที่เก่าเกิน 30 วัน
     - รักษากฎความปลอดภัย: ต้องเก็บไว้อย่างน้อย 7 วัน และต้องมีไฟล์เหลือไม่ต่ำกว่า 3 ชุดเสมอ
     - บังคับ Admin Auth Guard และบันทึก Audit Log
  2. สร้าง artifacts/api-server/test/admin-backup-prune.test.ts (ใหม่):
     - ทดสอบการตัดเก็บไฟล์เก่าสำเร็จ
     - ทดสอบการคงอยู่ของไฟล์ใหม่ (<7 วัน)
     - ทดสอบ Safety Floor ป้องกันการลบหมด
     - ทดสอบ Admin Auth Guard

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/backup-vault.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-backup-prune.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้องฐานข้อมูลจริงบน Production VPS
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์
  - ห้ามลบไฟล์แบ็กอัปจริงบน VPS ในขั้นตอนการทดสอบ (ใช้โฟลเดอร์ temp จำลอง)
  - ห้ามแตะต้องไฟล์นอกขอบเขต SCOPE ที่ระบุไว้

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-backup-prune
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) npm test test/admin-backup-prune.test.ts -> ผ่าน 100%
  4) npm test เต็ม api-server เทียบกับ baseline (545 tests / 540 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-backup-prune (เปิด PR เข้า main)
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
| 10 | มี Safety Floor ป้องกันไฟล์แบ็กอัปสูญหาย | ✅ ผ่าน |
| 11 | ครอบคลุมการตัดเก็บ Backup และ Retention Policy | ✅ ผ่าน |
| 12 | รักษาระดับผลลัพธ์เทียบเท่า baseline เดิม | ✅ ผ่าน |
