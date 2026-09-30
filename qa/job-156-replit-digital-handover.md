# ใบงาน 156 (Replit) — หน้าใบส่งมอบงานและรับประกันเคาน์เตอร์หินสังเคราะห์ดิจิทัล (/handover Digital Handover & Warranty Sheet UI)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Customer Care & Handover UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อปิดวงจรธุรกิจงานติดตั้งเคาน์เตอร์หินสังเคราะห์ให้สมบูรณ์แบบระดับ 5 ดาว และลดข้อพิพาทหลังการติดตั้ง:
เมื่อช่างติดตั้งเสร็จสิ้น ลูกค้าควรได้รับ **"ใบส่งมอบงานและรับประกันคุณภาพดิจิทัล (Digital Handover & Warranty Sheet)"** ที่ดูเป็นมืออาชีพ มีรูปหน้างานส่งมอบจริง และมีข้อแนะนำการดูแลรักษาหินสังเคราะห์
งานนี้คือการสร้าง:
1. หน้าเพจใหม่สำหรับลูกค้า/พิมพ์เอกสาร ที่เส้นทาง `/handover` (`src/pages/DigitalHandoverPage.tsx`):
   - เข้าถึงผ่าน Token: `/handover?token=<publicQuoteToken>`
   - ดึงข้อมูลจาก API `GET /api/public/track?token=...` (ซึ่งมีข้อมูลโครงการ, สเปกหิน, และรูปถ่ายหน้างานส่งมอบอยู่แล้ว)
2. องค์ประกอบบนหน้าใบส่งมอบงาน (`data-testid="page-digital-handover"`):
   - 🏷️ **หัวเอกสารทางการ:** โลโก้ ไนท์ เฟอร์นิช (สำนักงานใหญ่/โรงงาน), เลขที่ใบส่งมอบ/รับประกัน, วันที่ส่งมอบ
   - 👤 **ข้อมูลลูกค้าและโครงการ:** ชื่อลูกค้า, สถานที่ติดตั้ง, เบอร์ติดต่อ (mask)
   - 💎 **สเปกงานที่ส่งมอบ:** ชนิดหิน, รหัสสี, รุ่นอ่างล้างหน้า, ขนาดเคาน์เตอร์
   - 📸 **ภาพถ่ายหน้างานจริงหลังติดตั้งเสร็จ (Completion Photos):** แสดงแกลเลอรีรูปถ่ายผลงานจริงที่ช่างส่งมอบ
   - 🛡️ **เงื่อนไขการรับประกันมาตรฐาน ไนท์ เฟอร์นิช:**
     * รับประกันงานประกอบและติดตั้ง 1 ปี
     * รับประกันเนื้อหินสังเคราะห์ตามมาตรฐานผู้ผลิต
   - 🧼 **คำแนะนำการดูแลรักษาหินสังเคราะห์ (Care & Maintenance Guide):**
     * การทำความสะอาดประจำวันด้วยน้ำสบู่หรือน้ำยาล้างจานอ่อนๆ
     * หลีกเลี่ยงการวางหม้อหรือภาชนะร้อนจัดสัมผัสหินโดยตรง
     * หลีกเลี่ยงสารเคมีกรด-ด่างรุนแรง
   - 🖨️ **ปุ่มพิมพ์เอกสาร:** `data-testid="button-print-handover"` สั่ง `window.print()` (จัด CSS `@media print` ให้พิมพ์ออกมาสวยงามพอดีหน้า A4)
   - 📲 **ปุ่มแชร์ลง LINE ลูกค้า:** `data-testid="button-share-handover-line"`
3. ในหน้าจัดการ Lead (`/admin/leads`):
   * บนแถว Lead ที่มี `publicQuoteToken` เพิ่มปุ่ม:
     `<Button data-testid={`button-open-handover-${lead.id}`}>📄 ใบส่งมอบงาน</Button>`
     เปิดไปยัง `/handover?token=...`
4. ⚠️ **กฎเหล็กเพื่อความปลอดภัยสูงสุด:**
   * **ห้ามแตะต้องไฟล์ `src/components/WorkshopProductionSheet.tsx` เด็ดขาด** (ไฟล์สงวนโดยบอส)
   * โค้ดทั้งหมดต้องเป็นคอมโพเนนต์ใหม่แยกต่างหาก

**สิ่งที่ต้องทำ:**
1. สร้าง `artifacts/knight-basins/src/pages/DigitalHandoverPage.tsx` (ใหม่)
2. แก้ไข `artifacts/knight-basins/src/App.tsx` เพื่อลงทะเบียน Route:
   `<Route path="/handover" component={DigitalHandoverPage} />`
3. แก้ไข `artifacts/knight-basins/src/admin/LeadsManager.tsx` เพิ่มปุ่มเปิดใบส่งมอบงาน
4. สร้าง Unit Tests ใน `artifacts/knight-basins/test/digital-handover.test.ts` (ใหม่)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/pages/DigitalHandoverPage.tsx:
     - หน้าใบส่งมอบงานและรับประกัน (data-testid="page-digital-handover")
     - แสดงสเปกหิน, ภาพถ่ายหน้างานส่งมอบ, เงื่อนไขรับประกัน 1 ปี, คำแนะนำดูแลรักษา
     - ปุ่มสั่งพิมพ์ (data-testid="button-print-handover") และปุ่มแชร์ LINE (data-testid="button-share-handover-line")
  2. แก้ไข artifacts/knight-basins/src/App.tsx เพิ่ม Route path="/handover"
  3. แก้ไข artifacts/knight-basins/src/admin/LeadsManager.tsx เพิ่มปุ่มเปิดใบส่งมอบงาน (data-testid={`button-open-handover-${lead.id}`})
  4. สร้าง artifacts/knight-basins/test/digital-handover.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/pages/DigitalHandoverPage.tsx · (ใหม่)
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/test/digital-handover.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-digital-handover แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 609 / pass 588 / fail 0 / skipped 21 (หลัง Task 154)
  4) เทสต์ใหม่ใน test/digital-handover.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-digital-handover (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ปกป้องไฟล์สงวน WorkshopProductionSheet.tsx 100% | ✅ ผ่าน |
| 11 | อนุรักษ์เงื่อนไขรับประกันและวิธีดูแลรักษาหิน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
