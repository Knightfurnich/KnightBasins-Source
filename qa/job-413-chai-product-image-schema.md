# ใบงาน 413-C (ชัย) — **เพิ่ม `image` ใน Product schema ของ `/stone` และ `/price-guide` (ปิด warning ของ Google)**

**วันที่:** 10 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** (`src/data/**` เป็นขอบเขตคุณ) · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** บอสสั่ง 10 ต.ค. 69 — "ตอนนี้ชัยมีโทเคนเหลือเยอะ สามารถออกใบงานให้แก้ได้เลย" + "แก้ไข warning เรื่อง image ใน product ได้เลย"
**บริบท:** ใบ **413-D** (เดวิดทำเอง) แก้ error ของ Google `Either 'offers', 'review', or 'aggregateRating' should be specified` แล้ว ⇒ Product ประกาศ **AggregateOffer** 2 ช่วงต่อหน้า (อ่านจากแค็ตตาล็อก) · เหลือ warning ระดับ **recommended** เรื่อง **`image`** ⇒ ใบนี้คือส่วนที่เหลือ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 10 ต.ค. 69 · เดวิด

GOAL:
  A. **เพิ่ม `image` ให้ Product node** ของทั้งสองหน้า — ต้องเป็น URL เต็ม (`https://knightbasins.com/...`) ชี้ไฟล์ที่มีจริง (ยิงแล้ว **200**) และมีขนาด ≥ 300×300 px
       แหล่งที่แนะนำ (มีอยู่แล้วในรีโป · ห้ามคิด path ขึ้นเอง):
         · `/stone`        → `/guide/basin-marble-03.webp`  (อยู่ใน `ROUTE_META["/stone"].image` · 1024×1024)
         · `/price-guide`  → `/guide/basin-vanity-04.webp`  (อยู่ใน `ROUTE_META["/price-guide"].image` · 1024×1024)
       ถ้าคุณหารูปที่ดีกว่า (เช่นรูปจากแค็ตตาล็อกที่ตรงกับสินค้ามากกว่า) ให้ใช้ได้ แต่ต้องผ่านเงื่อนไขเดียวกันและอธิบายเหตุผล
  B. **ให้ข้อมูลไหลจากผู้เรียก ไม่ใช่พิมพ์ในโมดูล schema** — รูปต้องถูกส่งเข้ามาเป็นพารามิเตอร์ (แบบเดียวกับราคาใน 413-D ที่ `offerRangeFrom()` อ่านจากแค็ตตาล็อก) เพื่อให้หน้าเว็บเปลี่ยนรูปแล้ว schema ตามทัน
  C. **ห้ามแตะของเดิมที่เพิ่งปิดไป:** `offers` ต้องยังเป็น 2 ช่วงต่อหน้า (ต่อแผ่น + ต่อ ตร.ม. · `/stone`: 4,900–12,000 และ 7,500–12,000 · `/price-guide`: ชุดเดียวกัน) และยังอ่านจากแค็ตตาล็อก · **ห้ามใส่ `aggregateRating`/`review`** (Google รับ offers เดี่ยว ๆ แล้ว)
  D. **อัปเดตเทสต์ 3 ไฟล์** ให้ยืนยัน: `image` มีจริง · เป็น URL เต็ม · **ไฟล์มีอยู่บนดิสก์** (แบบเดียวกับเทสต์ og:image ที่มีอยู่) · และ offers ยังตรงกับแค็ตตาล็อก
  E. **พิสูจน์สองทาง:** ย้อนโค้ดที่ไม่ใส่ `image` ⇒ เทสต์ใหม่ต้อง **fail** · คืนโค้ด ⇒ ผ่านครบ

SCOPE (แก้ได้เฉพาะไฟล์แอปในรีโป ผ่าน GitHub Connection · ส่วน `/opt/data` อ่านเท่านั้น):
  - (รีโป) `artifacts/knight-basins/src/data/structured-data.ts`                       (ที่ต้องแก้ — `buildStonePageJsonLd` / `buildPriceGuideJsonLd`)
  - (รีโป) `artifacts/knight-basins/src/App.tsx`                                       (จุดเรียกของ `/stone` — ส่งรูปเข้าไป)
  - (รีโป) `artifacts/knight-basins/src/pages/PriceGuidePage.tsx`                      (จุดเรียกของ `/price-guide`)
  - (รีโป) `artifacts/knight-basins/src/components/RouteMeta.logic.ts`                 (ที่เก็บรูปต่อ route — อ่าน)
  - (รีโป) `artifacts/knight-basins/public/guide/basin-marble-03.webp` · `.../basin-vanity-04.webp`   (รูปที่ใช้)
  - (รีโป) `artifacts/knight-basins/test/geo-structured-data.test.ts` · `test/price-guide-page.test.ts` · `test/llms-sitemap-parity.test.ts`
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts           (สำเนาที่เดวิดตรวจ — ดูว่าโค้ดปัจจุบันหน้าตาอย่างไร)
  - /opt/data/knight-design-kb/qa/report-chai-round7-product-image-20261010.md          (ใหม่) รายงานของคุณ
  - /opt/data/bin/job_standard_check.py                                                 (ตัวตรวจมาตรฐานใบงาน)

FORBIDDEN:
  - ห้ามแก้ `offers`/ราคา/หน่วย/`availability` ที่เพิ่งปิดใน 413-D · ห้ามใส่ `aggregateRating`/`review`/`rating` ใด ๆ
  - ห้ามพิมพ์ path รูปแบบเดาเอง (path ต้องมีไฟล์จริง · ยิง 200 ก่อนใส่) · ห้ามลบ/ย้ายไฟล์รูปเดิม
  - ห้ามแตะ `artifacts/api-server/**` · ห้ามแก้ `src/components/**` นอกจากที่จำเป็นจริง (ถ้าจำเป็น ต้องบอกในรายงานพร้อมเหตุผล)
  - ห้าม commit เข้า `main` ตรง ๆ · ห้าม merge PR เอง · ห้ามใช้/พิมพ์ค่าลับหรือ token · ห้ามรันคำสั่งที่แตะ production
  - ข้อที่ตรวจไม่ได้ให้เขียน **"ตรวจไม่ได้ + เหตุผล"** — ห้ามเดาว่าผ่าน

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข):
  1) `git diff --stat` เฉพาะไฟล์ที่แตะ + `git log -1 --format=%H` ของสาขา
  2) คำสั่งรันเทสต์ตามด้วยผล: `cd artifacts/knight-basins && node --experimental-strip-types --test test/geo-structured-data.test.ts test/price-guide-page.test.ts test/llms-sitemap-parity.test.ts`
  3) เต็มชุด: `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` — baseline ที่ต้องเจอ: **pass 1203 / fail 0** (skipped 42 ได้)
  4) typecheck: `cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit` — ต้องได้ **0**
  5) พิสูจน์สองทาง: ผลตอน **ไม่ใส่ `image`** (ต้อง fail) + ผลตอนใส่ (ต้องผ่าน) — แปะข้อความ assert ที่ fail มาด้วย
  6) ยืนยันรูปจริง: `curl -s -o /dev/null -w '%{http_code} %{size_download}' https://knightbasins.com/guide/basin-marble-03.webp` และไฟล์คู่ของ `/price-guide` — ต้องได้ **200** ทั้งคู่ (ขนาด > 30,000 ไบต์)
  7) ขนาดรูป: รายงานว่าเป็น webp **1024×1024** และอธิบายว่าผ่านเกณฑ์ขั้นต่ำ 300×300 ของ Google อย่างไร
  8) `image` ในผลลัพธ์ต้องเป็น URL เต็ม ขึ้นต้น `https://knightbasins.com/` — แปะ JSON-LD ที่ได้ทั้งก้อนของทั้งสองหน้า
  9) `job_standard_check.py` ของใบนี้ (ถ้าคุณรันได้) + เวลาไทยที่ทำ

OUTPUT:
  - PR ต่อ `main` (fork/branch แล้วเปิด PR) — ชื่อแนะนำ `feat(seo): product image in /stone + /price-guide JSON-LD`
  - `/opt/data/knight-design-kb/qa/report-chai-round7-product-image-20261010.md` — สรุป A–E + หลักฐาน
  - สรุป 5 บรรทัด: รูปที่เลือกต่อหน้า + เหตุผล · เทสต์ผ่าน/ไม่ผ่าน · สิ่งที่ยังตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ

STOP:
  - ครบ A–E พร้อมหลักฐาน · หรือทำครบ **15 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าพบว่าเพิ่ม `image` แล้วเทสต์เดิมพังเกิน 3 ไฟล์ หรือ offers เปลี่ยนค่าจากแค็ตตาล็อก → หยุดและแจ้งเดวิดทันที**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | `/stone` Product มี `image` | URL เต็ม + ไฟล์มีจริง (200) |
| 2 | `/price-guide` Product มี `image` | URL เต็ม + ไฟล์มีจริง (200) |
| 3 | รูปไหลจากผู้เรียก | ไม่มี path รูปพิมพ์ใน `structured-data.ts` |
| 4 | `offers` ไม่ถูกแตะ | ยัง 2 ช่วง/หน้า + ค่าตรงแค็ตตาล็อก |
| 5 | ไม่มี rating/review | ตรวจด้วย regex บน JSON-LD |
| 6 | เทสต์ 3 ไฟล์ที่แก้ | ผ่านครบ |
| 7 | พิสูจน์สองทาง | ไม่ใส่ image → fail · ใส่ → ผ่าน |
| 8 | เต็มชุด | pass 1203 / fail 0 |
| 9 | typecheck | `tsc --noEmit` = 0 |
| 10 | รูปจริง | `curl` ได้ 200 ทั้งสองไฟล์ |
| 11 | ขนาดรูป | ≥ 300×300 (ของจริง 1024×1024) |
| 12 | หลักฐานครบ | PR + รายงาน + เวลาไทย + hash |

> [เดวิด → ชัย]
> ใบนี้เป็น **งานโค้ด** (ไม่ใช่ใบตรวจ) — `src/data/**` เป็นขอบเขตคุณ
> · ทำ: เพิ่ม `image` ให้ Product node ของ `/stone` + `/price-guide` โดยใช้รูปที่มีอยู่แล้วต่อ route (`ROUTE_META`) และ **ส่งรูปเข้า builder จากผู้เรียก** ห้ามพิมพ์ path ในโมดูล schema
> · อย่าแตะ `offers` ที่เพิ่งปิดไป (413-D · PR #463) · ห้ามใส่ rating/review ปลอม
> · ต้องมีเทสต์พิสูจน์สองทาง + ยืนยันรูปยิงได้ 200 · baseline เต็มชุดคือ **pass 1203 / fail 0** และ `tsc --noEmit` = 0
> · เสร็จแล้ว **เปิด PR ไม่ต้อง merge** เดวิดจะตรวจและ merge เอง
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-413-chai-product-image-schema.md`
