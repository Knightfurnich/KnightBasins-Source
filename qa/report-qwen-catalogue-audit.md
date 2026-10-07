# รายงานตรวจ 275-Q — ความสอดคล้องรหัสสี/ราคา 3 แหล่ง (โค้ด · เว็บจริง · ฐานข้อมูล)

**ผู้ตรวจ:** Qwen · **วันที่ตรวจ:** 7 ต.ค. 69 (GMT+7) · **สถานะ:** ตรวจอย่างเดียว (read-only) — ไม่มีการแก้โค้ด/เทสต์/DB
**รีโปที่ตรวจ:** `Knightfurnich/KnightBasins-Source` @ `main` = `79bb6b5bc81d0bbd0cf52c5ffa3760b2d7a750e4` (clone สาธารณะ ไม่มี token)
**แหล่งที่ 3 (DB):** `qa/db-snapshot-for-qwen.md` (เดวิดดึง read-only 6 ต.ค. 69) · **แหล่งที่ 2 (เว็บ):** `https://knightbasins.com/stone` วัดสด 2026-10-07

> ⚠️ **ส่วน A2 ยังไม่ได้ทำ:** `bin/job_standard_check.py` ไม่อยู่ในรีโปสาธารณะ (อยู่ที่ `/opt/data/bin/` บนเครื่อง Hermes ตาม `docs/team/ONBOARDING-freebuff.md:70`) — เดวิดต้องรันให้เองหลัง commit รายงานนี้ ดูหัวข้อ 5

---

## 1 · สรุปสั้น

* พบ **24 เรื่อง** — สูง **12** · กลาง **8** · ต่ำ **4**
* **ราคาฐานตรงกันครบทั้ง 3 แหล่ง** — ราคาแผ่น `code == web == DB` **73/73 แถว** · ราคาพร้อมติดตั้ง `code == DB` **71/72 แถว** (ส่วนต่าง 0 บาททุกแถว)
* ปัญหาไม่ได้อยู่ที่ตัวเลขราคา แต่อยู่ที่ **สถานะเปิด/ปิดสี** และ **แถวกำพร้าในฐานข้อมูล**
* `catalog.ts` (79 แถว) กับ **บิลด์ที่ deploy จริง** ตรงกัน **0 ส่วนต่าง ทุกฟิลด์** → เว็บไม่ใช่เวอร์ชันเก่า

## 2 · ตัวนับที่วัดได้จริง

| สิ่งนับ | โค้ด `catalog.ts` | เว็บจริง `/stone` | ฐานข้อมูล (snapshot) |
|---|---|---|---|
| จำนวนสี (การ์ด/แถว) | 79 | 79 | sheet 73 · installed 72 · union **79** |
| มีราคาแผ่น | **73** | **73** | **73** |
| มีราคาพร้อมติดตั้ง | 71 | 71 | 72 |
| `active = true` | ไม่มีฟิลด์นี้ | ไม่มีฟิลด์นี้ | sheet **64** · installed **64** |
| `QS288` | 0 | 0 (html 0 · bundle 0) | 0 ใน sheet · **มีค้างใน aliases ของ QS822N** |
| ชื่อซ้ำในตารางเดียว | 0 | 0 | 0 |
| `<loc>` ใน sitemap | 11 (ไฟล์ในรีโป) | 11 (live) | — (ใบ 274 ยังไม่ merge) |

สองแถวสุดท้ายอธิบาย why เว็บมี 79 การ์ดแต่ sheet มี 73 แถว: `NB091 KZ695 AI612 AA625 VL155 VD126` มีเฉพาะตาราง installed จึงไม่มีราคาแผ่นโดยธรรมชาติ (การ์ดขึ้น "—" = ถูกต้อง ไม่ใช่ราคาหาย)

## 3 · ตารางผลตรวจทุกรายการ (24 เรื่อง)

| # | ระดับ | เรื่อง | รหัส | รายละเอียด (วัดได้จริง) | ข้อเสนอ (ยังไม่แก้) |
|---|---|---|---|---|---|
| 1 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `BL461` | sheet active=false · เว็บโชว์ ฿9,500 · ชื่อในโค้ด/เว็บ='Bold Lines' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 2 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `CT970` | sheet active=false · เว็บโชว์ ฿8,000 · ชื่อในโค้ด/เว็บ='Chess Terrazzo' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 3 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `CT981` | sheet active=false · เว็บโชว์ ฿8,000 · ชื่อในโค้ด/เว็บ='Clay Terrazzo' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 4 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `GG884(N)` | sheet active=false · เว็บโชว์ ฿8,000 · ชื่อในโค้ด/เว็บ='Glalet Grey (N)' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 5 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `OM391` | sheet active=false · เว็บโชว์ ฿9,500 · ชื่อในโค้ด/เว็บ='Ocean Marble' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 6 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `RC469` | sheet active=false · เว็บโชว์ ฿12,000 · ชื่อในโค้ด/เว็บ='Rock Cliffs' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 7 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `SL531` | sheet active=false · เว็บโชว์ ฿9,500 · ชื่อในโค้ด/เว็บ='Sandy Lines' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 8 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `V342` | sheet active=false · เว็บโชว์ ฿12,000 · ชื่อในโค้ด/เว็บ='Whisper' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 9 | **สูง** | DB ปิดแต่เว็บยังโชว์ราคาแผ่น | `WW001` | sheet active=false · เว็บโชว์ ฿9,500 · ชื่อในโค้ด/เว็บ='Wave White' | ปิดการ์ดบนเว็บ หรือเปิด active — บอสตัดสิน |
| 10 | **สูง** | alias ชนกับรหัสจริงใน DB | `V342 ← VW342` | catalog.ts ให้ VW342 เป็น documentCode ของ V342 แต่ DB มีแถว VW342 แยกต่างหาก ({'name': 'Aria Whisper', 'sqm': 12000, 'active': True}) | ถอน alias `VW342` ออกจากแถว `V342` แล้วให้ `VW342` เป็นรหัสของมันเอง แล้วตัดสินใจว่าจะเปิดขายแยกหรือไม่ |
| 11 | **สูง** | tier DB ผิดสูตร | `QS822N` | DB base 8500 → 10+ 8300 · 50+ 8025 | ควรเป็น 8300/8075 | แก้ DB ตามสูตร (ต้องขออนุมัติ) |
| 12 | **สูง** | รหัสหาย (DB→โค้ด/เว็บ) | `VW342` | มีใน DB แต่ไม่มีใน catalog.ts และไม่มีบนเว็บ · DB={'name': 'Aria Whisper', 'sqm': 12000, 'active': True} | เพิ่มแถวในแคตตาล็อกหรือยุบรวมเป็น alias พร้อมบันทึกเหตุผล |
| 13 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `BL461` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 14 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `KZ695` | installed active=false · โค้ดให้ราคา 8,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 15 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `QS822N` | installed active=false · โค้ดให้ราคา 8,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 16 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `RC469` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 17 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `SL531` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 18 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `V342` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 19 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `VD126` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 20 | **กลาง** | DB ปิดแต่เว็บขายแบบติดตั้งได้ | `VL155` | installed active=false · โค้ดให้ราคา 9,500/ตร.ม. · การ์ดแสดงบนเว็บ | กรอง active ใน stoneColorsForMode |
| 21 | **ต่ำ** | ชื่อสีในตารางอ่างไม่ตรงแคตตาล็อก | `KF004 / KF005 / KF008` | `Wene White`(463) vs `Vene White`(212) · `Honer Jade`(464) vs `Honey Jade`(209) · `Sanded Icice`(467) vs `Sanded Icicle`(159) — เป็นสะกดที่ต่างกัน (typo) ซึ่งบางส่วนติดไปใน(alias) ของรหัสหลักแล้ว | คงชื่อแคตตาล็อกเป็นมาตรฐาน (บอสสั่งห้ามเปลี่ยนชื่อสี: ใบ 260 ข้อ 4) |
| 22 | **ต่ำ** | อ่างอ้างอิงรหัสสีที่ไม่มีจริง | `KF010 → NA016` | catalog.ts:469 colorCode `NA016` แต่รหัสนาวิสจริงคือ `NA160` (line 221) · findStoneColor("NA016") = NOT FOUND | แก้ colorCode เป็น NA160 — ใบงานใหม่ (ไฟล์ src/data/** ของชัย) |
| 23 | **ต่ำ** | อ่างอ้างอิงรหัสสีที่ไม่มีจริง | `KF012 → CS522M` | catalog.ts:471 `CS522M` ไม่มี · ของจริง `CS532M` (line 208) | แก้เป็น CS532M |
| 24 | **ต่ำ** | อ่างอ้างอิงรหัสสีที่ไม่มีจริง | `KF013 → WR322` | catalog.ts:472 `WR322` ไม่มี · ของจริง `VR322` (line 168) | แก้เป็น VR322 |

## 4 · ตอบ B3 สามจุดเสี่ยง

**(ก) QS822N vs QS288** — ผ่านด้านรหัส ไม่ผ่านด้านราคาชั้น 50+

| สิ่งที่ตรวจ | โค้ด | เว็บ | DB | สรุป |
|---|---|---|---|---|
| เหลือ QS822N รหัสเดียว | `catalog.ts:227` | 1 การ์ด (`button-stone-color-QS822N`) | sheet ✓ · installed ✓ | **ผ่าน** (ไม่มีชื่อ `Quarry Starred` ซ้ำ) |
| QS288 หายไป | 0 | 0 | 0 แถว | **ผ่าน** ในตัวข้อมูล · **ไม่ผ่าน** ที่ aliases ฝั่ง installed ยังมี `QS288`/`QS 288` ค้าง |
| ราคาแผ่น 1–9 = 8,500 | 8,500 | ฿8,500 | base 8,500 | **ผ่าน ตรงกัน 3 แหล่ง** |
| 10+ = 8,300 | 8,300 (สูตร `-200`) | 8,300 (สูตรเดียวกัน in bundle) | 8,300 | **ผ่าน** |
| 50+ = **8,075** | **8,075** (`stoneSheetUnitPrice('QS822N',50)` = 8075) | 8,075 (คำนวณ client-side จากสูตร) | **8,025** | **ไม่ผ่าน — DB ผิด** โค้ด/สูตรถูก |

**(ข) สีชื่อซ้ำต้องมีรหัสเดียว** — ผ่าน: ชื่อไม่ซ้ำเลยทั้ง 3 แหล่ง (โค้ด 79 ชื่อ unique · DB 0 ซ้ำ)
คู่ที่ดูใกล้กันแต่ **คนละสีจริง** ตามกฎ "รหัสสีคือตัวตนของสี" (`KZ802 ≠ KZ802N`): `GG884`/`GG884(N)` · `KZ802`/`KZ802N` · `VW213 Vena White`/`VW050 Vene White` · ไม่ต้องยุบรวม
**แต่** มีเคส alias กลืนรหัสจริง 1 คู่ → ข้อ 10 และ 12 (VW342 `Aria Whisper` เป็น active ใน DB ทว่าถูกรหัส `VW342` ชี้ไปที่ `V342 Whisper` ตามตารางอนุมัติของใบ 260) → สีนี้มีอยู่จริงในระบบราคา แต่ลูกค้าเลือกจากเว็บไม่ได้ และถ้าพิมพ์ `VW342` จะได้ราคา 9,500/ตร.ม. ไม่ใช่ 12,000/ตร.ม. — **ต้องให้เดวิด/บอสตัดสิน**

**(ค) จำนวนสีที่เปิดขายจริง** — ตัวเลข 73 ตรงกันครบ ✅ แต่ **9 สีที่ DB ปิด (`active=false`) ยังโชว์ราคาแผ่นบนเว็บ** (ข้อ 1–9 ในตาราง) → เกณฑ์ "สีที่ปิดต้องไม่โชว์บนเว็บ" **ไม่ผ่าน**
สาเหตุเชิงกลไก: `catalog.ts` ไม่มีฟิลด์สถานะ สีที่แสดงมาจาก `stoneCatalogRows` แบบตายตัว และ `stoneColorsFromCatalog()` (บรรทัด 254–288) **ไม่กรอง active** — เว็บจึงโชว์ทุกอย่างที่โค้ดมี

## 5 · หลักฐาน: คำสั่งที่รันจริง + ผลจริง

```bash
# 0) ยืนยันรีโปสาธารณะ + clone
curl -s https://api.github.com/repos/Knightfurnich/KnightBasins-Source | grep '"private"'
#   "private": false
git clone https://github.com/Knightfurnich/KnightBasins-Source.git   # exit 0 · HEAD 79bb6b5bc81d Merge pull request #374 from Knightfurnich/docs/job-275-qwen

# EVIDENCE 1) นับจากโค้ดจริง
cd artifacts/knight-basins && node --experimental-strip-types -e "import('./src/data/catalog.ts').then(m => { const c = m.STONE_COLORS; console.log('total', c.length); console.log('sheet', c.filter(x=>x.sheetPriceTHB!==null).length); })"
#   total 79
#   sheet 73
#   (+ installed 71, และค่า QS822N ที่ตรวจเพิ่มด้านล่าง)
node ... console.log(c.filter(x=>/QS/.test(x.code)).map(x=>[x.code,x.name,x.sheetPriceTHB,x.installedPriceTHB]))
#   [["QS822N","Quarry Starred",8500,8500]]
node ... console.log(m.stoneSheetUnitPrice('QS822N',1), m.stoneSheetUnitPrice('QS822N',10), m.stoneSheetUnitPrice('QS822N',50))
#   8500 8300 8075

# EVIDENCE 2) เว็บจริง (curl ตรง ไม่ใช้ cache)
curl -s https://knightbasins.com/stone | grep -c 'QS288'     # 0   ✅
curl -s https://knightbasins.com/stone | grep -c 'QS822N'    # 1   ✅ (นับจำนวนบรรทัดที่ตรง — page นี้เป็นบรรทัดเดียว; ถ้านับ number of occurrences = 2)
curl -s -o stone.html https://knightbasins.com/stone          # http=200 size=100556
#   parse data-testid="button-stone-color-*":  cards 79 · unique codes 79 · unique names 79 · priced 73 · no-price 6
#   buckets: 4900:1 5900:1 7000:3 7500:1 8000:15 8500:1 9000:11 9500:21 12000:19 (Σ=73) — ตรงกับชิปตัวนับบนหน้าเว็บทุกหลุม
curl -s -o app.js https://knightbasins.com/assets/index-B2QykOUz.js   # http=200 size=1749655
#   เทียบแถวในบิลด์ที่ deploy จริง vs catalog.ts: 79/79 แถว ตรงกันทุกฟิลด์ (name/sheet/installed/tone/aliases) → 0 ส่วนต่าง
#   หารหัส/ราคาใน bundle: 'QS288' 0 · '8500' มี · '8300'/'8075' 0 → หน้าเว็บคำนวณ 10+/50+ ตอน runtime ไม่ได้ฝังตัวเลข

# EVIDENCE 3) sitemap
curl -s https://knightbasins.com/sitemap.xml | grep -c '<loc>'   # http=200 · 11  (ใบ 274 ยังไม่ merge → ตรงกับกรณีย่อย "11 ถ้ายังไม่ merge")
grep -c '<loc>' artifacts/knight-basins/public/sitemap.xml        # 11 (ในรีโปตรงกับ live)

# EVIDENCE 4) เครื่องมือตรวจมาตรฐานใบงาน — **รันไม่ได้ฝั่ง Qwen**
python3 bin/job_standard_check.py qa/job-275-qwen-onboarding-audit.md
#   python3: can't open file '.../bin/job_standard_check.py': [Errno 2] No such file or directory
ls /opt/data/bin/job_standard_check.py                            # No such file or directory (โฟลเดอร์ /opt/data ไม่มีในแซนด์บ็อกซ์นี้)
# → เป็นไฟล์บนเครื่อง Hermes เท่านั้น (อ้างอิง docs/team/ONBOARDING-freebuff.md:70) · **ต้องให้เดวิดรันแล้วบันทึก 9/9**
#   หมายเหตุ: หัวข้อ 0 ของ qa/db-snapshot-for-qwen.md บอกว่า "ไฟล์ที่ต้องใช้อ่านจะอยู่ครบหลัง clone ... bin/job_standard_check.py"
#   ซึ่งขัดกับ ONBOARDING §2 ที่เขียนว่า `CLAUDE.md`/`knight-design-kb/` "อ่านจากเครื่อง Hermes ไม่ได้ (ไม่ต้องพยายาม)"
#   สิ่งที่วัดได้จริง: ในรีโปไม่มี CLAUDE.md และไม่มี bin/ (git ls-tree -r HEAD | grep -E 'CLAUDE|bin/job_standard' → 0 ผลลัพธ์)

# EVIDENCE 5) ชุดเทสต์เว็บ (รันหลัง pnpm install --ignore-scripts; ไม่แก้ไฟล์ tracked)
cd artifacts/knight-basins && node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
#   1..514
#   # tests 1144
#   # suites 175
#   # pass 1135
#   # fail 0
#   # cancelled 0
#   # skipped 9
#   ตรงกับ baseline ของเดวิด 1144 / 1135 / 0 / 9 ทุกหลัก ✅

# EVIDENCE 6) 3-way diff script (read-only) + ตารางแนบ
python3 diff3.py            # → findings 24 · สูง 12 กลาง 8 ต่ำ 4
node --experimental-strip-types -e "..."   # ตารางอ่าง: colorCode หาย 3 · ชื่อไม่ตรง 3
```

**สถานะไฟล์ในรีโปหลังตรวจ:** `git status --porcelain` (filtered ทิ้ง `??`) → **ว่างเปล่า = 0 diff** ไม่มีการแก้โค้ด/เทสต์/เอกสารของใคร · ไม่มีการ commit/push · ไม่มี `git config` เปลี่ยน

## 6 · เรื่องที่ต้องให้เดวิดดึงจาก DB เพิ่ม (Qwen เข้า DB ไม่ได้ — ห้ามเดา)

1. **แถว `installed_stone_prices` ของ `VW342` (Aria Whisper)** — ยังขายจริงไหม? ถ้าขายต้องเป็นรหัสอิสระในแคตตาล็อก (ตอนนี้ถูก alias ของ `V342` กลืน) ถ้าไม่ขายต้องปิด/ลบ + อัปเดตตารางรหัสพ้องของใบ 260
2. **aliases ของแถว `QS822N` ใน `installed_stone_prices`** — ขอยืนยันว่ายังค้าง `QS288`/`QS 288` อยู่จริง (เดวิดบันทึกไว้ใน snapshot ข้อ 4 แล้ว) และขอสั่งลบตามข้อ 5.3 ของ snapshot
3. **9 รหัสที่ `sheet_stone_prices.active=false`** (`BL461 CT970 CT981 GG884(N) OM391 RC469 SL531 V342 WW001`) — ปิดจริงหรือลืมเปิด? ต้องเลือก: ปิดการ์ดบนเว็บ (แก้โค้ด + ต้องมี field สถานะ) หรือกลับมา active
4. **8 รหัสที่ `installed_stone_prices.active=false` แต่ยังซื้อแบบติดตั้งบนเว็บได้** (`BL461 KZ695 QS822N RC469 SL531 V342 VD126 VL155`) — ยืนยันสิทธิ์ขายงานติดตั้งรายตัว
5. **ราคาแผ่นชั้น 10+/50+ ของทุก 73 รหัส** (snapshot ให้ครบแล้ว — ใช้สรุปว่าถูกสูตร 72/73) — ขอยืนยันว่า `NW013` 4,900/4,900/4,900 และ `BW010` 5,900/5,900/5,900 เป็น **เจตนา**: ฝั่งโค้ด hardcode `promotionExcluded = ["BW010","NW013"]` ที่ `catalog.ts:390` ⇒ **โค้ดกับ DB เจตนารมณ์ตรงกันแล้ว** ข้อนี้ถือว่าปิดได้ถ้าเดวิดยืนยัน
6. **ตาราง `installed_stone_prices` เรต 12,000/ตร.ม.** — มี `VW342` (12,000) ตัวเดียวที่อยู่นอกเรตมาตรฐาน 7,500/8,500/9,500 ของใบ 274 · ยืนยันว่าเป็นเจตนาหรือไม่
7. **`src/data/**` ไม่มีฟิลด์ `active`** — ถ้าจะปิดให้ไม่โชว์จริง ต้องออกแบบใหม่ (ให้ API ส่งเฉพาะสีที่ active ผ่าน `stoneColorsFromCatalog`) → เสนอเป็นใบงานใหม่ให้ชัย เพราะไฟล์นี้เป็นของชัยตาม `docs/team/ONBOARDING-freebuff.md:19-20`

## 7 · ข้อเสนอลำดับความเร่งด่วน (ยังไม่แก้ — รอเดวิดออกใบงาน)

1. **แก้ DB ก่อน (ไม่ต้องแตะโค้ด):** QS822N 50+ 8,025 → **8,075** + ลบ alias `QS288`/`QS 288` + ตัดสิน QS822N installed active — ทั้งหมดอยู่ในหัวข้อ 5 ของ snapshot แล้ว เหลือรอการอนุมัติจากบอส
2. **เคส VW342/Aria Whisper** — เป็น finding ที่มีผลกับใบเสนอราคาจริง (ลูกค้าพิมพ์รหัสแล้วได้ผิดสี/ผิดราคา) และเกี่ยวข้องกับตาราง alias ที่บอสอนุมัติในใบ 260 → ต้องเคลียร์ก่อนอย่างอื่น
3. **สีปิดแต่ยังโชว์ (9+8 รหัส)** — ต้องออกแบบว่า "สถานะสี" จะมาจากไหน (ตอนนี้เว็บตัดสินใจจาก `catalog.ts` ตายตัว = 73 ราคาแผ่น ซึ่ง **ตรงตามที่ใบงาน 275 ข้อ B3(ค) ต้องการ** แต่ไม่ตรงกับ DB) → **อย่าเพิ่มเงื่อนไขกรองเอง** — รอเดวิดออกใบงาน
4. **รหัสอ่างชี้ผิด (`NA016` `CS522M` `WR322`) + ชื่อสะกด 3 จุด** — เล็กแต่กระทบหลักเกณฑ์ของก้อง "รหัสสีมีจริง" → รวมเป็นใบงานเดียวได้
5. **แก้ใบงาน/เอกสาร:** หัวข้อ 0 ของ `qa/db-snapshot-for-qwen.md` อ้างว่า `CLAUDE.md` + `bin/job_standard_check.py` จะอยู่ครบหลัง clone — ในความเป็นจริงไม่อยู่ในรีโปสาธารณะ ทำให้คนถูกสั่ง "รันให้ได้ 9/9" ติดตั้งแต่บรรทัดแรก → เสนอให้เดวิดแก้เป็น "ให้เดวิดยืนยัน 9/9 ให้หลัง commit"

---

### แนบท้าย · ส่วน A1: สรุป 5 กฎห้ามพลาด + 5 คำสั่ง

**กฎที่ห้ามพลาด (อ้างอิงไฟล์ในรีโป — `CLAUDE.md` ตัวจริงอยู่บนเครื่อง Hermes และเอกสารทีมระบุเองว่าห้ามพยายามอ่านจาก repo: `docs/team/ONBOARDING-freebuff.md:40-42`, เนื้อหาที่จำเป็นถูกสรุปไว้ที่ `docs/team/README.md` แล้ว)**

1. **ห้ามรายงานผลที่ยังไม่ได้ตรวจจริง / ห้ามเดาตัวเลข** — `CONTRIBUTING.md:5-14` · `ONBOARDING:53` · `TEAM.md:33-37` · ใบ 275 FORBIDDEN ข้อ 3-4
   → ผมจึงไม่เคลมว่า 9/9 ทั้งที่รันสคริปต์ไม่ได้ และไม่นำตัวเลข tier ที่วัดจากหน้าเว็บไม่ได้มาสรุปเป็นข้อเท็จจริง
2. **หนึ่งใบงาน = หนึ่งสาขา = หนึ่ง PR · ห้าม push ตรง `main` · เดวิด merger** — `docs/team/README.md:1-5` (กฎข้อ 1) · `TEAM.md:20-21` · ONBOARDING:97
3. **ห้ามแตะ production/DB/docker และไฟล์ของคนอื่น** (`src/index.css` แช่แข็ง · `src/data/**` และ `artifacts/api-server/**` เป็นของชัย · ห้ามแก้ไฟล์เดียวกันพร้อมกัน — เช็กทะเบียนท้าย `KANBAN.md`) — `docs/team/README.md:11-16` · ONBOARDING:49
4. **ห้ามอ่าน/พิมพ์ `.env`·คีย์·credential และอย่า dump ไฟล์ production หรือ client bundle ออกมาเป็นข้อความละเอียดอ่อน** — ONBOARDING:50 · `CONTRIBUTING.md:50-54` · ใบ 275 FORBIDDEN
   → ผมไม่เปิด `/api/admin/*` ที่เจอ path จาก bundle สาธารณะ (ทำแค่ GET หน้า/สคริปต์/ซายทแมป) และไม่แตะไฟล์ `.env` ใด ๆ
5. **หลักการราคาและรหัสสี:** รหัสสีคือตัวตนของสี (`KZ802 ≠ KZ802N` — ห้ามใช้กฎเหมารวมแบบ O=0 หรือตัดตัวอักษรท้ายทิ้ง ตามใบ 260) · ราคาห้ามคิดเอง ต้องอ้างอิงสูตรที่อนุมัติแล้ว: `1–9 = base` · `10–49 = base−200` · `50+ = round(base×0.95)` · **ยกเว้น** `BW010`/`NW013` ราคาแบน — ONBOARDING:51 · `catalog.ts:386-394`

**5 คำสั่งที่ใช้จริงในงานนี้**

| # | คำสั่ง | ใช้ทำอะไร |
|---|---|---|
| 1 | `python3 /opt/data/bin/job_standard_check.py qa/job-275-qwen-onboarding-audit.md` | ตรวจมาตรฐานใบงาน → **ติดขัด (ไฟล์อยู่บนเครื่อง Hermes)** |
| 2 | `cd artifacts/knight-basins && node --experimental-strip-types -e "import('./src/data/catalog.ts')..."` | นับ 79/73/71 · ดึงราคา QS822N · คำนวณ tier 1/10/50 = 8500/8300/8075 |
| 3 | `curl -s https://knightbasins.com/stone \| grep -c 'QS288'` และ `'QS822N'` + parse `data-testid="button-stone-color-*"` | วัดเว็บจริงสด: การ์ด 79 · มีราคา 73 · รหัส unique 79 · bucket ต่อชั้นราคา |
| 4 | `curl -s https://knightbasins.com/sitemap.xml \| grep -c '<loc>'` | sitemap = 11 (live = repo) → ใบ 274 ยังไม่ merge |
| 5 | `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' \| sort)` | เทสต์ทั้งชุด = **1144/1135/0/9** ตรง baseline |

*(คำสั่งเสริมที่ใช้ทำ 3-way diff: `git grep -n "QS288"`, `curl -s .../assets/index-B2QykOUz.js`, `python3 /tmp/qwenwork/diff3.py`)*
