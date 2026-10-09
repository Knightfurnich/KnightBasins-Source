# รายงาน 294-Q (รอบ 2) — Qwen ตรวจซ้ำจากภายนอก หลังรีวิว 292: cert ใหม่ · ถอดโฮสต์เก่า · หลักฐานในรีโป

**ผู้ตรวจ:** Qwen (อิสระ) · **วันที่:** 9 ต.ค. 69 (TH) · **ประเภท:** read-only 100% (ไม่แก้ไฟล์ระบบ/config/DB · ไม่ restart · ไม่ merge PR ของเดวิด · ใบนี้ไม่ใช้คีย์ และไม่มีคีย์ใดถูกพิมพ์)
**Baseline ที่ตรวจ:** `origin/main = ad78709` ("#415 docs(jobs293-294)") · ใบงาน `qa/job-294-qwen-review-david-round2-20261009.md` · หลักฐาน `qa/runtime-evidence-20261009/` (8 ไฟล์ 30,433 bytes)
** เกณฑ์ของใบนี้:** "เห็นด้วย / ไม่เห็นด้วย / ตรวจไม่ได้" พร้อมผลรันดิบทุกแถว — ไม่มีช่องไหนสรุปจากคำพูดของเดวิด

---

## A. ใบรับรองใหม่ (วัดเองจากภายนอก ผ่าน IP ตรง `72.62.79.84:443` + SNI)

| SNI ยิงไป | CN | SAN (จริงทั้งก้อน) | notBefore | notAfter | Issuer |
|---|---|---|---|---|---|
| `knightbasins.com` | `knightbasins.com` | `DNS:knightbasins.com, DNS:www.knightbasins.com` | Oct 9 05:51:43 **2026** GMT | **Jan 7 05:51:42 2027 GMT** | Let's Encrypt / YR2 |
| `www.knightbasins.com` | `knightbasins.com` | `DNS:knightbasins.com, DNS:www.knightbasins.com` | เดิม | **Jan 7 2027** | เดิม |
| `line.knightbasins.com` | `line.knightbasins.com` | `DNS:line.knightbasins.com` *(ตัวเดียว)* | เดิม | **Jan 7 2027** | เดิม |

```
$ echo | openssl s_client -connect 72.62.79.84:443 -servername line.knightbasins.com | openssl x509 -noout -subject -dates -ext subjectAltName
subject=CN=line.knightbasins.com  notAfter=Jan  7 05:51:42 2027 GMT  X509v3 Subject Alternative Name: DNS:line.knightbasins.com
```

**ผลตรวจเทียบ checklist #1–3:** ✅ **เห็นด้วยทั้งสามข้อ**
1. สองโดเมนแรก **ไม่มี** `srv1964473` ใน SAN (SAN มี 2 รายการเท่านั้น) · 2. line มี SAN เดียว ✓ · 3. notAfter = **7 ม.ค. 70** ตรงกับที่เดวิดแจ้งเป๊ะ (ออก 9 ต.ค. 69 = อายุ 90 วันตามรอบ Let's Encrypt)

**หลักฐาน bonus ที่เดวิดไม่ได้รายงาน (เป็นผลดี):** ยิง SNI ชื่อเก่า → ได้ **`CN=TRAEFIK DEFAULT CERT`** (self-signed fallback, SAN = `...traefik.default`) ไม่ใช่ cert ของไซต์ ⇒ เป็นหลักฐานอิสระว่า **router ของโฮสต์เก่าถูกถอดออกจาก Traefik จริง** (ไม่ใช่แค่ app ตอบ 404) · และ DNS ของ `*.srv1964473.hstgr.cloud` now resolves to `2a02:4780:5e:83cf::1` (IPv6 คนละที่อยู่กับ VPS `72.62.79.84`) ⇒ ชื่อเก่าไม่ชี้มาที่เราแล้ว

## B. โฮสต์ที่ถอดแล้วตายจริง ไม่ใช่ 301 · LINE webhook เก่า/ใหม่

```
$ curl -sk -o /dev/null -w "%{http_code} redir=%{redirect_url} tls=%{ssl_verify_result}\n" <url>
knightbasins.srv1964473.hstgr.cloud/                        404  redir=        tls=18
knightbasins.srv1964473.hstgr.cloud/stone                   404  redir=        tls=18
knightbasins.srv1964473.hstgr.cloud/api/catalog             404  redir=        tls=18
knightbasins.srv1964473.hstgr.cloud/api/uploads/x.png       404  redir=        tls=18
line.srv1964473.hstgr.cloud/line/webhook (GET)              404  redir=        tls=18
```
ตรวจซ้ำแบบ **บังคับ DNS มาที่ VPS เดิม** เพื่อกันกรณี "ตายเพราะ DNS ไปแล้ว" อย่างเดียว:
```
$ curl -sk --resolve knightbasins.srv1964473.hstgr.cloud:443:72.62.79.84 -o /dev/null -w '%{http_code}\n' {/,/stone,/api/catalog}
404 / 404 / 404      ← บนเครื่องเราก็ไม่เสิร์ฟให้ชื่อเก่า (ไม่ใช่ 200, ไม่ใช่ 301)
```
LINE webhook:
```
GET  https://line.knightbasins.com/line/webhook   → 405  ✅ (Method Not Allowed = route มีอยู่ รับเฉพาะ POST)
POST https://line.knightbasins.com/line/webhook   → 401   (รอ signature — ปกติ, ไม่ได้ตรวจต่อเพราะไม่ใช้คีย์)
GET  https://knightbasins.com/line/webhook        → 404   (โดเมนหลักไม่มี route นี้ = ถูกต้องตามดีไซน์)
```
**checklist #4–5:** ✅ **เห็นด้วย** (404 ทุกเส้น, `redirect_url` ว่างจริง = ไม่มี 301 หลงเหลือ; webhook ใหม่ 405/เก่า 404 ตรงเกณฑ์)

⚠️ **1ข้อยกแย้งที่ต้องบอก (checklist #4 ไม่ "ครบทั้งก้อน"):**
```
https://api.srv1964473.hstgr.cloud/kb/images/slab/QS288.png   → 200   (tls=20)
https://api.srv1964473.hstgr.cloud/kb/images/slab/BL461.png   → 200 · 272,113 bytes
```
โฮสต์ **`api.srv1964473` ยังเสิร์ฟภาพ slab อยู่** — ถอดสำเร็จเฉพาะฝั่ง web/line container คำว่า "ถอดโฮสต์เก่าออกครบทั้งระบบ" ในใบงานหมายถึง *references* (สคริปต์/.env/KB/cron) ซึ่งเป็นจริงตามนั้น แต่ **ผลข้างเคียง:** การทดสอบแบบ "ยิง URL เก่าแล้วขอให้พัง" จะ *จับการรั่วไม่ได้* เพราะภาพเก่ายัง 200 (ต่างจาก `knightbasins.srv…/api/uploads/…` ที่ 404 แล้ว) ⇒ ยังเป็นคำถามค้างจากรอบ 292 ว่า `api.srv…` จะปิดเมื่อไร/ปิดอย่างไร (ผมไม่แตะ)

## C. นับ 0 จุดบนพื้นผิวสาธารณะ (ผมนับเองทุกรายการ)

วัดด้วย `curl -s <url> | grep -c srv1964473` + บันทึก HTTP status คู่กัน (24 รายการ = 5 textual + 12 หน้าตาม sitemap + 3 API + 3 ฝั่ง `www.`)

| กลุ่ม | URLs | ผลรวม hits `srv1964473` | HTTP |
|---|---|---|---|
| ไฟล์ข้อความ | `/llms.txt` `/llms-full.txt` `/sitemap.xml` `/sitemap_index.xml` `/robots.txt` | **0 ทุกไฟล์** | 200 ×5 |
| หน้าเนื้อหา (ตาม sitemap) | `/` `/portfolio` `/stone` `/price-guide` `/site-prep` `/studio-guide` `/quote` `/studio` `/sketch` `/readme` `/updates` `/network` | **0 ทุกหน้า** | 200 ×12 |
| API สาธารณะ | `/api/catalog` `/api/portfolio` `/api/portfolio/featured` `/api/site-photos/showcase` | **0 ทุกตัว** | 200 ×4 |
| โดเมน `www.` | `/` `/llms.txt` `/sitemap.xml` | **0** | 301 → apex (ถูกต้องตามนโยบาย single-domain) |

```
=== TOTAL ===  URLs = 24 · ผลรวม hits = 0     (_Exception ที่ grep_ >0_ / HTTP != 200_มีแค่ 301 ของ www 3 รายการ_ )
```
**checklist #6:** ✅ **เห็นด้วย** — 0 ทุกURL (และยืนยันซ้ำจากรอบ 292: `/api/catalog` = 748/748 URLs เป็น `knightbasins.com`)
หมายเหตุ: รายการที่ใบงานระบุมา 20 ผมวัด **เกินเป็น 24** เพื่อครอบ `www.` และ `/api/portfolio/featured`, `/api/site-photos/showcase` (route มีจริงใน `routes/catalog.ts:120`) — ส่วน `/api/installed-stones`, `/api/sheet-stones`, `/api/site-photos`, `/api/photos` ที่ผมเคยชี้ใน 292 **ยังเป็น 404 ทุกตัว** (ยืนยันแล้วว่าเป็น path ผิด ไม่ใช่ข้อมูลหาย: ไม่มี route จริงใน `src/routes/**`)

## D. ความสอดคล้องของ `qa/runtime-evidence-20261009/` (ตรวจเองทุกไฟล์)

| # | เกณฑ์ | ผล | หลักฐาน/วิธีวัด |
|---|---|---|---|
| D.1 | ท้าย `verify-deploy-output.txt` = `22/22 passed` | ✅ | อ่าน 320 bytes ท้ายไฟล์ → `  22/22 passed`; นับ `[PASS]` = **22**, `(?i)fail` = **0**, ไม่มีบรรทัด `301`, มี `404` 1 บรรทัด = check ตั้งใจ ("missing asset is 404 — 404 text/html") |
| D.2 | probe 15 แถว + safe 3 · train 8 · ตรวจไม่จบ 4 ตรงกับ dry-run | ✅ | parse ตารางด้วย regex → id ไม่ซ้ำ **15ตัว**; tally จากคอลัมน์สถานะ = **safe 3 / train 8 / ไม่จบ 4**; dry-run เขียน `รุ่นฟรีไม่ฝึกข้อมูล: 3 · บังคับฝึก: 8 · ใช้ไม่ได้: 4` → **ตัวเลขสามชุดตรงกันและรวมได้ 15** |
| D.3 | ledger มี `cohere/north-mini-code:free` + ระบุต้นทุนเป็น 0 | ✅ | มีแถว `cohere/north-mini-code:free | 3 | 140,668 | 6,678` + ข้อความ "คอลัมน์ต้นทุน (`total_cost`) ในไฟล์นี้เป็น 0 ทุกแถว ⇒ คำนวณ 'ประหยัดได้กี่บาท' จากไฟล์นี้ไม่ได้" *(ความสัตย์ซื่อแบบนี้ควรชม — เป็นคำตอบที่ผมขอไว้ใน 292-F และเป็นคำตอบเชิงลบที่ถูกต้อง)* |
| D.4 | ไม่มีคีย์/token | ✅ | สแกน 8 ไฟล์ด้วย pattern `sk-…{16,}` / `ghp_…` / `Bearer …` / `-----BEGIN` / JWT `eyJ….` / `API_KEY[=:]…` → **0 hits ทุกไฟล์** (ตารางตรวจแล้ว: README 4517B 0 · checksums 657B 0 · crawler-snapshot 13907B 0 · cron-jobs 2405B 0 · free-model-probe 4997B 0 · ledger 1188B 0 · model-watch 963B 0 · verify-deploy 1799B 0) |
| D.5 | *สิ่งที่ผมเพิ่มเข้าไปเอง* | ⚠️ | **md5 ยังใช้เทียบไม่ได้จริง:** ทั้ง 5 สคริปต์ที่ `checksums.md` อ้าง (`bin/verify_deploy.py` ฯลฯ) **ไม่อยู่ในรีโป** (`git ls-files | grep -cE "verify_deploy\.py|…"` = **0**) ⇒ ประโยค "ตรวจว่าเวอร์ชันตรงกับที่รันจริง" ยังไม่สำเร็จ — ถ้าใส่ *ตัวสคริปต์* ลง `deploy/hermes-runtime/bin/` จะปิดช่องนี้ได้ทันที (ตอนนี้ปิดได้แค่ "ผลลัพธ์" ไม่ใช่ "โค้ดที่รัน") |

**ตรวจพบข้อไม่สอดคล้อง 2 จุด (เล็กน้อย ต้องแก้เอกสาร):**
1. **chain ใน dry-run มี 5 ตัว นำหน้าด้วย `deepseek/deepseek-v4.1-flash`** → `• chain ที่เฝ้า: deepseek/deepseek-v4.1-flash, gemini-3.5-flash, cohere/north-mini-code:free, apodex/apodex-1.1-mini:free, deepseek/deepseek-chat` แต่ที่เดวิดแจ้งใน 292 เขียน 4 ตัว (เริ่มที่ gemini) ⇒ ต้องอัปเดต "chain ปัจจุบัน" ในเอกสาร/KANBAN ให้ตรงกัน
2. `• สลับโมเดลสำรอง (failover) ใน 60 นาที: 1 ครั้ง` = มีการสลับจริง 1 ครั้งในช่วงนั้น แต่ยังไม่มีระบุว่า **สลับจาก/ไปยังตัวไหน** (ถ้าเป็น apodex = หมายความว่า apodex ถูกเรียกใช้กับงานจริงแล้ว ทั้งที่รอบ C ทดสอบภาษาไทยมัน "ไม่ผ่าน") — ขอ 1 บรรทัดต่อ failover event

**ข้อที่ปิดไปได้จากรอบ 292 (เพราะเดวิดแนบหลักฐาน):** ✅ `qwen3.8`/`dots-3` ไม่อยู่ใน chain (dry-run) · ✅ watchdog ตัดสิน `ปกติ — จะเงียบ` และ `รุ่นใน chain ที่มีวันหมดอายุ: ไม่มี` · ✅ privacy probe: apodex/cohere = `200 safe`, nemotron-3-super/liquid/poolside = `404 data policy (train)` — ตรงกับคำถาม D ของ 292 ที่ผมยิงเองไม่ได้ · ✅ ผลทดสอบไทย: cohere `113 ตัวอักษร finish=stop`, apodex `content=None`, dots-3 `93 ตัวอักษร แต่มี...` (คำตอบ 292-C) · ✅ cron `knight-tracker-switch-to-weekly` = `once at 2026-10-23 02:00` + `knight-gsc-crawler-tracker` = `0 2 * * *` model `cohere/north-mini-code:free` deliver `telegram` + `knight-bundle-watch` = `every 15m` `cohere/…` `telegram` active (2 งานใหญ่ย้ายไปฟรีจริงตาม claim #5–6 ใน 292)

## E. ล่าตัวเลขที่ยังไม่มี raw output (ข้อเสนอเดิมของรอบ 292 — ทำต่อจนจบ)

| ตัวเลข/คำclaim | อยู่ที่ไหน | มี raw ในรีโป? | หมายเหตุ |
|---|---|---|---|
| **`tokens/call` ใน ledger** | `ledger-summary.md:5-11` | ❌ **ไม่มี + ตัวเลขเป็นไปไม่ได้ทางกายภาพ** | ผมคูณเอง: gemini-3.8-flash `145,438,819/37 = **3,930,779 tokens/call**`, gemini-3.6 `2,602,036/call`, deepseek-v4.1 `915,104/call` — ไม่มีโมเดลใดรับ context ระดับนี้ และรวมทั้งตาราง = **412M prompt tokens/307 calls** ใน 1 เดือน ⇒ น่าจะ **sum ค่า running-total ของ ledger** หรือรวม cached-read ซ้ำ ⇒ *ห้าม* ใช้ตารางนี้คำนวณ "ประหยัดได้กี่บาท" จนกว่าจะแนบ raw 3 แถวแรก + วิธีนับ |
| `22/22 passed` | `verify-deploy-output.txt:38` | ✅ มี | ยืนยันแล้ว (D.1) |
| `index แล้ว 12/12` | `crawler-report-snapshot.md` (2 แห่ง) | ⚠️ ครึ่งเดียว | *คำอธิบายที่ผมทักใน 292 ("GSC sitemap index=0 ขัดกับ 12/12") เดวิดแก้แล้วและแก้ถูก:* rule #3 ใน prompt ระบุ "อย่าใช้ตัวเลข index จาก sitemap API อย่างเดียว (ตัวนั้นเป็น 0 ได้ทั้งที่ index รายหน้าไปแล้ว)" + แยก "ผลรวมไฟล์ที่ส่ง = 36" ออกจาก "หน้าจริง = 12" → **เห็นด้วยว่าสมเหตุสมผล** แต่ยังไม่มี raw ต่อ URL (URL Inspection API response 12 ชุด) ในรีโป |
| การแสดงผล 4 / คลิก 0 / อันดับ 8.2 | `crawler-report-snapshot.md` | ⛔ ตรวจไม่ได้ | ต้อง GSC API + สิทธิ์ property (ผมไม่มีและไม่ควรขอเพิ่ม) — ตอนนี้มี "ฉบับที่ cron ส่งจริง" กำกับแล้ว ซึ่งถูกชนิด |
| ตัวเลข **"22"** (เวอร์ชันเดิมของ crawler report) | อ้างใน `job-292` claim #1 · ไม่ปรากฏใน 8 ไฟล์หลักฐาน | ❌ ยังไม่มี | ผม reconstruct ไม่ได้: index ปัจจุบันชี้ `sitemap.xml` ไฟล์เดียว → `12 + 1 = 13` ไม่ใช่ 22 · สมมติฐานที่ตรงเลขที่สุดคือ *เดิม index มีลูก ~10 ไฟล์รวม 10 URL* ⇒ `12 + 10 = 22` (ตรงกับ rule #2 ที่เพิ่งห้ามนับซ้ำ) **แต่ sitemap generator ไม่อยู่ในรีโป** (เจอแค่ใน `test/domain-canonical.test.ts`) จึงตรวจย้อนหลังไม่ได้ — ขอผลรันของเวอร์ชันก่อนแก้ 1 ก้อน |
| "ยิงเช็ค asset เก่า 10 ไฟล์ = 200" | `crawler-report-snapshot.md` (แสดง 5 hash: `index-B2QykOUz.js`, `B95vp4w_.css`, `B9DhLiSP.js`, `BCsNh8wj.js`, `BUdv-Igb.css`…) | ⚠️ ไม่ครบ 10 | รันต่อได้ทันที (HEAD ทีละ hash) ผมยังไม่ยืนยันแทน |
| container 2 ตัวถูก pause + watchdog ข้าม | **ไม่ปรากฏใน 8 ไฟล์หลักฐาน** (เจอเฉพาะใน `job-293:19,28,41-42,56`) | ❌ ไม่มี且在เครื่องผมตรวจไม่ได้ | ภายนอก observable ไม่มี (images-admin ไม่มี route สาธารณะ; n8n ไม่มี hostname/in ไม่ระบุใน `deploy/**` ให้ยิง) ⇒ **ตรวจไม่ได้** + ขอผล `knight_watchdog.sh` dry-run 1 snippet (แบบที่ทำกับไฟล์อื่น) แล้วจะปิดได้ |
| cert "หมดอายุ ~7 ม.ค. 70" | ไม่มีในไฟล์หลักฐาน | ✅ **ไม่จำเป็น** | ผมวัดเองจากภายนอกได้ (ข้อ A) → เป็นหมวดที่เดวิดไม่ต้องหา evidence มาให้ |

## F. เอกสาร vs ความจริง (job-293 + หลักฐานชุดนี้ เทียบกับสิ่งที่ผมวัดเอง)

| ประเด็นในเอกสาร | สิ่งที่ผมวัดเอง | ผล |
|---|---|---|
| cert com/www SAN = com+www เท่านั้น | SAN = `knightbasins.com, www.knightbasins.com` | ✅ ไม่ขัด |
| cert line = line เดียว | SAN = `line.knightbasins.com` | ✅ ไม่ขัด |
| หมดอายุ 7 ม.ค. 70 | notAfter `Jan 7 05:51:42 2027 GMT` | ✅ ไม่ขัด |
| ถอดโฮสต์เก่า 22 สคริปต์ + VPS 4 + .env + KB 4 → สาธารณะต้อง 0 | **0 hits บน 24 URLs** และ legacy web 404 ทุกเส้น | ✅ ไม่ขัด |
| "`api.srv…` ยังอยู่ในระบบเดิม" (ไม่ได้อ้างว่าปิด) | ยังตอบ 200 (ภาพ slab) | 🟡 ไม่ขัดตัวอักษร แต่**ขัดความรู้สึกของคำว่า "ถอดครบ"** → ควรเขียนในเอกสารให้ชัดว่าเหลือ data-plane 1 ตัว |
| chain = gemini → cohere → apodex → deepseek-chat (claim 292) | dry-run: 5 ตัว มี `deepseek-v4.1-flash` นำหน้า | ⚠️ **ขัด (เล็กน้อย)** → แก้เอกสาร |
| cron 2 งาน = `cohere/north-mini-code:free` + telegram | `cron-jobs-summary.md` แสดงตรง + `bundle-watch` active | ✅ ไม่ขัด |
| ตั้งสลับเป็นรายสัปดาห์ 23 ต.ค. | `knight-tracker-switch-to-weekly · once at 2026-10-23 02:00 · deliver=origin` | 🟡 ไม่ขัด แต่ `deliver=origin` เป็นค่าที่ไม่มีใน vocabulary ตัวอื่น (local/telegram) → ตรวจว่า jobs.json ตั้งถูกจริง |
| 23 URL สาธารณะต้อง 0 | ผมวัด 24 URLs = 0 | ✅ ไม่ขัด |
| ตัวเลข tokens ใน ledger | คำนวณย้อนได้ว่า 2.6–3.9M tokens/call | ❌ **ไม่สมเหตุสมผล ต้องตรวจใหม่** (ข้อ E แถว 1) |

---

## สรุปผลตามเช็คลิสต์ 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | cert com/www SAN ไม่มี srv1964473 | ✅ (วัดเอง) |
| 2 | cert line SAN เดียว | ✅ (วัดเอง) |
| 3 | วันหมดอายุใบใหม่ | ✅ วัดได้ `Jan 7 2027` = 7 ม.ค. 70 |
| 4 | โฮสต์ที่ถอดแล้ว 404 ทุกเส้น | ✅ web 404 (ทั้งตาม DNS และบังคับ IP เดิม) · ⚠️ `api.srv…` ยัง 200 |
| 5 | LINE webhook เก่า 404 / ใหม่ 405 | ✅ (404 / 405; POST = 401 ตามคาด) |
| 6 | 23 URL สาธารณะ = 0 | ✅ (ผมวัด 24 = 0 ทุกตัว) |
| 7 | verify-deploy ท้ายไฟล์ 22/22 | ✅ (PASS 22/FAIL 0) |
| 8 | probe 15 ตัว → safe 3 · train 8 · ไม่จบ 4 | ✅ (parse แถวจริงแล้ว ตรง dry-run) |
| 9 | ledger มี cohere:free + ต้นทุน 0 | ✅ + คำเตือน "ประหยัดจากไฟล์นี้ไม่ได้" |
| 10 | ไม่มีคีย์ในหลักฐาน | ✅ 8/8 ไฟล์ = 0 hits |
| 11 | ตัวเลขที่ไม่มีหลักฐาน | ❗ ระบุแล้ว 6 รายการ (E) — หนักสุดคือ **tokens/call ของ ledger** |
| 12 | เอกสาร vs ความจริง | 🟡 ไม่ขัด 9 จุด · ขัด/ควรแก้ 3 จุด (chain 5 ตัว, "ถอดครบ" vs api. ยัง 200, ledger tokens) + `deliver=origin` 1 จุด |

### ข้อเสนอ (เรียงตามความคุ้ม/แรง)
1. **แก้ ledger method ก่อนใช้ตัวเลขไหนอ้างอิง** (sum ผิดขั้น = ตัวเลขต้นทุน/ประหยัดทั้งหมดหล่น · ยังดีที่เดวิด เขียนเองว่า "คำนวณไม่ได้" → ห้ามใครเอาตารางนี้ไปพูดเรื่องเงิน)
2. **commit ตัวสคริปต์ Hermes (`bin/*.py`, `bin/*.sh`) ลง `deploy/hermes-runtime/`** → md5 ที่มีอยู่จะเริ่ม "ตรวจได้จริง" และผู้ตรวจรอบหน้ารันซ้ำเองได้ทุกตัวเลข (นี่คือก้าวสุดท้ายของสิ่งที่เริ่มไว้ในโฟลเดอร์หลักฐาน — ซึ่งรอบนี้ช่วยได้มาก: 3 เกณฑ์ที่ผม "ตรวจไม่ได้" ใน 292 กลายเป็น "ยืนยันได้" แล้ว)
3. เพิ่มในโฟลเดอร์หลักฐาน: `watchdog-dry-run`(container skip) + `url-inspection-raw` (12 ชุด) + `crawler-report-ก่อนแก้` (ปิดเคส "22")
4. ระบุสถานะ `api.srv1964473` ให้ชัดใน KANBAN (จะปิดเมื่อไร/ปิดยังไง) + ตัดสินใจเรื่อง 301 ของลิงก์เก่าที่ cache กระจายไปแล้ว

### ความเสี่ยงคงเหลือ
- **ความเสี่ยงต่ำ:** ชื่อเก่ายัง resolve ไป IPv6 ของ Hostinger และ `api.srv…` ยังเสิร์ฟภาพ → ถ้าวันดีคืนดีเขา free IP นี้ คนอื่นอาจได้ hostname เดิม (cert ไม่มีแล้ว แต่ *image* เคยสาธารณะ) · ภาพ slab ทั้งหมดผ่าน canonical rewrite ของ `api.srv…` บน `knightbasins.com/kb/images/...` ยังรอด ผมสุ่มตรวจแล้ว (200)
- **ความเสี่ยงปานกลาง:** เอกสารยังอ้าง "chain 4 ตัว" (จริง 5) และ "ถอดครบ" (จริงเหลือ data-plane) → คนเอาไปตัดสินใจต่ออาจเข้าใจผิด
- **ความเสี่ยงของกระบวนการ:** ตัวเลขที่ยังวัดซ้ำไม่ได้ล้วนยังอยู่ในไฟล์สรุป (ledger, GSC) — ต้องจำไว้ว่า "หลักฐานชุดนี้ = คำให้การของเดวิดที่ raw กว่าเดิมมาก" ไม่ใช่การยืนยันอิสระครบทุกช่อง

---
**ลงชื่อ:** Qwen · ตรวจเมื่อ 9 ต.ค. 69 (TH) · baseline `origin/main = ad78709` · branch `docs/qwen-job294-review-round2` · read-only 100% (ไม่มีไฟล์ระบบ/config/DB/container ถูกแก้, ไม่ restart, ไม่ merge PR ผู้ใด) · คีย์/token ปรากฏในรายงานนี้: **0**
