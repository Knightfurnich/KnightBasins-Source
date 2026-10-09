# รายงานตรวจซ้ำรอบ 2 (ใบ 293-C) — ชัย · 9 ต.ค. 69

**ผู้ตรวจ:** ชัย · **ตรวจเมื่อ:** 9 ต.ค. 69 เวลา 15:49–15:56 น. (เวลาไทย) · **ฐาน:** `main` @ `ad78709` (#415)
**ใบงาน:** `qa/job-293-chai-review-david-round2-20261009.md` · **รายงานรอบแรก:** `qa/report-chai-review-david-work-20261009.md` (#411)

## 0. ข้อจำกัด (อ่านก่อน)

ใบงานนี้เขียนสำหรับเครื่อง Hermes ของเดวิด (`/opt/data/...`) แต่ผมไม่มีเครื่องนั้น สิ่งที่ผมมีคือ

- `GET`/`HEAD` สาธารณะ (ไม่ `POST` ใน production ตามกติกา)
- กุญแจอ่านอย่างเดียวที่ทำได้แค่ `status`, `apilog`, `tfmeta`
- โค้ดใน repo (ไม่มีสคริปต์ `knight_watchdog.sh`, `knightbasins_watchdog.sh`, `kb_colour_counts.py`, `verify_deploy.py` — README ของ `qa/runtime-evidence-20261009/` ยืนยันว่าตั้งใจไม่ใส่ไว้)

ผมจึง **รันตัวตรวจของเดวิดไม่ได้** และไม่เขียนว่า "ผ่าน" แทนสิ่งที่ไม่ได้รัน ทุกข้อด้านล่างระบุว่าเป็น **วัดตรง** หรือ **ตัวแทน (proxy)**

## 1. สรุป 5 บรรทัด

1. **ยืนยันได้เอง:** ใบรับรองสามโดเมนไม่มีชื่อเก่า (หมด 7 ม.ค. 70) · โฮสต์เก่าตอบ 404 · ไฟล์ SEO 5 ไฟล์ + แคตตาล็อกสาธารณะมี `srv1964473` 0 จุด · 16 จาก 22 ข้อของ `verify_deploy` ทำซ้ำจากภายนอกได้ตรงกับผลของเดวิด (ขนาดไฟล์/ชื่อ bundle ตรงเป๊ะ)
2. **ยังไม่น่าเชื่อถือ:** ตัวเลข `fabrication colours — 71 codes / 71/71 images` ทำซ้ำจากฟีดสาธารณะไม่ได้ (ได้ 68 รหัสรวม · ซื้อแผ่น 64 · ติดตั้ง 65) · ผล `watchdog ×2` และ `kb_colour_counts` ไม่มีผลดิบแนบ · `checksums.md` ไม่ครอบคลุมสคริปต์ที่แก้ในรอบนี้เลย
3. **เดวิดยังมองข้าม:** Hermes container ยัง `Up 5 days` (ไม่ได้ recreate) ⇒ ถ้า gateway อ่าน `LINE_PUBLIC_URL` ครั้งเดียวตอน start ตามที่เดวิดเขียนเอง **ค่าใหม่ยังไม่มีผล** และ URL รูปที่ส่งลูกค้าอาจยังชี้โฮสต์ที่ถอดแล้ว (ยืนยันไม่ได้ว่า process ข้างในถูก restart หรือไม่)
4. **ข้อเสนอ:** ให้เดวิดรันคำสั่งท้ายรายงาน (ข้อ 9) แล้วแนบผลดิบ · ยืนยัน/ทำ restart gateway แล้วจึงปิด D และ G · เพิ่ม md5 ของสคริปต์ 3 ตัวใน `checksums.md` และใส่เวลาในหัว `verify-deploy-output.txt`
5. **ความเสี่ยงคงเหลือ:** (ก) หน้าต่างที่ URL รูป LINE ชี้โฮสต์ตาย (ตั้งแต่ถอดโฮสต์ ~11:50 น. จนกว่า restart) (ข) state file ที่ทำให้ watchdog เงียบโดยไม่มีวันหมดอายุ อาจบังเหตุจริง (ค) ข้อความ LINE เก่าที่ส่งไปแล้วด้วยลิงก์โฮสต์เก่า

## 2. ตาราง A–G

| ข้อ | ผล | ชนิดหลักฐาน | สรุป |
|---|---|---|---|
| A | **ตรวจไม่ได้** (ตัวแทนผ่าน 16/22) | proxy | รัน 4 สคริปต์ไม่ได้ · ทำซ้ำข้อตรวจของ `verify_deploy` จากภายนอกได้ 16 จาก 22 ตรงกัน |
| B | **ผ่านเฉพาะ repo + เว็บสาธารณะ** · Hermes/VPS **ตรวจไม่ได้** | วัดตรง (repo/เว็บ) | ดู §4 |
| C | **ผ่าน** | วัดตรง | SAN ไม่มี `srv1964473` ทั้ง 3 โดเมน |
| D | **ตรวจไม่ได้** | proxy | อ่าน `.env` ไม่ได้ · มีหลักฐานเอนไปทางว่ายังไม่ restart |
| E | **ตรวจไม่ได้** | — | สคริปต์ไม่อยู่ใน repo/ไม่มีสิทธิ์สร้างสำเนาบน VPS |
| F | **ผ่านบางส่วน** (2 จาก ≥4 แหล่ง) | วัดตรง + ตรวจไม่ได้ | endpoint 200/405 ตามคาด · crontab/systemd/volumes ตรวจไม่ได้ |
| G | **ตรวจไม่ได้ (รอยืนยัน restart)** | proxy | เส้นทางถึง gateway แต่ log การดึงสื่อจริงเห็นไม่ได้ |

## 3. A — ตัวตรวจ 4 ตัว

**ตรวจไม่ได้:** `knight_watchdog.sh`, `knightbasins_watchdog.sh`, `kb_colour_counts.py`, `verify_deploy.py` อยู่เฉพาะบน Hermes ผมไม่ได้รันและไม่ได้เห็นผลดิบของ watchdog ทั้งสองและ `kb_colour_counts` (เดวิดแนบแค่ `verify-deploy-output.txt`)

**ตัวแทนที่ทำได้ (ทำซ้ำข้อตรวจของ `verify_deploy` จากภายนอก):**

| ข้อตรวจของเดวิด | ผลของเดวิด | ที่ผมวัด | ตรง? |
|---|---|---|---|
| A containers web/api/db | Up · healthy | `status`: web `Up 2 minutes`, api `healthy`, db `healthy` | ✅ |
| `/` 200 html | 200 · 155,826 B | 200 `text/html` 155,826 B | ✅ ตรงเป๊ะ |
| `/readme` `/studio` `/sketch` | 200 | 200 · 200 · 200 | ✅ |
| `/api/catalog` | 200 json | 200 `application/json` | ✅ |
| bundle ในหน้าแรก | `index-Ch5gquFv.js` / `index-DK5ZqJ6H.css` | ชื่อเดียวกัน | ✅ |
| asset js / css | 200 · 1,794,132 B / 385,899 B | 200 · 1,794,132 B / 385,899 B | ✅ ตรงเป๊ะ |
| asset หาย = 404 ไม่ใช่ SPA | 404 | 404 `text/html` | ✅ |
| SG420 rate 8500 | 8500 | `installedStones` SG420 `pricePerSqmTHB` = 8500 | ✅ |
| ยอดรวม 14,180 | 8500×1.08+5000 | คำนวณ = 14,180.00 | ✅ |
| รูปไม่ติด rate limit | 60 × 200 | 60 × `GET` รูปเดิม = 60 × 200 | ✅ |
| **fabrication colours 71 codes** | 71 | ฟีดสาธารณะ: ซื้อแผ่น 64 · ติดตั้ง 65 · **รวม 68** รหัส (ซ้อน 61) | ❌ ทำซ้ำไม่ได้ |
| **fabrication images 71/71** | 71/71 | ซื้อแผ่น 64/64 · ติดตั้ง 65/65 · รวม 68/68 | ❌ ทำซ้ำไม่ได้ |
| web-dist inode ×2 | ตรง | อ่านไฟล์ VPS ไม่ได้ | ตรวจไม่ได้ |
| hermes answers ×2 | 200 · ไม่มี inline image | ต้อง `POST` | ตรวจไม่ได้ |

รวม: ตรง 16 · ไม่ตรง/ทำซ้ำไม่ได้ 2 · ตรวจไม่ได้ 4 (จาก 22)

**ข้อสังเกตเรื่อง 71:** ฟีดสาธารณะอาจกรองเฉพาะ `active` หรือสคริปต์ของเดวิดอ่านจากอีก endpoint ผมไม่รู้ จึงไม่ฟันธงว่าผิด แต่ **ตัวเลขนี้ตรวจซ้ำโดยผู้อื่นไม่ได้** และ `kb_colour_counts.py` (ซึ่งใบนี้ให้ตรวจ "ตัวเลขสี") ก็ไม่มีผลดิบมายืนยัน

**ข้อสังเกตเรื่องหลักฐาน** (`qa/runtime-evidence-20261009/`):
- `README.md` บอกว่าผลรันเป็นภาพ ณ เวลาหนึ่ง "ระบุในหัวไฟล์" แต่ `verify-deploy-output.txt` **ไม่มีหัวเวลา** (เริ่มที่ `A) containers`) ผมเดาเวลาจาก `Up About a minute` ที่ตรงกับ `Up 2 minutes` ของผม ⇒ ราว 15:49 น. เท่านั้น
- `checksums.md` มี md5 ของ 6 ไฟล์ **ไม่มี** `knight_watchdog.sh`, `knightbasins_watchdog.sh`, `kb_colour_counts.py` ซึ่งเป็นสคริปต์ที่รอบนี้แก้ ⇒ ผู้ตรวจยืนยันไม่ได้ว่าเวอร์ชันที่รันตรงกับที่แก้

## 4. B — สแกนโฮสต์ที่ถอดแล้ว

**ฝั่ง Hermes (`/opt/data/...`) และ VPS (`/root`, `/docker/*`):** **ตรวจไม่ได้** ผมอ่านไฟล์เหล่านั้นไม่ได้ จึงไม่ยืนยัน "0 บรรทัด" และไม่ยืนยัน 18+4 ไฟล์ที่เดวิดอ้าง

**ฝั่ง repo (`git grep "srv1964473"` ที่ `ad78709`, ไม่รวม `qa/`/`KANBAN.md`) — วัดตรง:**

| ไฟล์:บรรทัด | เนื้อหา | จัดว่า |
|---|---|---|
| `artifacts/api-server/test/canonical-media-url.test.ts:20,32,56` | fixture ของเทสต์ | ✅ ตั้งใจ (เทสต์ว่าโฮสต์เก่าถูกแปลง) |
| `artifacts/api-server/test/line-auth.test.ts:76` | fixture ของเทสต์ปฏิเสธโฮสต์เก่า | ✅ ตั้งใจ |
| `artifacts/knight-basins/test/domain-canonical.test.ts:4,17` | ค่ากันหลุดของเทสต์ | ✅ ตั้งใจ |
| `artifacts/api-server/src/lib/catalog-media.ts` | ค่าคงที่ `LEGACY_MEDIA_HOST_SUFFIX` | ✅ ตั้งใจ (ตัวแปลง) |
| `deploy/hostinger/nginx.conf:27` | คอมเมนต์อธิบายว่าโฮสต์เก่าเลิกใช้และ wildcard DNS ยังชี้ VPS | ✅ ถูกต้อง (แก้ตามข้อ H1 ของผมแล้ว) |
| `docs/team/ONBOARDING-freebuff.md:48` | บอกว่าปลดระวางแล้ว | ✅ ประวัติ |
| `deploy/hostinger/README.md:119` · `…/IntegratedAdmin.tsx:37-38` | `api.srv1964473…` (Hermes API ที่บอสสั่งให้เก็บ) | ✅ นอกขอบเขต |
| `attached_assets/Pasted-*.txt` (2 ไฟล์) | ข้อความที่วางไว้เป็นประวัติ | ✅ ประวัติ |

⇒ ไม่เหลือบรรทัดที่เป็นคำสั่ง/ค่าที่ทำงานจริงใน repo

**เว็บสาธารณะ — วัดตรง:** `robots.txt` · `sitemap.xml` · `sitemap_index.xml` · `llms.txt` · `llms-full.txt` ทั้ง 5 ไฟล์ตอบ 200 และมี `srv1964473` **0 จุด** · `/api/catalog` (111 KB) 0 จุด · `redirect_uri` ของ `/api/auth/line/login` เป็น `https://knightbasins.com/api/auth/line/callback`

## 5. C — ใบรับรองที่เสิร์ฟจริง (ผ่าน)

`openssl s_client -connect 72.62.79.84:443 -servername <host>`

| SNI | CN | SAN | ออกเมื่อ (ไทย) | หมดอายุ | ผู้ออก |
|---|---|---|---|---|---|
| `knightbasins.com` | knightbasins.com | `knightbasins.com`, `www.knightbasins.com` | 9 ต.ค. 69 12:51 | **7 ม.ค. 70** (05:51 UTC) | Let's Encrypt YR2 |
| `www.knightbasins.com` | (ใบเดียวกัน, serial `05B3…3F4`) | เหมือนข้างบน | เหมือนกัน | เหมือนกัน | |
| `line.knightbasins.com` | line.knightbasins.com | `line.knightbasins.com` (เดียว) | 9 ต.ค. 69 12:51 | **7 ม.ค. 70** | Let's Encrypt YR2 |

- `srv1964473` ใน SAN: **0** ทั้งสองใบ · `ssl_verify_result` = 0 (chain ถูกต้อง)
- `curl https://knightbasins.com/api/healthz` → **200** (`application/json`)
- โฮสต์เก่า (SNI เดิม) ได้ `CN=TRAEFIK DEFAULT CERT` + `404 page not found` ⇒ ไม่มีใบ/เราเตอร์ของมันแล้ว
- ผลที่เดวิดอ้างข้อ 8 (SAN = com+www · line เดียว · 7 ม.ค. 70) **ตรง** · งาน `knight-cert-renewal-check-dec` (1 ธ.ค. 69 02:00) มีอยู่ในตารางของเดวิด ⇒ ข้อ H2 ของรอบแรกถูกรับไปแล้ว

## 6. D — `LINE_PUBLIC_URL`

**ตรวจไม่ได้:** อ่าน `/opt/data/.env` ไม่ได้ ผมไม่เห็นค่า (แม้ปิด host)

**หลักฐานแวดล้อม (proxy ไม่ใช่ตัวค่า):**
- `status` เวลา 15:51 น.: `hermes-agent-2xwn-hermes-agent-1 Up 5 days` · `line-proxy Up 3 hours` · `traefik Up 2 hours`
- เดวิดเขียนเองว่า adapter อ่านค่า "ครั้งเดียวตอน start ⇒ ต้อง restart gateway"
- container ไม่ได้ถูก recreate ใน 5 วัน ⇒ ถ้าไม่มีการ restart process ใน container (เช่น `restart_gateway.sh`) **ค่าใหม่ยังไม่มีผล** · ผมแยกไม่ได้ว่า process ข้างในถูก restart หรือไม่ (uptime ที่เห็นคือของ container)
- `LINE_CALLBACK_URL` ฝั่งเว็บ (คนละตัวกับ `LINE_PUBLIC_URL`) ถูกต้องแล้ว: `redirect_uri` = `https://knightbasins.com/api/auth/line/callback`

**ข้อสรุป:** ห้ามนับว่า D ผ่านจนกว่าเดวิดจะแนบ (1) ค่าปิด host (2) เวลาเริ่มของ gateway process (3) ผลหลัง restart

## 7. E — กลไก `intentionally-stopped-containers`

**ตรวจไม่ได้:** สคริปต์ `knight_watchdog.sh` และไฟล์ state ไม่อยู่ใน repo และผมสร้างสำเนาบน VPS ไม่ได้ จึงทดสอบ "เตือน → เงียบ" ไม่ได้

หลักฐานอ้อม: `status` แสดง container ที่รันอยู่ 7 ตัว **ไม่มี** `knight-images-admin` กับ `n8n-n8n-1` ซึ่งสอดคล้องกับที่เดวิดบอกว่าบอสหยุดเอง (แต่ผมไม่รู้ว่า `status` กรองรายการหรือไม่)

**ข้อกังวลเชิงออกแบบ (ไม่ใช่บั๊กที่พิสูจน์ได้):** ไฟล์ state ที่ทำให้ watchdog เงียบ ถ้าไม่มีวัน/เหตุผลกำกับ จะเงียบถาวรแม้ container นั้นควรกลับมาแล้ว ควรให้ watchdog เตือนซ้ำเป็นระยะ ("ข้าม X มา N วันแล้ว") หรือให้แต่ละรายการมีวันหมดอายุ

## 8. F และ G

### F — ล่าของหลงเหลือ

| แหล่ง | คำสั่ง/วิธี | ผล | ชนิด |
|---|---|---|---|
| crontab root | ต้องรัน `crontab -l` บน VPS | **ตรวจไม่ได้** | — |
| systemd units/timers | ต้องรัน `systemctl list-timers` บน VPS | **ตรวจไม่ได้** | — |
| docker volumes + ACME store | ต้องอ่าน `acme.json` | **ตรวจไม่ได้** · ตัวแทน: ใบใหม่ 3 ใบไม่มีชื่อเก่า · โฮสต์เก่าได้ default cert · `tfmeta` ⇒ `lines_for_host=0` | proxy |
| เอกสาร/KB/ใบงานเก่า | `git grep srv1964473` ใน repo | **มี** แต่เป็นประวัติ/เทสต์/คอมเมนต์ทั้งหมด (§4) · `KANBAN.md` มีบันทึกประวัติหลายบรรทัด | วัดตรง |
| Hermes cron (ตารางของเดวิด `cron-jobs-summary.md`) | อ่านไฟล์ | 18 งาน แต่ไม่แสดงเนื้อคำสั่ง ⇒ ผมไม่รู้ว่าแต่ละงานยิง URL ไหน | ข้อมูลจากเดวิด |

**Endpoint ที่ตรวจได้จากภายนอก (GET, ผมวัดเอง):**

| Endpoint | HTTP |
|---|---|
| `https://knightbasins.com/api/healthz` | 200 |
| `https://knightbasins.com/api/catalog` | 200 |
| `https://knightbasins.com/` · `/readme` · `/studio` · `/sketch` | 200 |
| `https://knightbasins.com/robots.txt` · `sitemap.xml` · `llms.txt` · `llms-full.txt` | 200 |
| `https://www.knightbasins.com/` | 301 |
| `https://line.knightbasins.com/line/webhook` (GET) | **405** (มีเส้นทาง รับ POST เท่านั้น) |
| `https://line.knightbasins.com/` · `/health` · `/healthz` | **404** |
| `https://knightbasins.srv1964473.hstgr.cloud/…` และ `line.srv1964473…/…` (/, /media/…, /api/healthz) | 404 ทั้ง 6 |

**จุดเสี่ยงที่ควรให้เดวิดเช็ก:** ถ้าตัวตรวจฝั่ง LINE ยิง `/` หรือ `/health` ของ `line.knightbasins.com` จะได้ 404 ทุกครั้ง (เป็นประเภทเดียวกับ "เตือนหลอก HTTP 000" ที่เพิ่งแก้) ⇒ ควรยืนยันว่า endpoint ที่ใช้คือ `/line/webhook` (405 = ปกติ) ไม่ใช่ `/`

### G — LINE ส่งสื่อ

**ตรวจไม่ได้ (รอยืนยัน restart).** สิ่งที่วัดได้:
- `GET https://line.knightbasins.com/media/faketoken0000/fake.jpg` → **404** `text/plain` 14 B เนื้อหา `404: Not Found` ไม่ใช่ 502
- เส้นทางที่ไม่มีอยู่จริง (`/nonexistent-route-zz`) ตอบเหมือนกันทุกไบต์ ⇒ **แยก "ถึง gateway" ออกจาก "proxy ไม่มี location นี้" ไม่ได้** จากสถานะ/ขนาด · รูปแบบข้อความ (`404: Not Found` / `405: Method Not Allowed` ข้อความเปล่า) เหมือน aiohttp และต่างจากหน้า HTML 404 ปกติของ nginx ⇒ **อนุมานว่า** คำขอไปถึง gateway แต่เป็นการอนุมาน
- log ว่า LINE ดึงสื่อจริงหรือไม่: เห็นไม่ได้ (`apilog` เป็น log ของ API ไม่ใช่ gateway)

## 9. คำสั่งที่เดวิดต้องรันเพื่อปิดข้อ "ตรวจไม่ได้" (แนบผลดิบ ปิดค่าลับ)

1. A: `sh /opt/data/bin/knight_watchdog.sh; echo exit=$?` · `bash /opt/data/scripts/knightbasins_watchdog.sh; echo exit=$?` · `kb_colour_counts.py` · `verify_deploy.py | tail -3` (พร้อมวันเวลา `date`)
2. A: ระบุ endpoint ที่ให้ได้ "71 codes" และเหตุที่ต่างจากฟีดสาธารณะ 68
3. B: `grep -rn "knightbasins.srv1964473\|line.srv1964473" /opt/data/bin /opt/data/scripts /opt/data/knight-design-kb | grep -v "\.bak"` และ `grep -rl … /root /docker/*/*.yml /docker/*/.env` (ระบุไฟล์:บรรทัดที่เหลือ)
4. D: `grep -c '^LINE_PUBLIC_URL=https://line.knightbasins.com$' /opt/data/.env` (พิมพ์แค่ 0/1) + เวลาเริ่มของ gateway process (`ps -o lstart,cmd -C python3` หรือเทียบ `docker inspect -f '{{.State.StartedAt}}'`)
5. E: สำเนา `knight_watchdog.sh` + สำเนา state → ลบ `knight-images-admin` ⇒ รัน (ต้องเตือน) → ใส่กลับ ⇒ รัน (ต้องเงียบ) → ลบสำเนา
6. F: `crontab -l | grep -i srv1964473` · `systemctl list-timers --all | grep -i srv1964473` · `grep -c srv1964473 /docker/traefik/acme.json` (พิมพ์แค่จำนวน)
7. G: หลัง restart gateway: `GET` เส้นทาง media ด้วย token ปลอม + แนบบรรทัด log ที่มีคำขอ media จริง
8. เพิ่ม md5 ของ `knight_watchdog.sh`, `knightbasins_watchdog.sh`, `kb_colour_counts.py` ใน `checksums.md` และใส่เวลาในหัว `verify-deploy-output.txt`

## 10. เช็คลิสต์ท้ายใบ

| # | สิ่งที่ต้องยืนยัน | ผล |
|---|---|---|
| 1 | watchdog ทั้ง 2 ตัว | **ตรวจไม่ได้** |
| 2 | verify_deploy 22/22 | **ตรวจไม่ได้** (ตัวแทน 16/22 ตรง · 2 ทำซ้ำไม่ได้ · 4 ตรวจไม่ได้) · ไฟล์ของเดวิดเขียน 22/22 |
| 3 | kb_colour_counts | **ตรวจไม่ได้** |
| 4 | grep ฝั่ง Hermes | **ตรวจไม่ได้** |
| 5 | grep ฝั่ง VPS | **ตรวจไม่ได้** · ฝั่ง repo **ผ่าน** |
| 6 | cert com/www | **ผ่าน** |
| 7 | cert line | **ผ่าน** |
| 8 | LINE_PUBLIC_URL | **ตรวจไม่ได้** · container ไม่ได้ recreate ⇒ ยังไม่มีผลเว้นแต่ restart process |
| 9 | กลไก state file | **ตรวจไม่ได้** |
| 10 | ล่าของหลงเหลือ ≥4 แหล่ง | **ผ่านบางส่วน** (repo + endpoint · crontab/systemd/volumes ตรวจไม่ได้) |
| 11 | endpoint ที่สคริปต์เรียก | **ผ่านเท่าที่เห็น** (200/405 ตามคาด · `line` `/` = 404 ให้เดวิดยืนยัน) |
| 12 | ข้อ G | **ตรวจไม่ได้ (รอยืนยัน restart)** |

## 11. สิ่งที่ผมไม่ได้ทำ

ไม่ `POST` · ไม่เขียน/ลบ/restart อะไรบน production · ไม่ merge PR ของเดวิด · ไม่พิมพ์ค่าลับ (ค่า client id ที่เห็นใน URL ของ LINE ไม่ได้ลงรายงานนี้) · ไม่แก้ของที่พบ

**หมายเหตุตรงไปตรงมา:** รอบแรก (#411) ผมระบุข้อ H7 ว่า Hermes/n8n/Search Console/GBP "ไม่ถูกครอบคลุม" รอบนี้เดวิดพบของหลงเหลือฝั่ง Hermes (watchdog, `.env`, สคริปต์ 22 ไฟล์) ตรงจุดนั้นพอดี ผมเองก็ตรวจส่วนนั้นไม่ได้ทั้งรอบแรกและรอบนี้ เพราะสิทธิ์
