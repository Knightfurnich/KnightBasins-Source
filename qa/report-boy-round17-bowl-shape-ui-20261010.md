# รายงาน 439-B (บอย = Qwen) — การ์ดอ่างแสดง “รูปทรงหลุม” จากข้อมูลของ 438-C (KF003 ≠ KF006 แล้ว)

**ผู้ทำ:** บอย (Qwen) · **PR ใหม่:** `fix/web: show the bowl shape on the basin card so KF003 and KF006 differ` (branch `fix/web/bowl-shape-card-v2`, base `origin/main = 5623fe4`) — แทน **#510** (ซึ่งทำบน `6ef5fff` ตอนยังไม่รู้ว่าชัยใช้ชื่ออะไร; ปิดพร้อมเหตุผลแล้ว, งานทั้งหมดถูกรีเพลย์ที่นี่)
**เวลาไทยที่ทำ:** 11 ต.ค. 69 ~09:55–10:35 น. (commit `274f440` 08:49 น.; รอบแก้สัญญา+wrap 09:5x–10:3x น.)
**ไฟล์ที่แตะ (3):** `artifacts/knight-basins/src/App.tsx` · `artifacts/knight-basins/test/basin-bowl-shape-card.test.ts` (ใหม่) · รายงานนี้
**ไม่แตะ:** `src/data/**` และ `api-server/**` (ของชัย) · KB/ราคา/สี/ขนาด · `/price-guide` · ไม่มี `overflow-x:hidden` ที่ html/body · `git status --short` ก่อนเริ่ม = 0

## A — ใช้สัญญาณจริงของ 438-C ไม่ใช่ชื่อที่ผมเดา
PR #510 (เวอร์ชันแรก) ระบุคีย์ที่ “รอคอนเฟิร์ม” — ชัย merge **#507** แล้ว สัญญาจริงคือ
`bowlShapeLabel` (ข้อความที่แสดง) คู่กับ `bowlShape` (`"rounded-rectangle"|"oval"|null`) และ `bowlOverflowHole` (boolean|null) ซึ่งเป็น **ค่า machine → ห้ามพิมพ์ตรงๆ**
ผมจึง (1) ลด `BOWL_SHAPE_KEYS` เหลือ `["bowlShapeLabel"]` (เลิกเดา) (2) เทสต์ล็อกว่าถ้าันไปอ่าน `bowlShape` ต้อง fail
ค่าจริงที่ production API ส่งมา (วัดผ่าน proxy `http://localhost:3340/api/catalog` → `https://knightbasins.com/api/catalog`):
```
KF003  bowlShapeLabel = "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น"   (bowlShape="rounded-rectangle", bowlOverflowHole=false)
KF006  bowlShapeLabel = "หลุมวงรี มีรูน้ำล้น"               (bowlShape="oval",                bowlOverflowHole=true)
KF021  bowlShapeLabel = None      → การ์ดไม่ต่อท้ายอะไรเลย (รุ่นตรวจไม่ได้ = ว่าง)
```
### ช่องว่างที่เจอและวิธีปิดโดยไม่แตะไฟล์ชัย
การ์ดถูก compose ด้วย `remoteCatalog.basins.map(basinProductFromCatalog)` (`src/App.tsx:1908,1999`) และ **`basinProductFromCatalog` ประกอบอ็อบเจกต์จากรายชื่อฟิลด์ที่กำหนดไว้ตายตัว** ⇒ `bowlShapeLabel` ถูกทิ้งก่อนถึงการ์ด (ค่าอื่นที่ผ่านคือ `bowlMm/dimensions/price…`)
**ทางออก:** helper 3 ตัวอ่านจาก **raw rows** (`syncBowlShapesFromCatalog(remoteCatalog.basins)` ชวน cache ตาม `sku`, rebuild ทุกครั้งที่โหลดแคตตาล็อก ⇒ ไม่มีค่าค้าง) และ `bowlShapeText(product)` ตอบ **model ก่อน → แล้วค่อย cache** (ครอบคลุมทั้งข้อมูล built-in `PRODUCTS` ที่ชัยใส่ `BASIN_BOWL_SHAPES` ไว้ และเส้น API) — ยังไม่แตะไฟล์ของชัย 1บรรทัด และถ้าชัยส่งฟิลด์ผ่าน mapper ในอนาคต เทสต์ยังเขียว (ไม่กระทบ)

## B — จุดที่แสดง + เลย์เอาต์ (การ์ด 390/360 ต้องไม่เสียหาย)
บรรทัดย่อยใต้สเปกเดิม: `mt-1 text-xs leading-snug text-[var(--ink-soft)] line-clamp-2 [overflow-wrap:anywhere]` + `title` เต็ม
> ระหว่างทางผม **เจอที่ตัวเองแก้ไม่ถูก**: ตอนแรกใส่ `truncate` → วัดจริงที่ 390/360 คือ **ถูกตัด (clipped=true, scrollW 166 > clientW 139/126)** ซึ่งบังคำสำคัญ (“ไม่มีรูน้ำล้น” vs “มีรูน้ำล้น”) ที่ใบนี้ต้องการแสดง → เปลี่ยนเป็น wraps + `line-clamp-2` แล้ววัดซ้ำ: `clipped=false`, `lines=2`, `h(KF003)=39px / h(KF006)=19px`
ล้นแนวนอน (build ของ branchนี้ + API จริงผ่าน proxy): `390 → iw390|cw375|sw375 over=0` · `360 → iw360|cw345|sw345 over=0` · `768 → iw768|cw753|sw753 over=0` · `1440 → over=0`

## C — ถ้อยคำ = ตามข้อมูล ไม่ thêm คำโฆษณา
ไม่มีข้อความรูปทรงอยู่ในโค้ด: `grep -rn "หลุมสี่เหลี่ยม|หลุมวงรี|รูปทรงหลุม" src/App.tsx src/components src/pages` = **0**
คำที่เห็นใน UI มาจาก `bowlShapeLabel` ของชัย (`src/data/catalog.ts` `BASIN_BOWL_SHAPES` = ที่เก็บข้อมูลจริง (ไฟล์ชัย)) และ fixtures ในเทสต์ใช้คำปลอม `TEST-LABEL-A/B` เท่านั้น (ไม่เลียนแบบ copy จริงให้เป็น test oracle)

## D — ตัวเลขเทสต์จริง (บน tree นี้)
```
node --experimental-strip-types --test test/*.test.ts
  baseline (ไม่รวมไฟล์ใหม่ของฉัน):  # tests 1302 · pass 1260 · fail 0 · skipped 42
  รวมไฟล์ใหม่ (หลังแก้):           # tests 1314 · pass 1272 · fail 0 · skipped 42      (+12 = ไฟล์ใหม่)
  เทสต์ใหม่ 12 เคสผ่านหมด
node --experimental-strip-types --test test/basin-bowl-shape-card.test.ts → # tests 12 · pass 12 · fail 0
npx tsc -p tsconfig.json --noEmit → exit 0
node scripts/verify-production-assets.mjs (ผ่าน pnpm build) → OK
```
**ครอบคลุม 4 กรณีที่ชัอย้ำในใบ 438 ข้อ 8** (ไม่มีข้อมูล → ว่าง / label ผ่าน `bowlShapeLabel` อย่างเดียว / re-sync แล้วค่าหาย → ต้องล้าง / sku ไม่รู้จัก → ว่าง)

## พิสูจน์สองทาง (ทุกข้อที่แก้ ต้องตกเมื่อถอน)
```
1) ถอด syncBowlShapesFromCatalog(remoteCatalog.basins) (เส้น API)
   → not ok "feeds the cache from the raw rows on every catalogue load"          (11 pass / 1 fail)
2) สลับคีย์เป็นตัว machine ("bowlShape") แทน "bowlShapeLabel"
   → not ok "reads bowlShapeLabel verbatim and trims it" (actual: '')
   → not ok "prints none of the machine fields"          (actual: 'rounded-rectangle')
   → not ok "no shape sentence is hard-coded in the app"                         (fail หลายเคส)
3) ให้ accessor แต่งคำเองเมื่อไม่มีข้อมูล (return "INVENTED-PLACEHOLDER")
   → not ok "prints none of the machine fields" / "nothing at all when the row has no label"
   → not ok "falls back to the raw /api/catalog rows…" / "resync clears stale labels…"
4) คืนโค้ดทั้งหมด → 12/12 pass · เต็มชุด fail 0
```

## หลักฐานภาพ (local build ของ branch นี้ + proxy ไป `https://knightbasins.com/api/*` → ค่าจริงจาก 438-C)
| ไฟล์ (sha256 12 ตัวแรก) | เห็นอะไร |
|---|---|
| `41-KF003-1440.png` `cdd569a8a8b9` | การ์ด `KF003` ใต้สเปก: บรรทัด “หลุมสี่เหลี่ยมมุมมน ไม่มีรูน ้ำล้น” (1 บรรทัด, `279px`, ไม่ถูกตัด) |
| `42-KF006-1440.png` `200b9783366d` | การ์ด `KF006`: “หลุมวงรี มีรูน้ำล้น” — **ต่างจาก KF003 ชัดเจน** |
| `44-KF003-390-wrap.png` `7d729abfbd05` | 390×844: ข้อความเต็ม 2 บรรทัด สูง `39px`, `clipped=false` |
| `44-KF006-390-wrap.png` `2a4a43ed7463` | 390×844: 1 บรรทัด สูง `19px`, `clipped=false` |
| `45-overflow-360.png` `a2ce22277ce1` | 360×800 ไม่มีล้น: `cw=345 sw=345 over=0` |
| `20-KF003-1440.png` `6d9bd285098e` · `23-KF006-390.png` `bc583d6bc753` | **baseline ก่อนแก้ (production)**: สองการ์ดเหมือนทุกบรรทัด ต่างแค่รหัส |
(เก็บไฟล์ไว้ที่ `output/evidence-job439-B/` ใน sandbox ของผู้ตรวจ — ส่งเข้ากลุ่มไม่ได้ แจ้งถ้าต้องการให้แนบเป็น attachment)

## ตรวจไม่ได้ (พร้อมเหตุผล — ไม่เดา)
1. **ภาพบน production domain จริง** — ต้อง merge + deploy ก่อน (ภาพทังหมดวดจาก local build ของ branch + proxy ไป API จริง)
2. **ถ้อยคำถูกต้องตามสินค้าจริง** — เป็นสัญญาของ 438-C (ชัยตรวจภาพจริง+437-C) ผมไม่ยืนยันซ้ำเพราะไม่เห็นภาพถ่ายจริงด้วยตัวเอง
3. **หน้า admin ที่บันทึก/แกค่านี้ใน DB** — ห้าม login (FORBIDDEN) และ API path อ่านจาก `lib/basin-bowl-shape.ts` ของชัย
4. **การ์ดหน้าอื่นทไี่ ม่ใช่ Storefront card** (หน้าผลงงาน/กล่องสอบถาม/สตูดิโอ ยังไม่แสดงคำถทยมถ้าไม่ได้สั ง — ใบน้ีกำหนดเฉพาะการ์ด); ต้องการใหไ่ ปทุกหน้า = เปิดใงานถยใหม่
5. **Safari/iOS** — sandbox มี Chromium

## ความเสี่ยง
- Cache `sku→label` เป็น state ต่อโมดูล ถูก refresh ทุกครั้งที่โหลดแคตตาล็อก ⇒ เสี่ยง “ค่าค้าง” ต่ำ แต่ **ถ้าโหลด API ล้มเหลว ฉันคงค่าชุดล่าสุด** (ไม clear) — มองว่าถูก (ข้อมูลล่าสุดทนี่่าเชื่อถือ) ถ้าตองการให้เห็นว่างทนที บอกได้
- คัดลอกฟิลด์ใน App เทาั นั้ น = ถ้า API เปลี่ยนชื่ อ (`bowlShapeLabel` → เช่น `bowlShapeDisplay`) จะ **ว่างเงียบ** (ไม่ error) — เทสต์ 1 เคสจับไว้แลวถ้าืนชื่อในไฟล์ชัย
- `line-clamp-2` อาจปัดการ์ดบางรุ่นสูงขึ้ น ~20px (วัดแล้วไม่ล้น) — ควรดูถาพรวมก่อน deploy
- ถ้าชัยส่ง `bowlShapeLabel` ผ่าน `basinProductFromCatalog` ภายหลัง cache ของฉนั จะ redundancy แต่ไม่ conflict

## ข้อเสนอ (ใบตอ่ ไป — 3 ข้อ)
1. ให้ **436-C/438-C move `bowlShapeLabel` onto `BasinProduct` via `basinProductFromCatalog`** (1 บรรทัด) → ผมลบ cache+sync (~25 บรรทัด) ให้งานบางลง
2. เพิ่มคำนี้ **บนหน้า product + กล่องสอบถาม + LINE brief** ถ้าบอสต้องการให้ลูกค้เห็นทุก touchpoint (ตองแก API copy ของชัย)
3. เพิ่ม UI test ที่ validate ว่า label ไม่ถูก truncate บน 360/390/768 (ตอนนี้ lock ผ่าน source assertions + ฉันวดมื อด้วย CDP แลว)
