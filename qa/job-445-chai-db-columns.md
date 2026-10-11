# ใบงาน 445-C (ชัย) — **คอลัมน์ DB สำหรับ **รูปทรงอ่าง** (บอสแก้เองผ่านแอดมินได้)**

**วันที่:** 11 ต.ค. 69 (ฉบับ revise 2) · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** คำอนุมัติบอส 11 ต.ค. 69 (ข้อ ข) + **คำชี้แจงบอส 11 ต.ค. 69 เรื่องรูน้ำล้น** ⇒ revise จาก #518
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `lib/db/src/schema/index.ts` + `deploy/hostinger/migrations/` + `artifacts/api-server/**` (routes/lib/test) → **เปิด PR**

> ⚠️ **เปลี่ยนจากฉบับแรก:** บอสชี้ (11 ต.ค. 69) ว่า **"รูน้ำล้น" เป็นตัวเลือกสั่งทำ ไม่ใช่สเปกของรุ่น** ⇒ **ลบเรื่องรูน้ำล้นออกจากงานนี้ทั้งหมด** เหลือเฉพาะ **รูปทรงอ่าง** + ข้อความรวมระดับแคตตาล็อก (ใบ 447-C)
> **แม่แบบมาตรฐาน:** ① baseline ระบุ **commit + OS + ผู้รัน** ② ส่งรายงานที่ **`qa/` ผ่าน PR** ③ `curl` ใช้ชื่อฟิลด์จริง (ฟีดอ่างไม่มี `name`) ④ ห้ามแตะไฟล์ข้ามเจ้าของ ⑤ พิสูจน์สองทางเสมอ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 11 ต.ค. 69 · เดวิด

GOAL:
  A. **เพิ่มคอลัมน์เดียว: `bowl_shape`** (varchar สั้น · null ได้) — **ตัดคอลัมน์ `bowl_overflow_hole` ออก** ตามคำชี้แจงบอส (ไม่ใช่สเปกของรุ่น)
  B. **migration ไฟล์ถัดไปต่อจาก 024** (`025_...sql`) — additive เท่านั้น (ห้าม DROP/TRUNCATE) · seed ค่าเดิมของ KF003/KF006/**KF025** ด้วย guard `IS NULL` · **ห้ามรันกับ production เอง**
  C. **`GET /api/catalog` ใช้ DB ก่อน → ถ้า null ใช้ตารางในโค้ดเดิม** (ค่าที่ลูกค้าเห็นต้องเท่าเดิม) · `bowlShapeLabel` **คำนวณในโค้ดจากรหัสรูปทรง** (ไม่เก็บข้อความไทยใน DB) · **ห้ามมีคำว่า "รูน้ำล้น" ใน label** (บอสชี้) · `bowlOverflowHole` คืน `null` ทุกแถว (ตามใบ 447-C)
  D. **เส้นทางบันทึกสำหรับแอดมิน:** `PUT /api/admin/basins/:id/bowl-shape` (สิทธิ์ `basins/edit`) · รับ **`null` ได้** เพื่อล้างค่า · audit log ว่าใครแก้อะไร · `GET /api/admin/basins` ส่ง **`bowlShapeSource`** (`database` / `builtin` / `none`) ให้บอยแสดงที่มาได้
  E. **เทสต์:** DB-first + fallback + ค่า null + 30 รุ่นค่าที่ลูกค้าเห็นเท่าเดิม + label ไม่มีคำ "รูน้ำล้น" + พิสูจน์สองทาง

SCOPE (แก้เฉพาะที่ระบุ):
  - (รีโป) lib/db/src/schema/index.ts · deploy/hostinger/migrations/ (ไฟล์ใหม่ 025)
  - (รีโป) artifacts/api-server/src/lib/basin-bowl-shape.ts · artifacts/api-server/src/routes/catalog.ts · artifacts/api-server/src/routes/admin-router.ts
  - (รีโป) artifacts/api-server/test/ (เทสต์ใหม่ + ของเดิม)
  - (รีโป) qa/report-chai-round19-db-columns-20261011.md   (แก้ให้ตรงฉบับ revise 2)
  - /opt/data/cache/kbsrc/qa/job-447-chai-no-overflow-wording.md   (อ่าน — ใบที่ผูกกัน)

FORBIDDEN:
  - **ห้ามรัน migration กับ production เอง** · ห้ามแตะข้อมูลลูกค้า · ห้ามคอลัมน์รูน้ำล้น (ตัดออกตามคำบอส)
  - ห้ามแตะ `src/admin/**` `src/components/**` (ของบอย) · ห้ามแตะราคา/ขนาด/สี/ชื่อ · ห้าม merge PR เอง

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข):
  0) **baseline (เดวิดรัน · Linux · `db34d101`):** api 1,287 → ผ่าน 1,287 / ตก 0 · web 1,325 → ผ่าน 1,283 / ตก 0 / ข้าม 42 · tsc = 0
  1) ก่อน/หลัง: `curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b['bowlShapeLabel']) for b in d['basins'] if b.get('bowlShapeLabel')])"` ⇒ **เท่าเดิม · ไม่มีคำว่า รูน้ำล้น**
  2) เทสต์: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `npx tsc --noEmit` (รายงาน commit + OS + ผู้รัน)
  3) ทดสอบ migration บน **Postgres จำลอง/PGlite** เท่านั้น + ระบุชัดว่าไม่ได้รันบนของจริง
  4) **พิสูจน์สองทาง** · 5) ชื่อคอลัมน์/endpoint/ค่าที่รับ ได้ให้บอย 1 ชุด · 6) เวลาไทย + hash

OUTPUT:
  - PR ต่อ `main` (จาก #518 เดิม — rebase/แก้ให้ตรงฉบับ revise 2) ชื่อแนะนำ `feat(db): editable bowl_shape column (shape only)`
  - `qa/report-chai-round19-db-columns-20261011.md` (ในรีโป)
  - สรุป 5 บรรทัด + **ชื่อคอลัมน์ · endpoint · โดเมนค่า · พฤติกรรม null · bowlShapeSource** ให้บอย

STOP:
  - ครบ A–E · หรือ **12 turns** ให้หยุดและรายงาน
  - ถ้า migration เสี่ยงต่อข้อมูลเดิม ⇒ **หยุดและรายงานก่อน** (ห้าม deploy เอง)
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–E |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail |
| 6 | พิสูจน์สองทาง | ถอด → ตก · คืน → ผ่าน |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาข้อมูล (เห็นไม่ชัด = null) | ระบุ 'ไม่ชัด' แทนการเดา |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

> [เดวิด → ชัย]
> **ฉบับ revise 2 (บอสชี้เรื่องรูน้ำล้น):** เหลือคอลัมน์เดียว **`bowl_shape`** — **ตัด `bowl_overflow_hole` ออก**
> · `bowlShapeLabel` คำนวณในโค้ดจากรหัสรูปทรง · **ห้ามมีคำว่า "รูน้ำล้น"** · `bowlOverflowHole` คืน null ทุกแถว
> · เก็บ: DB-first + fallback ตารางเดิม · `PUT /api/admin/basins/:id/bowl-shape` (รับ null ได้, audit log) · `bowlShapeSource`
> · **อย่า merge #518 เดิม** — ปรับให้ตรงฉบับนี้ก่อน (deploy #516 ขึ้น production แล้ว ✅)
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-445-chai-db-columns.md`
