# ใบงาน 31 (Replit) — ระบบทีมขายวาด 2D Studio ต่อยอดจากภาพสเก็ตช์ลูกค้า

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เมื่อลูกค้าส่งแบบร่าง/ภาพถ่ายหน้างานเข้ามา ทีมขายในหน้า Admin ต้องสามารถกดปุ่ม "เปิดวาดใน 2D Studio" เพื่อเปิดหน้า Studio ที่มีภาพสเก็ตช์ของลูกค้าแสดงคู่ขนานให้ดูมิติหน้างานจริงขณะวาด เมื่อวาดเสร็จสามารถกดบันทึกผัง Studio และราคาประเมินกลับเข้า Lead เดิมได้ทันที

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch — ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  เชื่อมโยงหน้า Admin Leads เข้ากับ 2D Studio สำหรับ Lead ประเภทแบบร่าง (orderMode === "sketch"):
  1. ในหน้า Admin LeadsManager: เพิ่มปุ่ม "[🎨 เปิดวาดใน Studio]" ที่การ์ด Lead แบบร่าง
  2. ในหน้า StudioPage: รองรับ query parameter `?leadId=<id>`:
     - แสดงแถบอ้างอิงภาพสเก็ตช์ของลูกค้า (Sketch Reference Viewer) ที่ซูม/ดูรูปต้นฉบับได้ขณะจัดผัง
     - โหลดผังเดิม (ถ้ามีบันทึกไว้ใน lead.studioData) ขึ้นมาแก้ไขต่อได้
     - เมื่อกดบันทึก ให้เรียก `PATCH /api/admin/leads/:id` อัปเดต `studioData` ครบชุดเข้า Lead เดิม

SCOPE (path สัมพัทธ์จาก root repo — ห้ามใส่ absolute path):
  1. artifacts/knight-basins/src/admin/LeadsManager.tsx
  2. artifacts/knight-basins/src/components/StudioPage.tsx
  3. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ CSS การพิมพ์: ทุกอย่างใน @media print และทุก selector ที่ขึ้นต้นด้วย [class*="formal-"]
  - ห้ามแตะใบสั่งผลิตช่าง: .workbench* .workshop* .sig-box
  - ห้ามแก้ตรรกะคำนวณราคาใน src/data/studio-model.ts
  - ห้ามลบฟังก์ชันการใช้งาน Studio ปกติ (เมื่อเปิด /studio โดยไม่มี leadId ต้องทำงานได้ตามเดิม 100%)
  - ห้าม push เข้า main ตรง ๆ — สร้าง branch แล้วเปิด PR เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ):
  1) git branch --show-current (ต้องไม่ใช่ main) + git log --oneline -1
  2) cd artifacts/knight-basins && npm run typecheck -> 0 errors
  3) cd artifacts/knight-basins && npm test
     เกณฑ์ผ่าน: ต้องไม่มี fail นอกไฟล์ *.browser.test.ts
     baseline อ้างอิง (วัดเองบน main 24 ก.ย. 69): tests 189 / pass 185 / fail 2
  4) ภาพหน้าจอที่ 1: การ์ด Lead แบบร่างในหน้า /admin/leads แสดงปุ่ม "[🎨 เปิดวาดใน Studio]"
  5) ภาพหน้าจอที่ 2: หน้า /studio?leadId=... แสดงแถบดูภาพสเก็ตช์คู่ขนานกับผัง 2D Studio
  6) ยืนยันผลการกดบันทึก: มีข้อความสำเร็จและลิงก์เปิดดูใบเสนอราคา

OUTPUT:
  - branch: feat/replit-studio-over-sketch (เปิด PR เข้า main รอตรวจ)
  - 3 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 6 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ที่ล้มไม่ใช่ไฟล์ *.browser.test.ts (เพดานผ่าน = 0 fail นอกไฟล์ browser)
  - ถ้า typecheck ไม่ผ่าน (มี error TS)
  - ถ้ากระทบการทำงานของหน้า /studio ปกติ

CONTRACT:
  1. ใน LeadsManager.tsx:
     - ที่การ์ด Lead ที่มี orderMode === "sketch" หรือมีรูปภาพสเก็ตช์:
       เพิ่มปุ่ม `<Link href={"/studio?leadId=" + lead.id} className="button button--accent ...">🎨 เปิดวาดใน 2D Studio</Link>`
  2. ใน StudioPage.tsx:
     - อ่าน `leadId` จาก URL search params (เช่น `new URLSearchParams(window.location.search).get("leadId")`)
     - ถ้ามี `leadId`:
       - ดึงข้อมูล Lead ผ่าน API หรือ hook ของ admin (`/api/admin/leads`) เพื่อเอารูป `sketchUrls` และ `studioData` เดิม
       - แสดงป้ายกำกับหัวหน้า: "กำลังจัดผังสำหรับ Lead #{leadId} ({customerName})"
       - แสดงแผง "ภาพแบบร่างของลูกค้า" (Sketch Viewer Panel) ที่แสดงรูปย่อ กดคลิกเพื่อขยายดูมิติตัวเลขได้
       - ปุ่มหลักด้านล่างเปลี่ยนข้อความเป็น "บันทึกผังและประเมินราคาเข้า Lead #{leadId}"
       - เมื่องานบันทึกเสร็จ ให้ส่ง `PATCH /api/admin/leads/{leadId}` พร้อม body `{ studioData: ... }`
  3. ขนาดตัวอักษร: ทุกส่วนที่เพิ่มใหม่ต้องใช้สเกลมาตรฐาน (ข้อความหลัก 14px, ตัวย่อย 12px) ห้ามต่ำกว่า 12px
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบวาด Studio จากแบบร่างลูกค้า |
| 2 | GOAL วัดได้ | ✅ ปุ่มใน Admin + Split View ใน Studio + บันทึกกลับ Lead |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 3 ไฟล์ relative path |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ CSS พิมพ์, ห้ามแตะ studio-model.ts |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm run typecheck + npm test 189/185/2 + ภาพหน้าจอ |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-studio-over-sketch + PR |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 189 / pass 185 / fail 2 |
| 9 | CONTRACT ระบุพฤติกรรมจริง | ✅ query param `leadId` + UI flow |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด ไม่มี absolute ของเครื่องเรา |
