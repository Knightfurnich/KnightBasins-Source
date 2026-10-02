# ใบงาน 191 (Replit / ชัย) — แสดงรูปภาพหินสังเคราะห์ในใบเสนอราคาอย่างเป็นทางการ (Formal Quotation)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit / ชัย (Frontend) · คิวถัดไปต่อจาก Job 190

**ที่มาและความต้องการ:**
ในเอกสารใบเสนอราคาอย่างเป็นทางการ (Formal Quotation ทั้งแบบ US และ OF ที่พิมพ์ A4/PDF):
ปัจจุบัน รายการอ่างล้างหน้ามีรูป Thumbnail ประกอบสวยงาม (`imageUrl: product.quoteImageUrl`) แต่ในรายการของ **หินสังเคราะห์ (ทั้งจากหน้า /stone และจาก 2D Studio)** ยังไม่มีการส่งฟิลด์ `imageUrl` เข้าไปในออบเจกต์รายการ `formalItems`
ส่งผลให้ช่องรูปภาพข้างชื่อหินว่างเปล่า

ใบงานนี้คือการนำภาพ `quoteImageUrl` (หรือ fallback เป็น `imageUrl`) ของหินสังเคราะห์ที่เลือก ส่งเข้าสู่ `formalItems` ทั้งสองจุด เพื่อให้คอมโพเนนต์ `FormalItemDescription` นำไปเรนเดอร์เป็นภาพตัวอย่างข้างชื่อรายการสินค้าโดยอัตโนมัติ

**รายละเอียดสิ่งที่ต้องทำ (2 ไฟล์):**
1. `artifacts/knight-basins/src/App.tsx`
   - จุดที่ 1 (รายการหินที่มาจาก 2D Studio บรรทัด ~1220):
     - ในการสร้าง `formalItems.push({ code: activeStone.code, ... })`
     - เพิ่มฟิลด์ `imageUrl: activeStone.quoteImageUrl ?? activeStone.imageUrl`
   - จุดที่ 2 (รายการหินที่มาจากหน้า /stone ในตะกร้า บรรทัด ~1455):
     - ในการสร้าง `formalItems.push({ code: selectedStone.code, ... })`
     - เพิ่มฟิลด์ `imageUrl: selectedStone.quoteImageUrl ?? selectedStone.imageUrl`
   - กฎเหล็ก: ห้ามแก้ไข layout ตาราง, header, footer, หรือ CSS ของ Formal Quotation เด็ดขาด (ส่งเฉพาะฟิลด์ข้อมูล `imageUrl` ให้ระบบเดิมเรนเดอร์ผ่าน `FormalItemDescription` เท่านั้น)
2. เพิ่มเทสต์ `artifacts/knight-basins/test/formal-quote-stone-image.test.ts`
   - ใช้ Static Source Inspection (`fs.readFileSync` + `assert.match`)
   - ตรวจว่าใน `App.tsx` จุดสร้าง formal item ของ stone ทั้งสองจุด (Studio และ Storefront) มีการแนบฟิลด์ `imageUrl` ที่อ้างอิง `quoteImageUrl ?? imageUrl` ของหิน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มฟิลด์ imageUrl (quoteImageUrl ?? imageUrl) ใน formalItems ของหินสังเคราะห์จาก 2D Studio ใน App.tsx
  2. เพิ่มฟิลด์ imageUrl (quoteImageUrl ?? imageUrl) ใน formalItems ของหินสังเคราะห์จากหน้า /stone ใน App.tsx
  3. เพิ่ม Unit Test static source inspection ใน test/formal-quote-stone-image.test.ts

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/formal-quote-stone-image.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็ก: ห้ามแตะต้อง src/index.css เด็ดขาด (ต้องได้ 0 diff)
  - ห้ามแตะต้องหรือแก้ไขโค้ด Print Layout, ตาราง และ CSS ของ Formal Quotation (แก้เฉพาะบรรทัดที่ push formalItems เข้า array เท่านั้น)
  - ห้ามแก้สูตรคำนวณราคาหิน ยอดรวม หรือ VAT
  - ทำงานผ่าน branch: feat/formal-quote-stone-image แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/formal-quote-stone-image ชัดเจน
  2) pnpm run typecheck → 0 errors
  3) git diff --stat src/index.css → 0 diff (ต้องไม่แตะเลย)
  4) node --test test/formal-quote-stone-image.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 644 / pass 644 / fail 0 (ชุด non-browser เท่านั้น ไม่ต้องรัน browser suite)

OUTPUT:
  - branch: feat/formal-quote-stone-image (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้า src/index.css มี diff เกิน 0 บรรทัด
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าแก้ไข layout ตารางหรือ styling ของใบเสนอราคา
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
| 7 | SCOPE ใช้ path สัมพัทธ์ตามมาตรฐาน Replit | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง อย่างเคร่งครัด | ✅ ผ่าน |
| 11 | ป้องกัน Print Layout ตารางและ CSS ของ Formal Quotation | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
