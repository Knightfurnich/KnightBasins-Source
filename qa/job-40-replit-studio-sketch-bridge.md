# ใบงาน 40 (Replit) — สะพานเชื่อม 2 ทาง Studio ↔ ส่งแบบร่างมือ พร้อมปรับ UX หน้าสเก็ตช์

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  สร้างสะพานเชื่อม 2 ทางระหว่าง Studio และ หน้าส่งแบบร่าง (/sketch) พร้อมปรับ UX:
  1. ในหน้า 2D Studio (mode === "studio"):
     - เพิ่มแบนเนอร์/การ์ดช่วยเหลือเด่นชัด:
       "✍️ ออกแบบเองไม่ถนัด? ส่งภาพแบบร่างด้วยมือ ให้ทีมงาน Knight Furnich ช่วยต่อยอดแบบและคิดราคาให้ฟรี"
       พร้อมปุ่ม [ 📤 ส่งภาพแบบร่างมือ ] นำทางไปที่ /sketch (แนบ query param อ่างและหินที่เลือกอยู่ไปด้วย เช่น /sketch?basin=...&stone=...)
  2. ในหน้าส่งแบบร่าง (mode === "sketch"):
     - เพิ่มทางลัด: "💡 ต้องการลองจัดวางแผ่นจริงและคำนวณราคาด้วยตนเอง? [ ✨ เข้าสู่ 2D Studio ]" นำทางไปที่ /studio
     - ปรับข้อความ helper ในรายการอ่าง: เปลี่ยนจาก "กด วางบนผัง หรือลากรุ่นที่เลือกไปวางบนแผ่นใดก็ได้" เป็น "เลือกรุ่นอ่างที่สนใจใส่ในแบบร่าง (ไม่บังคับ) เพื่อให้ทีมงานช่วยวางผังให้ตรงรุ่น"
     - ซ่อนปุ่ม [ วางบนผัง ] และปิด drag-and-drop ในหน้าสเก็ตช์ (เพราะหน้านี้ไม่มีผังให้วาง)

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ index.html, App.tsx, WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามลบฟังก์ชัน submitSketch หรือ submitStudio เดิม
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-studio-sketch-bridge แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 193 / pass 188 / fail 2 / cancelled 3 (non-browser tests 188/188 ผ่านครบ)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้า /studio: แสดงแบนเนอร์ทางลัดส่งแบบร่างมือ
     - หน้า /sketch: แสดงทางลัดเข้า Studio และรายการอ่างที่ไม่มีปุ่ม "วางบนผัง"

OUTPUT:
  - branch: feat/replit-studio-sketch-bridge (เปิด PR เข้า main)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแตะไฟล์นอก SCOPE

CONTRACT:
  1. ใน StudioPage.tsx:
     - ส่ง prop `mode` เข้าไปยัง `StudioShortlists`
     - ใน `StudioShortlists`:
       - ตรวจสอบ `if (mode === "sketch")`:
         - helper text ใต้ 02 / BASIN SHORTLIST แสดง: "เลือกรุ่นอ่างที่สนใจใส่ในแบบร่าง (ไม่บังคับ) เพื่อให้ทีมงานช่วยวางผังให้ตรงรุ่น"
         - ไม่แสดงปุ่ม `<button className="studio-basin-place-button">วางบนผัง</button>`
         - ปิด `draggable={false}` เมื่ออยู่ในโหมดสเก็ตช์
     - ในหน้า Studio (`mode === "studio"`):
       - เพิ่มแบนเนอร์ทางลัด `.studio-sketch-bridge-banner`:
         "✍️ ออกแบบเองไม่ถนัด? ส่งภาพแบบร่างด้วยมือ ให้ทีมงาน Knight Furnich ช่วยต่อยอดแบบและคิดราคาให้ฟรี"
         ปุ่มคลิกไปที่ `/sketch` พร้อมส่ง `basin` และ `stone` ปัจจุบันผ่าน URL
     - ในหน้า Sketch (`mode === "sketch"`):
       - เพิ่มแถบ `.sketch-studio-bridge-banner`:
         "💡 ต้องการลองประกอบแผ่นจริงและคำนวณราคาด้วยตนเอง? [ ✨ เข้าสู่ 2D Studio ]"
  2. ใน index.css:
     - กำหนดสไตล์ `.studio-sketch-bridge-banner` และ `.sketch-studio-bridge-banner` ให้สวยงาม คุมโทน สะอาดตา ไม่รกสายตา
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ สะพานเชื่อม 2 ทาง Studio ↔ ส่งแบบร่างมือ |
| 2 | GOAL วัดได้ | ✅ มีแบนเนอร์เชื่อม 2 ฝั่ง + ซ่อนปุ่ม/แก้ข้อความใน sketch |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative path สำหรับ Replit |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ Print CSS, ห้ามแตะ App.tsx |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 193/188/2 + ภาพถ่าย 2 จอ |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-studio-sketch-bridge |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ 193 / pass 188 / fail 2 |
| 9 | CONTRACT ระบุข้อความและเงื่อนไขจริง | ✅ ระบุข้อความภาษาไทยและ prop ครบถ้วน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
