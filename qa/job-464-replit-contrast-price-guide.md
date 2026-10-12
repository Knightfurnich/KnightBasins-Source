# ใบงาน 464-R (Replit) — **แก้ตัวอักษรอ่านไม่ออก (คอนทราสต์) หน้า /price-guide + กวาดจุดอื่นทั้งเว็บ (บอสสั่ง 12 ต.ค. 69)**

> ### ❌ ใบนี้ถูกแทนที่แล้ว (12 ต.ค. 69) — บอสเปลี่ยนใจ "ให้ชัยทำทั้งหมด" ⇒ เนื้อหาทั้งใบถูกรวมเข้า **465-C** (`qa/job-465-chai-contrast-all-pages.md`) และบอส**อนุมัติข้อ ก** (แตะ `src/index.css`/`src/App.tsx` เฉพาะจุดสี)
> เก็บไฟล์นี้ไว้เป็นบันทึก + ตาราง baseline เท่านั้น — **ห้ามเริ่มงานตามใบนี้**

**วันที่:** 12 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Replit** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** บอสส่งภาพหน้าจอ 3 ภาพ (ปุ่มขาวในแถบ NEXT STEP · การ์ด CARE 3 ใบ · การ์ดในแถบ NEXT STEP) สั่งว่า *"ปุ่มที่มีสีแบบนี้ ตัวหนังสือสีแบบนี้ ทั้ง 2 โหมดสว่างอ่านไม่ออก · แต่ 2 ภาพหลังโหมดสว่างอ่านได้ และโหมดมืดอ่านไม่ออก · ให้รีพิตแก้ไขและตรวจสอบจุดอื่น ๆ ด้วย"*
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `artifacts/knight-basins/src/pages/PriceGuidePage.tsx` (`UpdatesPage.tsx` · `NetworkPage.tsx` เฉพาะจุดที่ระบุ) + `test/` + `qa/` → **เปิด PR**

> ### 🔓 ยกเว้นขอบเขตสำหรับใบนี้ (บอสสั่งให้ "รีพิต" ทำ · เดวิดระบุออกเสียงตามกติกา)
> ปกติ `src/pages/**` เป็นของทีม UI อีกคน ⇒ **ใบนี้ยกเว้นให้ Replit แตะได้เฉพาะ 3 ไฟล์ใน SCOPE เท่านั้น**
> **ห้ามแตะ** `src/index.css` (แช่แข็ง · hero rule #449) · `src/App.tsx` (แช่แข็ง) · `src/components/**` · `src/admin/**` · `src/data/**` · `artifacts/api-server/**`
> ⇒ **ถ้าจุดที่ต้องแก้อยู่ในไฟล์ต้องห้าม (เช่น `/quote`, `/studio`, `/`) ⇒ หยุดและรายงานเดวิด ห้ามแก้เอง** (มีใบถัดไปให้)

> **baseline ที่เดวิดวัดสด (12 ต.ค. 69 · production `https://knightbasins.com` · Chrome headless · ตั้ง `localStorage["knight-storefront-theme"]`)**
> · **pick คอนทราสต์ที่ตัวอักษรมองไม่เห็น (ratio ≤ 2.2):** `/` 12 แบบ · `/stone` 5 · `/price-guide` 12 · `/portfolio` 12 · `/updates` 9 · `/studio` 12 · `/network` 7 · `/quote` 12 · `/readme` 12 — **รวมโทษทุกหน้าทั้ง 2 โหมด: สว่าง 545 จุดตรวจ / มืด 322 จุด (นับแบบไม่ซ้ำ selector)**
> · **หน้า /price-guide:** โหมดมืด **69 จุด**, โหมดสว่าง **2 จุด** (คือ h2 ของแถบ NEXT STEP + ปุ่ม CTA)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 12 ต.ค. 69 · เดวิด

GOAL:
  **A · แก้ 4 จุดที่บอสเห็น (หน้า /price-guide) — ต้องอ่านได้ทั้ง 2 โหมด**
    A1 **การ์ด CARE & MAINTENANCE 3 ใบ** (`PriceGuidePage.tsx` ~บรรทัด 371–373)
       · ตอนนี้: พื้น `bg-slate-100` = #f1f5f9 + ตัวอักษร `var(--ink)` = #e8eff8 → **ratio 1.06**
       · แก้: พื้น/ขอบ/ตัวอักษรใช้โทเคนธีม → พื้น `var(--card-paper)` (สว่าง #fff · มืด #162238) · ขอบ `var(--line)` · ตัวอักษร `var(--ink)` (สว่าง #123e69 = 10.94 · มืด #e8eff8 = 13.74)
    A2 **แถบ NEXT STEP** (`~บรรทัด 412–421`)
       · ต้นเหตุ R3: พื้น `bg-[var(--ink)]` เป็นโทเคนที่ **กลับสีตามธีม** (สว่าง = #123e69 เข้ม · มืด = #e8eff8 อ่อน) ⇒ โหมดสว่าง h2 ใช้ `var(--ink)` = **#123e69 บนพื้น #123e69 = ratio 1.00 (จมทั้งหัวข้อ)** · โหมดมืดกลายเป็นพื้นสว่างทั้งแถบ (h2 = 1.00 · kicker 1.23 · ย่อหน้า 1.06)
       · แก้: พื้นเป็นโทเคนที่ไม่กลับสี → `var(--deep)` (สว่าง #0e355b = ขาวทับ 12.51 · มืด #0b1324 = 16.01) และ **กำหนดสีตัวอักษรของ h2 ให้ชัด (ขาว #ffffff ทั้ง 2 โหมด)** · kicker `NEXT STEP` ให้ ≥4.5 บนพื้นนั้น · ย่อหน้าต้อง ≥4.5
    A3 **ปุ่ม CTA `a[data-testid="link-price-guide-final-quote"]`** (`~บรรทัด 422`)
       · ต้นเหตุ R2: `src/index.css` บรรทัด 506 **`a { color: inherit }` เป็น CSS ที่อยู่นอก layer** ⇒ ชนะ utility ของ Tailwind ทุกตัวบน `<a>` ⇒ `text-slate-950` ไม่มีผล คำนวณได้ **rgb(255,255,255) บนพื้นขาว = ratio 1.00 ทั้ง 2 โหมด** (ภาพที่บอสส่งภาพที่ 1 คือโหมดสว่าง)
       · แก้: บังคับสีข้อความปุ่มเป็นเข้ม (เช่น `#020617` = 20.17) ด้วยวิธีที่ชนะจริง — inline style หรือกฎที่ประกาศ `!important` (แบบเดียวกับที่ทีมใช้แก้ `.studio-guide-contact` ใน `index.css` บรรทัด 6043–6055) · **ห้ามพึ่ง `text-*` บน `<a>`/`<h1>`–`<h3>` ในหน้านี้** (ถูก global ทับทั้งคู่: `h1,h2,h3 { color: var(--ink) }` = `index.css` บรรทัด 958)
    A4 **กวาดทั้งหน้า /price-guide: เหลือ 0 จุดที่ ratio < 4.5** (ตัวใหญ่ ≥24px หรือ ≥18.66px ตัวหนา: ≥3.0) ทั้งโหมดสว่างและมืด · **โหมดมืดตอนนี้มี 69 จุด** · กวาด `dark:` ที่ตายด้วยเหตุผล R1 (ดูข้อ D) · **ห้ามตัดข้อความ/ย่อเนื้อหา/ลดจำนวนรายการเพื่อให้ผ่าน**
  **B · จุดเดียวกันในอีก 2 หน้า (ไฟล์ใน SCOPE · แก้ในใบนี้)**
    B1 `/updates` → ลิงก์ `[data-testid="link-updates-back-to-store"]` **ratio 1.16** (`UpdatesPage.tsx` ~292)
    B2 `/network` → หัวการ์ด `network-card-knight-furnich` / `-knight-basins` / `-hinsangkhro` **1.16** + เมนูลิงก์ท้าย `link-network-stone` / `link-network-portfolio` / `link-network-quote-footer` **1.63** (`NetworkPage.tsx` ~29/73/95/125)
    B3 ถ้าพบจุดอื่นใน 2 ไฟล์นี้ที่ ratio < 4.5 ให้แก้ด้วยและระบุในรายงาน
  **C · ตรวจทั้งเว็บ + รายงาน (ห้ามแก้ไฟล์นอก SCOPE)**
    · รันตัววัดกับ **12 เส้นทาง × 2 โหมด**: `/` `/stone` `/price-guide` `/portfolio` `/updates` `/studio` `/site-prep` `/network` `/handover` `/track` `/quote` `/readme` (สคริปต์: `qa/tools/contrast-probe.js` — วิธีรันอยู่ใน EVIDENCE)
    · ทำ **ตารางรายงาน**: เส้นทาง · โหมด · จำนวนจุด < 4.5 · จุดที่แย่สุด 3 อัน (selector + ratio + สีจริง) · **และเตี๊ยบ baseline ของเดวิดในหัวใบนี้**
    · จุดที่อยู่ในไฟล์ต้องห้าม (`/quote` ปุ่ม "ยืนยันแบบ" = 1.04 **ในโหมดสว่างด้วย** · `/studio` ปุ่ม "ปกติ"/popover 1.09–1.16 · `/` ลิงก์ "สั่งผลิตพร้อมท็อปเคาน์เตอร์" 30 ใบ = 1.97 · `/portfolio` แท็บหมวด 1.16 · `/stone` ป้ายสีน Hero 1.80 · `/readme` การ์ดคลิก 1.26) ⇒ **รายงานพร้อม selector + ตัวเลข + เหตุผล ห้ามแก้** (เดวิดจะออกใบถัดไปตามคำสั่งบอส)
  **D · กวาด `dark:` ที่ตายในหน้าสโคป (ต้นเหตุ R1)**
    · `src/index.css` ประกาศ `@custom-variant dark (&:is(.dark *))` แต่ธีมร้านค้าตั้งที่ `data-theme="dark"` บน `.storefront-theme-root` และ **ไม่มีที่ไหนเติมคลาส `.dark`** ⇒ ตรวจสดได้ `document.querySelectorAll('.dark').length === 0` ⇒ `dark:` ทุกตัวในหน้าไม่ทำงาน (`PriceGuidePage.tsx` ใช้ **53 จุด** · `UpdatesPage.tsx` 2 จุด)
    · แก้: เปลี่ยน `dark:...` เป็นโทเคนธีมที่ทำงานจริง (`var(--ink)` / `var(--ink-soft)` / `var(--card-paper)` / `var(--line)`) **หรือ**คู่สีที่ชนะ (กฎ `!important` ระดับหน้า · inline style) — **ห้ามแก้ `src/index.css` และห้ามแก้ Tailwind config**
    · **ห้ามทำให้โหมดสว่างเปลี่ยนรูปร่าง/ระยะ/ขนาดตัวอักษร** — แก้เฉพาะสี/พื้น/ขอบ

SCOPE (แก้เฉพาะที่ระบุ · path สัมพัทธ์จาก root รีโป):
  - (รีโป) artifacts/knight-basins/src/pages/PriceGuidePage.tsx        ← A1–A4 (ทั้งไฟล์)
  - (รีโป) artifacts/knight-basins/src/pages/UpdatesPage.tsx          ← B1 (เฉพาะลิงก์กลับหน้าร้าน + จุดที่ ratio < 4.5 ในไฟล์นี้)
  - (รีโป) artifacts/knight-basins/src/pages/NetworkPage.tsx          ← B2 (เฉพาะหัวการ์ด 3 ใบ + เมนูท้าย 3 ลิงก์ + จุดที่ ratio < 4.5 ในไฟล์นี้)
  - (รีโป) artifacts/knight-basins/test/                              ← เทสต์กันถอยหลัง (ดู OUTPUT)
  - (รีโป) qa/tools/contrast-probe.js                                 ← มีอยู่แล้วใน PR นี้ (สคริปต์วัดของเดวิด · ห้ามแก้)
  - (รีโป) qa/report-replit-round27-contrast-20261012.md (ใหม่) + qa/images/replit-round27-contrast/ (ภาพก่อน/หลัง)

FORBIDDEN:
  - **ห้ามแตะ `src/index.css`** (แช่แข็ง · มี global `a{color:inherit}` บรรทัด 506 และ `h1,h2,h3{color:var(--ink)}` บรรทัด 958 ซึ่งเป็นต้นเหตุ — ต้องแก้ด้วยวิธีที่ชนะจากภายนอกเท่านั้น) · **ห้ามแตะ `src/App.tsx`** · `src/components/**` · `src/admin/**` · `src/data/**` · `artifacts/api-server/**` · Tailwind config
  - ห้ามแก้ราคา/ขนาด/สี/รหัสสินค้า/ข้อความธุรกิจ · ห้ามตัด/ย่อข้อความเพื่อให้ผ่านเกณฑ์ · ห้ามเพิ่ม/ลบรายการหรือลิงก์ · ห้ามแก้ `qa/tools/contrast-probe.js`
  - **ใช้ GitHub Connection เท่านั้น** (ไม่ clone/ไม่ push ตรงเข้า main · ไม่ merge PR เอง) · ห้าม commit ของจริง/ความลับ · ห้ามแก้ production DB
  - ห้ามเดาตัวเลขคอนทราสต์ — ต้องวัดจากหน้าเว็บจริง (DevTools/สคริปต์) และแนบสีจริงที่คำนวณได้

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ภาพ):
  1) คำสั่งวัดตัวเลข (เลือกอย่างน้อย 2 ทาง แล้วแนบ):
     · `node qa/tools/contrast-probe.js https://knightbasins.com/price-guide dark` (และ `light` · วน 12 เส้นทาง — ตัวสคริปต์พิมพ์ selector + fg + bg + ratio)
     · เปิด DevTools → Console → วาง `qa/tools/contrast-probe.js` → `contrastProbe()`
     · `curl -s https://knightbasins.com/price-guide | grep -c price-guide` (ยืนยันหน้าเสิร์ฟจริง) + `npx tsc -p tsconfig.json --noEmit`
     · `node --experimental-strip-types --test test/price-guide-contrast.test.ts`
  2) **ตารางก่อน-หลัง ต่อจุด** (A1–A4 + B1–B3): selector · fg ก่อน → หลัง · bg ก่อน → หลัง · **ratio ก่อน → หลัง** · เกณฑ์ 4.5 (ตัวใหญ่ 3.0) — ต้องมีตัวเลขครบทุกแถว
  3) **ตารางกวาดทั้งเว็บ (C):** 12 เส้นทาง × 2 โหมด · จำนวนจุด < 4.5 · 3 จุดแย่สุดต่อหน้า — เทียบกับ **baseline ของเดวิดในหัวใบนี้** (`/price-guide` มืด 69 → ต้องเหลือ 0 · สว่าง 2 → 0)
  4) **ภาพก่อน-หลัง** (ตอนนี้อยู่ใน `qa/images/david-contrast-20261012/`: `priceguide-care-dark.png` · `priceguide-nextstep-dark.png` · `priceguide-nextstep-light.png` · `quote-share-light.png`) → ทำภาพคู่เทียบ **มืด + สว่าง** ของ 4 จุด A + B1/B2 ที่ 1440 และ 390
  5) **เทสต์กันถอยหลัง:** เพิ่ม `test/price-guide-contrast.test.ts` (ตรวจจากแหล่ง: หน้า /price-guide ไม่มี `bg-slate-100` ลอย/ไม่มี `dark:` ที่ตาย/แถบ NEXT STEP ไม่ใช้ `var(--ink)` เป็นพื้น) · และ/หรือ `test/price-guide-contrast.browser.test.ts` แบบเดียวกับ `test/quote-print.browser.test.ts` (รันกับ Chrome: `CHROMIUM_BIN=/repl/tools/bin/chromium node --experimental-strip-types --test test/price-guide-contrast.browser.test.ts`) · **พิสูจน์สองทาง:** ถอดการแก้ → เทสต์/การวัดตก · คืน → ผ่าน (แนบข้อความ error ตอนตก)
  6) `git diff --stat` (ต้องเห็นเฉพาะไฟล์ใน SCOPE) · baseline เทสต์: `pnpm run test` + `npx tsc -p tsconfig.json --noEmit` (api/web) + จำนวนไฟล์ใหม่ · **ระบุ commit + OS + ผู้รัน + เวลาไทย**

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `fix(price-guide): readable text in both themes (contrast)`
  - `qa/report-replit-round27-contrast-20261012.md` (ตารางข้อ 2 + 3 ครบ) + ภาพใน `qa/images/replit-round27-contrast/`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ (รวมรายการที่ต้องออกใบถัดไปตามข้อ C)

STOP:
  - ครบ A–D + ตาราง C พร้อมหลักฐาน **หรือทำครบ 16 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าจุดที่ต้องแก้อยู่ในไฟล์ต้องห้าม (`index.css` · `App.tsx` · `components/**` · `admin/**` · `data/**`) หรือไฟล์นอก SCOPE ⇒ หยุดและแจ้งเดวิดทันที ห้ามแก้เอง**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–D |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail |
| 6 | พิสูจน์สองทาง | ถอด → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat เฉพาะ SCOPE |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาตัวเลข | ตัวเลขคอนทราสต์วัดจากหน้าจริงทุกแถว |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

## ภาคผนวก ก · ที่มาของตัวเลข (เดวิดวัดเอง 12 ต.ค. 69)

เครื่องมือ: Chrome headless ผ่าน CDP · ตั้งธีมด้วย `localStorage["knight-storefront-theme"]` แล้วโหลดใหม่ (ไม่ใช้ค่าธีมของ OS)
สูตร: contrast ratio ตาม WCAG 2.1 (relative luminance) · พื้นหลัง = องค์ประกอบแรกที่ทึบกว่า 50% (ข้ามพื้นรูปภาพ)
เกณฑ์: 4.5 ตัวอักษรปกติ · 3.0 ตัวใหญ่ (≥24px หรือ ≥18.66px ตัวหนา)

**จุดที่บอสส่งมา วัดสด (ก่อนแก้)**

| จุด | โหมด | สีตัวอักษร | พื้นหลัง | ratio |
|---|---|---|---|---|
| h2 แถบ NEXT STEP | สว่าง | rgb(18,62,105) | rgb(18,62,105) | **1.00** |
| ปุ่ม CTA "ไปหน้าขอใบเสนอราคา" | สว่าง | rgb(255,255,255) | rgb(255,255,255) | **1.00** |
| การ์ด CARE 3 ใบ | มืด | rgb(232,239,248) | rgb(241,245,249) | **1.06** |
| ย่อหน้าในแถบ NEXT STEP | มืด | rgb(226,232,240) | rgb(232,239,248) | **1.06** |
| kicker `NEXT STEP` | มืด | rgb(190,219,255) | rgb(232,239,248) | **1.23** |

**จำนวนจุดที่ ratio ≤ 2.2 (ตัวอักษรมองไม่เห็น) แยกตามหน้า**

| หน้า | โหมดสว่าง | โหมดมืด | ตัวอย่างที่แย่สุด |
|---|---|---|---|
| `/` | 2 | 12 | ลิงก์ "สั่งผลิตพร้อมท็อปเคาน์เตอร์" 1.97 (30 ใบ · `App.tsx` ต้องห้าม) |
| `/stone` | 1 | 5 | ป้ายสีใน Hero 1.80 |
| `/price-guide` | 2 | 12 | 1.00 (บอสส่งมา) |
| `/portfolio` | 0 | 12 | แท็บหมวด 1.16 (`PortfolioPage.tsx`) |
| `/updates` | 0 | 9 | ลิงก์กลับหน้าร้าน 1.16 |
| `/studio` | 0 | 12 | ปุ่ม "ปกติ" 1.14 (แคนวาสตั้งใจให้สว่าง — ต้องตัดสินใจ) |
| `/network` | 0 | 7 | หัวการ์ด 1.16 |
| `/quote` | 1 | 12 | ปุ่ม "ยืนยันแบบ" 1.04 **โหมดสว่าง** (`App.tsx` + `index.css` ต้องห้าม) |
| `/readme` | 1 | 12 | การ์ดคลิก 1.26 |

> [เดวิด → รีพิต] ใบใหม่ **464-R** — บอสส่งภาพ 3 ภาพ (ปุ่มขาวในแถบ NEXT STEP · การ์ด CARE · แถบ NEXT STEP) สั่งว่า *"ทั้ง 2 โหมดอ่านไม่ออก"* + *"ให้รีพิตแก้ไขและตรวจสอบจุดอื่น ๆ ด้วย"*
> · **A** แก้ `/price-guide` 4 จุด: การ์ด CARE (พื้น `var(--card-paper)`) · แถบ NEXT STEP (พื้น `bg-[var(--ink)]` → `var(--deep)` + สี h2 ให้ชัด) · ปุ่ม CTA (`text-slate-950` ถูก `a{color:inherit}` ใน `index.css` ทับ ⇒ ต้องบังคับสีแบบชนะจริง) · กวาดทั้งหน้าให้เหลือ 0 จุด ratio < 4.5
> · **B** `/updates` ลิงก์กลับหน้าร้าน 1.16 · `/network` หัวการ์ด 1.16 + เมนูท้าย 1.63
> · **C** กวาด 12 เส้นทาง × 2 โหมด ด้วย `qa/tools/contrast-probe.js` แล้ว **รายงานเป็นตาราง** — จุดที่อยู่ใน `index.css`/`App.tsx`/`components/**` (`/quote` · `/studio` · `/` · `/portfolio`) **ห้ามแก้ ให้รายงาน**
> · **D** `dark:` ในหน้านี้ตายทั้งหน้า (53 จุด) เพราะธีมใช้ `data-theme` ไม่ใช่คลาส `.dark` ⇒ เปลี่ยนเป็นโทเคนธีม
> · **ห้ามแตะ** `src/index.css` · `src/App.tsx` · `components/**` · `admin/**` · `data/**` · api-server · ใช้ GitHub Connection เท่านั้น
> เกณฑ์ 12 ข้อ + ตาราง baseline + ตัวเลขทุกจุด: `qa/job-464-replit-contrast-price-guide.md`
