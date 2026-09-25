# ใบงาน 28 (Replit) — หน้าลูกค้าทุกหน้าใช้สเกลตัวอักษรมาตรฐานเดียวกับหน้า Studio

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการเจ้าของ (คำต่อคำ):** "เคยบอกไปให้แก้แล้วทำไมยังต้องแก้ซ้ำอีก ครั้งนี้เดวิดดูให้ละเอียด ให้ครบทุกเมนู อย่างละเอียด" · "หน้านี้ขนาดตัวหนังสือไม่เท่ากับขนาดตัวหนังสือมาตรฐานอยู่" (ชี้หน้า `/sketch`)

ส่งเป็นสตริงเดียวให้ Replit

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch — ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  ทำให้หน้าลูกค้าทุกหน้าใช้ "สเกลตัวอักษรมาตรฐาน" เดียวกันกับหน้า /studio โหมดง่าย
  ซึ่งเจ้าของตั้งเป็นต้นแบบ เกณฑ์วัด: ทุกหน้าต้องไม่มีข้อความที่คำนวณได้ต่ำกว่า 12px
  และข้อความหลัก (เนื้อหา/label/ปุ่ม/ช่องกรอก/eyebrow/รหัสสินค้า) ต้องเป็น 14px

  ต้นเหตุที่ตรวจพบ (หลักฐานจริงจาก production 24 ก.ย. 69):
  - หน้า /studio โหมดง่าย มีกฎบังคับใน index.css บรรทัด ~1824-1827:
      .studio-page--simple { --studio-simple-copy-size: max(var(--type-size-body), .8125rem); }
      .studio-page--simple :is(p, label, small, button, input, select, textarea, span, strong, li, code, ...) {
        font-size: var(--studio-simple-copy-size) !important; }
    -> 14px ทั้งหน้า จึงอ่านออก
  - หน้าอื่นไม่มีกฎนี้ จึงยังใช้ค่าเดิมจาก index.css:
      .eyebrow { font: 10px var(--mono); }            (index.css ~529)
      .studio-stone-choice strong { font: 700 10px var(--mono); }  (index.css ~1853)
      .stone-colors button small { font: 9px var(--mono); } ฯลฯ
  - วัดจริงบน production (computed style):
      /studio  -> eyebrow 14px · ปุ่ม 14px · รหัสหิน 14px · ชื่อหิน 14px   (ต้นแบบ)
      /sketch  -> eyebrow 10px · ปุ่ม 10px · รหัสหิน 10px · ชื่อหิน 9px    (ผิด)

SCOPE (path สัมพัทธ์จาก root repo — ห้ามใส่ absolute path):
  1. artifacts/knight-basins/src/index.css            (งานหลักของใบนี้)
  2. artifacts/knight-basins/src/components/StudioPage.tsx   (เฉพาะส่วนโหมด sketch — ดู CONTRACT ข้อ 5)
  3. artifacts/knight-basins/src/components/SalesGuide.tsx   (หน้า /readme)
  4. artifacts/knight-basins/src/App.tsx              (หน้า /quote · /quote/view — เฉพาะสเกลตัวอักษร)
  5. artifacts/knight-basins/src/components/CustomerProfilePage.tsx
  6. artifacts/knight-basins/src/components/WorksiteAddressAutocomplete.tsx

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ CSS การพิมพ์ใบเสนอราคา: ทุกอย่างใน @media print และทุก selector ที่ขึ้นต้น .formal-
    (ตาราง/CSS นี้ปรับแต่งเสร็จแล้วและเจ้าของสั่งห้ามแก้)
  - ห้ามแตะ .workbench* .workshop* .sig-box (ใบสั่งผลิตของช่าง)
  - ห้ามแตะไฟล์ src/admin/** (เป็นของชัย ใบงาน 29) — ถ้าจำเป็นให้หยุดแล้วรายงาน
  - ห้ามแตะ src/data/studio-model.ts · src/data/catalog.ts · generated/ · lib/**
  - ห้ามใช้ !important แบบเหวี่ยงทั้งหน้าเพิ่มกฎใหม่ทับหัวข้อ (ห้ามทับ h1/h2/h3)
  - ห้ามแตะตรรกะราคา การคำนวณ หรือ layout/สี — ใบนี้แก้ "ขนาดตัวอักษร" เท่านั้น
  - ห้าม push เข้า main ตรง ๆ — สร้าง branch แล้วเปิด PR เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ):
  1) git branch --show-current  (ต้องไม่ใช่ main) + git log --oneline -1
  2) cd artifacts/knight-basins && npm run typecheck     -> 0 errors
  3) cd artifacts/knight-basins && npm test
     เกณฑ์ผ่าน: ต้องไม่มี fail นอกไฟล์ *.browser.test.ts
     baseline อ้างอิง (วัดเองบน main ก่อนเริ่ม 24 ก.ย. 69): tests 189 / pass 185 / fail 2
     และเฉพาะไฟล์ที่ไม่ใช่ browser: 50 / 50 / 0
  4) วัดขนาดจริงหลังแก้ (ต้องแนบตัวเลข ไม่ใช่คำรับรอง) — เปิด dev/preview แล้วรันใน console:
       const bad = [...document.querySelectorAll('main *')].filter(e => !e.children.length
                 && e.innerText.trim() && parseFloat(getComputedStyle(e).fontSize) < 12);
       bad.length   // ต้องได้ 0
     ทำครบทุกหน้า: /  /stone  /quote  /quote/view  /readme  /sketch  /profile
     แนบผลเป็นตัวเลขต่อหน้า เช่น "/ 0 · /stone 0 · /quote 0 · /quote/view 0 · /readme 0 · /sketch 0 · /profile 0"
  5) ตรวจว่าข้อความหลักเป็น 14px จริง — สำหรับหน้า /sketch ต้องได้:
       getComputedStyle(document.querySelector('.studio-hero .eyebrow')).fontSize      === "14px"
       getComputedStyle(document.querySelector('.studio-panel button')).fontSize        === "14px"
       getComputedStyle(document.querySelector('.studio-stone-choice strong')).fontSize === "14px"
  6) ยืนยันว่าไม่แตะของต้องห้าม: git diff --stat ต้องไม่แสดงบรรทัดใน @media print / .formal- / .workbench / .workshop / .sig-box
     แนบผล: git diff -U0 <ไฟล์ที่แก้> | grep -cE '^\+\s*font.*' และยืนยันด้วยข้อความว่าไม่มีบรรทัดที่แตะของต้องห้าม
  7) ภาพหน้าจอ 2 ภาพ: /sketch (ก่อน/หลัง) ที่เห็นขนาดตัวอักษรต่างกันชัด

OUTPUT:
  - branch: feat/replit-type-scale-standard  (เปิด PR เข้า main รอตรวจ)
  - ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 7 ข้อ (แนบตัวเลข + ภาพ)

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าวัดแล้วหน้าใดใน 7 หน้ายังมีจุดต่ำกว่า 12px แม้แต่ 1 จุด -> หยุด รายงานหน้าที่ยังเหลือ
  - ถ้าเทสต์ที่ล้มไม่ใช่ไฟล์ *.browser.test.ts -> หยุด (เพดานผ่าน = 0 fail นอกไฟล์นั้น)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เพื่อให้ผ่าน -> หยุด รายงาน (ห้าม workaround)
  - ถ้าพบว่าต้องแก้ @media print หรือ .formal- เพื่อให้ผ่าน -> หยุด รายงาน (ห้ามแตะ)

CONTRACT (สเกลมาตรฐาน — ต้องได้ตามนี้ ไม่ใช่ตีความเอง):
  ระดับ                        ขนาดเป้าหมาย            ใช้กับ
  1 hero (h1)                  clamp(30px, …, 44px)    หัวเรื่องหน้า (ใช้ token --type-size-hero เดิม)
  2 heading-lg (h2)            18–21px                 หัวข้อบล็อก (token --type-size-heading-lg)
  3 heading-md (h3)            16px                    หัวข้อการ์ด/พาเนล (token --type-size-heading-md)
  4 body  ★ มาตรฐานหลัก        14px                    เนื้อหา · label · ช่องกรอก · ปุ่ม · eyebrow ·
                                                       รหัสสินค้า/รหัสสี · ชื่อสินค้า · เซลล์ตารางบนจอ
                                                       (ใช้ var(--type-size-body))
  5 caption                   12px                    คำอธิบายรอง · หมายเหตุใต้ภาพ · hint
                                                       (ใช้ var(--type-size-caption) = 11px -> ยกเป็น 12px)
  ห้ามต่ำกว่า 12px ทุกกรณี (ยกเว้นของต้องห้ามข้างบน)

  ข้อ 5 — ส่วนโหมด sketch ใน StudioPage.tsx:
    หน้า /sketch ใช้ StudioPage.tsx ตัวเดียวกับ /studio (แยกด้วย mode)
    โหมดง่ายหายเพราะเงื่อนไขคือ isSimpleStudioMode = mode === "studio" && studioUiMode === "simple"
    -> ห้ามแก้ StudioPage.tsx ให้ /sketch กลายเป็นโหมดง่าย
    -> ให้แก้ที่ CSS: สเกลตัวอักษรต้องถูกต้องทั้ง 2 โหมด (studio + sketch)
  ข้อ 6 — วิธีแก้ที่แนะนำ (เลือกได้ แต่ต้องได้ผลตามเกณฑ์):
    ก) แก้ค่า font-size ของ selector พื้นฐานใน index.css ให้เป็น token (var(--type-size-body) ฯลฯ)
    ข) หรือขยายขอบเขตกฎบังคับแบบเดียวกับ .studio-page--simple ให้คลุมทุกหน้า
       (ต้องไม่ทับ h1/h2/h3 และต้องไม่แตะของต้องห้าม)
  ข้อ 7 — <small> ของเบราว์เซอร์คิด 80% ของ parent (14px -> 11.2px · 12px -> 9.6px)
    ต้องมีกฎกันไว้ เช่น small { font-size: max(12px, .8em); } ที่ specificity ต่ำสุด
  ข้อ 8 — Tailwind arbitrary size: ห้ามเหลือ text-[Npx] ที่ N < 12 ในไฟล์ตาม SCOPE
    (ปัจจุบันมีใน SalesGuide.tsx 3 จุด · WorksiteAddressAutocomplete.tsx 3 จุด)

หมายเหตุการทำงาน:
  - branch fix/david-type-scale-all-pages บน origin มีงานยกพื้น 12px ไว้แล้วบางส่วน
    ถ้าใช้เป็นฐานได้ให้ใช้ แต่ไม่บังคับ — เกณฑ์ตัดสินคือตัวเลขใน EVIDENCE ไม่ใช่การอ้างว่าเคยทำ
  - ข้อความไทยห้ามประกอบด้วย chr()/escape — เขียนเป็นไฟล์ UTF-8 เท่านั้น
  - งานนี้แก้ "ขนาดตัวอักษร" เท่านั้น ห้ามเปลี่ยน layout สี หรือตรรกะราคา
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว ไม่ชนกับใบอื่น | ✅ ชนกับใบ 29 เฉพาะ `src/admin/**` — แยกไฟล์ชัด (ห้ามแตะ) |
| 2 | GOAL วัดได้ | ✅ ตัวเลข: 0 จุดต่ำกว่า 12px · ข้อความหลัก 14px |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 6 ไฟล์ · path สัมพัทธ์จาก root repo |
| 4 | FORBIDDEN ชัด | ✅ 6 ข้อ รวม CSS พิมพ์ห้ามแตะ |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข ไม่ใช่คำรับรอง | ✅ 7 ข้อ มีสคริปต์วัด + baseline 189/185/2 |
| 6 | OUTPUT ชัด (branch + ไฟล์ + หลักฐาน) | ✅ `feat/replit-type-scale-standard` + PR |
| 7 | STOP วัดได้ | ✅ 4 เงื่อนไข เป็นตัวเลข |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ 189/185/2 + 50/50/0 + ตัวเลข per-page |
| 9 | CONTRACT ระบุบรรทัดจริง | ✅ index.css ~529, ~1824-1827, ~1853 |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มี EVIDENCE ที่ขัด FORBIDDEN |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ ระบุในหมายเหตุ |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ 0 absolute path |
