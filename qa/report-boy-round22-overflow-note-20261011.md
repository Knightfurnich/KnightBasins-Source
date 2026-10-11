# รายงานบอย รอบ 22 · 448-B — ข้อความรวมเรื่องรูน้ำล้น อ่านจาก API เท่านั้น

วันที่: 11 ต.ค. 69 (Asia/Bangkok) · ผู้ทำ: บอย (Qwen) · ผู้ตรวจรับ: เดวิด + บอส
Branch `feat/web-overflow-note-448b` · baseline `main@65e866d` (Linux sandbox, node v22.23.3, pnpm, รันโดยบอย)
ไฟล์ที่แตะ: `src/components/BasinOverflowNote.tsx` (ใหม่) · `src/App.tsx` (วางบรรทัด + ส่ง props) · `test/basin-overflow-note-ui.test.ts` (ใหม่) · หลักฐานใน `qa/evidence/448-fix/`

## 0. baseline (คำสั่ง+ผลจริง)
```
cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts
main@65e866d → # tests 1341 · pass 1299 · fail 0 · skipped 42      (เดวิดระบุในใบ: web 1,325→1,283 บน db34d101 ของวันก่อน)
npx tsc -p tsconfig.json --noEmit → exit 0
```
สัญญาฟิลด์จาก 447-C (ชัย, merge แล้วที่ `11a1b8e`): `GET /api/catalog` ส่ง `basinOverflowNote` ระดับแคตตาล็อก — ตรวจจริงวันนี้:

```
curl -s https://knightbasins.com/api/catalog | ... _keys_
top keys: [... , 'basinOverflowNote']
basinOverflowNote = "อ่างทุกรุ่นสั่งทำได้ทั้งแบบมีและไม่มีรูน้ำล้น (ปกติโรงงานทำให้แบบไม่มี) — ถ้าต้องการแบบมี แจ้งทีมขายได้"
KF001 / KF006 / KF029 → bowlOverflowHole: null (ทุกแถว)   ← ยืนยันว่าห้ามเขียนข้อความรายรุ่น
```

## A. แสดงข้อความรวม 1 บรรทัด โดยอ่านจาก API
- `BasinOverflowNote.tsx` — `overflowNoteFromCatalog(catalog: unknown)` คืนค่า `basinOverflowNote` แบบ trim **เท่านั้น**; ไม่มีค่า → `""` และคอมโพเนนต์ `return null` (ไม่เหลือ `<p>` เปล่า)
- วางที่ดัชนีแคตตาล็อก (จุดที่ลูกค้าดูการ์ดอ่าง) ทันทีเหนือ grid ของการ์ด: `<BasinOverflowNote catalog={catalog} />` + `HomePage` รับ `catalog={remoteCatalog}` เป็นอ็อบเจ็กต์ดิบจาก API (ไม่ผ่าน mapper ของชัย จึงไม่มีชั้นไหนแต่งข้อความ)
- `data-testid="text-basin-overflow-note"` + `role="note"` + `title` = ข้อความเดียวกัน (มีตัวเรนเดอร์เดียวในหน้า ไม่ใช่ต่อการ์ด)
- เรื่อง type: `useGetCatalog` คืน `Catalog` จาก `lib/api-client-react` (codegen) ซึ่ง**ยังไม่มีคีย์นี้** — แต่ client ใช้ `customFetch<Catalog>` (ไม่มีการ parse/strip) คุณค่า donc ถึงหน้าจอจริง ผมจึงอ่านผ่าน `unknown` ในคอมโพเนนต์แทนการแก้ codegen (ไฟล์นอก SCOPE) → **เสนอ**: ให้ regen OpenAPI/client ฝั่งชัยเมื่อสะดวก (ไม่ใช่ใบนี้)

## B. คงพฤติกรรมเดิมของการ์ด
การ์ดแต่ละใบยังแสดงเฉพาะ `bowlShapeLabel` และซ่อนเมื่อไม่มีค่า — เทสต์ล็อก `{bowlShapeText(product) && (` ไว้ และไม่มีที่ไหนเอา boolean `bowlOverflowHole` (ซึ่ง `null` ทุกแถว) มาประกอบเป็นข้อความ (ตรวจด้วย `!match /bowlOverflowHole[\s\S]{0,80}(มีรู|ไม่มีรู)/`)
หน้าจอจริงหลังแก้: `bowlShapeLines = 25` จาก 30 การ์ด เท่าก่อนแก้

## C. ไม่แตะไฟล์ข้ามเจ้าของ / ไม่แตะราคา / ไม่แตะ /price-guide
`git diff --stat` ของ branch นี้: `src/App.tsx` +3/−1 · file ใหม่ 2 · **ไม่มี** `src/data/**`, `lib/**`, `artifacts/api-server/**`, `src/components/PriceGuide*`, `src/index.css`
(รอบแรกผมเพิ่ม CSS ใน `src/index.css` 6 บรรทัด แล้ว**ย้อนทิ้ง**เพราะไม่ใช่ไฟล์ใน SCOPE — ย้าย layout ไปเป็น utility class บนตัวองค์ประกอบแทน `block mb-4 text-pretty leading-relaxed`)

## D. 390/360 ใช้ได้จริง (วัดจาก chromium บน production build ของ branch นี้)
`qa/evidence/448-fix/measured.json` + ภาพ `overflow-note-1440.png / -390.png / -360.png`

| viewport (css px) | ข้อความ = API แบบ byte-for-byte | lines | font / line-height | ข้างใน element ล้น (scrollWidth−clientWidth) | ทั้งหน้าล้นแนวนอน | การ์ด | บรรทัดรูปทรง |
|---|---|---|---|---|---|---|---|
| 1425 (1440) | ใช่ | 1 | 14px / 22.4px | 0 | **0** | 30 | 25 |
| 375 (390) | ใช่ | 2 | 14px / 22.4px | 0 | **0** | 30 | 25 |
| 345 (360) | ใช่ | 2 | 14px / 22.4px | 0 | **0** | 30 | 25 |

ไม่ได้ใช้ `overflow-x:hidden` ที่ไหนเลย; ไม่มี `truncate`/`line-clamp` on บรรทัดนี้ (ตัดบรรทัดแทนการตัดคำ)
หมายเหตุที่วัดได้: `src/index.css:2484` บังคับ `font-size: var(--storefront-copy-size) !important` กับ `p` ใน `.page-wrap` = 14px ทุกจอ ผม**ไม่แข่ง**กับมัน (ไม่ใส่ font-size/!important) — เป็นเหตุผลว่าทำไมตัวเลขบนจอเป็น 14px ไม่ใช่ 13px ที่ผมเคยเขียนไว้รอบแรก (รอบแรกแก้ทิ้งแล้ว เพราะเป็น dead CSS)

## E. เทสต์ + ตัวเลข
`test/basin-overflow-note-ui.test.ts` — 7 เคส (reader รันจริงผ่าน TS transpile + locks ระดับ source):
ค่าที่ API ส่งมาแบบ trim · ไม่มี/null/number/whitespace/ไม่ใช่ object → `""` ทุกกรณี · ห้ามมีข้อความ approved ปรากฏใน `BasinOverflowNote.tsx`, `App.tsx`, `StudioPage`, `SalesGuide`, `QuickFAQ` · ชื่อฟิลด์อยู่จุดเดียว · เรนเดอร์ตัวเดียว + `role="note"` + ซ่อนเมื่อไม่มีค่า · วางก่อน product grid + ส่ง `remoteCatalog` ดิบ · การ์ดยัง gate ที่ `bowlShapeText` · ไม่มี truncate/overflow-hidden/!important

```
node --experimental-strip-types --test test/*.test.ts
→ # tests 1348 · pass 1306 · fail 0 · skipped 42      (baseline 1341/1299 → +7 = ไฟล์ใหม่)
npx tsc -p tsconfig.json --noEmit → exit 0
PORT=… NODE_ENV=production pnpm run build → exit 0 (prerender 12 หน้า, production-assets OK)
```

**พิสูจน์สองทาง**
- ทางลบ: ใส่ fallback ที่โค้ดแต่งเองใน reader (`return "อ่างทุกรุ่นสั่งได้ทั้งมีและไม่มีรูน้ำล้น"`) → **fail 2/7** รวมทั้งเคส `'BasinOverflowNote.tsx prints the sentence itself'` และ `'says nothing when the catalogue says nothing'`
- ทางบวก: คืนโค้ด → **pass 7/7** (-suite ทั้งหมดยังเขียวตามตัวเลขข้างบน)

## ตรวจไม่ได้ / ไม่มั่นใจ
- **บน production จริงยังไม่เห็นบรรทัดนี้** — ต้อง merge + deploy (วัดบน build ท้องถิ่น + `/api/catalog` สด ไม่ใช่เว็บ production)
- จุดวางอื่น: `StudioPage` (ตัวเลือกอ่าง) และการ์ดรายใบยังไม่วางข้อความนี้ — ใบงานระบุ "1 บรรทัดที่จุดที่ลูกค้าดูอ่าง" ผมเลือกดัชนีแคตตาล็อก ถ้าเดวิดต้องการที่สตูดิโอด้วย บอกได้ (บรรทัดเดียว reuse ได้เลย)
- ข้อสังเกตจากหน้าจอของ branch นี้ (ยังไม่มีโค้ด 441-B): chips = `ทั้งหมด 30 · อ่างที่เลือก 0 · เคาน์เตอร์ 18 · ทรงสูง 10` — แถวเสา 2 ใบ **ไม่มีชิปของตัวเอง** (ถูกนับที่ "ทั้งหมด" อย่างเดียว) เป็นอาการเดียวกับที่ 441-B/#534 แก้ คนละงานกัน ไม่ปนกันใน PR นี้

## ความเสี่ยง
- `src/App.tsx` ถูกแตะทั้ง #534 (441-B) และใบนี้ → ถ้า merge คนละเวลาอาจ conflict ที่ `HomePage` signature/บรรทัด render (แก้ไม่ยาก, แนะนำ merge #534 ก่อนแล้ว rebase ใบนี้)
- ถ้าชัย regen client type แล้ว `Catalog` มี `basinOverflowNote` ตัวอ่าน `unknown` ยังทำงานปกติ (ไม่พัง) ไม่ต้องแก้ซ้ำ
