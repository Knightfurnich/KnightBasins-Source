# ใบงาน 38 (Replit) — แสดงภาพอ่าง Top View เสมือนจริง + ท็อปเปลี่ยนสีตามหิน + ปุ่ม 2 ทางบนการ์ดอ่าง

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของระบุว่าลูกค้าส่วนใหญ่เลือกอ่างก่อนแล้วสั่งทำท็อปเคาน์เตอร์เพื่อความสวยงาม: (1) ปรับการแสดงอ่างบนผัง Studio จากกล่องสี่เหลี่ยม wireframe ให้เป็นภาพ Top View เสมือนจริง (มีขอบอ่าง หลุมอ่าง และสะดืออ่าง) (2) ผังท็อปเคาน์เตอร์ต้องเปลี่ยนสี/ลายตามสีหินที่เลือกจริง (3) บนการ์ดอ่างในแคตตาล็อกหน้าแรก แยกปุ่มชัดเจน 2 ทาง: [ซื้อเฉพาะอ่าง] และ [สั่งทำพร้อมท็อปเคาน์เตอร์]

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  ยกระดับประสบการณ์การสั่งซื้ออ่างและเคาน์เตอร์ (Core Sales Experience):
  1. ใน StudioPage.tsx: ปรับตัวแสดงตำแหน่งอ่าง (StudioPlacement และ StudioPlacementPreview)
     ให้วาดเป็น Top View เสมือนจริง:
     - รุ่นกลม (มี Ø ในขนาด): วาดวงกลม มีขอบอ่าง (Rim), หลุมอ่าง (Bowl) ไล่เงาความลึก, และสะดืออ่าง (Drain) ตรงกลาง
     - รุ่นสี่เหลี่ยม: วาดสี่เหลี่ยมขอบมน มีขอบอ่าง, ก้นอ่างลาดเอียง, และสะดืออ่างตรงกลาง
  2. ใน StudioCanvas / StudioPage.tsx:
     แผ่นท็อปเคาน์เตอร์ (Rectangle) ต้องเปลี่ยนสีพื้นหลังตามสีหินที่เลือกจริง (`activeStone.tone`)
     พร้อมแสดงเนื้อสัมผัสหินสังเคราะห์ (Texture / Speckle pattern) ไม่ใช่กล่องสีเทาล้วน
  3. ใน App.tsx (ProductCard หน้าแรก /):
     แยกปุ่มแอ็กชันบนการ์ดอ่างทุกใบให้ชัดเจน 2 ทาง:
     - ปุ่มที่ 1: "[ 🛒 ซื้อเฉพาะอ่าง ]" -> เพิ่มอ่างเข้าตะกร้าใบเสนอราคา
     - ปุ่มที่ 2: "[ ✨ สั่งผลิตพร้อมท็อปเคาน์เตอร์ ]" -> นำทางไปที่ `/studio?basin={sku}` โดยระบบจะวางอ่างรุ่นนั้นบนเคาน์เตอร์ให้อัตโนมัติ

SCOPE (path สัมพัทธ์จาก root repo — ห้ามใส่ absolute path):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/App.tsx
  3. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ CSS การพิมพ์: ทุกอย่างใน @media print และทุก selector ที่ขึ้นต้นด้วย [class*="formal-"]
  - ห้ามแตะใบสั่งผลิตช่าง: .workbench* .workshop* .sig-box
  - ห้ามแตะ artifacts/api-server/** · lib/** (Backend ทั้งหมด)
  - ห้ามแก้ตรรกะคำนวณราคาใน src/data/studio-model.ts
  - ห้าม push เข้า main ตรง ๆ — สร้าง branch feat/replit-realistic-basins-and-counter แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/knight-basins && npm run typecheck -> 0 errors
  3) cd artifacts/knight-basins && npm test
     เกณฑ์ผ่าน: ต้องไม่มี fail นอกไฟล์ *.browser.test.ts
     baseline อ้างอิง: tests 193 / pass 188 / fail 2
  4) ภาพหน้าจอที่ 1: การ์ดอ่างล้างหน้าในหน้าแรก (/) แสดงปุ่ม 2 ทาง "[ซื้อเฉพาะอ่าง]" และ "[สั่งทำพร้อมท็อปเคาน์เตอร์]"
  5) ภาพหน้าจอที่ 2: หน้า Studio แสดงผังท็อปเคาน์เตอร์ที่เปลี่ยนสีตามหินจริง
  6) ภาพหน้าจอที่ 3: อ่างที่วางบนผัง Studio แสดงเป็นภาพ Top View เสมือนจริง (มีขอบอ่างและสะดืออ่างชัดเจน)

OUTPUT:
  - branch: feat/replit-realistic-basins-and-counter (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 6 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ที่ล้มไม่ใช่ไฟล์ *.browser.test.ts (เพดานผ่าน = 0 fail นอกไฟล์ browser)
  - ถ้า typecheck ไม่ผ่าน (มี error TS)
  - ถ้ากระทบการทำงานของการออกใบเสนอราคาเดิม

CONTRACT:
  1. Top View อ่างเสมือนจริง (ใน StudioPlacementPreview และ StudioPlacement บน Canvas):
     - ตรวจสอบรูปทรงจากขนาดหลุม (cutSize):
       - หากขนาดขึ้นต้นด้วย Ø หรือเป็นอ่างกลม -> ให้วาด `border-radius: 50%` มีวงแหวนขอบอ่าง (Rim), ก้นอ่างไล่เงาเรเดียล (Radial Gradient), และรูระบายน้ำสีเมทัลลิกตรงกลาง (กว้าง ~12-16px)
       - หากเป็นสี่เหลี่ยม -> ให้วาด `border-radius: 10px` มีขอบอ่างหนา ~8-12px, ก้นอ่างไล่เฉดสีมิติ, และรูระบายน้ำตรงกลาง
     - ขนาดและตำแหน่งต้องคงความแม่นยำตามสัดส่วน mm เดิมทุกประการ
  2. แผ่นท็อปเคาน์เตอร์เปลี่ยนสีตามหิน:
     - ดึงสีของหินปัจจุบัน (`stoneColorByName(state.activeStone, stoneColors).tone`)
     - กำหนดสีพื้นหลังให้แต่ละแผ่น Rectangle บน Canvas พร้อม overlay ลายหินละเอียด
  3. ปุ่มบน ProductCard ใน App.tsx:
     - ที่ด้านล่างของการ์ดสินค้า:
       แสดงปุ่มแยก 2 แถวหรือ 2 ปุ่ม:
       - ปุ่มขอใบเสนอราคาอ่าง: คลิกแล้ว `onToggle(sku)`
       - ปุ่มทำท็อป: `<Link href={"/studio?basin=" + sku} className="...">✨ สั่งทำพร้อมท็อปเคาน์เตอร์</Link>`
       (ใช้ `event.stopPropagation()` เพื่อไม่ให้การกดปุ่มทำท็อปไปชนกับการเลือกอ่าง)
  4. ใน StudioPage.tsx:
     - อ่าน query param `basin`: ถ้ามี ให้เพิ่มอ่างนั้นเข้า `basinSkus` และสร้าง placement วางไว้ที่กึ่งกลางแผ่นแรกให้อัตโนมัติ
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ Top View อ่าง + สีท็อปตามหิน + ปุ่ม 2 ทาง |
| 2 | GOAL วัดได้ | ✅ 3 จุดตามที่เจ้าของระบุชัดเจน |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ relative path |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ CSS พิมพ์, ห้ามแตะ backend, ห้ามแก้ studio-model.ts |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm run typecheck + npm test 193/188/2 + ภาพหน้าจอ 3 ภาพ |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-realistic-basins-and-counter + PR |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 193 / pass 188 / fail 2 |
| 9 | CONTRACT ระบุเทคนิคจริง | ✅ Top View (Rim, Gradient, Drain) + Tone fill + 2 buttons |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด ไม่มี absolute ของเครื่องเรา |
