# ใบงาน 41 (ชัย) — ปลดล็อกคำนวณราคาหินลายหินอ่อน 9,500 บ./ตร.ม. ใน 2D Studio ตามพื้นที่จริง

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบุหลักการธุรกิจชัดเจน: ใน 2D Studio คืองานสั่งทำท็อปเคาน์เตอร์พร้อมติดตั้ง 100% (ไม่ได้ซื้อแผ่นดิบไปตัดเอง) ดังนั้น หินทุกเรต (รวมถึงสีลายหินอ่อน/สายแร่ 9,500 บาท/ตร.ม. เช่น `VS311 Shine` ของอ่าง KF001) ต้องคำนวณราคาเป็น ตารางเมตร (กว้าง×ยาว × เรต/ตร.ม.) ตรงไปตรงมา ห้ามเซ็ตราคาเป็น 0 บาท และไม่ต้องเตือนเรื่องแผ่นตัดใน Studio

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  ปลดล็อกการคิดราคาหินลายหินอ่อน/สายแร่ (เรต 9,500 บาท/ตร.ม.) ใน 2D Studio:
  1. ใน studio-model.ts ฟังก์ชัน `studioEstimate`:
     - ให้หินเรต 9,500 บาท/ตร.ม. คำนวณยอดเงิน `stoneTotal` และ `upstandTotal` ตามพื้นที่จริง (พื้นที่ ตร.ม. × เรตราคา) เหมือนหินเรตอื่น
     - ไม่เพิ่มคำเตือน "สีลายหินอ่อนคิดตามแผ่นตัด ทีมขายจะคิดให้" เข้าไปใน warnings
     - คงฟิลด์ `sheetCutPriceWarning: false` ไว้ในผลลัพธ์ StudioEstimate เพื่อไม่ให้กระทบ UI
  2. อัปเดตเทสต์ใน studio-model.test.ts:
     - ปรับเทสต์เดิมที่เคยคาดหวังว่า 9,500 จะได้ 0 บาท ให้ตรวจสอบว่าได้ยอดเงินจริงถูกต้องตามพื้นที่

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/studio-model.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-model.test.ts

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (เป็นของ Replit)
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามลบฟิลด์ sheetCutPriceWarning ออกจาก type StudioEstimate (ให้คืนค่าเป็น false เสมอ)
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-marble-stone-pricing แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 196 / pass 191 / fail 2 / cancelled 3 (fail เฉพาะ 2 ตัวใน *.browser.test.ts)
     ชุดที่ไม่ใช่ browser ต้องผ่าน 191/191 ครบ 100%
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) เทสต์ใน studio-model.test.ts ยืนยัน:
     - เมื่อเลือกหินเรต 9,500 (เช่น BR816O หรือ VS311) ได้ stoneUnitPriceTHB = 9500 และ stoneTotalTHB > 0 คำนวณตามพื้นที่จริงถูกต้อง
     - warnings ไม่มีข้อความเรื่อง "แผ่นตัด"
     - sheetCutPriceWarning เป็น false

OUTPUT:
  - branch: feat/chai-marble-stone-pricing (เปิด PR เข้า main รอตรวจ)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ non-browser ตกแม้แต่ตัวเดียว (ต้องผ่าน 100%)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน src/data/studio-model.ts ฟังก์ชัน studioEstimate:
     - เปลี่ยน:
       `const sheetCutPriceWarning = false;` (หรือคงไว้เป็น false)
       `const stoneTotal = price === null ? 0 : roundBaht(counterArea * price) + roundBaht((upstandArea + backsplashArea) * price);`
       `const upstandTotal = price === null ? 0 : roundBaht(upstandArea * price);`
     - ตัด warning "สีลายหินอ่อนคิดตามแผ่นตัด ทีมขายจะคิดให้" ออกจาก warnings array
  2. ใน test/studio-model.test.ts:
     - ปรับปรุงบล็อกเทสต์ที่บรรทัด ~304:
       เปลี่ยนจากที่เคย assert ว่า 9,500 ได้ stoneTotalTHB = 0 และมี warning แผ่นตัด
       เป็น assert ว่าได้ stoneTotalTHB คำนวณถูกต้องตามพื้นที่จริง และไม่มี warning แผ่นตัด
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปลดล็อกคิดราคาหินเรต 9,500 ตามพื้นที่จริง |
| 2 | GOAL วัดได้ | ✅ stoneTotalTHB > 0 คำนวณตามพื้นที่ + warnings ไม่มีแผ่นตัด |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามลบฟิลด์ใน type |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 196/191/2 + เทสต์ยืนยันตัวเลข |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-marble-stone-pricing |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 196 / pass 191 / fail 2 |
| 9 | CONTRACT ระบุสูตรและบรรทัดจริง | ✅ ระบุโค้ด studioEstimate และตำแหน่งเทสต์ ~304 |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
