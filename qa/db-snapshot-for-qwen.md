# ข้อมูลฐานข้อมูลสำหรับใบงาน 275-Q (เดวิดดึงให้ · 6 ต.ค. 69)

> ไฟล์นี้ทำมาเพื่อให้ Qwen เทียบ 3 แหล่งได้ครบ · **เดวิดดึงจากฐานข้อมูลจริงแบบอ่านอย่างเดียว (read-only) ไม่มีการแก้ข้อมูล**
> ถ้าต้องการข้อมูลเพิ่ม บอกได้เลย — **ห้ามเดาค่า** (ตรงตามกฎ “ห้ามกุตัวเลข”)

## 0 · วิธีเอารีโปไปใช้ (ไม่ต้องใช้ GitHub token — รีโปเป็นสาธารณะ)
```bash
git clone https://github.com/Knightfurnich/KnightBasins-Source.git
cd KnightBasins-Source
git checkout main          # หรือ branch ของใบงาน
```
ยืนยันว่ารีโปสาธารณะ: `curl -s https://api.github.com/repos/Knightfurnich/KnightBasins-Source | grep '"private": false'` → ได้ `false` ✅
ไฟล์ที่ต้องใช้อ่านจะอยู่ครบหลัง clone: `CLAUDE.md` · `knight-design-kb/TEAM.md`* · `qa/job-274-replit-price-guide-page.md` · `qa/job-275-qwen-onboarding-audit.md` · `artifacts/knight-basins/src/data/catalog.ts` · `bin/job_standard_check.py`
(*TEAM.md อยู่ใน KB ฝั่งเดวิด ไม่ได้อยู่ในรีโป — แนบข้อความสำคัญมาให้ในหัวข้อ 5)

## 1 · sheet_stone_prices (แผ่นดิบ) — ทั้ง 73 แถว
รูปแบบ: `code|name|base|10+|50+|active`

```
=== sheet_stone_prices: ทั้งหมด (code|name|base|10+|50+|active) ===
AL645|Aspen Lily|9000|8800|8550|true
AP100|Apex|8000|7800|7600|true
AS610|Aspen Snow|9000|8800|8550|true
BL461|Bold Lines|9500|9300|9025|false
BR816O|Black River|9500|9300|9025|true
BT010|Basalt Terrazzo|8000|7800|7600|true
BW010|Bright White|5900|5900|5900|true
CO521M|Cloud Onyx|9500|9300|9025|true
CS532M|Cascade Slope|9500|9300|9025|true
CT970|Chess Terrazzo|8000|7800|7600|false
CT981|Clay Terrazzo|8000|7800|7600|false
CW013|Camellia White|7000|6800|6650|true
DU121|Duese|7000|6800|6650|true
E085|Everest|8000|7800|7600|true
EG501|Glaring White|9000|8800|8550|true
EG595|Metallic Galaxy|9500|9300|9025|true
GC714|Glalet Crystals|8000|7800|7600|true
GE118|Glalet Ebony|8000|7800|7600|true
GG884|Glalet Grey|8000|7800|7600|true
GG884(N)|Glalet Grey (N)|8000|7800|7600|false
GI017|Glalet Ice|8000|7800|7600|true
GT010|Grigio Terrazzo|8000|7800|7600|true
HJ524M|Honey Jade|9500|9300|9025|true
JG532M|Jade Golddust|9500|9300|9025|true
KZ802|Zen Autumn|9500|9300|9025|true
KZ802N|Zen Autumn New|9500|9300|9025|true
MB025|Mist Beech|8000|7800|7600|true
MC016|Mist Concrete|8000|7800|7600|true
ME642|Mist Egg|8000|7800|7600|true
MM541|Metallic Marble|9500|9300|9025|true
MS112|Mahogany Stone|9500|9300|9025|true
MU010|Evermoin Ultra Bright|7500|7300|7125|true
NA160|Navis|8000|7800|7600|true
NB091F|Neo Black Facade|7000|6800|6650|true
NT970|Bologna Terrazzo|9000|8800|8550|true
NW013|Neo White|4900|4900|4900|true
OM391|Ocean Marble|9500|9300|9025|false
PS820|Pebble Saratoga|9500|9300|9025|true
PT857|Pebble Terrain|9500|9300|9025|true
QS822N|Quarry Starred|8500|8300|8025|true
RC469|Rock Cliffs|12000|11800|11400|false
RW316|River White|9500|9300|9025|true
SC457|Sanded Chestnut|9000|8800|8550|true
SG420|Sanded Grey|9000|8800|8550|true
SH428|Sanded Heron|9000|8800|8550|true
SI414|Sanded Icicle|9000|8800|8550|true
SL531|Sandy Lines|9500|9300|9025|false
SO423|Sanded Onyx|9000|8800|8550|true
SS440|Sanded Sahara|9000|8800|8550|true
SV430|Sanded Vermillion|9000|8800|8550|true
SW534M|Starry White|9500|9300|9025|true
V342|Whisper|12000|11800|11400|false
VA311|Arctic White|12000|11800|11400|true
VC110|Cotton White|12000|11800|11400|true
VD175|Dandelion|12000|11800|11400|true
VD345|Dusk|12000|11800|11400|true
VD382|Drift|12000|11800|11400|true
VF113|Flux|12000|11800|11400|true
VF345|Flat White|12000|11800|11400|true
VL312|Premiere Largo|12000|11800|11400|true
VL343|Latte Cream|12000|11800|11400|true
VM114|Morning Sky|12000|11800|11400|true
VO171|Ocean View|12000|11800|11400|true
VR322|Rotor Cloud|12000|11800|11400|true
VS311|Shine|12000|11800|11400|true
VS351|Soft|12000|11800|11400|true
VS385|Slate|12000|11800|11400|true
VV351|Veil|12000|11800|11400|true
VV375|Vivace|12000|11800|11400|true
VW050|Vene White|9500|9300|9025|true
VW213|Vena White|9500|9300|9025|true
WH112|Witch Hazel|9500|9300|9025|true
WW001|Wave White|9500|9300|9025|false
```

## 2 · installed_stone_prices (งานพร้อมติดตั้ง) — ทั้ง 72 แถว
รูปแบบ: `code|name|ราคา/ตร.ม.|active`

```
=== installed_stone_prices: ทั้งหมด (code|name|sqm|active) ===
AA625|Aspen Alder|8500|true
AI612|Aspen Iceberg|8500|true
AL645|Aspen Lily|8500|true
AP100|Apex|8500|true
AS610|Aspen Snow|8500|true
BL461|Bold Lines|9500|false
BR816O|Black River|9500|true
BT010|Basalt Terrazzo|8500|true
BW010|Bright White|7500|true
CO521M|Cloud Onyx|9500|true
CS532M|Cascade Slope|9500|true
CW013|Camellia White|7500|true
DU121|Duese|8500|true
E085|Everest|8500|true
EG501|Glaring White|8500|true
EG595|Metallic Galaxy|8500|true
GC714|Glalet Crystals|8500|true
GE118|Glalet Ebony|8500|true
GG884|Glalet Grey|8500|true
GI017|Glalet Ice|8500|true
GT010|Grigio Terrazzo|8500|true
HJ524M|Honey Jade|9500|true
JG532M|Jade Golddust|9500|true
KZ695|Zen Grey|8500|false
KZ802|Zen Autumn|9500|true
KZ802N|Zen Autumn New|9500|true
MB025|Mist Beech|8500|true
MC016|Mist Concrete|8500|true
ME642|Mist Egg|8500|true
MS112|Mahogany Stone|9500|true
MU010|Evermoin Ultra Bright|7500|true
NA160|Navis|8500|true
NB091|Neo Black|8500|true
NT970|Bologna Terrazzo|8500|true
NW013|Neo White|7500|true
PS820|Pebble Saratoga|8500|true
PT857|Pebble Terrain|8500|true
QS822N|Quarry Starred|8500|false
RC469|Rock Cliffs|9500|false
RW316|River White|9500|true
SC457|Sanded Chestnut|8500|true
SG420|Sanded Grey|8500|true
SH428|Sanded Heron|8500|true
SI414|Sanded Icicle|8500|true
SL531|Sandy Lines|9500|false
SO423|Sanded Onyx|8500|true
SS440|Sanded Sahara|8500|true
SV430|Sanded Vermillion|8500|true
SW534M|Starry White|9500|true
V342|Whisper|9500|false
VA311|Arctic White|9500|true
VC110|Cotton White|9500|true
VD126|Dawn|9500|false
VD345|Dusk|9500|true
VD382|Drift|9500|true
VF113|Flux|9500|true
VF345|Flat White|9500|true
VL155|Loam|9500|false
VL312|Premiere Largo|9500|true
VL343|Latte Cream|9500|true
VM114|Morning Sky|9500|true
VO171|Ocean View|9500|true
VR322|Rotor Cloud|9500|true
VS311|Shine|9500|true
VS351|Soft|9500|true
VS385|Slate|9500|true
VV351|Veil|9500|true
VV375|Vivace|9500|true
VW050|Vene White|9500|true
VW213|Vena White|9500|true
VW342|Aria Whisper|12000|true
WH112|Witch Hazel|9500|true
```

## 3 · ตัวเลขที่นับได้จากฐานข้อมูล (ใช้เทียบกับที่คุณนับจากเว็บ)
```
sheet_stone_prices     : total 73 · active 64 · base_price ไม่ว่าง 73 (100%)
installed_stone_prices : total 72 · active 64
ชื่อซ้ำ (name ซ้ำในตารางเดียว) : 0 ทั้งสองตาราง  ← ไม่มีชื่อซ้ำในฐานข้อมูล
```
**เทียบกับที่คุณวัดจากเว็บ:** การ์ด 79 · มีราคาแผ่น 73 · QS288 = 0 ⇒ ตรงกันทั้ง 3 ตัว ✅
(79 − 73 = **6 รหัสที่เป็น “งานพร้อมติดตั้งเท่านั้น”** คือ `NB091 KZ695 AI612 AA625 VL155 VD126` —
รหัสเหล่านี้ **ไม่มีแถวใน `sheet_stone_prices` เลย** จึงไม่ใช่ “ราคาหาย” แต่คือ **ไม่มีราคาแผ่นโดยธรรมชาติ** ⇒ การ์ดโชว์ “—” = ถูกต้อง)

## 4 · ตอบคำถาม 5 ข้อของคุณ
1. **6 รหัส (NB091 KZ695 AI612 AA625 VL155 VD126) — สถานะใน DB**
   ไม่มีใน `sheet_stone_prices` (จึงไม่มีราคาแผ่น) · มีใน `installed_stone_prices` ทุกตัว: AA625 8,500(active) · AI612 8,500(active) · NB091 8,500(active) · KZ695 8,500(**inactive**) · VD126 9,500(**inactive**) · VL155 9,500(**inactive**)
2. **price tier ของ QS822N ใน DB ตอนนี้:** `base 8,500 · 10+ 8,300 · 50+ 8,025` ← **50+ ผิด** ต้องเป็น **8,075** (บอสยืนยัน) · เกณฑ์ที่มีผลกับเกือบทุกแถว: **1–9 = base · 10–49 = base−200 · 50+ = base×0.95** (ตรวจทุกแถวแล้ว: 9500→9300/9025 · 9000→8800/8550 · 12000→11800/11400 · 8000→7800/7600 ✅)
   **ข้อยกเว้น 2 แถว:** `NW013` 4,900 → 4,900/4,900 และ `BW010` 5,900 → 5,900/5,900 (ราคาแบน ไม่มีส่วนลดตามจำนวน)
3. **ชื่อซ้ำใน DB:** 0 (ไม่มี) — คู่ที่คุณเจอบนเว็บ (`GG884/GG884(N)` · `KZ802/KZ802N` · `VW213/VW050`) เป็น **คนละรหัสจริง ไม่ใช่รหัสซ้ำ** ⇒ **ไม่ต้องยุบรวม** (กฎ: รหัสสี = ตัวตนของสี)
4. **QS822N/QS288 — ถูกลบหรือแค่ปิด?**
   • `sheet_stone_prices`: **ไม่เหลือ QS288 แล้ว** (ทั้งรหัสและ alias) — แถวเดิมถูก **เปลี่ยนรหัสเป็น QS822N** (ไม่ใช่ลบ) · active=true · aliases = `{"QS 822 N","QS822 N","QS 822N"}`
   • `installed_stone_prices`: มีแถว QS822N · **active=false** · ⚠️ aliases ยังมี **`QS288` และ `QS 288` ติดอยู่** = ข้อมูลค้างที่ต้องลบออก
5. **จำนวนสีที่ sheet_price ไม่ว่าง = 73 ✅** ตรงกับที่คุณนับจากเว็บ
   · **ราคาต่อแผ่นทุกรหัส** = ดูตารางหัวข้อ 1 (เอาไว้ทำ 3-way diff ได้เลย)

## 5 · เรื่องที่ยังค้างอยู่ฝั่งฐานข้อมูล (เดวิดขออนุมัติบอสอยู่ — อย่าแก้เอง)
1. `installed_stone_prices` → **QS822N ต้องเปิด active** (ตอนนี้ false)
2. `sheet_stone_prices` → QS822N **50+ 8,025 → 8,075**
3. `installed_stone_prices` → **ลบ alias `QS288` / `QS 288`** ออกจากแถว QS822N (สีนี้ไม่มีแล้ว)
4. (รอตรวจ) แถวที่ **ราคาแบนทั้ง 3 ชั้น** มี 2 แถว (`NW013` Neo White 4,900 · `BW010` Bright White 5,900) — ยังไม่ยืนยันว่าเป็นเจตนาหรือข้อมูลตกหล่น ⇒ เสนอให้บอสยืนยัน

## 6 · กฎ TEAM.md ที่คุณต้องรู้ (สรุปจากไฟล์จริง)
• รับใบงานจากเดวิดเท่านั้น · ทำตาม SCOPE เป๊ะ · เริ่มจากงานตรวจสอบ/ทดสอบ/เอกสาร จนกว่าบอสจะกำหนดเส้นทางโค้ด
• **ห้าม** แตะ production/DB/docker · อ่านหรือพิมพ์ `.env`/คีย์ · เดาตัวเลขธุรกิจ · แก้ `src/index.css` · แก้ไฟล์เดียวกับรีพีต/ชัยพร้อมกัน · **push เข้า main**
• ส่งงานตอนนี้: **ทำบนเครื่องบอสแล้วส่งรายงานกลับ** (ยังไม่เชื่อม GitHub) → เดวิด commit + เปิด PR ให้
• หลักฐานทุกครั้ง: คำสั่งที่รัน + ผลจริง + ตัวเลข/บรรทัดอ้างอิง — **ห้ามคำรับรองลอย ๆ**
