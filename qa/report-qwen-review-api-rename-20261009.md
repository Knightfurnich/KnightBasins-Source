# รายงาน 296-Q — ตรวจจากภายนอก: เปลี่ยนชื่อโฮสต์ API (`api.srv1964473` → `api.knightbasins.com`) + ความสอดคล้องเอกสาร/ตัวเลข

**ผู้ตรวจ:** Qwen (อิสระ) · **วันที่:** 9 ต.ค. 69 (TH) · **ประเภท:** read-only 100% — ไม่แก้ไฟล์/DB/container, ไม่ restart, **ไม่ POST production แม้แต่ครั้งเดียว** (ทุกเส้นเป็น GET/HEAD), ไม่ merge PR ของเดวิด, ไม่ใช้คีย์ (ไม่มีคีย์ใดในรายงานนี้)
**Baseline:** `origin/main = 93c8eb4` ("#419 docs(jobs295-296)") · ใบงาน `qa/job-296-qwen-review-api-rename-20261009.md` · หลักฐาน `qa/runtime-evidence-20261009/` (ตอนนี้ 11 ไฟล์)
**คำนิยม verdict:** *เห็นด้วย* = ผมวัดเองแล้วตรง · *ไม่เห็นด้วย* = วัดเองแล้วขัด · *ตรวจไม่ได้* = เข้าไม่ถึง + บอกเหตุผล

---

## A. โฮสต์ใหม่ 5 เส้น + ชื่อเดิม (ทางสำรอง)

```
$ curl -s -o /dev/null -w "%{http_code} ct=%{content_type} sz=%{size_download}\n" https://api.knightbasins.com<path>
/kb/pricing.json            200  application/json                66,621
/kb/images/slab/QS288.png   200  image/png                      198,839
/health                     200  application/json; utf-8               65
/v1/models                  401  application/json; utf-8              127   ← ต้องมีคีย์ (ไม่ได้ใส่ — เกณฑ์ผ่าน)
/kb/admin/                  200  text/html; utf-8                      9,706
```
เทียบกับชื่อเดิม `https://api.srv1964473.hstgr.cloud<path>` (วัด **ครบทั้ง 5 เส้น** ไม่ใช่แค่ 3):

| path | ชื่อใหม่ | ชื่อเดิม | ขนาดไฟล์ตรงกันทีละ byte |
|---|---|---|---|
| `/kb/pricing.json` | 200 | 200 | ✓ 66,621 = 66,621 |
| `/kb/images/slab/QS288.png` | 200 | 200 | ✓ 198,839 = 198,839 |
| `/health` | 200 | 200 | ✓ 65 = 65 |
| `/v1/models` | 401 | 401 | ✓ 127 = 127 |
| `/kb/admin/` | 200 | 200 | ✓ 9,706 = 9,706 |

**checklist #1–2: ✅ เห็นด้วย** (200/200/200/401/200 ตรงเกณฑ์เป๊ะ · ชื่อเดิมให้ผลเดียวกัน = เป็นทางสำรองจริง ไม่ใช่ redirect)

**เพิ่มเติมที่ผมวัดเอง (สำคัญต่อข้อ F):** "ทางสำรอง" **ใช้ได้จริงกับ client ที่ตรวจสอบ cert** —
```
$ curl -s -o /dev/null -w '%{http_code}' https://api.srv1964473.hstgr.cloud/health        → 200 (exit 0, ไม่มี cert error)
  edge chain = CN=api.srv1964473.hstgr.cloud, issuer = Let's Encrypt YR1        (Hostinger IPv6 2a02:4780:5e:83cf::1)
$ curl -s --resolve api.srv1964473.hstgr.cloud:443:72.62.79.84 -w '%{http_code} tls=%{ssl_verify_result}\n' …/health
  → 200  tlsverify=0   ← ยิงเข้า VPS ตรง ๆ ก็ valid เพราะชื่อเดิมอยู่ใน SAN ของใบใหม่ (ดูข้อ B)
```
สรุป: ชื่อเดิมเดินได้ 2 ทาง (edge เดิมของ Hostinger และ Traefik ของเรา) ⇒ ถ้าจะถอดจริงต้องคิดทั้ง 2 เส้นทาง ไม่ใช่แค่เอาออกจาก router

## B. ใบรับรองของโฮสต์ใหม่

```
$ echo | openssl s_client -connect 72.62.79.84:443 -servername api.knightbasins.com | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
subject = CN=api.knightbasins.com
issuer  = C=US, O=Let's Encrypt, CN=YR2
notBefore = Oct  9 08:43:04 2026 GMT      notAfter = Jan  7 08:43:03 2027 GMT
X509v3 Subject Alternative Name: DNS:api.knightbasins.com, DNS:api.srv1964473.hstgr.cloud
$ getent hosts api.knightbasins.com → 72.62.79.84   |   CN จากการยิงผ่าน DNS จริง = api.knightbasins.com ✓
```

**✅ เห็นด้วยกับเกณฑ์ 2 ข้อ:** SAN มี `api.knightbasins.com` · **ไม่ใช่** `TRAEFIK DEFAULT CERT` (issued โดย Let's Encrypt จริง, อายุ 90 วัน, หมดอายุ 7 ม.ค. 70 = รอบเดียวกับ 3 ใบที่ตรวจใน 294-Q)

⚠️ **1 ข้อที่ต้องให้บอสเคาะต่อ:** ใบนี้ **ยังใส่ชื่อ `api.srv1964473.hstgr.cloud` ลงใน SAN** (เพื่อรองรับทางสำรอง) — ต่างจากใบ web/www/line ที่ 294-Q ยืนยันแล้วว่า *ไม่มี* ชื่อเก่าเลย ⇒ โดเมน `.hstgr.cloud` ยังเป็น *ภาระของ trust* บนโดเมนเรา (ดูความเสี่ยงข้อ F)

## C. แอป/เว็บไม่พังจากภายนอก + จำนวน URL ในแคตตาล็อก

```
$ curl -s -o /dev/null -w "%{http_code} sz=%{size_download}\n" https://knightbasins.com<path>   (UA Mozilla/5.0)
/                            200   155,826      /stone              200   85,912
/api/healthz                 200        239     /api/catalog        200  111,347
/kb/images/slab/QS288.png    200   198,839      → ครบ 5/5 = 200

$ curl -s https://knightbasins.com/api/catalog | grep -c srv1964473        → 0
```
นับ URL ทั้งก้อน (script ของผม แยกตาม path prefix):
```
total URLs = 748  |  host buckets = {'knightbasins.com': 748}     ← legacy = 0
  /api/uploads/* = 489     /kb/* = 229     /assets/* = 30   (รวม = 748)
media URLs = 748 · relative "/api/uploads" literal = 0 (ทุกตัวเป็น absolute บนโดเมนหลัก)
```
**✅ เห็นด้วย:** แอปเปลี่ยน `HERMES_API_URL` แล้ว **ไม่กระทบพื้นผิวสาธารณะ** · canonicalization ยังทำงานครบ (748/748) · ตัวเลขนี้ **เท่ากับรอบ 294-Q ทุกประการ** ⇒ การเปลี่ยนชื่อ API ไม่ทำให้ URL ใน payload เปลี่ยน (ถูกต้อง — payload ต้องผูกกับ `knightbasins.com` เท่านั้น)

## D. 3 ข้อเท็จจริงที่เดวิดอ้าง (วัดจากภายนอกเท่านั้น)

| # | ข้ออ้าง | สิ่งที่ผมวัดได้ | verdict |
|---|---|---|---|
| D1 | `app.srv1964473.hstgr.cloud` **เลิกใช้** | ตาม DNS จริง (`2a02:4780:5e:83cf::1`) → **404** · บังคับ `--resolve` เข้า VPS `72.62.79.84` → **000 (TLS handshake ล้มเหลว, ssl_verify_result=18 = ไม่มี cert ให้ SNI นี้)** ⇒ บนเครื่องเราไม่มี router ชื่อนี้อยู่จริง | ✅ **เห็นด้วย** (ไม่ใช่ 200, ไม่ใช่ 301) |
| D2 | `n8n.srv1964473.hstgr.cloud` **ถูกหยุด** | ตาม DNS จริง → **404** (ไม่ใช่ 200/302 ไม่มี UI) | ✅ **เห็นด้วยกับ "หยุดไว้"** — แต่ *สาเหตุ* (container paused หรือไม่มี router) แยกไม่ออกจากการยิงจากนอก · ยัง **ไม่ใช่หลักฐานว่า "ไม่เคยมี execution 0 ครั้ง"** (อันนี้ต้องดูในเครื่อง) |
| D3 | `hermes-agent-2xwn.srv1964473.hstgr.cloud` **ยังใช้งาน** | **302 → `https://hermes-agent-2xwn.srv1964473.hstgr.cloud/login?next=%2F`** | ✅ **เห็นด้วย** — และนี่คือ **ช่องที่ต้องแจ้งบอส**: dashboard ของ Hermes ยังเปิดสาธารณะบน *ชื่อ wildcard ของ hosting provider* (มี login กั้น แต่เป็น attack surface ที่อยู่บนโดเมนที่เราไม่ได้ควบคุมDNS) |

## E. เอกสารในรีโป vs ความจริง

### E1 (1) ยังมีที่ไหนดัน `api.srv1964473` เป็น "ที่อยู่หลัก" ไหม
```
$ git grep -n "api\.srv1964473" -- qa docs deploy KANBAN.md CLAUDE.md | grep -viE "เดิม|สำรอง|legacy|retire|เลิกใช้|old|formerly|ก่อน"
deploy/hostinger/README.md:119:HERMES_API_URL=https://api.srv1964473.hstgr.cloud
KANBAN.md:484            ← บริบท "กำหนดอนาคต api.srv1964473" (รอเคาะ = ถูกต้อง ไม่ใช่ที่อยู่หลัก)
qa/job-290-chai-canonical-media-urls.md:7,11,12   ← ประวัติของปัญหา (ถูกต้อง)
qa/job-295-*:103  traefik…rule: "Host(`api.srv1964473…`)"   ← แสดง *ก่อนแก้* (บรรทัด 105 เป็น after)
qa/report-qwen-review-david-round2-…(รายงานผมเอง) , qa/job-296-…(ใบงาน) ← ใช้ในฐานะ "ชื่อเดิม"
```
❌ **จุดผิดจริง 1 แห่ง (อยู่ใน SCOPE ของใบงานนี้ด้วย):** `deploy/hostinger/README.md:119` — **environment template ยังสอนให้ตั้ง `HERMES_API_URL` = ชื่อเก่า** โดยไม่มีคำว่า deprecated/สำรองกำกับ ⇒ คน setup ใหม่ (หรือการกู้คืนระบบ) จะได้ค่าเก่าไป · ควรแก้เป็น `https://api.knightbasins.com`
⚠️ **และช่องว่างเชิงระบบ:** ชื่อใหม่ `api.knightbasins.com` ปรากฏแค่ **3 ไฟล์** (KANBAN.md + ใบงาน 295/296) — **ไม่อยู่ใน `deploy/**` เลย** (ทั้ง DNS note, Traefik labels, nginx, env template) ⇒ ความรู้เรื่อง "API ต้องอยู่ชื่อใหม่" ยังอยู่ในแชท/Kanban ไม่ใช่ใน infrastructure docs ของรีโป (นี่คือ category เดียวกับที่ผมเคยชี้เรื่องสคริปต์ Hermes)
✅ ที่เหลือใน `qa/**` + `KANBAN.md` **ไม่มี**แห่งใดดันชื่อเก่าเป็น primary (**0 แห่ง** หลังนับแยก before/after แล้ว)

### E1 (2) claim #3 "แก้ CLAUDE.md §1 (app.srv ปลดระวาง) + §3 (เลิกฝังตัวเลขสี → อ่านจาก KB = 64/65)"
```
$ ls CLAUDE.md AGENTS.md → No such file or directory (ทั้งสองชื่อ)
$ git ls-files | grep -icE "CLAUDE\.md|AGENTS\.md" → 0
```
⛔ **ตรวจไม่ได้ (ตัวไฟล์):** `CLAUDE.md` ไม่มีในรีโป public — อยู่บนเครื่อง Hermes/private repo (ซึ่งสอดคล้องกับข้อ F ที่ว่า "repo ส่วนตัวติดที่ token")
🟢 **แต่ *เนื้อหาตัวเลข* ของ claim ผมตรวจกับของสดได้และ "ถูกต้อง":**
```
$ curl -s https://knightbasins.com/api/catalog | (นับแถว)
  installedStones = 65   sheetStones = 64   basins = 30        (ตรง "64/65" ที่ §3 ใหม่จะให้ reads จาก KB)
```
และตารางใน `qa/runtime-evidence-20261009/answers-round2-chai-qwen.md:23-25` ระบุแหล่ง 3 ชุด (KB `pricing.md:4` = 64/65 · API สด = 68 รวม · `pricing.json` = 148 รายการรวมทุกรุ่น+อ่าง) → **ผมนับ API สดเอง = 68_union / 64 / 65 / 30 ตรงกับที่เขียน** ✅ ไม่มีตัวเลขสีที่ขัดกันเหลือในเอกสารที่ publish อยู่ (คำ "74 สี/71 สี" เหลือเฉพาะใน *ใบงานเก่า* = ประวัติ, และบนเว็บใช้ "กว่า 60 เฉดสี" ตรวจแล้วรอบ 292)

### E2 ตัวเลข/คำอ้างที่ยังไม่มีหลักฐาน → อัปเดตสถานะทีละตัว
| ตัวเลข | สถานะใหม่ | ผมวัด/อ่านเองยังไง |
|---|---|---|
| **tokens/call (ledger)** | ✅ **แก้แล้ว + ผมคำนวณซ้ำผ่านทุกลูก** | `ledger-summary.md` ฉบับแก้ไข (ยอมรับว่าฉบับเดิม *หารผิดคู่*: เอา `prompt_tokens` ÷ จำนวน *เซสชัน* แทน `api_calls` — ตรงกับสมมติฐานที่ผมเสนอใน 294-Q) · ผมคำนวณเอง: 7×`prompt+completion == total` ✓, Σsessions=324 ✓, Σcalls=26,053 ✓, Σtotal=432,068,149 ✓, tokens/call รายแถว 21,016 / 12,178 / 17,232 / 27,214 / 9,209 / 7,321 / 332 ✓ **ตรงทุกตัว**, รวม 16,584 ✓, ช่วง 332–27,214 ✓ (สมเหตุสมผลกับ context จริง) |
| **"22" ของ crawler เวอร์ชันเดิม** | ✅ **ถอนคำอ้างเรียบร้อย (วิธีที่ถูกต้อง)** | `README.md:35` ข้อ 4 เขียนตรง ๆ ว่า *ผลรันเวอร์ชันเดิมไม่ได้เก็บไว้* จึง **ถอนคำอ้าง** แทนที่จะแต่งตัวเลข · ยืนยันด้วยการ grep: "22" ที่เหลือในโฟลเดอร์หลักฐาน = `22/22`, วันที่, และ `api_calls=22` ของ gemini-3.5-flash เท่านั้น (**0 คำ claim เรื่อง 22 หน้า**) |
| chain = 4 ตัว | ✅ **แก้เป็น 5 ตัว** | `README.md:33` ข้อ 2 → "chain ปัจจุบัน = 5 รายการ (`deepseek/deepseek-v4.1-flash` + gemini → cohere → apodex → deepseek-chat)" ตรงกับ `model-watch-dry-run.txt` |
| failover "จาก/ไปยังตัวไหน" | ✅ **มีไฟล์ใหม่** | `model-watch-failover-raw.txt` (log ดิบจาก `logs/agent.log`, `2026-10-09 05:53:46,949 … Fallback gemini-3.5-flash: …`) → ตอบข้อ D.2(2) ของ 294-Q |
| container ที่ pause + skip-list | ✅ **มีไฟล์ใหม่ (ตรวจ method ได้แต่ผลรันเป็นคำให้การ)** | `watchdog-container-skip-dryrun.txt`: สำเนา state `- knight-images-admin / n8n-n8n-1` + รัน 2 รอบ (ลบชื่อ → ต้องเตือน / ใส่กลับ → เงียบ) ซึ่งคือ *การทดลองที่เขาอธิบาย* — ผมรัน `knight_watchdog.sh` เองไม่ได้ (ยังไม่มีในรีโป, ดู D.5) |
| md5 เทียบเวอร์ชัน | ⛔ **ยังไม่ปิด (ยอมรับแล้ว)** | `README.md:37` ข้อ 7 รับว่าสคริปต์ไม่อยู่ในรีโป · `git ls-files \| grep -cE "verify_deploy\.py\|…"` = 0 (ยัง 0) |
| GSC: แสดงผล 4 / คลิก 0 / avg 8.2 | ⛔ ตรวจไม่ได้เหมือนเดิม | ต้อง Search Console API + property access |
| "index แล้ว 12/12" | ⛔ ครึ่งเดียวเหมือนเดิม | ยังมีแต่ผลสรุปในรายงาน crawler (ฉบับ cron ส่งจริง) ไม่มี URL-inspection raw ต่อ 12 URL |
| "DB 203 แถว" | ⛔ (แต่มีขอบเขตจากภายนอก) | ผมแตะ DB ไม่ได้ — ดูข้อ F |

### E3 ใบ 293-C / 294-Q ปิดครบตามที่ KANBAN เขียนไหม
```
$ gh pr list --state all → #416 [MERGED] review/chai-david-round2 · #417 [MERGED] docs/qwen-job294-review-round2 · #418 [MERGED] docs/evidence-round2-fixes · #419 [MERGED]
KANBAN.md:483 (293-C) · :484 (294-Q "ปิดแล้ว … PR #417 merged") · :485 (295-C) · :486 (296-Q)
```
**✅ เห็นด้วยว่า "ปิด" ตามที่เขียน** และการแก้ที่ขอไป 6 ข้อถูกทำจริง 5 ข้อ (ledger / chain / failover / ถอน 22 / clarify "ถอดครบ") + เพิ่ม `watchdog-container-skip-dryrun.txt`, `answers-round2-chai-qwen.md` · **เหลือ 2 ข้อ:** commit ตัวสคริปต์ (D.5) และ GSC/URL-inspection raw · ❗**ข้อผิดพลาดทางhousekeeping 1 จุดที่ควรแก้:** **PR #412 (รายงาน 292 ของผม) ยัง `OPEN` ไม่ได้ merge** ⇒ ไฟล์ `qa/report-qwen-review-david-work-20261009.md` **ไม่อยู่ใน main** ทั้งที่ถูอ้างอิงใน KANBAN/docs — ควร merge หรือปิดพร้อมย้ายเนื้อหาเข้าไปในรายงานรอบ 2 (เดวิด/boss กดเอง ผมไม่ merge ให้)

## F. ทบทวน "สิ่งที่เดวิดยังไม่ได้ทำ" + ความเห็นผม

**(F1) ยังไม่ถอดชื่อเดิมออกจาก router เพราะ DB ~203 แถวยังเก็บ URL ชื่อเดิม → เห็นด้วยว่าต้องเก็บไว้ก่อน และชี้ขอบเขตให้**
```
external bound: payloads ที่ currently ต้องพึ่ง path /kb/* = 229 URLs (จาก 748)   ← ผมวัดเอง
claim "DB 203 แถว": ตรวจไม่ได้ (read-only + ห้ามแตะ DB) · แต่ order-of-magnitude สอดคล้อง (203 columns ≤ 229 URL occurrences)
```
**ความเห็น:** เก็บ fallback ถูกแล้ว — *แต่อย่าลืมว่า* ใบ cert ใหม่ยังใส่ `api.srv1964473.hstgr.cloud` ใน SAN ด้วย ⇒ โดเมน `srv1964473.hstgr.cloud` เป็น **subdomain ที่ hosting provider ควบคุม ไม่ใช่ our zone** ถ้าวันหนึ่งชื่อถูก resolve ผิด/ถูก reuse, traffic จากชื่อนั้นยัง handshake สำเร็จกับ Traefik ของเราได้ · ลำดับที่ผมแนะนำ (ไม่ทำอะไรเอง): **(1)** DB canonicalization ครั้งเดียว ( UPDATE → เก็บ path สัมพัทธ์/โดเมนหลัก ) **(2)** ตรวจ `/kb/*` = 0 ใน payload + `verify_deploy` ผ่าน **(3)** ค่อยลอกชื่อเก่าออกจาก router rule **และออก cert ใหม่** ให้ SAN เหลือ `api.knightbasins.com` ตัวเดียว (4) พิจารณาปิด `hermes-agent-2xwn.…` ให้ไปอยู่บนโดเมนเรา (D3) หรือใส่ IP allowlist/basic-auth

**(F2) ยังไม่ commit สคริปต์ Hermes ลงรีโป (บอสเลือกทำ repo ส่วนตัวแยก — ติดที่ token สร้าง repo ไม่ได้)**
**ความเห็น: ไม่จำเป็น** — จากตัวอย่าง 11 ไฟล์หลักฐาน (6,000+ บรรทัด) ไม่มีคีย์แม้ตัวเดียว (ผมสแกน pattern `sk-…` / `ghp_…` / `Bearer …` / JWT / `-----BEGIN` ทุกไฟล์ → **0 hits**), และ `checksums.md` ก็แสดงว่าเดวิดตั้งใจ redact อยู่แล้ว ⇒ commit ตรงเข้า `deploy/hermes-runtime/` ของรีโปนี้ได้เลย (private repo จะไม่เพิ่ม security เท่ากับ *การรักษา hygiene ที่ทำอยู่แล้ว + ห้ามใส่ .env*) · ส่วน "token สร้าง repo ไม่ได้" — ผมสร้าง/ออก token ให้ไม่ได้ (และผมจะไม่แตะสิทธิ์ GH เพิ่มนอกเหนือจาก push branch) ต้องให้บอสออก ใน scope `Administration:Repository creation` เท่านั้น

**ความเสี่ยงคงเหลือรวม (ตามลำดับความรุนแรง)**
1. 🟠 **doc drift ของ API host** — `deploy/hostinger/README.md:119` + ไม่มีไฟล์ infra ใดอ้างชื่อใหม่ ⇒ setup/restore ครั้งหน้าจะได้ชื่อเก่า (ตอนนี้ชื่อเก่ายังทำงาน → พังแบบเงียบ ๆ นานจนกว่าจะถอด fallback)
2. 🟠 **cert SAN ยังพาชื่อที่ provider ควบคุม + hermes dashboard เปิดอยู่บน wildcard นั้น (302 login)**
3. 🟡 **ยังตรวจซ้ำไม่ได้ (ต้องสิทธิ์ในเครื่อง):** GSC 4/0/8.2 · URL-inspection 12 ชุด · สถานะ container จริง · การทดลอง watchdog skip-list · *ผลรัน* ของ probe รายโมเดล
4. 🟡 ตัวเลขในแชท/Kanban ยังวิ่งเร็วกว่ารีโป (PR #412 ค้าง OPEN) → ประวัติการตรวจรอบ 1 หายจาก main

**สรุปคะแนน:** checklist #1–2 ✅ · ข้อ B ✅+⚠️SAN · ข้อ C ✅ (200×5, 0 hits, 748 URLs) · ข้อ D ✅3/3 · ข้อ E ⚠️ 2 จุด (README:119 + CLAUDE.md ไม่มีในรีโป) · ข้อ F เห็นด้วยทั้ง 2 + เสนอทางเลือก

---
**ลงชื่อ:** Qwen · 9 ต.ค. 69 (TH) · baseline `origin/main = 93c8eb4` · branch `docs/qwen-job296-api-rename-review` · read-only 100% (GET/HEAD เท่านั้น, ไม่มีไฟล์ระบบถูกแก้, ไม่มี container ถูกแตะ, ไม่มีการ merge) · คีย์/token ในรายงานนี้: **0**
