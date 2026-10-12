# ใบงาน 465-C (ชัย) — **แก้ตัวอักษรอ่านไม่ออก (คอนทราสต์) ทั้งเว็บ 8 หน้า ทั้ง 2 โหมด (บอสสั่ง 12 ต.ค. 69)**

**วันที่:** 12 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** บอสส่งภาพ 3 ภาพ (ปุ่มขาวในแถบ NEXT STEP · การ์ด CARE · แถบ NEXT STEP) สั่ง *"ให้รีพิตแก้ไขและตรวจสอบจุดอื่น ๆ ด้วย"* → **บอสเปลี่ยนใจ 12 ต.ค. 69: "ให้ชัยทำทั้งหมด" + อนุมัติข้อ ก (แตะ `src/index.css`/`src/App.tsx` เฉพาะจุดสีที่ระบุได้)** ⇒ ใบนี้ **แทนใบ 464-R ของรีพิตทั้งหมด** (464-R ยกเลิก)
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `artifacts/knight-basins/src/...` (ตาม SCOPE) + `test/` + `qa/` → **เปิด PR**

> ### ⚠️ ไฟล์แช่แข็ง — ได้รับอนุมัติจากบอสแล้ว (ข้อ จำกัด เข้ม)
> `src/index.css` และ `src/App.tsx` ปกติ **ห้ามแตะ** ⇒ ใบนี้บอสอนุมัติให้แตะได้ **เฉพาะจุดต่อไปนี้เท่านั้น**
> 1. `src/index.css` → เพิ่ม/แก้ **กฎสีที่ปักหมุด (`!important`) เฉพาะ selector ที่อยู่ใน C/D/E/F/G** เท่านั้น · **ห้ามแก้ค่าตัวแปรโทเคน (`--ink` `--paper` `--deep` ฯลฯ) ทุกตัว** · **ห้ามแตะกฎ hero #449** · ถ้าจะลบกฎเดิมต้องแนบ `git diff` ของไฟล์นี้ให้เห็นว่าลบแค่บรรทัดไหนและเหตุผล
> 2. `src/App.tsx` → **เฉพาะบล็อกที่ระบุใน C (`.quote-share`) · D (การ์ดสินค้า `link-basin-studio-*`) · F (`stone-hero-media`)** — **ห้ามแตะส่วนอื่นของไฟล์**
> ⇒ **ถ้าพบว่าจุดอื่นต้องแก้ที่ 2 ไฟล์นี้ (นอกที่ระบุ) ⇒ หยุดและแจ้งเดวิดก่อน** · `src/data/**` + `artifacts/api-server/**` **ห้ามแตะเด็ดขาด** (ราคา/ข้อมูล = ของเดิม)

> **baseline ที่เดวิดวัดสด (12 ต.ค. 69 · production `https://knightbasins.com` · Chrome headless ผ่าน CDP · ตั้ง `localStorage["knight-storefront-theme"]` แล้วโหลดใหม่)**
> เกณฑ์: **4.5** ตัวอักษรปกติ · **3.0** ตัวใหญ่ (≥24px หรือ ≥18.66px ตัวหนา) · ตัวเลข = จำนวนจุดที่ต่ำกว่าเกณฑ์
> **โหมดสว่าง:** `/` 166 · `/stone` 101 · `/updates` 53 · `/readme` 54 · `/studio` 48 · `/quote` 45 · `/portfolio` 3 · `/network` 3 · `/price-guide` 2 · `/site-prep` 1 · `/handover` 2 · `/track` 2
> **โหมดมืด:** `/price-guide` 69 · `/` 63 · `/studio` 38 · `/portfolio` 26 · `/quote` 18 · `/readme` 13 · `/network` 10 · `/updates` 9 · `/stone` 7 · `/site-prep` 0 · `/handover` 0 · `/track` 0
> **เกณฑ์ปิดงาน:** หน้าที่ระบุใน A–H ต้องเหลือ **0 จุด** ที่ ratio < 4.5 (ตัวใหญ่ < 3.0) ยกเว้นรายการที่ระบุว่าเป็น "สีแบรนด์โดยเจตนา" และต้องแจ้งในรายงาน (เช่น ปุ่ม LINE สีเขียว `rgb(6,199,85)` ตัวอักษรขาว = 2.26 · เดวิดจะถามบอสแยก)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 12 ต.ค. 69 · เดวิด

GOAL:
  **A · `/price-guide` — 4 จุดที่บอสส่งภาพ (มืด 69 → 0 · สว่าง 2 → 0)**
    A1 **การ์ด CARE & MAINTENANCE 3 ใบ** (`src/pages/PriceGuidePage.tsx` ~371–373)
       · ตอนนี้ พื้น `bg-slate-100` = #f1f5f9 + ตัวอักษร `var(--ink)` = #e8eff8 → **ratio 1.06**
       · แก้: พื้น/ขอบ/ตัวอักษรใช้โทเคนธีม (`var(--card-paper)` = สว่าง #fff · มืด #162238 · ตัวอักษร `var(--ink)`) → 10.94 / 13.74
    A2 **แถบ NEXT STEP** (`PriceGuidePage.tsx` ~412–421)
       · ต้นเหตุ: พื้นเป็น `bg-[var(--ink)]` = โทเคนที่ **กลับสีตามธีม** ⇒ โหมดสว่าง h2 = #123e69 บนพื้น #123e69 = **1.00** · โหมดมืดพื้นกลายเป็นสว่าง (h2 1.00 · kicker 1.23 · ย่อหน้า 1.06)
       · แก้: พื้นเป็นโทเคนที่ไม่กลับสี → `var(--deep)` (สว่าง #0e355b = ขาวทับ **12.51** · มืด #0b1324 = **16.01**) และปักสี h2 ของแถบเป็น **#ffffff ทั้ง 2 โหมด** (สีจาก global `h1,h2,h3 { color: var(--ink) }` ใน `index.css` บรรทัด 958 ทับ `text-white` ได้ — ดูข้อ H)
    A3 **ปุ่ม CTA `a[data-testid="link-price-guide-final-quote"]`** (`~422`)
       · ต้นเหตุ: `index.css` บรรทัด 506 `a { color: inherit }` เป็น CSS **นอก layer** ⇒ ชนะ utility ของ Tailwind ทั้งหมดบน `<a>` ⇒ `text-slate-950` ไม่มีผล คำนวณได้ **rgb(255,255,255) บนพื้นขาว = 1.00 ทั้ง 2 โหมด**
       · แก้: ปักสีข้อความปุ่มเป็นเข้ม (`#020617` = **20.17**) — inline style หรือกฎ `!important` ในที่ที่ชนะจริง
    A4 กวาดทั้งหน้า `/price-guide` ทั้ง 2 โหมด → **เหลือ 0 จุด** (ห้ามตัดข้อความ/ย่อเนื้อหา/ลดรายการเพื่อให้ผ่าน)
  **B · `/updates` + `/network` (มืด 9 + 10 → 0)**
    B1 `/updates` → `[data-testid="link-updates-back-to-store"]` **1.16** (`src/pages/UpdatesPage.tsx` ~292)
    B2 `/network` → หัวการ์ด `network-card-knight-furnich` / `-knight-basins` / `-hinsangkhro` **1.16** + เมนูท้าย `link-network-stone` / `link-network-portfolio` / `link-network-quote-footer` **1.63** (`src/pages/NetworkPage.tsx` ~29/73/95/125)
  **C · `/quote` — ปุ่ม "ยืนยันแบบ / ขอให้ทีมงานติดต่อกลับ" จางแม้โหมดสว่าง (สว่าง 1.04 · มืด 1.16) ← แย่สุดในเว็บ**
    · ที่อยู่: `src/App.tsx` บล็อก `.quote-share` (~1933) + กฎ `.quote-share` ใน `src/index.css`
    · ตอนนี้: ตัวอักษร `var(--paper)` = #f6fbfe บนพื้น `rgba(255,255,255,.72)` ที่ทับพื้นกรมท่า ⇒ โหมดสว่างขาวบนขาว
    · แก้: ปักสีตัวอักษร/พื้นของ `.quote-share` ให้ชัดทั้ง 2 โหมด (เช่น ตัวอักษรเข้มบนพื้นสว่าง หรือพื้นเข้ม+ตัวอักษรขาว) · **ปุ่ม `.button--dark` / `.button--outline` ใต้กล่องนี้ต้องอ่านได้ด้วย** · ต้องไม่กระทบงานพิมพ์ A4
  **D · หน้าแรก `/` — ลิงก์ "✨ สั่งผลิตพร้อมท็อปเคาน์เตอร์" 30 ใบ (มืด 1.97)**
    · ที่อยู่: `src/App.tsx` ~643 (`data-testid="link-basin-studio-<รหัส>"`) + คลาส `product-card-action--studio` ใน `src/index.css`
    · โหมดมืด: ตัวอักษร rgb(122,185,251) บนพื้นการ์ดสว่าง rgb(244,250,255) → 1.97 (การ์ดสินค้าในโหมดมืดยังเป็นพื้นสว่าง — ตรวจให้ทั้งใบอ่านได้)
  **E · `/portfolio` — แท็บหมวด (มืด 12 จุด = 1.16)**
    · ที่อยู่: `src/pages/PortfolioPage.tsx` ~239 (`data-testid="portfolio-tab-<slug>"`) + คลาส `portfolio-category-tabs` ใน `src/index.css`
  **F · `/stone` — ป้ายสีในภาพใหญ่ (มืด 1.80) + ป้าย "แผ่นมาตรฐาน / 760 × 3680 mm" (มืด 2.00)**
    · ที่อยู่: `src/App.tsx` บล็อก `stone-hero-media` + กฎใน `src/index.css` · **ไทล์สีหิน/รูปตัวอย่างต้องคงพื้นสว่าง + ตัวอักษรเข้ม (ห้ามกลับสีไทล์) — แก้ที่ตัวอักษรที่กลืนพื้นเท่านั้น**
  **G · `/readme` — การ์ดคลิก 4 ใบ (มืด 1.26) + ลิงก์ Google Maps บนพื้นส้ม (สว่าง 1.72)**
    · ที่อยู่: `src/components/SalesGuide.tsx` (~259 `link-guide-hub-*` · `link-google-maps-factory`) + กฎใน `src/index.css`
  **H · `/studio` — ปุ่มเครื่องมือในโหมดมืด (มืด 38 จุด · แย่สุด 1.09)**
    · ที่อยู่: `src/components/StudioPage.tsx` (`select-edge-*` "ปกติ" 1.14 · `studio-edge-toolbar-*` 1.09 · `button-open-studio-*-popover` 1.16 · `h4` "แผ่นหลัก" 1.16) + กฎใน `src/index.css`
    · **⛔ ห้ามกลับสีแคนวาส/ไทล์วัสดุ** (`studio-canvas` · `studio-stone-choice` · `studio-basin-choice` · `studio-canvas-quickbar` ต้องคงพื้นสว่าง + ตัวอักษรเข้มเหมือนเดิม) — แก้เฉพาะ **ปุ่ม/ป้าย/หัวข้อที่กลืนพื้นรอบนอกแคนวาส** ให้อ่านได้
    · **หมายเหตุกลไก (ใช้ทั้งใบ):** `dark:` ของ Tailwind **ตายทั้งเว็บ** เพราะ `index.css` ตั้ง `@custom-variant dark (&:is(.dark *))` แต่ธีมร้านค้าใช้ `data-theme="dark"` และไม่มีที่ไหนเติมคลาส `.dark` (ตรวจสด: `document.querySelectorAll('.dark').length === 0`) ⇒ **ห้ามใช้ `dark:` เป็นทางแก้** ให้ใช้โทเคน (`var(--ink)` / `var(--ink-soft)` / `var(--card-paper)` / `var(--line)` / `var(--deep)`) หรือปักสีด้วย `!important`
    · **กลไกที่ 2:** กฎ `a { color: inherit }` (บรรทัด 506) และ `h1,h2,h3 { color: var(--ink) }` (บรรทัด 958) ใน `index.css` อยู่นอก layer ⇒ **ชนะ utility ของ Tailwind ทุกตัวบน `<a>` และ `<h1>`–`<h3>`** ⇒ งานนี้ใช้ `text-*` บนสองแท็กนั้นไม่ได้ผล
  **I · ไม่ทำของเดิมพัง (regression)**
    · ราคา/ขนาด/สี/รหัสสินค้า/จำนวนภาพ/ลิงก์ LINE `@789gcnhq`/ที่อยู่ 8/1–8/13 = **ห้ามเปลี่ยน** · ยอดรวม/VAT/ส่วนลดในใบเสนอราคา = เท่าเดิม · งานพิมพ์ A4 = ไม่ล้น ไม่ตัด
    · โหมดสว่าง: **ห้ามเปลี่ยนโครงร่าง ตำแหน่ง ระยะ ขนาดตัวอักษร** — แก้เฉพาะสี/พื้น/ขอบ · ล้นแนวนอน = 0 ที่ 1440 / 390
  **J · พิสูจน์ด้วยเครื่อง** — เทสต์กันถอยหลัง + ตารางตัวเลข ก่อน–หลัง ต่อจุด (ดู EVIDENCE)

SCOPE (แก้เฉพาะที่ระบุ · path สัมพัทธ์จาก root รีโป):
  - (รีโป) artifacts/knight-basins/src/pages/PriceGuidePage.tsx       ← A (ทั้งไฟล์)
  - (รีโป) artifacts/knight-basins/src/pages/UpdatesPage.tsx          ← B1
  - (รีโป) artifacts/knight-basins/src/pages/NetworkPage.tsx          ← B2
  - (รีโป) artifacts/knight-basins/src/pages/PortfolioPage.tsx        ← E
  - (รีโป) artifacts/knight-basins/src/components/SalesGuide.tsx      ← G
  - (รีโป) artifacts/knight-basins/src/components/StudioPage.tsx      ← H
  - (รีโป) artifacts/knight-basins/src/App.tsx                        ← เฉพาะบล็อก C · D · F (บอสอนุมัติ)
  - (รีโป) artifacts/knight-basins/src/index.css                      ← เฉพาะปักสี `!important` ของ C–H (ห้ามแก้โทเคน/ห้ามแตะ hero #449)
  - (รีโป) artifacts/knight-basins/test/                              ← เทสต์กันถอยหลัง + เทสต์เดิมที่ต้องแก้ตาม
  - (รีโป) qa/report-chai-round27-contrast-20261012.md (ใหม่) + qa/images/chai-round27/ (ภาพ/ตัวเลขก่อน-หลัง)
  - /opt/data/cache/kbsrc/qa/job-464-replit-contrast-price-guide.md (อ่าน — ใบเดิมของรีพิตที่ถูกแทนด้วยใบนี้ · มีตาราง baseline ละเอียด)
  - /opt/data/cache/kbsrc/qa/tools/contrast-probe.js (อ่าน/รัน — ตัววัดคอนทราสต์ของเดวิด · ห้ามแก้)

FORBIDDEN:
  - ห้ามแตะ `src/data/**` · `artifacts/api-server/**` · `artifacts/knight-basins/public/**` (รวม `llms*.txt` · sitemap) · `scripts/**` · tailwind config · `deploy/**`
  - **ห้ามแก้ค่าตัวแปรโทเคนสี** (`--ink` `--ink-soft` `--paper` `--card-paper` `--line` `--deep` `--brand-*`) และ **ห้ามแตะกฎ hero #449** ใน `index.css`
  - ห้ามแตะส่วนอื่นของ `App.tsx` นอกบล็อก C/D/F · ห้ามใช้ `dark:` เป็นทางแก้ (ตายทั้งเว็บ) · ห้ามเพิ่ม dependency/ฟอนต์/รูปใหม่
  - ห้ามแก้ราคา/ขนาด/สี/รหัสสินค้า/ข้อความธุรกิจ/ลิงก์ LINE/ที่อยู่ · ห้ามตัดหรือย่อข้อความเพื่อให้ผ่านเกณฑ์ · ห้ามลบ element
  - ห้าม commit เข้า `main` ตรง · ห้าม merge PR เอง · ห้าม commit ไฟล์ความลับ/ของจริง · ห้ามแตะ production DB

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ภาพ):
  1) **ตารางก่อน-หลัง ต่อจุด (A1–A3 · B1–B2 · C–H):** selector · สีตัวอักษร ก่อน→หลัง · พื้นหลัง ก่อน→หลัง · **ratio ก่อน→หลัง** · เกณฑ์ 4.5/3.0 — ตัวเลขต้องมาจากการวัดจริง ไม่ใช่คำนวณมือ
  2) **คำสั่งวัดที่ต้องแนบผล:** `node qa/tools/contrast-probe.js https://knightbasins.com/price-guide dark` (และ `light` · วน 12 เส้นทาง: `/` `/stone` `/price-guide` `/portfolio` `/updates` `/studio` `/site-prep` `/network` `/handover` `/track` `/quote` `/readme`) · ถ้ารันก่อน deploy ให้แนบทั้ง (ก) ผลบน local build และ (ข) ผลหลัง deploy บนโดเมนจริง
  3) **ตารางกวาด 12 หน้า × 2 โหมด เทียบ baseline ของเดวิด** (ตัวเลขในหัวใบนี้): หน้าที่ระบุใน A–H ต้องเหลือ **0** · หน้า/จุดที่ไม่แตะต้อง **ไม่แย่ลงกว่าก่อนแก้** (แนบตัวเลขเทียบ)
  4) **เทสต์:** `pnpm run test` + `npx tsc -p tsconfig.json --noEmit` (ทั้ง `artifacts/knight-basins` และ `artifacts/api-server`) — เป็นตัวเลข tests/pass/fail/skip เทียบ baseline เดวิด (Linux · main `ff24759`): web **1,474/1,420/0/ข้าม 42** · api **1,329/1,329/0** · tsc 0
  5) **เทสต์กันถอยหลังใหม่** (เช่น `test/contrast-theme-guard.test.ts`) ที่ตรวจจากแหล่ง: หน้า A–H ไม่มี `bg-[var(--ink)]` เป็นพื้นแถบ · ไม่มี `dark:` ใหม่ที่ตาย · ปุ่ม/หัวข้อในรายการถูกปักสีจริง · **พิสูจน์สองทาง:** ถอดการแก้ → เทสต์ตก (แนบข้อความ error) · คืน → ผ่าน
  6) **ภาพก่อน-หลัง 4 หน้าเป็นอย่างน้อย** (`/price-guide` ทั้ง 2 โหมด · `/quote` โหมดสว่าง · `/` โหมดมืด · `/studio` โหมดมืด) ที่ 1440 และ 390 + **ล้นแนวนอน 0** · ใบเสนอราคา A4 (PDF) ต้องไม่ล้น
  7) `git diff --stat` (ต้องเห็นเฉพาะไฟล์ใน SCOPE) + `git diff -- artifacts/knight-basins/src/index.css` (ให้เห็นว่าปักสีเฉพาะจุด) + `grep -rn "dark:" artifacts/knight-basins/src/pages artifacts/knight-basins/src/components | wc -l` ก่อน-หลัง · **ระบุ commit + OS + ผู้รัน + เวลาไทย**

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `fix(theme): readable text on all storefront pages in both themes (465-C)`
  - ถ้า diff ใหญ่ ให้แยก **2 PR**: (1) หน้าเพจ (A/B/E) · (2) ไฟล์แช่แข็ง + component (C/D/F/G/H) — แจ้งในรายงานว่าแยกเพราะอะไร
  - `qa/report-chai-round27-contrast-20261012.md` (ตารางข้อ 1 + 3 ครบ) + ภาพใน `qa/images/chai-round27/`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ (รวมรายการที่ยังต้องตัดสินใจ เช่น ปุ่ม LINE สีเขียว 2.26)

STOP:
  - ครบ A–J พร้อมหลักฐาน **หรือทำครบ 18 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าต้องแตะ `src/data/**` · `api-server/**` · `public/**` · ตัวแปรโทเคนสี · กฎ hero #449 หรือส่วนอื่นของ `App.tsx` นอกบล็อก C/D/F ⇒ หยุดและแจ้งเดวิดทันที ห้ามแก้เอง**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–J |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail เทียบ baseline |
| 6 | พิสูจน์สองทาง | ถอด → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat เฉพาะ SCOPE |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาตัวเลข | ratio ทุกแถววัดจากหน้าจริง |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

## ภาคผนวก ก · จุดที่ต้องแก้ แยกตามหน้า (ตัวเลขก่อนแก้ · เดวิดวัดเอง 12 ต.ค. 69)

| หน้า | จุด | โหมดมืด | โหมดสว่าง | ไฟล์ |
|---|---|---|---|---|
| `/price-guide` | h2 แถบ NEXT STEP | 1.00 | **1.00** | PriceGuidePage.tsx |
| `/price-guide` | ปุ่ม CTA | 1.00 | **1.00** | PriceGuidePage.tsx |
| `/price-guide` | การ์ด CARE 3 ใบ | **1.06** | ปกติ | PriceGuidePage.tsx |
| `/price-guide` | kicker NEXT STEP | 1.23 | ปกติ | PriceGuidePage.tsx |
| `/quote` | ปุ่ม "ยืนยันแบบ" (`.quote-share`) | 1.16 | **1.04** | App.tsx + index.css |
| `/` | ลิงก์ `link-basin-studio-*` (30 ใบ) | **1.97** | ปกติ | App.tsx + index.css |
| `/portfolio` | แท็บหมวด | **1.16** | ปกติ | PortfolioPage.tsx + index.css |
| `/stone` | ป้ายสีในภาพใหญ่ | **1.80** | ปกติ | App.tsx + index.css |
| `/readme` | การ์ดคลิก 4 ใบ | **1.26** | ปกติ | SalesGuide.tsx |
| `/readme` | ลิงก์ Google Maps บนพื้นส้ม | ปกติ | **1.72** | SalesGuide.tsx |
| `/studio` | ปุ่ม "ปกติ" / เครื่องมือบัว | **1.09–1.14** | ปกติ | StudioPage.tsx |
| `/studio` | popover เลือกหิน/อ่าง | **1.16** | ปกติ | StudioPage.tsx |
| `/updates` | ลิงก์กลับหน้าร้าน | **1.16** | ปกติ | UpdatesPage.tsx |
| `/network` | หัวการ์ด 3 ใบ | **1.16** | ปกติ | NetworkPage.tsx |
| `/network` | เมนูท้าย 3 ลิงก์ | **1.63** | ปกติ | NetworkPage.tsx |
| `/` (หน้าแรก) | หมายเหตุราคา `text-price-terms-note` | ปกติ | 2.07 | App.tsx |

> [เดวิด → ชัย] ใบใหม่ **465-C (แทน 464-R ทั้งใบ)** — บอสเปลี่ยนใจให้ชัยทำทั้งหมด + **อนุมัติแตะ `src/index.css`/`src/App.tsx` เฉพาะจุดสีที่ระบุ**
> · **A** `/price-guide` 4 จุด (การ์ด CARE 1.06 · แถบ NEXT STEP พื้น `--ink` กลับสี → ใช้ `var(--deep)` · ปุ่ม CTA ถูก `a{color:inherit}` ทับ = ขาวบนขาวทั้ง 2 โหมด · kicker) → เหลือ 0
> · **B** `/updates` 1.16 + `/network` 1.16/1.63 · **C** `/quote` ปุ่ม "ยืนยันแบบ" **1.04 โหมดสว่าง** (แย่สุด · หน้าเอกสารลูกค้า) · **D** หน้าแรก ลิงก์ studio 30 ใบ 1.97 · **E** `/portfolio` แท็บ 1.16 · **F** `/stone` ป้ายสี 1.80 · **G** `/readme` การ์ด 1.26 + Maps 1.72 · **H** `/studio` 1.09–1.16
> · **กลไกที่ต้องรู้:** `dark:` ของ Tailwind **ตายทั้งเว็บ** (ธีมใช้ `data-theme` ไม่ใช่คลาส `.dark`) · และ `a{color:inherit}` + `h1,h2,h3{color:var(--ink)}` ใน `index.css` **ชนะ utility ทุกตัว** บน `<a>`/`<h1>`–`<h3>` ⇒ แก้ด้วยโทเคนหรือปักสี `!important` เท่านั้น
> · **ห้ามแตะ:** `src/data/**` · `api-server/**` · `public/**` · ตัวแปรโทเคนสี · กฎ hero #449 · ส่วนอื่นของ `App.tsx` นอกบล็อก C/D/F
> · **ส่ง:** PR (แยก 2 ใบได้ถ้าใหญ่) + ตาราง ratio ก่อน→หลัง ทุกจุด + ผลกวาด 12 หน้า × 2 โหมด เทียบ baseline + เทสต์/tsc เป็นตัวเลข + พิสูจน์สองทาง + ภาพ 1440/390
> เกณฑ์ 12 ข้อ + ตารางจุดทั้งหมด: `qa/job-465-chai-contrast-all-pages.md`
