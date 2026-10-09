# รายงานตรวจสุขภาพระบบ Knight Basins (ใบ 298-C) — ชัย · 9 ต.ค. 69

**ผู้ตรวจ:** ชัย · **ตรวจเมื่อ:** 9 ต.ค. 69 เวลา 18:38–18:43 น. (เวลาไทย) · **ฐาน:** `main` @ `0da27f8` (#426)
**วิธี:** `GET`/`HEAD` สาธารณะ + `openssl s_client` + `status`/`apilog` (กุญแจอ่านอย่างเดียว) + `gh run list` · ไม่ `POST` · ไม่แก้/restart อะไร
**ไม่ได้ตรวจ:** ข้อมูลใน DB (ย้าย 205 แถว) — ไม่มีสิทธิ์ DB ใบนี้ไม่ได้ขอ (ใบ 299-Q ของ Qwen)

## 1. สรุป 5 บรรทัด

1. **ยืนยันว่าใช้งานได้:** 16/16 URL เว็บ 200 · API 5 เส้น 200 (เส้นหนึ่งตอบ 502 ครั้งแรก ดูข้อ 2) · แคตตาล็อก **64/65/30** ตรงตามฐาน · URL สื่อทั้งหมด **424 ลิงก์ไม่ซ้ำ ตอบ 200 ครบ ชนิดไฟล์ถูกต้อง** และเป็นโฮสต์ `knightbasins.com` เท่านั้น · cert ทั้ง 4 ชื่อ valid SAN ไม่มีชื่อเก่า · LINE 405/302 · โฮสต์ที่ถอดแล้วไม่มีตัวไหนตอบ 200
2. **ผิดปกติจริง 1 เรื่อง:** `/api/site-photos/showcase` ตอบ **502** ครั้งเดียวตอน 18:38 น. ตรงกับช่วง **deploy ของ #426 (PR เอกสารล้วน)** ที่ recreate web+api · ยิงซ้ำ 5/5 ได้ 200 · ต้นเหตุเชิงระบบ: ทุกการ merge เข้า `main` (แม้เอกสาร) สั่ง `--force-recreate api web` — วันนี้รัน deploy 22 ครั้ง
3. **ตรวจไม่ได้:** ข้อมูลใน DB 205 แถว · การทำงานจริงของ LINE webhook (ต้อง `POST`) · log ของ gateway/LINE · แชท KnightSupport
4. **ข้อเสนอ:** ใส่ `paths-ignore` (`qa/**`, `docs/**`, `*.md`, `KANBAN.md`) ใน `deploy.yml` หรือ deploy เฉพาะเมื่อไฟล์แอปเปลี่ยน · ยืนยันกับบอสว่าเบอร์ที่สอง `089-762-2209` บนหน้าแรกตั้งใจ
5. **ความเสี่ยงคงเหลือ:** หน้าต่าง 502 สั้น ๆ ทุกครั้งที่ deploy (ลูกค้าที่เปิดเว็บ/ส่งใบเสนอราคาพอดีจะเจอ) · `/kb/admin/` โชว์หน้า nginx 502 ดิบให้ทีมงานตราบที่ images-admin หยุด (ตั้งใจ แต่ไม่สวย)

## 2. สิ่งผิดปกติจริง: 502 ช่วง deploy

| หลักฐาน | ค่า |
|---|---|
| ผลยิงครั้งแรก 18:38 น. | `/api/site-photos/showcase` → **502** ขนาด 11 B ไม่มี content-type (เส้นอื่นใน API 4 เส้นก่อนหน้า 200) |
| `status` 18:39:55 น. | `knightbasins-web Up 6 seconds` · `knightbasins-api Up 12 seconds (healthy)` ⇒ ทั้งคู่เพิ่งถูกสร้างใหม่ |
| `gh run list` | Deploy ของ **#426** เริ่ม 18:37:44 น. เสร็จ 18:39:51 น. — ครอบช่วง 502 พอดี |
| ยิงซ้ำ 5 ครั้ง | 5/5 → **200** (2,080 B, 0.16–0.22 วินาที) · `apilog` แสดง 200 ทุกคำขอ |
| ยิง API ทั้ง 5 เส้นซ้ำหลังเสร็จ (18:40) | 200 ครบ |
| `deploy.yml` | `on: push: branches: [main]` ไม่มี `paths`/`paths-ignore` · บรรทัด 135 `docker compose … up -d --force-recreate api web` |
| จำนวน deploy วันนี้ | **22 ครั้ง** (ตั้งแต่ #404 ถึง #426) เกือบทั้งหมดเป็น PR เอกสาร |

**ข้อสรุป:** ไม่ใช่บั๊กของโค้ดหรือ config — เป็นผลของ recreate ระหว่าง deploy ระยะเวลา 502 ผมวัดไม่ได้ (ได้ตัวอย่างเดียว) สมมติฐานว่า api หยุดจนผ่าน healthcheck (`start_period 10s`, `interval 15s`) แล้ว web ถูกสร้างใหม่ตามหลัง ⇒ น่าจะอยู่ระดับสิบกว่าวินาทีต่อครั้ง **ผมไม่ได้ทดสอบซ้ำโดยตั้งใจให้เกิด** (ต้องรอ deploy ครั้งถัดไป)

## 3. A — หน้าเว็บ 16 URL (ผ่าน)

`curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}'`

| URL | HTTP | content-type | ขนาด |
|---|---|---|---|
| `/` | 200 | text/html | 155,826 B |
| `/portfolio` | 200 | text/html | 26,925 B |
| `/stone` | 200 | text/html | 85,912 B |
| `/price-guide` | 200 | text/html | 55,301 B |
| `/site-prep` | 200 | text/html | 36,388 B |
| `/studio-guide` | 200 | text/html | 54,768 B |
| `/quote` | 200 | text/html | 49,344 B |
| `/studio` | 200 | text/html | 107,526 B |
| `/sketch` | 200 | text/html | 52,360 B |
| `/readme` | 200 | text/html | 58,678 B |
| `/updates` | 200 | text/html | 51,612 B |
| `/network` | 200 | text/html | 34,397 B |
| `/sitemap.xml` | 200 | text/xml | 2,087 B |
| `/robots.txt` | 200 | text/plain | 3,206 B |
| `/llms.txt` | 200 | text/plain | 17,449 B |
| `/llms-full.txt` | 200 | text/plain | 45,780 B |

- `sitemap.xml` มี 12 URL ตรงกับ 12 หน้าที่ใบงานระบุ (ทุก `<loc>` เป็น `https://knightbasins.com/…`)
- สตริง `srv1964473` ในทั้ง 16 ไฟล์: **0**
- **เนื้อหาหน้าแรก:** `<title>Knight Furnich | อ่างล้างหน้า & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ</title>` · เบอร์หลัก `094-496-1949` ปรากฏ **3 จุด** · ปรากฏเบอร์ที่สอง `089-762-2209` ด้วย (ผมไม่รู้ว่าตั้งใจหรือไม่ — ขอบอสยืนยัน)
- **เนื้อหา `/stone`:** title `ท็อปครัว & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ | Knight Furnich` · ~1,826 คำ มีรหัสสินค้า (BW010, SG420) และ JSON-LD 4 ชุด ⇒ ไม่ใช่หน้าว่าง

## 4. B — API สาธารณะ

| Endpoint | HTTP | ขนาด | หมายเหตุ |
|---|---|---|---|
| `/api/healthz` | 200 | 239 B | `status ok` · LINE login `ready: true` · `callbackEnvironment: production` · `database.connected: true` |
| `/api/catalog` | 200 | 111,347 B | ดูด้านล่าง |
| `/api/portfolio` | 200 | 21,116 B | 7 รายการ · 0 จุด legacy |
| `/api/portfolio/featured` | 200 | 4,675 B | 2 รายการ |
| `/api/site-photos/showcase` | **502 ครั้งแรก → 200 (5/5 ซ้ำ)** | 2,080 B | ดูข้อ 2 |

**`/api/catalog` (วัดตรงจาก payload):**

| รายการ | ค่า | ฐาน |
|---|---|---|
| `sheetStones` | **64** | 64 ✅ |
| `installedStones` | **65** | 65 ✅ |
| `basins` | **30** | 30 ✅ |
| `categories` | 2 | — |
| URL รูป/วิดีโอทั้งหมด (นับตำแหน่ง) | **748** (ไม่ซ้ำ **424**) | — |
| โฮสต์ที่พบ | **`knightbasins.com` อย่างเดียว (748/748)** | ✅ |
| `srv1964473` / `hstgr.cloud` / `api.knightbasins.com` | **0 / 0 / 0** | ✅ |

ฟิลด์ที่มี URL: basins (imageUrl, gallery, quote, video, topView, uploadedVideo) · installedStones (imageUrl, gallery, quote, slab) · sheetStones (imageUrl, gallery, quote, slab)

## 5. C — ไฟล์สื่อ/ไฟล์แอป (ผ่าน)

**ยิง `HEAD` ครบทุกลิงก์ใน payload (424 ไม่ซ้ำ):**

| ชนิด | จำนวน | HTTP | content-type |
|---|---|---|---|
| jpg | 260 | 200 | `image/jpeg` |
| png | 104 | 200 | `image/png` |
| mp4 | 30 | 200 | `video/mp4` |
| webp | 30 | 200 | `image/webp` |
| **รวม** | **424** | **200 ทั้งหมด (ไม่พบ non-200 เลย)** | ตรงนามสกุลทุกกลุ่ม |

**ไฟล์ตัวอย่างตามที่ใบงานระบุ (GET):**

| URL | HTTP | content-type | ขนาด |
|---|---|---|---|
| `/kb/images/slab/QS288.png` | 200 | image/png | 198,839 B |
| `/kb/images/basin/KF023.jpg` | 200 | image/jpeg | 44,790 B |
| `/kb/images/swatch/SG420.png` | 200 | image/png | 169,504 B |
| `/kb/images/basin-hd/KF023.jpg` | 200 | image/jpeg | 44,790 B |
| `/kb/images/basin-videos/KF008.mp4` | 200 | video/mp4 | 767,389 B |
| `/assets/basins-transparent/KF023.webp` | 200 | image/webp | 63,336 B |
| `/assets/index-Ch5gquFv.js` | 200 | application/javascript | 1,794,132 B |
| `/assets/index-DK5ZqJ6H.css` | 200 | text/css | 385,899 B |

(ชื่อ bundle `index-Ch5gquFv.js` / `index-DK5ZqJ6H.css` ไม่เปลี่ยนจากรอบ 293 ⇒ ไม่มีการ build เว็บใหม่ระหว่างทาง) · หมายเหตุ: แคตตาล็อกใช้ `/kb/images/basin-hd/` (13 ไฟล์) ส่วน `/basin/` และ `/swatch/` ที่ใบงานยกตัวอย่างก็ยังตอบ 200

## 6. D — ใบรับรอง + DNS (ผ่าน)

`openssl s_client -connect 72.62.79.84:443 -servername <host>` + `Verification: OK` ทุกชื่อ

| ชื่อ | CN | SAN | ออก (ไทย) | หมดอายุ | ผู้ออก | ใบ default? |
|---|---|---|---|---|---|---|
| `knightbasins.com` | knightbasins.com | com + www | 9 ต.ค. 12:51 | **7 ม.ค. 70** | LE YR2 | ไม่ |
| `www.knightbasins.com` | (ใบเดียวกัน) | com + www | เหมือนกัน | 7 ม.ค. 70 | LE YR2 | ไม่ |
| `line.knightbasins.com` | line.knightbasins.com | line เดียว | 9 ต.ค. 12:51 | **7 ม.ค. 70** | LE YR2 | ไม่ |
| `api.knightbasins.com` | api.knightbasins.com | **api เดียว** (ไม่มีชื่อเก่าแล้ว) | 9 ต.ค. **17:08** | **7 ม.ค. 70** | LE YR1 | ไม่ |

- `srv1964473` ใน SAN: **0 ทั้ง 4 ใบ**
- **DNS** (resolver ของระบบ + `nslookup` ผ่าน 1.1.1.1 / 8.8.8.8): ทั้ง 4 ชื่อ → `72.62.79.84` ✅
- ข้อสังเกต (ไม่เป็นปัญหา): `*.srv1964473.hstgr.cloud` ทุกชื่อยัง resolve เป็น `72.62.79.84` (wildcard ของ Hostinger) และ SNI `api.srv1964473…` ยังได้ใบเก่าแยกที่มีอยู่เดิม (CN ชื่อเดิม, หมด 10 ธ.ค. 69) ค้างใน ACME store ⇒ เป็นเรื่องความสะอาด ไม่ใช่การให้บริการ (ยังได้ 404)

## 7. E — LINE (ผ่านเท่าที่ GET ได้)

| คำขอ | ผล | เกณฑ์ |
|---|---|---|
| `GET https://line.knightbasins.com/line/webhook` | **405** `text/plain` | 405 ✅ (มีเส้นทาง รับ POST เท่านั้น) |
| `GET https://knightbasins.com/api/auth/line/login` | **302** → `access.line.me/oauth2/v2.1/authorize?…redirect_uri=https%3A%2F%2Fknightbasins.com%2Fapi%2Fauth%2Fline%2Fcallback…` | 302 ✅ · `redirect_uri` เป็นโดเมนหลัก |

ตรวจไม่ได้: webhook รับ/ตอบ POST จริง · การส่งรูป/วิดีโอไปหาลูกค้า (ต้อง `POST`/ดู log gateway) — ทั้งสองอยู่นอกสิทธิ์ read-only ของผม (ข้อ D/G ของใบ 293 ยังอยู่สถานะเดิม: ต้องมีผลดิบจากเดวิด)

## 8. F — โฮสต์ที่ถอด/หยุดแล้ว (ผ่าน ไม่มีตัวไหนตอบ 200)

| URL (GET) | ผล | ถือว่า |
|---|---|---|
| `api.srv1964473…/health` | 404 `404 page not found` (Traefik) | ✅ |
| `knightbasins.srv1964473…/` | 404 | ✅ |
| `line.srv1964473…/line/webhook` | 404 | ✅ |
| `app.srv1964473…/` | 404 | ✅ |
| `n8n.srv1964473…/` | 404 | ✅ ตั้งใจ |
| `api.knightbasins.com/kb/admin/` | **502** (หน้า nginx `502 Bad Gateway`) | ✅ ตั้งใจ (images-admin หยุด) |
| `api.knightbasins.com/v1/models` | **401** `Invalid gateway API key` | ✅ |
| `www.knightbasins.com/` | **301** | ✅ |
| `api.knightbasins.com/health` | 200 `{"status":"ok","platform":"hermes-age…` | ✅ |

`status` ล่าสุด (18:42 น.): web/api/knight-api/db มี `Up` + `(healthy)` ตามที่ควร (`knight-api` ได้ `(healthy)` แล้วหลังเพิ่ม healthcheck) · **ไม่มี** `knight-images-admin` และ `n8n-n8n-1` ในรายการที่รัน ⇒ ตรงกับที่บอสหยุด · `traefik Up 35 minutes`, `hermes-agent Up 3 hours`, `line-proxy Up 6 hours`

## 9. เช็คลิสต์ท้ายใบ

| # | ผล |
|---|---|
| 1 12 หน้า + 4 ไฟล์ข้อความ | **ผ่าน** 16/16 = 200 |
| 2 เนื้อหาหน้าแรก | **ผ่าน** ชื่อร้าน + `094-496-1949` (3 จุด) · ⚠️ มีเบอร์ที่สองด้วย |
| 3 API 5 เส้น | **ผ่าน** (1 เส้น 502 ชั่วคราวช่วง deploy → 200) |
| 4 64/65/30 | **ผ่าน** |
| 5 โฮสต์ใน payload | **ผ่าน** `knightbasins.com` 748/748 · legacy 0 · `api.` 0 |
| 6 รูป/ไฟล์แอป | **ผ่าน** 424/424 + 8 ไฟล์ตัวอย่าง |
| 7 cert 4 ชื่อ | **ผ่าน** |
| 8 DNS 4 ชื่อ | **ผ่าน** → 72.62.79.84 |
| 9 LINE webhook GET | **ผ่าน** 405 |
| 10 LINE login | **ผ่าน** 302 |
| 11 โฮสต์ที่ถอดแล้ว | **ผ่าน** ไม่มีตัวไหน 200 |
| 12 ความเสี่ยง + ข้อเสนอ | มี (§1, §2) |

baseline ของเดวิด: 200 ×16 ✅ · 64/65/30 ✅ · โฮสต์เดียว ✅ · cert valid ✅ — ตรงทุกข้อ (ยกเว้นความผิดปกติ §2)

## 10. ข้อเสนอและสิ่งที่ต้องรอเจ้าของ

- **เดวิด:** แก้ `deploy.yml` ให้ไม่ deploy เมื่อเปลี่ยนเฉพาะ `qa/**` `docs/**` `*.md` `KANBAN.md` (ลดหน้าต่าง 502 และงานซ้ำ 22 ครั้ง/วัน) หรือเปลี่ยนเป็น recreate เฉพาะตัวที่ภาพเปลี่ยน · ตอบผลวัดช่วง 502 จริงจาก log ของ Traefik
- **บอส:** ยืนยันเบอร์ `089-762-2209` บนหน้าแรก · รับทราบว่า `/kb/admin/` แสดงหน้า 502 ดิบจนกว่าจะ start images-admin
- **ปิดช่องที่ผมตรวจไม่ได้:** ข้อมูล DB หลังย้าย 205 แถว (ให้ผลของ 299-Q) · POST webhook/สื่อ LINE (คำสั่งจากใบ 293 ข้อ D/G)

## 11. สิ่งที่ผมไม่ได้ทำ

ไม่ `POST` · ไม่แก้/restart/หยุดอะไร · ไม่ merge PR ของเดวิด · ไม่พิมพ์ค่าลับ (client id ใน URL ของ LINE ปิดค่าแล้ว)
