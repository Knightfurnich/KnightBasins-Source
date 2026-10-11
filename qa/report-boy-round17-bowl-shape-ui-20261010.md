# รายงาน 439-B (บอย = Qwen) — การ์ดอ่างอ่าน “รูปทรงหลุม” จากข้อมูลเท่านั้น (รอ 438-C)

**ผู้ทำ:** บอย (Qwen) · **PR:** `fix(web): show the bowl shape on the basin card so KF003 and KF006 differ`
**branch:** `fix/web/bowl-shape-card` (แตกจาก `origin/main = 6ef5fff`) · **ทำเมื่อ:** 11 ต.ค. 69 ~09:1x–09:4x UTC+8 = **08:1x–08:4x น. ไทย**
**ไฟล์ที่แตะ (2):** `artifacts/knight-basins/src/App.tsx` · `artifacts/knight-basins/test/basin-bowl-shape-card.test.ts` — **ไม่แตะ** `src/data/**` (ของชัย), `api-server/**`, KB/ราคา, `/price-guide`, `index.css` · `git status` หลัง commit = 0

## สิ่งที่ค้นพบระหว่างทำ (และแก้ปัญหาโดยไม่ข้ามหน้าชัย)
`App.tsx:1908,1999` สร้างโมเดลการ์ดจาก `remoteCatalog.basins.map(basinProductFromCatalog)` และฟังก์ชันนั้น (ใน `src/data/catalog.ts`) **ประกอบ object จาก list ฟิลด์ที่ระบุไว้ตายตัว** ⇒ ต่อให้ 438-C เพิ่มคอลัมน์ใน API ค่าก็จะ **ถูกทิ้งก่อนถึงการ์ด** (นี่คือ silent gap ที่จะเกิดถ้าผมอ่านจาก `product`)
**ทางออกที่เลือก:** เพิ่ม accessor + **cache ที่อ่านจาก raw rows ของ `/api/catalog`** (`syncBowlShapesFromCatalog(remoteCatalog.basins)`) key ด้วย `sku` — ไม่ต้องแก้ไฟล์ชัย 1 บรรทัดในฝั่งเขาก็ทำงานได้ทันทีที่ฟิลด์มา; ถ้าชัยส่งฟิลด์ผ่าน mapper ด้วยก็ยังคงใช้ได้ (อ่านชื่อเดียวกัน)

## กติกาที่ล็อกไว้ในโค้ด
- **ห้าม hardcode:** ไม่มีคำว่า “หลุมสี่เหลี่ยม/หลุมวงรี/รูปทรงหลุม/ไม่มีรูน้ำล้น” ใน `src/` → `grep -rn ... src | wc -l` = **0** (มีเทสต์ล็อกไว้)
- **ชื่อฟิลด์:** `BOWL_SHAPE_KEYS = ["bowlShapeText", "bowlShape", "bowlShapeTH"]` — `bowlShapeText` คือชื่อที่ผมรอการยืนยันจาก 438-C (ข้อ 5 ของใบชัย); อีก 2 ชื่อเป็น tolerance ระหว่างรอ **และทั้งหมดอ่านจากข้อมูล raw row เท่านั้น**
- **ไม่มีข้อมูล = ไม่แสดง** (`{bowlShapeForSku(product.sku) && (<p …>)}`) ไม่ default ไม่Placeholder; `syncBowlShapesFromCatalog` clear ก่อนทุกครั้งที่โหลดแคตตาล็อก ⇒ ค่าไม่ค้างเมื่อฟิลด์หาย/โหลดพัง
- จุดแสดง: **บรรทัดย่อยใต้สเปกในการ์ด** (`truncate text-xs`) ไม่แก้บรรทัดเดิม ไม่เพิ่มคำโฆษณา

## ผลรันจริง
```
$ node --experimental-strip-types --test test/basin-bowl-shape-card.test.ts
  # tests 8 · # pass 8 · # fail 0
$ node --experimental-strip-types --test test/*.test.ts        (npm test)
  baseline ก่อนแตะ (main 6ef5fff): # tests 1300 · pass 1258 · fail 0 · skipped 42
  หลังแก้                          : # tests 1308 · pass 1266 · fail 0 · skipped 42   (+8 = ไฟล์ใหม่ · ไม่มีการถอยหลัง)
  *หมายเหตุ: ใบงานเขียน baseline 1,289/1,247 ซึ่งเป็นค่าก่อน 437-C/เอกสารล่าสุด — ผมใช้ค่าที่วัดสดจาก main
$ npx tsc -p tsconfig.json --noEmit  →  exit 0
$ grep -rn "หลุมสี่เหลี่ยม\|หลุมวงรี\|รูปทรงหลุม" artifacts/knight-basins/src → 0 รายการ
```

## พิสูจน์สองทาง (ต้องตกเมื่อถอดของ / ต้องไม่เดาเมื่อไม่มีข้อมูล)
```
ก) ถอด syncBowlShapesFromCatalog(remoteCatalog.basins); ออกจากตัวโหลดแคตตาล็อก
   → not ok "is gated on a truthy label and carries a stable test id"   (pass 7 / fail 1)
ข) แกล้งทำให้ accessor คืนคำที่แต่งเองเมื่อไม่มีข้อมูล ("INVENTED-PLACEHOLDER")
   → not ok "returns the catalogue wording verbatim"                      (actual: 'INVENTED-PLACEHOLDER')
   → not ok "returns nothing when the data does not carry the field"
   → not ok "reads the shape off the raw catalogue rows and keys it by sku"
   → not ok "resyncing with a shape-free catalogue clears stale labels"
   → not ok "two models with different catalogue values produce two different labels"
     (pass 3 / fail 5)
ค) คืนโค้ด → # tests 8 · pass 8 · fail 0   (และเต็มชุดยัง fail 0)
ง) เคส “ข้อมูลจำลอง” ในเทสต์ (fixture เท่านั้น ไม่ใช่ copy ในแอป):
     rows [{KF003: bowlShapeText 'TEST-SQUARE-M'}, {KF006: bowlShapeText 'TEST-OVAL-M'}, {KF021: ไม่มีคีย์}]
     → bowlShapeForSku('KF003')='TEST-SQUARE-M' · ('KF006')='TEST-OVAL-M' · สองค่าไม่เท่ากัน
     → ('KF021')='' ('ZZ999')=''  และหลัง re-sync แบบไม่มีฟิลด์/ไม่มี rows → '' ทุกตัว (no ghost text)
```

## หลักฐานภาพ + การวัดบน production (`https://knightbasins.com/`, asset `index-CZmvh_D4.js`)
| รายการ | ค่าที่วัด |
|---|---|
| การ์ด `KF003` vs `KF006` (เดสก์ท็อป 1440×900) | `innerText` เหมือนกันทุกบรรทัด ต่างแค่รหัส: `… RW316 \| River White \| 600 × 800 × 200 mm \| หลุมอ่าง 350 × 500 × 130 mm \| ฿19,000 / ชุด …` |
| เหมือนกันบนมือถือ 390×844 | ✓ (ผลเดียวกัน) |
| inject ฟิลด์จำลองที่ `/api/catalog` ผ่านทาง browser (route.fetch+fulfill, **จำนวน injected=2**) บน prod | ยัง `NO SHAPE NODE` ทุกการ์ด — **ถูกต้อง** เพราะ prod ยังรันโค้ดก่อน PR นี้ (ไม่ใช่ข้อผิดพลาดของการแก้) |
| `GET /api/catalog` baseline | keys ของ `basins[]` = `[active, basinDimensions, bowlMm, category, categoryId, colorCode, colorName, createdAt, dimensions, galleryImageUrls, id, imageTone, imageUrl, priceTHB, quoteImageUrl, sku, sortOrder, topViewImageUrl, updatedAt, uploadedVideoUrl, videoUrl]` → **ยังไม่มีฟิลด์รูปทรง** (KF003/KF006 = `bowlMm` เท่ากัน) |
| overflow การ์ดหน้าแรก (หลังแก้, local build + prod) | 390: `iw390 cw375 sw375 over=0` · 360: `iw360 cw345 sw345 over=0` · 1440: `over=0` — **0 ทุกช่อง** และไม่ใช้ `overflow-x: hidden` ที่ html/body (เทสต์ assert) |
| ภาพที่แนบ | production ก่อนแก้: `20-KF003-1440.png` `21-KF006-1440.png` `22-KF003-390.png` `23-KF006-390.png` · prod+inject: `36-inject-1440.png` `37-inject-390.png` (sha256 10 ตัวแรก: `6d9bd285` `f605e2d6` `31eed93b` `bc583d6b`) — ไฟล์ png อยู่ใน sandbox ผู้ตรวจ (ส่งเข้ากลุ่มไม่ได้ แจ้งถ้าต้องการไฟล์) |

## ตรวจไม่ได้ (พร้อมเหตุผล)
1. **ภาพการ์ดที่ “แสดงคำต่างกันจริง” หลัง deploy** — ต้องมี (ก) ฟิลด์จาก 438-C ใน `/api/catalog` จริง และ (ข) code ผม deploy; local-build harness ที่ผมตั้งไว้ (static server + stub `/api/catalog` ฉีดฟิลด์) พัง 2 รอบ ( daemon ค้าง / stub ทำให้ hydrate fail — `CARD MISSING`) จึงไม่มีภาพ mock-side ⇒ ใช้ unit test fixture แทน
2. **คำจริงที่จะแสดง** (`หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น` / `หลุมวงรี มีรูน้ำล้น`) — ยังไม่อยู่ในข้อมูล และผมไม่ใส่เอง (FORBIDDEN)
3. **ผลข้างเคียงต่อ SEO/JSON-LD** — ไม่ได้แตะ structured-data; ถ้า 438-C เพิ่มฟิลด์ใน KB/SEO ด้วยจะเป็นงานคนละไฟล์
4. admin ที่ใช้บันทึกค่านี้ (ห้ามล็อกอิน)

## ความเสี่ยง
- ถ้า 438-C ตั้งชื่อฟิลด์ **ไม่ตรง** ทั้ง 3 ค่าใน `BOWL_SHAPE_KEYS` → การ์ดจะ **ว่างเงียบ** (ไม่ error) — ลดความเสี่ยงด้วยเทสต์ + บันทัดเดียวนี้อัปเดตได้ทันที; ทางที่ strict กว่าคือให้ชัย export ชื่อฟิลด์เป็น constant มาให้ import (ผมไม่เสนอไฟล์เขา — เป็นได้ถ้าเขาเพิ่มใน `src/data`)
- `syncBowlShapesFromCatalog` ผูกกับ `remoteCatalog.basins` เฉพาะตอนโหลดสำเร็จ; ตอนโหลดล้มเหลว `bowlShapeBySku.clear()` ยังไม่ถูกเรียก ⇒ ถ้าโหลดรอบแรกสำเร็จแล้วรอบหลัง error ค่ารอบก่อนแสดงต่อ — ผมมองว่าถูกต้อง (เป็นแคชของข้อมูลล่าสุดที่เชื่อถือได้) ถ้าเดวิดอยากให้เห็นว่างตอน error บอกได้
- ผู้ใช้ที่จ้องสเปกเดิมอาจมองบรรทัดใหม่เป็นรกรุงรัง — ใช้ `truncate` + `text-xs` ไม่กระทบ layout (วัดแล้ว over=0)

## ข้อเสนอ / ขั้นต่อ
1. เดวิด: เก็บชื่อฟิลด์จาก 438-C มา 1 ค่า (ถ้าไม่ใช่ `bowlShapeText`) — ผมแก้ 1 บรรทัดใน `BOWL_SHAPE_KEYS`
2. หลัง merge + deploy: ผมวัดซ้ำสด (screenshot การ์ด KF003/KF006 ที่ เดสก์ท็อป+390, overflow 390/360) และแนบใน PR ถัดไป/ปิดใบนี้
3. ถ้า 438-C ทำให้ `basinProductFromCatalog` ส่งผ่านฟิลด์ด้วย ผมจะเลิกอ่าน raw row และคืน sync นี้ (ลด state, คง accessor เดียว)
