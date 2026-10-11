# รายงานบอย รอบ 23 · 441-B v2 — ชั้น UI เท่านั้น (`src/data/**` โยกไป 451-C ตามที่เดวิดตัดขอบเขต)

วันที่ 11 ต.ค. 69 (Asia/Bangkok) · ผู้ทำ บอย (Qwen) · ผู้ตรวจรับ เดวิด + บอส
Branch `feat/web-category-parity-441b-v2` จาก `main@65e866d` · baseline เดียวกับที่เดวิดระบุใน #537
PR #534 (ฉบับที่แตะ `src/data/**`) ปิดแล้ว — diff `84fa3a3` ยังใช้ได้ ส่งต่อให้ชัยใน 451-C
Environment: Linux sandbox · node v22.23.3 · pnpm · chromium headless · รันโดยบอย

## สิ่งที่แก้ (ไฟล์ชั้น UI เท่านั้น)
`src/components/catalogueCategoryFacts.ts` (ใหม่)
- `indexCatalogueRowFacts(rows)` → `Map<SKU, {category, categoryLabel}>` จาก raw rows ของ `GET /api/catalog`
- `catalogueGroupValue(product, facts)` · `catalogueGroupLabel(product, fallback, facts)` · `buildCatalogueChips(products, tableNames, fallback, facts)`
- `SHELF_SET_ROW_CATEGORY = "storage"` — ค่า machine ที่ API ใช้กับ KF029/KF030 (หลักฐานใน fixture) ไม่ใช่คำที่แต่งขึ้น

`src/App.tsx`
- `catalogueFacts` memo ต่อ response หนึ่งครั้ง → ส่งเข้า `HomePage` (chip + ตัวกรอง + ค้นหา) และ `ProductCard` (pill)
- chip ลำดับตามตาราง `categories` แล้ว**เพิ่มหมวดที่ตารางไม่มี** (ทุกวันนี้ตารางมีแค่ 2 หมวด ทั้งที่แถวจริงมี 3 ค่า)
- pill ของการ์ดพิมพ์ `categoryLabel` ของแถวนั้นตรง ๆ
- คำค้นหาครอบคลุมทั้ง value และ wording ของหมวด (พิมพ์ "เสา" ต้องเจอ KF029/KF030)
- แถว `filter-tabs` ใส่ `flex-wrap` (เดิมชิปตัวที่ 5 ดันแถวยาวเกินจอที่ 360px)

ที่ต้องมีชั้นนี้เพราะ `basinProductFromCatalog()` (ไฟล์ของชัย) rebuild อ็อบเจ็กต์จาก field list ที่**ไม่มี `categoryLabel`** —แก้ mapper ไม่ใช่ขอบเขตนี้ จึงเก็บแถวดิบไว้ฝั่ง UI และ**ส่งเป็น value** ไม่ใช่ module cache
(รอบแรกผมใช้ module cache แล้ววัดเจอของจริง: chip ยังแสดงคำประจำไฟล์ทั้งที่ API ตอบแล้ว เพราะ `products` เป็น array เดิมที่ถูก mutate ในที่ จึงไม่ recompute → เปลี่ยนเป็น value + ล็อกด้วยเทสต์ว่า `factsBySku` แบบ cache ห้ามกลับมา)

## ตัวเลขที่วัดบน chromium (production build ของ branch นี้, harness อ่านอย่างเดียว)
`api-off` = จำลอง `/api/catalog` พัง (สถานะ crawler ก่อนJS load) · `api-on` = เสิร์ฟ response จริงจาก knightbasins.com

| กรณี | chips ที่แสดง | overflow ทั้งหน้า | overflow แถว chips |
|---|---|---|---|
| api-on @1440/390/360/320 | เคาน์เตอร์ 18 · ทรงสูง **10** · **เสาวางของตั้งพื้ น 2** | 0px ทุกจุด | 0px ทุกจุด |
| api-off @1440/390/360/320 | เคาน์เตอร์ 18 · ทรงสูง **10** · เสาวางของตั้งพื้ น (ชุดสำเร็จรูป) 2 | 0px ทุกจุด | 0px ทุกจุด |

- `pill` การ์ด KF029/KF030 (api-on) = `"เสาวางของตั้งพื้ น"` ตาม API · (api-off) = คำ fallback ของ data layer
- คลิกชิป shelf → เหลือ 2 ใบ `KF029, KF030` · ค้นหา `"เสา"` 2 ใบ · `"storage"` 2 ใบ · `"ทรงสูง"` 10 ใบ
- **baseline เทียบจริง:** production วันนี้ chips = `ทั้งหมด 30 · เคาน์เตอร์ 18 · ทรงสูง 12` และ**ไม่มีชิปของ shelf** (สองแถวถูกนับรวมใน "ทรงสูง")
- ภาพ + JSON: `qa/evidence/441b-v2/chips-with-api-1440.png`, `chips-with-api-360.png`, `browser-measurements.json`

## GOAL C — ตรวจว่าโค้ดชั้น UI ไม่อ่านตาราง static
ตรวจเฉพาะโค้ดจริง (ตัด comment ออกก่อนด้วย `codeOnly()`) ใน `src/App.tsx`, `src/components/StudioPage.tsx`, `src/components/catalogueCategoryFacts.ts` → **0 รายการที่อ้าง `BASIN_BOWL_SHAPES`** (ล็อกเป็นเทสต์)
`git diff --stat` ของ branch นี้ไม่มี `src/data/**`, ไม่มี `api-server/**`, ไม่มี `/price-guide`, ไม่มีราคา/ขนาด/ลำดับ

## GOAL D/E — เทสต์
`test/catalogue-category-chips.test.ts` (ใหม่ 11 เคส) + อัปเดต `test/studio-pillar-products.test.ts` ให้ตรงความจริงและ**ผ่านทั้งสองโลก** (ไม่ว่า 451-C จะเปลี่ยน static เป็น `storage` แล้วหรือยัง)
ครอบคลุม: ก่อนมี facts ใช้คำของ data layer (ไม่แต่ง) · หลังมี facts `value="storage"`, `label === "เสาวางของตั้งพื้ น"` เป๊ะ, `count === 2`, `fromRowsOnly === true` · 18/10/2 รวมเป็น 30 ไม่นับซ้ำ · แถวที่ไม่ส่ง label → `null` + fallback · `undefined/null/"[]"/ตัวเลข/whitespace` → ไม่มี facts · index รอบใหม่ได้ Map ตัวใหม่เสมอ (กัน stale) · แหล่ง call site เป็น helper ชุดเดียวกันทั้ง chip/pill/ค้นหา

| การรัน | ผล |
|---|---|
| baseline `main@65e866d` (เดวิดระบุ) | 1,341 → pass 1,299 / fail 0 / skip 42 · tsc 0 |
| branch นี้ (เต็ม suite) | **1,352 · pass 1,310 · fail 0 · skip 42** (+11 = เทสต์ใหม่) |
| 2 ไฟล์เทสต์ที่เกี่ียวข้อง | 16/16 pass |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `pnpm run build` (PORT=…) | exit 0 · prerender + production-assets OK |
| **proof สองทาง — ลบของ** | `catalogueGroupLabel` ทิ้ง `categoryLabel` จากแถว + ถอด `flex-wrap` → **fail 2/11** · คืนของ → 11/11 · suite 1,352/1,310/0 |

## ยกคืนให้ 451-C (ชัย) — ผมไม่แตะเพราะเป็นไฟล์ของเขา
1. `tallProducts` ของ KF029/KF030 ยัง `category: "tall vertical washbasin"` ทั้งที่ API = `storage` + `categoryLabel` (ใช้ diff จาก #534 ได้)
2. `basinProductFromCatalog()` ควร pass `categoryLabel` (และ `bowlShapeLabel`) ผ่านไปให้ model → เมื่อ land แล้วผมจะลบ cache ฝั่ง UI ให้เหลืออ่านจาก model จุดเดียว
3. `buildBasinProductsJsonLd()` ใน `src/data/structured-data.ts` ยังประกาศทุกแถวเป็น "อ่างล้างหน้าหินสังเคราะห์ … ขนาดเคาน์เตอร์ …" — ตรวจจาก HTML ที่ deploy จริง: `"sku":"KF029" … "description":"อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น KF029 … ขนาดเคาน์เตอร์ 400 × 400 × 1000 mm"` ⇒ **GOAL C เรื่อง JSON-LD ต้องเดินต่อใน 451-C/ใบใหม่ที่ให้แตะ structured-data** (ผมหยุดตาม FORBIDDEN ไม่เดาขอบเขต)

## ตรวจไม่ได้ (พร้อมเหตุผล)
- ตัวเลข `18/10/2` บน production — ต้อง merge + deploy (ตอนนี้ `18/12`)
- หน้าที่ render รายการอ่างใน path อื่น ๆ ที่ไม่ใช่ `App.tsx` (`src/pages/**` ไม่มีหน้ารายละเอียดรายรุ่นแบบแยก) → จึงไม่มีจุดวางเพิ่ ม
- `StudioPage.tsx:1858` ยังมี chip hardcode `{ value: "tall vertical washbasin", label: "ทรงสูง" }` (ตัวกรองในสตูดิโอ) — เป็นข้อมูลประจำไฟล์ ไม่อ่าน `categoryLabel`; ต้องเดวิดเคาะก่อน (ไม่เกี่ยวกับตัวนับในแคตตาล็อกที่แก้แล้ว) เพราะเปลี่ยนแล้วข้อความบนจอจะไม่ตรงกับข้อเท็จจริงของแถวตอนนั้น
- ภาพเต็มหน้าจอ 390 (ผม crop เฉพาะแถวชิป) — สั่งได้ถ้าต้องการเต็ม
- หน้าแอดมิน (ต้อง login ซึ่ง FORBIDDEN) ไม่เกี่ียวกับใบนี้

## ความเสี่ยง / ข้อเสนอ
- `src/App.tsx` มี 3 PR แตะพร้อมกัน: #536 (448-B) · branch นี้ (441-B v2) · และ 451-C ถ้าขยับ props ของ model → เสนอลำดับ **#536 → ใบนี้ → 451-C** แล้ว rebase ไล่ตัว
- helper `catalogueGroupLabel` เป็น entry point เดียวสำหรับ "คำหมวด" — ถ้า 451-C pass-through `categoryLabel` จริง คำนี้จะอ่านจาก model โดยอัตโนมัติ (cache กลายเป็น fallback)
- reminder จากงานก่อน: **ถอน PAT ที่หลุดในแชต**
