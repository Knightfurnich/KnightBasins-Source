# ใบงาน 445-C (ชัย) — **ย้ายค่ารูปทรงอ่าง/รูน้ำล้นเป็นคอลัมน์ DB (บอสแก้เองผ่านแอดมินได้) — บอสอนุมัติแล้ว**

**วันที่:** 11 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** รายงานสรุปของชัย 11 ต.ค. 69 (ปิด 436-C/KF003/438-C) — ข้อ 5 ของชัย + **คำอนุมัติบอส 11 ต.ค. 69: เห็นด้วย เพิ่มคอลัมน์ บอสอนุมัติ**
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `lib/db/**` + `deploy/hostinger/migrations/**` + `artifacts/api-server/**` · **ไม่แตะ** `src/admin/**` (ของบอย — ใบ 446-B) → **เปิด PR**

> **แม่แบบมาตรฐาน (แก้ตามข้อปรับของชัย 11 ต.ค. 69):** ① baseline ต้องระบุ **commit + OS + ผู้รัน + คำสั่ง** ② ส่งรายงานที่ **`qa/` ในรีโปผ่าน PR** (เครื่องผู้รับงานเข้า `/opt/data` ไม่ได้) ③ ตัวอย่าง `curl` ใช้ **ชื่อฟิลด์จริง** — ฟีดอ่าง **ไม่มีฟิลด์ `name`** ใช้ `sku` · `color` · `colorName` · `imageUrl` · `basinDimensions` · `bowlShape` · `bowlShapeLabel` · `bowlOverflowHole` ④ ห้ามแตะไฟล์ข้ามเจ้าของ ⑤ พิสูจน์สองทางเสมอ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 11 ต.ค. 69 · เดวิด

GOAL:
  A. **เพิ่มคอลัมน์ใน DB** เก็บค่าที่บอสแก้ได้เอง: รูปทรงอ่าง + มี/ไม่มีรูน้ำล้น (ตั้งชื่อคอลัมน์ให้ชัดและแจ้งชื่อให้บอยใช้ต่อ)
  B. **migration ต้องผ่าน PR** (ห้ามรันกับ production เอง) — ระบุลำดับการ deploy + **seed ค่าเดิม KF003/KF006 และ KF025 (อ่างกลม ทรงสูง)** ให้ครบ
  C. **API อ่าน/เขียนได้:** `GET /api/catalog` ยังส่ง `bowlShape`/`bowlShapeLabel`/`bowlOverflowHole` เหมือนเดิม + เส้นทางให้แอดมินบันทึกค่า (ให้บอยเรียกใช้ใน 446-B) และ log ว่าใครแก้
  D. **เข้ากันได้ย้อนหลัง:** คอลัมน์เป็น null ⇒ ใช้ค่าจากสำเนา static เดิม (ห้ามการ์ดหาย/ห้าม error)
  E. **เทสต์:** อ่าน-เขียน-ค่าเริ่มต้น-null fallback + พิสูจน์สองทาง · **ค่าที่ลูกค้าเห็นก่อน/หลัง deploy ต้องเท่ากัน**

SCOPE (แก้เฉพาะที่ระบุ):
  - (รีโป) lib/db/src/schema/index.ts · lib/db/src/schema/            (schema ของตาราง)
  - (รีโป) deploy/hostinger/migrations/                               (ไฟล์ SQL ลำดับถัดไป — ปัจจุบันล่าสุด 024_)
  - (รีโป) artifacts/api-server/src/lib/basin-bowl-shape.ts · artifacts/api-server/src/routes/catalog.ts · artifacts/api-server/test/
  - (รีโป) qa/report-chai-round19-db-columns-20261011.md   (ใหม่) รายงานของคุณ
  - /opt/data/cache/kbsrc/qa/job-442-chai-bowl-shape-survey.md   (อ่าน — งานสำรวจรูปทรงที่เกี่ยวข้อง)
  - /opt/data/knight-design-kb/pricing.json                      (อ่าน — ราคา/สี อ้างอิง)

FORBIDDEN:
  - **ห้ามรัน migration กับ production เอง** (ผ่าน PR + ให้ทีม deploy) · ห้ามลบ/แก้ข้อมูลลูกค้า
  - ห้ามแตะ `src/admin/**` `src/components/**` (ของบอย) · ห้ามแตะราคา/ขนาด/สี · ห้าม merge PR เอง

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข):
  0) **baseline (เดวิดรัน · Linux · `6b10827`):** api = 1,286 → ผ่าน 1,286 / ตก 0 · web = 1,314 → ผ่าน 1,272 / ตก 0 / ข้าม 42
  1) ก่อน/หลัง deploy: `curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b.get('bowlShape'),b.get('bowlShapeLabel'),b.get('bowlOverflowHole')) for b in d['basins'] if b.get('bowlShapeLabel')])"` ⇒ **ต้องเท่าเดิม**
  2) เทสต์อ่าน/เขียน + null fallback: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · `cd artifacts/knight-basins && npm test` · `npx tsc --noEmit` = 0 (รายงาน commit + OS)
  3) **พิสูจน์สองทาง** · 4) ระบุ **ชื่อคอลัมน์ + ชื่อฟิลด์ API + ตัวอย่างคำสั่งบันทึก** ให้บอย 1 ชุด · 5) เวลาไทย + hash

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `feat(db): bowl shape / overflow hole as editable columns`
  - `qa/report-chai-round19-db-columns-20261011.md` (ในรีโป)
  - สรุป 5 บรรทัด + **ชื่อคอลัมน์/ฟิลด์ที่บอยต้องใช้** · ลำดับ deploy

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
| 9 | ไม่เดาข้อมูล (เห็นไม่ชัด = null) | ระบุ 'ภาพไม่ชัด' แทนการเดา |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

> [เดวิด → ชัย]
> บอส **อนุมัติ** ให้ย้ายค่าเป็นคอลัมน์ DB เพื่อให้ **บอสแก้เองผ่านแอดมิน** ไม่ต้องออกใบทุกครั้ง
> · **ห้ามรัน migration กับ production เอง** — ทำเป็น PR แล้วให้ทีม deploy · **ค่าที่ลูกค้าเห็นก่อน/หลังต้องเท่ากัน**
> · แจ้ง **ชื่อคอลัมน์ + ฟิลด์ API + คำสั่งบันทึก** ให้บอย 1 ชุด (บอยทำใบ 446-B ต่อ)
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-445-chai-db-columns.md`
