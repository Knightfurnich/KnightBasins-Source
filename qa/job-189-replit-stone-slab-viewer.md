# ใบงาน 189 (Replit) — นำภาพหิน 3 บทบาทออกใช้หน้าร้าน: ดูภาพเต็มแผ่น + ภาพใบเสนอราคา

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / UI) · เริ่มได้ทันที (Backend พร้อมแล้ว)

**ที่มาและความต้องการ:**
บอสกำหนดภาพหิน 3 บทบาทในหลังบ้านเสร็จแล้ว (Job 186/187) และ API `/api/catalog` ส่งข้อมูลทั้ง 3 ฟิลด์มาให้หน้าร้านแล้วจริง:
`galleryImageUrls`, `quoteImageUrl`, `slabImageUrl`
แต่หน้าร้านยังไม่นำมาใช้ ใบงานนี้คือชั้นสุดท้ายที่ทำให้ลูกค้าเห็นประโยชน์จริง:
1. หน้า `/stone` — เมื่อสีหินมี `slabImageUrl` ให้มีปุ่ม **"ดูภาพเต็มแผ่น"** เปิดดูภาพลายหินเต็มแผ่นใหญ่ (ภาพที่ 3)
2. ตะกร้าใบเสนอราคา (หิน) — ให้ใช้ `quoteImageUrl` เป็นภาพหลักของรายการหิน ถ้าไม่ได้ตั้งไว้จึงใช้ `imageUrl` (ภาพที่ 2)

**รายละเอียดสิ่งที่ต้องทำ (4 ไฟล์):**
1. `artifacts/knight-basins/src/data/catalog.ts`
   - เพิ่มฟิลด์ใน `StoneColor`: `galleryImageUrls?: string[]`, `quoteImageUrl?: string`, `slabImageUrl?: string`
   - เพิ่มฟิลด์รับใน `CatalogStoneRecord`: `galleryImageUrls?: string[] | null`, `quoteImageUrl?: string | null`, `slabImageUrl?: string | null`
   - ใน `stoneColorsFromCatalog` map ค่าทั้ง 3 จาก installed ?? sheet (ให้ใช้ `.trim() || undefined` เหมือน `imageUrl` เดิม) โดย `galleryImageUrls` ใช้ค่าจากแหล่งที่มีข้อมูลก่อน และห้ามรวมรหัสสีที่ต่างกันเข้าด้วยกัน
2. สร้าง `artifacts/knight-basins/src/components/StoneSlabViewer.tsx` (ใหม่)
   - รับ props `images: string[]` และ `alt: string`
   - ถ้า `images.length === 0` ให้ `return null`
   - ปุ่มเปิดมี `data-testid="button-stone-slab-open"` ข้อความ **"ดูภาพเต็มแผ่น"**
   - ตัว modal ใช้ `createPortal` ไปที่ `document.body` และ **ใช้คลาส CSS เดิมของกล่องภาพอ่างที่มีอยู่แล้ว** (`basin-gallery-overlay`, `basin-gallery-close` และคลาสลูกที่เกี่ยวข้อง) ห้ามสร้างคลาสใหม่ใน `src/index.css`
   - กด `Escape` ปิดได้ และล็อก `document.body.style.overflow` ขณะเปิด (ทำ cleanup on unmount)
   - ใช้ `data-testid="stone-slab-overlay"` ที่ตัว overlay
3. `artifacts/knight-basins/src/App.tsx` (แก้เฉพาะ 2 จุดที่ระบุ ห้ามแตะส่วนอื่น)
   - จุดที่ 1 — การ์ดสีหินใน `StonePage` (ปุ่ม `data-testid="button-stone-color-${color.code}"`): ถ้าสีนั้นมี `slabImageUrl` ให้แสดงปุ่ม `StoneSlabViewer` ใต้ภาพการ์ด โดยส่ง `images` = `[slabImageUrl, ...galleryImageUrls]` แบบไม่ซ้ำ
   - จุดที่ 2 — `QuoteStoneRow` (แถวหินในตะกร้าใบเสนอราคา): เปลี่ยนแหล่งภาพจาก `selectedStone.imageUrl` เป็น `selectedStone.quoteImageUrl ?? selectedStone.imageUrl`
4. เพิ่มเทสต์ `artifacts/knight-basins/test/stone-slab-viewer.test.ts`
   - ใช้ Static Source Inspection (`fs.readFileSync` + `assert.match`) เท่านั้น ห้าม import คอมโพเนนต์
   - ตรวจว่า `StoneSlabViewer.tsx` มีข้อความ "ดูภาพเต็มแผ่น", มี `data-testid="button-stone-slab-open"`, ใช้ `createPortal` และไม่ประกาศคลาสใหม่
   - ตรวจว่า `catalog.ts` มี 3 ฟิลด์ใหม่ใน `StoneColor`
   - ตรวจว่า `App.tsx` มีการอ้าง `slabImageUrl` ใน `StonePage` และ `quoteImageUrl` ใน `QuoteStoneRow`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่ม 3 ฟิลด์ภาพหินใน StoneColor/CatalogStoneRecord และ map ใน stoneColorsFromCatalog (catalog.ts)
  2. สร้าง StoneSlabViewer.tsx โดยใช้ createPortal และคลาส CSS เดิมของกล่องภาพอ่าง (ห้ามสร้างคลาสใหม่)
  3. ใส่ปุ่มดูภาพเต็มแผ่นในการ์ดสีหินของ StonePage และให้ QuoteStoneRow ใช้ quoteImageUrl ก่อน imageUrl
  4. เพิ่มเทสต์ static source inspection ใน artifacts/knight-basins/test/stone-slab-viewer.test.ts

SCOPE:
  - artifacts/knight-basins/src/data/catalog.ts
  - artifacts/knight-basins/src/components/StoneSlabViewer.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/stone-slab-viewer.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็ก: ห้ามแตะต้อง src/index.css เด็ดขาด (ต้องได้ 0 diff) ห้ามสร้างคลาส CSS ใหม่ ให้ใช้คลาสเดิมที่มีอยู่
  - ห้ามแตะต้องโค้ด Print Layout ตาราง และ CSS ของ Formal Quotation ใน App.tsx (แก้ได้เฉพาะ StonePage การ์ดสีหิน และ QuoteStoneRow ตามที่ระบุ)
  - ห้ามแก้ราคา สูตรคำนวณ หรือตรรกะการเลือกสี
  - ทำงานผ่าน branch: feat/replit-stone-slab-viewer แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-stone-slab-viewer ชัดเจน
  2) pnpm run typecheck → 0 errors
  3) git diff --stat src/index.css → 0 diff (ต้องไม่แตะเลย)
  4) node --test test/stone-slab-viewer.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 659 / pass 659 / fail 0 (ชุด non-browser เท่านั้น ไม่ต้องรัน browser suite)

OUTPUT:
  - branch: feat/replit-stone-slab-viewer (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้า src/index.css มี diff เกิน 0 บรรทัด
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าจำเป็นต้องแก้โค้ด Formal Quotation (print layout) เพื่อให้งานสำเร็จ
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
| 11 | ป้องกันพื้นที่ Formal Quotation ที่บอสสั่งห้ามแตะ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
