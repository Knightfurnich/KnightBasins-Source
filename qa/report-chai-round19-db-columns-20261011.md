# รายงานชัย รอบ 19 · ใบงาน 445-C — รูปทรงหลุม/รูน้ำล้นเป็นคอลัมน์ DB (บอสแก้เองผ่านแอดมินได้)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 03:10–03:35 น. (เวลาไทย) · **สาขา:** `feat/chai-bowl-shape-db-columns`
**ฐาน:** `main` ที่ `27c3c76` (มี #516 ตารางสำรวจ 25 รุ่น merge แล้วที่ `832ea53`; rebase จากเดิมที่ซ้อนบนสาขา #516 — เนื้อหาไม่เปลี่ยน)
**แตะ:** `lib/db/src/schema/index.ts` · `deploy/hostinger/migrations/025_basin_bowl_shape.sql` (ใหม่) · `artifacts/api-server/src/lib/basin-bowl-shape.ts` · `artifacts/api-server/src/routes/admin-router.ts` (เพิ่มเส้นทางใหม่ 1 เส้น + ให้ GET ส่งค่าที่มีผลจริง) · `artifacts/api-server/test/basin-bowl-shape-db.test.ts` (ใหม่) · รายงาน
**ไม่แตะ:** `artifacts/knight-basins/src/admin/**` · `src/components/**` · `App.tsx` · ราคา/ขนาด/สี · ข้อมูลลูกค้า · **ไม่ได้รัน migration กับ production**

## ชื่อที่บอยต้องใช้ (446-B) — ชุดเดียว
| อะไร | ชื่อ |
|---|---|
| คอลัมน์ในตาราง `basin_prices` | `bowl_shape` (varchar 24, null ได้) · `bowl_overflow_hole` (boolean, null ได้) |
| ฟิลด์ API (อ่าน `GET /api/catalog` และ `GET /api/admin/basins`) | `bowlShape` · `bowlOverflowHole` · `bowlShapeLabel` (ข้อความไทย สร้างจาก 2 ค่าแรก **อ่านอย่างเดียว ไม่ได้เก็บ**) |
| ฟิลด์เพิ่มเฉพาะแอดมิน (`GET /api/admin/basins`) | `bowlShapeSource` = `"database"` (ค่าจาก DB) · `"builtin"` (คอลัมน์ว่าง ใช้ตารางในโค้ด) · `"none"` (ไม่มีค่า) |
| ค่า `bowlShape` ที่ใช้ได้ | `rounded-rectangle` สี่เหลี่ยมมุมมน · `oval` วงรี · `round` กลม · `rectangle` สี่เหลี่ยมมุมเหลี่ยม · `square` จัตุรัสมุมเหลี่ยม · `rounded-square` จัตุรัสมุมมน · `null` = ไม่ระบุ |
| บันทึก | `PUT /api/admin/basins/:id/bowl-shape` (สิทธิ์ `basins` แบบ edit — ใช้ session แอดมินเดียวกับเส้นทางอื่น) |

ตัวอย่างคำสั่งบันทึก (`:id` = `id` ของแถวอ่างจาก `GET /api/admin/basins` ไม่ใช่ sku) — **ต้องส่งทั้งสองคีย์เสมอ**:
```bash
# ตั้งค่า: KF007 หลุมวงรี มีรูน้ำล้น
curl -s -X PUT "$BASE/api/admin/basins/7/bowl-shape" -H "cookie: knight_admin_session=<ค่าจาก session แอดมิน>" -H "content-type: application/json" -d '{"bowlShape":"oval","bowlOverflowHole":true}'
# ไม่ทราบเรื่องรูน้ำล้น (null): {"bowlShape":"round","bowlOverflowHole":null}
# ล้างค่า (กลับไปใช้ตารางในโค้ด): {"bowlShape":null,"bowlOverflowHole":null}
```
ตอบกลับ 200: `{"id":7,"sku":"KF007","bowlShape":"oval","bowlShapeLabel":"หลุมวงรี มีรูน้ำล้น","bowlOverflowHole":true,"bowlShapeSource":"database"}` · 400 ถ้าค่าผิด (รูปทรงไม่รู้จัก · ขาดคีย์ใดคีย์หนึ่ง · ใส่ `bowlOverflowHole` โดยไม่มี `bowlShape`) · 404 ถ้าไม่มีอ่างนั้น · 401/403 ถ้าไม่มีสิทธิ์

**ข้อควรรู้สำหรับ UI (446-B):**
- `null` ที่บันทึกลงคอลัมน์ ≠ "ซ่อนบรรทัด" สำหรับรุ่นที่ตารางในโค้ดมีค่าอยู่แล้ว (ตอนนี้ 25 รุ่น) — คอลัมน์ว่างจะ **ถอยไปใช้ตารางในโค้ด** ตามข้อ D ของใบ ดังนั้นถ้าอยากให้รุ่นนั้นไม่แสดงรูปทรงจริง ๆ ต้องใช้ค่าอื่นหรือรอใบแยกให้ลบรายการออกจากตารางในโค้ด · ให้ UI แสดง `bowlShapeSource` เพื่อให้บอสเห็นว่าค่าปัจจุบันมาจากที่ไหน
- ฟอร์มแก้อ่างเดิม (`PUT /admin/basins/:id`) **ไม่แตะคอลัมน์นี้** และ **ไม่ควรส่ง** `bowlShape*` ไปทางนั้น (ถูกตัดทิ้งโดยตัวตรวจ) — มีเทสต์ล็อกว่าเส้นทางทั่วไปไม่เอ่ยถึงคอลัมน์นี้

## สรุป 5 บรรทัด
1. **ทำอะไร:** เพิ่ม 2 คอลัมน์ (`bowl_shape`, `bowl_overflow_hole`) + migration 025 (additive, ไม่มี DROP/TRUNCATE) พร้อม seed KF003/KF006/KF025 · `GET /api/catalog` ใช้ค่าจาก DB ก่อน ถ้าคอลัมน์ว่างใช้ตารางในโค้ดเดิม · เส้นทางใหม่ `PUT /api/admin/basins/:id/bowl-shape` บันทึกพร้อม audit log (ใครแก้อะไรจาก→เป็น)
2. **เทสต์:** api-server 1305 / ผ่าน 1300 / ตก 5 (ชุดเดิม Windows) · เทสต์ใหม่ 18 ข้อผ่านหมด (พิสูจน์สองทาง 9 แบบ) · migration ทดลองรันบน PostgreSQL จำลอง (PGlite) ผ่าน 3 รอบ · web 1311 / ผ่าน 1257 / ตก 12 / ข้าม 42 (ชุดที่ตกเท่ากับ main ทุกข้อ — ไม่ได้แตะไฟล์ฝั่งเว็บ)
3. **ตรวจไม่ได้:** รัน migration กับ production/Postgres จริงของโปรเจกต์ (ห้ามตามใบ) · ผล `/api/catalog` หลัง deploy · ฝั่ง UI แอดมิน (ของบอย)
4. **ความเสี่ยง:** (ก) ใบนี้ต้องไปหลัง #516 (merge แล้ว) — ถ้า #516 ยังไม่ขึ้น production รุ่น KF025 จะมีค่า "หลุมกลม" เพิ่มจากที่ลูกค้าเห็นตอนนี้ (ก่อน/หลังไม่เท่ากัน) ให้ตรวจว่า #516 deploy แล้วก่อน (ข) migration ถูกบันทึกใน ledger และรันครั้งเดียว — ถ้ามีคนรันซ้ำด้วยมือหลังที่แอดมินล้างค่าทั้งสองคอลัมน์ของรุ่นที่ seed ไว้ จะถูก seed คืน (ใน ledger ปกติไม่เกิด) (ค) ข้อความ "ไม่มีรูน้ำล้น" ของ 13 รุ่นยังรอบอสยืนยัน (จาก 442-C)
5. **ข้อเสนอ:** ลำดับ merge/deploy ด้านล่าง · ให้บอสตรวจ `bowlShapeSource` หลัง deploy · ถ้าต้องการให้ "ล้างค่า = ซ่อนจริง" ออกใบแยกให้ย้าย 25 ค่าจากตารางในโค้ดเข้า DB ทั้งหมด (ผมทำ migration 026 ได้ แต่ต้องให้บอสยืนยันค่าก่อน)

## ลำดับ deploy (ข้อ B)
1. merge **#516** (ตารางสำรวจ 25 รุ่น — ทำให้ KF025 มีค่าอยู่แล้ว) → deploy
2. retarget/merge **ใบนี้** เข้า `main` → workflow `deploy.yml` จะ: ตรวจว่า migration ไม่มี DROP/TRUNCATE → คัดลอก `025_*.sql` ไป VPS → `migrate.sh` ใช้ไฟล์ที่ pending ใน transaction เดียวพร้อมบันทึก ledger → รีสตาร์ท API (โค้ดใหม่ + คอลัมน์ใหม่พร้อมกัน) — ผมไม่ได้รัน/สั่ง deploy เอง
3. ตรวจ: `curl` ตามข้อ 1 ของ evidence (ผลต้องเท่าเดิม) และดู `bowl_shape` ใน DB ของ 3 รุ่น: `SELECT sku,bowl_shape,bowl_overflow_hole FROM basin_prices WHERE bowl_shape IS NOT NULL;` ต้องได้ KF003 · KF006 · KF025
4. ถ้าต้องถอย: โค้ดเก่าไม่รู้จักสองคอลัมน์จึงทำงานต่อได้ตามปกติ (ไม่ต้อง rollback DB)

## 0–1. baseline และคำสั่งตรวจฟีด (ก่อน = หลัง)
- baseline ผู้รัน: ชัย · Windows 11 · base `21357cf` (สาขา #516 ก่อน merge; เนื้อหาเดียวกับ `832ea53`) = 1287 / 1282 / 5 ตก → หลังแก้ **1305 / 1300 / 5 ตก** (+18 ข้อ; 5 ข้อที่ตกเป็นชุดเดิมทุกรอบ: slip digest / support-guest) · คำสั่ง `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · baseline Linux เดวิด `6b10827`: api 1,286 / 1,286 ผ่าน (คนละเครื่อง)
- `tsc --noEmit`: api-server ไม่มี error ใหม่ (4 error เดิม `speakingRate`/`enabled`) · web 1 error เดิม `src/admin/AdminVoiceSettings.tsx` (`speakingRate`)
```bash
curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b.get('bowlShape'),b.get('bowlShapeLabel'),b.get('bowlOverflowHole')) for b in d['basins'] if b.get('bowlShapeLabel')])"
```
**ค่าที่ลูกค้าเห็นก่อน/หลัง ต้องเท่ากัน:** เทสต์ "BEFORE = AFTER" ตรวจครบ **30 รุ่น** — แถวก่อน migration (ไม่มีคอลัมน์), หลัง migration (seed 3 รุ่น), และคอลัมน์ว่างทั้งหมด ให้ข้อความเหมือนกันทุกตัวอักษร และเท่ากับตารางในโค้ด · production ขณะนี้ (ก่อน deploy) ตรวจฟีดจริงไม่ได้ตั้งแต่ #516 ยังไม่ merge — **ตรวจหลัง deploy ไม่ได้ตอนนี้**

## 2. migration ทดลองบน PostgreSQL จำลอง (ไม่ใช่ production)
ใช้ PGlite (Postgres ในโปรเซส) สร้างตาราง `basin_prices` เท่าเดิม ใส่ 7 แถว แล้วรัน `025_basin_bowl_shape.sql`:
| ขั้น | ผล |
|---|---|
| รันครั้งที่ 1 | KF003 `rounded-rectangle/false` · KF006 `oval/true` · KF025 `round/null` · ที่เหลือ `null/null` (KF001 KF002 KF007 KF029) |
| คอลัมน์เดิม (id, sku, สี, ราคา, ขนาด, รูป, active, ลำดับ) | **ไม่เปลี่ยน** (เทียบ JSON ก่อน/หลัง = เท่ากัน) |
| รันครั้งที่ 2 | ผลเท่าเดิม (idempotent) |
| แอดมินแก้ KF003 เป็น `round/true` แล้วรันอีก | KF003 ยังเป็น `round/true` (ไม่ถูกทับ) |
| ชนิดคอลัมน์ | `bowl_shape` character varying, nullable, ไม่มี default · `bowl_overflow_hole` boolean, nullable, ไม่มี default |
ตรวจเพิ่ม: ขั้นตอน CI "Check that migrations are additive" (`sed … | grep -iE '\b(drop|truncate)\b'`) ได้ผล **ผ่าน** (ไม่พบ)

## 3. เทสต์และพิสูจน์สองทาง
เทสต์ใหม่ `artifacts/api-server/test/basin-bowl-shape-db.test.ts` (18 ข้อ): migration (additive/nullable/ไม่มี default/seed เฉพาะ 3 รุ่นและมี guard/ค่า seed = ตารางในโค้ด) · schema ชื่อคอลัมน์ · ค่า DB ชนะ · คอลัมน์ว่าง → ตารางในโค้ด → ไม่มีก็ `null` ไม่ error · ค่าประหลาดใน DB ถูกมองข้าม · BEFORE = AFTER 30 รุ่น · เพิ่มแค่ 3 คีย์ · ตัวตรวจ body · เส้นทางแอดมิน (ไม่ล็อกอิน 401 · GET เห็นแหล่งที่มา · บันทึก+คงอยู่+audit ระบุผู้ทำและ from→to · null/null ล้างค่า · 400/404 และไม่เปลี่ยนข้อมูล · ฟอร์มแก้อ่างทั่วไปไม่แตะคอลัมน์)
| ย้อน/ถอด | ผล | คืน |
|---|---|---|
| ถอดการเพิ่มคอลัมน์ overflow ออกจาก migration | **ตก 1** | ผ่าน 18/18 |
| ใส่คำว่า `TRUNCATE` ใน migration | **ตก 1** | ผ่าน |
| seed KF006 ด้วยค่า hole ต่างจากตารางในโค้ด | **ตก 1** | ผ่าน |
| seed รุ่นเพิ่ม (KF007) | **ตก 2** | ผ่าน |
| seed โดยไม่มี guard `IS NULL` | **ตก** (ชุดเทสต์ล้ม) | ผ่าน |
| ไม่สนใจค่า DB (ใช้ตารางในโค้ดเสมอ) | **ตก 5** | ผ่าน |
| คอลัมน์ว่างไม่ถอยไปใช้ตารางในโค้ด | **ตก 5** | ผ่าน |
| เส้นทางบันทึกไม่เขียนค่า | **ตก 2** | ผ่าน |
| ฟอร์มแก้อ่างทั่วไปเอ่ยถึงคอลัมน์ใหม่ | **ตก 1** | ผ่าน |

## หมายเหตุ
- ใบสั่งให้รายงานชื่อ `qa/report-chai-round19-db-columns-20261011.md` (ไฟล์นี้) — ใบ 444-C ผมใช้ชื่อ `…round19-kf029-kf030-main-photo…` ไปแล้วก่อนเห็นชื่อนี้ จึงมีสองไฟล์ "round19" คนละใบ
- หน้า log แอดมิน (`AdminLogsManager.tsx` ของบอย) รู้จักเฉพาะชื่อ action เดิม; action ใหม่ `admin.basin.bowl_shape` จะแสดงตามชื่อดิบจนกว่าบอยจะเพิ่มป้ายชื่อ

เวลา: 11 ต.ค. 69 03:24 น. · base `21357cf`
