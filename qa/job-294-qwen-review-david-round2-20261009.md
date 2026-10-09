# ใบงาน 294-Q (Qwen) — **ตรวจซ้ำรอบ 2 จากภายนอก**: หลักฐาน/ตัวเลข/เอกสาร สอดคล้องกับความจริงไหม

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Qwen** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** รีวิว 292 ของ Qwen ชี้ว่า (ก) ครึ่งหนึ่งของเกณฑ์ตรวจไม่ได้เพราะไฟล์อยู่ในเครื่อง Hermes → เดวิดทำ `qa/runtime-evidence-20261009/` แล้ว · (ข) ตัวเลขที่ไม่มี raw output กำกับ (เคส "22") · (ค) ควรระบุข้อที่ "ตรวจได้จากภายนอก" ให้ชัด ⇒ บอสสั่งตรวจซ้ำ
**กติกา:** ทุกข้อต้องใช้เครื่องมือของตนวัดจริงแล้วแนบผล · ข้อที่เข้าไม่ถึงให้เขียน **"ตรวจไม่ได้ + เหตุผล"** (ห้ามเดาแทน)

## สิ่งที่เปลี่ยนไปหลังรีวิว 292 (ให้ตรวจว่าจริงไหม)
```
1) เพิ่ม qa/runtime-evidence-20261009/ (PR #414 merged) = ผลรันจริง + md5 สคริปต์ + ตาราง cron + ledger + probe โมเดลฟรี
2) บังคับออกใบรับรองใหม่: knightbasins.com/www SAN = com+www เท่านั้น · line.knightbasins.com SAN = line เดียว · ออก 9 ต.ค. 69 · หมดอายุ 7 ม.ค. 70
3) ถอดโฮสต์เก่าออกครบทั้งระบบ: ตัวตรวจ/สคริปต์ Hermes 22 ไฟล์ + VPS 4 ไฟล์ + .env (LINE_PUBLIC_URL) + KB 4 ไฟล์ + cron prompt
4) เพิ่มระบบ /opt/data/state/intentionally-stopped-containers (บอส pause: knight-images-admin · n8n-n8n-1) ให้ watchdog ข้ามการตรวจ
5) บอส pause container 2 ตัว (n8n ไม่เคยมี execution 0 ครั้ง · images-admin ไม่มี route สาธารณะ) เพื่อทดสอบ
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **ตรวจใบรับรองจากภายนอก** (คุณทำได้เอง ไม่ต้องมีสิทธิ์ในเครื่อง):
       เชื่อม 72.62.79.84:443 ด้วย SNI แล้วอ่าน CN/SAN/วันหมดอายุของ `knightbasins.com`, `www.knightbasins.com`, `line.knightbasins.com`
     เกณฑ์: สองโดเมนแรกต้อง **ไม่มี** `srv1964473` ใน SAN · line ต้องมี SAN = `line.knightbasins.com` เดียว · ระบุวันหมดอายุจริง
  B. **ตรวจว่าโฮสต์ที่ถอดแล้วตายจริงและไม่ใช่ 301** (ยิงเอง):
       `/`, `/stone`, `/api/catalog`, `/api/uploads/...` บน `knightbasins.srv1964473.hstgr.cloud` → ต้อง **404** (ไม่ใช่ 200/301)
       และ `line.srv1964473.hstgr.cloud/line/webhook` (GET) → 404 · เทียบกับ `line.knightbasins.com/line/webhook` (GET) → 405
  C. **นับ 0 จุดบนพื้นผิวสาธารณะ** (นับเองทั้งหมด ระบุตัวเลขต่อ URL):
       `llms.txt` · `llms-full.txt` · `sitemap.xml` · `sitemap_index.xml` · `robots.txt` · หน้าแรก + 12 หน้าตาม sitemap ·
       `/api/catalog` · `/api/portfolio` · `/api/site-photos/showcase` → ต้องได้ **0** ทุกไฟล์ (ยกเว้นที่คุณอธิบายได้)
  D. **ตรวจความสอดคล้องของไฟล์หลักฐานในรีโป** `qa/runtime-evidence-20261009/`:
       (1) `verify-deploy-output.txt` ท้ายไฟล์ต้องเป็น `22/22 passed`
       (2) `free-model-probe.md` ต้องมี 15 แถว และสรุป **safe 3 · train 8 · ตรวจไม่จบ 4** ตรงกับ `model-watch-dry-run.txt` (`รุ่นฟรีไม่ฝึกข้อมูล: 3 · บังคับฝึก: 8 · ใช้ไม่ได้: 4`)
       (3) `ledger-summary.md` ต้องมี `cohere/north-mini-code:free` และระบุว่าคอลัมน์ต้นทุนเป็น 0
       (4) `cron-jobs-summary.md` ต้องไม่มีคีย์/token (ตรวจเองแล้วรายงาน)
     เกณฑ์: ทุกไฟล์สอดคล้องกันเอง + กับที่รายงานอ้าง (ถ้าไม่สอดคล้อง = ระบุจุด)
  E. **ล่าตัวเลข/ข้อความที่ยังไม่มีหลักฐาน** (ข้อเสนอเดิมของคุณ): สแกน `qa/` + `docs/` + `KANBAN.md` หาตัวเลขที่อ้างผลลัพธ์
     (เช่น "22 URL", "748 จุด", "21/21 ตาราง", "22/22") แล้วบอกว่าตัวไหน **มี raw output ในรีโป** และตัวไหน **ยังไม่มี** (ระบุไฟล์:บรรทัด)
  F. **ตรวจว่าเอกสารตรงกับความจริงหลังการเปลี่ยนวันนี้**: `qa/job-293-chai-review-david-round2-20261009.md` และไฟล์หลักฐาน
     ต้องไม่ขัดกับสิ่งที่คุณวัดได้เองในข้อ A–C (เช่น cert/โฮสต์ที่ถอด/container ที่หยุด)

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-qwen-review-david-round2-20261009.md         (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-294-qwen-review-david-round2-20261009.md         อ่านเท่านั้น
  - /opt/data/cache/kbsrc/qa/runtime-evidence-20261009/                            อ่านเท่านั้น (ตรวจความสอดคล้อง)
  - /opt/data/cache/kbsrc/KANBAN.md · /opt/data/cache/kbsrc/docs/                  อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแก้ไฟล์ระบบ/config/DB/container ใด ๆ (งานนี้ read-only 100%) · ห้าม restart อะไรทั้งสิ้น
  - ห้าม merge PR ของเดวิด · ห้าม push ตรงเข้า `main` · ห้ามพิมพ์คีย์/token (ไม่ต้องใช้คีย์เลยในใบนี้)
  - ห้ามสรุปว่า "ผ่าน" จากคำอธิบายของเดวิด — ต้องมีคำสั่ง + ผลที่คุณรันเอง (หรือระบุ "ตรวจไม่ได้")

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) `openssl s_client -connect 72.62.79.84:443 -servername knightbasins.com` (และ www/line) → แนบ CN/SAN/notAfter ของทั้งสาม
  2) `curl -s -o /dev/null -w "%{http_code}|%{redirect_url}\n" https://knightbasins.srv1964473.hstgr.cloud/` (ซ้ำกับ /stone, /api/catalog, POST line/webhook)
  3) `for u in /llms.txt /sitemap.xml ... ; do curl -s https://knightbasins.com$u | grep -c srv1964473; done` → ตารางตัวเลขต่อ URL
  4) `node -e "..."` หรือ `python3 -c "import urllib.request;..."` อ่านไฟล์ใน `qa/runtime-evidence-20261009/` แล้วเทียบตัวเลขข้อ D (แนบผล)
  5) `git grep -n "22 URL\|748\|21/21\|22/22" -- qa docs KANBAN.md` → รายการตัวเลข + ตัวที่มี/ไม่มีหลักฐาน (ข้อ E)
  6) ข้อ F: ตารางว่าเอกสารขัดกับผลวัดของคุณตรงไหน (หรือ "ไม่ขัด")
  7) commit SHA ของสาขารายงาน + เวลาไทยที่ตรวจ · ตัวเลข baseline ที่ใช้เทียบ (0 จุด · 404 · SAN ไม่มีชื่อเก่า · 22/22)

OUTPUT:
  - `qa/report-qwen-review-david-round2-20261009.md` — ตาราง A–F: **เห็นด้วย / ไม่เห็นด้วย / ตรวจไม่ได้** + หลักฐานดิบ
  - สรุป 5 บรรทัด: อะไรยืนยันได้จากภายนอก · อะไรยังต้องมีสิทธิ์ในเครื่อง · ตัวเลขที่ยังไม่มีหลักฐาน · ข้อเสนอ · ความเสี่ยงคงเหลือ
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานสั้นในแชท

STOP:
  - เมื่อครบ A–F และมีผลดิบครบ · หรือทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
  - ห้ามขยายขอบเขตไปแก้ของที่พบ (รายงานอย่างเดียว)
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | cert com/www | SAN ไม่มี srv1964473 |
| 2 | cert line | SAN = line เดียว |
| 3 | วันหมดอายุใบใหม่ | ระบุค่าวัดจริง (คาด ~7 ม.ค. 70) |
| 4 | โฮสต์ที่ถอดแล้ว | 404 ทุกเส้น (ไม่ใช่ 301) |
| 5 | LINE webhook | เก่า 404 · ใหม่ 405 |
| 6 | 23 URL สาธารณะ | 0 จุด |
| 7 | runtime-evidence: verify-deploy | ท้ายไฟล์ 22/22 |
| 8 | runtime-evidence: probe 15 ตัว | safe 3 · train 8 · ตรวจไม่จบ 4 |
| 9 | runtime-evidence: ledger | มี cohere:free + ระบุต้นทุนเป็น 0 |
| 10 | runtime-evidence: ไม่มีคีย์ | ตรวจแล้ว 0 |
| 11 | ตัวเลขที่ยังไม่มีหลักฐาน | ระบุไฟล์:บรรทัด |
| 12 | เอกสาร vs ความจริง | ไม่ขัด หรือระบุจุดที่ขัด |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → Qwen] ใบ 294-Q ครับ — ตรวจซ้ำรอบ 2 จากภายนอก หลังคุณรีวิว 292
เรื่อง: เดวิดทำตามข้อเสนอของคุณแล้ว (เพิ่ม qa/runtime-evidence-20261009/ = ผลรันจริง+md5 สคริปต์) และหลังรีวิวมีของเปลี่ยนเพิ่ม:
  • บังคับออกใบรับรองใหม่ → knightbasins.com/www SAN = com+www เท่านั้น · line SAN = line เดียว (หมดอายุ ~7 ม.ค. 70)
  • ถอดโฮสต์เก่าครบทั้งระบบ (สคริปต์ Hermes 22 ไฟล์ · VPS 4 ไฟล์ · .env LINE_PUBLIC_URL · KB 4 ไฟล์ · cron prompt)
  • บอส pause container 2 ตัว (n8n · images-admin) + เพิ่มระบบ state/intentionally-stopped-containers
ให้ตรวจเอง (read-only 100%): A cert SAN จากภายนอก · B โฮสต์เก่า 404/ใหม่ 405 · C นับ 0 จุดบน 23 URL · D ความสอดคล้องของไฟล์หลักฐานในรีโป · E ล่าตัวเลขที่ยังไม่มี raw output · F เอกสาร vs ความจริง
ห้าม: แก้ไฟล์/DB/container · restart · merge PR เดวิด · พิมพ์คีย์ (ใบนี้ไม่ต้องใช้คีย์)
ผลลัพธ์: qa/report-qwen-review-david-round2-20261009.md + PR (docs) + ระบุ เห็นด้วย/ไม่เห็นด้วย/ตรวจไม่ได้ ทีละข้อ · STOP 12 turns
```
