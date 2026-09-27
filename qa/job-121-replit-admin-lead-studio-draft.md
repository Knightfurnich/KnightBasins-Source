# ใบงาน 121 (Replit) — เพิ่มปุ่มสร้างลิงก์แบบร่าง Studio จากข้อมูล Lead ในระบบแอดมิน (Admin Lead to Studio Draft Generator)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Admin Leads UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ในหน้าจัดการลูกค้า (`/admin/leads`) เมื่อลูกค้าส่งข้อมูลเข้ามา หรือมีข้อมูลผังแบบร่าง (`studioData` / `sketchUrls`) 
ทีมขายและแอดมินต้องการ **"ปุ่มเปิดดูผังหรือสร้างลิงก์แบบร่าง Studio ทันที"** เพื่อ:
1. กดคลิกเดียวแล้วเปิดหน้า `/studio?draft=dft_xxx` ดึงข้อมูลผังของลูกค้ารายนั้นขึ้นมาดูบนกระดาน 2D Studio ได้ทันที
2. มีปุ่มคัดลอกลิงก์แบบร่าง เพื่อส่งต่อให้ช่างตรวจสอบหรือส่งกลับไปให้ลูกค้าดูแบบร่างผ่านแช็ต LINE

**API หลังบ้านที่พร้อมใช้งาน 100%:**
* `POST /api/studio/draft` — ส่ง `{ shape, dimensions, stoneColor, basinSku, basinPlacements, edges }` คืน `{ draftKey, resumeUrl, expiresAt }`
* `GET /api/studio/draft/:draftKey` — คืนข้อมูลผังที่บันทึกไว้

**รายละเอียดงานใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:**
1. **เพิ่มปุ่ม `[ 📐 สร้างลิงก์ Studio ]` บนการ์ด Lead:**
   * ในการ์ด Lead ที่มีข้อมูลผังเคาน์เตอร์ (`lead.studioData`)
   * เพิ่มปุ่มมี attribute `data-testid="button-lead-generate-studio-draft"`
   * เมื่อกดปุ่ม:
     - ดึงข้อมูลจาก `lead.studioData` ส่งไปยัง `POST /api/studio/draft`
     - เมื่อได้รับ `resumeUrl` สำเร็จ: แสดง Dialog หรือ Modal พร้อมลิงก์เต็ม และมีปุ่ม `[ 📋 คัดลอกลิงก์ ]` และปุ่ม `[ ↗️ เปิดใน Studio ]`
2. **หากเป็น Lead ที่ไม่มี studioData แต่มีภาพสเก็ตช์ (`sketchUrls`):**
   * แสดงปุ่ม `[ 🖼️ ดูภาพแบบร่าง ]` ลิงก์ไปยังรูปภาพสเก็ตช์ของลูกค้า
3. **Automated Unit Tests ใน `artifacts/knight-basins/test/admin-lead-studio-draft.test.ts` (ใหม่):**
   * ทดสอบว่ามีปุ่มสร้างลิงก์ Studio บน Lead ที่มี studioData
   * ทดสอบการกดปุ่มแล้วเรียก POST /api/studio/draft สำเร็จ
   * ทดสอบการแสดง Dialog ลิงก์และปุ่มเปิด Studio

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - เพิ่มปุ่มสร้างลิงก์ Studio บนการ์ด Lead ที่มี studioData (data-testid="button-lead-generate-studio-draft")
     - เรียก POST /api/studio/draft เพื่อสร้าง draftKey และ resumeUrl
     - แสดง Dialog พร้อมลิงก์ resume และปุ่มคัดลอก/เปิดไปที่ /studio?draft=
  2. สร้าง artifacts/knight-basins/test/admin-lead-studio-draft.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/admin-lead-studio-draft.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้องหน้าร้านสาธารณะ
  - ห้ามลบหรือเขียนทับ studioData เดิมของ Lead
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-lead-studio-draft แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 495 / pass 473 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-lead-studio-draft.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-admin-lead-studio-draft (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
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
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | ปลอดภัยต่อข้อมูล Lead และ studioData เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
