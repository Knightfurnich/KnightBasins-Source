# ใบงาน 286-Q (Qwen) — ตาราง+เนื้อหา /price-guide · og:image รายหน้า · ป้ายเวอร์ชัน · เบอร์หลัก 094

**วันที่:** 8 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Qwen** · **ผู้ตรวจรับ:** เดวิด
**ที่มา:** ข้อเสนอของคุณเองใน handoff (ข้อ ③) + คำชี้ขาดของบอส 8 ต.ค. 69 (เบอร์โทร) — เดวิดตรวจซ้ำทุกข้อแล้วว่าเป็นของจริง
**ผลตรวจจริงของเดวิดบน production (8 ต.ค. 69 · หลัง merge #392/#393/#394 + nginx ใหม่):**
```
/price-guide   <table> = 0  (หน้าเดียวในกลุ่มคู่มือที่ไม่มีตารางเปรียบเทียบ)      ✅ ของจริง
ทุกหน้า        og:image = https://knightbasins.com/og-image.jpg เหมือนกันหมด     ✅ ของจริง
src/App.tsx:302 ป้าย "บันทึกการอัปเดต (v2.2)" แต่ release ล่าสุด = v2.2.1        ✅ ของจริง
JSON-LD        organization.telephone = +66-91-978-2292 · contactPoint sales = 091 · customer service = 094
               089-762-2209 ไม่ปรากฏใน JSON-LD เลย (โผล่แค่ footer + ข้อความ FAQ) ✅ ของจริง
```
**คำชี้ขาดบอส (8 ต.ค. 69):** เบอร์หลัก = **094-496-1949** · เบอร์รอง = **091-978-2292** (089 ยังไม่มีคำสั่ง ⇒ ห้ามแตะ)
**Branch:** `seo/qwen-job286-price-guide-table-copy-and-page-images`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 8 ต.ค. 69 · เดวิด

GOAL:
  A. **`/price-guide` ต้องมีตารางเปรียบเทียบจริง (วันนี้ `<table>` = 0)**
     เพิ่มตาราง 1 ตัวใน `PriceGuidePage.tsx` เทียบ **3 วิธีซื้อ** (ซื้อแผ่นเต็ม · งานผลิต+ติดตั้ง · ชุดอ่างสำเร็จรูป)
     คอลัมน์: วิธีซื้อ · หน่วยที่คิดราคา (แผ่น / ตร.ม. / ชุด) · ราคาเริ่มต้น · เหมาะกับงานแบบไหน · สั่งที่ไหนในเว็บ
     ⚠️ **ตัวเลขทุกตัวต้องอ่านจากค่าคงที่ของแอป** (`STONE_COLORS` · เรตติดตั้ง · ราคาอ่างใน `src/data/**` + `src/data/catalog.ts`)
        — **ห้ามพิมพ์ตัวเลขเองในไฟล์ ห้ามเดา** และ **ห้ามใส่ราคาลง JSON-LD ใด ๆ** (กฎเดิม)
     ⚠️ ตารางต้องอ่านได้บนมือถือ (ไม่ล้นจอ) · ห้ามใช้ `font-size` ต่ำกว่า 12px · **ห้ามแตะ `src/index.css`**
  B. **เนื้อหา `/price-guide` ให้แน่นเท่าระดับ `/studio-guide`**
     เดวิดวัด: `/price-guide` เนื้อหาสั้นกว่า `/studio-guide` ชัดเจน — เพิ่มเฉพาะ **ข้อเท็จจริงที่ยังขาด** เช่น
     วิธีวัดพื้นที่ให้ตรงกับที่ทีมใช้จริง · เงื่อนไขงานเล็ก/ขั้นต่ำ · สิ่งที่รวมในเรตแล้ว (เจาะช่องอ่าง/ช่องก๊อก/ติดตั้ง) · สิ่งที่ทำให้ราคาเปลี่ยน
     ห้ามยัดคำโฆษณา ห้ามเพิ่มตัวเลขใหม่ที่ไม่มีที่มาในโค้ด
     ⚠️ **ถ้าแก้ข้อความ FAQ** ข้อความเดียวกันอยู่ 3 ที่ (`src/data/faq-data.ts` · `index.html` · `public/llms-full.txt`)
        ต้องแก้พร้อมกันทั้ง 3 — ไม่งั้นเทสต์ drift (`llms-txt-content-integrity` · `public-copy-script-guard`) จะ fail
  C. **`og:image` รายหน้า** (วันนี้ทุกหน้าใช้รูปเดียว)
     ทำ plumbing: ให้ `RouteMeta` ประกาศรูปของแต่ละ route แล้ว `scripts/prerender.mjs` เขียน `<meta property="og:image">` ตาม route
     กติกา: ใช้ **รูปที่มีอยู่จริง** เท่านั้น — ค่าตั้งต้น `/og-image.jpg` · หน้าที่มีรูปงานจริงของตัวเองให้ใช้ URL รูปนั้น
     (เช่นรูปที่หน้านั้นใช้อยู่จาก `/api/uploads/portfolio/...` หรือ `/kb/images/...`) — **ห้ามสร้างไฟล์รูปใหม่ ห้ามใช้ path ที่ไม่ตอบ 200**
     ต้องเป็น URL เต็มโดเมน `https://knightbasins.com/...` เท่านั้น · และต้องมีอย่างน้อย 3 หน้า (นอกหน้าแรก) ที่รูปไม่ซ้ำกัน
  D. **ป้ายเวอร์ชันใน footer ต้องไม่พิมพ์มือ** — `src/App.tsx:302` เขียนว่า `(v2.2)` แต่ release ล่าสุดคือ `v2.2.1`
     ให้ดึงจาก `UPDATE_RELEASES` (`src/pages/UpdatesPage.tsx`) แล้วแสดงเวอร์ชันล่าสุดจริง + ล็อกด้วยเทสต์
  E. **เบอร์โทรตามคำชี้ขาดบอส (094 = หลัก · 091 = รอง)**
     - `index.html` JSON-LD: `organization.telephone` = `"+66-94-496-1949"` · `contactPoint` ให้ `sales` = `+66-94-496-1949` และ `customer service` = `+66-91-978-2292` (คงไว้ทั้ง 2 เบอร์)
     - `grep` หาที่อื่นในโค้ดที่ยังยึด 091 เป็นเบอร์หลัก แล้วแก้ให้สอดคล้อง (เช่น `App.tsx` `salesPhone`)
     - **ห้ามแตะ 089-762-2209** (footer + ข้อความ FAQ) — บอสยังไม่ชี้ขาด
     - **อัปเดตเทสต์ `test/geo-structured-data.test.ts`** ที่เดิมยึด 091 เป็นหลัก ให้ล็อกความจริงใหม่ (ทั้ง 12 หน้า)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/PriceGuidePage.tsx        (ข้อ A + B)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html                          (ข้อ E + ข้อ A ถ้าต้องอ้างยอดรวมใน FAQ)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx                         (ข้อ D + E)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.logic.ts   (ข้อ C — เพิ่มฟิลด์รูปต่อ route)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.tsx        (ข้อ C — เขียน meta)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/scripts/prerender.mjs               (ข้อ C — og:image ต่อ route)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt                (เฉพาะเมื่อข้อความ FAQ เปลี่ยน — แก้ให้ตรงกัน)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/                               (ใหม่/แก้: og:image + ป้ายเวอร์ชัน + เบอร์โทร)
  - /opt/data/cache/kbsrc/qa/job-286-qwen-price-guide-table-copy-and-page-images.md    อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแตะ `src/index.css` · `src/data/**` (ราคา/รหัสสี/อ่าง) · `artifacts/api-server/**` · `src/admin/**` · `public/sitemap.xml` · `pnpm-lock.yaml`
  - ห้ามพิมพ์ตัวเลขราคาเองในไฟล์ (ต้องมาจากค่าคงที่) · ห้ามใส่ราคาใน JSON-LD · ห้ามแก้/ลบเบอร์ 089-762-2209
  - ห้ามสร้างไฟล์รูปใหม่ · ห้ามใช้ og:image ที่ไม่ตอบ 200 · ห้ามใส่ path สัมพัทธ์ใน og:image
  - ห้ามอ่าน/พิมพ์ `.env`/คีย์ · ห้ามแตะ production/DB · ห้าม push ตรงเข้า `main` · ห้าม merge เอง

EVIDENCE:
  1) ข้อ A: `grep -c '<table' PriceGuidePage.tsx` → ต้อง ≥ 1 (ก่อนแก้ = 0 — แนบก่อน/หลัง) + แนบภาพ/ข้อความตารางที่เรนเดอร์จริง
  2) ข้อ B: ตัวเลขคำในย่อหน้าเนื้อหาของ `/price-guide` ก่อน/หลัง (วิธีนับของคุณก็ได้ — ระบุวิธีให้ชัด) + เทสต์กันหลุดของเนื้อหาที่เพิ่ม
  3) ข้อ C: หลัง build — `grep -o 'og:image" content="[^"]*"' dist/public/<route>/index.html` ต้องได้รูปต่างกัน ≥ 3 หน้า (นอกหน้าแรก) และทุกค่าเป็น URL โดเมนเต็ม
  4) ข้อ D: ป้ายใน footer ตรงกับ release ล่าสุดใน `UPDATE_RELEASES` + เทสต์ที่ล็อกไว้
  5) ข้อ E: เทสต์ `geo-structured-data.test.ts` (แก้แล้ว) ผ่าน · ทุกหน้าใน dist → `telephone` = `+66-94-496-1949` · `contactPoint` มีทั้ง 094 และ 091 · 089 ยังอยู่ที่เดิม
  6) ชุดเทสต์เว็บทั้งชุด ตก **0** — baseline main 8 ต.ค. 69 = **1190 tests / 1181 pass / 0 fail / 9 skip**
     คำสั่ง: `rm -rf dist && pnpm run build` แล้ว `files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort); node --experimental-strip-types --test $files`
  7) `pnpm run typecheck:libs` (root) ก่อน แล้ว `pnpm exec tsc --noEmit` ใน artifacts/knight-basins → **0 errors**
  8) `git diff --stat origin/main...HEAD` → แตะไม่เกิน **8 ไฟล์** · `src/index.css` 0 diff · lockfile 0 diff · sitemap 0 diff

OUTPUT:
  - `/price-guide` มีตารางเปรียบเทียบ + เนื้อหาที่แน่นขึ้น (ตัวเลขจากค่าคงที่เท่านั้น)
  - og:image รายหน้า + เทสต์กันหลุด · ป้ายเวอร์ชันที่ดึงจาก `UPDATE_RELEASES`
  - JSON-LD ใช้ 094 เป็นหลัก 091 เป็นรอง + เทสต์ล็อกครบ 12 หน้า
  - รายงาน: ตัวเลขก่อน/หลังทุกข้อ · ชื่อไฟล์/บรรทัดที่แก้ · คำสั่ง+ผลรันดิบ

STOP:
  - เมื่อ ตารางใน /price-guide เรนเดอร์จริง · og:image ต่างกัน ≥ 3 หน้าและทุกค่าเป็น URL โดเมนเต็ม · ป้าย footer = release ล่าสุด · JSON-LD ทุกหน้า = 094 หลัก + มีทั้ง 094/091 และ 089  untouched · ชุดเทสต์ตก **0** · tsc **0 error** · แตะไม่เกิน **8 ไฟล์**
  - หรือเมื่อทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR/รายงาน)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | ตารางเปรียบเทียบใน /price-guide | `<table>` ≥ 1 · เรนเดอร์จริงบนมือถือไม่ล้น |
| 2 | ตัวเลขในตาราง/เนื้อหา | มาจากค่าคงที่ของแอป 100% — ไม่มีตัวเลขพิมพ์มือ |
| 3 | ห้ามราคาใน JSON-LD | ตรวจแล้ว 0 |
| 4 | เนื้อหา /price-guide | แน่นขึ้นจริง + ไม่ยัดคำโฆษณา |
| 5 | FAQ แก้ที่เดียว | ถ้าแก้ข้อความ ต้องตรงกันทั้ง faq-data.ts · index.html · llms-full.txt |
| 6 | og:image รายหน้า | ≥ 3 หน้าที่รูปไม่ซ้ำ · URL โดเมนเต็ม · ตอบ 200 ทุกค่า |
| 7 | ป้ายเวอร์ชัน | ดึงจาก `UPDATE_RELEASES` (ไม่พิมพ์มือ) + มีเทสต์ |
| 8 | เบอร์โทร | 094 = หลัก · 091 = รอง · 089 ไม่ถูกแตะ |
| 9 | เทสต์ geo-structured-data | อัปเดตให้ตรงความจริงใหม่ และผ่าน |
| 10 | ชุดเทสต์เว็บ | ตก 0 · เทียบ 1190/1181/0/9 + ระบุ commit |
| 11 | ขอบเขตไฟล์ | ≤ 8 ไฟล์ · index.css/lockfile/sitemap 0 diff |
| 12 | หลักฐานดิบ | คำสั่ง + ตัวเลขจริงทุกข้อ (ไม่ใช้คำรับรอง) |

## รายงานผลท้ายใบ (ให้ Qwen ตอบในคอมเมนต์ PR)

| # | หัวข้อ | ต้องระบุ |
|---|---|---|
| 1 | ตาราง | จำนวน `<table>` ก่อน/หลัง · 3 วิธีซื้อที่เทียบ |
| 2 | เนื้อหา | วิธีนับคำ + ก่อน/หลัง · หัวข้อที่เพิ่ม |
| 3 | og:image | ตาราง route → รูป (ก่อน/หลัง) + HTTP code ของรูป |
| 4 | เวอร์ชัน | ค่าที่ดึงได้จาก `UPDATE_RELEASES` + ที่แก้ |
| 5 | เบอร์ | ก่อน/หลังของ JSON-LD (telephone + contactPoint) และที่อื่นที่แก้ |
| 6 | เทสต์ | ชุดเว็บทั้งหมด + เทสต์ใหม่แต่ละตัว + commit SHA |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → Qwen] ใบ 286-Q ครับ — รวม 5 งานเป็น PR เดียว (บอสอนุมัติ 8 ต.ค. 69)
บริบท: เดวิด merge #392/#393/#394 แล้ว · deploy success · live ตรวจครบ (JSON-LD 12/12 มี author/dateModified · FAQPage เหลือหน้าแรก · header ครบ · รูป uploads cache 30 วัน)
ทำ:
A. /price-guide เพิ่มตารางเปรียบเทียบ 3 วิธีซื้อ (วันนี้ <table> = 0 จริง) — ตัวเลขต้องอ่านจากค่าคงที่ของแอปเท่านั้น ห้ามพิมพ์มือ ห้ามใส่ราคาใน JSON-LD
B. เนื้อหา /price-guide ให้แน่นเท่า /studio-guide — เพิ่มข้อเท็จจริงที่ขาด (วิธีวัดพื้นที่ · งานเล็ก/ขั้นต่ำ · อะไรรวมในเรตแล้ว) ถ้าแก้ FAQ ต้องแก้ 3 ที่พร้อมกัน (faq-data.ts · index.html · llms-full.txt)
C. og:image รายหน้า (วันนี้ทุกหน้าใช้ og-image.jpg เดียว) — ใช้รูปที่มีจริงเท่านั้น ห้ามสร้างไฟล์ใหม่ ห้ามใช้ path ที่ไม่ตอบ 200 · ต้องต่างกัน ≥ 3 หน้า
D. ป้าย footer (src/App.tsx:302) เขียน (v2.2) แต่จริง v2.2.1 → ดึงจาก UPDATE_RELEASES + เทสต์ล็อก
E. เบอร์โทรตามคำชี้ขาดบอส: หลัก = 094-496-1949 · รอง = 091-978-2292 → แก้ JSON-LD (telephone + contactPoint) + ที่อื่นที่ยึด 091 เป็นหลัก + อัปเดตเทสต์ geo-structured-data · ห้ามแตะ 089-762-2209
ห้าม: index.css · src/data/** · api-server/** · src/admin/** · sitemap.xml · lockfile · สร้างไฟล์รูปใหม่ · push main · merge เอง
ตัวเลข: ชุดเทสต์เว็บตก 0 (baseline main 8 ต.ค. 69 = 1190/1181/0/9 — ระบุ commit) · tsc 0 error · แตะ ≤ 8 ไฟล์ · STOP 12 turns
สาขา: seo/qwen-job286-price-guide-table-copy-and-page-images → ส่ง branch + PR แล้วส่งลิงก์ให้เดวิดตรวจ + merge
```
