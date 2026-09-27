# ใบงาน 137 (Replit) — สร้างหน้ารายการอัปเดตรุ่นระบบและประวัติความก้าวหน้า (/updates What's New & Changelog Page)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Brand & Changelog UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อบันทึกประวัติศาสตร์ความก้าวหน้า นวัตกรรม และความสำเร็จของระบบ **Knight Basins Version 1.0 (Official Launch)** ให้ลูกค้า สถาปนิก คู่ค้า และทีมงานได้เห็นวิวัฒนาการของระบบอย่างโปร่งใสและน่าเชื่อถือ:
1. สร้างหน้าเพจใหม่ที่เส้นทาง `/updates` (`src/pages/UpdatesPage.tsx`) ออกแบบเป็น Timeline สไตล์มินิมอล เรียบหรู เข้ากับธีม Dark/Light Mode
2. เชื่อมโยงเส้นทาง `<Route path="/updates" component={UpdatesPage} />` ใน `src/App.tsx`
3. ในส่วนท้าย Footer (`src/App.tsx`) เพิ่มลิงก์ทางเข้า `✨ บันทึกการอัปเดต (v1.0)` ในแถบ `footer-meta` เคียงข้างลิงก์คลังผลงานและคู่มือเตรียมหน้างาน
4. มีปุ่ม "แชร์หน้านี้ลง LINE" และปุ่ม "คัดลอกลิงก์" พร้อม Toast แจ้งเตือน

**เนื้อหา 3 หมุดหมายสำคัญใน Timeline (Hardcoded ข้อมูลคงที่ ไม่ต้องพึ่งพา backend):**
1. **Version 1.0.0 (Official Launch) — 27 ก.ย. 2569:**
   - หัวข้อ: ระบบออกแบบเคาน์เตอร์และจัดการภาพหน้างานสมบูรณ์แบบ
   - 🎨 2D Studio & Smart Blueprint: ออกแบบทรง I/L/U, เจาะอ่าง 30 รุ่น, หมุนภาพสเก็ตช์ 90° ด้วย Canvas, บันทึกแบบร่างไว้ทำต่อ 30 วัน
   - 🧠 Enterprise AI: Google Cloud Vertex AI Singapore (Latency 0.68s) วิเคราะห์แบบร่าง
   - 📸 คลังภาพหน้างาน: ค้นหาอัจฉริยะ, กรอง 30 วัน/ข้ามปี พ.ศ., ดาวน์โหลด ZIP, ซ่อนภาพแบบ Soft Hide ปลอดภัย
   - ⚙️ หลังบ้านผู้บริหาร: แดชบอร์ดสถานะฐานข้อมูลเรียลไทม์, สำรองข้อมูล Backup Vault, ต้นทุน AI 4 เสาหลัก
2. **Version 0.9.0 (Studio & Edge Revolution) — กลางเดือนกันยายน 2569:**
   - หัวข้อ: ปฏิวัติระบบขอบ 4 สถานะ และคลังภาพผลงานจริง
   - 📐 ขอบเคาน์เตอร์ 4 สถานะ: ติดบัว ▲ · ชิดผนัง ║ · ขอบเปิด ⊗ · ขอบปิด ⊞ พร้อมระยะปลอดภัยรอบหลุม ≥ 100 มม.
   - 🖼️ Portfolio Gallery: คลังภาพผลงานติดตั้งจริง 360 ภาพ แยก 17 หมวดหมู่
   - 📋 คู่มือเตรียมหน้างาน (`/site-prep`): เช็คลิสต์ 5 ด้านพร้อมภาพหน้างานจริง 59 ภาพ
3. **Version 0.1.0 (Foundation) — สิงหาคม 2569:**
   - หัวข้อ: กำเนิด Knight Basins Catalog & Pricing Calculator
   - 💎 แคตตาล็อกอ่างล้างหน้าสำเร็จรูป 30 รุ่น
   - 🏷️ สูตรคำนวณราคาหินสังเคราะห์ตามตารางราคาจริง ไม่หักช่องเจาะ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้างไฟล์ artifacts/knight-basins/src/pages/UpdatesPage.tsx แสดง Timeline อัปเดตรุ่นระบบ
     - มี data-testid="page-updates"
     - แสดงการ์ดทั้ง 3 เวอร์ชัน (v1.0.0, v0.9.0, v0.1.0) พร้อม badge ชัดเจน
     - มีปุ่มแชร์ลง LINE (data-testid="button-share-updates-line") และปุ่มคัดลอกลิงก์ (data-testid="button-copy-updates-link")
  2. แก้ไข artifacts/knight-basins/src/App.tsx:
     - เพิ่ม Route path="/updates" component={UpdatesPage}
     - ใน Footer เพิ่ม <Link href="/updates" className="footer-owner-link" data-testid="link-footer-updates">บันทึกการอัปเดต (v1.0)</Link>
  3. สร้าง artifacts/knight-basins/test/updates-page.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx · (ใหม่)
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/updates-page.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้ Formal Quotation หรือ WorkshopProductionSheet เสียหาย
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-updates-changelog-page แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 562 / pass 541 / fail 21 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/updates-page.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-updates-changelog-page (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
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
| 11 | ข้อมูล Timeline เป็นข้อมูลคงที่ปลอดภัย | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
