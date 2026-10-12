# ใบงาน 467-C (ชัย) — **`/studio-guide` โหมดมืดอ่านไม่ออก (33 จุด) + แผงสรุปที่ใช้ `var(--paper)` เป็นสีตัวอักษร**

**วันที่:** 13 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** 1) ชัยรายงานในใบ 466-C (§6) ว่า `/studio-guide` โหมดมืดตก 33 จุด — **เดวิดวัดซ้ำเองบน production หลัง deploy `a7b7d0b` ได้ 33 จุดเท่ากัน** 2) เดวิดวัดเพิ่มเองพบว่าแผงสรุป `/quote` และ `/stone` ใช้ `color: var(--paper)` เป็นสีตัวอักษร ⇒ โหมดมืดกลายเป็นตัวอักษรกรมท่าบนพื้นกรมท่า
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `artifacts/knight-basins/src/**` ตาม SCOPE + `test/` + `qa/` → **เปิด PR**
**สถานะใบก่อน:** 465-C ปิด (`69af664`) · 466-C ปิด (`a7b7d0b`) — `/sketch` โหมดมืด **0 จุด** แล้ว (เดวิดวัดซ้ำเอง: มืด 1 = ปุ่ม LINE · สว่าง 1 = ปุ่ม LINE · ภาพหน้าจอแผงอัปโหลดอ่านได้ครบ)

> ### ⚠️ บทเรียนที่ต้องยึดในใบนี้ (สาเหตุที่ 2 รอบก่อนพลาดหน้า)
> **เดวิดตั้งรายการกวาดผิด** — ใช้ `/handover` `/track` แทน `/sketch` `/studio-guide` ที่ **อยู่ใน `public/sitemap.xml` จริง** ⇒ **รายการกวาดมาตรฐาน = 12 เส้นทางใน sitemap เป๊ะ ๆ** (ดึงด้วยคำสั่ง ไม่พิมพ์มือ):
> `curl -s https://knightbasins.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//'`
> = `/` `/network` `/portfolio` `/price-guide` `/quote` `/readme` `/site-prep` `/sketch` `/stone` `/studio` `/studio-guide` `/updates`
> **บวกเส้นทางนอก sitemap:** `/profile` `/handover` `/track` `/quote/view` (รหัสทดสอบ) · และ **ทุกหน้าต้องวัดด้วยตัวกวาดที่เห็นพื้นไล่สี/พื้นรูป** ไม่ใช่ `contrast-probe.js` อย่างเดียว

> **baseline ที่เดวิดวัดเอง (13 ต.ค. 69 · production `https://knightbasins.com` · หลัง deploy `a7b7d0b`)**
> · `/studio-guide` โหมดมืด: ตรวจ 72 จุด · **ตกเกณฑ์ 33 จุด** — ตัวอย่างที่แย่สุด: `h2.text-lg` "เลือกสีหินก่อน" **1.16** · ย่อหน้าใน `card-studio-guide-step-1/2/3` **1.16** · `summary` ใน FAQ 4 ข้อ **1.16** · รายการ `li > span` ในขั้นตอน **2.00** · คำบรรยายภาพในแกลเลอรี **2.00** (ทั้งหมด = `rgb(232,239,248)`/`rgb(170,185,204)` ทับพื้น **rgb(255,255,255)**)
> · `/quote` โหมดมืด (วัดเอง): `.quote-terms strong` "หมายเหตุจากแคตตาล็อก" = `rgb(15,23,42)` บนพื้น `rgb(22,34,56)` → **~1.1** (ต้นเหตุ: `index.css` ใช้ `color: var(--paper)` เป็นสีตัวอักษร และในธีมมืด `--paper` = #0f172a)
> · `/` โหมดมืด (วัดเอง): `.product-index` "KF001" = `rgb(170,185,204)` บน `.product-art` ที่มี `linear-gradient(145deg, rgba(255,…))` → ตัววัดปกติข้าม ⇒ ต้องวัดด้วย pixel
> · หน้าอื่น 12 เส้นทาง sitemap + นอก sitemap: **เหลือแต่ปุ่ม LINE เขียว** (ยกเว้นตามคำสั่งบอส)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 13 ต.ค. 69 · เดวิด

GOAL:
  **A · `/studio-guide` โหมดมืด — 33 จุด → 0**
    A1 **การ์ดขั้นตอน (`article[data-testid="card-studio-guide-step-1..3"]`) พื้นขาวตายตัว** แต่หัวข้อ/ย่อหน้าใช้โทเคนธีมมืด
       · วัดได้: `h2.text-lg` **1.16** · `p.text-sm` **1.16** · `li > span` **2.00**
       · แก้: พื้น/ขอบ/ตัวอักษรให้ตามธีมในโหมดมืด (ใช้ `var(--card-paper)` / `var(--line)` / `var(--ink)` / `var(--ink-soft)` แบบเดียวกับที่ทำในใบ 465-C/466-C) · **ห้ามแก้ให้โหมดสว่างเปลี่ยนหน้าตา**
    A2 **FAQ (`section[data-testid="section-studio-guide-faq"]` → `details > summary` 4 ข้อ) = 1.16** (ตัวอักษรสว่างบนพื้นขาว)
    A3 **แกลเลอรี (`section[data-testid="section-studio-guide-gallery"]`) คำบรรยาย `[data-testid="studio-guide-gallery-caption"]` = 2.00**
    A4 กวาดทั้งหน้าให้เหลือ **0** ในทุกสถานะที่ลูกค้าเจอ (เปิดหน้า · เปิด/ปิด FAQ ทุกข้อ · เลื่อนดูแกลเลอรี · มี/ไม่มีข้อมูลในตะกร้า) ที่ **1440 และ 390**
  **B · แผงสรุปที่ใช้ `var(--paper)` เป็น "สีตัวอักษร" — กลับสีในโหมดมืด**
    B1 `/quote` → `.quote-terms strong` (หมายเหตุจากแคตตาล็อก) = **~1.1** · และตรวจ **ทุกบรรทัดใน `aside.quote-summary`** (`.total-rows span/small` · `.grand-total span/small` · `.quote-terms p`) เพราะ `index.css` ตั้ง `.quote-summary { background: var(--deep); color: var(--paper) }` ⇒ โหมดมืดตัวอักษรที่ไม่มีสีของตัวเองจะกลายเป็นกรมท่าบนกรมท่า
       · แก้: ปักสีตัวอักษรของแผงเป็นสีอ่อนคงที่ (เช่น `#e8eff8` / `#cbd5e1` / `#a9b3af` ที่มีอยู่) **ห้ามแก้ค่าโทเคน**
    B2 `/stone` → `aside.config-summary` โครงเดียวกับ B1 (`.config-summary { background: var(--deep); color: var(--paper) }` + `.price-note` `.muted` `.summary-row span/small`)
    B3 **กวาดทั้งรีโป:** `grep -n "color: var(--paper)" artifacts/knight-basins/src/index.css` และ `grep -n "background: var(--ink)" …` → ตรวจ**ทุกบรรทัด**ที่ใช้โทเคน "หมึก" เป็นสีพื้นหรือใช้โทเคน "กระดาษ" เป็นสีตัวอักษร ⇒ รายงานว่าบรรทัดใดปลอดภัย/บรรทัดใดต้องปักสี (พร้อมเหตุผล)
  **C · ป้ายบนภาพสินค้าหน้าแรก (`/` โหมดมืด)**
    · `.product-index` ("KF001") / `.art-note` / `.product-video-link` ทับ `.product-art` ที่มี `linear-gradient(145deg, …)`
    · **ต้องวัดด้วยวิธีที่เห็นพื้นไล่สี** (pixel sampling / ถอดไล่สีชั่วคราว) แล้วแก้ให้ ≥4.5 ในโหมดมืด · โหมดสว่างคงเดิม
  **D · นอกขอบเขต — ห้ามแก้ แต่ต้องรายงาน**
    · **กฎ hero (#449)** — เดวิดสั่ง **ห้ามแตะ** ในใบนี้ (ต้องรออนุมัติบอส) ⇒ ถ้าพบจุดตกเกณฑ์ใน hero ให้รายงาน selector + ตัวเลข + ภาพ
    · จุดที่พบแต่อยู่นอก SCOPE (เช่น ไฟล์ที่ต้องแตะ `App.tsx` นอกที่ระบุ) ⇒ รายงาน ห้ามแก้
  **E · ปิดจุดบอดของ "พื้นไล่สี/พื้นรูป" ให้เป็นงานประจำ**
    · เสนอ+ทำ: ให้ **CI รันตัวกวาดพื้นไล่สี** (`qa/tools/gradient-scan-465c.mjs`) เสริม `contrast-probe.js` — ถ้าแตะ `.github/workflows/**` ไม่ได้/ไม่แน่ใจ **ให้หยุดถามเดวิดก่อน** (งานนี้ต้องอนุมัติแยก)
    · อย่างน้อยที่สุด: ทำ **สคริปต์เดียวที่กวาด 12 เส้นทาง sitemap + นอก sitemap × 2 โหมด** แล้วแนบผลรันเป็นหลักฐานในใบนี้
  **F · ไม่ทำของเดิมพัง**
    · โหมดสว่างทุกหน้าต้องไม่เปลี่ยน (หน้าตา/ระยะ/ขนาด) · ราคา/ขนาด/สี/รหัส/ข้อความธุรกิจ/ลิงก์ = ห้ามเปลี่ยน
    · งานที่ 465-C + 466-C แก้แล้วต้องไม่ย้อนกลับ (`/price-guide` · `/quote` `.quote-share` · `/sketch` · ฟุตเตอร์ · `/studio` `/portfolio` `/readme` `/network` `/updates` `/stone` แผงที่ปักแล้ว) · ล้นแนวนอน 0 ที่ 1440/390 · ใบเสนอราคา A4 ไม่ล้น

SCOPE (แก้เฉพาะที่ระบุ · path สัมพัทธ์จาก root รีโป):
  - (รีโป) artifacts/knight-basins/src/pages/StudioGuidePage.tsx       ← A1–A4 (ทั้งไฟล์)
  - (รีโป) artifacts/knight-basins/src/components/ThemeToggle.tsx      ← ต่อท้าย CSS ธีมมืด เฉพาะจุดของ A/B/C (บอสรับทราบแล้ว · บอยอาจชน)
  - (รีโป) artifacts/knight-basins/src/index.css                       ← เฉพาะปักสีของ B1/B2/C (ห้ามแก้ค่าตัวแปรโทเคน · ห้ามแตะกฎ hero #449)
  - (รีโป) artifacts/knight-basins/test/                               ← เทสต์กันถอยหลัง (ต่อจาก test/contrast-theme-guard.test.ts)
  - (รีโป) qa/tools/gradient-scan-465c.mjs · qa/tools/contrast-probe.js ← ขยาย/ใช้ (ห้ามแก้ contrast-probe.js ให้ผิดจากของเดวิด — ถ้าจำเป็นให้คัดลอกเป็นไฟล์ใหม่)
  - (รีโป) qa/report-chai-round29-studio-guide-contrast-20261013.md (ใหม่) + qa/images/chai-round29/
  - /opt/data/cache/kbsrc/qa/job-466-chai-sketch-contrast.md (อ่าน — ใบก่อนหน้า + วิธีวัดพื้นไล่สี)
  - /opt/data/cache/kbsrc/qa/tools/contrast-probe.js (อ่าน/รัน — ตัววัดของเดวิด)

FORBIDDEN:
  - ห้ามแตะ `src/data/**` · `artifacts/api-server/**` · `artifacts/knight-basins/public/**` · `scripts/**` · tailwind config · `deploy/**` · `.github/**` (ถ้าจะแก้ CI ให้หยุดถามก่อน) · `src/App.tsx` (ใบนี้ไม่ต้องใช้)
  - **ห้ามแก้ค่าตัวแปรโทเคนสีทุกตัว** (`--ink` `--ink-soft` `--paper` `--card-paper` `--line` `--deep` `--brand-*`) · **ห้ามแตะกฎ hero #449**
  - **ห้ามใช้ `dark:` ของ Tailwind** (ตายทั้งเว็บ) · ห้ามสลับธีมไปใช้คลาส `.dark`
  - ห้ามเปลี่ยนข้อความ/ตำแหน่ง/ขนาด/จำนวน/ลิงก์ · ห้ามลบ element หรือซ่อนข้อความเพื่อให้ผ่านเกณฑ์
  - ห้ามแตะข้อมูลลูกค้าจริง (ทดสอบด้วย fixture/รหัสทดสอบ) · ห้ามแตะ production DB · ห้าม commit ของจริง/ความลับ
  - ห้าม commit เข้า `main` ตรง · ห้าม merge PR เอง

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ภาพ):
  1) **ตารางก่อน-หลัง `/studio-guide`:** ทุก selector ที่ตกเกณฑ์ในโหมดมืด (33 จุด — จัดกลุ่มตามการ์ด/FAQ/แกลเลอรี) · สีตัวอักษร · พื้นหลัง · **ratio ก่อน→หลัง** · เกณฑ์ 4.5/3.0
  2) **ตารางก่อน-หลัง B1/B2/C:** `.quote-terms strong` + บรรทัดอื่นใน `aside.quote-summary` · `aside.config-summary` · `.product-index`/`.art-note` หน้าแรก (แถวที่ทับพื้นไล่สีต้องระบุวิธีวัด)
  3) **ผลกวาดมาตรฐาน (ต้องมีทั้ง 2 โหมด):** 12 เส้นทางจาก `curl -s https://knightbasins.com/sitemap.xml` (ดึงด้วยคำสั่ง ไม่พิมพ์มือ) + นอก sitemap `/profile` `/handover` `/track` + ผลจากตัวกวาดพื้นไล่สี · เทียบ baseline ของเดวิดในหัวใบนี้ (`/studio-guide` มืด 33 → 0)
  4) **คำสั่ง:** `node qa/tools/contrast-probe.js <route> dark|light` · `node qa/tools/gradient-scan-465c.mjs …` · `curl -s https://knightbasins.com/sitemap.xml | grep -o '<loc>[^<]*'`
  5) **เทสต์:** `pnpm run test` + `npx tsc -p tsconfig.json --noEmit` (ทั้ง 2 artifacts) เป็นตัวเลข · **baseline เดวิดบน main `a7b7d0b` (Linux):** web **1,505/1,496/0/ข้าม 9** · api **1,329/1,329/0** · tsc 0
  6) **เทสต์กันถอยหลังใหม่** + **พิสูจน์สองทาง** (ถอดการแก้ → ตก แนบข้อความ error · คืน → ผ่าน)
  7) **ภาพก่อน-หลัง** `/studio-guide` โหมดมืด (1440/390 · เปิดหน้า + เปิด FAQ) · `/quote` แผงสรุปโหมดมืด · `/` ป้ายสินค้าโหมดมืด · โหมดสว่างของ 3 หน้าที่เทียบ (ต้องไม่เปลี่ยน)
  8) **ล้นแนวนอน 0** ที่ 1440/390 (ระบุ `innerWidth/clientWidth/scrollWidth`) · `git diff --stat` เฉพาะไฟล์ใน SCOPE · **ระบุ commit + OS + ผู้รัน + เวลาไทย**

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `fix(theme): /studio-guide + summary panels readable in dark mode (467-C)`
  - `qa/report-chai-round29-studio-guide-contrast-20261013.md` + ภาพ/ตัวเลขดิบใน `qa/images/chai-round29/`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ (รวมรายการที่พบนอก SCOPE และเรื่อง CI)

STOP:
  - ครบ A–F พร้อมหลักฐาน **หรือทำครบ 16 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าต้องแก้ค่าตัวแปรโทเคน · กฎ hero #449 · `src/data/**` · `api-server/**` · `public/**` · `.github/**` · `src/App.tsx` หรือไฟล์นอก SCOPE ⇒ หยุดและแจ้งเดวิดทันที ห้ามแก้เอง**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–F |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail เทียบ baseline |
| 6 | พิสูจน์สองทาง | ถอด → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat เฉพาะ SCOPE |
| 8 | ไม่แตะ production DB/ข้อมูลลูกค้า | ยืนยันในรายงาน |
| 9 | ไม่เดาตัวเลข | ratio ทุกแถววัดจริง + ระบุวิธีวัดบนพื้นไล่สี |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

## ภาคผนวก ก · ตัวเลขดิบของเดวิด (13 ต.ค. 69 · production หลัง `a7b7d0b`)

**ก.1 · `/studio-guide` โหมดมืด — 33 จุด (ตรวจ 72 จุด) ตัวอย่างที่แย่สุด**

| selector | ข้อความ | สีตัวอักษร | พื้นหลัง | ratio |
|---|---|---|---|---|
| `article[card-studio-guide-step-1] h2.text-lg` | `เลือกสีหินก่อน` | rgb(232,239,248) | rgb(255,255,255) | **1.16** |
| `article[card-studio-guide-step-1] p.text-sm` | `กดปุ่ม "สีหิน" บนแถบด้านบน …` | rgb(232,239,248) | rgb(255,255,255) | **1.16** |
| `article[card-studio-guide-step-2/3] h2/p` | `เลือกทรงและกรอกขนาดแผ่นจริง` ฯลฯ | rgb(232,239,248) | rgb(255,255,255) | **1.16** |
| `section[section-studio-guide-faq] details > summary` ×4 | `เปลี่ยนรูปทรงแล้ว ขอบที่ตั้งไว้จะหายไหม?` ฯลฯ | rgb(232,239,248) | rgb(255,255,255) | **1.16** |
| `div.min-w-0 > ul > li > span` ×~14 | `กรองตามเรตราคาได้ทันที: ฿7,500 / ฿8,500` ฯลฯ | rgb(170,185,204) | rgb(255,255,255) | **2.00** |
| `[data-testid="studio-guide-gallery-caption"]` | `เคาน์เตอร์หินพร้อมอ่างล้างหน้าในเนื้อหิน` | rgb(170,185,204) | rgb(255,255,255) | **2.00** |

**ก.2 · แผงสรุปที่ใช้ `var(--paper)` เป็นสีตัวอักษร (โหมดมืด)**

| หน้า | selector | สีตัวอักษร | พื้นหลัง | ratio | ต้นเหตุใน `index.css` |
|---|---|---|---|---|---|
| `/quote` | `.quote-terms strong` | rgb(15,23,42) | rgb(22,34,56) | **~1.1** | `.quote-terms strong { color: var(--paper) }` |
| `/quote` | `aside.quote-summary` | `var(--paper)` = #0f172a | `var(--deep)` + gradient | ต้องตรวจทุกบรรทัด | `.quote-summary { background: var(--deep); color: var(--paper) }` |
| `/stone` | `aside.config-summary` | `var(--paper)` = #0f172a | `var(--deep)` | ต้องตรวจทุกบรรทัด | `.config-summary { background: var(--deep); color: var(--paper) }` |
| `/` | `.product-index` "KF001" / `.art-note` | rgb(170,185,204) | `.product-art` + `linear-gradient(145deg, rgba(255,…))` | วัดด้วย pixel | `.product-art { background: linear-gradient(…#edf8fc,#dceef7) }` |

**ก.3 · รายการกวาดมาตรฐาน (ดึงจาก sitemap จริง)**
`/` `/network` `/portfolio` `/price-guide` `/quote` `/readme` `/site-prep` `/sketch` `/stone` `/studio` `/studio-guide` `/updates`
**นอก sitemap:** `/profile` `/handover` `/track` `/quote/view`

> [เดวิด → ชัย] ใบใหม่ **467-C** — รับ 466-C แล้ว (merge #601 → `a7b7d0b` · เดวิดรันเทสต์เอง 1,505/1,496/0 · tsc 0 · **`/sketch` มืด 0 จุดแล้ว** ภาพยืนยันแผงอัปโหลดอ่านได้ครบ) + **แก้ถอยหลัง `.price-note` ในแผงสรุป `/stone` ที่เดวิดยืนยันเองว่าโดนจริง** (คืนเป็น `rgb(169,179,175)` แล้ว)
> · **A** `/studio-guide` โหมดมืด **33 จุด → 0** (การ์ดขั้นตอน 1.16 · FAQ summary 1.16 · รายการ/คำบรรยายภาพ 2.00)
> · **B** แผงสรุปที่ใช้ `var(--paper)` เป็นสีตัวอักษร: `/quote` `.quote-terms strong` **~1.1** + ตรวจทุกบรรทัดใน `aside.quote-summary` · `/stone` `aside.config-summary` · **กวาด `grep "color: var(--paper)"` ทั้งไฟล์ แล้วรายงานทุกบรรทัด**
> · **C** ป้ายบนภาพสินค้าหน้าแรก (`.product-index`/`.art-note`) — วัดด้วย pixel เพราะทับพื้นไล่สี
> · **D** **ห้ามแตะ hero #449** (ต้องรออนุมัติบอส) — พบให้รายงาน · **E** ทำสคริปต์กวาดเดียวที่ครอบ 12 เส้นทาง sitemap + นอก sitemap × 2 โหมด (จะให้ CI รันด้วย ให้หยุดถามเดวิดก่อน — `.github/**` ต้องอนุมัติแยก)
> · **เดวิดยอมรับความผิดของตัวเอง:** รายการกวาดของ 465-C ตั้งผิด (ใช้ `/handover` `/track` แทน `/sketch` `/studio-guide` ที่อยู่ใน sitemap) ⇒ ใบนี้กำหนดให้ **ดึงรายการจาก sitemap ด้วยคำสั่ง** และห้ามใช้ `contrast-probe.js` อย่างเดียว
> · **ห้ามแตะ:** ค่าโทเคนสี · hero #449 · `data/**` · `api-server/**` · `public/**` · `App.tsx` · `.github/**`
> · **ส่ง:** PR + ตาราง ratio ก่อน→หลังทุกจุด + ผลกวาด 12 เส้นทาง × 2 โหมด + ภาพก่อน-หลัง 1440/390 + เทสต์/tsc เป็นตัวเลข + พิสูจน์สองทาง
> เกณฑ์ 12 ข้อ + ตัวเลขดิบ: `qa/job-467-chai-studio-guide-contrast.md`
