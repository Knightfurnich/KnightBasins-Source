# ใบงาน 269-D (เดวิด) — ทำให้สถิติ crawler เชื่อถือได้: Traefik access log ถาวร + ตัวเก็บ log ต่อเนื่อง

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **เดวิด** (บอสอนุมัติ/ยืนยัน 5 ต.ค. 69) · **ผู้ตรวจรับ:** เดวิด (งาน ops — ไม่มีผู้ตรวจที่สอง แจ้งความโปร่งใส)
**ที่มา (บอสยืนยัน 5 ต.ค. 69):** ให้ทำ “ข้อ 1” (เก็บ log ต่อเนื่อง ไม่แตะ production) และ “ข้อ 2” (Traefik access log — แตะ production) ก่อน เพราะบอสยังไม่ว่างทำข้อ 3 (GSC API)
**สคริปต์:** `/opt/data/bin/knight_crawler_collect.sh` (ใหม่) · `/opt/data/bin/knight_crawler_report.sh` (แก้) · wrappers ใน `/opt/data/scripts/`
**Cron:** `knight-crawler-collect` (id `257ad4e0db8f`) ทุก 2 ชม. โหมด no-agent + deliver=local (เงียบ) · งานรายงานเดิม `49a70660d863` (02:00 UTC = 09:00 ไทย)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. **แก้ต้นเหตุที่ทำให้ตัวเลข crawler เป็น 0:** docker log ของ `knightbasins-web` เป็น json-file (max 3×10MB) และ **ถูกล้างทุกครั้งที่ container ถูกสร้างใหม่ (ทุก deploy)** ⇒ ตัวนับเดิมที่อ่าน `docker logs --since 168h` ได้ 0 เสมอหลัง deploy ทั้งที่ Googlebot เข้าจริง
  2. **ข้อ 1 (ไม่แตะ production):** ทำตัวเก็บ log ต่อเนื่อง — cron ทุก 2 ชม. ดึงบรรทัด crawler เก็บลงไฟล์สะสมในเครื่องเรา (`/opt/data/knight-crawler/crawler_archive.log`) แบบ dedupe
  3. **ข้อ 2 (แตะ production · บอสยืนยันแล้ว):** เปิด **Traefik access log** ให้เขียนไฟล์ถาวรบน VPS (`/docker/traefik/logs/access.log`) รูปแบบ `common` (หน้าตาเหมือน nginx ⇒ สคริปต์เดิมอ่านได้) และ **เก็บ User-Agent** (จำเป็นต่อการนับ Googlebot/AI crawlers) + ตั้ง logrotate รายวัน เก็บ 14 วัน
  4. **ปรับรายงานให้ตรงเป้าบอส:** นับจากไฟล์ถาวรเป็นหลัก + เพิ่มตัวชี้วัด “หน้าเนื้อหาที่ Googlebot เข้าจริง กี่ URL จากจำนวน URL ใน sitemap.xml” + ระบุแหล่งข้อมูล/เวลาที่เก็บล่าสุด + ช่องตัวชี้วัดชั้นธุรกิจ (GSC) รอเชื่อม
  5. **กันนับผิด:** ตัดคำขอจากเครือข่ายภายใน (172.16./10./127.) ออก เพื่อไม่ให้นับคำขอทดสอบ/ทราฟฟิกภายในเป็น crawler และ **ไม่ใช้ Traefik log กับ nginx log พร้อมกัน** (จะนับซ้ำ) — ใช้ nginx เป็นสำรองเฉพาะเมื่อ Traefik log ว่าง
  6. **จุดย้อนกลับ:** สำรอง `docker-compose.yml` ของ Traefik ก่อนแก้ (`docker-compose.yml.bak-20261005T071621Z`) + กู้ได้ภายใน ~10 วินาที

SCOPE:
  - /opt/data/bin/knight_crawler_collect.sh
  - /opt/data/bin/knight_crawler_report.sh
  - /opt/data/scripts/knight_crawler_collect.sh
  - /opt/data/scripts/knight_crawler_report.sh

FORBIDDEN:
  - ห้ามแตะข้อมูล/ฐานข้อมูล production (`knightbasins-db`, `knightdesign-db`) และห้ามแก้โค้ดแอปในใบนี้
  - ห้ามแตะคอนเทนเนอร์อื่นนอก `traefik-traefik-1` · ห้ามลบคอนเทนเนอร์/volume · ห้ามแก้ ACME/ใบรับรอง
  - ห้ามใช้ Traefik log + nginx log เป็นแหล่งนับพร้อมกัน (นับซ้ำ) · ห้ามนับคำขอจาก IP ภายใน
  - ห้ามพิมพ์ค่าคีย์/`.env`/token ลงรายงาน · ห้ามส่งรายงานที่เดาตัวเลข (ถ้าอ่าน log ไม่ได้ให้บอกตรง ๆ)

EVIDENCE:
  1) **Traefik ขยับแล้วและทุกบริการยังปกติ (หลัง restart):** `knightbasins` 200 · `hermes-agent-2xwn` 302 · `api` 404 (ไม่มี route `/`) · `line` 404 · `n8n` 200 · container `traefik-traefik-1` = Up
  2) **ไฟล์ log ถูกเขียนจริง:** `/docker/traefik/logs/access.log` มีบรรทัดรูปแบบ common + มี User-Agent เช่น
     `2a02:4780:... - - [05/Oct/2026:07:20:11 +0000] "GET / HTTP/2.0" 200 21266 "-" "curl/8.5.0" 13 "knightbasins@docker" ...`
  3) **logrotate ทำงานจริง (ทดสอบ `logrotate -f`):** ได้ `access.log.1` และ log ใหม่ยังเขียนต่อได้ (copytruncate ไม่ทำ log หยุด)
  4) **ตัวเก็บทำงานจริง:** `bash bin/knight_crawler_collect.sh` → ไฟล์สะสมมีบรรทัด crawler + `last_source.txt` ระบุแหล่งที่ใช้ + `last_collect_th.txt` เวลาไทย
  5) **รายงานรันจริง (ผลปัจจุบัน):** Googlebot **2 ครั้ง** · หน้าเนื้อหา **2 จาก 10 URL** (`/quote`, `/`) · GPTBot/ClaudeBot/Perplexity/Bingbot = 0 · ระบุแหล่งข้อมูล + สถานะ log ถาวร (ขนาด/แก้ล่าสุด)
  6) **ของจริงที่พบเพิ่ม:** Googlebot เข้า `/quote` เวลา 07:03:33 UTC (14:03 ไทย) — เดิมเห็นแค่ `/` ⇒ มีหน้าเนื้อหาถูกเก็บเพิ่มจริง
  7) **ทดสอบท่อ end-to-end แล้วลบข้อมูลทดสอบออก:** ยิงคำขอ 2 ครั้งด้วย UA ปลอม (Googlebot/GPTBot) ผ่าน Traefik → ตัวเก็บดึงได้จริง → **กรองออกจากไฟล์สะสมแล้ว** (ตัดบรรทัดที่มาจาก IP ภายใน) ไม่ให้นับเป็นสถิติจริง
  8) **สำรอง/ย้อนกลับ:** `ls -l /docker/traefik/docker-compose.yml.bak-20261005T071621Z` (931 bytes) มีอยู่จริง
  9) **คำสั่งจริงที่ใช้ (รันแล้วทั้งหมด):**
     - ตรวจสถานะก่อนแก้: `docker inspect traefik-traefik-1 --format '{{.HostConfig.LogConfig.Type}}'` · `ss -lntp | grep -E ':80 |:443 '`
     - ทดสอบ syntax ก่อนแตะของจริง: `docker run -d --name traefik-syntaxcheck traefik:latest --providers.docker=false --entrypoints.web.address=:8081 ... --accesslog=true --accesslog.filepath=/tmp/access.log --accesslog.format=common --accesslog.fields.headers.names.User-Agent=keep`
     - ใช้งาน config ใหม่: `cd /docker/traefik && docker compose config >/dev/null && docker compose up -d traefik`
     - ตรวจหลัง restart: `curl -s -o /dev/null -w "%{http_code}" https://knightbasins.srv1964473.hstgr.cloud/` (และ host อื่น ๆ)
     - ตั้ง/ทดสอบ logrotate: `logrotate -d /etc/logrotate.d/traefik` → `logrotate -f /etc/logrotate.d/traefik`
     - เก็บข้อมูล: `bash /opt/data/bin/knight_crawler_collect.sh`
     - ออกรายงาน: `bash /opt/data/bin/knight_crawler_report.sh`
     - บันทึกใบงาน/KANBAN: `git add qa/job-269-david-crawler-log-durability.md KANBAN.md && git commit -m '...'` แล้วเปิด PR เข้า main
  10) **ตัวเลขก่อน/หลัง (baseline):**
     - **ก่อน:** รายงานที่อ่าน `docker logs knightbasins-web --since 168h` = **Googlebot 0 ครั้ง / AI crawlers 0 ครั้ง** (หลัง container ถูกสร้างใหม่ 04:50 UTC เพราะ log เหลือ 34 บรรทัด)
     - **หลัง:** จากไฟล์สะสม + log ถาวร = **Googlebot 2 ครั้ง · หน้าเนื้อหา 2 จาก 10 URL** (`/quote` · `/`) · AI crawlers 0 ครั้ง (ยังไม่มีตัวเข้า)
     - ไฟล์ log ถาวรเริ่มเขียน 07:16 UTC · logrotate ทดสอบหมุนแล้วได้ `access.log.1` (1,837 bytes)

OUTPUT:
  - สถิติ crawler เก็บได้ต่อเนื่อง ไม่หายเมื่อ deploy · log ถาวรบน VPS + logrotate 14 วัน · รายงานรายวันมีตัวชี้วัดหน้าเนื้อหา vs sitemap
  - ข้อ 3 (GSC API) รอ: บอสเปิด Search Console API ในโปรเจกต์ + เพิ่ม SA `knight-basins-app@knight-basins-voice.iam.gserviceaccount.com` เป็นผู้ใช้ใน GSC

STOP:
  - เมื่อ Traefik ขยับแล้วทุกบริการปกติ · ไฟล์ log เขียนจริง · logrotate ทดสอบผ่าน · ตัวเก็บ+รายงานรันจริงมีตัวเลข · จุดย้อนกลับอยู่ครบ
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ข้อ 1 (ไม่แตะ prod) + ข้อ 2 (Traefik) + ปรับรายงาน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | สคริปต์ 4 ไฟล์ (bin + scripts wrapper) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ DB/คอนเทนเนอร์อื่น/ห้ามนับซ้ำ/ห้ามเดาตัวเลข |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ผลจริงทุกข้อ + ตัวอย่างบรรทัด log + logrotate |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | สถิติต่อเนื่อง + ตัวชี้วัดใหม่ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/bin, /opt/data/scripts |
| 8 | ระบุคำสั่งบอส | ผ่าน | “ยืนยันตามที่เดวิดแนะนำข้อหนึ่ง” + “ทำข้อสองก่อน” |
| 9 | มีจุดย้อนกลับระบุชัด | ผ่าน | ไฟล์สำรอง + ขั้นตอนกู้ |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → บอส] |
| 11 | ระบุผู้ทำ/ความโปร่งใส | ผ่าน | เดวิดทำเอง ไม่มีผู้ตรวจที่สอง |
| 12 | ระบุวันเวลาไทย | ผ่าน | 5 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → บอส] ใบ 269 — ข้อ 1 + ข้อ 2 เสร็จแล้ว (traefik access log + ตัวเก็บ log ต่อเนื่อง)
ข้อ 2: เปิด Traefik access log ที่ /docker/traefik/logs/access.log (ฟอร์แมต common + เก็บ User-Agent) + logrotate รายวันเก็บ 14 วัน
  · หลัง restart ทุกบริการปกติ: knightbasins 200 · hermes-agent 302 · api 404 · line 404 · n8n 200 · สะดุดเว็บ ~2-5 วินาที
  · สำรอง config: /docker/traefik/docker-compose.yml.bak-20261005T071621Z (กู้ได้ใน ~10 วินาที)
ข้อ 1: cron knight-crawler-collect (257ad4e0db8f) ทุก 2 ชม. เก็บลง /opt/data/knight-crawler/crawler_archive.log (เงียบ ไม่รบกวน Telegram)
  · รายงาน 09:00 ไทย อ่านจากไฟล์ถาวรเป็นหลัก + ตัวชี้วัดใหม่: หน้าเนื้อหาที่ Googlebot เข้าจริง กี่ URL จาก N ใน sitemap
หลักฐาน: ไฟล์ log เขียนจริง (มี UA) · logrotate ทดสอบหมุนผ่าน + log ยังเขียนต่อ · รายงานรันจริง = Googlebot 2 ครั้ง · หน้าเนื้อหา 2/10 URL (/quote, /) — พบของจริงเพิ่ม: Googlebot เข้า /quote เวลา 14:03 ไทย
หมายเหตุ: ผมยิงคำขอทดสอบด้วย UA ปลอม 2 ครั้งเพื่อตรวจท่อ แล้วกรองออกจากไฟล์สะสมแล้ว (ไม่นับเป็นสถิติ)
ถัดไป: ข้อ 3 (GSC) รอ — บอสเปิด API + เพิ่ม knight-basins-app@knight-basins-voice.iam.gserviceaccount.com เป็นผู้ใช้ใน Search Console แล้วบอกผม ผมยิงทดสอบต่อทันที
```
