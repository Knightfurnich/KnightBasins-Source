# รายงานชัย · ใบงาน 451-C — สำเนา static ตามหลัง API (ประเภท KF029/KF030 + ตารางรูปทรงไม่ใช้แสดงผล)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 09:50–10:20 น. (เวลาไทย) · **ฐาน:** `main` ที่ `65e866d` · **สาขา:** `fix/chai-static-copy-follows-api`
**แตะ:** `artifacts/knight-basins/src/data/catalog.ts` · `artifacts/knight-basins/test/stone-status-visibility.test.ts` (เทสต์ของผม — ตัวเปรียบเทียบสำเนากับ snapshot ของแอป) · `artifacts/api-server/test/basin-bowl-shape.test.ts` (เทสต์ของผม) · รายงาน
**ไม่แตะ:** เทสต์ของบอย (**`studio-pillar-products.test.ts` ไม่ได้แก้**) · `App.tsx` · `components/**` · `admin/**` · ราคา/ขนาด/สี/รหัส/ชื่อของทุกรุ่น · DB

## ⚠ ต้องประสานก่อน merge (สำคัญ)
1. **เทสต์ของบอยตก 1 ข้อทันที** — `artifacts/knight-basins/test/studio-pillar-products.test.ts` บรรทัด `assert.equal(product.category, "tall vertical washbasin")` (ข้อ "the catalog keeps both ready-made pillar sets at 16,000 THB…") ⇒ **บอยต้องแก้เป็น `"storage"` ใน 441-B** (ข้ออื่นในไฟล์นั้นผ่านหมด รวมทั้งราคา 16,000 / `isFreestandingPillarProduct` / ป้ายประเภท) · เวลานี้ CI ฝั่งเว็บของ PR นี้จะแดง 1 ข้อจนกว่าบอยแก้
2. **หน้า `App.tsx` ยังไม่รู้จักประเภท `storage`** — ฟังก์ชัน `categoryLabel(name)` (บรรทัด ~641) แปลงชื่อหมวดเฉพาะ `counter basin` / `tall vertical washbasin` ถ้าไม่มีตัวแปลจะพิมพ์ชื่อดิบ ⇒ ในช่วงที่ยังไม่มีข้อมูลจาก API (หน้าเว็บเพิ่งเปิด/ออฟไลน์) ปุ่มตัวกรองซึ่งสร้างจากสินค้าในสำเนา static จะมีปุ่มที่ขึ้นคำว่า `storage` (ตัวอักษรอังกฤษดิบ) — **ผมอ่านจากโค้ด ไม่ได้เปิดหน้าจอตรวจ** · หลัง API โหลด ปุ่มกรองมาจากตารางหมวดของ DB (`basin_categories`) จึงไม่มีปุ่มนี้ ⇒ **บอยต้องให้ตัวกรองอ่าน `categoryLabel` ของสินค้า (หรือเพิ่ม `storage` ในตัวแปลง) ใน 441-B**
3. **ลำดับ merge:** ให้ **441-B ของบอยไปก่อน หรือ merge พร้อมกัน** (ถ้าผม merge ก่อน เว็บจะมีเทสต์แดง 1 ข้อและปุ่มกรองดิบ 1 ปุ่มในโหมดไม่มี API)
4. หลัง merge ผมไม่แก้ `App.tsx`/`components/**`/เทสต์ของบอยเอง

## สรุป 5 บรรทัด
1. **ทำอะไร:** (①) สำเนา static ของ KF029/KF030 เปลี่ยน `category` เป็น `"storage"` และเพิ่ม `categoryLabel` = `"เสาวางของตั้งพื้น"` ตรงกับ API (440-C) · ทุกรุ่นมี `categoryLabel` เหมือน API (`เคาน์เตอร์` / `ทรงสูง`) · ราคา ฿16,000 / ขนาด 400 × 400 × 1000 / สี / รหัส / `basinDimensions` เดิมทุกค่า (②) `PRODUCTS` **เลิกรับค่ารูปทรง** (ไม่ spread `BASIN_BOWL_SHAPES` อีก) — ค่าที่แสดงบนการ์ดมาจาก API เท่านั้น ตารางเหลือเป็น seed/อ้างอิงของเทสต์ (มีคอมเมนต์กำกับว่า ห้ามใช้แสดง)
2. **เทสต์:** web 1338 / ผ่าน 1283 / ตก 13 / ข้าม 42 = ชุดเดิม 12 ข้อ + **เทสต์ของบอย 1 ข้อ** (ข้อ ⚠1 ข้างบน — คาดไว้) · api-server 1329 / ผ่าน 1324 / ตก 5 (ชุดเดิม Windows) · `tsc --noEmit` web ไม่มี error · เทสต์ที่เกี่ยวข้องของผมผ่านหมด
3. **ตรวจไม่ได้:** หน้าจอจริง (ปุ่มตัวกรอง/การ์ดในโหมดไม่มี API) — ดูจากโค้ดเท่านั้น · ผลบน production หลัง deploy
4. **ความเสี่ยง:** ข้อ ⚠1 และ ⚠2 · บรรทัดรูปทรงบนการ์ดจะไม่ขึ้นเลยในโหมดออฟไลน์/ก่อน API โหลด (ตั้งใจ ตามใบ: ค่าแสดงมาจาก API เท่านั้น) — ข้อดีคือไม่มีบรรทัดที่แอดมินล้างค่าแล้วยังโผล่ชั่วคราว
5. **ข้อเสนอ:** merge 441-B ก่อน/พร้อมกัน · บอยตัดคอมเมนต์ใน `App.tsx` บรรทัด ~134–140 ที่ยังบอกว่า "built-in catalogue copy applies BASIN_BOWL_SHAPES" (ล้าสมัยหลังใบนี้)

## 0. baseline และคำสั่ง
- ผู้รัน: ชัย · Windows 11 · ฐาน `65e866d` · คำสั่ง: `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `npx tsc --noEmit` · baseline ก่อนแก้ (main ล่าสุดที่ผมรัน): web 12 ข้อตกชุดเดิม (release notes / llms / prerender — เทียบชื่อด้วย `diff` ชุดเดียวกัน) · baseline Linux ของเดวิดเป็นคนละเครื่อง
- ผลต่างของชุดที่ตก (web): เพิ่ม 1 ข้อ = เทสต์ของบอยข้างบน ไม่มีอย่างอื่นเพิ่ม

## 1. ตาราง: ค่าที่ลูกค้าเห็นต้องไม่เปลี่ยน
| รุ่น | ก่อน (static) | หลัง (static) | API (production) | ราคา/ขนาด/สี |
|---|---|---|---|---|
| KF029 | `tall vertical washbasin` | **`storage`** · `เสาวางของตั้งพื้น` | `storage` · `เสาวางของตั้งพื้น` ✅ ตรงกัน | ฿16,000 · 400 × 400 × 1000 · เดิม |
| KF030 | `tall vertical washbasin` | **`storage`** · `เสาวางของตั้งพื้น` | เหมือนกัน ✅ | เดิม |
| อีก 28 รุ่น | เดิม | เดิม + `categoryLabel` (`เคาน์เตอร์` / `ทรงสูง`) | ตรง | เดิม |
`isFreestandingPillarProduct` ยังตัดสินด้วยรายการ SKU (ไม่ขึ้นกับ `category`) จึงยังเป็น "เสาวางของตั้งพื้น (ชุดสำเร็จรูป)" ในใบเสนอราคา/สตูดิโอเหมือนเดิม — เทสต์ของบอยข้ออื่นที่ยืนยันเรื่องนี้ผ่านหมด

## 2. เทสต์และพิสูจน์สองทาง
- ปรับ 2 เทสต์ของผม: (ก) เทียบสำเนากับ snapshot ของแอป — snapshot คือแถวใน DB ณ 11 ต.ค. จึงระบุชัดว่า API เปลี่ยน 2 รุ่นนี้เป็น `storage` ตอนส่งออก (ข) ตารางรูปทรงฝั่งเว็บ = ตาราง seed ของ API ทุกรุ่น และ **`PRODUCTS` ไม่มีฟิลด์รูปทรงเลย** และ `catalog.ts` ไม่ spread ตารางนี้
- เทสต์ของบอยที่อ่านซอร์ส `catalog.ts` เพื่อดู label ของ KF003/KF006 (`basin-bowl-shape-card.test.ts`) ยังผ่าน เพราะตารางยังอยู่ในไฟล์ (ใช้เป็นอ้างอิง)

| ย้อน/ถอด | ผล (รันจริง) | คืน |
|---|---|---|
| ใส่ตารางรูปทรงกลับเข้า `PRODUCTS` | **ตก 1** (`basin-bowl-shape.test.ts` — "PRODUCTS carries none of it") · ชุด web 19/19 ไม่ตก | ผ่านทั้งสองชุด (8/8 · 19/19) |
| ให้ KF029 กลับเป็น `tall vertical washbasin` (เหลือแต่ KF030 เป็น storage) | **ตก 1** (`stone-status-visibility.test.ts` — เทียบกับ API) | ผ่าน 19/19 |
| ให้ KF028 (อ่างจริง) เป็น `storage` | **ตก 1** (`stone-status-visibility.test.ts`) | ผ่าน 19/19 |

เวลา: 11 ต.ค. 69 ราว 10:20 น. · ฐาน `65e866d`
