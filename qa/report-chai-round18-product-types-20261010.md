# รายงานชัย · ใบงาน 440-C — KF029 / KF030 เป็น "เสาวางของตั้งพื้น" ไม่ใช่อ่างล้างหน้า

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 07:00–07:30 น. (เวลาไทย) · **ฐาน:** `main` ที่ `59950f7` · **สาขา:** `fix/chai-kf029-kf030-product-type`
**แตะ:** `artifacts/api-server/src/lib/basin-product-type.ts` (ใหม่) · `artifacts/api-server/src/routes/catalog.ts` · `artifacts/api-server/src/lib/support-guest-answers.ts` (กรองตัวเลขช่วงราคา "อ่างตั้งพื้น") · `artifacts/api-server/test/basin-product-type.test.ts` (ใหม่) · `artifacts/api-server/test/basin-bowl-shape.test.ts` (ปรับ regex ตรวจการต่อสายใน route 1 บรรทัด) · รายงาน
**ไม่แตะ:** ราคา/ขนาด/ชื่อสี/รหัสสี/`basinDimensions` ของ 2 รุ่น · DB production · ไม่ลบ/ไม่ซ่อนสินค้า · `App.tsx` · `src/components/**` · `src/admin/**` · `knight-basins/src/data/**` · KB/ราคา

## ชื่อฟิลด์/ค่าที่บอยต้องใช้ (441-B)
- `GET /api/catalog` → ทุก basin มี **`category`** (รหัสประเภท) และ **`categoryLabel`** (ข้อความไทยพร้อมพิมพ์)
- KF029 · KF030: `category: "storage"` · `categoryLabel: "เสาวางของตั้งพื้น"` · รุ่นอื่น `category` เดิม (`"counter basin"` / `"tall vertical washbasin"` หรือหมวดที่แอดมินสร้าง) และ `categoryLabel` = `"เคาน์เตอร์"` / `"ทรงสูง"` / ชื่อหมวดนั้น
- ตัวนับที่ได้จากข้อมูล: **เคาน์เตอร์ 18 · ทรงสูง 10 · ที่วางของ 2** (เดิม 18 / 12) — เว็บ (หน้าแรก) นับตามหมวดที่ลงทะเบียนในตาราง `categories` อยู่แล้ว ดังนั้น "storage" จะไม่ถูกนับใต้ปุ่มกรองเดิมและยังอยู่ในแท็บ "ทั้งหมด" (ไม่ถูกซ่อน)

## สรุป 5 บรรทัด
1. **แก้อะไร:** API ส่ง `category: "storage"` + `categoryLabel: "เสาวางของตั้งพื้น"` ให้ KF029/KF030 แทน "tall vertical washbasin" โดยไม่แตะ DB (แปลงตอนส่งออก หลังอ่างหมวดจาก DB) · ทุกรุ่นมี `categoryLabel` · ข้อความตอบของน้องไนท์ไม่นับ 2 รุ่นนี้เป็น "อ่างตั้งพื้น" อีก (ช่วงราคาอ่างตั้งพื้นเดิม 16,000–32,000 → 24,000–32,000)
2. **เทสต์:** api-server 1299 / ผ่าน 1294 / ตก 5 (ชุดเดิม Windows) · เทสต์ใหม่ 8 ข้อผ่านหมด · พิสูจน์สองทาง 6 แบบ · tsc ไม่มี error ใหม่ · web ไม่ได้แก้ไฟล์ใด จึงไม่ได้รันซ้ำในใบนี้ (ผลล่าสุดบน `main`: 1322 / 1268 ผ่าน / 12 ตก ชุดเดิม)
3. **ตรวจไม่ได้:** ผล `/api/catalog` บน production หลัง deploy · การแสดงผลบนเว็บ (การ์ด/ตัวกรอง/JSON-LD เป็นงาน 441-B ของบอย)
4. **ความเสี่ยง:** (ก) ข้อมูลในสำเนา static ของเว็บ (`knight-basins/src/data/catalog.ts`) ยังเป็น `tall vertical washbasin` — ผมไม่แตะเพราะเทสต์ของบอย `studio-pillar-products.test.ts` ยืนยันค่านี้ และเว็บแยก 2 รุ่นนี้ด้วยรายการ SKU (`isFreestandingPillarProduct`) อยู่แล้ว; ควรให้บอยปรับพร้อมใบ 441-B (ข) การระบุ 2 รุ่นนี้ในโค้ดด้วย SKU (ไม่ใช่คอลัมน์ DB) เหมือนที่เว็บทำอยู่ — ย้ายเข้า DB ได้ในใบแยก (ค) หน้าแอดมินยังเห็นประเภทเดิมจาก DB ("ทรงสูง") เพราะผมไม่ได้แก้เส้นทางแอดมิน (ไม่เขียนทับ DB โดยไม่ตั้งใจ)
5. **ข้อเสนอ:** ให้บอยทำ 441-B ต่อ (การ์ด/ตัวนับ/JSON-LD อ่าน `category`/`categoryLabel`) · ถ้าต้องการให้แอดมินแก้ประเภทได้เอง ออกใบเพิ่มประเภท `storage` ใน `basin_categories` (ต้อง migration)

## 0–2. baseline, คำสั่ง, ตาราง
- baseline (ผู้รัน: ชัย · Windows 11 · `main` `59950f7`): `GET https://knightbasins.com/api/catalog` (ดึง 11 ต.ค. 69) KF029 · KF030 = `category: "tall vertical washbasin"` · `basinDimensions: null` · ฿16,000 · 400 × 400 × 1000 mm · และมีเพียง 2 รุ่นนี้จาก 30 รุ่นที่ไม่มีขนาดหลุม (เทสต์ล็อกด้วย snapshot ของแอป)
- คำสั่งตรวจ (หลัง deploy):
```bash
curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([{k:b.get(k) for k in ('sku','category','categoryLabel','priceTHB','dimensions','basinDimensions')} for b in d['basins'] if b['sku'] in ('KF029','KF030','KF028')])"
```
- ก่อน: `categoryLabel` ไม่มีทุกรุ่น · หลัง (ต้องได้): KF029/KF030 `storage` / `เสาวางของตั้งพื้น` · KF028 `tall vertical washbasin` / `ทรงสูง` · ราคา/ขนาด/`basinDimensions` เท่าเดิม — **ตรวจบน production ไม่ได้จนกว่าจะ deploy**
- ตาราง 30 รุ่น (ก่อน → หลัง): KF001–KF018 (18 รุ่น) `counter basin` → เดิม (`เคาน์เตอร์`) · KF019–KF028 (10 รุ่น) `tall vertical washbasin` → เดิม (`ทรงสูง`) · KF029 · KF030 `tall vertical washbasin` → **`storage`** (`เสาวางของตั้งพื้น`) · รุ่นที่ไม่มีข้อมูลหลุม = 2 รุ่น (KF029, KF030) ตรงกับที่บอสระบุ ไม่พบรุ่นอื่นเข้าข่าย (ข้อ B)

## 3–5. เทสต์และพิสูจน์สองทาง
เทสต์ใหม่ `artifacts/api-server/test/basin-product-type.test.ts` (8 ข้อ): จุดตั้งต้น (เฉพาะ 2 รุ่นไม่มีขนาดหลุม) · KF029/KF030 = storage + ป้ายไทยจากข้อมูล + ราคา 16,000 / 400 × 400 × 1000 / `basinDimensions` null / ทุกฟิลด์อื่นเท่าเดิม · อีก 28 รุ่นประเภทเดิม + ป้าย · ตัวนับ 18 / 10 / 2 · หมวดที่แอดมินสร้างใช้ชื่อตัวเองเป็นป้าย ไม่มีแถวหาย · ตัวพิมพ์/ช่องว่างของ SKU · route ต่อสายถูกที่ (อ่านซอร์ส) · น้องไนท์ไม่นับ 2 รุ่นเป็นอ่างตั้งพื้นและขายสินค้าตามเดิม

| ย้อน/ถอด | ผล | คืน |
|---|---|---|
| ถอด KF030 ออกจากรายการเสา | **ตก 4** | ผ่าน 8/8 |
| เพิ่ม KF028 (อ่างจริง) เข้ารายการเสา | **ตก 2** | ผ่าน |
| เสายังใช้ category เดิม (ไม่เปลี่ยนเป็น storage) | **ตก 4** | ผ่าน |
| ป้ายเป็นข้อความอื่น | **ตก 1** | ผ่าน |
| route ไม่ต่อสาย | **ตก 1** | ผ่าน |
| น้องไนท์นับเสาเป็นอ่างตั้งพื้นอีก | **ตก 1** | ผ่าน |

ข้อ 7 (ขาย/ออกใบเสนอราคาได้เหมือนเดิม): การคิดราคาฝั่งเว็บไม่ได้อ่าน `category` จาก API ของ 2 รุ่นนี้ (ใช้ `priceTHB` และรายการ SKU) และราคา/ขนาด/รหัส/การมองเห็นไม่เปลี่ยน (เทสต์ล็อก) — แต่ **ผมไม่ได้เปิดหน้า quote บนเว็บจริง** จึงไม่ยืนยันฝั่งหน้าจอ

เวลา: 11 ต.ค. 69 ราว 07:27 น. · base `59950f7`
