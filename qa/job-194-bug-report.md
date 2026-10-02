# ใบงาน 194-R — รายงาน Bug Hunt และ Visual QA

**วันที่ตรวจ:** 3 ตุลาคม 2026  
**ฐาน source:** GitHub `main` ณ `ad5c6396b6fc5f8dbef9abc9cf471a86f7e8006b`  
**ขอบเขต:** `/studio`, `/stone`, `/quote/view` และการพิมพ์ใบเสนอราคา A4  
**ข้อจำกัด:** ตรวจ source และ preview เท่านั้น ไม่แก้ UI/business logic, ไม่แก้ `src/index.css`, และไม่เขียนข้อมูล Production

## สรุป

| ระดับ | จำนวน | สรุป |
|---|---:|---|
| P1 | 0 | ไม่พบข้อบกพร่องร้ายแรงที่ยืนยันได้ |
| P2 | 2 | รูปหินหายจากใบเสนอราคาที่สร้างจาก Studio; modal รูปภาพไม่มีการจัดการ focus สำหรับคีย์บอร์ด |
| P3 | 1 | ป้ายยอดสุทธิใน PDF A4 แบบ US ถูกตัดขึ้นบรรทัดใหม่ |

## P2 — รูปหินจาก Studio หายบนใบเสนอราคาและเอกสารพิมพ์

**หน้าที่ได้รับผลกระทบ:** `/quote/view`, Print A4 — ใบเสนอราคาที่สร้างจาก `/studio`  
**หลักฐาน source:**

- `artifacts/knight-basins/src/components/StudioPage.tsx:147–165, 4499–4521` — notification item รองรับ `imageUrl` และ Studio ส่ง URL รูปหินจาก `safeActiveStone` ไปกับ notification
- `artifacts/knight-basins/src/App.tsx:1271–1287` — เมื่อเปิด saved quote, `saved.notification.items` ถูก map เป็น `FormalQuoteItem` แต่ไม่ได้คัดลอก `imageUrl`
- `artifacts/knight-basins/src/App.tsx:792–802` — renderer แสดง thumbnail เฉพาะเมื่อ `item.imageUrl` มีค่า
- `artifacts/knight-basins/src/index.css:3138–3199` — Print A4 ใช้ตาราง formal quote เดียวกัน จึงได้รับผลจากภาพที่หายเช่นกัน

**ผลกระทบ:** ใบเสนอราคาจาก Studio ที่บันทึก notification จะแสดงรายการหินและราคา แต่ไม่มี thumbnail ทั้งบนหน้า `/quote/view` และเอกสารพิมพ์ ทำให้ลูกค้ายืนยันสีหินจากเอกสารได้ยากขึ้น กระทบทั้งรูปแบบ US และ OF

**แนวทางแก้ที่เสนอ:** เพิ่ม `imageUrl: item.imageUrl` ใน mapping ของ saved notification ไปยัง `FormalQuoteItem` แล้วตรวจทั้งหน้า US/OF และ PDF ว่ารูปแสดงครบ โดยไม่เปลี่ยนสูตรราคา

**สถานะเทสต์:** เพิ่ม static-source regression test เป็น `TODO` เพื่อบันทึกเงื่อนไขที่ต้องผ่านหลังได้รับอนุมัติแก้ไข logic

## P2 — Modal ดูภาพเต็มแผ่นไม่จัดการ keyboard focus

**หน้าที่ได้รับผลกระทบ:** ปุ่มดูภาพเต็มแผ่นใน `/studio` และ `/stone`  
**หลักฐาน source:** `artifacts/knight-basins/src/components/StoneSlabViewer.tsx:86–114`

**ผลกระทบ:** Modal ใช้ `role="dialog"` และ `aria-modal="true"` และรองรับ Escape/ลูกศร แต่ไม่ได้ย้าย focus เข้า dialog, จำกัด Tab/Shift+Tab ให้อยู่ภายใน modal หรือคืน focus ไปยังปุ่มเปิดเมื่อปิด ผู้ใช้คีย์บอร์ดและ screen reader จึงอาจยังอยู่ที่เนื้อหาด้านหลัง แม้ถูกประกาศว่าเป็น modal

**แนวทางแก้ที่เสนอ:** เก็บปุ่มเปิดไว้เป็น focus target, โฟกัสปุ่มปิดหลังเปิด, จัดการ Tab/Shift+Tab ให้วนภายใน dialog และคืน focus เมื่อปิด พร้อมทดสอบเปิด/ปิดด้วยคีย์บอร์ด

**สถานะเทสต์:** เพิ่ม static-source regression test เป็น `TODO` เพื่อรอการแก้ไขที่ได้รับอนุมัติ

## P3 — ป้าย “จำนวนเงินสุทธิ” ถูกตัดเป็นสองบรรทัดใน PDF A4

**หน้าที่ได้รับผลกระทบ:** `/quote/view`, Print A4 รูปแบบ US  
**หลักฐาน:** browser test สร้าง PDF จริงและ `pdftotext` อ่าน label ออกเป็น `จำนวน` ตามด้วย `เงินสุทธิ` คนละบรรทัด; `artifacts/knight-basins/src/index.css:3216–3219` กำหนด summary sidebar ไว้ 27% ของหน้า และแบ่ง label ให้เพียง 33.3333% ของ sidebar

**ผลกระทบ:** ข้อมูลยังอยู่ครบและไม่ล้นหน้ากระดาษ แต่ป้ายยอดสุทธิถูกบีบจนอ่านต่อเนื่องยาก และ assertion ปัจจุบันที่ค้นหาข้อความติดกันใน `test/quote-print.browser.test.ts:377` ล้มเหลวกับ PDF นี้

**แนวทางแก้ที่เสนอ:** ปรับสัดส่วนพื้นที่ label/ยอดเงินใน print layout ให้ label อ่านได้ชัดโดยไม่ทำให้จำนวนเงินล้น แล้วให้ browser assertion normalize whitespace หรือทดสอบทั้งข้อความข้ามบรรทัด

## ผลตรวจส่วนอื่น

- **`/studio`:** preview desktop โหลดได้; ปุ่ม “ดูลายแผ่นจริง” ถูกแสดงเมื่อหินมี `slabImageUrl` และรายการรูปไม่ว่าง (`StudioPage.tsx:2065–2086, 2129–2138`). มี unit tests ที่ตรวจพื้นที่และราคาหินใน `studio-model.test.ts`; ไม่พบ NaN/Infinity ที่ยืนยันได้จากการตรวจ source
- **`/stone`:** preview desktop โหลดรายการหินและตัวกรองได้; ปุ่มดูภาพเต็มแผ่นถูกสร้างเฉพาะเมื่อมี `slabImageUrl` (`App.tsx:727–746`). การค้นหาใช้การเปรียบเทียบตัวพิมพ์เล็กทั้งหมด (`App.tsx:646–647`) จึงไม่แยกตัวพิมพ์เล็ก/ใหญ่
- **ธีม:** ตรวจ CSS ของ light/dark และภาพ preview light แล้ว ไม่พบปัญหาสีที่ยืนยันได้จากการตรวจนี้; ยังไม่ได้วัดค่า contrast ตาม WCAG
- **Print A4:** มี browser coverage เดิมสำหรับหลายรายการ, ตารางหลายหน้า, ข้อความเอกสาร และการตั้งค่าพิมพ์ใน `test/quote-print.browser.test.ts`; finding เรื่องรูปหายข้างต้นยังต้องทดสอบซ้ำหลังแก้ไข
- **Browser console:** ภาพ preview `/studio` และ `/stone` มีเฉพาะข้อความเชื่อมต่อ Vite และคำแนะนำ React DevTools; ไม่พบ error ในสองภาพที่ตรวจ

## ข้อจำกัดการตรวจ

ภาพ preview เป็นการตรวจแบบไม่โต้ตอบ; ไม่ได้ทดสอบทุกปุ่ม/ทุกขนาดจอหรือวัด contrast เชิงตัวเลข การตรวจ source อ้างอิง GitHub `main` ล่าสุด เนื่องจากไฟล์ `App.tsx` และ `StudioPage.tsx` ใน workspace มีความต่างจาก source บน `main`

## ผลการตรวจคำสั่ง

- `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` — ผ่าน, 0 errors
- Non-browser tests ใน workspace — 653 tests, 650 pass, 0 fail, 3 TODO (เป็น regression tests ของข้อบกพร่องที่รายงาน)
- Workspace ไม่มี non-browser test files 5 ไฟล์ที่มีอยู่บน `main`; จึงเทียบ baseline 659 tests / 659 pass ในใบงานจาก workspace นี้ไม่ได้
- Browser test `keeps every basin and stone row readable on mobile and across print pages` — ล้มเหลวเฉพาะ assertion ที่คาดว่า “จำนวนเงินสุทธิ” จะไม่มีการขึ้นบรรทัดใหม่; PDF มีข้อความครบแต่ตัด label เป็นสองบรรทัดตาม P3 ข้างต้น