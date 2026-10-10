# รายงาน 422-B (บอย = Qwen) — ข้อความ/เบอร์ที่ลูกค้าเห็น + ปุ่มลอยทับปุ่ม LINE + sitemap lastmod

**วันที่:** 10 ต.ค. 69 · ช่วงทำ 14:35–16:3x น. (ไทย) · **baseline:** `origin/main = 77b04f1` (#480)
**PR:** #481 · branch `fix/web-customer-text-consistency-422-b` · commit `243833638da0a3988759d8d299b14f2cc70d5aa8` (+ commit ของรายงานนี้)
**ขอบเขตที่แก้จริง (7 ไฟล์):** `src/components/PortfolioInquiryModal.tsx` · `src/components/KnightSupport.tsx` · `src/data/contact-channels.ts` (ใหม่) · `test/customer-facing-consistency.test.ts` (ใหม่) · `test/portfolio-inquiry.test.ts` · `public/sitemap.xml`
**ไม่แตะ:** `artifacts/api-server/**` · ราคา/สี/จำนวนสีใน `catalog.ts` · เนื้อหา `/price-guide` · **ไม่ลบชื่อ "น้องไนท์"** · **ไม่ใส่ `overflow-x:hidden` ที่ html/body** · **ไม่ลบปุ่มช่วยเหลือ** · ไม่ push main · ไม่ merge

---

## A. "ส่งฟอร์มแล้วเกิดอะไรต่อ" — แก้แล้ว
| | ก่อน | หลัง |
|---|---|---|
| หน้าจอ | `ทีมงาน Knight Furnich ได้รับข้อมูลแล้ว จะติดต่อกลับอย่างรวดเร็วที่สุดครับ` | `ทีมขาย Knight Furnich จะติดต่อกลับภายใน 24 ชั่วโมง (จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12:00) ครับ` + ลิสต์ 3 ข้อ: **ทีมโทรเข้าเบอร์ที่กรอก (ไม่ต้องพิมพ์ซ้ำ)** · **เบอร์สำรอง 094-496-1949 (คลิกโทรได้) / 094-496-1949 · 091-978-2292 · 089-762-2209** · **เช็กสถานะ: ถามน้องไนท์ในแชทมุมขวา หรือตอบกลับใน LINE @789gcnhq** |
| testid | — | `list-inquiry-next-steps`, `text-inquiry-backup-phone` |
| ที่มาตัวเลข | — | ย้ายมาจาก copy ที่มีอยู่แล้วในเว็บ **ไม่ได้อธิษฐานขึ้นเอง**: `src/App.tsx:1479` (“…จะติดต่อกลับภายใน 24 ชั่วโมงทำการ”), `src/App.tsx:1498` (เวลาทำการ), `LINE_OA_MENTION` ในไฟล์ modal |

## B. `data-testid` ซ้ำ — จบด้วยการเปลี่ยนฝั่งกล่องสอบถาม
`button-line-login` → **`button-line-login-portfolio`** เพราะ `LineLoginButton` (`KnightSupport.tsx:15`) ใช้ค่า default นี้ทั้งใน header และในระบบ guest-scope UI ที่มี assertion เดิมผูกอยู่ (`test/support-guest-scope-ui.test.ts:28,39`)
```
modal : data-testid="button-line-login-portfolio" ×1 | data-testid="button-line-login" ×0
support: testId = "button-line-login" ×1 (default คงเดิม)
```

## C. เบอร์ลูกค้าเห็น = แหล่งเดียว (เฉพาะสิ่งที่ใบนี้ให้สิทธิ์)
`src/data/contact-channels.ts`: `CONTACT_PHONE_PRIMARY/BACKUP_SALES/BACKUP_TEAM` + `CONTACT_PHONES` (เรียงหลัก→สำรอง) + `DISPLAY_PHONE_PATTERN` (บังคับ **มีขีด**) + `telHref()` (href ไม่มีขีดตาม convention ของ `tel:`) + `FORBIDDEN_CUSTOMER_PHONES`
```
$ grep -rhoE '0[0-9]{2}-[0-9]{3}-[0-9]{4}' src/components src/data | sort | uniq -c
   6  094-496-1949      4  089-762-2209      2  091-978-2292        (ทั้งหมดมีขีด)
$ grep -rnE '"0[0-9]{9}"' src/components src/data
   src/data/contact-channels.ts:23 → เฉพาะอาเรย์ "ห้ามใช้" ไม่ใช่ตัวเลขที่โชว์
modal ไม่มีเบอร์ hardcode (เทสต์ strip `telHref(...)` แล้ว grep `0dd-ddd-dddd` = 0 รายการ)
```
**ของเหลือที่ขอการตัดสิน (ไม่แก้เอง):**
1. `src/components/WorkshopProductionSheet.tsx:25` = `phones: "02-583-0599, 080-606-4444"` — เป็นเอกสารฝ่ายผลิต และ `grep -rn "WorkshopProductionSheet" src` → **ไม่มีผู้นำไป render** ใน `src` ปัจจุบัน · ถ้าจะแก้ = ต้องยืนยันว่าเบอร์โรงงาน `02-583-0599` เก็บไว้ไหม (ผมเดาไม่ได้)
2. `061-845-9666` อยู่ใน `artifacts/api-server/src/routes/support.ts` (ขอบเขตชัย · ใบ 421-C) ⇒ **เบอร์ที่ลูกค้าเห็นในแชทมาจากที่นั่น** ถ้าไม่แก้พร้อมกัน เป้าหมาย "เบอร์ชุดเดียว" จะยังไม่จริงทุกพื้นผิว
3. **ขอแก้ข้อมูลที่ผมรายงานผิดใน 420-B:** `0135553014` ไม่ใช่เบอร์ทดสอบ — เป็น **9 ตัวแรกของเลขประจำตัวผู้เสียภาษี** `0135553014114` ในไฟล์เดียวกับข้อ 1
4. `App.tsx` (`:268,937,1271,1496,2148,2152`) และ `SalesGuide.tsx:364` ยัง hardcode เบอร์ (นอก SCOPE ใบนี้) → เสนอใบเก็บกวาดต่อให้มากิน `contact-channels.ts`

## D. ปุ่มลอยทับปุ่ม LINE ที่ 360px — แก้เชิงโครงสร้าง + วัดต่อไม่ครบ
**สิ่งที่ทำ (ซ่อน ไม่ได้ลบ, ไม่แตะ overflow):**
- modal → `useEffect` ประกาศ `window.dispatchEvent(new CustomEvent(OVERLAY_OPEN_EVENT,{detail:{open:true}}))` ตอนเปิด และ `announce(false)` ตอน cleanup · `OVERLAY_OPEN_EVENT` เก็บใน data module ตัวเดียว (ทั้งสองฝั่ง import ไม่ copy string)
- KnightSupport → `useEffect` addEventListener → state `coveredByOverlay` → launcher ติด `data-overlay-covered="true"`, `aria-hidden`, inline `visibility:hidden; pointerEvents:none` (มีคอมเมนต์กำกับ: no phantom hit area) + เทสต์ assert ว่า **ไม่มี** `if (coveredByOverlay) return null` (= ซ่อน ≠ ลบ)
**สิ่งที่วัดได้/ไม่ได้ (ตรงไปตรงมา):** ผมวัด production ด้วย Chromium ผ่าน Playwright-cli ที่ 360×800/1280×900 — ปุ่มขอราคาบนการ์ดมีจริง (rect @360×800 = `x17 y669 w148.5 h62`, จำนวน 60 ปุ่ม) แต่ **`.knight-support-trigger` คืน `null` ทั้งสองขนาด** (launcher ไม่ถูก mount ขณะผมวัด — เป็น guest ไม่ได้ล็อกอิน/หรือ mount เงื่อนไขอื่น) ⇒ **ยืนยันภาพ "ก่อนแก้" เองไม่ได้ = ตรวจไม่ได้ + เหตุผล** · เดวิด/รีพิตช่วยวัดซ้ำด้วยวิธีที่ทำให้ widget mount แล้ว assertcontractใหม่: `data-overlay-covered === "true"` ขณะเปิดกล่อง + `boundingBox()` ของ `button-inquiry-line` ไม่มีอะไรทับ · วิธีรันอยู่ในเทสต์ + snippet:
```js
await page.setViewportSize({width:360,height:800}); await page.goto('/portfolio');
await page.locator('[data-testid^="button-inquire-"]').first().click();
await expect(page.locator('.knight-support-trigger')).toHaveAttribute('data-overlay-covered','true');
await page.locator('[data-testid="button-inquiry-line"]').click();   // ต้องไม่ timeout
```

## E. `lastmod`
```
$ curl -s https://knightbasins.com/sitemap.xml | grep lastmod      →  "ก่อน" (prod ตอนนี้)
   /  2026-09-25 · /stone 2026-09-25 · /price-guide 2026-10-07
ไฟล์ใน PR  →  / 2026-10-10 · /stone 2026-10-10 · /price-guide 2026-10-10   (หน้าอื่นคงเดิม: updates 10-02, network 10-05, ที่เหลือ 09-25)
$ git log -1 --format='%ci' -- src/pages/PriceGuidePage.tsx              → 2026-10-10 09:56 (413-C)
$ git log -1 --format='%ci' -- src/components/PortfolioInquiryModal.tsx  → 2026-10-10 (414-B; ใช้บน / และ /stone)
```
**ทำอัตโนมัติไม่ได้ในใบนี้** เพราะต้องแตะ `scripts/prerender.mjs` / build pipeline (นอก SCOPE) ⇒ ชัดเจนว่า **อัปเดตด้วยมือ 10 ต.ค. 69 16:0x น.** และผูกไว้ 2 ชั้น: (ก) เทสต์ 1 เคสบังคับว่า 3 หน้านี้ = 2026-10-10 (กันถอยหลังเงียบ ๆ) (ข) เช็คลิสต์ deploy ที่เสนอ: ก่อน merge ดูว่า `lastmod` ของหน้าที่ source เปลี่ยน (เทียบ `git log -1 --format=%cd -- <route src>`) ตรงกัน ไม่ใช่ไฟล์ sitemap เก่า
> **ข้อเสนอ ถ้าจะให้อัตโนมัติจริง (ใบหน้า):** ให้ build เขียน `lastmod = mtime/git-date ของ entry file ต่อ route` → `public/sitemap.xml` ตอน `vite build` แล้ว assert ด้วย `verify-production-assets.mjs`

## F/G. ตัวเลข + คำสั่งที่รันจริง (EVIDENCE)
| # | คำสั่ง | ผล |
|---|---|---|
| 1 | `git diff --stat` / `git log -1 --format=%H` | `6 files changed, 214 insertions(+), 7 deletions(-)` (ก่อนรวมรายงานนี้) · HEAD `243833638da0a3988759d8d299b14f2cc70d5aa8` |
| 2 | `npx vitest run` **(เกณฑ์ในใบ — ใช้ไม่ได้จริง)** | `npm error npx canceled due to missing packages … vitest@5.0.3` · ไม่มี vitest ใน `package.json` และ `scripts.test = node --experimental-strip-types --test test/*.test.ts` ⇒ **ของให้แก้เกณฑ์เป็น node:test** — ผลจริง: ก่อน `# tests 1258 · pass 1216 · fail 1 · skipped 42` → หลัง `# tests 1267 · pass 1225 · **fail 0** · skipped 42` (fail 1 ก่อนแก้ = assertion ที่ล็อก copy เก่าของ `test/portfolio-inquiry.test.ts` ซึ่งต้องอัปเดตตาม copy ใหม่ — อัปเดตแล้ว + มี assertion ระวังไม่ให้ความหมายหาย) |
| 3 | `npx tsc -p tsconfig.json --noEmit` | **exit 0** |
| 4 | `curl …/sitemap.xml` | `09-25 / 09-25 / 10-07` (prod ก่อน deploy) vs `10-10 ×3` (ใน PR) |
| 5 | จอ 360 | ดูข้อ D — launcher ไม่ mount ขณะวัด ⇒ ตรวจไม่ได้ (พร้อม snippet ให้รันต่อ) |
| 6 | grep เบอร์ | **หลังแก้** (วัดเองใน `src/components` + `src/data` ขอบเขตเดียวกัน): `094-496-1949` ×6 · `089-762-2209` ×4 · `091-978-2292` ×2 · ทั้งหมดมีขีด · no-hyphen ไม่เจอใน display (เจอกับ `"0[0-9]{9}"` 1 lần = อาเรย์ FORBIDDEN ใน data module) · **ก่อนแก้** ไม่ได้ snapshot ขอบเขตเดียวกันไว้ — ตัวเลข repo-wide ตอนต้นใบ (`094-496-1949` 8 ไฟล์ · `0944961949` 4 ที่ (tel: href/tests ใน `App.tsx`) · `080-606-4444` 4 ที่ · `061-845-9666` 4 ที่) คนละหน่วยนับ (ไฟล์/ occurrence + ข้ามโปรเจกต์) จึงไม่เคลมว่า "ลดกี่แห่ง" แต่ 4 รายการนั้นยังอยู่ ณ ตอนนี้: 2 อยู่ใน `App.tsx`/`WorkshopProductionSheet.tsx` (นอก/ครึ่งกลาง scope) และ 2 อยู่ใน `api-server/support.ts` (ชัย) |
| 7 | `grep -rn "button-line-login" src` | modal ไม่เหลือของเดิม (assert ×0) · `-portfolio` ×1 · เทสต์ผ่าน |
| 8 | พิสูจน์สองทาง (A) | ลบ `<ul data-testid="list-inquiry-next-steps">` → fail 2: *replaces the vague 'will contact soon'…* + *the modal never hand-writes a phone number…* · คืนไฟล์ → `9 tests · 9 pass · 0 fail` |
| 9 | เวลา/hash | 10 ต.ค. 69 14:35–16:3x TH · `243833638da0…` |

| 10 | เช็ก "ห้าม" | `grep -c "น้องไนท์"` = `KnightSupport.tsx` ×6 · `PortfolioInquiryModal.tsx` ×1 (คงครบ) · ไม่มีบรรทัดเพิ่ม `overflow-x: hidden` ที่ html/body ใน `git diff` · `git diff --name-only` ไม่มีไฟล์ `artifacts/api-server/**` · ไม่ลบปุ่ม launcher (assert no `return null`) |

## สรุป 12 เช็คลิสต์
`1 ✅ · 2 ✅ · 3 ✅(ในสิ่งที่ scope ให้) · 4 ✅ · 5 ⚠️ (มี 080/061 ค้างในไฟล์ที่ไม render(api) — แจ้งแล้ว ไม่ได้แก้) · 6 ⛔ ตรวจไม่ได้ · 7 ✅ · 8 ✅ · 9 ✅ (1267/1225/fail0) · 10 ✅ (tsc 0) · 11 ✅ · 12 ✅`

## ความเสี่ยง + ข้อเสนอ (สำหรับเดวิด)
1. 🟠 **"เบอร์ชุดเดียว" ยังไม่จริงจนกว่าจะแก้ `App.tsx`(6 จุด) + `api-server/support.ts`** — แนะนำให้ 421-C (ชัย) คุยผ่าน `contact-channels` ตัวเดียวกัน (ต้อง expose ค่าให้ api ใช้ หรือทำเป็น module ร่วม) · PR nนี้ไม่แตะเพราะห้าม
2. 🟠 **D ต้องมีคนวัดจอจริง** — สัญญาโครงสร้าง (contract) ใหม่ชัดเจน (`data-overlay-covered`) และ widget ต้อง mount ก่อนจึงวัดได้ (ของผมไม่ mount ใน guest session ที่วัด)
3. 🟡 `WorkshopProductionSheet.tsx` = dead code ที่มีเบอร์โรงงาน/`080-606-4444` + taxId — ตัดสิน: ลบ / เก็บ / ย้ายไป admin · ผมไม่แตะเพราะเป็นการตัดสินใจเชิงข้อมูลธุรกิจ
4. 🟡 เกณฑ์ EVIDENCE ข้อ 2 (`vitest`) ควรแก้เป็น `node --experimental-strip-types --test test/*.test.ts` ตาม repo จริง (และ baseline ตัวเลขที่ผมเจอ: pass 1216 fail 1 ก่อนแก้ → fail นั้นคือ assertion ของ copy เก่า)
5. 🟢 ถ้าบอสอยากให้ "1 ชั่วโมงทำการ" แทน 24 ชม. — แก้จุดเดียว `SALES_REPLY_WINDOW` ใน `contact-channels.ts` แล้วทุกอย่าง (modal + เทสต์) ตามอัตโนมัติ
