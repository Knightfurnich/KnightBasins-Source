# ใบงาน 291-C (ชัย) — **ตรวจงานเดวิดแบบอิสระ** รอบ 9 ต.ค. 69: ถอดโฮสต์เก่า `*.srv1964473.hstgr.cloud` (VPS + DB + LINE + รีโป)

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** บอสสั่งให้ชัยทบทวนงานที่เดวิดทำเองในรอบนี้ (งานที่เดวิด merge เอง/แก้ production เอง ⇒ ต้องมีคนอื่นตรวจ — เดวิดรับรองงานตัวเองไม่ได้)
**กติกาของใบนี้: รายงานของเดวิด = คำให้การ ไม่ใช่ข้อเท็จจริง** — ทุกข้อต้องรันเองแล้วแนบผลดิบ ถ้าตรวจไม่ได้ให้บอกว่าตรวจไม่ได้พร้อมเหตุผล **ห้ามเดา**

## สิ่งที่เดวิดอ้างว่าทำเสร็จในรอบนี้ (ให้ตรวจทีละข้อ)

```
1) merge PR ของชัย 3 ใบ (CI เขียว): #407 LINE รับเฉพาะ knightbasins.com · #406 ลบ api-dist/web-dist ที่ commit ค้าง · #404 ลิงก์รูป/วิดีโอจาก API → knightbasins.com
   → main = 51389a0 · Deploy to Hostinger VPS #943 = success · Release validation = success
2) แก้ /docker/knightbasins/.env: PUBLIC_APP_ORIGIN  จาก https://knightbasins.srv1964473.hstgr.cloud  → https://knightbasins.com
   (สำรอง .env.bak-app-origin-20261009T044207Z) — deploy recreate api ให้เอง แล้ว printenv ยืนยัน
3) ถอดโฮสต์เก่าออกจาก VPS: /docker/knightbasins/nginx.conf (ตัด map $knight_legacy_host + บล็อก 301 rewrite + เอาออกจาก server_name)
   · /docker/knightbasins/docker-compose.yml (Traefik rule เหลือ Host(knightbasins.com) || Host(www.knightbasins.com))
   → nginx -t ผ่าน · recreate web · โฮสต์เก่า / และ /stone = 404 · โดเมนใหม่ 200
   (สำรอง *.bak-retire-legacy-20261009T045031Z)
4) UPDATE DB: แถวที่ยังเก็บลิงก์โฮสต์เก่า 585 แถว → เปลี่ยนเป็น https://knightbasins.com
   (text/json 426 + array 159) · ไม่แตะ api.srv1964473 (239 แถว) · สำรอง backups/db-pre-host-retire-20261009T050546Z.sql.gz (52K)
   เดวิดอ้างว่า: รอบแรกใช้ array_replace แล้ว "ไม่โดน" (เทียบ element ทั้งก้อน) → แก้รอบสองด้วย array_agg(replace(...))
5) PR #408 (เดวิดเขียนเอง/merge เอง): ซิงก์ deploy/hostinger/nginx.conf + docker-compose.yml ให้ตรง VPS ·
   กลับทิศเทสต์ artifacts/knight-basins/test/domain-canonical.test.ts (จาก "ต้องมีโฮสต์เก่า" → "ต้องไม่มี") · ONBOARDING-freebuff.md
6) KB: knight-design-kb/pricing.json 1 จุด (catalogue_availability.source) เขียนในไฟล์เดิม (inode เดิม) ·
   ops/wikidata-entity.md (P856 ×2) · ops/disaster-recovery.md
7) LINE: ถอดประตูสำรอง line.srv1964473 ออกจาก /docker/line-proxy/docker-compose.yml (เหลือ Host(line.knightbasins.com))
   + ตั้งค่าในคอนโซลผ่าน API: PUT /v2/bot/channel/webhook/endpoint = https://line.knightbasins.com/line/webhook
   + POST /v2/bot/channel/webhook/test = success:true statusCode:200
8) แก้ตัวตรวจของเดวิดเองที่ยังชี้โฮสต์เก่า: bin/verify_deploy.py (APP) · bin/knight_bundle_probe.sh (BASE + ยิง / แทน /login)
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **รันตัวตรวจหลักเอง แล้วแนบผลดิบ** — `HERMES_HOME=/opt/data /opt/hermes/.venv/bin/python3 bin/verify_deploy.py`
     เกณฑ์: **22/22 passed** · ถ้าไม่ครบ ให้แนบข้อที่ไม่ผ่านทั้งข้อความ
  B. **พิสูจน์ว่าโฮสต์เก่าตายจริง** — ยิง 3 เส้นทาง (แนบ HTTP code + redirect_url ทุกเส้น)
       `curl -s -o /dev/null -w "%{http_code}|%{redirect_url}\n" https://knightbasins.srv1964473.hstgr.cloud/`
       `…/stone` · `-X POST …/line/webhook`
     เกณฑ์: **404 ทุกเส้น** (ห้ามมี 200/301) · และโดเมนใหม่ต้อง **200** (`https://knightbasins.com/`, `/stone`, `/api/catalog`, `/api/healthz`)
  C. **อ่านไฟล์จริงบน VPS** (ไม่ใช่สำเนาในรีโป) แล้วแนบผล:
       `grep -rn "knightbasins.srv1964473" /docker/knightbasins/nginx.conf /docker/knightbasins/docker-compose.yml /docker/line-proxy/docker-compose.yml`
       `grep -n "server_name" /docker/knightbasins/nginx.conf` · `grep -n "line.rule" /docker/line-proxy/docker-compose.yml`
     เกณฑ์: **0 จุด** ในไฟล์ที่ให้บริการ (คอมเมนต์อธิบายได้ แต่ต้องระบุว่าอยู่บรรทัดไหน)
  D. **ตรวจ DB ว่าถูกแก้จริงและไม่เสียหาย** (อ่านอย่างเดียว — ห้าม UPDATE/DELETE):
       1. นับแถวที่ยังมี `knightbasins.srv1964473` (ทุกตาราง ทุกคอลัมน์ **รวม array**) → ต้อง **0**
       2. นับแถวที่มี `api.srv1964473` → ต้อง **239** เท่าเดิม (เดวิดอ้างว่าไม่แตะ)
       3. **ตรวจความเสียหายจากการแทนที่สตริง**: สุ่ม 5 แถว (payment_slips 1 · sheet_stone_prices 1 · installed_stone_prices 1 · basin_prices 1 · system_audit_logs 1)
          แนบ URL ก่อน/หลัง และยืนยันว่า **path + query (?v=…) + hash ยังอยู่ครบ** และ **ไม่มีโดเมนภายนอกถูกแก้**
       4. ยิง HTTP จริง 3 URL ที่ดึงมาจาก DB (คนละตาราง) → ต้อง **200** และ content-type เป็นรูป/วิดีโอ
  E. **ตรวจว่าไม่มีที่ไหนในระบบยังชี้โฮสต์เก่า** — แนบตัวเลขนับ:
       หน้าเว็บ `/llms.txt` `/llms-full.txt` `/sitemap.xml` `/robots.txt` `/` · API `/api/catalog` · KB `knight-design-kb/**`
     เกณฑ์: **0 จุด** ในไฟล์ที่ให้บริการ (ไฟล์สำรอง `*_bak-*` / HANDOFF / qa/ ประวัติ = ยกเว้นได้ ให้ระบุ)
  F. **ตรวจ PR #408 แบบไม่เชื่อคำอธิบาย** — `git diff origin/main~1 origin/main` (หรืออ่าน PR):
       เทียบ `deploy/hostinger/nginx.conf` + `docker-compose.yml` ในรีโป กับไฟล์จริงบน VPS (ข้อ C) ว่า **ตรงกันจริง**
       · ตรวจว่าเทสต์ `domain-canonical.test.ts` ที่แก้ **ยังจับหลุดได้จริง**: ทดลองใส่สตริงโฮสต์เก่ากลับเข้า `deploy/hostinger/nginx.conf` ชั่วคราว → รันเทสต์ต้อง **fail** → คืนไฟล์ (`git checkout --`) → ต้อง **pass** (แนบสองผล + `git status --porcelain` = 0)
  G. **ตรวจ LINE ปลายทางจริง** (อ่านค่าจาก LINE API เท่านั้น ห้ามแก้):
       `GET https://api.line.me/v2/bot/channel/webhook/endpoint` → ต้องเป็น `https://line.knightbasins.com/line/webhook` และ `active:true`
       · ส่งข้อความทดสอบเข้าบอท 1 ครั้ง แล้วแนบหลักฐานจาก log ว่า LINE ยิงเข้าและได้ **200** (`grep "line/webhook" /docker/traefik/logs/access.log | tail -3`)
  H. **ตรวจความเสี่ยงที่เดวิดอาจมองข้าม** (อย่างน้อย 3 ข้อ — เลือกเองและบอกเหตุผล):
       ตัวอย่าง: ไฟล์สำรอง DB เปิดได้จริงไหม (`zcat … | head -3` + นับบรรทัด `CREATE TABLE`) · ลิงก์ที่ตายจริงมีผลกับอะไร (สุ่ม 2 ลิงก์เก่าจาก DB/เอกสาร) ·
       สิทธิ์/เจ้าของไฟล์ที่เดวิดแก้บน VPS · DNS ของชื่อเก่า (ทำไมยัง resolve — wildcard ของผู้ให้บริการ?) · cert/ACME ของโฮสต์ที่ปลดระวาง
  I. **ตรวจข้ออ้าง "array_replace ไม่โดน"** — อธิบายด้วยหลักฐานว่าจริงหรือไม่ (เช่น ทดลองบนตารางทดสอบชั่วคราวใน DB **ห้ามแตะ prod** หรืออ้างเอกสาร PostgreSQL + เทียบข้อมูลจริงข้อ D)

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-chai-review-david-work-20261009.md                (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-291-chai-independent-review-david-20261009.md        อ่านเท่านั้น
  - /opt/data/cache/kbsrc/deploy/hostinger/nginx.conf                                 อ่าน/เทียบกับไฟล์จริงบน VPS
  - /opt/data/cache/kbsrc/deploy/hostinger/docker-compose.yml                         อ่าน/เทียบกับไฟล์จริงบน VPS
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/domain-canonical.test.ts       ทดลอง fail→pass
  - /opt/data/bin/verify_deploy.py · /opt/data/bin/hssh.py · /opt/data/bin/github_pr.py  รัน/อ่าน
  - /opt/data/cache/ (ที่พักไฟล์ชั่วคราวของผลตรวจ — ห้ามเขียนนอก /opt/data)

FORBIDDEN:
  - **ห้าม UPDATE/DELETE/INSERT ใน production DB ทุกกรณี** (ข้อ D เป็นการอ่านเท่านั้น) · ห้าม restart/recreate container ใด ๆ · ห้ามแก้ไฟล์ config บน VPS
  - ห้ามแก้/merge PR ของเดวิดเอง · ห้าม push ตรงเข้า `main`
  - ห้ามแตะราคา/รหัสสี/`active`/จำนวนแถว · ห้ามแก้ `.env` · ห้ามพิมพ์คีย์/token/รหัสลงรายงาน
  - ห้าม "ตรวจ" ด้วยการอ่านรายงานของเดวิดแล้วตอบว่าเห็นด้วย — ทุกข้อต้องมีคำสั่ง + ผลดิบ

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) `HERMES_HOME=/opt/data /opt/hermes/.venv/bin/python3 /opt/data/bin/verify_deploy.py` → ท้ายสุด `22/22 passed`
  2) `curl -s -o /dev/null -w "%{http_code}|%{redirect_url}\n" https://knightbasins.srv1964473.hstgr.cloud/` (ทำซ้ำ `/stone` และ `-X POST …/line/webhook`) → 404 ทุกเส้น · แล้วยิงโดเมนใหม่ `/` `/stone` `/api/catalog` `/api/healthz` → 200
  3) `uv run --with paramiko --quiet python /opt/data/bin/hssh.py 'grep -rn "knightbasins.srv1964473" /docker/knightbasins/nginx.conf /docker/knightbasins/docker-compose.yml /docker/line-proxy/docker-compose.yml; grep -n server_name /docker/knightbasins/nginx.conf; grep -n line.rule /docker/line-proxy/docker-compose.yml'` → 0 จุดที่ให้บริการ
  4) นับแถว DB (อ่านอย่างเดียว): ตรวจโค้ดก่อนรัน แล้วรันสคริปต์นับของเดวิด `bash /tmp/db_host_audit.sh` → ต้องได้ `retired=0` และ `apihost=239` + สุ่ม 5 แถว (URL ก่อน/หลัง) + `curl -o /dev/null -w "%{http_code}" <URL จาก DB>` 3 ใบ → 200
  5) นับ 0 จุดที่อื่น: `curl -s https://knightbasins.com/llms.txt | grep -c srv1964473` (ทำซ้ำ llms-full.txt / sitemap.xml / robots.txt / หน้าแรก / `/api/catalog`) + `grep -rln srv1964473 /opt/data/knight-design-kb/` (แยกไฟล์สำรอง/ประวัติออก)
  6) เทสต์สองทาง (ข้อ F): ใส่สตริงโฮสต์เก่ากลับใน `deploy/hostinger/nginx.conf` → `node --experimental-strip-types --test test/domain-canonical.test.ts` ต้อง **fail** (แนบข้อความ error) → `git checkout -- deploy/hostinger/nginx.conf` → รันซ้ำ **pass** → `git status --porcelain` = 0
  7) LINE (อ่านค่าเท่านั้น): `curl -s -H "Authorization: Bearer $LINE_TOKEN" https://api.line.me/v2/bot/channel/webhook/endpoint` → `line.knightbasins.com` + `active:true` · ส่งข้อความทดสอบ 1 ครั้ง แล้ว `uv run --with paramiko --quiet python /opt/data/bin/hssh.py 'grep "line/webhook" /docker/traefik/logs/access.log | tail -3'` → 200
  8) ข้อ H ≥3 ข้อ + ข้อ I — ระบุ **เห็นด้วย / ไม่เห็นด้วย / ตรวจไม่ได้ (เหตุผล)** ทีละข้อของคำอ้างเดวิด
  9) commit SHA ของสาขารายงาน + วันเวลาไทยที่ตรวจ · ตัวเลข baseline ที่ใช้เทียบ (22/22 · 0 แถว · 239 แถว · 0 จุด)

OUTPUT:
  - `qa/report-chai-review-david-work-20261009.md` — ตารางสรุปทีละข้อ A–I: **ผ่าน / ไม่ผ่าน / ตรวจไม่ได้** + หลักฐานดิบสั้น ๆ
  - สรุป 5 บรรทัด: อะไรถูก · อะไรยังไม่น่าเชื่อถือ · อะไรที่เดวิดมองข้าม · ข้อเสนอ · ความเสี่ยงคงเหลือ
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานสั้นในแชท (เดวิดจะส่งต่อบอส)

STOP:
  - เมื่อครบทุกข้อ A–I และมีผลดิบครบ · หรือเมื่อทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ตรวจแล้ว + ที่เหลือ
  - ห้ามขยายขอบเขตไปแก้ของที่พบ (รายงานอย่างเดียว) — ถ้าพบปัญหา production ให้รายงานเดวิด/บอสทันที
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | `verify_deploy.py` | 22/22 passed (แนบผลเต็ม) |
| 2 | โฮสต์เก่าตายจริง | `/` · `/stone` · POST `/line/webhook` = 404 ทุกเส้น |
| 3 | โดเมนใหม่ให้บริการ | `/` `/stone` `/api/catalog` `/api/healthz` = 200 |
| 4 | config บน VPS | ไม่เหลือ `knightbasins.srv1964473` ใน nginx.conf / compose / line-proxy (หรืออธิบายบรรทัดคอมเมนต์) |
| 5 | DB: เหลือโฮสต์เก่า | **0 แถว** (นับรวมคอลัมน์ array) |
| 6 | DB: ไม่แตะ `api.srv` | **239 แถว** เท่าเดิม |
| 7 | DB: ไม่เสียหาย | 5 แถวสุ่ม path/query/hash ครบ · 3 URL ยิงได้ 200 |
| 8 | หน้าเว็บ/API/KB | 0 จุดในไฟล์ที่ให้บริการ |
| 9 | รีโป ตรง VPS | `deploy/hostinger/*` = ไฟล์จริง (เทียบด้วยตา/คำสั่ง) |
| 10 | เทสต์ยังจับหลุด | ใส่โฮสต์เก่ากลับ → fail · คืน → pass · worktree สะอาด |
| 11 | LINE ปลายทาง | endpoint = line.knightbasins.com · active · log 200 จริง |
| 12 | ความเสี่ยงที่เหลือ | ≥3 ข้อ + สรุปท่าทีต่อคำอ้างของเดวิดทุกข้อ |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → ชัย] ใบ 291-C ครับ — บอสสั่งให้ตรวจงานเดวิดแบบอิสระ (งานรอบ 9 ต.ค. 69 ที่เดวิด merge PR เอง + แก้ production เอง จึงต้องมีคนอื่นตรวจ)
เรื่อง: ถอดโฮสต์เก่า *.srv1964473.hstgr.cloud ออกจากระบบทั้งหมด
เดวิดอ้างว่าทำ: merge #404/#406/#407 (main 51389a0, deploy #943) · แก้ PUBLIC_APP_ORIGIN · ถอดโฮสต์เก่าจาก nginx.conf+Traefik (เก่า 404 / ใหม่ 200) · UPDATE DB 585 แถว (ไม่แตะ api.srv 239) + สำรอง pg_dump · PR #408 ซิงก์รีโป+กลับทิศเทสต์ · แก้ KB 3 ไฟล์ · ถอดประตูสำรอง LINE + ตั้ง endpoint ในคอนโซลผ่าน API (webhook/test = 200) · แก้ verify_deploy.py + bundle probe ที่ยังชี้โฮสต์เก่า
ให้ตรวจเอง (อ่านอย่างเดียว): A รัน verify_deploy 22/22 · B ยิงเก่า 404/ใหม่ 200 · C grep ไฟล์จริงบน VPS · D นับแถว DB (เก่า 0 / api.srv 239) + สุ่ม 5 แถว + ยิง 3 URL · E นับ 0 จุดหน้าเว็บ/API/KB · F เทียบรีโปกับ VPS + พิสูจน์เทสต์จับหลุดได้ (fail→pass) · G LINE endpoint + log 200 · H ความเสี่ยงที่เดวิดมองข้าม ≥3 ข้อ · I ตรวจข้ออ้าง array_replace
ห้าม: UPDATE/DELETE/INSERT ใน DB prod · restart/recreate container · แก้ config บน VPS · merge PR เดวิด · push main · พิมพ์คีย์
ผลลัพธ์: qa/report-chai-review-david-work-20261009.md + PR + ระบุ "เห็นด้วย/ไม่เห็นด้วย/ตรวจไม่ได้" ทีละข้อ (STOP 12 turns)
```
