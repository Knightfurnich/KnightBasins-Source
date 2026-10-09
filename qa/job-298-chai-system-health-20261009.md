# ใบงาน 298-C (ชัย) — **ตรวจสุขภาพระบบ Knight Basins ทั้งหมด** (จากภายนอก · หลังการเปลี่ยนวันที่ 9 ต.ค. 69)

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** วันนี้มีการเปลี่ยนหลายอย่างในระบบ (เปลี่ยนชื่อโฮสต์ API · ถอดชื่อเดิม · ย้ายข้อมูล DB 205 แถว · หยุด container 2 ตัว) ⇒ บอสสั่งให้ตรวจว่า **ระบบทั้งหมดยังทำงานปกติไหม**
**กติกา:** **read-only 100%** (GET/HEAD เท่านั้น) · ทุกข้อต้องมีคำสั่ง + ผลรันดิบ · ข้อที่เข้าไม่ถึง = เขียน **"ตรวจไม่ได้ + เหตุผล"** · ห้าม POST ไป production

## ⚠️ อ่านก่อน: สถานะที่ "ตั้งใจให้เป็นแบบนี้" (อย่ารายงานเป็นปัญหา)
| สิ่งที่เห็น | เป็นเพราะ | ถือว่า |
|---|---|---|
| `api.srv1964473.hstgr.cloud` → **404** | ถอดชื่อเดิมออกจาก router วันนี้ (บอสสั่ง) | ✅ ปกติ |
| `knightbasins.srv1964473…` / `line.srv…` → 404 หรือ TLS error | โฮสต์เก่าถูกปลดระวาง | ✅ ปกติ |
| `app.srv1964473…` → ไม่ตอบ | เลิกใช้แล้ว (บอสยืนยัน) | ✅ ปกติ |
| `api.knightbasins.com/kb/admin/` → **502** | บอสหยุด container `knight-images-admin` โดยเจตนา (หน้าจัดการรูปของทีมงาน) | ✅ ปกติ |
| `n8n.srv1964473…` → 404 | หยุด container n8n โดยเจตนา | ✅ ปกติ |
| `api.knightbasins.com/v1/models` → **401** | ต้องใช้คีย์ (ไม่ได้ใส่ = ถูกต้อง) | ✅ ปกติ |
| `www.knightbasins.com` → **301** ไป apex | นโยบายโดเมนเดียว | ✅ ปกติ |

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **หน้าเว็บทั้งหมด** — ยิงทั้ง 12 URL ใน sitemap + หน้าที่ลูกค้าใช้บ่อย ต้องได้ **200** ทุกเส้น:
       `/` `/portfolio` `/stone` `/price-guide` `/site-prep` `/studio-guide` `/quote` `/studio` `/sketch` `/readme` `/updates` `/network`
       + `/sitemap.xml` `/robots.txt` `/llms.txt` `/llms-full.txt` → 200
     และตรวจว่าเนื้อหาจริงไม่ใช่หน้าว่าง: ในหน้าแรกต้องมีชื่อร้าน + เบอร์โทรที่ถูกต้อง (`094-496-1949` เป็นเบอร์หลัก) และหน้า `/stone` ต้องมีรายการสินค้า
  B. **API สาธารณะ** — `GET /api/healthz` (200) · `GET /api/catalog` (200) · `GET /api/portfolio` (200) · `GET /api/portfolio/featured` (200) · `GET /api/site-photos/showcase` (200)
     ตรวจ **เนื้อใน payload `/api/catalog`**: ต้องมี `sheetStones` = **64** · `installedStones` = **65** · `basins` = **30** · จำนวน URL รูปทั้งหมด (นับเอง) · โฮสต์ใน URL ต้องเป็น **`knightbasins.com` เท่านั้น** (ห้ามมี `srv1964473` และห้ามมี `api.knightbasins.com`)
  C. **ไฟล์สื่อ/รูป** — ยิงรูปจริงต้องได้ 200 + content-type ถูกต้อง (อย่างน้อย 5 ไฟล์ ต่างชนิดกัน):
       `/kb/images/slab/<รหัส>.png` · `/kb/images/basin/KF023.jpg` · `/kb/images/swatch/SG420.png` · ไฟล์วิดีโอถ้ามี (`/kb/images/basin-videos/...`)
       + ไฟล์แอปที่หน้าเว็บโหลด (`/assets/index-*.js`, `/assets/index-*.css` — หา hash จาก HTML หน้าแรก)
  D. **ที่อยู่/ใบรับรอง (TLS + DNS)** — 4 ชื่อที่ใช้งาน: `knightbasins.com` · `www.knightbasins.com` · `line.knightbasins.com` · `api.knightbasins.com`
       ต้องได้: ใบรับรอง valid (ไม่ใช่ใบ default ของ Traefik) · SAN ไม่มี `srv1964473` · ระบุวันหมดอายุ · DNS ชี้ `72.62.79.84`
  E. **LINE (ไม่ต้อง POST)** — `GET https://line.knightbasins.com/line/webhook` → **405** (มี route รับเฉพาะ POST) · `GET https://knightbasins.com/api/auth/line/login` → **302** ไปหน้า LINE
  F. **ระบบที่ถอด/หยุดแล้ว ต้องไม่รับงานจริง** — ยืนยันด้วย GET: `api.srv1964473…/health` → ไม่ใช่ 200 · `knightbasins.srv1964473…/` → ไม่ใช่ 200 · `line.srv1964473…/line/webhook` → ไม่ใช่ 200
     (ถ้าตัวใดตอบ 200 = **ต้องแจ้งทันที** เพราะหมายถึงโฮสต์เก่ากลับมาให้บริการ)

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-chai-system-health-20261009.md        (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-298-chai-system-health-20261009.md        อ่านเท่านั้น
  - /opt/data/cache/kbsrc/deploy/hostinger/README.md                       อ่านเท่านั้น (ตาราง public hostnames)
  - /opt/data/cache/kbsrc/KANBAN.md                                        อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแก้ไฟล์/DB/container/config ใด ๆ · ห้าม restart/recreate · **ห้าม POST** ไป production (รวม /line/webhook และ /v1/*)
  - ห้าม merge/แก้ PR ของเดวิด · ห้าม push ตรงเข้า `main` · ห้ามพิมพ์ค่าลับ/คีย์ (ใบนี้ไม่ต้องใช้คีย์)
  - ห้ามสรุปว่า "ปกติ" จากคำอธิบายของเดวิด — ต้องมีคำสั่ง + ผลที่รันเอง (หรือระบุ "ตรวจไม่ได้")

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) ตาราง HTTP ของ 16 URL ในข้อ A พร้อม `content_type` + ขนาด (`curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}'`)
  2) ผลยิง API 5 เส้น + ตัวเลขใน payload (64/65/30 · จำนวน URL รูป · รายชื่อโฮสต์ที่พบ)
  3) ตารางรูป/ไฟล์แอป 5–8 ไฟล์ (code + content-type + ขนาด)
  4) `openssl s_client` ทั้ง 4 ชื่อ (subject/SAN/notAfter) + ผล DNS (`getent hosts` หรือ `dig +short`) — ระบุว่าชี้ `72.62.79.84`
  5) ผล 2 เส้นของ LINE + ผลยิง 3 โฮสต์ที่ถอดแล้ว (ข้อ F)
  6) สรุป: ผ่าน/ไม่ผ่าน/ตรวจไม่ได้ ทีละข้อ + ข้อที่พบว่า "ผิดปกติจริง" (ถ้ามี) พร้อมหลักฐาน
  7) commit SHA ของสาขารายงาน (`git log -1 --format=%H`) + เวลาไทยที่ตรวจ · baseline: 200 ×16 · 64/65/30 · โฮสต์เดียว · cert valid

OUTPUT:
  - `qa/report-chai-system-health-20261009.md` — ตาราง A–F + หลักฐานดิบ
  - สรุป 5 บรรทัด: อะไรยืนยันว่าใช้งานได้ · อะไรน่าสงสัย/ผิดปกติ · ตรวจไม่ได้อะไรเพราะเหตุใด · ข้อเสนอ · ความเสี่ยงคงเหลือ
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานสั้นในแชท

STOP:
  - เมื่อครบ A–F และมีผลดิบครบ · หรือทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
  - **พบปัญหาที่กระทบลูกค้า → รายงานเดวิด/บอสทันที** (ไม่ต้องรอจบใบ)
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | 12 หน้าตาม sitemap + 4 ไฟล์ข้อความ | 200 ทุกเส้น |
| 2 | เนื้อหาหน้าแรก | มีชื่อร้าน + เบอร์หลัก 094-496-1949 |
| 3 | API 5 เส้น | 200 |
| 4 | แคตตาล็อก: sheetStones/installedStones/basins | 64 / 65 / 30 |
| 5 | โฮสต์ใน URL ของ payload | knightbasins.com เท่านั้น (0 จุด legacy · 0 จุด api.) |
| 6 | รูป/ไฟล์แอป | 200 + content-type ถูก |
| 7 | cert 4 ชื่อ | valid · SAN ไม่มี srv1964473 · ระบุวันหมดอายุ |
| 8 | DNS 4 ชื่อ | ชี้ 72.62.79.84 |
| 9 | LINE webhook (GET) | 405 |
| 10 | LINE login | 302 |
| 11 | โฮสต์ที่ถอดแล้ว 3 ตัว | ไม่ใช่ 200 |
| 12 | สรุปความเสี่ยง + ข้อเสนอ | มีชัดเจน |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → ชัย] ใบ 298-C ครับ — บอสสั่งให้ตรวจสุขภาพระบบ Knight Basins ทั้งหมด หลังการเปลี่ยนวันนี้
สิ่งที่เปลี่ยนวันนี้: เปลี่ยนชื่อโฮสต์ API (api.srv1964473 → api.knightbasins.com) · ถอดชื่อเดิมออกจาก router + cert ออกใหม่ SAN เหลือชื่อเดียว · ย้ายข้อมูล DB 205 แถวเป็นโดเมนหลัก · บอสหยุด container 2 ตัว (knight-images-admin · n8n) · เพิ่ม healthcheck
อ่าน baseline ในใบก่อนนะครับ (มีตาราง "สถานะที่ตั้งใจให้เป็นแบบนี้" เช่น api.srv = 404 · /kb/admin/ = 502 · n8n = 404 · /v1/models = 401 — พวกนี้ปกติ ไม่ใช่ปัญหา)
ให้ตรวจเอง (read-only 100% · GET/HEAD): A 12 หน้า sitemap + 4 ไฟล์ข้อความ = 200 · B API 5 เส้น + payload 64/65/30 + URL รูปต้องเป็น knightbasins.com เท่านั้น · C รูป/ไฟล์แอป 200 + content-type · D cert 4 ชื่อ (SAN ไม่มีชื่อเก่า) + DNS · E LINE (webhook 405 · login 302) · F โฮสต์ที่ถอดแล้วต้องไม่ตอบ 200
ห้าม: แก้ไฟล์/DB/container · restart/recreate · POST ไป production · merge PR เดวิด · พิมพ์คีย์
ผลลัพธ์: qa/report-chai-system-health-20261009.md + PR (docs) + ระบุ ผ่าน/ไม่ผ่าน/ตรวจไม่ได้ ทีละข้อ · STOP 12 turns
```
