# ใบงาน 200-R (Replit) — Storefront /stone Reframing: ท็อปครัว & เคาน์เตอร์สั่งตัด (รวมติดตั้ง) vs ซื้อแผ่นมาตรฐาน

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที
**Branch:** `feat/replit-stone-page-reframing`
**วัตถุประสงค์:** ปรับข้อความการตลาด, Hero Section, และป้ายปุ่มสลับโหมดในหน้า `/stone` (`App.tsx`) ให้สะท้อนความต้องการของลูกค้าจริง: แบ่งชัดระหว่างกลุ่มเจ้าของบ้าน B2C 70% (สั่งทำท็อปครัว/เคาน์เตอร์รวมติดตั้ง) กับกลุ่มช่าง B2B 30% (ซื้อแผ่นมาตรฐาน) โดยคงสูตรราคาและฟังก์ชันการทำงานเดิม 100%

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/App.tsx ในคอมโพเนนต์ StonePage ปรับข้อความ Hero Section:
     - หัวข้อ: "ท็อปครัว & เคาน์เตอร์หินสังเคราะห์" / "สั่งตัดตามพื้นที่ของคุณ"
     - คำบรรยาย: "สั่งทำท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์แท้ 100% ไร้รอยต่อ พร้อมบริการวัดหน้างานและติดตั้ง หรือเลือกซื้อแผ่นมาตรฐานสำหรับช่างและโรงงาน"
  2. ปรับข้อความปุ่มสลับโหมด (Step 01 CHOOSE FORMAT) ใน StonePage:
     - ปุ่มโหมด installed (ปุ่มตัดและติดตั้ง): 
       * ป้ายหลัก: "สั่งทำท็อปครัว / เคาน์เตอร์ (รวมติดตั้ง)"
       * คำบรรยายย่อย: "ราคาต่อ ตร.ม. พร้อมติดตั้งและวัดหน้างาน"
     - ปุ่มโหมด whole-sheet (ปุ่มแผ่นเต็ม): 
       * ป้ายหลัก: "ซื้อแผ่นหินมาตรฐาน (สำหรับช่าง/โรงงาน)"
       * คำบรรยายย่อย: "ราคาขายส่งต่อแผ่น ขนาด 0.76 × 3.60 ม."
  3. เพิ่มแบนเนอร์จุดเด่นท็อปครัวหินสังเคราะห์ 3 ข้อ (Food Grade สัมผัสอาหารปลอดภัย, ไร้รอยต่อไม่ซึมคราบ, ขัดเคลือบใหม่ได้ตลอดอายุการใช้งาน) ไว้ด้านล่างส่วนเลือกสีหิน
  4. ปรับ RouteMeta ใน artifacts/knight-basins/src/components/RouteMeta.logic.ts สำหรับ path "/stone":
     - title: "ท็อปครัว & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ | Knight Furnich"
     - description: "สั่งทำท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์แท้ ไร้รอยต่อ หรือซื้อแผ่นดิบมาตรฐาน คำนวณราคาตามขนาดจริง พร้อมบริการติดตั้ง"
  5. เพิ่ม Static Test ใน artifacts/knight-basins/test/stone-page-reframing.test.ts ตรวจสอบข้อความใหม่ทั้งหมด

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/components/RouteMeta.logic.ts
  - artifacts/knight-basins/test/stone-page-reframing.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ inline style หรือคลาส CSS เดิม เช่น .hero-copy, .section-heading, .mode-switch ที่มีอยู่แล้ว)
  - ห้ามแตะต้องสูตรราคาและฟังก์ชันการคำนวณเงินใน stoneAreaSqM, stoneUnitPrice, หรือ toggleColor เด็ดขาด
  - ห้ามเปลี่ยน test-id เดิม (button-stone-installed, button-stone-whole-sheet ต้องคงอยู่)
  - ทำงานผ่าน branch: feat/replit-stone-page-reframing แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-stone-page-reframing ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/stone-page-reframing.test.ts ใน artifacts/knight-basins → ผ่านครบทุกข้อ
  4) npm test ใน artifacts/knight-basins (non-browser suite)
     baseline อ้างอิง: tests 662 / pass 661 / fail 0 / todo 1 (สำหรับ non-browser suite)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/components/RouteMeta.logic.ts
  - artifacts/knight-basins/test/stone-page-reframing.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ใหม่ผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุเป้าหมายปรับ Hero, ป้ายโหมด, แบนเนอร์ 3 ข้อ, Meta |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามแตะสูตรราคา, บังคับ GitHub Connection |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่ง tsc, node test, npm test baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ 3 ไฟล์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 30 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path ของเครื่องเซิร์ฟเวอร์ |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดข้อบังคับครบถ้วน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/replit-stone-page-reframing |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | 662 tests / 0 failures |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |
