# รายงาน 431-B (บอย = Qwen) — ข้อความ/ตัวเลขชุดเดียวที่ลูกค้าเห็น + การแก้ 360/768

**ผู้ทำ:** บอย (Qwen) · **วันที่:** 10 ต.ค. 69 (ไทย ~20:05–21:05 น.) · **PR:** #493 · **branch:** `fix/web-one-set-of-customer-facts`
**commit:** `924774ae3eb5ad0bbfef984fe1f67d394c053124` (2026-10-10 20:30:46 +0800) · **baseline local:** `origin/main = 9079dcd`
**diff:** 9 ไฟล์ +240/−33 — `src/App.tsx` · `src/components/InstallationShowcase.tsx` · `src/components/SalesGuide.tsx` · `src/pages/PortfolioPage.tsx` · `src/data/contact-channels.ts` · เทสต์ใหม่ 1 ไฟล์ + แก้ assertion 3 ไฟล์
**กติกาที่ถือ:** ไม่แตะ `api-server/**` · ไม่แตะไฟล์ของชัย (`src/data/catalog.ts`) · ไม่แตะ KB/persona ไม่แตะ `/price-guide` · ไม่มี `overflow-x:hidden` ที่ html/body · ไม่ลบปุ่ม/ลิงก์ที่มีคนใช้ · ไม่ล็อกอิน/ไม่ส่งฟอร์มจริง · ไม่มีค่าลับ

---

## A. ตัวเลขภาพผลงาน = ของจริง (3 เลขขัดกัน → 1 แหล่ง)
**ก่อน** | `InstallationShowcase.tsx:303` = `ดูคลังผลงานทั้งหมด (670+ ภาพ)` · `SalesGuide.tsx:279` = `ชมภาพถ่ายงานติดตั้งจริง 180+ ภาพคัดสรร` · ค่าจริง `GET /api/portfolio → total: 333`
**หลัง** | เพิ่มใน `InstallationShowcase.tsx`:
```ts
export const PORTFOLIO_TOTAL_FALLBACK = 333;          // fallback จุดเดียว of the system
export function usePortfolioTotal(): string {          // อ่าน data.total จริงจาก /api/portfolio
  const { data } = useQuery<{ total?: number }>({
    queryKey: ["portfolio-total-count"],
    queryFn: async () => (await fetch("/api/portfolio", { headers: { Accept: "application/json" } })).json(),
    staleTime: 5 * 60 * 1000,
  });
  return typeof data?.total === "number" && data.total > 0 ? String(data.total) : String(PORTFOLIO_TOTAL_FALLBACK);
}
```
ใช้ทั้ง showcase (`({portfolioTotal} ภาพ)`) และ /readme (`{portfolioTotal} ภาพคัดสรร`)
**ตรวจ:** `grep -rn "670+\|180+ ภาพ" src` = **0 จุด** (ก่อนแก้ 2)

## B. เวลาทำการชุดหลัก + แยก "เวลารับสินค้า"
| ที่ | ก่อน | หลัง |
|---|---|---|
| `/readme` (`SalesGuide.tsx:376`) | `เวลาทำการ : จันทร์ – ศุกร์ 08:30 – 16:30 น. \| เสาร์ 08:30 – 11:30 น.` | `เวลาทำการ : {SALES_WORKING_HOURS}` |
| Saved quote (`App.tsx:1576`) | เวลาพิมพ์มือใน JSX | `data-testid="text-support-hours"` + `{SALES_WORKING_HOURS}` |
| กล่องสอบถาม (414-B/422-B) | — | อ่าน `SALES_WORKING_HOURS` จาก module เดียวกันอยู่แล้ว |
| `App.tsx:981` | `"กำหนดรับสินค้า ( จันทร์-ศุกร์ เวลา 08.30-16.30) , ( เสาร์ 08.30-11.30)"` | `"เวลารับสินค้าที่โรงงาน (ไม่ใช่เวลาทำการ): ${PLANT_PICKUP_HOURS}"` (export ใหม่) |
ค่ากลาง `SALES_WORKING_HOURS = "จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12:00"` (ตามบอสชี้ขาด) · `PLANT_PICKUP_HOURS = "จันทร์–ศุกร์ 08:30–16:30 · เสาร์ 08:30–11:30 (ติดต่อล่วงหน้า)"` = **ย้าย copy เดิมมาไว้ที่ค่าคงที่ ไม่ได้แต่งเวลาใหม่**

## C. เบอร์โทร (ก่อน/หลัง + grep)
- หลังแก้: footer =`{contactPhonesCommaText()}` · contact block = `contactPhonesText()` · สายด่วน /readme = `{contactPhonesCommaText()}` · /portfolio = `{contactPhonesCommaText()}` · ทุก `href="tel:…"` → `href={telHref(…)}` · `salesPhone: CONTACT_PHONE_BACKUP_SALES`
- ชุดค่า: `094-496-1949` (หลัก) · `091-978-2292` · `089-762-2209` — รูปแบบมีขีดหมด (มี `DISPLAY_PHONE_PATTERN` + เทสต์ล็อก)
```
$ grep -rn "09[0-9]-[0-9]{3}-[0-9]{4}" src --include=*.tsx
  src/pages/StudioGuidePage.tsx:10: const PHONE_PRIMARY = "094-496-1949";
  src/pages/StudioGuidePage.tsx:11: const PHONE_SECONDARY = "089-762-2209";   ← นอก SCOPE ใบนี้
```
⇒ เหลือ 2 จุดในไฟล์ที่ SCOPE ไม่ให้แตะ (และโชว์เบอร์ไม่ครบ 3 เบอร์) → ใบ 432-B/433-B ตามที่เห็นใน #492

## D. `/stone` ค้นไม่พบ → มีทางไปต่อ (ข้อความจริงที่ลูกค้าเห็น)
```
<div className="empty-state empty-state--stone" data-testid="status-stone-search-empty">
  <p data-testid="text-stone-search-none">{stoneSearchOtherMode
    ? `ไม่พบในโหมดนี้ — ${name} (${code}) จำหน่ายในโหมด“สั่งทำท็อป/เคาน์เตอร์ รวมติดตั้ง”|“ซื้อแผ่นเต็ม” เท่านั้น`
    : "ไม่พบรหัสนี้ในรายการขายปัจจุบัน · ถ้าเคยเห็นสีนี้มาก่อน อาจเป็นรุ่นที่ของหมด/รอของเข้า หรือยังไม่วางขายออนไลน์"}</p>
  <button data-testid="button-clear-stone-search-empty">ล้างคำค้น</button>
  <button data-testid="button-stone-search-switch-mode">สลับไปดูโหมดนั้น</button>   (เฉพาะเมื่อเจอในอีกโหมด)
  <a   data-testid="link-stone-search-contact">โทรหาทีมขาย 094-496-1949</a>        (เบอร์จากค่าคงที่)
</div>
```
- `stoneSearchOtherMode` = useMemo ค้น `stoneColorsByMode` ฝั่งตรงข้าม (case/space-insensitive ตรงกับที่ filter ใช้) → เคส `Whisper` จะบอกว่า `VW342` มีขายเฉพาะโหมดสั่งตัดพร้อมติดตั้ง
- แยกความหมาย **"ไม่มีในรายการขาย" vs "อาจของหมด/รอของเข้า"** ในข้อความเดียว แต่ **ยืนยันสถานะอัตโนมัติไม่ได้** (API คืนเฉพาะ `active=true` — ผมพิสูจน์ช่องนี้ไว้ตั้งแต่ 403-Q) → ต้องมีช่องสถานะจากชัย (ใบ 429-C) ถึงจะพูดได้เต็มปาก

## E. 3 ข้อความภายในหลุด (บอสให้เก็บ 3 จุด) — ทำครบ
1. `บันทึกและส่งเข้า Telegram` → **"บันทึกและส่งให้ทีมขาย"** (testid `button-send-quote-notification` คงเดิม)
2. `ค่าติดตั้งอ่าง` → **`—`** เมื่อ `basinSets === 0` (ไม่พิมพ์ "ฟรี" ไล่เมื่อไม่ให้อ่าง / ค่าจริงยังคำนามตามเดิม)
3. `source-note` "…จากราคา...จากเอกสาร Knight Furnich **ที่แนบมา** · ราคายังไม่รวม VAT 7%" → "…ตามเอกสารราคาปัจจุบันของ Knight Furnich · ยังไม่รวม VAT {VAT_PERCENT_LABEL}" และ eyebrow ภายใน `QUOTE BUILDER / …` → **"เลขที่เอกสาร …"**, `SAVED QUOTATION / …` → **"ใบเสนอราคาที่บันทึกไว้ …"**
- **ไม่ได้ทำ (รอคำสั่งบอส):** ลบลิงก์ `Private Workbench` + `v2.2.1` ออกจาก footer สาธารณะ — ใบระบุว่า "ตัวเลือก ไม่บังคับ" และ "ห้ามลบปุ่ม/ลิงก์ที่มีคนใช้" ผมจึงไม่เสี่ยงลบ; ถ้าบอสสั่ง เปิดใบสั้น ๆ ได้ (1 บรรทัด)

## F. อายุราคา 30 vs ลิงก์ 45 (ค่าคู่ + ไม่แก้คำอนุมัติของบอส)
- ใหม่ใน `contact-channels.ts`: `QUOTE_PRICE_VALID_DAYS = 30`, `QUOTE_LINK_VALID_DAYS = 45` — จุดที่ "ยืนราคา 30 วัน" ถูกพิมพ์ซ้ำ (หัวข้อเอกสาร, `ใช้ได้ถึง … · 30 วัน`, บรรทัดสรุปในข้อความ copy) อ่านจากค่าคงที่แล้ว (`grep ">ยืนราคา 30 วัน ·"` = 0)
- ข้อความ 45 วัน 2 จุด (`PAYMENT_SLIP_EXPIRED_MESSAGE`, `ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน)…`) เป็น **"คำที่บอสอนุมัติตรงตัว"** (ถูกล็อกใน `test/quote-security-and-expiry.test.ts`) ผม **คงอักษรเดิมไว้** แล้วเพิ่มบรรทัดคู่กัน `text-expired-quote-window` = "หมายเหตุ: ลิงก์เปิดดูได้ 45 วัน ส่วนราคายืน 30 วันนับจากวันที่ออกเอกสาร…" + เทสต์ log ว่า literal 45 ต้องตรงกับค่าคงที่ (กัน drift โดยไม่แก้คำอนุมัติ)
- ถ้าบอสต้องการ "เหลือ 30 วันอย่างเดียว" → เป็น **นโยบายใหม่** (กระทบอายุลิงก์สลิป) ผมไม่ตัดสินใจเอง

## G. หน่วย/รูปแบบ
- `m² → ตร.ม.` ทุกจุดที่เว็บแสดง (อัตรา `/ ตร.ม.`, "พื้นที่ติดตั้ง 0.72 ตร.ม.", "คิดตามพื้นที่ตัด (ตร.ม.)")
- สัญลักษณ์เงิน: ออกมาใช้รูปแบบ `฿{formatTHB(…)}` เพียงตัวเดียว ไม่ต่อท้าย "บาท" ซ้ำในจุดที่ผมแตะ + VAT % จาก `VAT_PERCENT_LABEL` (คำนวณจาก `VAT_RATE`) ไม่ใช่ literal `7%`
- "ราคา final" อยู่ใน **`src/pages/PriceGuidePage.tsx:305`** → `/price-guide` ห้ามแตะในใบนี้ จึงไม่แก้ (แจ้งไว้ให้เปิดใบ 433+)

## H. 360/768 — แก้อัตโนมัติที่ต้นเหตุ (ไม่มี overflow-x:hidden ที่ html/body)
- ต้นเหตุที่ 768: กริดสี `.stone-colors { grid-template-columns: repeat(5, 1fr) }` (`src/index.css:900`) ที่ item หดต่ำกว่า content ไม่ได้ + chip strip `flex:1; min-width:max-content` → เพิ่ม media `≤800px` ใน inline style ของ `App.tsx`: `repeat(auto-fill, minmax(150px,1fr))`, ให้ `.stone-search-row` wrap + `min-width:0`, `.stone-search-row input { min-height:44px; font-size:16px }`, `.stone-price-filters button { flex:0 0 auto; min-height:44px }` (แถบชิป scroll ตัวเอง), และ empty-state มีแถว action ชัีดเจน
- เป้าแตะ + ตัวอักษรเมนู nav (เดิม `font-size:11px; height:100%` ใน media ของ header): `min-height:44px; font-size:13px` + `.quote-link { min-width/min-height:44px }` + `::after content:"→"` เป็นสัญญาณว่าแถวยังมีรายการต่อ (เลื่อนได้)
- **ผลวัด (6 หน้า × 5 จอ = 30 ช่อง) บน build หลังแก้:** `scrollWidth − clientWidth = 0` **ทุกช่อง**
`/ , /stone , /portfolio , /price-guide , /quote , /network` × `1536×864, 1440×900, 1024×768, 768×1024, 390×844` (เช่น `/stone` 768×1024 → `iw 768 | cw 768 | sw 768`)
- **ก่อนแก้ (prod):** `/stone` 768×1024 = `iw 768 | cw 753 | sw 775` → **+22 px** (dev ของเดวิดวัด +4 px; ตัวการคือ chips `129px` right=775 และ `.stone-card-image-wrap` right=766)
- เป้าแตะ @390 (หลัง): `.quote-link` **42×19 → 113×44** · nav link **82–88×44, font 11px → 13px** + cue "→" · ชิปช่วงราคา **85×44** · ช่องค้นหา `/stone` **180×23 → 180×44 (font 14px)**

## I. ตัวเลขรันจริง + พิสูจน์สองทาง
```
$ cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts   (= npm test)
  ก่อน  : 1,267 tests · pass 1,225 · fail 0 · skip 42   (ตรงกับ baseline ในใบ)
  หลัง  : 1,287 tests · pass 1,245 · fail 0 · skip 42
$ npx tsc -p tsconfig.json --noEmit  → exit 0   (ทั้งก่อนและหลัง)
CI บน PR #493: "Validate release contents" pass · "Unit tests (api-server and knight-basins)" รันอยู่ ณ เวลาที่เขียนรายงาน
พิสูจน์สองทาง (แก้→ตก→คืน→ผ่าน):
  1) ใส่ "670+ ภาพ" กลับใน showcase -> not ok "drops the inflated 670+/180+ claims"
                                      not ok "reads `total` from GET /api/portfolio, with one shared fallback"  (27 pass/2 fail)
  2) ลบปุ่ม "ล้างคำค้น" ใน empty-state -> not ok "empty state has clear, other-mode switch and a call link"       (9 pass/1 fail)
  3) ลบ CSS grid auto-fill            -> not ok "does not mask overflow -- fixes the cause, and grows the small tap targets" (28/1)
  คืนทั้ง 3 -> 29/29 pass ใน 4 ไฟล์ที่เกี่ยว + เต็มชุด fail 0
assertion เก่าที่ล็อก copy ซึ่งใบนี้สั่งให้เปลี่ยน (เลื่อนไปที่ค่าคงที่ ไม่ใช่ลบการตรวจ):
  test/network-resilience-ui.test.ts:77  href="tel:0944961949"  -> href={telHref(CONTACT_PHONE_PRIMARY)} + ต้องมี CONTACT_PHONE_PRIMARY = "094-496-1949"
  test/quote-security-and-expiry.test.ts:22,39 '· 30 วัน' -> {QUOTE_PRICE_VALID_DAYS} + pin ค่าคงที่ 30/45
  test/stone-comparison-table.test.ts:75 source-note -> VAT {VAT_PERCENT_LABEL} (คงโครงสร้างเดิม/`;` ไว้)
```
ไฟล์แก้ไข 9 = `src/App.tsx` (96 บรรทัด), `InstallationShowcase.tsx` (22), `SalesGuide.tsx` (9), `pages/PortfolioPage.tsx` (3), `data/contact-channels.ts` (16), `test/customer-copy-consistency.test.ts` (ใหม่ 109), เทสต์เดืม 3 ไฟล์ (19) + รายงานนี้

## ตรวจไม่ได้ / ต้องมีคนอื่นปิดช่อง (ห้ามเดา → ระบุเหตุผล)
1. **ตัวเลขหลัง deploy บน production** — ผมไม่ push เข้า main และไม่ merge เอง ผมจึงวัดทุกอย่่างบน local build (`vite build` + static server + **stub `/api/*`** เพื่อไม่ให้เขียนระบบจริง) → ต้องให้เดวิดวัดซ้ำบน prod หลัง merge
2. **ยืนยันสถานะ "ของหมด/รอของเข้า" อัตโนมัติ** — `/api/catalog` คืนเฉพาะรายการ `active=true` (วัดตั้งแต่ 403-Q) ถ้าจะให้ข้อความแยกลูกค้าแบบแม่นต้องมี `status/hidden_reason` จาก API (ใบ 429-C ของชัย) หรือให้ sync KB export `hidden_colours` ให้เว็บอ่าน
3. **`PLANT_PICKUP_HOURS` (08:30–16:30 · เสาร์ 08:30–11:30 · ติดต่อล่วงหน้า)** เป็น copy เก่าย้ายมา ไม่ได้ Confirm ว่าเป็นนโยบายปัจจุบันของโรงงาน
4. **หน้า admin / การพิมพ์เอกสาร / LINE OA จริง** — ต้องล็อกอินและต้องไม่รบกวนลูกค้า (ห้ามในใบ)
5. **Safari/iOS ตัวจริง + screen reader** ที่ nav cue "→" และปุ่ม 44px — ผมมี Chromium อย่างเดียว (วัด 390/768/1024/1440/1536 ด้วย Chromium emulation)
6. `button-clear-stone-search` (ไอคอน X ในช่องค้นหา) เรเดอร์เฉพาะตอนมีคำค้น → วัด "missing" ตอนช่องว่างเป็นเรื่องปกติ (ไม่ได้ถูกลบ)

## ความเสี่ยง + ข้อเสนอ
- 🔴 `StudioGuidePage.tsx:10-11` ยังโชว์เบอร์ไม่ครบ (2 จาก 3) และพิมพ์เบอร์เอง — ต้องใบ 432/433 รวมเป็นค่าคงที่ (ผมแตะไม่ได้ตาม SCOPE)
- 🟠 fallback `333` ในโค้ดอาจถูกเข้าใจว่า "hardcode อีกแล้ว" — มีเทสต์ assert ว่าต้อง fetch `data.total` เป็นตัวจริง และ fallback ใช้เฉพาะตอน request ยังไม่กลับ
- 🟠 กริดสี 768–800px จาก 5 คอลัมน์ → auto-fill (อาจเป็น 4–5) ควรดูภาพจริงก่อน merge; และ `::after "→"` อาจต้องเก็บถ้าวันหนึ่ง nav ไม่เลื่อนแล้ว
- 🟡 `usePortfolioTotal` เพิ่ม 1 query ต่อ mount (staleTime 5 นาที) — ถ้า API portfolio ช้า ลูกค้าเห็น "333" ชั่วคราว
- 🟡 คำที่บอสอนุมัติ (45 วัน/ข้อความเป็นต้น) คงไว้ตรงตัว: ถ้าจะเปลี่ยนตัวเลขจริงต้องเปลี่ยนนโยบายก่อน code
- 🟡 "ราคา final" ที่ `/price-guide:305` และ "Private Workbench/v2.2.1" ใน footer ค้างอยู่ — ขอคำสั่งเป็นลายลักษณ์อักษรแล้วผมจัดในใบเดียว
