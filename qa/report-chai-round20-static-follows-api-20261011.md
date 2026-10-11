# รายงานชัย · ใบงาน 451-C — สำเนา static ตามหลัง API (ประเภท KF029/KF030 + ตารางรูปทรงไม่ใช้แสดงผล)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 09:50–10:20 น. (เวลาไทย) · **ฐาน:** `main` ที่ `65e866d` · **สาขา:** `fix/chai-static-copy-follows-api`
**แตะ:** `artifacts/knight-basins/src/data/catalog.ts` · `artifacts/knight-basins/test/stone-status-visibility.test.ts` (เทสต์ของผม — ตัวเปรียบเทียบสำเนากับ snapshot ของแอป) · `artifacts/knight-basins/test/studio-pillar-products.test.ts` (1 assertion + 2 imports — เดวิดปลดล็อกในใบนี้) · `artifacts/api-server/test/basin-bowl-shape.test.ts` (เทสต์ของผม) · รายงาน
**ไม่แตะ:** `App.tsx` · `components/**` · `admin/**` · ราคา/ขนาด/สี/รหัส/ชื่อของทุกรุ่น · DB

## อัปเดต 11 ต.ค. 69 (หลังเดวิดปลดล็อก): แก้เทสต์ `studio-pillar-products.test.ts` ในใบเดียวกัน
เดวิดอนุญาตให้ผมแก้ไฟล์นี้ในใบ 451-C (บอยถอดการแก้ไฟล์เดียวกันออกจาก #543 แล้ว — ไฟล์เป็นของผมคนเดียว):
- `assert.equal(product.category, "tall vertical washbasin")` → `assert.equal(product.category, STORAGE_CATEGORY)` + เพิ่ม `assert.equal(product.categoryLabel, STORAGE_CATEGORY_LABEL)` (นำเข้าค่าคงที่จาก `catalog.ts`) — เป็นข้อเดียวในไฟล์ที่ขึ้นกับประเภทเดิม ข้ออื่น (ราคา 16,000 · `isFreestandingPillarProduct` · ป้าย/ข้อความใบเสนอราคา · fixture KF099/KF098) ไม่ขึ้นกับ `category` ของ 2 รุ่น จึงไม่ต้องแก้
- ผล: ไฟล์นี้ 5/5 · เทสต์ 3 ไฟล์ที่เกี่ยวข้อง (studio-pillar-products + basin-bowl-shape-card + stone-status-visibility) 36/36 · CI (Linux) ก่อนแก้ตกเพียงข้อนี้ข้อเดียว (`gh run view … --log-failed`)
- พิสูจน์สองทาง: ให้ KF029 กลับเป็น `tall vertical washbasin` → ไฟล์นี้ **ตก 1** · คืนค่า → ผ่าน 5/5

## ⚠ สิ่งที่ยังต้องประสานกับบอย (ข้อ 1 ปลดแล้ว เหลือข้อ 2)
1. ~~เทสต์ของบอยตก 1 ข้อ~~ — **แก้แล้วในใบนี้** (ดูหัวข้อด้านบน)
2. **`App.tsx` `categoryLabel()` ยังไม่รู้จักประเภท `storage`** — ฟังก์ชันนี้ (บรรทัด ~641) แปลงชื่อหมวดเฉพาะ `counter basin` / `tall vertical washbasin` ถ้าไม่มีตัวแปลจะพิมพ์ชื่อดิบ ⇒ ในช่วงที่ยังไม่มีข้อมูลจาก API (หน้าเว็บเพิ่งเปิด/ออฟไลน์) ปุ่มตัวกรองซึ่งสร้างจากสินค้าในสำเนา static จะมีปุ่มที่ขึ้นคำว่า `storage` (อังกฤษดิบ) — **ผมอ่านจากโค้ด ไม่ได้เปิดหน้าจอตรวจ** · หลัง API โหลด ปุ่มกรองมาจากตารางหมวดของ DB จึงไม่มีปุ่มนี้ ⇒ **บอยต้องให้ตัวกรองอ่าน `categoryLabel` ของสินค้า (หรือเพิ่ม `storage` ในตัวแปลง)** — เป็นไฟล์ของบอย ผมไม่แก้
3. **ลำดับ merge:** ข้อ 2 ยังเป็นความเสี่ยงเล็กน้อยในโหมดไม่มี API จึงควรให้ตัวกรองของบอยตามมาเร็ว (ไม่บล็อก merge ใบนี้แล้ว เพราะ CI เขียว)

## สรุป 5 บรรทัด
1. **ทำอะไร:** (①) สำเนา static ของ KF029/KF030 เปลี่ยน `category` เป็น `"storage"` และเพิ่ม `categoryLabel` = `"เสาวางของตั้งพื้น"` ตรงกับ API (440-C) · ทุกรุ่นมี `categoryLabel` เหมือน API (`เคาน์เตอร์` / `ทรงสูง`) · ราคา ฿16,000 / ขนาด 400 × 400 × 1000 / สี / รหัส / `basinDimensions` เดิมทุกค่า (②) `PRODUCTS` **เลิกรับค่ารูปทรง** (ไม่ spread `BASIN_BOWL_SHAPES` อีก) — ค่าที่แสดงบนการ์ดมาจาก API เท่านั้น ตารางเหลือเป็น seed/อ้างอิงของเทสต์ (มีคอมเมนต์กำกับว่า ห้ามใช้แสดง)
2. **เทสต์:** web ก่อนแก้เทสต์ของบอย 1338 / ผ่าน 1283 / ตก 13 (ชุดเดิม 12 + `studio-pillar-products` 1) → **หลังแก้เทสต์นั้น 1338 / ผ่าน 1284 / ตก 12 / ข้าม 42 = ชุดเดิมเท่า main ทุกข้อ** (Windows; CI Linux ก่อนแก้ตกเพียงข้อนั้นข้อเดียว) · ไฟล์ที่เกี่ยวข้อง 36/36 · api-server 1329 / ผ่าน 1324 / ตก 5 (ชุดเดิม Windows) · `tsc --noEmit` web ไม่มี error · เทสต์ที่เกี่ยวข้องของผมผ่านหมด
3. **ตรวจไม่ได้:** หน้าจอจริง (ปุ่มตัวกรอง/การ์ดในโหมดไม่มี API) — ดูจากโค้ดเท่านั้น · ผลบน production หลัง deploy
4. **ความเสี่ยง:** ข้อ ⚠2 (ปุ่มตัวกรอง `storage` ดิบในโหมดไม่มี API) · บรรทัดรูปทรงบนการ์ดจะไม่ขึ้นเลยในโหมดออฟไลน์/ก่อน API โหลด (ตั้งใจ ตามใบ: ค่าแสดงมาจาก API เท่านั้น) — ข้อดีคือไม่มีบรรทัดที่แอดมินล้างค่าแล้วยังโผล่ชั่วคราว
5. **ข้อเสนอ:** บอยให้ตัวกรองอ่าน `categoryLabel` · บอยตัดคอมเมนต์ใน `App.tsx` บรรทัด ~134–140 ที่ยังบอกว่า "built-in catalogue copy applies BASIN_BOWL_SHAPES" (ล้าสมัยหลังใบนี้)

## 0. baseline และคำสั่ง
- ผู้รัน: ชัย · Windows 11 · ฐาน `65e866d` · คำสั่ง: `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `npx tsc --noEmit` · baseline ก่อนแก้ (main ล่าสุดที่ผมรัน): web 12 ข้อตกชุดเดิม (release notes / llms / prerender — เทียบชื่อด้วย `diff` ชุดเดียวกัน) · baseline Linux ของเดวิดเป็นคนละเครื่อง
- ผลต่างของชุดที่ตก (web) ก่อนแก้เทสต์ของบอย: เพิ่ม 1 ข้อ = `studio-pillar-products` — แก้แล้วตามหัวข้ออัปเดตข้างบน ไม่มีอย่างอื่นเพิ่ม

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
