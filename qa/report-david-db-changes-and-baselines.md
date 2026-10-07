# รายงานหลักฐาน: การแก้ฐานข้อมูล + ฐานเทสต์ (ตอบข้อทักท้วงของชัย ใบ 280)

**จาก:** เดวิด · **วันที่:** 7 ต.ค. 69 · **ตอบ:** ใบ 280-C (PR #383) — 6 ข้อ
**หลักการ:** ทุกบรรทัดข้างล่างนี้คือคำสั่ง/ค่าที่รันจริงและวัดจริง — ไม่มีคำรับรองลอย ๆ

---

## ข้อ 1 — “ใบ 278 ยังไม่ merge → QS288 ถูกคิดราคา BW010”

**ถูกต้อง ณ เวลาที่ชัยตรวจ** (ตอนนั้นยังไม่ merge) — **แก้แล้ว** ✅ ใบ 278 + 276 + 277 + 279 รวมเข้า main ที่ PR #384 (`796358c`) และ deploy สำเร็จ
**หลักฐานปัจจุบัน (รันบน main):**

```
"QS288"   | find = undefined | แผ่น = null | ติดตั้ง = null
"QS 288"  | find = undefined | แผ่น = null | ติดตั้ง = null
"V342"    | find = undefined | แผ่น = null | ติดตั้ง = null   ← สีที่ถูกปิด
"VW342"   | find = VW342      | แผ่น = null | ติดตั้ง = 12000
"ZZZ999"  | find = undefined | แผ่น = null | ติดตั้ง = null   ← รหัสที่ไม่รู้จัก = null (ไม่ใช่ 5,900/7,500 ของ BW010)
```

---

## ข้อ 2 — “DB แก้ก่อนโค้ด → /stone ยังโชว์สีซ่อน 12 รหัส · llms-full.txt ผิด 6 จุด”

**ถูกต้อง ณ เวลานั้น** และเป็นบทเรียนเรื่องลำดับงาน: การแก้ DB กับการแก้โค้ดควรไปรอบเดียวกัน **แก้แล้ว** ✅
**หลักฐานสด (ดึง HTML ที่ prerender ให้ Googlebot):**

```
/stone (UA Googlebot) http=200 · size=96,907
สีที่ถูกซ่อนหลุดใน HTML: ไม่มี (ตรวจ 12 รหัส: BL461 CT970 CT981 GG884(N) KZ695 OM391 RC469 SL531 V342 VD126 VL155 WW001)
VW342 = 2 ครั้ง · QS822N = 2 ครั้ง · QS288 = 0 ครั้ง
การ์ดสีบนหน้าเว็บ = 68 (ตรงกับ visible ในฐานข้อมูล)

llms-full.txt (สด): Wene White = 0 · Honer Jade = 0 · Sanded Icice = 0 · NA016 = 0 · CS522M = 0 · WR322 = 0
```

---

## ข้อ 3 — “KF024: ซ่อน/ถอดจาก KB เกินคำบอส”

**ถูกต้อง — ผมอ่านกฎกว้างเกินไป** ผมตีความว่า “สีถูกปิด ⇒ อ่างของสีนั้นไม่ขาย” แล้วถอด `KF024` ออกจาก KB และให้ใบ 279 ซ่อนจาก picker
**บอสชี้ขาด 7 ต.ค. 69:** “ให้เดวิดแก้ให้เลย” ⇒ **อ่างรุ่นนี้ไม่เคยถูกซ่อน ⇒ ขายได้** — แก้ให้แล้วทั้ง 3 ชั้น:

| ชั้น | ก่อน | หลัง |
|---|---|---|
| `basin_prices` (DB) | KF024 · V342 · Whisper · 25,000 · active | **KF024 · VW342 · Aria Whisper · 25,000 · active** ✅ |
| `catalog.ts` (แอป) | `["KF024","V342","Whisper",25000,…]` | **`["KF024","VW342","Aria Whisper",25000,…]`** ✅ |
| KB (3 ไฟล์) | ถอด KF024 ออก (29 รุ่น) | **คืน KF024 → 30 รุ่น · VW342 (Aria Whisper) · 25,000** ✅ |

กลไก “อ่างที่สีถูกปิดต้องไม่ถูกขาย” **ยังอยู่และยังถูกทดสอบ** แต่ทดสอบด้วยข้อมูลสมมติ (ตอนนี้ไม่มีอ่างจริงรุ่นใดอ้างสีที่ถูกปิด — ตรวจแล้ว = 0 ✅)
**หมายเหตุที่ต้องให้บอสยืนยัน:** ราคา KF024 คงไว้ **25,000** (ราคาเดิมในฐานข้อมูล) แม้สีจะเปลี่ยนจาก Whisper (9,500/ตร.ม.) เป็น Aria Whisper (12,000/ตร.ม.) — ถ้าต้องคิดราคาใหม่ บอกได้ครับ

---

## ข้อ 4 — “ขอ UPDATE ที่รันจริง + ผลก่อน/หลัง”

**คำสั่งที่รันจริงทั้งหมด (11 จุด · ผ่านการอนุมัติ/คำสั่งของบอสทุกจุด)**

```sql
-- รอบที่ 1 (บอสอนุมัติ 7 ต.ค. 69) — QS822N
UPDATE installed_stone_prices SET active = true WHERE code='QS822N';
UPDATE sheet_stone_prices SET price_50_plus_thb = 8075 WHERE code='QS822N';
UPDATE installed_stone_prices SET aliases = array_remove(array_remove(aliases,'QS288'),'QS 288') WHERE code='QS822N';

-- รอบที่ 1 — อ่าง 6 จุด (ชื่อยึดแคตตาล็อก + รหัสสีที่ไม่มีจริง)
UPDATE basin_prices SET color_name = s.name FROM installed_stone_prices s
  WHERE basin_prices.color_code = s.code AND basin_prices.sku IN ('KF004','KF005','KF008');
UPDATE basin_prices SET color_code='NA160'  WHERE sku='KF010';
UPDATE basin_prices SET color_code='CS532M' WHERE sku='KF012';
UPDATE basin_prices SET color_code='VR322'  WHERE sku='KF013';

-- รอบที่ 2 (บอสสั่ง “ให้เดวิดแก้ให้เลย” 7 ต.ค. 69) — KF024 + นามแฝงตารางแผ่น
UPDATE basin_prices SET color_code='VW342',
  color_name=(SELECT name FROM installed_stone_prices WHERE code='VW342') WHERE sku='KF024';
UPDATE sheet_stone_prices SET aliases = ARRAY['V342','V 342']::text[] WHERE code='V342';
```

**ผลก่อน/หลัง (วัดจากคำสั่ง SELECT ทุกครั้ง · UPDATE ละ 1 แถวทุกครั้ง)**

| เป้าหมาย | ก่อน | หลัง |
|---|---|---|
| `installed_stone_prices` QS822N | 8,500 · active=**FALSE** · alias มี `QS288`, `QS 288` | 8,500 · active=**TRUE** · alias `{QS822 N, QS 822N}` |
| `sheet_stone_prices` QS822N | 50+ = **8,025** | 50+ = **8,075** |
| QS288 ทั้งฐาน (รหัสหรือ alias) | มี (installed 2 alias) | **0** ✅ |
| `basin_prices` KF004 / KF005 / KF008 | `Wene White` / `Honer Jade` / `Sanded Icice` | `Vene White` / `Honey Jade` / `Sanded Icicle` |
| `basin_prices` KF010 / KF012 / KF013 | `NA016` / `CS522M` / `WR322` | `NA160` / `CS532M` / `VR322` |
| `basin_prices` KF024 | `V342` / `Whisper` | `VW342` / `Aria Whisper` |
| `sheet_stone_prices` V342 aliases | `{VW342,"VW 342",V342,"V 342"}` | `{V342,"V 342"}` |
| อ่างที่อ้างสีที่ถูกซ่อน | 1 (KF024) | **0** ✅ |
| ตัวนับรวม | — | สีแผ่น active 64 · สีติดตั้ง active 65 · สีที่ซ่อน 12 · อ่าง 30/30 |

**ไฟล์ย้อนกลับ (rollback) ที่เก็บไว้ทุกชุด**
```
/opt/data/backups/rollback-qs822n-20261007T081418Z.sql
/opt/data/backups/rollback-basin-names-codes-20261007T092705Z.sql
/opt/data/backups/rollback-kf024-and-v342-sheet-alias-20261007T104009Z.sql
knight-design-kb/_pricing.json.bak-kf024-<ts> · _pricing.public.json.bak-kf024-<ts> · _pricing.md.bak-kf024-<ts>
```

---

## ข้อ 5 — “ฐานเทสต์ 1169 ผมวัดได้ 1151 — ขอคำสั่งที่ได้ 1169”

**ชัยวัดถูก และตัวเลขต่างกันเพราะ “วัดคนละ commit” — อธิบายได้ครบ:**

| สถานะที่วัด | จำนวนเทสต์ | หมายเหตุ |
|---|---|---|
| main หลัง PR #372 (ก่อนหน้า /price-guide) | 1144 | เดวิดวัด |
| main หลัง PR #378 (เพิ่มหน้า /price-guide + เทสต์ 7) | **1151** | **= ตัวเลขที่ชัยวัด** ✅ |
| สาขารวมใบ 276+277+278+279 (ก่อน integration) | 1176 | เทสต์ใหม่ 4 ไฟล์ = 2 + 9 + 7 + 7 = **25** ⇒ 1151 + 25 = 1176 ✅ |
| main หลัง integration (KF024 กลับเข้าตาราง + เทสต์ปรับ) | **1176 / pass 1167 / fail 0 / skip 9** | วัดเองบนสาขานี้ 7 ต.ค. 69 |

**คำสั่งที่ใช้จริง (ตัวเลข 1176 มาจากคำสั่งนี้):**

```bash
cd artifacts/knight-basins
files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
CHROME_BIN=$(cat /opt/data/chrome/BINFILE) node --experimental-strip-types --test $files
```

**ตัวเลขจะต่างได้จาก 3 ปัจจัย — ต้องระบุทุกครั้ง:** (1) commit ที่วัด (2) ตัวกรองไฟล์ `! -name '*.browser.test.ts'` (3) การตั้ง `CHROME_BIN` (ถ้าไม่ตั้ง เทสต์ prerender จะถูกข้าม)
**ตัวเลขที่ Qwen รายงาน** (1156/1169) วัดบนสาขาของมันเอง — ต้องอ่านพร้อม commit เสมอ ⇒ ตั้งแต่รอบนี้ผมจะระบุ commit + คำสั่งกำกับทุกตัวเลขในใบงาน

---

## ข้อ 6 — “9/9 คือตรวจรูปแบบ ไม่ใช่เนื้อหา”

**ถูกต้อง** ✅ `bin/job_standard_check.py` เป็น **ตัวตรวจรูปแบบใบงาน** (มี 6 ช่องครบไหม · เช็คลิสต์ 12 ข้อ · STOP เป็นตัวเลข · EVIDENCE มีคำสั่งจริง · มี relay) — **ไม่ได้ตรวจว่าเนื้อหาถูกต้อง**
**สายการตรวจเนื้อหาจริงที่ใช้อยู่:**
1. **รันจริง** — ชุดเทสต์เต็มด้วยคำสั่งข้างบน + tsc + build/prerender (แนบตัวเลขจริง + commit)
2. **ยิงของจริง** — ยืนยันบนเว็บจริง/DB จริง (เช่น 68 สี · QS288 = 0 · KF024 → VW342)
3. **CI กั้น merge** — GitHub Actions ต้องเขียวก่อน merge ทุกครั้ง (เดวิดไม่ merge ก่อน CI เขียว)
4. **ตรวจอิสระ** — แบบใบ 280 (ชัย) · ถ้าบอสต้องการให้ทุกงานมีคนตรวจอิสระ ผมจะตั้งเป็นรอบตรวจประจำ (เช่น ตรวจรวมทุก 1 สัปดาห์) ให้ครับ

---

## สรุปว่าผมรับข้อทักท้วงข้อไหน และแก้อย่างไร

| ข้อ | คำตัดสินของผม | การแก้ |
|---|---|---|
| 1 · 278 ไม่ merge | ถูก (ณ เวลานั้น) | merge แล้วใน PR #384 + หลักฐานสด |
| 2 · ลำดับ DB ก่อนโค้ด | **ถูก · เป็นบทเรียน** | รอบนี้ทำพร้อมกัน (DB + โค้ด + KB) และมีด่าน deploy กั้น |
| 3 · KF024 เกินคำบอส | **ถูก · ผมพลาดเอง** | บอสชี้ขาด → คืน KF024 ทั้ง 3 ชั้น + ย้ายไปสีที่ขายจริง (VW342) |
| 4 · ขอ UPDATE + ก่อน/หลัง | ถูก (ใบงานแนบแต่ SELECT) | แนบครบ 11 จุด + ตารางก่อน/หลัง + ไฟล์ rollback ในรายงานนี้ |
| 5 · ฐานเทสต์ต่างกัน | ถูก · อธิบายได้ | ตารางเทียบ commit + คำสั่งจริง + เหตุผลครบ 3 ปัจจัย |
| 6 · 9/9 = รูปแบบ | **ถูก** | ระบุชัดว่าเป็นตัวตรวจรูปแบบ + บอกสายการตรวจเนื้อหาจริง 4 ชั้น |
