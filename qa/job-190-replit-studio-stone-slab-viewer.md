# ใบงาน 190 (Replit) — เพิ่มปุ่ม "ดูลายแผ่นจริง" ใน 2D Studio Configurator (/studio)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / UI) · ต่อยอดจาก Job 189 ทันที

**ที่มาและความต้องการ:**
ในหน้า 2D Studio (`/studio`) เวลาลูกค้าหรือทีมงานออกแบบเคาน์เตอร์หิน ปัจจุบันเห็นเพียงชิปสีเล็กๆ (2D Color Swatch) ทำให้ดูลายริ้วหินจริงของแผ่นใหญ่ไม่ออก
ต่อยอดจาก Job 189 ที่สร้างคอมโพเนนต์ `StoneSlabViewer` ไว้เรียบร้อยแล้ว ใบงานนี้คือการนำมาติดตั้งใน 2D Studio:
1. แถบ Toolbar ด้านบนของ Studio (ข้างปุ่มเลือกสีหินปัจจุบัน): ถ้าสีหินที่เลือกอยู่มีภาพเต็มแผ่น (`slabImageUrl`) ให้แสดงปุ่ม **"ดูลายแผ่นจริง"** (เรียก `StoneSlabViewer`) เพื่อให้ลูกค้ากดเปิดดูลายแผ่นใหญ่ได้ทันที
2. ใน Popover เลือกสีหิน (`studio-stone-popover`): ในการ์ดรายการสีหินแต่ละใบ ถ้าสีนั้นมี `slabImageUrl` ให้มีปุ่มไอคอนสำหรับเปิดดูภาพเต็มแผ่นของสีนั้นๆ ได้โดยตรง

**รายละเอียดสิ่งที่ต้องทำ (2 ไฟล์):**
1. `artifacts/knight-basins/src/components/StudioPage.tsx`
   - Import `StoneSlabViewer` จาก `@/components/StoneSlabViewer`
   - จุดที่ 1 (ใน `studio-selector-actions` หรือข้าง `studio-selector-anchor`):
     - ตรวจสอบ `activeStone` (สีหินที่กำลังใช้งานบนผัง) ว่ามี `slabImageUrl` หรือไม่
     - ถ้ามี ให้แสดง `StoneSlabViewer` โดยส่ง `images = [activeStone.slabImageUrl, ...(activeStone.galleryImageUrls ?? [])]` แบบไม่ซ้ำ และข้อความกำกับ "ดูลายแผ่นจริง"
     - กำหนด `data-testid="button-studio-active-stone-slab-open"`
   - จุดที่ 2 (ในการ์ดรายการสีหิน `visibleStoneColors.map` ใน `studio-stone-list`):
     - สำหรับหินแต่ละสี (`stone`) ถ้ามี `stone.slabImageUrl` ให้แสดงปุ่มเปิดดูภาพเต็มแผ่น โดยดัก `event.stopPropagation()` ไม่ให้ทับซ้อนกับการคลิกเลือกสีหิน
     - กำหนด `data-testid={`button-studio-stone-slab-${stone.code}`}`
2. เพิ่มเทสต์ `artifacts/knight-basins/test/studio-stone-slab-viewer.test.ts`
   - ใช้ Static Source Inspection (`fs.readFileSync` + `assert.match`) ห้าม import component
   - ตรวจว่า `StudioPage.tsx` มีการ import `StoneSlabViewer`
   - ตรวจว่ามี `button-studio-active-stone-slab-open` และ `button-studio-stone-slab-`
   - ตรวจว่ามีการอ้างอิง `slabImageUrl` ในการตัดสินใจแสดงผลปุ่ม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. นำ StoneSlabViewer ไปแสดงข้างปุ่มเลือกสีหินในแถบ Toolbar ของ StudioPage.tsx
  2. เพิ่มปุ่มดูภาพเต็มแผ่นในรายการเลือกสีหิน (studio-stone-list) ของ StudioPage.tsx
  3. เพิ่ม Unit Test static source inspection ใน artifacts/knight-basins/test/studio-stone-slab-viewer.test.ts

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-stone-slab-viewer.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็ก: ห้ามแตะต้อง src/index.css เด็ดขาด (ต้องได้ 0 diff) ห้ามสร้างคลาส CSS ใหม่
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx และห้ามแตะ Formal Quotation (print layout)
  - ห้ามแก้ตรรกะการคำนวณพื้นที่ คำนวณราคา หรือการจัดวางอ่างบนผัง
  - ทำงานผ่าน branch: feat/replit-studio-stone-slab-viewer แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-studio-stone-slab-viewer ชัดเจน
  2) pnpm run typecheck → 0 errors
  3) git diff --stat src/index.css → 0 diff (ต้องไม่แตะเลย)
  4) node --test test/studio-stone-slab-viewer.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 644 / pass 644 / fail 0 (ชุด non-browser เท่านั้น ไม่ต้องรัน browser suite)

OUTPUT:
  - branch: feat/replit-studio-stone-slab-viewer (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้า src/index.css มี diff เกิน 0 บรรทัด
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้ากระทบ WorkshopProductionSheet.tsx หรือ Formal Quotation
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
| 11 | ป้องกัน WorkshopProductionSheet และ Formal Quotation ตามคำสั่ง | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
