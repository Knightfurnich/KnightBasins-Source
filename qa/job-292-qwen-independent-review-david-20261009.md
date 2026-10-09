# ใบงาน 292-Q (Qwen) — **ทบทวนงานของเดวิดแบบอิสระ** รอบ 9 ต.ค. 69: ถอดโฮสต์เก่า `*.srv1964473.hstgr.cloud` (SEO + GSC + รายงาน + โมเดลฟรี)

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Qwen** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** บอสสั่งให้ Qwen ทบทวนงานของเดวิดแบบอิสระ (งาน ops + รายงาน SEO/GSC และโมเดลฟรีที่เดวิดเพิ่งทำไป — เดวิดรับรองงานตัวเองไม่ได้)
**กติกาของใบนี้: รายงานของเดวิด = คำให้การ ไม่ใช่ข้อเท็จจริง** — ทุกข้อต้องใช้เครื่องมือของตนตรวจ/รันจริงแล้วแนบผล ห้ามยอมรับเพราะเดวิดพูด และจำกัดขอบเขตการเขียนไฟล์

## สิ่งที่เดวิดอ้างว่าทำเสร็จและปรับปรุงรอบนี้ (ให้ตรวจทีละข้อ)

```
1) ซ่อมรายงาน Crawler (knight_crawler_report.sh): นับเฉพาะ URL ใน sitemap.xml จริง (=12 หน้า)
   · ไม่นับซ้ำ sitemap_index.xml เป็น 22 (ของเดิมบวกสองไฟล์) · แยกสัญญาณกลางทาง (บอทยิง 220 path) ออก ไม่เอาไปปนกับหน้าเนื้อหา
   · ยิงเช็ค HTTP ของ asset เก่า 10 ไฟล์ก่อนเสนอวิธีแก้ (พบว่า 200 ทุกไฟล์ ไม่ต้องทำ fallback ตามที่เคยแนะนำ)
2) ซ่อมรายงาน index ของ GSC (gsc_report.py): ตรวจสถานะรายหน้าครบ 12/12 URL จาก sitemap จริง (ไม่ใช่สุ่ม 4 หน้า)
   · ยินยันสถานะ index แล้ว 12/12 หน้าจริง (รวม /network ด้วย) · GSC มีการแสดงผลครั้งแรกแล้ว (=4 ครั้ง) คลิก 0 ตำแหน่งเฉลี่ย 8.2
3) ปรับ prompt ของ cron: แก้ไขกติกาของ knight-gsc-crawler-tracker (49a70660d863) ให้ยึดเกณฑ์แม่นยำด้านบน
   · และตั้งหนัดสลับรอบรายงานเป็นรายสัปดาห์ (จันทร์ 09:00 ไทย) ล่วงหน้าแล้วในวันที่ 23 ต.ค. 69 (id 35a2ee5e7d06)
4) ซ่อมแซมสายสำรอง (fallback chain) ของระบบ: qwen/qwen3.8-27b:free ถูกถอดออกจาก OpenRouter (ยิง API ยืนยัน)
   · แทนที่ด้วย dots-studio/dots-3-note-preview:free แต่ตรวจพบว่ามีวันหมดอายุ (31 ธ.ค. 69)
   · สุดท้ายเดวิดเปลี่ยนเป็น apodex/apodex-1.1-mini:free (ไม่มีวันหมดอายุ และผ่าน privacy probe = safe ไม่ฝึกข้อมูล)
   → chain ปัจจุบัน: gemini-3.5-flash -> cohere/north-mini-code:free -> apodex/apodex-1.1-mini:free -> deepseek/deepseek-chat
5) ย้ายงานเบาไปใช้โมเดลฟรี: ตั้งค่าให้ cron สองงานใหญ่ (knight-gsc-crawler-tracker และ knight-bundle-watch)
   เรียกใช้ cohere/north-mini-code:free (ผ่าน OpenRouter) แทนโมเดลหลัก เพื่อลดค่าใช้จ่าย
   · เดวิดอ้างว่าทดสอบ cohere ตอบไทยจบสมบูรณ์ (113 ตัวอักษร) และเรียก tool ตรวจสุขภาพได้จริง (ไม่กินโควตาและตอบไม่ว่างแบบ apodex)
6) เปิดใช้ knight-bundle-watch (d55339f2f5c8) กลับมาทำงาน: และเปลี่ยนเป็นเด้งบอกทาง Telegram แทน local เมื่อมี deploy
   · แก้ตัวเฝ้า bundle (knight_bundle_probe.sh) และ verify_deploy.py ให้ใช้ https://knightbasins.com (ของเดิมชี้โฮสต์เก่า 301/404)
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **ตรวจและพิสูจน์รายงาน Crawler + GSC สด** — รันสคริปต์รายงานด้วยตนเอง:
       `sh /opt/data/bin/knight_crawler_report.sh` (รันสด)
     เกณฑ์:
       1. ตัวเลข "หน้าเนื้อหาตาม sitemap" ต้องเป็น **12** (ไม่ใช่ 22 หรือ 236)
       2. สถานะ index ของหน้า `/network` และหน้าอื่น ๆ ต้องแสดงผลจริงตามที่เดวิดอ้าง (และเทียบกับ GSC API)
       3. แถว GSC ของ sitemap สี่แถวในรายงานต้องไม่มี error (errors=0)
  B. **พิสูจน์ความถูกต้องของ fallback chain** — ตรวจสอบ `config.yaml` และรัน watchdog:
       `python3 /opt/data/bin/model_rate_limit_watch.py --dry-run`
     เกณฑ์:
       1. chain ต้องอ้าง `apodex/apodex-1.1-mini:free` (ไม่มี `qwen3.8` หรือ `dots-3`)
       2. watchdog ต้องรายงาน: **"รุ่นใน chain ที่มีวันหมดอายุ: ไม่มี"** และ **"ผลตัดสิน: ปกติ — จะเงียบ"**
  C. **พิสูจน์ข้ออ้างเรื่องโมเดลฟรี (cohere vs apodex)** — ยิง API ทดสอบสั้น ๆ (ผ่าน python/curl) ไปยัง OpenRouter:
       1. ยิง `apodex/apodex-1.1-mini:free` ถามคำถามภาษาไทย → ต้องได้ **content=None** (หรือจบด้วย finish=length/พร่ำคิดในคิด)
       2. ยิง `cohere/north-mini-code:free` ถามเดียวกัน → ต้องได้คำตอบภาษาไทยสั้น ๆ ที่อ่านรู้เรื่องและจบสมบูรณ์ (finish=stop)
       3. ทดสอบ tool calling ของทั้งสามตัว (dots, cohere, apodex) ด้วย tool จำลอง → ทุกตัวต้องยอมเรียก tool
  D. **ตรวจความปลอดภัย (Privacy Probe) ของโมเดลฟรี** — ตรวจสอบว่าโมเดลฟรีที่เหลือ 12 ตัวใน OpenRouter บังคับยอมให้ฝึกข้อมูลจริงหรือไม่:
       • ยิง `nvidia/nemotron-3-super-120b-a12b:free` ด้วยบล็อก `provider: {"data_collection": "deny"}` → ต้องได้ **HTTP 404/403 (data policy error)**
       • ยิง `apodex/apodex-1.1-mini:free` และ `cohere/north-mini-code:free` ด้วยบล็อกเดียวกัน → ต้องได้ **HTTP 200 (safe)**
  E. **ตรวจความเรียบร้อยของระบบตรวจจับ (Verify Deploy + Bundle Probe)**:
       • รัน `/opt/hermes/.venv/bin/python3 /opt/data/bin/verify_deploy.py` → ต้องได้ **22/22 passed** (ห้ามมี 301/404)
       • รัน `sh /opt/data/bin/knight_bundle_probe.sh` → ต้องคืนค่าเป็นชื่อไฟล์ `.js` จริง (ไม่ใช่ PROBE_FAILED)
  F. **ตรวจสถิติการใช้งานในระบบจริง** — อ่าน `/opt/data/hermes-usage/.ledger.jsonl`:
       • สรุปสัดส่วนการใช้โมเดล (calls, tokens, cost) ของเซสชันนี้และเซสชันก่อนหน้า เพื่อให้บอสเห็นต้นทุนจริงและตัวเลขที่ประหยัดได้จริง

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-qwen-review-david-work-20261009.md             (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-292-qwen-independent-review-david-20261009.md     อ่านเท่านั้น
  - /opt/data/config.yaml · /opt/data/state/model_alert_state.json                 อ่านเท่านั้น
  - /opt/data/bin/knight_crawler_report.sh · /opt/data/bin/verify_deploy.py        รัน/อ่าน
  - /opt/data/bin/model_rate_limit_watch.py · /opt/data/bin/knight_bundle_probe.sh  รัน/อ่าน
  - /opt/data/hermes-usage/.ledger.jsonl · /opt/data/cron/jobs.json                อ่านเท่านั้น

FORBIDDEN:
  - **ห้ามแก้ไขไฟล์ระบบเด็ดขาด** (งานนี้เป็น read-only/audit เท่านั้น) · ห้ามแก้ config.yaml หรือ jobs.json ด้วยตนเอง
  - **ห้ามแตะ production DB** หรือรันคำสั่ง SQL/migration ใด ๆ · ห้าม restart/recreate container
  - ห้ามพิมพ์คีย์/token/รหัสลงรายงาน · ห้ามแก้ราคา/รหัสสี/active ในระบบ
  - ห้ามส่งรายงานที่ไม่มีผลรันจริง (คำพูด "น่าจะถูก" หรือ "เดวิดบอกว่าผ่าน" = ไม่ผ่านเกณฑ์)

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) `sh /opt/data/bin/knight_crawler_report.sh` → ตัวนับหน้าเนื้อหา = 12 · sitemap errors = 0
  2) `python3 /opt/data/bin/model_rate_limit_watch.py --dry-run` → ไม่มีรุ่นหมดอายุเหลือ · ผลตัดสิน: ปกติ
  3) `node -e "..."` หรือ `curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" ...` → ยิง cohere (ตอบไทยผ่าน stop) vs. apodex (ตอบไทยตก/content=None)
  4) `node -e "..."` หรือ `curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" ...` → ยิง privacy probe ของ nemotron-3-super (ได้ 404/403) และ apodex (ได้ 200)
  5) `verify_deploy.py` (22/22) และ `sh /opt/data/bin/knight_bundle_probe.sh` (ชื่อไฟล์ .js จริง)
  6) `cat /opt/data/hermes-usage/.ledger.jsonl` (สรุปยอด token และครั้งที่ใช้ แยกรายเซสชันและโมเดล)
  7) `cat /opt/data/cron/jobs.json` (ยืนยันค่า model และ deliver ของ 2 งานใหญ่)
  8) commit SHA ของสาขารายงาน + วันเวลาไทยที่ตรวจ · ตัวเลข baseline (12 หน้า · 22/22 · 0 error · 239 แถว)

OUTPUT:
  - `qa/report-qwen-review-david-work-20261009.md` — ตารางสรุปข้อ A–F: **เห็นด้วย / ไม่เห็นด้วย / ตรวจไม่ได้** + หลักฐานดิบ
  - รายงานสั้นในแชท: สรุป 5 บรรทัด (อะไรประหยัดได้จริง · อะไรพึ่งพาได้ · อะไรที่เดวิดมองข้าม · ข้อเสนอระบบเฝ้าระวัง)
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานในแชทให้เดวิดส่งต่อบอส

STOP:
  - เมื่อตรวจครบข้อ A–F มีผลดิบจริงครบ · หรือเมื่อทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - ห้ามขยายขอบเขตไปแก้ของที่พบ (รายงานอย่างเดียว) — ถ้าพบข้อผิดพลาด ให้ระบุในรายงานเพื่อให้เดวิด/ชัยแก้ไข
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | `knight_crawler_report.sh` | รันสดผ่าน · นับ sitemap 12 หน้า (ไม่บวกซ้ำ) |
| 2 | `/network` index | รายงานสดระบุสถานะ index ของ `/network` ตรงความจริง |
| 3 | GSC sitemap error | 4 แถวในรายงานสด errors=0 |
| 4 | Fallback chain | config.yaml อ้าง `apodex/apodex-1.1-mini:free` |
| 5 | Watchdog dry-run | ไม่มีรุ่นหมดอายุเหลือ · ผลตัดสิน: ปกติ — จะเงียบ |
| 6 | Apodex ไทยตก | ยิงจริงได้ content=None หรือพร่ำคิดจนหมด length |
| 7 | Cohere ไทยผ่าน | ยิงจริงได้คำตอบไทยสั้น สมบูรณ์ จบด้วย stop |
| 8 | Privacy Probe | nemotron-3-super ตก (403/404) · apodex ผ่าน (200) |
| 9 | `verify_deploy.py` | 22/22 passed |
| 10 | `knight_bundle_probe.sh` | คืนชื่อไฟล์ .js จริง (ไม่ใช่ PROBE_FAILED) |
| 11 | `.ledger.jsonl` | สรุปสถิติ token/cost ครบ |
| 12 | `jobs.json` | 2 งานชี้ไป cohere · เฝ้า bundle เด้ง telegram |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → Qwen] ใบ 292-Q ครับ — งานตรวจทบทวนงานของเดวิดแบบอิสระ (งานรอบ 9 ต.ค. 69 ที่เดวิดปรับปรุงตัวรายงาน SEO/GSC, ถอดโฮสต์เก่าจากตัวตรวจ, และจัดการย้ายงานไปโมเดลฟรีเพื่อลดค่าใช้จ่าย)
เรื่อง: ตรวจสอบความถูกต้องและความแม่นยำของรายงาน Crawler, GSC, Fallback chain และโมเดลฟรี
ทำ (อ่านอย่างเดียว):
A. รันสลับรายงานสด crawler_report.sh ตรวจตัวนับหน้า (ต้อง 12) และสitemap errors (ต้อง 0)
B. รัน watchdog dry-run ตรวจสอบว่าไม่มีโมเดลหมดอายุเหลือ และสรุปเป็น "ปกติ — จะเงียบ"
C. ยิง API ทดสอบ cohere (ไทยผ่าน stop) vs apodex (ไทยตก/คิดวน length)
D. ยิง Privacy Probe ของ nemotron-3-super (ต้องติด 403/404) และ apodex (ต้อง 200)
E. รัน verify_deploy (22/22) และ bundle probe (คืนไฟล์ .js สด)
F. สรุปยอดโทเคน/ต้นทุนจริงจาก .ledger.jsonl เพื่อให้เห็นภาพผลประหยัด
ห้าม: แก้ไขไฟล์ระบบ · แก้ไข config.yaml/jobs.json · แตะ DB prod · restart container · พิมพ์คีย์
ผลลัพธ์: qa/report-qwen-review-david-work-20261009.md + PR (docs) + สรุป 5 บรรทัด (STOP 12 turns)
```
