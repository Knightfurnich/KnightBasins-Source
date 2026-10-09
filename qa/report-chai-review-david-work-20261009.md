# รายงานตรวจทานงานเดวิดแบบอิสระ — ใบ 291-C (ชัย) · ถอดโฮสต์เก่า `*.srv1964473.hstgr.cloud`

**ตรวจเมื่อ:** 9 ต.ค. 69 เวลา ~12:50–13:15 น. (เวลาไทย) · **ฐานที่ตรวจ:** `main` = `1e17841` (Deploy สำเร็จ 12:45 น. ไทย) · **ผู้ตรวจ:** ชัย · **ผู้รับรายงาน:** บอส + เดวิด
กติกาของใบ: รายงานเดวิด = คำให้การ ไม่ใช่ข้อเท็จจริง · ทุกข้อรันเองและแนบผลดิบ · ตรวจไม่ได้ = บอกว่าตรวจไม่ได้ ห้ามเดา

## ข้อจำกัดของผม (ต้องอ่านก่อน — ใบเขียนไว้สำหรับเครื่องของเดวิด)
ใบสั่งให้ใช้ `/opt/data/bin/verify_deploy.py`, `hssh.py` (SSH เต็มสิทธิ์), `/tmp/db_host_audit.sh`, LINE token, `/docker/traefik/logs` — **ผมไม่มีสิ่งเหล่านี้** สิทธิ์ผมคือ:
- `GET`/`HEAD` สาธารณะ (ไม่ `POST` ใน production ตามกติกาประจำของผม)
- กุญแจ SSH อ่านอย่างเดียวแบบ forced-command ที่ทำได้แค่ `status` / `apilog` / `tfmeta` (ใช้แล้วในรอบนี้ — ไม่ได้พยายามเลี่ยง)
- โค้ดใน repo (รันเทสต์ในเครื่อง)

ผลคือ **ข้อ A, C, D, G และส่วนหนึ่งของ E ตรวจตรงไม่ได้** ผมทำ "ตัวแทนจากภายนอก" ให้ทุกข้อเท่าที่ทำได้ และแยกให้ชัดในตารางว่าอะไรคือตัวแทน ไม่ใช่การตรวจตรง · ท้ายรายงานมีรายการคำสั่งที่เดวิดต้องรันเองเพื่อปิดข้อที่ค้าง

## สรุป 5 บรรทัด
1. **ถูก (ตรวจเองแล้ว):** โฮสต์เก่าตายจริง (8 เส้นทาง 404 ทั้งหมด) · โดเมนใหม่ 200 · หน้าสาธารณะ 23 URL มี `srv1964473` **0 จุด** · main มีไฟล์ของผมครบเหมือนกันทุกไฟล์ · เทสต์ที่เดวิดกลับทิศ **จับหลุดได้จริง** (ใส่โฮสต์เก่ากลับ 4 แบบ ตกทั้ง 4) · แคตตาล็อกหลัง UPDATE เทียบก่อนแก้ 2,480 ฟิลด์ **ต่าง 0** รวมลำดับแกลเลอรี 158/158
2. **ยังไม่น่าเชื่อถือ (ตรวจตรงไม่ได้):** UPDATE DB 585 แถว (ผมเห็นได้เฉพาะตารางแคตตาล็อกผ่าน API) · ไฟล์จริงบน VPS · KB 3 ไฟล์ · LINE endpoint ในคอนโซล · ค่า `PUBLIC_APP_ORIGIN` · ผล `verify_deploy.py` 22/22
3. **เดวิดมองข้าม/พลาด:** (ก) คอมเมนต์ที่ commit ใน `nginx.conf` เขียนว่า "DNS … stopped serving it" แต่ผมพิสูจน์ว่า DNS **ยังชี้มา VPS** (wildcard ของ Hostinger) (ข) UPDATE น่าจะครอบ `system_audit_logs` (ใบสั่งให้สุ่มจากตารางนี้ — ยืนยันไม่ได้) = แก้บันทึกตรวจสอบย้อนหลัง (ค) ไม่มีหลักฐานว่าวัดทราฟฟิกโฮสต์เก่าก่อนปิด (ง) ลำดับ: ถอดโฮสต์ 11:50 น. → แก้ข้อมูล ~12:05 น. (กลับกับที่ควร) (จ) ใบรับรองของ `knightbasins.com` ที่เสิร์ฟอยู่ยังมีโฮสต์เก่าเป็น CN/SAN จะหมดอายุ 3 ม.ค. 70
4. **ข้อเสนอ:** ให้เดวิดรันคำสั่ง 7 ข้อท้ายรายงานแล้วแนบผลดิบ · แก้คอมเมนต์ DNS · ตัดสินเรื่อง `system_audit_logs` · ทดสอบกู้ไฟล์สำรอง · ตั้งเตือนตรวจต่ออายุใบรับรองต้น ธ.ค.
5. **ความเสี่ยงคงเหลือ:** ลิงก์เก่าที่ส่งไปแล้ว (LINE/ใบเสนอราคา/อีเมล) เปิดไม่ติดโดยเจตนา (บอสสั่ง) · ข้อมูลใน DB ยังมี `api.srv1964473` 239 แถว (ยังใช้งานได้ ณ ตอนนี้ — `api.srv…/kb/images/slab/BW010.png` = 200)

**ไม่พบปัญหาที่กระทบการใช้งาน production ในสิ่งที่ผมเห็นได้ ณ เวลาตรวจ**

---

## ตารางสรุป A–I

| ข้อ | ผล | ตรวจตรง/ตัวแทน | หลักฐานสั้น |
|---|---|---|---|
| A `verify_deploy.py` 22/22 | **ตรวจไม่ได้** | ตัวแทน: ข้อ B+E+F+G-สาธารณะ | สคริปต์อยู่เครื่องเดวิด ผมไม่มี · ดู "คำสั่งที่เดวิดต้องรัน" ข้อ 1 |
| B โฮสต์เก่าตาย / ใหม่ 200 | **ผ่าน** (ยกเว้น POST) | ตรง | ดูข้อ B |
| C grep ไฟล์จริงบน VPS | **ตรวจไม่ได้** | ตัวแทน: พฤติกรรมภายนอก | ดูข้อ C |
| D นับแถว DB / สุ่ม 5 / ยิง 3 URL | **ตรวจไม่ได้** | ตัวแทน: ตารางแคตตาล็อกผ่าน API | ดูข้อ D |
| E ไม่มีที่ไหนชี้โฮสต์เก่า | **ผ่านบางส่วน** | ตรง (หน้าเว็บ/API/repo) · KB ตรวจไม่ได้ | 0 จุด / 23 URL |
| F รีโป ↔ VPS + เทสต์จับหลุด | **ผ่าน** (เทสต์) · รีโป=VPS **ตรวจระดับไฟล์ไม่ได้** | ตรง (เทสต์) · ตัวแทน (VPS) | 4/4 mutant ตก · porcelain 0 |
| G LINE ปลายทาง | **ตรวจไม่ได้** (ส่วน API/log) · ส่วนสาธารณะผ่าน | ตัวแทน | `line.…/line/webhook` GET=405 · เก่า=404 |
| H ความเสี่ยงที่มองข้าม | **6 ข้อ** | วิเคราะห์ + วัด | ดูข้อ H |
| I ข้ออ้าง `array_replace` | **เห็นด้วย** (ตามเอกสาร PostgreSQL) | อ้างเอกสาร + ข้อมูลจริงบางส่วน | ดูข้อ I |

---

## ท่าทีต่อคำอ้างของเดวิด 8 ข้อ

| # | เดวิดอ้างว่า | ท่าที | เหตุผล |
|---|---|---|---|
| 1 | merge #404/#406/#407 · main `51389a0` · deploy สำเร็จ | **เห็นด้วย** | ไฟล์ทุกไฟล์ใน 3 สาขาของผม **เหมือน main ทุกไฟล์** (`git diff --stat` ว่าง) · `api-dist`/`web-dist` หายจาก main · Release validation + Deploy ของ `51389a0` = success (รอบ `98e31be` ที่ deploy ถูกยกเลิกคือถูกรอบถัดไปแทน — ปกติ) |
| 2 | แก้ `PUBLIC_APP_ORIGIN` เป็นโดเมนใหม่ | **ตรวจไม่ได้** | `printenv` ต้องเข้า container — ไม่มีสิทธิ์ · ไม่มีช่องสาธารณะที่แสดงค่านี้ · ผลทางอ้อมที่เห็นได้ (`redirect_uri` ของ LINE = โดเมนใหม่) เป็นคนละตัวแปร (`LINE_CALLBACK_URL`) |
| 3 | ถอดโฮสต์เก่าจาก nginx.conf + Traefik (เก่า 404 / ใหม่ 200) | **เห็นด้วยกับผลภายนอก · ตรวจไฟล์ไม่ได้** | ดูข้อ B, C |
| 4 | UPDATE DB 585 แถว (ไม่แตะ api.srv 239) + สำรอง | **ตรวจไม่ได้** (เห็นผลทางอ้อมบางส่วนเท่านั้น) | ดูข้อ D, H |
| 5 | PR #408 ซิงก์รีโป + กลับทิศเทสต์ | **เห็นด้วย** (โค้ด/เทสต์) · **ไม่เห็นด้วย** กับข้อความในคอมเมนต์ | ดูข้อ F |
| 6 | KB 3 ไฟล์ | **ตรวจไม่ได้** | KB อยู่เครื่องเดวิด ไม่อยู่ใน repo/สิทธิ์ผม |
| 7 | LINE: ถอดประตูสำรอง + ตั้ง endpoint + webhook/test 200 | **ตรวจไม่ได้** (ส่วนสาธารณะสอดคล้อง) | ดูข้อ G |
| 8 | แก้ `verify_deploy.py` + `knight_bundle_probe.sh` | **ตรวจไม่ได้** · ข้อสังเกตกระบวนการ | ไฟล์อยู่เครื่องเดวิด ดูข้อ A |

---

## B. โฮสต์เก่าตายจริง (วัดเอง 12:49 น.)

```
OLD  https://knightbasins.srv1964473.hstgr.cloud
  /                          404||text/plain; charset=utf-8
  /stone                     404||text/plain
  /api/catalog               404||text/plain
  /api/healthz               404||text/plain
  /line/webhook   (GET)      404||text/plain
  /assets/                   404||text/plain
  /kb/images/slab/BW010.png  404||text/plain
  /api/uploads/x.png         404||text/plain
NEW  https://knightbasins.com
  /                200||text/html          /stone        200||text/html
  /api/catalog     200||application/json   /api/healthz  200||application/json
LINE https://line.knightbasins.com/line/webhook (GET)         405   ← มีเส้นทาง รับเฉพาะ POST
     https://line.srv1964473.hstgr.cloud/line/webhook (GET)   404   ← ประตูสำรองถอดแล้ว
```
- ใบสั่งให้ยิง `POST …/line/webhook` ที่โฮสต์เก่า — **ผมไม่ได้ทำ** (กติกาของผม: ไม่ POST ใน production) ใช้ `GET` ที่เส้นทางเดียวกันแทน ได้ 404 · ถ้าเดวิดต้องการ POST ให้เดวิดยิงเอง
- 404 เป็น `text/plain` แบบของ Traefik (ไม่มี router) ไม่ใช่หน้า 404 ของแอป → ตรงกับการที่ Traefik rule ไม่รับโฮสต์เก่าแล้ว

## C. ไฟล์จริงบน VPS — ตรวจไม่ได้ (ตัวแทนด้านพฤติกรรม)
ผมอ่านไฟล์ `/docker/...` ไม่ได้ จึงเทียบ "สิ่งที่ `nginx.conf` ใน repo สั่งไว้" กับพฤติกรรมของเว็บสด 7 อย่าง **ตรงทั้ง 7**:
```
/index.html                    -> 301 https://knightbasins.com/
www.knightbasins.com/stone     -> 301 https://knightbasins.com/stone
/stone/                        -> 301 https://knightbasins.com/stone
/definitely-not-a-page-xyz     -> 404 + X-Robots-Tag: noindex, nofollow
/quote/view?x=1                -> X-Robots-Tag: noindex, nofollow
/  headers                     -> nosniff · strict-origin-when-cross-origin · SAMEORIGIN · X-Robots-Tag index,follow…
/api/healthz                   -> 200 (proxy ไป knightbasins-api)
```
แปลว่า nginx บน VPS **ทำงานเหมือน** ไฟล์ใน repo ในจุดที่ตรวจได้ แต่ **พิสูจน์ไม่ได้ว่าไม่มี `knight_legacy_host`/โฮสต์เก่าเหลือในไฟล์ VPS** เพราะ Traefik ตอบ 404 ก่อนถึง nginx ทำให้เทสต์จากภายนอกมองไม่เห็นส่วนนั้น → ต้องใช้ `grep` บน VPS (คำสั่งข้อ 3 ท้ายรายงาน)
สถานะคอนเทนเนอร์จาก `status` (กุญแจอ่านอย่างเดียว, 12:50 น.): `knightbasins-web Up 2 minutes` · `knightbasins-api Up 2 minutes (healthy)` · `line-proxy Up 17 minutes` · `traefik Up 3 days` — สอดคล้องกับ deploy 12:45 น. (web/api ถูกสร้างใหม่) และการแก้ line-proxy ก่อนหน้า ~17 นาที · `apilog`: API เพิ่งเริ่ม (request id 1–14, `/api/healthz` 200 ทุก 15 วินาที, `/api/catalog` 200)

## D. DB — ตรวจไม่ได้ (ตัวแทนจาก API)
ผมไม่มีสิทธิ์ DB จึงไม่ได้นับ 585/239/0 และไม่ได้สุ่ม 5 แถว (payment_slips, system_audit_logs ฯลฯ) **ข้อนี้ไม่ผ่านโดยสถานะ "ตรวจไม่ได้" ไม่ใช่ "ผิด"**
ตัวแทนที่ทำได้ (ครอบเฉพาะ `basin_prices`, `installed_stone_prices`, `sheet_stone_prices`, `basin_categories`): เทียบสแนปช็อต `/api/catalog` ที่ผมเก็บไว้ก่อนแก้ (8 ต.ค.) กับของสดวันนี้ หลังแทนที่โฮสต์เก่าด้วยโดเมนใหม่ตามกติกาเดียวกับที่ #404 ใช้:
```
old-host strings: ก่อน 748 → สด 0
แถว: basins 30/30 · installed 65/65 · sheet 64/64 · categories 2/2 · ชุดรหัสเหมือนกัน
ฟิลด์ที่เทียบ 2,480 → ต่างกัน 0   (ไม่นับ updatedAt)
แถวที่มีแกลเลอรี 158 → ลำดับรูปเหมือนเดิม 158/158
```
ข้อจำกัดสำคัญ: ผลจาก API ผ่านตัวแปลงของ #404 ซึ่งแปลงโฮสต์เก่าให้เองตอนส่งออก → **API มองไม่ออกว่า DB ถูก UPDATE จริงหรือยัง** สิ่งที่ยืนยันได้มีแค่ "ข้อมูลแคตตาล็อกไม่เสียหาย ลำดับไม่เปลี่ยน ราคา/สถานะไม่เปลี่ยน" ส่วน `payment_slips`, `customer_leads`, `system_audit_logs`, อีก 239 แถวของ `api.srv…` และไฟล์สำรอง **ไม่เห็นเลย**
เสริม: `api.srv1964473.hstgr.cloud/kb/images/slab/BW010.png` ยังตอบ **200 image/png** → แถวที่ยังชี้ `api.srv…` ใช้งานได้ ณ ตอนนี้

## E. ไม่มีที่ไหนชี้โฮสต์เก่า (วัดเอง)
```
นับ srv1964473 ใน 23 URL สาธารณะ: llms.txt 0 · llms-full.txt 0 · sitemap.xml 0 · sitemap_index.xml 0 · robots.txt 0 · /
  + 12 หน้าตาม sitemap (/portfolio /stone /price-guide /site-prep /studio-guide /quote /studio /sketch /readme /updates /network) 0 ทุกหน้า
  + /api/catalog 0 (มีลิงก์ knightbasins.com 748 จุด) · /api/site-photos/showcase 0 · /api/portfolio 0 · /api/healthz 0 · /api/support/voice-status 0
  รวม = 0
LINE login: GET /api/auth/line/login -> redirect_uri=https://knightbasins.com/api/auth/line/callback
repo main (นอก qa/ attached_assets/ KANBAN): `knightbasins.srv…` เหลือเฉพาะ
  - ฟิกซ์เจอร์ในเทสต์ที่ตั้งใจ (canonical-media-url ×3, line-auth ×1, domain-canonical ×2 = ค่าคงที่ LEGACY_HOST)
  - docs/team/ONBOARDING-freebuff.md บรรทัด 48 (ประโยคอธิบายว่าปลดระวางแล้ว)
  `api.srv…` เหลือ: ตัวตรวจจับใน catalog-media.ts, mockup-sandbox 2 บรรทัด, README HERMES_API_URL (ตั้งใจ — บอสสั่งไม่แตะ)
```
- KB (`knight-design-kb/**`): **ตรวจไม่ได้** (ไม่มีสิทธิ์) · ไฟล์สำรอง/HANDOFF: ไม่ได้ตรวจ

## F. PR #408 และเทสต์

**อ่านแล้ว** (`gh pr diff 408` ทั้งหมด 4 ไฟล์): `nginx.conf` ลบ map + บล็อก 301 + ตัดโฮสต์เก่าจาก `server_name` · `docker-compose.yml` Traefik rule เป็น ``Host(`knightbasins.com`) || Host(`www.knightbasins.com`)`` · เทสต์ถูกกลับทิศ · `ONBOARDING-freebuff.md` 1 บรรทัด · CI เขียวทั้งสองงาน ก่อน merge

**ทดลอง fail→pass** (worktree `main`, ไฟล์ถูกคืนด้วย `git checkout --` ทุกครั้ง):
| ใส่กลับเข้าไป | `domain-canonical.test.ts` |
|---|---|
| โฮสต์เก่าใน `server_name` ของ nginx.conf | **ตก** 1/7 (ผ่าน 6) `keeps the retired legacy hostname out of the deploy config` |
| โฮสต์เก่าในคอมเมนต์ของ nginx.conf บรรทัดเดียว | **ตก** |
| `map $host $knight_legacy_host` กลับมา (ไม่มีชื่อโฮสต์) | **ตก** |
| โฮสต์เก่าใน Traefik rule ของ compose | **ตก** |
| ไม่แก้อะไร (ก่อน/หลังคืนไฟล์) | **ผ่าน 7/7** · `git status --porcelain` = 0 |

**ไม่เห็นด้วยกับข้อความเดียว:** คอมเมนต์ที่ #408 เพิ่มใน `nginx.conf` เขียนว่า *"DNS, Traefik and nginx all stopped serving it"* — **DNS ไม่ได้หยุด** วัดเอง: ชื่อสุ่ม `foo-doesnotexist.srv1964473.hstgr.cloud` ก็ resolve เป็น `72.62.79.84` (IP ของ VPS) เพราะเป็น wildcard ของ Hostinger ลบเองไม่ได้ · โฮสต์เก่ายังได้ใบรับรอง Let's Encrypt (CN เดิม, หมดอายุ 12 ธ.ค. 69) และตอบ 404 ผ่าน Traefik · ข้อความใน repo ที่เป็นข้อเท็จจริงเท็จควรแก้
**ข้อจำกัดของเทสต์:** เทสต์อ่านได้เฉพาะ **สำเนาใน repo** ไม่เห็นไฟล์บน VPS จึงกันไม่ได้ถ้าไฟล์จริงเปลี่ยนแล้วไม่ sync กลับ (เหตุการณ์ compose ใน repo ไม่ตรงของจริงเมื่อวานเป็นตัวอย่าง) → ต้องมีขั้นตอน/สคริปต์เทียบไฟล์ VPS กับ repo (diff หรือ checksum) นอกเหนือจากเทสต์

## G. LINE
- ตรวจไม่ได้: `GET api.line.me/v2/bot/channel/webhook/endpoint` (ต้อง channel token — ผมไม่มีและไม่ควรขอ), ส่งข้อความทดสอบเข้าบอท (ต้องบัญชี LINE), `traefik/logs/access.log` (ไม่มีสิทธิ์)
- ตัวแทนสาธารณะ (สอดคล้องกับคำอ้าง ไม่ใช่ข้อพิสูจน์): `line.knightbasins.com/line/webhook` GET = 405 (มีเส้นทาง) · `line.srv…` = 404 · `line-proxy` ถูกสร้างใหม่ ~17 นาทีก่อน 12:50 น. · LINE **Login** callback ฝั่งเซิร์ฟเวอร์ = โดเมนใหม่ (คนละการตั้งค่ากับ webhook ของ Messaging API)
- ข้อสังเกต: เดวิดตั้ง webhook ผ่าน API ด้วย channel token โดยไม่มีบันทึกว่าค่าเดิมคืออะไร ถ้าต้องย้อนกลับต้องมีค่าเก่าเก็บไว้ — ขอให้เดวิดแนบค่าก่อนแก้

## H. ความเสี่ยงที่เดวิดอาจมองข้าม (6 ข้อ)
| # | ความเสี่ยง | หลักฐานที่วัด | ระดับ | ข้อเสนอ |
|---|---|---|---|---|
| H1 | คอมเมนต์ใน repo ระบุข้อเท็จจริงผิดเรื่อง DNS | ชื่อสุ่มใต้ `srv1964473.hstgr.cloud` resolve เป็น `72.62.79.84` | ต่ำ | แก้คอมเมนต์ใน `nginx.conf` (บรรทัด ~24) |
| H2 | ใบรับรองของโดเมนหลักยังผูกกับโฮสต์เก่า | `openssl s_client` ที่ `knightbasins.com`: CN=`knightbasins.srv1964473.hstgr.cloud`, SAN = `knightbasins.com`, `knightbasins.srv…`, `www.knightbasins.com`, หมดอายุ **3 ม.ค. 70** · Traefik rule ตอนนี้ไม่มีโฮสต์เก่า → รอบต่ออายุ (~ต้น ธ.ค.) จะขอใบใหม่ให้เฉพาะ com+www | กลาง-ต่ำ | เดวิดดู log ต่ออายุ ACME ต้น ธ.ค. หรือบังคับออกใบใหม่ตอนนี้ในช่วงที่ดูแลอยู่ · ใบรับรองของโฮสต์เก่าอีกใบ (หมด 12 ธ.ค.) ไม่ต่ออายุ = ไม่มีผล |
| H3 | UPDATE น่าจะครอบ `system_audit_logs` | ใบ 291 ข้อ D.3 สั่งให้สุ่มแถวจากตารางนี้ ซึ่งบ่งว่าถูกแก้ (ผมยืนยันไม่ได้ — ไม่มีสิทธิ์ DB) · เป็นบันทึกตรวจสอบย้อนหลัง | **กลาง** | ตัดสินใจว่าควรแก้บันทึกย้อนหลังหรือไม่ (ผมเห็นว่าไม่ควร — ไม่มีผลต่อการใช้งาน แต่ทำให้ร่องรอยเดิมเปลี่ยน) · ถ้าแก้แล้ว ให้บันทึกในรายงานว่าแก้อะไร และเก็บไฟล์สำรองไว้ |
| H4 | ไฟล์สำรอง `db-pre-host-retire-…sql.gz` 52 KB ไม่เคยทดสอบกู้ | ผมเปิดไม่ได้ | กลาง | เดวิดรัน `zcat … \| head -3`, นับ `CREATE TABLE`, กู้ลง DB ชั่วคราวแล้วเทียบจำนวนแถว (คำสั่งข้อ 6) |
| H5 | ลำดับงานกลับด้าน | ใบ 291 ระบุสำรอง nginx/compose `…045031Z` (11:50 น.) ก่อน dump DB `…050546Z` (12:05 น.) → ช่วง ~15 นาทีที่ข้อมูลยังมีโฮสต์เก่าแต่โฮสต์ตายแล้ว (ข้อมูลแคตตาล็อกจาก API ถูกแปลงโดย #404 อยู่แล้ว แต่ส่วนที่อ่านลิงก์จาก DB ตรง ๆ ไม่ผ่านตัวแปลง เช่น PDF/ใบเสนอราคา — ผมประเมินไม่ได้ว่ามีกี่รายการ) | ต่ำ (ผ่านไปแล้ว) | บทเรียนเดียวกับใบ 280: แก้ข้อมูลก่อน ถอดโฮสต์ทีหลัง |
| H6 | ไม่มีข้อมูลทราฟฟิกโฮสต์เก่าก่อนปิด | ไม่พบการแนบจำนวนคำขอเข้าโฮสต์เก่าในรายงาน | กลาง | แนบสรุป access log ย้อนหลัง (เช่น 7 วัน) เพื่อบอกบอสว่าลิงก์เก่าตายแล้วกระทบกี่คำขอ · ลิงก์ใบเสนอราคา/ติดตามงานเก่า (`/quote/view?token=…`) ตอนนี้ 404 ข้อความธรรมดา |
| H7 | งานที่ผมมองไม่เห็นนอกรายการ | n8n, Hermes agent config, Search Console/Bing, Google Business Profile ไม่ถูกกล่าวถึงในคำอ้างของเดวิด | กลาง | ยืนยันว่าตรวจแล้วหรือยัง |
| H8 | กระบวนการ: ผู้เขียน = ผู้ merge = ผู้แก้ production | คำอ้างข้อ 5 บอกว่าเดวิดเขียน/merge #408 เอง และ UPDATE DB เอง (ผมยืนยันผู้ merge ไม่ได้ — ทุก PR ขึ้นบัญชี `Knightfurnich` บัญชีเดียว) | กลาง | ตามข้อเสนอจากใบ 280: ส่ง UPDATE ที่จะรันให้ผู้ตรวจดูก่อน |

## I. ข้ออ้าง "array_replace ไม่โดน"
**เห็นด้วย** ตามเอกสาร PostgreSQL (ดึงจาก `postgresql.org/docs/current/functions-array.html` เอง): *"array_replace … Replaces each array element equal to the second argument with the third argument."* คือเทียบ **ทั้งก้อนของ element** ไม่ใช่ substring · ถ้า element คือ `https://old.host/x.png?v=1` แล้วส่งคู่ `'https://old.host' → 'https://new'` จะไม่ตรงกับ element ใด → ไม่เปลี่ยนอะไรและไม่ error ซึ่งอธิบายสิ่งที่เดวิดเล่าว่ารอบแรก "ไม่โดน" ได้ครบ · การแก้ด้วย `array_agg(replace(...))` จึงถูกทาง
ข้อควรระวังของวิธีที่สอง (ผมตรวจผลได้เฉพาะแคตตาล็อก): `array_agg` ต้องรักษาลำดับ (ใช้ `WITH ORDINALITY`/`ORDER BY`) และอย่าแตะแถวที่ array ว่าง (จะกลายเป็น `NULL`) — ในแคตตาล็อกลำดับรูปไม่เปลี่ยน **158/158** · ผมไม่มี PostgreSQL ให้ทดลองและไม่ได้แตะ DB จึงไม่ได้ยิงทดสอบจริง (ไม่มี engine ในเครื่อง)

---

## คำสั่งที่เดวิดต้องรันเองเพื่อปิดข้อที่ "ตรวจไม่ได้" (แนบผลดิบในคอมเมนต์ PR นี้ — ห้ามพิมพ์คีย์)
1. `HERMES_HOME=/opt/data /opt/hermes/.venv/bin/python3 bin/verify_deploy.py` → ท้ายสุด `22/22 passed` (ระบุ commit ของสคริปต์ด้วย เพราะแก้ไฟล์นี้เอง)
2. `curl -s -o /dev/null -w "%{http_code}|%{redirect_url}\n" -X POST https://knightbasins.srv1964473.hstgr.cloud/line/webhook` → 404
3. บน VPS: `grep -rn "knightbasins.srv1964473" /docker/knightbasins/nginx.conf /docker/knightbasins/docker-compose.yml /docker/line-proxy/docker-compose.yml; grep -n server_name /docker/knightbasins/nginx.conf; grep -n line.rule /docker/line-proxy/docker-compose.yml` และ `diff <(cat /docker/knightbasins/nginx.conf) deploy/hostinger/nginx.conf` (เทียบกับ repo จริง)
4. `bash /tmp/db_host_audit.sh` → `retired=0`, `apihost=239` + ตารางแยกตามชื่อตารางที่ถูกแก้ (ระบุ `system_audit_logs` และ `payment_slips` ว่ากี่แถว)
5. สุ่ม 5 แถว (URL ก่อน/หลัง) + `curl -o /dev/null -w "%{http_code}"` 3 URL จาก DB คนละตาราง
6. `zcat backups/db-pre-host-retire-20261009T050546Z.sql.gz | head -3` · `zcat … | grep -c "CREATE TABLE"` · กู้ลง DB ชั่วคราวแล้วนับแถวเทียบ
7. LINE: `GET /v2/bot/channel/webhook/endpoint` (ปิดบัง token) + `grep "line/webhook" /docker/traefik/logs/access.log | tail -3` + ค่า endpoint เดิมก่อนแก้ · `printenv PUBLIC_APP_ORIGIN` ใน container `knightbasins-api` (แสดงเฉพาะค่านี้) · `grep -rln srv1964473 /opt/data/knight-design-kb/` (แยกไฟล์สำรอง)

*ไม่ได้พิมพ์ค่าคีย์/token ใด ๆ · ไม่ได้ POST/UPDATE/DELETE/restart ใด ๆ · ไม่ได้แก้ไฟล์ config บน VPS · ไม่ได้ merge PR ของเดวิด · ไฟล์ทดลองใน repo คืนครบ (`git status --porcelain` = 0)*
