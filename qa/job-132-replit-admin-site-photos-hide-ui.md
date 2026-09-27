# ใบงาน 132 (Replit) — เปลี่ยนปุ่มลบภาพหน้างานเป็น "ซ่อน/แสดงภาพ" แบบไม่ทำลายข้อมูล (Site Photos Hide / Unhide UI)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Site Photos UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพสั่งปรับแนวทางชัดเจนว่า **"การลบในหน้านั้น หมายถึงการไม่ให้แสดง (Hidden) — ยืดหยุ่นกว่าและไม่กระทบส่วนอื่น"**
ภาพจริงบนดิสก์และประวัติทั้งหมดต้องไม่ถูกทำลาย และสามารถกู้คืนกลับมาแสดงได้เสมอ เดวิดจึงเปลี่ยนหน้าจอจากการลบถาวรเป็นระบบ **ซ่อน / แสดง (Hide / Unhide)**

**API หลังบ้าน (Task 131 — อยู่ระหว่างดำเนินการและจะ merge ก่อนใบงานนี้เริ่ม):**
* `PATCH /api/admin/site-photos/:id/visibility` — รับ `{ isVisible: false }` เพื่อซ่อน หรือ `{ isVisible: true }` เพื่อแสดง
* `GET /api/admin/site-photos?visibility=visible|hidden|all` — ค่าเริ่มต้น `visible`

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/SitePhotosPage.tsx`:**
1. **เปลี่ยนปุ่มเดิมจาก "ลบภาพ" เป็น "ซ่อนภาพ":**
   * ปุ่มบนการ์ดภาพแต่ละใบ เปลี่ยนไอคอน/ข้อความเป็น **`[ 🙈 ซ่อนภาพ ]`** มี attribute `data-testid="button-hide-site-photo"`
   * กดแล้วเรียก `PATCH /api/admin/site-photos/:id/visibility` ด้วย `{ isVisible: false }`
   * แสดง Toast: **"ซ่อนภาพนี้จากรายการแล้ว (กู้คืนได้ทุกเมื่อ)"**
   * **ห้ามเรียก `DELETE /api/admin/site-photos/:id` จาก UI นี้อีก** (endpoint เดิมยังอยู่ แต่หน้าจอไม่ใช้แล้ว)
2. **เพิ่มแท็บ/ตัวเลือกการแสดงผล (Visibility Filter):**
   * เพิ่มตัวเลือก 2 สถานะ: **`[ 👁️ ภาพที่แสดงอยู่ ]`** (ค่าเริ่มต้น, `visibility=visible`) และ **`[ 🙈 ภาพที่ซ่อนไว้ ]`** (`visibility=hidden`)
   * มี attribute `data-testid="button-visibility-visible"` และ `data-testid="button-visibility-hidden"`
   * แสดงจำนวนภาพที่ซ่อนไว้บนปุ่ม เช่น `[ 🙈 ภาพที่ซ่อนไว้ (3) ]`
3. **ปุ่มกู้คืนในโหมดภาพที่ซ่อนไว้:**
   * เมื่ออยู่ในแท็บภาพที่ซ่อนไว้ การ์ดแต่ละใบมีปุ่ม **`[ 👁️ แสดงอีกครั้ง ]`** มี attribute `data-testid="button-unhide-site-photo"`
   * กดแล้วเรียก `PATCH /api/admin/site-photos/:id/visibility` ด้วย `{ isVisible: true }` และ Toast: **"นำภาพกลับมาแสดงแล้ว"**
   * ในแท็บนี้ซ่อนปุ่มซ่อนภาพและปุ่ม ZIP ของการ์ดเพื่อไม่ให้สับสน
4. **คำเตือนในกล่องยืนยันการซ่อน:**
   * ถ้ามีกล่องยืนยัน ให้ข้อความต้องเป็น: **"ซ่อนภาพนี้จากรายการ? ภาพจะไม่ถูกลบและกู้คืนได้ทุกเมื่อ"** (ห้ามใช้คำว่า "ลบ" หรือ "ลบถาวร")
5. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-site-photos-hide-ui.test.ts` (ใหม่):**
   * ทดสอบว่าปุ่มซ่อนภาพส่ง `PATCH .../visibility` ด้วย `{ isVisible: false }` และไม่เรียก DELETE
   * ทดสอบว่าปุ่มแสดงอีกครั้งส่ง `{ isVisible: true }`
   * ทดสอบว่าตัวกรอง visibility เปลี่ยนพารามิเตอร์ที่ส่งไป API ถูกต้อง และค่าเริ่มต้นเป็น visible
   * ทดสอบข้อความยืนยันไม่มีคำว่า "ลบถาวร"

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/SitePhotosPage.tsx:
     - เปลี่ยนปุ่มลบภาพเดิมเป็นปุ่มซ่อนภาพ (data-testid="button-hide-site-photo") เรียก PATCH /api/admin/site-photos/:id/visibility { isVisible: false }
     - เพิ่มตัวกรอง visibility (visible/hidden) และปุ่มแสดงอีกครั้ง (data-testid="button-unhide-site-photo") ส่ง { isVisible: true }
     - ห้ามเรียก DELETE จาก UI นี้อีก
  2. สร้าง artifacts/knight-basins/test/admin-site-photos-hide-ui.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/SitePhotosPage.tsx
  - artifacts/knight-basins/test/admin-site-photos-ui.test.ts
  - artifacts/knight-basins/test/admin-site-photos-manage.test.ts
  - artifacts/knight-basins/test/admin-site-photos-extra-filters.test.ts
  - artifacts/knight-basins/test/admin-site-photos-smart-search.test.ts
  - artifacts/knight-basins/test/admin-site-photos-zip-download-ui.test.ts
  - artifacts/knight-basins/test/admin-site-photos-hide-ui.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเรียก DELETE /api/admin/site-photos/:id จากหน้าจอนี้อีก (ต้องเป็นการซ่อนเท่านั้น)
  - ห้ามทำให้ Universal Search, ตัวกรองปี พ.ศ., ปุ่ม ZIP, และการย้ายขั้นตอนเดิมเสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-site-photos-hide-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 551 / pass 529 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-site-photos-hide-ui.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-site-photos-hide-ui (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้ายังไม่พบ PATCH /api/admin/site-photos/:id/visibility ใน main ให้หยุดและรายงานทันที (อย่าเดา endpoint)
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | ยึดคำสั่งบอส: ซ่อนไม่ใช่ลบ ไม่ทำลายข้อมูล | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
