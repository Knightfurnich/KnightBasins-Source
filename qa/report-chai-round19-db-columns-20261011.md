# รายงานชัย รอบ 19 · ใบงาน 445-C (ฉบับ revise 2) — คอลัมน์ DB เดียว `bowl_shape` (รูปทรงอ่างเท่านั้น)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 03:10–04:10 น. (เวลาไทย) — ฉบับแรก 03:35 น. แล้ว **แก้ตามฉบับ revise 2** (บอสชี้ว่ารูน้ำล้นเป็นตัวเลือกสั่งทำ ไม่ใช่สเปกของรุ่น) · **สาขา:** `feat/chai-bowl-shape-db-columns` (PR #518 — **แก้ตามเดิม ไม่เปิดใหม่**)
**ฐาน:** `main` ที่ `bf7bfbf` (มี #516, #517, #515, ใบ revise 2 และใบ 447-C ที่เป็นเอกสารแล้ว)
**แตะ:** `lib/db/src/schema/index.ts` · `deploy/hostinger/migrations/025_basin_bowl_shape.sql` · `artifacts/api-server/src/lib/basin-bowl-shape.ts` · `artifacts/api-server/src/routes/admin-router.ts` · `artifacts/api-server/test/basin-bowl-shape-db.test.ts` · `artifacts/api-server/test/basin-bowl-shape.test.ts` · `artifacts/api-server/test/fixtures/bowl-shape-survey.json` · `artifacts/knight-basins/src/data/catalog.ts` (ตารางสำเนาเว็บ — ดูหมายเหตุ ⚠ ด้านล่าง) · รายงาน
**ไม่แตะ:** `artifacts/knight-basins/src/admin/**` · `src/components/**` · `App.tsx` · ราคา/ขนาด/สี/ชื่อ · ข้อมูลลูกค้า · **ไม่ได้รัน migration กับ production**

## ชื่อสำหรับบอย (446-B) — ชุดเดียว
| อะไร | ชื่อ / ค่า |
|---|---|
| คอลัมน์ในตาราง `basin_prices` | **`bowl_shape`** (varchar 24, null ได้) — มีคอลัมน์เดียว |
| ฟิลด์ API | `bowlShape` · `bowlShapeLabel` (ข้อความไทย **คำนวณในโค้ดจากรหัสรูปทรง ไม่เก็บใน DB อ่านอย่างเดียว**) · `bowlOverflowHole` (**`null` ทุกแถว** เก็บคีย์ไว้ไม่ให้เว็บพัง ห้ามใช้ตัดสินอะไร) |
| ฟิลด์เพิ่มเฉพาะแอดมิน (`GET /api/admin/basins`) | `bowlShapeSource` = `"database"` (ค่าจาก DB) · `"builtin"` (คอลัมน์ว่าง ใช้ตารางในโค้ด) · `"none"` (ไม่มีค่า) |
| โดเมนค่า `bowlShape` | `rounded-rectangle` หลุมสี่เหลี่ยมมุมมน · `oval` หลุมวงรี · `round` หลุมกลม · `rectangle` หลุมสี่เหลี่ยมมุมเหลี่ยม · `square` หลุมสี่เหลี่ยมจัตุรัสมุมเหลี่ยม · `rounded-square` หลุมสี่เหลี่ยมจัตุรัสมุมมน · `null` = ไม่ระบุ |
| endpoint บันทึก | `PUT /api/admin/basins/:id/bowl-shape` (สิทธิ์ `basins` แบบ edit · session แอดมินเดียวกับเส้นทางอื่น · `:id` = `id` ของแถวอ่าง ไม่ใช่ sku) |
| พฤติกรรม null | บันทึก `{"bowlShape":null}` = ล้างคอลัมน์ → **ถอยไปใช้ตารางในโค้ด** (ตอนนี้ 25 รุ่น) — ใบ 449-C จะทำให้ "ล้างค่า = ซ่อนจริง" |

```bash
# ตั้งค่า
curl -s -X PUT "$BASE/api/admin/basins/7/bowl-shape" -H "cookie: knight_admin_session=<session แอดมิน>" -H "content-type: application/json" -d '{"bowlShape":"oval"}'
# ล้างค่า (ไม่ระบุ)
curl -s -X PUT "$BASE/api/admin/basins/7/bowl-shape" -H "cookie: knight_admin_session=<session แอดมิน>" -H "content-type: application/json" -d '{"bowlShape":null}'
```
ตอบกลับ 200: `{"id":7,"sku":"KF007","bowlShape":"oval","bowlShapeLabel":"หลุมวงรี","bowlOverflowHole":null,"bowlShapeSource":"database"}` · 400 ถ้าค่าผิด (รูปทรงไม่รู้จัก · ไม่ส่งคีย์ `bowlShape` · ส่ง `bowlOverflowHole` เป็น true/false) · ลูกค้าเก่าที่ยังส่ง `bowlOverflowHole: null` มาด้วยยังรับได้ · 404 ถ้าไม่มีอ่างนั้น · 401/403 ถ้าไม่มีสิทธิ์ · ทุกการแก้เขียน audit log (action `admin.basin.bowl_shape` ระบุผู้ทำและ from→to)
ฟอร์มแก้อ่างเดิม (`PUT /admin/basins/:id`) **ไม่แตะคอลัมน์นี้** (มีเทสต์ล็อก)

## สรุป 5 บรรทัด
1. **ทำอะไร:** เหลือคอลัมน์เดียว `bowl_shape` + migration 025 (additive, ไม่มี DROP/TRUNCATE, seed KF003/KF006/KF025 ด้วย guard `IS NULL`) · `GET /api/catalog` ใช้ DB ก่อน ถ้า null ใช้ตารางในโค้ด · label คำนวณในโค้ด **ไม่มีคำว่า "รูน้ำล้น"** · `bowlOverflowHole` = `null` ทุกแถว · `PUT /api/admin/basins/:id/bowl-shape` (รับ null, audit log) · `bowlShapeSource`
2. **เทสต์:** api-server 1311 / ผ่าน 1306 / ตก 5 (ชุดเดิม Windows) · web 1322 / ผ่าน 1268 / ตก 12 / ข้าม 42 (ชุดเดิมเท่า main) · เทสต์ใหม่/แก้ 28 ข้อผ่านหมด · พิสูจน์สองทาง 9 แบบ · migration ทดลองบน PostgreSQL จำลอง (PGlite) 3 รอบผ่าน
3. **ตรวจไม่ได้:** รัน migration กับ Postgres จริง/production (ห้ามตามใบ) · ผล `/api/catalog` หลัง deploy · ฝั่ง UI แอดมิน (ของบอย)
4. **ความเสี่ยง:** (ก) **ข้อความที่ลูกค้าเห็นเปลี่ยน ตามคำชี้แจงบอส** — ตอนนี้ production (หลัง #516) ยังมี "…ไม่มีรูน้ำล้น" ใน 13 รุ่น; หลัง deploy ใบนี้ทุกรุ่นเหลือรูปทรงล้วน และ `bowlOverflowHole` เป็น null ทุกแถว (รหัสรูปทรง และรุ่นที่มีค่า เท่าเดิมทุกรุ่น) (ข) migration รันครั้งเดียวตาม ledger — ถ้ามีคนรันซ้ำด้วยมือหลังแอดมินล้างค่ารุ่นที่ seed ไว้ จะถูก seed คืน (ปกติไม่เกิด) (ค) ข้อความรวมเรื่องรูน้ำล้นระดับแคตตาล็อก (`basinOverflowNote` ในใบ 447-C) **ไม่ได้ทำในใบนี้**
5. **ข้อเสนอ:** ใบ 447-C เหลือเฉพาะข้อ C (ข้อความรวม `basinOverflowNote`) เพราะข้อ A/B (label รูปทรงล้วน, `bowlOverflowHole` null) ทำในใบนี้แล้ว · ใบ 449-C ย้ายค่า 25 รุ่นเข้า DB เพื่อให้ "ล้างค่า = ซ่อนจริง"

⚠ **ทับซ้อนกับ 447-C ที่ต้องรู้:** เพื่อให้เทสต์ "สำเนาเว็บ = API" ผ่าน ผมแก้ตาราง `BASIN_BOWL_SHAPES` ใน `artifacts/knight-basins/src/data/catalog.ts` (ตัดวลีรูน้ำล้นออกจาก label และตั้ง `bowlOverflowHole: null`) — ซึ่งอยู่ในขอบเขตของ 447-C ข้อ A/B ไม่ใช่ SCOPE ของ 445-C ถ้าเดวิดไม่ต้องการ ให้บอก ผมจะแยกออก

## 0. baseline และคำสั่งตรวจฟีด
- ผู้รัน: ชัย · Windows 11 · base `bf7bfbf` · คำสั่ง: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` และ `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` · baseline Linux ของเดวิด (`db34d101`): api 1,287 / 1,287 · web 1,325 → 1,283 / 0 / ข้าม 42 (คนละเครื่อง)
- api-server หลังแก้: **1311 / 1306 ผ่าน / 5 ตก** (ที่ตกเป็นชุดเดิม: slip digest / support-guest) · web **1322 / 1268 ผ่าน / 12 ตก / 42 ข้าม** (ชุดที่ตกเท่ากับ `main` ทุกข้อ — เทียบชื่อด้วย `diff`) · `tsc --noEmit`: api-server ไม่มี error ใหม่ (4 error เดิม `speakingRate`/`enabled`) · web 1 error เดิม `src/admin/AdminVoiceSettings.tsx` (`speakingRate`)

```bash
curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b['bowlShapeLabel']) for b in d['basins'] if b.get('bowlShapeLabel')])"
```

- **หลังแก้ต้องได้:** 25 รุ่น, label เป็นรูปทรงล้วน (เช่น KF003 `หลุมสี่เหลี่ยมมุมมน` · KF006 `หลุมวงรี` · KF025 `หลุมกลม`) และ **ไม่มีคำว่า "รูน้ำล้น"** — **ตรวจบน production ไม่ได้จนกว่าจะ deploy**
- **ค่าที่ลูกค้าเห็นก่อน/หลังเท่ากัน:** เทสต์ "BEFORE = AFTER" ตรวจครบ **30 รุ่น** ว่าแถวก่อน migration (ไม่มีคอลัมน์) / หลัง migration (seed 3 รุ่น) / คอลัมน์ว่างทั้งหมด ให้รหัสรูปทรง + ข้อความเหมือนกันทุกตัวอักษร และเท่ากับตารางในโค้ด (ส่วนที่เปลี่ยนจากวันนี้ตามคำชี้แจงบอสคือการตัดวลีรูน้ำล้นออก ดูความเสี่ยง ก)

## 2. migration ทดลองบน PostgreSQL จำลอง (PGlite — ไม่ใช่ production ไม่ใช่ Postgres ของโปรเจกต์)
สร้างตาราง `basin_prices` เท่าเดิม ใส่ 7 แถว แล้วรัน `025_basin_bowl_shape.sql`:

| ขั้น | ผล |
|---|---|
| รันครั้งที่ 1 | KF003 `rounded-rectangle` · KF006 `oval` · KF025 `round` · ที่เหลือ `null` (KF001 KF002 KF007 KF029) |
| คอลัมน์เดิม (id, sku, สี, ราคา, ขนาด, รูป, active, ลำดับ) | **ไม่เปลี่ยน** (เทียบ JSON ก่อน/หลังเท่ากัน) |
| รันครั้งที่ 2 | ผลเท่าเดิม (idempotent) |
| แอดมินแก้ KF003 เป็น `round` แล้วรันอีก | KF003 ยังเป็น `round` (ไม่ถูกทับ) |
| ชนิดคอลัมน์ | `bowl_shape` character varying, nullable, ไม่มี default · **ไม่มีคอลัมน์รูน้ำล้น** |

ตรวจเพิ่ม: ขั้นตอน CI "Check that migrations are additive" (`sed … | grep -iE '\b(drop|truncate)\b'`) ได้ผล **ผ่าน**

## 3. เทสต์และพิสูจน์สองทาง
- `artifacts/api-server/test/basin-bowl-shape-db.test.ts` (20 ข้อ): migration (additive / คอลัมน์เดียว / ไม่มี overflow / ไม่มี default / seed เฉพาะ 3 รุ่นและมี guard / ค่า seed = ตารางในโค้ด) · schema มี `bowl_shape` และไม่มีคอลัมน์รูน้ำล้น · ค่า DB ชนะ · คอลัมน์ว่างถอยไปตารางในโค้ด → ไม่มีก็ `null` ไม่ error · ค่าประหลาดถูกมองข้าม · **ไม่มี label ไหน (ทุกรูปทรง ทุกรุ่น) มีคำว่า "น้ำล้น"** และ `bowlOverflowHole` เป็น null เสมอ · BEFORE = AFTER 30 รุ่น · เพิ่มแค่ 3 คีย์ · ตัวตรวจ body · เส้นทางแอดมิน (401 · GET เห็นแหล่งที่มา · บันทึก+คงอยู่+audit ระบุผู้ทำและ from→to · null ล้างค่า · 400/404 ไม่เปลี่ยนข้อมูล · ส่ง `bowlOverflowHole` เป็นค่า → 400 · ฟอร์มแก้อ่างทั่วไปไม่แตะคอลัมน์)
- `basin-bowl-shape.test.ts` (8 ข้อ) แก้ให้เป็นรูปทรงล้วน · survey fixture ตัดข้อมูลรูน้ำล้นออก เหลือเฉพาะรูปทรง

| ย้อน/ถอด | ผล | คืน |
|---|---|---|
| label ใส่วลีรูน้ำล้นกลับ (ฝั่ง API) | **ตก 10** | ผ่าน 28/28 |
| `bowlOverflowHole` คืนค่าที่ไม่ใช่ null | **ตก 13** | ผ่าน |
| label ในสำเนาเว็บมีวลีรูน้ำล้น | **ตก 1** | ผ่าน |
| migration มีคอลัมน์รูน้ำล้นกลับมา | **ตก 1** | ผ่าน |
| schema มีคอลัมน์รูน้ำล้นกลับมา | **ตก 1** | ผ่าน |
| เส้นทางรับค่ารูน้ำล้นเป็น true/false | **ตก 2** | ผ่าน |
| ไม่สนใจค่า DB (ใช้ตารางในโค้ดเสมอ) | **ตก 6** | ผ่าน |
| คอลัมน์ว่างไม่ถอยไปใช้ตารางในโค้ด | **ตก 6** | ผ่าน |
| seed โดยไม่มี guard `IS NULL` | **ตก 1** | ผ่าน |

## ลำดับ deploy
1. #516 และ #517 ขึ้น production แล้ว (เดวิดยืนยัน ✅)
2. merge **#518 (ฉบับนี้)** เข้า `main` → `deploy.yml`: ตรวจ migration ไม่มี DROP/TRUNCATE → คัดลอก `025_*.sql` ไป VPS → `migrate.sh` ใช้ไฟล์ pending ใน transaction เดียวพร้อมบันทึก ledger → รีสตาร์ท API — **ผมไม่ได้รัน/สั่ง deploy**
3. ตรวจ: curl ข้างบน + `SELECT sku,bowl_shape FROM basin_prices WHERE bowl_shape IS NOT NULL;` ต้องได้ KF003 · KF006 · KF025
4. ถอย: โค้ดเก่าไม่รู้จักคอลัมน์ใหม่ จึงทำงานต่อได้ ไม่ต้อง rollback DB

เวลา: 11 ต.ค. 69 ราว 04:10 น. · base `bf7bfbf`
