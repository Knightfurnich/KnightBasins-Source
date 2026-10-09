# เดวิดตรวจรับใบ 401-R — ทบทวนรายงานรอบ 4 ของรีพิต ด้วยการวัดจริงบน production

**เมื่อ:** 2026-10-09 ~21:55–22:05 เวลาไทย · **ผู้ตรวจ:** เดวิด (Tech Lead)
**รายงานต้นทาง:** `qa/report-replit-round4-app-20261009.md` (PR #440 merged) · **ใบงาน:** `qa/job-401-replit-round4-app-20261009.md` (10/10)

> เป้าหมาย: แยกว่า **ข้อไหนเป็นของจริงบน production** และ **ข้อไหนเป็นผลจากเอกสาร/สภาพแวดล้อมฝั่ง dev ของรีพิต**
> ทุกบรรทัดในเอกสารนี้มาจากผลรันจริงที่แนบ (ไม่ใช่คำรับรอง)

---

## 0 · สรุป 6 บรรทัด

| ข้อของรีพิต | ตัดสิน | หลักฐานของเดวิด |
|---|---|---|
| A. โฮสต์ storefront ในเอกสารเสิร์ฟไม่ได้ (TLS ไม่ตรงชื่อ + 404 ทุกเส้น) | ✅ **จริง — ต้นเหตุคือเอกสารเรา** | `deploy/hostinger/README.md` ยังใช้โฮสต์เก่า → แก้แล้ว **PR #441** (README · docker-compose · สคริปต์ · DR docs + ตาราง public hostnames) |
| B. รูป 10/10 = 404 + ใช้โฮสต์ `srv1964473` | ⚪ **ไม่ใช่ของ production** (artifact ของ dev) | สุ่ม 10 รูปจาก `GET /api/catalog` ของ production → **200 ทั้ง 10 ใบ** · 0 ใบมี `srv1964473` |
| C. `/price-guide` ไม่มี route ในเครื่องรีพิต + production 404 | ⚪ **ไม่จริงบน production** | `https://knightbasins.com/price-guide` = **200** · มีตาราง/เนื้อหาจริง (ดูภาพหน้าจอที่แนบในตรีเอจ) |
| D. console/broken images บน `/` และ `/stone` (17–36 ครั้ง) | ⚪ **ไม่ใช่ของ production** | เกิดจาก URL รูปโฮสต์เก่าใน **DB เครื่อง dev ของรีพิต** ⇒ cert ไม่ผ่าน · production ยิงรูปผ่าน 10/10 |
| E. desktop horizontal overflow ที่ `/` `/stone` `/quote` | 🟠 **จริง แต่ระดับต่ำ** (ยืนยันแล้ว) | วัดเอง: `scrollWidth − clientWidth` = **216 px @1440** · **60–88 px @390 (มือถือเลื่อนข้างได้จริง)** · ต้นเหตุ = `::before` ของ hero |
| F. `/price-guide` เป็นหน้าเดียวที่ไม่ล้น | ✅ ตรงกัน | `/price-guide` = 1425/1425 = 0 ล้น |

**ผลรวม:** ตัวบล็อกจริงของใบนี้คือเอกสารเรา (แก้แล้ว) · ที่เหลือ = ของจริงข้อเดียว (E) ระดับต่ำ ยังไม่มีใบสั่งแก้

---

## 1 · หลักฐานชุด A — production ใช้งานได้ครบ (ยิงสด 2026-10-09 21:5x ไทย)

```
$ for p in / /portfolio /stone /quote /studio /sketch /site-prep /studio-guide /readme \
      /updates /track /handover /price-guide /network /admin; do curl -s -o /dev/null -w '%{http_code}' https://knightbasins.com$p; done
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200      # 15/15
```
- 12 หน้า sitemap + `/network` (ญาติใหม่) + `/price-guide` + `/admin` = **200 ทุกเส้น**
- รีพิตยิงโฮสต์เก่า (`knightbasins.srv1964473…`) → 404 · **ตรงตามที่ระบบตั้งใจ** (ถอด 9 ต.ค. 69)

## 2 · หลักฐานชุด B — payload + รูป

```
$ curl -s https://knightbasins.com/api/catalog | ...
  'srv1964473'      → 0 จุด
  'knightbasins.com'→ 748 จุด
  keys: basins · categories · installedStones · sheetStones

$ สุ่ม 10 รูปจากฟิลด์ image* ของ payload (seed 7) → HEAD/GET
  .../api/uploads/catalog-mur8cuc1-…jpg  → 200 image/jpeg  81,187 B
  .../api/uploads/catalog-mua0v6co-…jpg  → 200 image/jpeg 924,615 B
  .../kb/images/slab/SS440.png           → 200 image/png  2,208,040 B
  .../assets/basins-transparent/KF027.webp → 200 image/webp 20,982 B
  (10/10 = 200 · legacy host ในตัวอย่าง = 0)
```

## 3 · หลักฐานชุด E — horizontal overflow (วัดด้วยเบราว์เซอร์จริง)

```
@1440x900   /          cw 1425 · scrollWidth 1641  → ล้น 216 px
@1440x900   /stone     cw 1425 · scrollWidth 1641  → ล้น 216 px
@1440x900   /quote     cw 1425 · scrollWidth 1641  → ล้น 216 px
@1440x900   /price-guide cw 1425 · scrollWidth 1425 → 0        ← สะอาด
@390x844    /          cw 390  · innerWidth 449    → 59 px (มีสกรอลบาร์นอนจริง)
@390x844    /stone     cw 390  · innerWidth 478    → 88 px
@390x844    /quote     cw 390  · innerWidth 449    → 59 px
```

**ต้นเหตุ (ยืนยันด้วยการซ่อนทีละส่วน — hiding ตัดค่าล้นทันที):**

| หน้า | องค์ประกอบ | สไตล์ที่ทำให้ล้น |
|---|---|---|
| `/` | `SECTION.catalog-hero::before` | `position:absolute` · `width:1649px` · `left:-256px` · `right:-256px` |
| `/stone` | `SECTION.stone-hero::before` | เหมือนกัน (1649 px · −256 px ทั้งสองข้าง) |
| `/quote` | `SECTION.quote-heading::before` | เหมือนกัน |

- ซ่อน `.stone-hero` → `scrollWidth` ลดจาก **1457 → 1265** (สะอาด) = ตัวการเดียว
- เป็น **แถบตกแต่ง** (pseudo-element) ที่กวาดออกนอกกล่อง ±256 px และไม่มี `overflow: clip`
- ผลกับผู้ใช้: เดสก์ท็อปไม่เห็นสกรอลบาร์นอน (1280 − clientWidth = 15 px = สกรอลบาร์ตั้งเท่านั้น) · **มือถือเลื่อนข้างได้จริง 59–88 px** ⇒ ระดับความรุนแรง **ต่ำ** (ไม่ตัดเนื้อหา ไม่กระทบราคา/ฟอร์ม)

---

## 4 · ข้อที่รีพิตไม่ได้ทำ (เข้าใจได้ — อยู่นอกใบ)

- ไม่ได้ยิง POST production (ถูกต้อง ตาม FORBIDDEN ของใบ)
- ไม่ได้ตรวจ `/api/*` และกลไกฟีด (เป็นขอบเขต 402-C/403-Q)
- ตรวจ production GET ไม่สำเร็จเพราะโฮสต์ในเอกสาร ⇒ **ใบนี้จึงยังไม่เคย "ยืนยัน production" จริง** → ช่องนี้ถูกปิดโดยหลักฐานชุด A/B ข้างบนแล้ว

## 5 · งานต่อจากใบนี้

1. 🟠 **overflow (E)** — ยังไม่มีใบสั่งแก้ · ทางแก้สั้น: ใส่ `overflow: clip` ที่ hero 3 ตัว หรือตัด `left/right:-256px` แล้วใช้ `width:100%` + `background-clip: padding-box` · **รอคำบอสว่าจะออกใบให้รีพิตไหม (ใบเดียวรวม 3 หน้า)**
2. ⏳ รอ **ชัย** 2 ใบ: `404-C` (โฮสต์เก่าในโค้ดแอป 2 จุด) · `405-C` (เปิดค่าคงที่การค้าใน `/api/catalog`) — เดวิดจะตามงานซิงก์ KB หลัง 405-C เข้า
3. ✅ เอกสารสาเหตุที่บล็อกรีพิต = ปิดแล้ว (PR #441) — ผู้ตรวจคนถัดไปไม่ควรเจอซ้ำ

**ตรวจซ้ำสุขภาพรวม:** `HERMES_HOME=/opt/data /opt/hermes/.venv/bin/python3 bin/verify_deploy.py` → **25/25 passed** (2026-10-09 21:5x ไทย)
