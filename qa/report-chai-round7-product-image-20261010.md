# รายงานใบ 413-C — เพิ่ม `image` ใน Product JSON-LD ของ /stone และ /price-guide — ชัย · 10 ต.ค. 69

**ผู้ทำ:** ชัย · **ทำเมื่อ:** 10 ต.ค. 69 ประมาณ 09:15–09:58 น. (เวลาไทย) · **สาขา:** `feat/chai-product-image-schema` · **ฐาน:** `main` @ `f146bb9`
**ขอบเขต:** แก้เฉพาะ `src/data/structured-data.ts`, `src/App.tsx`, `src/pages/PriceGuidePage.tsx` + เทสต์ 3 ไฟล์ตามที่ใบระบุ — ไม่แตะ `api-server`, `src/components/**`, `src/admin/**`, `offers`, ราคา, ไฟล์รูป

## 1. สรุป 5 บรรทัด

1. **รูปที่เลือก:** `/stone` → `/guide/basin-marble-03.webp` · `/price-guide` → `/guide/basin-vanity-04.webp` — ใช้รูปเดียวกับ og:image ของแต่ละ route ใน `ROUTE_META` (webp 1024×1024, 60,074 และ 41,272 ไบต์, ยิง `200` ทั้งคู่) ไม่หารูปอื่นเพราะผ่านเงื่อนไขครบและเป็นรูปที่หน้านั้นประกาศเป็นการ์ดของตัวเองอยู่แล้ว
2. **เทสต์:** 3 ไฟล์เป้าหมาย 36 → **40 ผ่าน / ตก 0** (เพิ่ม 4 เทสต์) · พิสูจน์สองทางแล้ว: เอา `image` ออก → ตก 4 · เอาการส่งรูปจากผู้เรียกออก → ตก 2 · คืนโค้ด → ผ่านครบ
3. **เต็มชุด:** 1,246 เทสต์ ผ่าน 1,202 ตก 2 ข้าม 42 — เทียบ `main` สะอาดเครื่องเดียวกัน 1,242 / 1,198 / 2 / 42 · **ชุดที่ตกเหมือนกัน** (2 เทสต์ที่ต้องเรียก `pnpm` ผ่าน `spawnSync` ซึ่งทำงานบน Windows ไม่ได้: prerender และ crawler-facing-facts) ⇒ ไม่ถึง baseline "1203 / 0" ในเครื่องนี้ด้วยเหตุสภาพแวดล้อม ไม่ใช่จากโค้ดนี้ · CI Linux เป็นตัวชี้ขาด
4. **ตรวจไม่ได้:** `tsc` ได้ 1 error เดิมที่ `AdminVoiceSettings.tsx` (ไลบรารีเวิร์กสเปซที่ลิงก์จาก checkout หลักเก่ากว่า) **เท่ากับ main ทุกตัว ไม่มี error ในไฟล์ที่แก้** — ยืนยัน "0" ไม่ได้ในเครื่องนี้ · `job_standard_check.py` อยู่บนเครื่อง Hermes รันไม่ได้ · ผลของ Google (Rich Results Test) ตรวจไม่ได้จนกว่าจะ deploy
5. **ความเสี่ยง/ข้อเสนอ:** JSON-LD ของสอง route ถูกฉีดฝั่งไคลเอนต์ (`RouteStructuredData`) ตามเดิม — การเปลี่ยนนี้ไม่เปลี่ยนวิธีเสิร์ฟ · หลัง deploy ให้เดวิดวาง URL ทั้งสองใน Rich Results Test เพื่อยืนยันว่า warning เรื่อง image หายและ offers ยังผ่าน

## 2. ที่เปลี่ยน (A, B, C)

`git diff --stat origin/main..HEAD`: 6 ไฟล์ · +94 / −11

| ไฟล์ | การเปลี่ยน |
|---|---|
| `src/data/structured-data.ts` | ฟังก์ชันใหม่ `productImage()` + พารามิเตอร์ตัวที่สอง `image?: string \| null` ของ `buildStonePageJsonLd` และ `buildPriceGuideJsonLd` ใส่ `image` (URL เต็มผ่าน `absoluteImageUrl` เดิม) ใน Product เท่านั้น · **ไม่มี path รูปในไฟล์นี้** (เทสต์ตรวจ) · ไม่ส่งรูป = ไม่มีคีย์ `image` (ไม่เดา) |
| `src/App.tsx` | ส่ง `ROUTE_META["/stone"]?.image?.path` เข้า builder ของ `/stone` |
| `src/pages/PriceGuidePage.tsx` | export `PRICE_GUIDE_SCHEMA_IMAGE = ROUTE_META["/price-guide"]?.image?.path` (รูปแบบเดียวกับ `PRICE_GUIDE_SCHEMA_PRICES`) แล้วส่งเข้า builder |
| `test/geo-structured-data.test.ts` | +2 เทสต์ (รูปของ /stone + ไฟล์มีจริง; ไม่ส่งรูป = ไม่มี `image` และไม่มี path ในโมดูล schema) + ปรับ regex การเรียกใช้ใน `App.tsx` |
| `test/price-guide-page.test.ts` | +1 เทสต์ (หน้าเป็นผู้ส่งรูปเอง ผ่าน harness ที่ render หน้าจริง; URL เต็ม; ไฟล์มีจริงและ > 30,000 ไบต์; offers ยัง 2 ช่วง; ไม่มี rating) |
| `test/llms-sitemap-parity.test.ts` | +1 เทสต์ (รูป = รูปของ route; ไฟล์มีจริง; ไม่มี `aggregateRating`) |

**ไม่แตะ:** โค้ด `offers` ทั้งสองหน้า (diff ไม่มีบรรทัด `offers` เลย) · ไม่มี `aggregateRating`/`review`/`rating` (เทสต์เดิมและเทสต์ใหม่ตรวจ regex) · ไฟล์รูปไม่ถูกแตะ

## 3. หลักฐาน (D, E และรายการ EVIDENCE)

**คำสั่งเทสต์เป้าหมาย** (`cd artifacts/knight-basins && node --experimental-strip-types --test test/geo-structured-data.test.ts test/price-guide-page.test.ts test/llms-sitemap-parity.test.ts`):

| | tests | pass | fail |
|---|---|---|---|
| `main` (ฐาน) | 36 | 36 | 0 |
| สาขานี้ | **40** | **40** | **0** |

**พิสูจน์สองทาง (รันจริง):**

| ทดลอง | ผล |
|---|---|
| ลบ `...productImage(image)` ออกจาก builder ทั้งสอง | ตก **4**: `/stone Product carries the route's own picture…` · `publishes no image when no picture is passed…` · `the Product's image is the route's own picture…` · `Product carries the route's own picture… handed in by the page` · ข้อความ assert: `expected: 'https://knightbasins.com/guide/basin-marble-03.webp'` / `'…/guide/basin-vanity-04.webp'` / `'https://example.com/a.webp'`, `actual: undefined` |
| ให้ผู้เรียก (`App.tsx`, `PriceGuidePage.tsx`) เลิกส่งรูป | ตก **2**: `mounts each schema inside its route component…` · `Product carries the route's own picture… handed in by the page` |
| คืนโค้ด | 40 / 40 ผ่าน |

**เต็มชุด** (`node --experimental-strip-types --test test/*.test.ts`, รันในโฟลเดอร์ที่ใช้ LF ทั้งสองฝั่ง):

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| `main` | 1242 | 1198 | 2 | 42 |
| สาขานี้ | 1246 | 1202 | 2 | 42 |

ชุดที่ตก **เหมือนกันทุกชื่อ**: `production build prerenders unique, contentful HTML for every public sitemap route` และ `test\crawler-facing-facts.test.ts` (ทั้งสองเรียก `pnpm` ผ่าน `spawnSync` → `Error: spawnSync pnpm ENOENT` บน Windows)

**typecheck** `npx tsc -p tsconfig.json --noEmit`: สาขานี้ 1 error / `main` 1 error — **ชุดเดียวกัน** (`src/admin/AdminVoiceSettings.tsx(80,64) TS2353 'speakingRate'`) ไม่มี error ในไฟล์ที่แก้

**รูปจริง** (`curl -s -o /dev/null -w '%{http_code} %{size_download}'`):

| URL | HTTP | ขนาด | content-type |
|---|---|---|---|
| `https://knightbasins.com/guide/basin-marble-03.webp` | **200** | 60,074 B | image/webp |
| `https://knightbasins.com/guide/basin-vanity-04.webp` | **200** | 41,272 B | image/webp |

**ขนาดรูป:** ทั้งสองไฟล์เป็น WebP (VP8) **1024 × 1024 px** (อ่านจาก header ของไฟล์ และตรงกับ `width/height` ใน `ROUTE_META`) — เกณฑ์ขั้นต่ำของ Google สำหรับ `image` คือ 50,000 พิกเซลขึ้นไป (ราว 224×224) และแนะนำ ≥ 300×300 ที่ใบกำหนด 1024×1024 = 1,048,576 พิกเซล ผ่านทั้งสองเกณฑ์ และเป็นภาพจัตุรัส (สัดส่วน 1:1 ซึ่ง Google ต้องการให้มีในชุดภาพ 16:9/4:3/1:1)

## 4. JSON-LD ที่ได้ (Product node ทั้งก้อน — สร้างจริงจากโค้ดนี้ด้วยแคตตาล็อกจริง)

**`/stone`**
```json
{
  "@type": "Product",
  "@id": "https://knightbasins.com/stone#countertops",
  "url": "https://knightbasins.com/stone",
  "image": "https://knightbasins.com/guide/basin-marble-03.webp",
  "name": "ท็อปครัวและเคาน์เตอร์หินสังเคราะห์สั่งตัด",
  "description": "ท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์ สั่งตัดตามพื้นที่ใช้งาน",
  "material": "Solid Surface",
  "brand": {
    "@id": "https://knightbasins.com/#organization"
  },
  "offers": [
    {
      "@type": "AggregateOffer",
      "@id": "https://knightbasins.com/stone#offer-sheet",
      "url": "https://knightbasins.com/stone",
      "priceCurrency": "THB",
      "lowPrice": 4900,
      "highPrice": 12000,
      "offerCount": 64,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@id": "https://knightbasins.com/#organization"
      },
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "priceCurrency": "THB",
        "unitText": "แผ่น",
        "referenceQuantity": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "C62"
        }
      }
    },
    {
      "@type": "AggregateOffer",
      "@id": "https://knightbasins.com/stone#offer-installed",
      "url": "https://knightbasins.com/stone",
      "priceCurrency": "THB",
      "lowPrice": 7500,
      "highPrice": 12000,
      "offerCount": 65,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@id": "https://knightbasins.com/#organization"
      },
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "priceCurrency": "THB",
        "unitText": "ตร.ม.",
        "referenceQuantity": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "C62"
        }
      }
    }
  ]
}
```

**`/price-guide`**
```json
{
  "@type": "Product",
  "@id": "https://knightbasins.com/price-guide#solid-surface-countertops",
  "url": "https://knightbasins.com/price-guide",
  "image": "https://knightbasins.com/guide/basin-vanity-04.webp",
  "name": "เคาน์เตอร์หินสังเคราะห์และแนวทางเลือก",
  "description": "คู่มือเลือกและวางแผนสั่งทำเคาน์เตอร์หินสังเคราะห์ตามขนาดและรูปแบบงาน",
  "material": "Solid Surface",
  "brand": {
    "@id": "https://knightbasins.com/#organization"
  },
  "offers": [
    {
      "@type": "AggregateOffer",
      "@id": "https://knightbasins.com/price-guide#offer-installed",
      "url": "https://knightbasins.com/price-guide",
      "priceCurrency": "THB",
      "lowPrice": 7500,
      "highPrice": 12000,
      "offerCount": 65,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@id": "https://knightbasins.com/#organization"
      },
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "priceCurrency": "THB",
        "unitText": "ตร.ม.",
        "referenceQuantity": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "C62"
        }
      }
    },
    {
      "@type": "AggregateOffer",
      "@id": "https://knightbasins.com/price-guide#offer-sheet",
      "url": "https://knightbasins.com/price-guide",
      "priceCurrency": "THB",
      "lowPrice": 4900,
      "highPrice": 12000,
      "offerCount": 64,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@id": "https://knightbasins.com/#organization"
      },
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "priceCurrency": "THB",
        "unitText": "แผ่น",
        "referenceQuantity": {
          "@type": "QuantitativeValue",
          "value": 1,
          "unitCode": "C62"
        }
      }
    }
  ]
}
```

เทียบ offers กับแคตตาล็อก: `/stone` แผ่น 4,900–12,000 (64 สี) และ ตร.ม. 7,500–12,000 (65 สี) · `/price-guide` ชุดเดียวกัน — ตรงตามที่ใบระบุทั้งสองหน้า · ไม่มีคีย์ `aggregateRating`/`review`/`rating`

## 5. เช็คลิสต์ท้ายใบ

| # | ผล |
|---|---|
| 1 `/stone` image URL เต็ม + ไฟล์มีจริง | ผ่าน (`https://knightbasins.com/guide/basin-marble-03.webp`, 200) |
| 2 `/price-guide` image | ผ่าน (`…/basin-vanity-04.webp`, 200) |
| 3 รูปไหลจากผู้เรียก ไม่มี path ในโมดูล schema | ผ่าน (เทสต์ regex ตรวจ `structured-data.ts`) |
| 4 `offers` ไม่ถูกแตะ | ผ่าน (diff ไม่มีบรรทัด offers · ยัง 2 ช่วง/หน้า · ค่าตรงแคตตาล็อก) |
| 5 ไม่มี rating/review | ผ่าน |
| 6 เทสต์ 3 ไฟล์ผ่านครบ | ผ่าน 40/40 |
| 7 พิสูจน์สองทาง | ผ่าน (ไม่ใส่ image → ตก 4 · ใส่ → ผ่าน) |
| 8 เต็มชุด 1203/0 | **ไม่ได้ตัวเลขนี้ในเครื่อง Windows**: 1202 ผ่าน / 2 ตก (เหมือน `main` ทุกชื่อ; ENOENT `pnpm`) — CI ตัดสิน |
| 9 typecheck = 0 | **ตรวจไม่ได้ครบ**: 1 error เดิมเหมือน `main` ไม่มีในไฟล์ที่แก้ |
| 10 รูป curl 200 | ผ่าน |
| 11 ขนาดรูป ≥ 300×300 | ผ่าน 1024×1024 |
| 12 หลักฐานครบ | PR + รายงานนี้ + เวลาไทย + hash (อยู่ใน PR) · `job_standard_check.py` รันไม่ได้ (อยู่บนเครื่อง Hermes) |

## 6. สิ่งที่ไม่ได้ทำ

ไม่ merge · ไม่ push เข้า `main` · ไม่แตะ `offers`/ราคา/api-server/ไฟล์รูป · ไม่ใส่ rating/review · ไม่ POST
