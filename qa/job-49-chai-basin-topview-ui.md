# ใบงาน 49 (ชัย) — เพิ่มปุ่มปักหมุด 'กำหนดเป็นภาพ Top View' ในหน้าแก้ไขอ่าง (/admin/basins)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** หลังจากที่ระบบฐานข้อมูลและ API รองรับฟิลด์ `topViewImageUrl` (Migration 015) เรียบร้อยแล้ว ขั้นตอนนี้คือการเพิ่ม UI ให้แอดมินและคุณนพสามารถกดปักหมุดเลือกภาพใดภาพหนึ่งในรายการรูปภาพของอ่าง ให้เป็น "ภาพ Top View (2D Studio)" ได้อย่างสะดวก เช่นเดียวกับปุ่มปักหมุดภาพใบเสนอราคาที่มีอยู่แล้ว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มปุ่มปักหมุดภาพ Top View ในหน้าแก้ไขข้อมูลอ่าง (/admin/basins):
  1. ใน `basinImageRoles.ts`:
     - เพิ่มฟังก์ชัน `nextTopViewImageUrl(currentTopViewUrl, clickedUrl)` สำหรับสลับเปิด/ปิดการปักหมุดภาพ Top View
  2. ใน `BasinImageManagerField.tsx`:
     - รับ props: `topViewImageUrl?: string | null` และ `onTopViewImageChange?: (url: string | null) => void`
     - แสดงปุ่มปักหมุด `[ 🔝 ภาพ Top View ]` บนการ์ดรูปภาพแต่ละรูป
     - เมื่อคลิก ให้เรียก `onTopViewImageChange` พร้อมแสดงป้ายหรือไฮไลต์สีฟ้าชัดเจนเมื่อรูปนั้นเป็น Top View
  3. ใน `BasinsManager.tsx`:
     - ส่ง `topViewImageUrl` และ `onTopViewImageChange` เข้าไปยัง `BasinImageManagerField`
     - บันทึกค่าลง Form state เพื่อให้ส่งไปยัง PUT `/admin/basins/:id`
  4. เขียน Unit tests ใน `basin-topview-image-role.test.ts` ครอบคลุมการ toggle ปักหมุด และ unpin ภาพ Top View

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/basinImageRoles.ts
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/BasinImageManagerField.tsx
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/BasinsManager.tsx
  4. /opt/data/cache/kbsrc/artifacts/knight-basins/test/basin-topview-image-role.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/ หรือ deploy/
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-basin-topview-ui แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 213 / pass 208 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน basin-topview-image-role.test.ts ยืนยัน:
     - nextTopViewImageUrl ปักหมุดภาพที่เลือกถูกต้อง
     - nextTopViewImageUrl ยกเลิกการปักหมุดเมื่อคลิกซ้ำรูปเดิม

OUTPUT:
  - branch: feat/chai-basin-topview-ui (เปิด PR เข้า main รอตรวจ)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (fail > 2)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน basinImageRoles.ts:
     ```ts
     export function nextTopViewImageUrl(
       topViewImageUrl: string | null | undefined,
       clickedUrl: string,
     ): string | null {
       return topViewImageUrl === clickedUrl ? null : clickedUrl;
     }
     ```
  2. ใน BasinImageManagerField.tsx:
     - ปุ่ม Top View:
       - แสดงข้อความหรือไอคอน `🔝 Top View`
       - เมื่อรูปนั้นเป็น Top View (`topViewImageUrl === url`): ไฮไลต์พื้นหลังสีฟ้าหรือป้าย `✓ Top View` ชัดเจน
  3. ใน BasinsManager.tsx:
     - รองรับ `topViewImageUrl` ใน schema การแก้ไข และเชื่อมกับ Form state
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปุ่มปักหมุดภาพ Top View ในหน้าแก้ไขอ่าง |
| 2 | GOAL วัดได้ | ✅ nextTopViewImageUrl + UI button + Form bind + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 4 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 213/208/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-basin-topview-ui |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 213 / pass 208 / fail 2 |
| 9 | CONTRACT ระบุฟังก์ชันและปุ่มชัด | ✅ โค้ด nextTopViewImageUrl ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
