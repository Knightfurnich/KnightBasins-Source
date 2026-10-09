# ใบงาน 293-C (ชัย) — **ตรวจซ้ำรอบ 2**: ยืนยันการแก้ของเดวิดหลังรีวิว 291 + ล่าของที่ยังหลงเหลือ

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** รีวิว 291 ของชัยชี้ 4 จุด (คอมเมนต์ DNS · audit logs · cert · ลำดับงาน) → เดวิดแก้ครบแล้ว **และหลังรีวิว เดวิดพบของหลงเหลือเพิ่มอีกชุด** (watchdog เตือนหลอก HTTP 000 + `LINE_PUBLIC_URL` ชี้โฮสต์ที่ถอดแล้ว + ไฟล์สคริปต์อีก 22 ไฟล์) ⇒ บอสสั่งให้ตรวจซ้ำ
**กติกา:** รายงานของเดวิด = คำให้การ · ทุกข้อต้องรันเองแล้วแนบผลดิบ · ตรวจไม่ได้ให้เขียน "ตรวจไม่ได้ + เหตุผล" **ห้ามเดา**

## สิ่งที่เดวิดอ้างว่าแก้ในรอบนี้ (รอบ 2)
```
1) watchdog เตือนหลอก "API Healthz HTTP 000": ตัวตรวจยังยิงไปโฮสต์เก่า → แก้เป็น https://knightbasins.com/api/healthz
   (สคริปต์ scripts/knightbasins_watchdog.sh + bin/knightbasins_watchdog.sh)
2) ไล่สแกน bin/ + scripts/ ทั้งโฟลเดอร์ → แก้ 18 ไฟล์ที่ยังชี้โฮสต์เก่า (รวม cron ที่รันจริง: kb_colour_counts.py รายวัน 00:00 ·
   knight_watchdog.sh ทุก 60 นาที · kb_web_asset_check.py · push_indexnow.py · gsc_deep_check.py · seo_onpage_check.py ·
   line-proxy/docker-compose.yml สำเนา · restart_gateway.sh · recreate_hermes_with_ratelimit.sh ฯลฯ) · สำรอง *.bak-legacyhost*
3) แก้บน VPS อีก 4 ไฟล์: /root/knight-audit.sh · /root/knight-audit2.sh · /root/deploy-dns.sh · /docker/hermes-agent-2xwn/docker-compose.yml (คอมเมนต์)
4) .env: LINE_PUBLIC_URL เปลี่ยนจากโฮสต์ที่ถอดแล้ว → https://line.knightbasins.com
   (adapter ใช้ค่านี้สร้าง URL รูป/วิดีโอที่ส่งให้ลูกค้า ⇒ ชี้ผิด = รูปพังฝั่งลูกค้า · อ่านค่า "ครั้งเดียวตอน start" ⇒ ต้อง restart gateway)
5) cron knight-bundle-watch: prompt ยังบอก verify_deploy "18/18" → แก้เป็น 22/22 + ระบุโฮสต์จริง
6) KB: ONBOARDING-freebuff.md · audit.sh · api-proxy/hermes-compose.yml · PENDING.md
7) ระบบใหม่: /opt/data/state/intentionally-stopped-containers (knight-images-admin · n8n-n8n-1) ให้ watchdog ข้ามการตรวจ container ที่บอสหยุดเอง
8) ก่อนหน้านี้: บังคับออก cert ใหม่ (knightbasins.com/www SAN = com+www เท่านั้น · line = line เดียว · หมดอายุ 7 ม.ค. 70)
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **ยืนยันการแก้รอบ 2 ด้วยตาตัวเอง** — รันตัวเฝ้าระวังและตัวตรวจเอง (แนบผล):
       `sh /opt/data/bin/knight_watchdog.sh` → ต้อง **เงียบ** (ยกเว้นรายการที่อยู่ใน intentionally-stopped-containers)
       `bash /opt/data/scripts/knightbasins_watchdog.sh` → ต้อง **เงียบ**
       `/opt/hermes/.venv/bin/python3 /opt/data/bin/kb_colour_counts.py` → ต้องได้ตัวเลขสี (ซื้อแผ่น/ติดตั้ง) และไฟล์ KB ตรง
       `HERMES_HOME=/opt/data /opt/hermes/.venv/bin/python3 /opt/data/bin/verify_deploy.py` → **22/22 passed**
  B. **สแกนหาโฮสต์ที่ถอดแล้วด้วยตัวเองทั้งสองฝั่ง** (ต้องได้ 0 บรรทัดที่ "ทำงานจริง" — คอมเมนต์/ไฟล์ประวัติยกเว้นได้ ให้ระบุ):
       Hermes: `grep -rn "knightbasins.srv1964473\|line.srv1964473" /opt/data/bin /opt/data/scripts /opt/data/knight-design-kb /opt/data/.env | grep -v "\.bak"`
       VPS:    `grep -rl "knightbasins.srv1964473\|line.srv1964473" /root /docker/*/*.yml /docker/*/.env` (ยกเว้น acme.json/สำรอง)
     เกณฑ์: ไม่เหลือบรรทัดที่เป็นคำสั่ง/ค่าจริง (คอมเมนต์อธิบายประวัติ = ผ่าน แต่ต้องระบุไฟล์+บรรทัด)
  C. **ตรวจใบรับรองที่เสิร์ฟจริง** (จากข้างนอก เชื่อม 72.62.79.84:443 ด้วย SNI):
       knightbasins.com · www.knightbasins.com → SAN ต้องมีแค่ com + www (ห้ามมี srv1964473) · line.knightbasins.com → SAN = line เดียว
       เกณฑ์: **ไม่มีคำว่า srv1964473 ใน SAN ของสองโดเมนนี้** + ระบุวันหมดอายุ (คาด ~7 ม.ค. 70)
  D. **ตรวจค่าที่เป็นความเสี่ยงลูกค้า**: อ่าน `LINE_PUBLIC_URL` จาก `/opt/data/.env` แล้วรายงาน **แบบปิด host** (ห้ามพิมพ์ค่าเต็ม/ห้ามพิมพ์คีย์)
     เกณฑ์: ต้องเป็น `line.knightbasins.com` · และระบุว่าการเปลี่ยนค่านี้ต้อง restart gateway จึงมีผล (ถ้ายังไม่ restart = ยังไม่มีผล)
  E. **ทดสอบกลไก `intentionally-stopped-containers`** โดยไม่แตะ production:
       คัดลอก `bin/knight_watchdog.sh` ไปไฟล์ชั่วคราว แล้ว (1) ลบชื่อ `knight-images-admin` ออกจากสำเนาไฟล์ state → รัน → ต้อง **เตือน** เรื่องหน้าจัดการรูป
       (2) ใส่ชื่อกลับ → รัน → ต้อง **เงียบ** (แนบสองผล) · คืน/ลบไฟล์ชั่วคราวให้เรียบร้อย
  F. **ล่าของที่ยังหลงเหลือ** (อย่างน้อย 4 แหล่ง — ตรวจและรายงานว่ามี/ไม่มี):
       crontab ของ root · systemd units/timers · docker volumes + ACME store · เอกสาร/KB/ใบงานเก่า ·
       และ **endpoint ที่สคริปต์ตรวจเรียกจริง** (ต้องมีอยู่จริง ไม่ใช่ 404) — ระบุชื่อ endpoint + HTTP code
  G. **LINE ส่งสื่อได้จริงไหม** (ข้อที่ยังค้าง): ถ้า gateway ยังไม่ restart ให้เขียนว่า **ตรวจไม่ได้ (รอ restart)** ·
       ถ้า restart แล้ว ให้ยิงทดสอบเส้นทาง media (`GET https://line.knightbasins.com/media/<token>/<file>` ด้วย token ปลอม → ต้องได้ 404 ที่ "ถึง gateway" ไม่ใช่ 502)
       + ตรวจ log ว่ามีคำขอ media ที่ LINE ดึงไปจริง (แนบผล)

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-chai-review-david-round2-20261009.md      (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-293-chai-review-david-round2-20261009.md      อ่านเท่านั้น
  - /opt/data/bin/knight_watchdog.sh · /opt/data/scripts/knightbasins_watchdog.sh   รัน/อ่าน
  - /opt/data/bin/verify_deploy.py · /opt/data/bin/kb_colour_counts.py              รัน/อ่าน
  - /opt/data/state/intentionally-stopped-containers                                อ่าน
  - /opt/data/cron/jobs.json · /opt/data/.env                                       อ่านเท่านั้น (ห้ามพิมพ์ค่าลับ)

FORBIDDEN:
  - ห้ามแก้ production: ห้าม UPDATE/DELETE/INSERT ใน DB · ห้าม restart/recreate container · ห้ามแก้ config/ไฟล์บน VPS (ยกเว้นสำเนาชั่วคราวในข้อ E ที่ต้องลบ)
  - ห้าม merge/แก้ PR ของเดวิด · ห้าม push ตรงเข้า `main`
  - ห้ามพิมพ์ค่า `.env`/คีย์/token ลงรายงาน (ปิดค่าเสมอ) · ห้ามแตะราคา/รหัสสี/`active`
  - ห้าม "ตรวจ" ด้วยการอ่านรายงานของเดวิดแล้วตอบว่าเห็นด้วย

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) ผลรัน 4 ตัวตรวจในข้อ A (watchdog ×2 ต้องเงียบ · kb_colour_counts ตัวเลขสี · verify_deploy 22/22)
  2) ผล grep ทั้งสองฝั่งในข้อ B (พร้อมระบุว่าเหลือเฉพาะคอมเมนต์/ประวัติไฟล์ใด)
  3) ผล `openssl s_client` ของสองโดเมน (SAN + วันหมดอายุ) + `curl -s -o /dev/null -w "%{http_code}" https://knightbasins.com/api/healthz` ในข้อ C
  4) ค่า LINE_PUBLIC_URL แบบปิด host + ข้อสรุปเรื่อง restart ในข้อ D
  5) ผลทดสอบสองทางของกลไก state file (เตือน → เงียบ) ในข้อ E + ยืนยันว่าไม่มีไฟล์ชั่วคราวเหลือ (`git status --porcelain` = 0)
  6) ข้อ F: ≥4 แหล่ง พร้อมคำสั่ง + ผล (มี/ไม่มี) + endpoint ที่สคริปต์เรียกจริงกับ HTTP code
  7) ข้อ G: ผลทดสอบเส้นทาง media หรือระบุ "ตรวจไม่ได้ (รอ restart)" พร้อมเหตุผล
  8) commit SHA ของสาขารายงาน + เวลาไทยที่ตรวจ · ตัวเลข baseline (22/22 · 0 บรรทัด · SAN ไม่มีชื่อเก่า)

OUTPUT:
  - `qa/report-chai-review-david-round2-20261009.md` — ตาราง A–G: **ผ่าน / ไม่ผ่าน / ตรวจไม่ได้** + หลักฐานดิบสั้น ๆ
  - สรุป 5 บรรทัด: อะไรยืนยันได้ · อะไรยังไม่น่าเชื่อถือ · ของที่เดวิดยังมองข้าม · ข้อเสนอ · ความเสี่ยงคงเหลือ
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานสั้นในแชท

STOP:
  - เมื่อครบ A–G และมีผลดิบครบ · หรือทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
  - ห้ามขยายขอบเขตไปแก้ของที่พบ (รายงานอย่างเดียว) — พบปัญหาที่กระทบ production ให้รายงานเดวิด/บอสทันที
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | watchdog ทั้ง 2 ตัว | รันแล้วเงียบ |
| 2 | verify_deploy | 22/22 passed |
| 3 | kb_colour_counts | ได้ตัวเลขสี + KB ตรง |
| 4 | grep ฝั่ง Hermes | 0 บรรทัดที่ทำงานจริง |
| 5 | grep ฝั่ง VPS | 0 บรรทัดที่ทำงานจริง |
| 6 | cert com/www | SAN ไม่มี srv1964473 |
| 7 | cert line | SAN = line เดียว |
| 8 | LINE_PUBLIC_URL | เป็นโดเมนใหม่ (ปิดค่า) + ระบุเรื่อง restart |
| 9 | กลไก state file | เตือนเมื่อเอาชื่อออก · เงียบเมื่อใส่กลับ |
| 10 | ล่าของหลงเหลือ ≥4 แหล่ง | มีคำสั่ง + ผล |
| 11 | endpoint ที่สคริปต์เรียก | มีจริง (ระบุ code) |
| 12 | ข้อ G (media/LINE) | มีผล หรือระบุ "รอ restart" |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → ชัย] ใบ 293-C ครับ — ตรวจซ้ำรอบ 2 หลังรีวิว 291 ของคุณ
เรื่อง: เดวิดแก้ตามรีวิว 291 ครบ (คอมเมนต์ DNS · audit logs · cert · ลำดับงาน) แล้วบอสให้ตรวจซ้ำ + รอบนี้เจอของหลงเหลือเพิ่ม:
  • watchdog เตือนหลอก "API Healthz HTTP 000" (ตัวตรวจยังยิงโฮสต์เก่า) → แก้แล้ว · ทั้ง 2 watchdog เงียบ
  • ไล่ grep ครบทั้ง bin/ + scripts/ → แก้ 18 ไฟล์ (รวม cron รายวัน/รายชั่วโมง) + บน VPS อีก 4 ไฟล์ (/root/*.sh + คอมเมนต์ compose)
  • .env: LINE_PUBLIC_URL ชี้โฮสต์ที่ถอดแล้ว (adapter ใช้สร้าง URL รูปที่ส่งให้ลูกค้า!) → แก้เป็น line.knightbasins.com (ต้อง restart gateway จึงมีผล)
  • cron bundle-watch prompt เลข 18/18 → 22/22 · KB 4 ไฟล์ · เพิ่ม state/intentionally-stopped-containers ให้ watchdog ข้าม container ที่บอสหยุดเอง
ให้ตรวจเอง (อ่านอย่างเดียว): A รัน watchdog×2 + verify_deploy 22/22 + kb_colour_counts · B grep สองฝั่งต้อง 0 · C cert SAN สองโดเมนต้องไม่มีชื่อเก่า · D LINE_PUBLIC_URL (ปิดค่า) + เรื่อง restart · E ทดสอบกลไก state file (เตือน↔เงียบ) · F ล่าของหลงเหลือ ≥4 แหล่ง + endpoint ที่สคริปต์เรียก · G เส้นทาง media/LINE (ถ้าไม่ restart = เขียนว่าตรวจไม่ได้)
ห้าม: แก้ prod/DB · restart/recreate · แก้ไฟล์บน VPS (ยกเว้นสำเนาชั่วคราวข้อ E ที่ต้องลบ) · merge PR เดวิด · พิมพ์ค่าลับ
ผลลัพธ์: qa/report-chai-review-david-round2-20261009.md + PR (docs) + ระบุ ผ่าน/ไม่ผ่าน/ตรวจไม่ได้ ทีละข้อ · STOP 12 turns
```
