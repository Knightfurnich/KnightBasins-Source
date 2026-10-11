# รายงานชัย · ใบงาน 454-C — mapper ส่ง `categoryLabel` ผ่าน model + ลบสำเนา cache ฝั่ง UI

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 20:45–22:00 น. (เวลาไทย) · **สาขา:** `refactor/chai-454c` · **ฐาน:** `main` ที่ `2284d71` (หลัง 453-B)
**แตะ:** `artifacts/knight-basins/src/data/catalog.ts` (mapper +3 บรรทัด) · `src/components/catalogueCategoryFacts.ts` (−51 สุทธิ) · `src/App.tsx` (−4 สุทธิ) · `test/catalogue-category-chips.test.ts` · `qa/evidence/454c/**` · รายงานนี้
**หมายเหตุ SCOPE:** ใบเขียนว่า mapper อยู่ใน `artifacts/api-server/src/lib/` — ของจริงคือ `basinProductFromCatalog()` ใน `artifacts/knight-basins/src/data/catalog.ts` (ไฟล์ data layer ของชัยอยู่แล้ว) · ฝั่ง api-server ไม่ต้องแก้: API ส่ง `categoryLabel` อยู่แล้วตั้งแต่ 440-C (`price-integrity.ts` เรียก mapper เดิมและไม่กระทบ — ชุด api เท่า baseline)
**ไม่แตะ:** ราคา/ขนาด/สี/รหัส/ลำดับ · `/price-guide` · `src/index.css` · hero #449 · DB · เทสต์ที่ไม่เกี่ยว (ไม่มีไฟล์เทสต์อื่นถูกแก้)

## baseline และคำสั่ง
- ผู้รัน: ชัย · Windows 11 · node v24 · ฐาน `2284d71` · `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `npx tsc -p tsconfig.json --noEmit` · วัดหน้าจริงด้วย `vite dev` + API จำลองอ่านอย่างเดียวที่เสิร์ฟ `GET /api/catalog` สดจาก production (11 ต.ค. 69)
- ชุดที่ตกบน Windows เป็นของเดิม (web 12 / api 5)

## สิ่งที่ทำ
- **A (mapper):** `basinProductFromCatalog()` ส่ง `categoryLabel` ผ่าน model (trim; ว่าง/null/ไม่มี → `undefined` ไม่เดา) · `category` และฟิลด์เดิมทุกตัวคงเดิม · ตัวแปรสำเนาในตัวไทยก็มี `categoryLabel` อยู่แล้วตั้งแต่ 451-C → ทุกทางเข้า (API / built-in) มีฟิลด์เดียวกัน
- **B (ลบ cache):** ลบทั้ง `Map<SKU, {category, categoryLabel}>` — `indexCatalogueRowFacts` · `catalogueRowFacts` · `EMPTY_CATALOGUE_FACTS` · type `CatalogueFacts` · memo `catalogueFacts` ใน `App.tsx` · prop `facts` ของ `HomePage`/`ProductCard` · ฟังก์ชันจัดกลุ่ม/ป้าย/ชิปอ่านจาก `product` ตรง ๆ (`catalogueGroupValue(product)`, `catalogueGroupLabel(product, fallback)`, `buildCatalogueChips(products, table, fallback)`) · ที่มาของค่าเหลือจุดเดียว (model)
- **ปัญหา stale ที่ cache เคยกัน — แก้ที่ต้นเหตุ:** `ProductCard` เคยหา product จาก `PRODUCTS` ซึ่ง loader เติมค่าหลัง render จึงตามหลังรอบหนึ่ง (เหตุที่บอยต้องใช้ facts เป็น props) → ตอนนี้ `HomePage` ส่ง `product` ที่ใช้นับชิปให้การ์ดโดยตรง (`product ?? productBySku(sku)`) ป้ายกับชิปจึงมาจากอ็อบเจ็กต์เดียวกันเสมอ — ล็อกด้วยเทสต์
- **C (C2 ยังจริง):** กติกาเดิมทั้งหมดย้ายมาอ่านจาก model (id ดิบไม่ถูกเชื่อเป็นถ้อยคำ · ชิปว่างพิมพ์ไทยหรือซ่อน · ตัดชิปว่างซ้ำ · ไม่มี `categoryLabel()` ดิบใน `App.tsx`) เทสต์ชุด C2 เดิมย้ายตามมาและผ่าน
- **ผลข้างเคียงที่ตั้งใจ:** ก่อน API ตอบ/ออฟไลน์ ชิปหมวดเสาเดิมเป็น "เสาวางของตั้งพื้น (ชุดสำเร็จรูป)" → ตอนนี้ **"เสาวางของตั้งพื้น"** เหมือนที่ API ส่ง (ตรงกับใบ: ชิป = `…เสาวางของตั้งพื้น 2`) เพราะ built-in มี `categoryLabel` แล้ว

## ผลเทสต์ (รันจริง)
| การรัน | tests | pass | fail | skip |
|---|---|---|---|---|
| web — main @ `2284d71` | 1384 | 1330 | 12 | 42 |
| web — สาขานี้ | **1391** | **1337** | **12** | 42 |
| api-server (Windows) | 1329 | 1324 | 5 | 0 |
- ชื่อข้อที่ตกของ web = ชุดเดียวกับ main (`diff` เท่ากันทุกข้อ) · api-server 5 ข้อที่ตกคือชุดเดิมของ Windows (slip digest ×4 + support-guest) ไม่เกี่ยวกับงานนี้ · `tsc`: error เดียวของเดิม (`AdminVoiceSettings.tsx`) · ไฟล์ `catalogue-category-chips.test.ts` 30/30 · ไฟล์ที่เกี่ยวข้องอื่น (bowl-shape-card, overflow-note-ui, catalog-image, stone-status, studio-pillar, header-nav-a11y) ผ่านหมด
- เทสต์ใหม่ที่ยืนยัน model มี `categoryLabel`: ทั้ง 30 แถวของ fixture live (`category` + `categoryLabel` ตรงแถว), ค่าว่าง/null/ช่องว่าง → `undefined`, ฟิลด์เดิม (ราคา/ขนาด/รหัส/ชื่อสี) ไม่เปลี่ยน, built-in ครบทุก SKU, built-in ให้ชิปเท่า API (ค่า/ป้าย/จำนวน)

## วัดจริงบนหน้าที่ลูกค้าเห็น (`vite dev`)
| กรณี | จอ | ชิป | ป้ายการ์ด KF029/KF030 | คำอังกฤษดิบ | overflow |
|---|---|---|---|---|---|
| API ปิด (built-in) | 390 | ทั้งหมด 30 · อ่างที่เลือก 0 · เคาน์เตอร์ 18 · ทรงสูง 10 · **เสาวางของตั้งพื้น 2** | เสาวางของตั้งพื้น ×2 | ไม่มี | 0 |
| API live | 390 | เหมือนด้านบน (สูงแถว 118px) | เสาวางของตั้งพื้น ×2 | ไม่มี | 0 |
| API "stress" (ตารางมี `storage`/`wall basin`/`Tall Vertical Washbasin` ว่าง + label ดิบ `storage`) | 390 | เหมือนด้านบน | เสาวางของตั้งพื้น ×2 | ไม่มี | 0 |
| stress | 1440 | เหมือนด้านบน | เสาวางของตั้งพื้น ×2 | ไม่มี | ≤0 |
ภาพ: `qa/evidence/454c/AFTER-live-390.jpg`

## พิสูจน์สองทาง (รันจริง บน `catalogue-category-chips.test.ts` 30 ข้อ)
| ถอด | ผล | คืน |
|---|---|---|
| mapper ไม่ส่ง `categoryLabel` | **ตก 7** | ผ่าน 30/30 |
| การ์ดกลับไปหา `productBySku` (ไม่รับ `product`) | **ตก 1** | ผ่าน 30/30 |
| ถอดการ์ด C2 (เชื่อ label ที่เป็น id ดิบ) | **ตก 1** | ผ่าน 30/30 |

## สรุป 5 บรรทัด
1. **ทำอะไร:** mapper ส่ง `categoryLabel` ผ่าน model (+3 บรรทัด) แล้วลบสำเนา cache ฝั่ง UI ทั้งชุด (โมดูล −51 สุทธิ, ไม่มี `facts` ใน props/memo) · ชิป/ป้าย/ค้นหาอ่านจาก `product` ตรง ๆ · การ์ดรับ `product` จากรายการ แก้ต้นเหตุ stale ที่ cache เคยกัน
2. **เทสต์:** web 1391 / ผ่าน 1337 / ตก 12 (ชุดเดียวกับ main) · api 1329 / 1324 / 5 (ชุดเดิม Windows) · ไฟล์ chips 30/30 · พิสูจน์สองทาง 3 แบบ · tsc ไม่มี error ใหม่
3. **ตรวจไม่ได้:** CI Linux (ดูที่ PR) · production หลัง deploy · ภาพ 360/320 ของสาขานี้ (วัดตัวเลข 390/1440)
4. **ความเสี่ยง:** สลับที่มาของป้ายหมวด (cache → model) อยู่ใน `App.tsx` ที่ถูกแตะบ่อย → ขอ merge ก่อนมีใบอื่นแตะ · ป้ายหมวดเสาก่อน API ตอบเปลี่ยนคำเล็กน้อย("(ชุดสำเร็จรูป)" หายไป) ตั้งใจให้ตรงกับ API · ถ้าแถว API ไม่ส่ง `categoryLabel` จะใช้ข้อความของ data layer (มีเทสต์คุม ไม่เดา)
5. **ข้อเสนอ:** ไม่มีงานต่อจากใบนี้ · ค่าคงที่รูปทรงหลุม (`bowlShapeLabel`) ยังใช้ cache `bowlShapeBySku` ใน `App.tsx` ด้วยเหตุผลเดียวกัน (mapper ไม่ส่งต่อ) — ถ้าเดวิดต้องการ ออกใบแยกให้ mapper ส่ง `bowlShapeLabel` แล้วลบ cache นั้น (ไฟล์ของผมเอง ทำได้เร็ว)

เวลา: 11 ต.ค. 69 ราว 22:00 น. (เวลาไทย)
