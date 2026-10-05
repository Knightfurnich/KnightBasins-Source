# ใบงาน 273-R (รีพิต) — GEO ส่วนที่เหลือ (เดวิดทำข้อมูลธุรกิจเสร็จแล้ว)

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/replit-geo-structured-data` — แตกจาก main **หลังใบ 271 merge** (ไฟล์ `src/App.tsx` ใช้ร่วมกัน)

**✅ เดวิดทำเสร็จแล้ว (PR แยก 5 ต.ค. 69) — ห้ามทำซ้ำ:**
```
index.html (node HomeAndConstructionBusiness):
  address  → 35/633 ซอยร่วมสุข 8/1 ต.บ้านใหม่ อำเภอเมือง ปทุมธานี 12000 (โชว์รูม · บอสยืนยัน)
  phone    → +66-91-978-2292 (หลัก) · +66-94-496-1949 (contactPoint รอง)
  geo      → 13.9567567, 100.56523  (แก้จาก 13.961,100.5153 ที่คลาด ~5 กม.)
  hasMap   → https://maps.app.goo.gl/SYam8pshrFojMiwv5  (เพิ่มใหม่)
  sameAs   → Facebook · Instagram · TikTok · knightfurnich.com · หินสังเคราะห์.com (punycode) · LINE @789gcnhq
src/data/structured-data.ts:
  BREADCRUMB_TRAILS → ครบทุกหน้าสาธารณะ (เดิมมีแค่ /stone /portfolio /studio /quote)
test/geo-structured-data.test.ts → 6 เคส (ห้ามทำให้ตก)
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. **เพิ่ม `Product` / `Service` schema ให้หน้า `/stone` และ `/quote`** — ตรวจจาก production 5 ต.ค. 69: หน้าแรกมี `Product` แล้ว แต่ `/stone` กับ `/quote` ยังไม่มี
     → ใช้ `buildBasinProductsJsonLd` ที่มีอยู่แล้วใน `src/data/structured-data.ts` เป็นแบบอย่าง (หน้าแรกใช้ตัวนี้)
     → **ห้ามใส่ราคาที่ไม่มาจาก KB/DB** — ถ้าไม่แน่ใจให้ใส่แค่ชื่อบริการ/พื้นที่ให้บริการ
  2. **เวลาทำการ — คงค่าเดิมและรายงานความขัดแย้ง:** เว็บใช้ `จ.–ศ. 08:30–16:30 · ส. 08:30–11:30` แต่ GBP แสดง `จ. 09:00–17:00`
     → **ห้ามเดาค่าใหม่** ให้คงค่าเดิม แล้วระบุใน PR ว่าขัดกับ GBP เพื่อรอเดวิดยืนยันจากบอส
  3. **เทสต์กันหลุด:** เพิ่มเคสใน `test/geo-structured-data.test.ts` (หรือไฟล์ใหม่) ที่ยืนยันว่า `/stone` และ `/quote` มี Product/Service node
     และยืนยันว่า `geo`/`hasMap`/`sameAs`/ที่อยู่ โชว์รูม ยังอยู่ (กันคนแก้กลับ)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts       (เพิ่ม builder Product/Service)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx                       (หน้า `StonePage`/`QuotePage` ถูกประกาศอยู่ในไฟล์นี้ (StonePage = บรรทัด ~607) — ผูก RouteStructuredData ให้ /stone และ /quote ที่นี่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/geo-structured-data.test.ts  (ขยายเทสต์)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · ห้ามแตะ `artifacts/api-server/**` · `src/admin/**`
  - ห้ามเดา handle โซเชียล · เวลาทำการ · ที่อยู่ (NAP) · พิกัด · ราคา — ใช้ค่าที่เดวิดใส่ไว้แล้วเท่านั้น (ห้ามแก้ค่าที่เสร็จแล้ว)
  - ห้ามใส่ราคา/โปรโมชันที่ไม่ได้มาจาก KB (`knight-design-kb/pricing.json`) หรือ DB · ห้ามแก้ canonical/โดเมน
  - ห้ามทำให้เทสต์ `test/geo-structured-data.test.ts` และ `test/domain-canonical.test.ts` ตก · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit` → 0 errors · `pnpm run build` → ผ่าน (prerender ครบตาม sitemap)
  2) `node --experimental-strip-types --test test/geo-structured-data.test.ts` → ผ่าน · **พิสูจน์ว่าจับได้:** ลบ Product ออกจาก `/stone` → เทสต์ต้องตก (แนบข้อความจริง)
  3) ชุดเว็บแบบ CI: `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ตก 0**
     · baseline ที่เดวิดวัดบน main 5 ต.ค. 69 (หลังใบ 272) = **1120 tests / 1110 pass / 0 fail / 10 skip** (ตัวเลขจะขยับตามเทสต์ใหม่ของใบนี้ — เกณฑ์ผ่านคือ "ตก 0")
  4) parse JSON-LD จาก `dist/public/stone/index.html` และ `dist/public/quote/index.html` → แสดง @type ที่ได้ (แนบผลจริง ไม่ใช่คำรับรอง)
  5) `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0** · `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE
  6) หลัง deploy (เดวิดทำ): ดึง JSON-LD จาก `https://knightbasins.com/stone` และ `/quote` แล้ว parse → ต้องมี Product/Service · และค่า geo/hasMap/sameAs/ที่อยู่ ยังถูกต้อง

OUTPUT:
  - `/stone` และ `/quote` มีโครงสร้างข้อมูลสินค้า/บริการที่ Google/AI อ่านได้ · ค่าธุรกิจ (ที่อยู่โชว์รูม/เบอร์/พิกัด/hasMap/sameAs) ครบและตรงกับ GBP · เทสต์กันหลุด
  - PR เดียว แจ้งเดวิด (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ) → เดวิด deploy + ยืนยันบน production + รายงานบอส

STOP:
  - เมื่อ tsc 0 · เทสต์ใหม่ผ่าน + พิสูจน์จับได้ · ชุด CI ตก 0 · index.css 0 diff · diff อยู่ใน SCOPE · เปิด PR แจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (ห้ามทำต่อจนผลลัพธ์หาย)
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | SCOPE | แก้เฉพาะ 3 ไฟล์ใน SCOPE (`structured-data.ts` · `App.tsx` · `test/geo-structured-data.test.ts`) |
| 2 | Product/Service | `/stone` ได้ Product หรือ Service node ที่ parse ได้ |
| 3 | Product/Service | `/quote` ได้ Product หรือ Service node ที่ parse ได้ |
| 4 | ราคา | ไม่มีราคาที่ไม่มาจาก KB/DB |
| 5 | ค่าที่เดวิดทำแล้ว | ที่อยู่โชว์รูม · เบอร์ 091 · geo 13.9567567,100.56523 · hasMap · sameAs 6 รายการ — **ต้องไม่ถูกแก้กลับ** |
| 6 | เวลาทำการ | คงค่าเดิม + ระบุความขัดแย้งกับ GBP ใน PR |
| 7 | Breadcrumb | ครบทุกหน้าสาธารณะ (ที่มีอยู่แล้ว) ยังทำงาน |
| 8 | เทสต์ใหม่ | ยืนยัน Product/Service + ค่าธุรกิจ · พิสูจน์จับได้ |
| 9 | เทสต์เดิม | `geo-structured-data` · `domain-canonical` · `jsonld-schema-integrity` ไม่ตก |
| 10 | index.css | `git diff origin/main...HEAD -- src/index.css | wc -l` = 0 |
| 11 | typecheck | `npx tsc -p tsconfig.json --noEmit` = 0 |
| 12 | รายงาน | แนบผลรัน/parse จริงเป็นตัวเลข ไม่มีคำรับรองลอย ๆ |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → รีพีต] ใบ 273 (ฉบับย่อ) — GEO ส่วนที่เหลือ · เริ่มหลังใบ 271 merge
ผมทำข้อมูลธุรกิจเสร็จแล้ว (ไม่ต้องทำซ้ำ): ที่อยู่โชว์รูม 35/633 · เบอร์ +66-91-978-2292 หลัก (094 รอง) · geo 13.9567567,100.56523 · เพิ่ม hasMap · sameAs ครบ 6 (FB/IG/TikTok/2 เว็บ/LINE · ไม่มียูทูบ 404) · BreadcrumbList ครบทุกหน้า · เทสต์ geo-structured-data.test.ts 6 เคส
ที่เหลือให้ทำ:
1) เพิ่ม Product/Service schema ให้ /stone และ /quote (หน้าแรกมี Product แล้ว แต่สองหน้านี้ยังไม่มี) — ห้ามใส่ราคาที่ไม่มาจาก KB/DB
2) เวลาทำการ: คงค่าเดิม (จ.–ศ. 08:30–16:30 · ส. 08:30–11:30) และระบุใน PR ว่าไม่ตรงกับ GBP (09:00–17:00) — ห้ามเดาค่าใหม่ รอผมยืนยัน
3) เทสต์: ยืนยัน Product/Service ของ 2 หน้า + ค่าธุรกิจที่ผมใส่ไว้ต้องไม่ถูกแก้กลับ · พิสูจน์จับได้ (ลบ Product → ตก)
ห้าม: index.css (0 diff) · api-server · src/admin · แก้ค่าที่ผมทำแล้ว · เดาเวลา/ราคา/ที่อยู่
หลักฐาน: tsc 0 · เทสต์ผ่าน+จับได้ · ชุด CI ตก 0 (baseline 1120/1110/0/10) · parse JSON-LD จาก dist จริงมาแนบ · index.css 0 diff
รายละเอียดเต็ม: qa/job-273-replit-geo-structured-data.md
```
