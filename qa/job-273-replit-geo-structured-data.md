# ใบงาน 273-R (รีพิต) — ยกระดับ GEO: ข้อมูลโครงสร้างให้ AI/Google อ่านธุรกิจเราได้ครบ

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/replit-geo-structured-data`
**ที่มา:** ต่อจากใบ 272 (โดเมน/canonical) และใบ 271 (footer + /network + sameAs 2 เว็บ)
**เริ่มได้เมื่อ:** ใบ 271 merge แล้ว (ไฟล์ `src/data/structured-data.ts` ชนกัน)

**สภาพของจริงที่เดวิดตรวจ (5 ต.ค. 69 — ดึง JSON-LD จาก production แล้ว parse):**
```
@graph มี 4 node: HomeAndConstructionBusiness · WebSite · SiteNavigationElement · FAQPage
HomeAndConstructionBusiness: tel +66-94-496-1949 · priceRange ฿฿฿
  sameAs = ["https://www.knightfurnich.com", "https://line.me/R/ti/p/@789gcnhq"]     ← ขาดโซเชียลทั้งหมด
  address = 35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 … (โรงงาน)                       ← ยังไม่ตรงกับ GBP โชว์รูม
  ไม่มี: openingHoursSpecification · geo · hasMap · image · logo
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. **`sameAs` — บอสยืนยัน 5 ต.ค. 69 + เดวิดตรวจ HTTP แล้ว:**
     - `https://www.facebook.com/knightfurnich` → **มีจริง** (เพจ "หินสังเคราะห์ - Acrylic Solid surface by Knightfurnich" · ผู้ติดตาม 10,000) ✅
     - `https://www.tiktok.com/@knightfurnich` → **HTTP 200** ✅
     - `https://www.instagram.com/knightfurnich` → ใช้ตามที่บอสยืนยัน (IG บล็อกบอท ตรวจอัตโนมัติไม่ได้ · HTTP 429)
     - **YouTube: ตัดออก** (บอส 5 ต.ค. 69: "ข้ามไปก่อน เอาที่มี ที่ได้") — `@knightfurnich` = **HTTP 404** · ห้ามใส่ลิงก์ที่เปิดไม่เจอ
     - เว็บในเครือ `https://www.knightfurnich.com` · `https://www.หินสังเคราะห์.com` + LINE OA `https://line.me/R/ti/p/@789gcnhq`
  2. **ข้อมูลธุรกิจให้ครบสำหรับ Local SEO/GEO (บอสยืนยัน 5 ต.ค. 69):**
     - `telephone`: **`+66-91-978-2292` เป็นหลัก** และ `+66-94-496-1949` เป็นรอง
     - `openingHoursSpecification`: **จ.–ส. 09:00–17:00 · อาทิตย์ปิด** (บอส: "เอาตามปกติ เพราะแก้ภายหลังได้" · เดวิดยืนยันจาก GBP: จันทร์ 09:00–17:00)
     - `geo`: **`13.9567567, 100.56523`** (พิกัดจากแผง Google Maps ของร้าน) · `hasMap`: `https://maps.app.goo.gl/SYam8pshrFojMiwv5`
     - `image` + `logo`: URL บน `https://knightbasins.com/...` · `priceRange` คงเดิม
  3. **`BreadcrumbList` ต่อหน้า** — เพิ่มใน WebPage node ที่ prerender สร้าง (หน้าแรก → หน้าปัจจุบัน) ตามพาธจริง
  4. **`Service`/`Product` schema** สำหรับ `/stone` และ `/quote` — **ห้ามใส่ราคาที่ไม่มาจาก KB/DB** (ถ้าไม่มีราคาที่อนุญาต ให้ใส่แค่ชื่อบริการ/พื้นที่ให้บริการ)
  5. **NAP — บอสยืนยัน 5 ต.ค. 69 (ตอบข้อ 1 = ก):** ให้ใช้ **ที่อยู่โชว์รูม `35/633 ซอยร่วมสุข 8/1 ต.บ้านใหม่ อำเภอเมือง ปทุมธานี 12000` เป็นที่อยู่หลักในเว็บ**
     (ตรงกับ GBP: "35, 633 ซอย ร่วมสุข 8/1 ตำบล บ้านใหม่ เมือง ปทุมธานี 12000 ไทย" · Plus code `XH48+P3`)
     → เปลี่ยน `PostalAddress` ใน JSON-LD จากที่อยู่โรงงาน `35/170, 35/267 …` เป็นที่อยู่โชว์รูมนี้ · **โรงงานห้ามใส่เป็นที่อยู่หลัก**
  6. **กันหลุด:** เพิ่มเทสต์ที่ยืนยันว่า (ก) `sameAs` มีครบทุกช่องทางที่ตกลง (ข) มี openingHours + geo + hasMap + logo
     (ค) BreadcrumbList มี `itemListElement` เรียงถูก (ง) ไม่มี host เก่า `*.hstgr.cloud` ใน JSON-LD
     และ **เทสต์เดิมต้องไม่ตก** (`jsonld-schema-integrity` · `product-schema-geo` · `domain-canonical`)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html                                  (JSON-LD ระดับ shell: sameAs/openingHours/geo/hasMap/logo)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts                 (ผู้ประกอบ JSON-LD ต่อหน้า + BreadcrumbList)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/faq-data.ts                        (แก้ได้เฉพาะข้อความที่เกี่ยวกับข้อมูลธุรกิจ ถ้าจำเป็น)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/geo-structured-data.test.ts            (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/jsonld-schema-integrity.test.ts        (ขยายการตรวจ)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/product-schema-geo.test.ts             (ขยายการตรวจ)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.logic.ts           (เฉพาะถ้าต้องส่ง breadcrumb ต่อหน้า)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · ห้ามแตะ `artifacts/api-server/**` · ห้ามแตะ `src/admin/**`
  - **ห้ามเดา** handle โซเชียล, เวลาทำการ, ที่อยู่ (NAP), พิกัด หรือราคา — ใช้ของจริงที่เดวิดให้เท่านั้น (บอสยืนยันครบแล้ว 5 ต.ค. 69 ตามรายการในหัวข้อ GOAL)
  - ห้ามใส่ราคา/โปรโมชันที่ไม่ได้มาจาก KB (`knight-design-kb/pricing.json`) หรือ DB
  - ห้ามเปลี่ยน canonical/โดเมน (ใบ 272 จบแล้ว) · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit` → 0 errors · `pnpm run build` → ผ่าน (prerender ครบทุกหน้าตาม sitemap)
  2) `node --experimental-strip-types --test test/geo-structured-data.test.ts test/jsonld-schema-integrity.test.ts test/product-schema-geo.test.ts` → ผ่าน · **พิสูจน์ว่าจับได้:** ลบ `openingHoursSpecification` 1 ตัว → เทสต์ต้องตก
  3) เทสต์ชุดเว็บแบบ CI: `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ตก 0**
     (baseline ที่เดวิดวัดหลังใบ 272: **1120 tests / 1110 pass / 0 fail / 10 skip**)
  4) `python3 -c "..."` parse JSON-LD จาก `dist/public/index.html` + `dist/public/stone/index.html` → นับ node/@type และแสดง sameAs/openingHours/geo/hasMap/logo จริง (แนบผล ไม่ใช่คำรับรอง)
  5) `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE · `git diff origin/main...HEAD -- src/index.css | wc -l` → **0**
  6) หลัง deploy (เดวิดทำ): ดึง JSON-LD จาก `https://knightbasins.com/` และ `/stone` แล้ว parse → ต้องมีฟิลด์ครบและไม่มี host เก่า · และยิง UA GPTBot/Googlebot ยังได้เนื้อหา > 0 คำ
  7) แนบผลรันจริงเป็นตัวเลขทั้งหมด

OUTPUT:
  - JSON-LD ครบสำหรับ Local SEO + GEO (sameAs ครบ · openingHours · geo · hasMap · logo · BreadcrumbList · Service/Product)
  - เทสต์กันหลุด + เทสต์เดิมไม่ตก · PR เดียวแจ้งเดวิด (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ) แล้วเดวิด deploy + ยืนยันบน production + รายงานบอส

STOP:
  - เมื่อ tsc 0 · เทสต์ใหม่ผ่าน + พิสูจน์จับได้ · ชุด CI ตก 0 · index.css 0 diff · diff อยู่ใน SCOPE · เปิด PR แจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (ห้ามทำต่อจนผลลัพธ์หาย)
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | SCOPE | แก้เฉพาะไฟล์ใน SCOPE (7 ไฟล์) |
| 2 | sameAs | ครบทุกช่องทางที่ตกลง (โซเชียล + 2 เว็บในเครือ + LINE) |
| 3 | openingHours | มี `openingHoursSpecification` ครบวัน/เวลา ตามข้อมูลจริง |
| 4 | geo / hasMap | `geo` = 13.9567262, 100.5627005 · `hasMap` = ลิงก์ Google Maps ของร้าน |
| 5 | logo / image | URL บน `https://knightbasins.com/...` เปิดได้ 200 |
| 6 | NAP | ใช้ที่อยู่โชว์รูม `35/633` เป็นที่อยู่หลัก (บอสยืนยัน) · ไม่ใส่ที่อยู่โรงงานเป็นหลัก |
| 7 | BreadcrumbList | มี `itemListElement` เรียงถูกทุกหน้าที่ prerender |
| 8 | Service/Product | มีที่ `/stone` `/quote` และไม่มีราคาที่ไม่ได้รับอนุญาต |
| 9 | เทสต์ใหม่ | `geo-structured-data.test.ts` ผ่าน + พิสูจน์จับบั๊กได้ |
| 10 | เทสต์เดิม | `jsonld-schema-integrity` · `product-schema-geo` · `domain-canonical` ไม่ตก |
| 11 | index.css | `git diff origin/main...HEAD -- src/index.css | wc -l` = 0 |
| 12 | รายงาน | แนบผลรันจริง/ตัวเลขทั้งหมด ไม่มีคำรับรองลอย ๆ |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → รีพีต] ใบ 273 — ยกระดับ GEO ใน JSON-LD (ต่อจากใบ 271)
เริ่มได้เมื่อใบ 271 merge แล้ว (ไฟล์ structured-data.ts ใช้ร่วมกัน)
ที่ต้องทำ: sameAs ให้ครบ (FB/IG/TikTok/YouTube @knightfurnich + knightfurnich.com + หินสังเคราะห์.com + LINE @789gcnhq) · openingHoursSpecification · geo (13.9567262, 100.5627005) · hasMap · image/logo บนโดเมนใหม่ · BreadcrumbList ต่อหน้า · Service/Product สำหรับ /stone /quote
ข้อห้าม: ห้ามเดา handle/เวลาทำการ/ที่อยู่/พิกัด/ราคา — ใช้ของจริงที่ผมให้ · ห้ามแตะ index.css, api-server, src/admin · ใช้ข้อมูลที่บอสยืนยันแล้วเท่านั้น (NAP/เบอร์/เวลา/โซเชียล)
หลักฐานใน PR: tsc 0 · เทสต์ใหม่ geo-structured-data ผ่าน + พิสูจน์จับบั๊กได้ (ลบ openingHours → ตก) · ชุดเว็บตก 0 (baseline หลังใบ 272 = 1120/1110/0/10) · parse JSON-LD จาก dist จริงแล้วแนบผล · index.css 0 diff
รายละเอียดเต็ม: qa/job-273-replit-geo-structured-data.md
```
