# รายงานบอย รอบ 21 · 441-B (เว็บต้องตรงกับ API) + 446-B รอบ 2 (`bowlShapeSource`)

วันที่: 11 ต.ค. 69 (Asia/Bangkok) · ผู้ทำ: บอย (Qwen)
PR: #534 `feat/catalog-api-parity-441b` (441-B) · #535 `fix/admin-bowl-shape-source-446b` (446-B รอบ 2)
Baseline: `main@59950f7` (441-B) · `main@65e866d` (446-B รอบ 2) · ผู้รัน: sandbox Linux, node v22.23.3, pnpm

---

## A. 441-B — KF029 / KF030 และความจริงเรื่องรูปทรงอ่าง

### A0 วัดก่อนแก้ (ของจริงทั้งหมด)
`GET https://knightbasins.com/api/catalog` บันทึก 11 ต.ค. 69 — basins 30 แถว

| รายการ | ค่าจาก API วันนี้ | ค่าที่โค้ดเว็บบอก (main@59950f7) |
|---|---|---|
| จำนวนตามหมวด | `counter basin 18 · tall vertical washbasin 10 · storage 2` | `counter basin 18 · tall vertical washbasin 12` (ไม่มี storage) |
| KF029 / KF030 | `category: "storage"`, `categoryLabel: "เสาวางของตั้งพื้น"`, `bowlShape: null` | `category: "tall vertical washbasin"` = ถูกนับเป็น "ทรงสูง" |
| คำแสดงต่อหมวด | `counter basin→"เคาน์เตอร์"`, `tall→"ทรงสูง"`, `storage→"เสาวางของตั้งพื้น"` | `legacyCategoryLabels` มี 2 คำ ⇒ แถว `storage` ไม่มีชื่อเป็นของตัวเอง |
| `bowlShapeLabel` | API ส่งเฉพาะรูปทรง เช่น `"หลุมสี่เหลี่ยมมุมมน"` | `BASIN_BOWL_SHAPES` ฝังในโค้ดต่อท้าย `" ไม่มีรูน้ำล้น" / " มีรูน้ำล้น"` — **ขัดกัน 15/25 แถว** |
| `bowlOverflowHole` | `null` ในแถวส่วนใหญ่ (รวม KF001/KF002 ที่ static ยืนยันว่า "ไม่มีรูน้ำล้น") | ฝัง boolean ไว้ในโค้ด |
| แถวที่ไม่มีรูปทรง | KF007, KF009, KF010, KF029, KF030 (5/30) | มีข้อความรูปทรงให้ทุกแถวเพราะ copies ในโค้ด |
| JSON-LD (`buildBasinProductsJsonLd`) | — | ขึ้นต้นทุกแถวด้วย `"อ่างล้างหน้าหินสังเคราะห์ … ขนาดเคาน์เตอร์ …"` = ประกาศกับ Google/AI ว่า KF029/KF030 เป็นอ่างล้างหน้า |

HTML ที่ deploy อยู่: `chips = ['ทั้งหมด 30', 'อ่างที่เลือก 0', 'เคาน์เตอร์ 18', 'ทรงสูง 12']` และ `title="หลุมสี่เหลี่ยมมุมมน"` (14 จุด) — เป็นสแนปช็อตก่อนฐานข้อมูลย้ายเสาเข้า `storage` (18+12=30 แต่ API วันนี้ 18+10+2)

### A1–A5 สิ่งที่แก้ (`src/data/catalog.ts`, `src/App.tsx`, `src/data/structured-data.ts`)
1. **ตัด `BASIN_BOWL_SHAPES` ทั้งก้อน** — แคตตาล็อกที่มากับโค้ดไม่มีความรวมของหลุมอีก (GOAL: ห้ามโชว์ข้อความที่ DB ไม่ได้บอก)
2. **`basinProductFromCatalog` ส่งผ่าน** `categoryLabel` · `bowlShape` (กรองกับ `BASIN_BOWL_SHAPE_VALUES` — ค่าไม่รู้จักกลายเป็น `undefined` ไม่เดา) · `bowlShapeLabel` · `bowlOverflowHole` (ไม่ใช่ boolean → `null`)
3. **ทิ้งทางคู่** `bowlShapeBySku` / `syncBowlShapesFromCatalog` / `bowlShapeForSku` → `bowlShapeText(product) = bowlShapeFromModel(product)` (แหล่งความจริงเดียว)
4. **หมวดเสาจากข้อมูลเครื่องจักรล้วน** — แถว内置ของ KF029/KF030 เปลี่ยนเป็น `category: "storage"` (ผ่าน `pillarCatalogFields`) โดย **ไม่ใส่คำไทยลงในโค้ด** ตาม FORBIDDEN ("ห้าม hardcode ประเภท/คำอธิบาย") — `grep -rn "ที่วางของ" src` → **ไม่พบ 0 รายการ**; ก่อน API ตอบยังอ่านผ่าน `PILLAR_PRODUCT_LABEL` (คำที่ใชามาตั้งแต่ job-279 )
5. **chip = ชื่อเดียวกับที่การ์ดใช้** — `visibleCategories` เติมหมวดที่ตาราง `categories` ไม่ครอบคลุม (แถว `storage` จึงมี chip ของตัวเอง ไม่หายไปและ ไม่ถูกนับรวมใน "ทรงสูง") และ `categoryWordings` เรียก `productCategoryLabel(product)` ตัวเดียวกับการ์ด → ไม่มีทางขัดกัน
6. **JSON-LD ไม่ประกาศเสาเป็นอ่าง** — `description` ขึ้นต้นด้วย `productCategoryLabel(product)` และเปลี่ยน `"ขนาดเคาน์เตอร์ …"` → `"ขนาดรวม …"` + เพิ่มคีย์ `category`

### หลักฐาน (เรียลรันไทม์ ดูไฟล์แนบ)
- `qa/evidence/441-fix/category-counts.txt` — ก่อน `18/12/-` → หลัง `18/10/2` = ตรงกับ API วันนี้ทุกครั้ง
- `qa/evidence/441-fix/cards-from-api.txt` — 30 แถวที่ map ผ่าน `basinProductFromCatalog()` จริง: label บนการ์ด, spec, บรรทัดรูปทรง, คำอธิบาย JSON-LD
  - KF029: `เสาวางของตั้งพื้น (ชุดสำเร็จรูป) · หินสังเคราะห์ Knight Basins รุ่น KF029 … ขนาดรวม 400 × 400 × 1000 mm` (ไม่มีคำว่า "อ่างล้างหน้า")
  - KF003: `เคาน์เตอร์ · … ขนาดรวม 600 × 800 × 200 mm หลุมอ่าง 350 × 500 × 130 mm` + บรรทัด `หลุมสี่เหลี่ยมมุมมน` (มาจาก API เท่านั้น)

### ตัวเลขเทสต์
| ขั้น | ผล |
|---|---|
| baseline `main@59950f7` | 1,325 / ผ่าน 1,283 / ตก 0 / ข้าม 42 |
| หลังแก้ทั้ง 441-B | **1,329 / ผ่าน 1,287 / ตก 0 / ข้าม 42** (+4: `test/structured-data-product-types.test.ts` 3 + net 1) |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `PORT=… pnpm run build` | exit 0 · production-assets OK |
| พิสูจน์สองทาง (เทสต์ใหม่ + โค้ดเก่า) | แดง: `'two-source plumbing reappeared'`, `'bowlShapeForSku is not defined'`, `'KF029 is published as a basin'` (9 เคสแดง/18) |
| พิสูจน์สองทาง (โค้ดใหม่) | เขียว 18/18 (studio-pillar + bowl-card) และ 3/3 (JSON-LD) |

### ตรวจไม่ได้ (พร้อมเหตุผล — ไม่แต่งตัวเลข)
- **ภาพการ์ด KF029/KF030 (EVIDENCE 2) — ได้แล้ว** ใน `qa/evidence/441-fix/`: `card-KF029-1440.png`, `card-KF029-390.png`, `card-KF030-1440.png`, `card-KF030-390.png` + `screen-readout.txt` (chromium บน production build ของ branch นี้ ผ่าน harness อ่านอย่างเดียวที่เสิร์ฟ `/api/catalog` จริง) ผลที่หน้าจอจริง:
  - `chips: ทั้งหมด 30 · อ่างที่เลือก 0 · เคาน์เตอร์ 18 · ทรงสูง 10 · เสาวางของตั้งพื้น 2` (ก่อนแก้ production = `เคาน์เตอร์ 18 · ทรงสูง 12` และไม่มีชิปของเสา)
  - การ์ด KF029 = `EG595 · Metallic Galaxy · เสาวางของตั้งพื้น · 400 × 400 × 1000 mm · ชุดสำเร็จรูป ไม่ต้องเจาะเคาน์เตอร์ · ฿16,000 / ชุด` — ไม่มีคำว่าอ่าง/ทรงสูง
  - การ์ด KF003 = `… หลุมอ่าง 350 × 500 × 130 mm · หลุมสี่เหลี่ยมมุมมน …` = ข้อความสั้นตามที่ API ส่ง (ไม่มีต่อท้ายเรื่องรูน้ำล้น)
  - `scrollWidth − clientWidth = 0px` ทั้งที่ 1440 และ 390 (เว็บลูกค้ายาวไม่ล้น)
- **chip บน production หลัง merge** — ต้อง deploy ก่อน (ของวันนี้ยังเป็นสแนปช็อตเก่า 18/12)
- GEO trade-off ที่ควรรับทราบ: เมื่อ API ไม่ตอบ HTML ที่ prerender จะ **ไม่มี** บรรทัดรูปทรงหลุม (เดิมมีข้อความเก่า) — แลกเพราะข้อมูลผิดแย่กว่าข้อมูลหาย; ทางออกคือให้ pipeline prerender เข้าถึง `/api/catalog` ได้จริง (ไม่ใช่ขอบเขตใบนี้)
- `src/components/StudioPage.tsx:1858` ยังมีชิป hardcode `{ value: "tall vertical washbasin", label: "ทรงสูง" }` (ตัวกรองในสตูดิโอ) — อยู่นอก SCOPE ของ GOAL A–C และแถวเสาถูกกันออกจากสตูดิโอแล้ว; เดวิดเคาะถ้าจะให้เอ API เป็นแหล่งเดียว

---

## B. 446-B รอบ 2 — `bowlShapeSource` เหลือ `database` / `none`

คำชี้แจงของชัยในใบ 441 (และคำตอบข้อ 4 ของเดวิดใน 446-B): ค่าที่เป็นไปได้มีสองค่า ไม่ใช่สาม

- `BOWL_SHAPE_SOURCES = ["database", "none"] as const` + `BowlShapeSource` + `isBowlShapeSource()`
- `sourceBadge()`: `database` → `(จากฐานข้อมูล)` (เปลี่ยนจาก `(ค่าที่แก้ไขเอง)` เพราะคอลัมน์พิสูจน์ได้แค่ "เก็บอยู่ในฐานข้อมูล" ไม่ได้บอกว่าใครแก้; caller ยัง override ข้อความได้) · `none` → `(ยังไม่ระบุ)` · ค่าอื่นทั้งหมด (รวม `builtin` เก่า, `"survey"`, `null`, `undefined`) → **เว้นว่าง** ไม่แต่งคำอธิบาย
- ลบ `case "builtin"` + ข้อความ `ค่าตั้งต้นของระบบ` และมีเทสต์ grep ล็อก level ไฟล์
- fixture KF006 ในเทสต์ `builtin → database`
- ข้อเท็จจริงประกอบ: บน `origin/main` คีย์ `bowlShapeSource` ปรากฏใน 3 ไฟล์แอดมินเท่านั้น **ฝั่ง server ยังไม่ส่ง** → badge ว่างทุกแถวทั้งก่อนและหลังแก้; เสนอชัย (445-C) ส่ง `bowl_shape IS NULL ? "none" : "database"` ต่อแถว
- ตัวเลข: baseline `main@65e866d` **1,341 / 1,299 / 0 / 42** → หลังแก้ **1,342 / 1,300 / 0 / 42** · `tsc` 0 · พิสูจน์สองทาง: โค้ดเดิม+เทสต์ใหม่ = แดง (import `BOWL_SHAPE_SOURCES` ไม่ได้), โค้ดใหม่ = เขียว 11/11

---

## C. สถานะอื่นที่ค้าง
- 450-B (แอดมิน responsive) merge แล้วใน `main` (`18832cb`) — ยังไม่ได้ตัวเลข 390/360 ต่อหน้าจริง เพราะหน้าแอดมินต้อง login (FORBIDDEN) และการวัดผ่าน session ปลอมเคยพลาดรอบก่อน; ถ้ามี test account read-only ผมจะปิดรอบวัด + ใส่ตารางเลขใน qa/
- 448-B **ยังไม่ได้เริ่ม** เพราะไม่มีตัวใบงานในรีโป: `grep -rn "448-B" origin/main` → ไม่พบไฟล์ และ `qa/` มีแค่ `job-441`, `job-446`, `job-447` — รอข้อความรวมจากชัย (447-C ข้อ C เข้า `main` แล้วที่ `11a1b8e`) หรือเดวิดโพสต์ใบ 448-B แล้วผมทำต่อได้ทันที
- ความปลอดภัย: PAT ที่หลุดในแชตยังควรถอน (แจ้งแล้วหลายรอบ)
