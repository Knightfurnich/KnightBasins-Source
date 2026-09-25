# ใบงาน 43 (Replit) — ปุ่มดาวน์โหลดและแชร์ผังเคาน์เตอร์เป็นรูปภาพ (PNG) ใน 2D Studio

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของต้องการให้ลูกค้าที่ออกแบบผังเคาน์เตอร์เสร็จแล้ว สามารถบันทึกผังเป็นรูปภาพเพื่อส่งต่อให้แฟน/สถาปนิก/ช่างดูใน LINE ได้ทันที ปัจจุบันมีปุ่ม "ดาวน์โหลดภาพ (PNG)" อยู่แล้ว แต่ถูกซ่อนอยู่ท้ายแผงใบเสนอราคาด้านขวาและไม่เด่นชัด ลูกค้ามองไม่เห็น

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  ยกระดับการแชร์ผังเคาน์เตอร์เป็นรูปภาพใน 2D Studio:
  1. ย้าย/เพิ่มปุ่ม `[ 📷 บันทึกผังเป็นรูปภาพ (PNG) ]` ขึ้นไปอยู่ในตำแหน่งที่มองเห็นได้ชัดเจนเหนือผังวาด (หรือบนแถบเครื่องมือของ Studio)
  2. แสดงปุ่มนี้ใน "โหมดง่าย (Simple Mode)" ด้วย เพื่อให้ลูกค้าทั่วไปใช้ได้
  3. ปุ่มยังคงเรียกใช้ฟังก์ชัน downloadStudioPng เดิม (ห้ามแก้ตรรกะการสร้างรูป)
  4. หลังดาวน์โหลดสำเร็จ ให้แสดงข้อความยืนยัน: "บันทึกภาพผังแล้ว — ส่งต่อให้ทีมงานหรือครอบครัวดูได้เลย"

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแก้ตรรกะ downloadStudioPng, createStudioPngSvg หรือ studioExportDimensionsValid
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้ามแตะ studio-model.ts (เป็นของชัย) หรือ admin/**
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-studio-png-share แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 196 / pass 191 / fail 2 / cancelled 3 (non-browser 191/191 ผ่านครบ)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้า /studio โหมดปกติ: ปุ่มบันทึกภาพมองเห็นชัดเจน
     - หน้า /studio โหมดง่าย: ปุ่มบันทึกภาพมองเห็นชัดเจน

OUTPUT:
  - branch: feat/replit-studio-png-share (เปิด PR เข้า main)
  - 2 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline (fail > 2)
  - ถ้าต้องแตะไฟล์นอก SCOPE

CONTRACT:
  1. ใน StudioPage.tsx:
     - ปุ่ม `<button type="button" className="button button--accent" onClick={() => void exportFiles("png")} data-testid="button-share-studio-png">📷 บันทึกผังเป็นรูปภาพ (PNG)</button>` ต้องมองเห็นได้ในทั้ง 2 โหมด (ปกติ + โหมดง่าย)
     - ตำแหน่งแนะนำ: ใน `studioDesignLayout` ใต้ StudioCanvas หรือแถวบนสุดของแผงขวา ก่อนส่วน export-actions เดิม
     - คงปุ่ม export DXF / PDF เดิมไว้ครบถ้วน ไม่ลบ
  2. ใน index.css:
     - เพิ่มสไตล์สำหรับปุ่มแชร์ให้เด่นชัด มองเห็นง่ายบนทั้งจอคอมและมือถือ
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปุ่มบันทึก/แชร์ผัง PNG เด่นชัดทั้ง 2 โหมด |
| 2 | GOAL วัดได้ | ✅ ปุ่มมองเห็นได้ + เรียก downloadStudioPng เดิม |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative path สำหรับ Replit |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแก้ตรรกะสร้างรูป, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 196/191/2 + ภาพ 2 โหมด |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-studio-png-share |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ 196 / pass 191 / fail 2 |
| 9 | CONTRACT ระบุ data-testid และตำแหน่งจริง | ✅ ระบุ button-share-studio-png |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
