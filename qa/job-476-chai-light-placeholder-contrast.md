# ใบงาน 476-C (ชัย) — **placeholder ของช่องกรอก โหมดสว่าง ต่ำกว่าเกณฑ์ข้อความ (2.74–2.76) — ปิดทุกช่อง**

**วันที่:** 20 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย (Programmer)** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** ตัวกวาดของ 471-R (หลัง 475-C) วัด **placeholder** ตามเกณฑ์ข้อความ (≥4.5) แล้วรายงาน **18 selectors / 36 occurrences ต่อรอบ** บน `/quote` `/quote#cart` `/studio` `/sketch` — เฉพาะ **โหมดสว่าง** · เดวิดวัดซ้ำบน production แล้ว = จริง
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `artifacts/knight-basins/src/components/ThemeToggle.tsx` (ปักสี) + `artifacts/knight-basins/test/**` + `qa/**` → **เปิด PR**

> **ค่าที่เดวิดวัดเองบน production (20 ต.ค. 69 · main `c86a28f` · `/quote` · โหมดสว่าง)**
> - `input[input-customer-name]` → **`::placeholder` = `oklab(... / 0.5)`** = สี `--ink` โหมดสว่าง **ที่ความโปร่ง 50%** ⇒ บนพื้นขาว = **2.76** ❌ (ต้อง ≥ **4.5** ตาม WCAG 1.4.3 — เป็น **ข้อความ** ไม่ใช่ขอบ)
> - ขอบช่องกรอกของ 475-C ทำงานแล้ว: `rgb(115,138,158)` = `#738a9e` = **3.58** ✓ (ขอบ = UI เกณฑ์ 3.0)
> - **ตัวเลือกที่ผ่าน (คำนวณ):** `--ink-soft` `#577186` บนขาว = **5.11** ✅ · บน `#fbfdfe` = 5.01 ✅ · บน `#f6fbfe` = 4.90 ✅
> - **สาเหตุ:** 474-C ปัก `::placeholder { color: var(--ink-soft); opacity: 1 }` ไว้ **เฉพาะ** `.search-field` / `.portfolio-search-bar` · ที่เหลือยังใช้ค่าเริ่มต้น (สีหลักโปร่ง 50%) ⇒ โหมดมืดผ่าน (7.97) แต่ **โหมดสว่างตก**

> **รายการที่ตก (จากรายงาน 471-R · ครบ 18 selectors)**
> | กลุ่ม | ค่า | จำนวน/รอบ | หน้า |
> |---|---|---|---|
> | A: `rgba(18,62,106,0.5)` บน `rgb(251,253,254)` = **2.74** ❌ | 12 | `/quote` `/quote#cart` `/studio` `/sketch` |
> | B: `rgba(18,62,106,0.5)` บน `rgb(255,255,255)` = **2.76** ❌ | 24 | `/quote` `/quote#cart` |
> - A: `input-customer-project` · `input-customer-purchasing-department` · `input-studio-phone` · `input-studio-email` · `input-studio-address` · `input-studio-line-contact`
> - B: `input-customer-name` · `input-customer-company` · `input-customer-address` · `input-customer-phone` · `input-customer-lineContact` · `input-customer-email` · `input-customer-taxName` · `input-customer-taxId` · `input-customer-taxBranch` · `input-customer-tax-address` (textarea) · `input-customer-site` · `input-customer-notes` (textarea)

> **baseline ที่เดวิดรันเอง (main `9af1ebe` · Linux · Chrome headless)**
> web **1,545 / ผ่าน 1,536 / ตก 0 / ข้าม 9** · api **1,329 / 1,329 / 0** · `tsc --noEmit` = 0 ทั้ง 2 · (CI บน head ของรีพิต: web 1,542 ผ่าน / 0 ตก / 9 ข้าม · api 1,329/0)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 20 ต.ค. 69 · เดวิด

GOAL:
  **A · ปักสี placeholder ของช่องกรอกให้เป็น "ข้อความ" ที่ ≥4.5 ทั้ง 2 โหมด (ปักสีเท่านั้น)**
    · เป้าหมาย: `input` · `select` · `textarea` **ทุกช่องที่ผู้ใช้กรอกได้** ในหน้าเว็บลูกค้า (รวม `.customer-grid` และ `.studio-contact-grid`)
    · **ขยายแนวของ 474-C:** ใช้ `::placeholder { color: var(--ink-soft); opacity: 1 }` (หรือค่าที่วัดแล้ว ≥4.5) — เดวิดวัด: `#577186` บนขาว = **5.11** ✅
    · **ทำใน `artifacts/knight-basins/src/components/ThemeToggle.tsx` เท่านั้น** — **ห้ามแตะ `src/index.css`** (แช่แข็ง) · ห้ามแตะ `src/App.tsx` · **ห้ามแก้ค่าโทเคน**
    · **ห้ามแตะความโปร่งของ "ข้อความที่ผู้ใช้พิมพ์"** (ค่าที่พิมพ์ต้องคงเดิม) — แก้เฉพาะ `::placeholder`
    · **ยกเว้นได้ (ต้องระบุเหตุผลในรายงาน):** คอนโทรลที่ `disabled` · `.admin-app *` (มีธีมของตัวเอง)
    · **ห้าม** เปลี่ยนขนาด/ฟอนต์/ความหนาขอบ/ระยะ/โครงสร้าง/ข้อความ
  **B · ตรวจให้ครบ-ทุกช่อง-ทุกหน้า (ไม่ใช่แค่ 18 ตัวที่รีพิตเจอ)**
    · วัด `::placeholder` ของ **ทุกช่องกรอก** 16 เส้นทาง × 2 โหมด × 1440/390 → เกณฑ์ข้อความ ≥4.5
    · ตาราง: selector · หน้า · โหมด · สี placeholder ก่อน (รวม alpha) · พื้นหลังจริง · ratio ก่อน · สีหลัง · ratio หลัง · ผ่าน/ไม่ผ่าน
    · ต้อง **ไม่เหลือจุดตก** (ยกเว้นปุ่ม LINE) · ถ้าเจอช่องที่ตกเพิ่มจากลิสต์ ให้ปิดด้วย (เป็นงานเดียวกัน)
  **C · ด่านกันลืม + พิสูจน์สองทาง**
    · ต่อจาก `test/contrast-theme-guard.test.ts` — ผูกว่า **placeholder ของช่องกรอกต้องไม่ใช้สีโปร่งของ `--ink`** และต้อง ≥4.5 ทั้ง 2 โหมด (จับได้จริงเมื่อย้อนค่า)
    · **พิสูจน์สองทาง:** ย้อน placeholder กลับเป็นค่าโปร่ง 50% → เทสต์ตก (แนบ error) · คืน → ผ่าน
    · ข้อผูกพันเดิมของ 472-C/474-C/475-C **ห้ามผ่อน**
  **D · ยืนยันด้วยตัวกวาดของ 471-R**
    · หลังแก้: รันตัวกวาดกับบิลด์ของตัวเอง แล้วรายงานว่า **หมวด `text` เหลือ 0** (ไม่เหลือ non-LINE) — เหลือเฉพาะปุ่ม LINE
    · ถ้าตัวกวาดยังฟ้องจุดที่คุณคิดว่าผ่าน ⇒ แนบ selector + ค่าจริง (fg/bg + alpha) + เกณฑ์ที่ใช้ตัดสิน
  **E · ไม่แตะของคนอื่น** — `src/data/**` · `artifacts/api-server/**` · `qa/tools/**` (รีพิตถือ) · `.github/**` · `deploy/**` · `public/**` · production/DB

SCOPE (แก้เฉพาะที่ระบุ · path สัมพัทธ์จาก root รีโป):
  - (รีโป) artifacts/knight-basins/src/components/ThemeToggle.tsx     ← A/B (ปักสี `::placeholder` เท่านั้น)
  - (รีโป) artifacts/knight-basins/test/contrast-theme-guard.test.ts  ← C (ต่อจากของเดิม)
  - (รีโป) qa/report-chai-round37-placeholders-20261020.md (ใหม่) + qa/images/chai-round37/
  - (รีโป) qa/job-476-chai-light-placeholder-contrast.md              ← อ่าน — ใบนี้
  - /opt/data/cache/kbsrc/qa/job-475-chai-input-border-contrast.md    (อ่าน — ใบก่อนหน้า · รูปแบบเดียวกัน)
  - /opt/data/cache/kbsrc/qa/tools/contrast-probe.js (อ่าน/รัน — ตัววัดของเดวิด · ห้ามแก้)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` · `src/App.tsx` · **ค่าตัวแปรโทเคนสี** · `src/data/**` · `artifacts/api-server/**` · `qa/tools/**` · `.github/**` · `deploy/**` · `public/**`
  - ห้ามแก้สีตัวอักษรที่ผู้ใช้พิมพ์ (เฉพาะ `::placeholder`) · ห้ามแก้ขนาด/ฟอนต์/ความหนาขอบ/ระยะ/โครงสร้าง/ข้อความ/ราคา · ห้ามลดเกณฑ์ · ห้ามเพิ่มข้อยกเว้น (นอกที่ระบุใน A) · **ห้ามแตะปุ่ม LINE**
  - ห้ามแตะ production/DB/คอนเทนเนอร์ · ห้ามคำสั่ง DELETE/UPDATE · ห้าม commit ความลับ
  - **ห้าม commit เข้า `main` ตรง · ห้าม merge PR เอง · ห้าม deploy เอง**

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ภาพ):
  1) **ตาราง before/after ครบ:** selector · หน้า · โหมด · สี placeholder ก่อน (พร้อม alpha) · พื้นหลัง rgb · ratio ก่อน · สีหลัง · ratio หลัง
     · ต้องเห็นจุดตั้งต้น: `input-customer-name::placeholder` สว่าง = `rgba(18,62,106,0.5)` บนขาว = **2.76** → หลังแก้ **≥4.5**
     · และ `input-customer-project::placeholder` สว่าง = **2.74** → หลังแก้ **≥4.5**
     · ต้องแสดงด้วยว่า **ค่าที่ผู้ใช้พิมพ์ (color) ไม่เปลี่ยน** (แนบสีที่พิมพ์ก่อน/หลัง)
  2) **พิสูจน์สองทาง (C):** ย้อน placeholder → ตก (แนบ error) · คืน → ผ่าน · ผลรวม `test/contrast-theme-guard.test.ts` เป็นตัวเลข
  3) **ผลตัวกวาด 471-R (D):** หมวด `text` เหลือ 0 (ไม่เหลือ non-LINE) + คำสั่งที่ใช้
  4) **คำสั่ง/ผล:** `pnpm run test` (tests/pass/fail) · `npx tsc -p tsconfig.json --noEmit` ทั้ง 2 artifacts · `git diff --stat` เฉพาะ SCOPE
     · **baseline ของเดวิด (main `9af1ebe` · Linux):** web **1,545 / 1,536 / 0 / ข้าม 9** · api **1,329 / 1,329 / 0** · tsc 0 ทั้ง 2
  5) **ภาพหลักฐาน:** ฟอร์มลูกค้า (`/quote`) และฟอร์มติดต่อ (`/studio`) โหมดสว่าง ก่อน/หลัง (1440) — placeholder ต้องอ่านออกชัด
  6) commit + OS + ผู้รัน + **เวลาไทย**

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `fix(theme): light-theme placeholders meet the 4.5 text criterion (476-C)`
  - `qa/report-chai-round37-placeholders-20261020.md`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ

STOP:
  - ครบ A–E พร้อมหลักฐาน **หรือทำครบ 12 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าต้องแตะ `src/index.css` / `src/App.tsx` / โทเคน / สีของข้อความที่พิมพ์ ⇒ หยุดและแจ้งเดวิดทันที**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–E |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail |
| 6 | พิสูจน์สองทาง | ย้อน → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat เฉพาะ SCOPE |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาตัวเลข/ใช้เกณฑ์ถูกประเภท | placeholder = ข้อความ ⇒ ≥4.5 |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

## ภาคผนวก ก · ค่าที่วัด/คำนวณได้ (เดวิด · 20 ต.ค. 69)

| จุด | โหมด | สี placeholder (ก่อน) | พื้น | ratio ก่อน | ต้อง ≥ | ตัวเลือกที่ผ่าน |
|---|---|---|---|---|---|---|
| `input-customer-name::placeholder` (production) | สว่าง | `oklab(--ink / 0.5)` = `rgba(18,62,106,0.5)` | `#ffffff` | **2.76** ❌ | 4.5 (ข้อความ) | `--ink-soft` `#577186` = **5.11** ✅ |
| `input-customer-project::placeholder` | สว่าง | เดียวกัน | `#fbfdfe` | **2.74** ❌ | 4.5 | `#577186` = **5.01** ✅ |
| placeholder ของ `.search-field` (474-C ปักไว้แล้ว) | สว่าง | — | — | 5.07 ✅ | 4.5 | คงเดิม |
| placeholder ช่องกรอก | มืด | — | `#162238` | 7.97 ✅ | 4.5 | ไม่ต้องแก้ |
| ขอบช่องกรอก (475-C) | มืด/สว่าง | — | — | 4.79 / 3.58 ✅ | 3.0 (UI) | คงเดิม |

> [เดวิด → ชัย] ใบใหม่ **476-C** — คิวงานคอนทราสต์ก้าวหน้าอีกขั้น: หลัง 475-C ปิด "ขอบ" แล้ว ตัวกวาดเหลือ **placeholder โหมดสว่าง** ที่ตกเกณฑ์ **ข้อความ (≥4.5)** ไม่ใช่ขอบ
> · **เดวิดวัดซ้ำบน production เองแล้ว = จริง:** `input-customer-name::placeholder` สว่าง = สี `--ink` **ที่โปร่ง 50%** ⇒ บนขาว = **2.76** ❌ (ต้อง ≥4.5) · `input-customer-project` = **2.74** ❌
> · **สาเหตุ:** 474-C ปัก `::placeholder { color: var(--ink-soft); opacity: 1 }` ไว้เฉพาะช่องค้นหา ⇒ ที่เหลือยังใช้ค่าเริ่มต้นโปร่ง 50%
> · **A:** ขยายการปัก `::placeholder` ให้ครอบ **ทุกช่องกรอก** (สี `--ink-soft` = **5.11** บนขาว ผ่าน) — ทำใน `ThemeToggle.tsx` เท่านั้น · ห้ามแตะ `index.css`/`App.tsx`/โทเคน · **ห้ามแก้สีข้อความที่ผู้ใช้พิมพ์** · ยกเว้น `disabled` + `.admin-app` (ระบุเหตุผล)
> · **B:** วัด placeholder **ทุกช่อง** 16 เส้นทาง × 2 โหมด × 1440/390 → ตาราง before/after (รวม alpha + พื้น rgb) ให้ไม่เหลือจุดตก
> · **C:** ต่อเทสต์กันลืม (ห้ามใช้สีโปร่งของ `--ink` กับ placeholder) + พิสูจน์สองทาง (ห้ามผ่อน 472-C/474-C/475-C)
> · **D:** รันตัวกวาด 471-R กับบิลด์ตัวเอง → หมวด `text` เหลือ 0 (เหลือเฉพาะ LINE)
> · **E:** ห้ามแตะ `src/data/**` · `api-server/**` · `qa/tools/**` · `.github/**` · `deploy/**` · `public/**` · production/DB
> · **ส่ง:** PR + ตารางครบ + พิสูจน์สองทาง + ผลตัวกวาด + ภาพฟอร์มลูกค้า/ฟอร์มติดต่อสว่างก่อน/หลัง + เทสต์/tsc เทียบ baseline 1,545/1,536/0/ข้าม 9 · 1,329/1,329/0 + commit/OS/ผู้รัน/เวลาไทย
> เกณฑ์ 12 ข้อ + ค่าที่วัดได้: `qa/job-476-chai-light-placeholder-contrast.md`
