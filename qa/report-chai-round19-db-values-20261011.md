# รายงานชัย · ใบงาน 449-C — ย้ายค่ารูปทรงอ่าง 25 รุ่นเข้า DB · ล้างค่า = ซ่อนจริง

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 07:00–07:45 น. (เวลาไทย) · **สาขา:** `feat/chai-bowl-shape-db-source`
**ฐาน:** ซ้อนบนสาขาของ **#518** (`feat/chai-bowl-shape-db-columns` commit `9e30755` — คอลัมน์ `bowl_shape` + migration 025) ⚠ **ต้อง merge #518 ก่อน** แล้วจึง merge ใบนี้ (ใบนี้ใช้คอลัมน์และ endpoint ของ 445-C)
**แตะ:** `deploy/hostinger/migrations/026_basin_bowl_shape_seed.sql` (ใหม่) · `artifacts/api-server/src/lib/basin-bowl-shape.ts` · `artifacts/api-server/src/routes/admin-router.ts` (คอมเมนต์ 2 จุด) · `artifacts/api-server/test/basin-bowl-shape-db.test.ts` · `artifacts/api-server/test/basin-bowl-shape.test.ts` · รายงาน
**ไม่แตะ:** `src/admin/**` · `src/components/**` · `App.tsx` · ราคา/ขนาด/สี/ชื่อ · ข้อมูลลูกค้า · **ไม่ได้รัน migration กับ production** · ไม่มี DROP/TRUNCATE

## สรุป 5 บรรทัด
1. **ทำอะไร:** migration 026 seed ค่ารูปทรงของอีก **22 รุ่น** (รวมกับ 025 = **25 รุ่น**) เข้าคอลัมน์ `bowl_shape` ด้วย guard `IS NULL` · หลังจากนี้ **DB เป็นแหล่งจริง**: คอลัมน์ว่าง = "ไม่ระบุ" → ไม่มีบรรทัดบนการ์ด (`bowlShapeLabel: null`) **ไม่ถอยไปใช้ตารางในโค้ดอีก** · ตารางในโค้ดเหลือเป็นแหล่ง seed/อ้างอิงของเทสต์เท่านั้น (ชื่อฟังก์ชันเปลี่ยนเป็น `seedBowlShapeFields` และมีเทสต์ล็อกว่าเส้นทางตอบลูกค้าไม่อ่านมัน)
2. **ผลต่างก่อน/หลัง = 0:** เทียบทีละรุ่น 30 รุ่น (25 รุ่นมีค่า + 5 รุ่นว่าง: KF007 KF009 KF010 ภาพไม่ชัด · KF029 KF030 ไม่ใช่อ่าง) ทั้งรหัสรูปทรง ข้อความ และ `bowlOverflowHole` — ทั้งในเทสต์และบน PostgreSQL จำลอง (PGlite) · จำนวนแถวที่ seed: **22** (026) + **3** (025) = **25**
3. **เทสต์:** api-server 1315 / ผ่าน 1309 / ตก 6 (5 ข้อเดิม Windows + `admin-storage-stats` "safe zeros" ที่ตกเฉพาะตอนรันทั้งชุด และผ่าน 5/5 เมื่อรันเดี่ยว — ไม่เกี่ยวกับงานนี้) · web 1322 / ผ่าน 1268 / ตก 12 / ข้าม 42 (ชุดเดิมเท่า main) · เทสต์ที่เกี่ยวข้อง 32 ข้อผ่านหมด · พิสูจน์สองทาง 7 แบบ · tsc ไม่มี error ใหม่
4. **ตรวจไม่ได้ / ความเสี่ยง:** ตรวจ `/api/catalog` บน production หลัง deploy ไม่ได้ · รัน migration กับ Postgres จริงไม่ได้ (ห้ามตามใบ) · ⚠ **ฝั่งเว็บ:** ตาราง `BASIN_BOWL_SHAPES` ในสำเนา static (`knight-basins/src/data/catalog.ts`) ยังถูกใส่เข้า `PRODUCTS` จึงอาจโชว์บรรทัดรูปทรงสั้น ๆ ก่อน API โหลด หรือกรณีออฟไลน์ แม้แอดมินล้างค่าแล้ว — หลัง API โหลด การ์ดที่สร้างจากแถว API ไม่มีข้อความนี้จึงหาย (ตาม `basinProductFromCatalog`/`syncBowlShapesFromCatalog` ที่ผมอ่านโค้ด ไม่ได้เปิดหน้าจอตรวจ) — ควรให้บอยเลิกใส่ตารางนี้ใน `PRODUCTS` หรือให้ผมตัดออกในใบแยก · migration รันครั้งเดียวตาม ledger ถ้ามีคนรันซ้ำด้วยมือหลังแอดมินล้างค่า รุ่นที่ถูกล้างจะถูก seed คืน (ปกติไม่เกิด)
5. **ข้อเสนอ:** ให้บอสทดลองล้างค่า 1 รุ่นผ่านแอดมิน (ใบ 446-B) หลัง deploy แล้วดูว่าบรรทัดหายจริงบนเว็บ · ใบแยกให้ตัดตาราง static ออกจาก `PRODUCTS` (ฝั่งเว็บ)

## ชื่อฟิลด์/พฤติกรรม (ต่อจาก 445-C — ไม่เปลี่ยน)
คอลัมน์ `bowl_shape` · ฟิลด์ `bowlShape` · `bowlShapeLabel` (คำนวณในโค้ด) · `bowlOverflowHole` (null เสมอ) · `PUT /api/admin/basins/:id/bowl-shape` รับ `{"bowlShape": <รูปทรง>|null}` · `bowlShapeSource` ตอนนี้เหลือ **`"database"`** (มีค่า) หรือ **`"none"`** (ว่าง = ซ่อน) — ค่า `"builtin"` เลิกใช้แล้ว (บอยต้องไม่คาดหวังค่านี้)

## 0–2. baseline และคำสั่ง
- ผู้รัน: ชัย · Windows 11 · ฐาน `9e30755` (#518) บน `main` `bf7bfbf` · คำสั่ง: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` · baseline Linux ของเดวิด (`ad3b8cc4`): api 1,287 / 1,287 · web 1,325 → 1,283 / 0 / ข้าม 42 (คนละเครื่อง) · `tsc --noEmit`: api-server ไม่มี error ใหม่ (4 error เดิม `speakingRate`/`enabled`)
```bash
curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b['bowlShapeLabel']) for b in d['basins'] if b.get('bowlShapeLabel')])"
```
**ก่อน = หลัง ต้องเท่ากัน** (25 รุ่นเท่าเดิมทุกตัวอักษร) — เทียบบน production ไม่ได้จนกว่าจะ deploy (และจนกว่า #518 จะขึ้น); การเทียบที่ทำได้คือเทสต์ + PGlite ด้านล่าง

## 3. ทดสอบ migration บน PostgreSQL จำลอง (PGlite — ไม่ใช่ production ไม่ใช่ Postgres ของโปรเจกต์)
สร้างตาราง `basin_prices` เท่าเดิม ใส่ 30 แถว (KF001–KF030) แล้วรัน 025 ตามด้วย 026:

| ขั้น | ผล |
|---|---|
| หลัง 025 อย่างเดียว | แถวที่มีค่า: KF003, KF006, KF025 |
| หลัง 025 + 026 | แถวที่มีค่า **25** · แถวว่าง: KF007, KF009, KF010, KF029, KF030 |
| คอลัมน์เดิม (id, sku, สี, ราคา, ขนาด, รูป, active, ลำดับ) | **ไม่เปลี่ยน** (เทียบ JSON ก่อน/หลังเท่ากัน) |
| ค่าที่ลูกค้าเห็น ก่อน (ตาราง seed ในโค้ด) vs หลัง (อ่านจาก DB ด้วยตรรกะจริงของ API) | **ผลต่าง 0 / 30 รุ่น** (รหัสรูปทรง + ข้อความ + `bowlOverflowHole`) |
| รันซ้ำอีกรอบ | ยังเป็น 25 แถว (idempotent) |
| ล้างค่า KF002 ใน DB (`bowl_shape = NULL`) | API ได้ `[null, null, null]` → **บรรทัดหาย** |
| แอดมินแก้ KF001 เป็น `round` แล้วรัน 026 ซ้ำ | KF001 ยังเป็น `round` (ไม่ถูกทับ) |
ตรวจเพิ่ม: ขั้นตอน CI "Check that migrations are additive" ได้ผล **ผ่าน** สำหรับ 026

## 4–5. เทสต์และพิสูจน์สองทาง
เพิ่ม/แก้ใน `basin-bowl-shape-db.test.ts` และ `basin-bowl-shape.test.ts`: migration 026 (เฉพาะ UPDATE 22 ตัวที่มี guard · ไม่มีคำสั่งเปลี่ยนสคีมา/ลบ · ไม่เอ่ยเรื่องรูน้ำล้น) · 025 + 026 ครอบคลุม **25 รุ่นพอดี** ค่าตรงตาราง seed และไม่มี 5 รุ่นที่ต้องว่าง · คอลัมน์ว่าง = ไม่มีค่าไม่มีข้อความ (ไม่ fallback) · ค่าประหลาดถูกมองข้าม · **เส้นทางตอบลูกค้า (`resolveBowlShape`, `routes/catalog.ts`, `admin-router.ts`) ไม่อ่านตาราง seed** (อ่านจากซอร์ส) · BEFORE = AFTER 30 รุ่นผลต่าง 0 · **CLEAR = HIDE**: เอาค่า 1 รุ่นออก → บรรทัดหาย · คืนค่า → ข้อความเดิมกลับมา · เส้นทางแอดมิน (GET เห็น `database`/`none` · PUT null → `none`, label null)

| ย้อน/ถอด | ผล | คืน |
|---|---|---|
| ตัวตัดสินกลับไปใช้ตาราง seed เมื่อคอลัมน์ว่าง | **ตก 6** | ผ่าน 32/32 |
| 026 ลืม KF012 | **ตก 3** | ผ่าน |
| 026 seed KF007 (ภาพไม่ชัด) | **ตก 3** | ผ่าน |
| 026 มี UPDATE ที่ไม่มี guard `IS NULL` | **ตก 2** | ผ่าน |
| 026 ใส่ค่าผิดให้ KF020 | **ตก 2** | ผ่าน |
| route อ่านตาราง seed | **ตก 1** | ผ่าน |
| 026 มีคำสั่งเปลี่ยนสคีมา | **ตก 1** | ผ่าน |

## ลำดับ deploy
1. merge #518 (025 + โค้ดคอลัมน์เดียว) → deploy → ตรวจ `SELECT sku,bowl_shape FROM basin_prices WHERE bowl_shape IS NOT NULL;` ได้ KF003 · KF006 · KF025
2. merge ใบนี้ → `deploy.yml`: ตรวจว่า migration ไม่มี DROP/TRUNCATE → คัดลอก `026_*.sql` → `migrate.sh` ใช้ไฟล์ pending ใน transaction เดียวพร้อมบันทึก ledger → รีสตาร์ท API (migration มาก่อนโค้ดใหม่เสมอ) — **ผมไม่ได้รัน/สั่ง deploy**
3. ตรวจหลัง deploy: curl ข้างบน (ต้องเท่าเดิม 25 รุ่น) และ `SELECT count(*) FROM basin_prices WHERE bowl_shape IS NOT NULL;` ต้องได้ 25
4. ถอย: ถ้าต้องกลับไปโค้ด 445 — โค้ดเก่า fallback ตารางในโค้ดจึงแสดงเหมือนเดิม; ค่าใน DB ไม่ต้องย้อน

เวลา: 11 ต.ค. 69 ราว 07:45 น. · ฐาน `9e30755`
