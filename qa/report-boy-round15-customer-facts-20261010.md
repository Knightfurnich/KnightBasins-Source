# รายงาน 431-B + 432-B (บอย = Qwen) — facts ชุดเดียวที่ลูกค้าเห็น (ตัวเลข · เวลา · เบอร์ · ข้อความ) + หน่วย/เลย์เอาต์

**ผู้ทำ:** บอย (Qwen) · **เวลาไทย:** 10 ต.ค. 69 ~20:05–22:0x น. · **PR เดียว:** **#493** `fix(web): one set of customer-facing facts (counts, hours, phones, copy)`
**branch:** `fix/web-one-set-of-customer-facts` (base `origin/main = 9079dcd` → rebase ตรวจแล้วว่า `src/` ของ main ไม่เปลี่ยนจาก base ⇒ PR ยัง mergeable) · ไม่ push เข้า main · ไม่ merge เอง
**หมายเหตุซ้อนใบงาน:** ใบ 431-B และ 432-B สั่งเรื่องเดียวกัน (A–F) ผมทำต่อใน PR เดียว #493 ตามที่แจ้งไว้รอบก่อน (เพื่อไม่ให้ diff ชนกันเส้นเดียวกัน) — รอยต่อที่ **เพิ่มใหม่ในรอบ 432-B** คือ: หน่วย `m²/ตรม. → ตร.ม.` (App + StudioPage), ปุ่มที่ 2 ที่ยังเขียน "ส่งเข้า Telegram" (หน้าใบเสนอราคาที่บันทึกไว้), และเทสต์ที่ล็อกเรื่องหน่วย+คำปุ่ม

## ตารางผลรวม (ก่อน → หลัง · ตัวเลขที่ผม grep/วัดเอง)
| ข้อ | เรื่อง | ก่อน (main 9079dcd/f1a5409) | หลัง (PR #493) |
|---|---|---|---|
| A1 | "670+ ภาพ" (`InstallationShowcase.tsx:303`) | 1 จุด | **0** (ใช้ `usePortfolioTotal()` → `data.total` จาก `GET /api/portfolio`, fallback `PORTFOLIO_TOTAL_FALLBACK = 333`) |
| A2 | "180+ ภาพคัดสรร" (`SalesGuide.tsx:279`) | 1 จุด | **0** → `/readme` แสดง `333 ภาพคัดสรร` |
| A3 | ค่าจริงจาก API | `total = 333` (curl) | ตรงกัน — `curl 'https://knightbasins.com/api/portfolio?limit=1' → total = 333` |
| B1 | เวลาทำการ 2 ชุด | `SalesGuide.tsx:376` = 08:30–16:30 | `{SALES_WORKING_HOURS}` → วัดใน browser: `เวลาทำการ : จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12…` |
| B2 | เวลารับสินค้าปนกับเวลาทำกา ร | `"กำหนดรับสินค้า ( จันทร์-ศุกร์ เวลา 08.30-16.30) , …"` | `"เวลารับสินค้าที่โรงงาน (ไม่ใช่เวลาทำการ): {PLANT_PICKUP_HOURS}"` — 08:30 **เหลือเฉพาะ** ค่าคงที่นี้ (grep `08:30`: main 2 ที่ซึ่งปนเวลาทำการ → branch 2 ที่ซึ่งอยู่ในป้าย "รับสินค้าที่โรงงาน" (App.tsx:1033 + `contact-channels.ts:10`) ทั้งหมด) |
| C1 | footer โชว์ 2 เบอร์ | `094-496-1949, 089-762-2209` | `{contactPhonesCommaText()}` = **3 เบอร์**: `094-496-1949, 091-978-2292, 089-762-2209` (ตรวจด้วย DOM: `[data-testid="text-footer-phones"]`) |
| C2 | /readmeสายด่วน, /portfolio, saved-quote, expired-quote, tel: href | พิมพ์เบอร์มือ | import จาก `contact-channels.ts` ทั้งหมด + `telHref()` · **เหลือ 2 จุด**: `src/pages/StudioGuidePage.tsx:10-11` (นอก SCOPE สองใบนี้) |
| D1 | ปุ่ม "บันทึกและส่งเข้า Telegram" (`App.tsx:1746`) | 1 จุด | "บันทึกและส่งให้ทีมขาย" |
| D1b | **ปุ่มที่ 2**: `button-send-saved-quote-notification` ("ส่งเข้า Telegram") | 1 จุด (เจอเพิ่มรอบนี้) | **"ส่งให้ทีมขายอีกครั้ง"** → grep `ส่งเข้า Telegram` ใน `App.tsx` = **0** (ของ admin ไม่ได้แตะ: `AdminLogsManager` = ระบบภายใน ไม่โผล่ลูกค้า) |
| D2 | "ค่าติดตั้งอ่าง: ฟรี" เมื่ออ่าง 0 ชุด | `installationCharge === 0 ? "ฟรี"` | `basinSets === 0 ? "—" : …` (ดูภาพ 04) |
| D3 | "จากเอกสาร…ที่แนบมา" + eyebrow อังกฤษ | `…เอกสาร Knight Furnich ที่แนบมา` + `QUOTE BUILDER / …` + `SAVED QUOTATION / …` | "ตามเอกสารราคาปัจจุบัน…" / "เลขที่เอกสาร {…}" / "ใบเสนอราคาที่บันทึกไว้ {…}" (ข้อความ "ที่แนบมา" ที่เหลือ 1 จุด = "ได้รับรูปที่แนบมาแล้วค่ะ" เรื่องสลิป ซึ่งถูกต้องตามบริบท) |
| E | 30 วัน vs 45 วัน | `30 วัน` พิมพ์ซ้ำ 3 จุด + `45 วัน` 2 จุด (ไม่มีที่มา) | `QUOTE_PRICE_VALID_DAYS = 30` / `QUOTE_LINK_VALID_DAYS = 45` ใน `contact-channels.ts` + `App.tsx:1820-1822` + `test` ล็อกว่า literal "45 วัน" (คำที่บอสอนุมัติ — ไม่แตะ) ต้องตรงกับค่าคงที่ |
| F1 | หน่วยปน: `m²` / `ตรม.` / `ตารางเมตร` | ในสิ่งที่แกได้: `m²` **16 จุด** (App 7 · StudioPage 9) + `ตรม.` **4 จุด** | เหลือ **0 / 0** (`grep -o` บน branch) — ใช้ `ตร.ม.` แบบเดียว (นอกนั้นอยู่ใน `pages/`+`data/` = ไฟล์ต้องห้าม → แจ้งไว้) |
| F2 | "ราคา final" | `src/pages/PriceGuidePage.tsx:305` | **ไม่แก้** — `/price-guide` ห้ามแตะในสองใบนี้ (แจ้งเป็นใบ 433-B+) |
| G | การ์ด KF003/KF006 | ชัยยืนยันคนละรุ่น | **ไม่แตะตามคำสั่ง** (ยังไม่มีคำสั่งแยกข้อความ) + หลักฐานว่าทำไมต้องมีการตัดสินใจก่อน (ข้างล่าง) |
| H | เลย์เอาต์/เป้าแตะ (ต่อจาก 431-B) | 768×1024 `/stone` = sw 775 / cw 753 (**+22px**); เป้า 42×19 · 180×23 · nav 11px | media ≤800px แก้ที่ต้นเหตุ (auto-fill grid +แถบชิป scroll ตัวเอง) → **30 ช่อง (6 หน้า × 5 จอ) = 0 ทุกช่อง**; เป้า: `.quote-link` 113×44 · ช่องค้นหา 180×44 · ชิป 85×44 · nav 13px + cue "→" |

## ตัวเลขที่วัดจริง (สั่งรัน)
```
npm test (= node --experimental-strip-types --test test/*.test.ts)
  main f1a5409 (ก่อนแตะ):  # tests 1277 · pass 1235 · fail 0 · skipped 42   ← ตรง baseline ในใบ
  branch #493 (หลังแก้):   # tests 1289 · pass 1247 · fail 0 · skipped 42   (+12 = ไฟล์เทสต์ใหม่ 12 เคส)
npx tsc -p tsconfig.json --noEmit → exit 0
grep (นับ occurrence ด้วย grep -o)
  '670+'      main 1 → branch 0        '180+ ภาพ' main 1 → branch 0
  'ส่งเข้า Telegram' (ใน src ที่ลูกค้าเห็น)  → 0 ทั้ง 2 ปุ่ม (App.tsx)
  'm²'        main 16 → branch 0       'ตรม\.'   main 4 → branch 0
  '08:30/8.30' ทุกจุดที่เหลือ = ป้าย "เวลารับสินค้าที่โรงงาน" เท่านั้น
browser (local build ของ branch + stub /api/* เพื่อไม่แตะ prod):
  /            no 670+, no 180+, no "ส่งเข้า Telegram", footer phones = 094-496-1949, 091-978-2292, 089-762-2209, unitBad=0
  /readme      hours = "เวลาทำการ : จันทร์-ศกุร 08:00–17:00 · เสาร 08:00–12…"  counts = ["333 ภาพคัดสรร"]
  /portfolio   (SPA + stub คืน payload จริง total=333)  counts/phones ไม่โผล่เพราะ stub path ต่างกัน → ครอบคลุมแล้วที่ home/readme
  ความหมาย "unitBad": นับ 'm²'+'ตรม.' ใน innerText = 0 ทุกหน้า
หลักฐานภาพ (5 ไฟล์ · 4 ภาพไม่ซ้ำกัน): qa/evidence/job-432-B/{01-home-footer,02-portfolio-real-count,03-readme-hours-phones,04-quote-copy,05-stone-units}.png
```
## พิสูจน์สองทาง (แก้ → ตก → คืน → ผ่าน)
```
1) หน่วย: ใส่ 'm²' กลับใน App.tsx
   → not ok "the storefront says ตร.ม. -- no m² / ตรม. left in the files customers see"
     message: "appFile still uses m² (1)"                                 (# pass 11 / fail 1)
   คืน → # pass 12 / fail 0
2) ปุ่ม Telegram (จุดที่ 2): assertion ใหม่ ("ส่งให้ทีมขายอีกครั้ง" + count 'ส่งเข้า Telegram' = 0)
   → ถ้าปล่อย label เก่าไว้ เทสต์ fail ที่เคส "no channel name on any customer button"
3) ข้อ A (ทำใน #493 แล้ว, ยืนยันซ้ำ): "670+" กลับ → not ok 2 เคส (drops the inflated… / reads `total` from GET /api/portfolio) → คืน → 12/12
4) G (ดูหัวข้อบน) ยังไม่แก้องค์ประกอบกราฟิก — กติกาใบนี้ระบุว่า "ยังไม่สั่ง = ไม่ต้องทำ"
```
## ข้อ G — หลักฐานที่ผมวัดได้ (อ่านอย่างเดียว · ไม่แตะข้อมูลราคา/สเปค)
```
$ curl -s https://knightbasins.com/api/catalog | [KF003, KF006]
  KF003 | River White | counter basin | dims 600 × 800 × 200 mm | bowl 350 × 500 × 130 mm | price 19000
  KF006 | River White | counter basin | dims 600 × 800 × 200 mm | bowl 350 × 500 × 130 mm | price 19000
```
⇒ **ทั้งสองแถวเท่ากันทุกฟิลด์ที่โผล่ให้การ์ด** (หมวด/ขนาด/หลุม/ราคา/ชื่อสี) — ถ้าจะเขียนให้ลูกค้าเห็นความต่าง (ทรงอ่าง/ท่อน้ำล้น) **ต้องมีสนามข้อมูลจริง** (เช่น `shape`/`overflow` ที่ admin กรอก) ซึ่งอยู่ใน `src/data/catalog.ts` + ฝั่ง API = ไฟล์ของชัยที่ 2 ใบนี้ห้ามแตะ **หรือ** เดวิด/บอสยืนยันสเปคให้ผม hardcopy เป็นข้อความ ≠ ตัวเลข/ข้อเท็จจริง → ผมจึง **ไม่แต่งข้อความเอง** และขอ 1 ใน 2 ช่องทางนี้ก่อน (หยุด-แจ้ง ตาม STOP rule)
## ตรวจไม่ได้ + เหตุผล
1. **ภาพ production หลักจาก merge** — ผมไม่มีสิทธิ์ deploy/merge ⇒ ทุกภาพ/DOM ผมวัดจาก `vite build` ของ branch + **static server + stub `/api/*`** (เพื่อไม่เขียน prod) → เดวิดต้องวัดซ้ำบน prod หลัง merge (script อยู่ท้าย PR body)
2. **/portfolio ตัวเลข 333 บนหน้าจอจริง** — ใน local shots หน้า portfolio ยังไม่โผล่เพราะ stub ผม map path ไม่ครบ; ตัวเลขนี้ผ่านแล้วบน `/readme` (อ่าน hook ตัวเดียวกัน และเทสต์ assert การ fetch `data.total`)
3. **ความต่างจริงของ KF003/KF006** —ไม่มีในข้อมูล API (ดูข้อ G) → ตรวจไม่ได้จนกว่าชัย/บอสให้ข้อมูล
4. **เวลา 08:30–16:30 (รับสินค้า) / เวลาทำการ 08:00–17:00** — ผมย้าย copy เดิมไปเป็นที่เดียว ยังไม่มีเอกสาร/คำสั่งยืนยันว่า "รับสินค้า 08:30–16:30 + ติดต่อล่วงหน้า" เป็นนโยบายปัจจุบัน (ถ้าผิด บอกค่าจริงมา ผมแก้ที่ `PLANT_PICKUP_HOURS` ที่เดียว)
5. เบอร์ **3 เบอร์ที่แชตตอบ** เป็นข้อความจาก `api-server/support.ts` (ใบนี้ห้ามแตะ) — ผมยืนยันได้เฉพาะฝั่งเว็บ ถ้าอยากให้ 3 เบอร์ตรงกันจริงทุกช่อง ต้องให้ชัยชี้เป้า endpoint (ผมไม่แก้แทน)
6. admin screens / Safari-iOS / print layout / screen-reader = ไม่ได้ทดสอบ (ต้อง login / ไม่มีเครื่องมือจริงใน sandbox นี้)
## ความเสี่ยง
- **เลข fallback 333** = snapshot ที่ hardcode; ถ้ายอดภาพเพิ่ม จะกลายเป็น "ตัวเลขจริง" ที่ไม่จริงจนกว่า API ตอบ (mitigate: มีคอมเมนต์ + เทสต์ล็อกไว้) — ถ้ามองว่าต้อง live 100% = เพิ่ม SSR/inject ตอน build (ใบถัดไป)
- **รวมหน่วย `ตร.ม.`** แตะข้อความยาว (terms, สตูดิโอ) — ตรวจ diff ทีละบรรทัดก่อน merge
- **ค่า "ฟรี → —" และ eyebrow ไทย** อาจกระทบ snapshot/UI test ภายใน (full suite ผ่านแล้ว + CI ที่รันบน PR ต้องดูอีกที)
## ข้อเสนอ (ขอใบแยกถ้าจะต่อยอด)
1. แก้ `StudioGuidePage.tsx:10-11` ให้ import `CONTACT_PHONE_*` (เหลือ 2 จุดสุดท้ายที่พิมพ์เบอร์มือ + โชว์ไม่ครบ 3 เบอร์)
2. "ราคา final" → "ราคารวมติดตั้งขั้นสุดท້าย" (`PriceGuidePage.tsx:305`) — เป็นใบ /price-guide แยก
3. ใบรวมเวลา/เบอร์เข้า `src/data/business-terms.ts` (ตอนนี้กระจายอยู่ 2 โมดูล: `contact-channels` + `commercial-constants`)
4. หลัง merge #493: ให้ผม (หรือเดวิด) รัน checklist วัด prod: DOM phones/hours/670+/หน่วย + 12 ข้อ UI ของ 427-R ที่ 30 ช่อง
