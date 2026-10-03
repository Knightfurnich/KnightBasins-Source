# ใบงาน 236 (น้องไนท์ Web — Guest UI) — แสดงขอบเขตโหมดทั่วไปและปุ่มเข้าสู่ระบบ LINE ในกล่องแชท

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — เลือกทางเลือกที่ 1)
**สถานะ:** มอบหมายให้ Replit · **พัฒนาผ่าน GitHub Connection เท่านั้น**
**Branch:** `feat/replit-support-guest-scope-ui`

**ที่มา:** บอสเลือกแนวทางที่ 1 — ให้ลูกค้าที่ยังไม่ล็อกอิน LINE เห็นชัดว่าตอนนี้ "โหมดทั่วไป" ตอบได้แค่ไหน และมีปุ่มชวนเข้าสู่ระบบ LINE เพื่อปลดล็อกโหมดเต็ม (แบบเดียวกับใน LINE) โดยไม่ปิดกั้นการค้นหาสินค้า

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/components/KnightSupport.tsx
     - เปลี่ยนข้อความต้อนรับเริ่มต้น (messages useState ตัวแรก) จากข้อความเดิมเป็นข้อความ 3 บรรทัดนี้:
       "สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ 💬"
       "โหมดทั่วไป (ยังไม่เข้าสู่ระบบ): ค้นหาราคาอ่างล้างหน้า รหัสสีหิน ขนาด และวิดีโอ 3D 360° เช่น \"KF001\" \"BW010\""
       "เข้าสู่ระบบด้วย LINE เพื่อปรึกษาการออกแบบ การชำระเงิน การติดตามใบเสนอราคา และคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE"
  2. เพิ่มแถบสถานะโหมด (mode banner) ใต้หัวกล่องแชท
     - ใช้ useGetLineAuthStatus() ที่มีอยู่แล้วในไฟล์ เพื่อรู้สถานะล็อกอิน
     - ถ้ายังไม่ล็อกอิน: แสดง "โหมดทั่วไป · ค้นหาสินค้าได้" พร้อมปุ่ม <LineLoginButton /> ที่ import มาจากไฟล์เดียวกัน
     - ถ้าล็อกอินแล้ว: แสดง "โหมดเต็ม (เชื่อมต่อ LINE แล้ว)" และไม่ต้องแสดงปุ่ม
  3. เมื่อ API ตอบกลับมาพร้อม loginRequired === true ให้แสดงปุ่ม LineLoginButton ใต้ข้อความนั้นในกล่องแชทด้วย (ใช้ฟิลด์จากใบงาน 235)
  4. เพิ่ม data-testid สำหรับเทสต์: mode banner และปุ่มล็อกอินในกล่องแชท

SCOPE:
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/knight-basins/test/support-guest-scope-ui.test.ts (ไฟล์ใหม่)
  - ไฟล์ CSS แบบ scoped ที่มีอยู่ของคอมโพเนนต์นี้ ถ้ามี (ห้ามแตะ src/index.css)

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (0 diff) — ต้องยืนยันว่าดiff ของไฟล์นี้ว่าง
  - ห้ามแตะ artifacts/api-server/** (เป็นงานของใบงาน 235)
  - ห้ามแตะ StudioPage.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามบังคับล็อกอินก่อนใช้ช่องค้นหา (บอสเลือกแบบไม่ปิดกั้น)
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) branch แสดง feat/replit-support-guest-scope-ui ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --experimental-strip-types --test test/support-guest-scope-ui.test.ts → ผ่านทุกข้อ ระบุจำนวน
  4) npm test ตัด *.browser.test.ts ใน artifacts/knight-basins → ระบุจำนวน ผ่าน/ตก/ข้าม และ baseline (CI Linux)
  5) diff artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)
  6) เขียนเทสต์แบบ Static Source Inspection (readFileSync + assert.match) เท่านั้น ห้าม dynamic import คอมโพเนนต์

OUTPUT:
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/knight-basins/test/support-guest-scope-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ข้อความต้อนรับ + แถบโหมด + ปุ่มล็อกอิน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ไฟล์ UI + เทสต์ใหม่ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, ไม่แตะ api-server |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + กฎ Static Source Inspection |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit (งาน UI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ตามทางเลือกที่ 1 ที่บอสเลือก |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีข้อมูลลับในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 236 บันทึกแล้ว |
