# ใบงาน 454-C (ชัย) — **ให้ `basinProductFromCatalog()` ส่ง `categoryLabel` ผ่าน model แล้วลบ cache ฝั่ง UI (ลดโค้ดซ้อน)**

**วันที่:** 11 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด
**ที่มา:** ข้อเสนอของชัย (ไม่บล็อก) หลังปิด 441-B v2 (#551) — ปัจจุบัน mapper ประกอบออบเจ็กต์จากลิสต์ฟิลด์ตายตัว จึงทิ้ง `categoryLabel` ของแถว API ⇒ UI ต้องเก็บสำเนาเองใน `catalogueCategoryFacts.ts`
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `artifacts/api-server/src/**` (mapper) + `artifacts/knight-basins/src/components/catalogueCategoryFacts.ts` + `src/App.tsx` (2 ไฟล์ UI มอบชั่วคราวให้ชัยในใบนี้) → **เปิด PR**

> **แม่แบบมาตรฐาน:** ① baseline ระบุ **commit + OS + ผู้รัน** ② ส่งรายงานที่ **`qa/` ที่รากรีโป ผ่าน PR** ③ `curl` ใช้ชื่อฟิลด์จริง ④ **ห้ามแตะไฟล์ข้ามเจ้าของ** (ใบนี้ เดวิดมอบไฟล์ UI 2 ไฟล์ให้ชั่วคราว — ดู SCOPE) ⑤ พิสูจน์สองทางเสมอ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 11 ต.ค. 69 · เดวิด

GOAL:
  A. **mapper `basinProductFromCatalog()` ต้องส่งฟิลด์ระดับแถวผ่าน model** อย่างน้อย `category` + `categoryLabel` (+ คงฟิลด์เดิมทุกตัว) ⇒ หลังแก้ **UI ไม่ต้องเก็บสำเนาค่าของตัวเองอีก**
  B. **ลบ cache ฝั่ง UI ที่ไม่จำเป็น** — `catalogueCategoryFacts.ts`: เก็บเฉพาะสิ่งที่ยังต้องใช้จริง (เช่น การสร้างชิป/กลุ่มจากแถว + กติกา C2 ที่ห้ามคำอังกฤษดิบ) และเลิกเก็บสำเนา `category`/`categoryLabel` ต่อ SKU ถ้า model มีค่าแล้ว ⇒ โค้ดอ่านง่ายขึ้นและมีที่มาจริงเดียว
  C. **กติกา C2 ต้องยังจริง:** ห้ามคำอังกฤษดิบ (`storage` / `counter basin` / `tall vertical washbasin`) โผล่บนหน้าลูกค้าทุกโหมด — มีเทสต์ล็อกเดิมคุมอยู่ ห้ามทำให้ตก
  D. **ไม่แตะ:** ราคา/ขนาด/สี/รหัส/ลำดับ · `/price-guide` · `src/index.css` (แช่แข็ง) · hero rule #449 · production DB
  E. **เทสต์:** เพิ่มเทสต์ว่า model ที่ได้จาก mapper มี `categoryLabel` · เทสต์ชิป/C2 เดิมต้องผ่าน · พิสูจน์สองทาง

SCOPE (แก้เฉพาะที่ระบุ):
  - (รีโป) artifacts/api-server/src/lib/ (mapper ที่ประกอบ BasinProduct) · artifacts/api-server/test/
  - (รีโป) artifacts/knight-basins/src/components/catalogueCategoryFacts.ts · artifacts/knight-basins/src/App.tsx
  - (รีโป) artifacts/knight-basins/test/catalogue-category-chips.test.ts
  - (รีโป) qa/report-chai-round22-mapper-category-label-20261011.md   (ใหม่) รายงานของคุณ
  - /opt/data/cache/kbsrc/qa/job-441-boy-product-types-ui.md          (อ่าน — ใบเดิมที่ปิดแล้ว)

FORBIDDEN:
  - ห้ามแตะ `src/index.css` · ห้ามแตะ hero rule #449 · ห้ามแตะหน้า `/price-guide` · ห้ามแตะราคา/ขนาด/สี/รหัส/ลำดับ
  - ห้ามแก้เทสต์ที่ไม่เกี่ยวกับงานนี้ · ห้ามแตะ production DB · ห้าม merge PR เอง

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ภาพ):
  0) **baseline (เดวิดรัน · Linux · `32254bfb`):** api 1,329 → ผ่าน 1,329 / ตก 0 · web 1,349 → ผ่าน 1,307 / ตก 0 / ข้าม 42
  1) คำสั่ง: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/knight-basins && npm test` · `npx tsc --noEmit`
  2) เทสต์ใหม่ที่ยืนยัน model มี `categoryLabel` + เทสต์ชิป/C2 ผ่านทั้งชุด
  3) วัดจริงบนหน้าที่ลูกค้าเห็น: ชิป = `ทั้งหมด 30 · เคาน์เตอร์ 18 · ทรงสูง 10 · เสาวางของตั้งพื้น 2` · **ไม่มีคำอังกฤษดิบ** · ป้ายการ์ด KF029/KF030 = "เสาวางของตั้งพื้น"
  4) **พิสูจน์สองทาง** · 5) เวลาไทย + hash

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `refactor(data): carry categoryLabel through the model; drop the UI copy` (ป้ายงาน: job 454-C)
  - `qa/report-chai-round22-mapper-category-label-20261011.md` (รากรีโป)
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ

STOP:
  - ครบ A–E พร้อมหลักฐาน · หรือทำครบ **12 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - ถ้าพบว่าการลบ cache ทำให้ C2 หรือชิปเพี้ยน ⇒ **หยุดและรายงาน** (ห้ามฝืนให้ผ่าน)
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–E |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail |
| 6 | พิสูจน์สองทาง | ถอด → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาข้อมูล (เห็นไม่ชัด = null) | ระบุ 'ไม่ชัด' แทนการเดา |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

> [เดวิด → ชัย]
> ข้อเสนอของคุณเอง (ไม่บล็อก) — เดวิดออกใบให้แล้ว: ให้ **mapper ส่ง `categoryLabel` ผ่าน model** แล้ว **ลบสำเนา cache ฝั่ง UI** ที่ไม่จำเป็น
> · **ไฟล์ UI 2 ไฟล์ (`catalogueCategoryFacts.ts` + `App.tsx`) เดวิดมอบให้คุณชั่วคราวในใบนี้** — ห้ามคนอื่นแตะพร้อมกัน
> · กติกา **C2 ต้องยังจริง** (ห้ามคำอังกฤษดิบโผล่) + เทสต์ชิปเดิมต้องผ่าน · ห้ามแตะ `src/index.css` / hero rule / ราคา
> · ลำดับคิว: **ทำ 453-B ให้จบก่อน** แล้วค่อยใบนี้ (WIP 2)
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-454-chai-mapper-category-label.md`
