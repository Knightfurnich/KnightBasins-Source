# ใบงาน 269 (ภาคผนวก) — เชื่อม Google Search Console API สำเร็จ + ตัวชี้วัดชั้นธุรกิจตัวจริง

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** เดวิด (บอสเปิด API + เพิ่มผู้ใช้ SA ให้) · **ผู้ตรวจรับ:** เดวิด (งาน ops — ไม่มีผู้ตรวจที่สอง)
**ที่มา:** ข้อ 3 ของงาน crawler tracker — บอสยืนยันให้อ่านข้อมูลผ่าน GSC API (“บอสเลือกวิธีให้อ่าน ผ่าน GSC API บอสอนุมัติ”) · บอสเปิด API และเพิ่มผู้ใช้ SA ใน Search Console แล้ว 5 ต.ค. 69

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. ใช้ service account `knight-basins-app@knight-basins-voice.iam.gserviceaccount.com` อ่านข้อมูล Google Search Console (read-only)
  2. ดึงตัวชี้วัดชั้นธุรกิจจริง: จำนวนคลิก/การแสดงผลจาก Google · จำนวน URL ที่ถูก index จาก sitemap · สถานะ index รายหน้า
  3. เพิ่มตัวชี้วัดนี้เข้าในรายงานประจำวัน 09:00 ไทย โดยไม่ให้รายงานพังถ้าอ่าน GSC ไม่ได้ (ให้บอกตรงว่า “อ่านไม่สำเร็จ” ห้ามเดา)
  4. ไม่แก้ข้อมูลใด ๆ ใน GSC/เว็บ — อ่านอย่างเดียว

SCOPE:
  - /opt/data/bin/gsc_report.py            (สคริปต์อ่าน GSC + โหมด --summary สำหรับรายงาน)
  - /opt/data/bin/gsc_probe.py             (ทดสอบสิทธิ์)
  - /opt/data/bin/gsc_deep_check.py         (ตรวจ sitemaps + ช่วงเวลายาว + URL Inspection)
  - /opt/data/bin/knight_crawler_report.sh  (เพิ่มส่วน GSC ในรายงาน)

FORBIDDEN:
  - ห้ามเขียน/แก้ข้อมูลใน Search Console (ใช้ scope `webmasters.readonly` เท่านั้น) · ห้ามส่ง sitemap ใหม่/กด Request indexing แทนบอส
  - ห้ามพิมพ์ค่าคีย์/ไฟล์ `.gsc-sa.json`/โทเคนลงรายงานหรือแชท (โทเคนถูกสร้างในหน่วยความจำและไม่ถูกบันทึก)
  - ห้ามแตะ production/ฐานข้อมูล/คอนเทนเนอร์ในใบนี้ (เป็นงานอ่านข้อมูลเท่านั้น)
  - ห้ามรายงานตัวเลขที่ไม่ได้มาจาก API/log จริง — ถ้าอ่านไม่ได้ให้บอกตรง

EVIDENCE:
  1) `uv run --with google-auth --with requests --quiet python bin/gsc_probe.py`
     - ก่อนบอสเพิ่มผู้ใช้: API เปิดแล้ว → `sites.list` = HTTP 200 และ **properties = 0**
     - หลังบอสเพิ่มผู้ใช้: `gsc_report.py` เห็น property `https://knightbasins.srv1964473.hstgr.cloud/` ✅
  2) `python bin/gsc_report.py --summary --days 7` (ผลจริง 5 ต.ค. 69):
     - คลิกจาก Google **0** · การแสดงผล **0** · อันดับเฉลี่ย 0.0 (ช่วง 2026-09-26 → 2026-10-03)
     - sitemap: ส่ง 8 URL · **ถูก index 0 URL**
     - สถานะ index ตัวอย่าง 4 หน้า (`/`, `/stone`, `/quote`, `/portfolio`): **Google รู้จัก 0/4 หน้า**
  3) `python bin/gsc_deep_check.py`:
     - sitemap.xml ส่ง 2026-09-25 · ดาวน์โหลดล่าสุด 2026-09-25 · `web: 8 submitted / 0 indexed`
     - ช่วง 90 วัน: คลิก 0 · การแสดงผล 0 (มีแถวข้อมูลรายวันแต่เป็นศูนย์ทั้งหมด)
     - URL Inspection: ทุกหน้า = `coverageState: "URL is unknown to Google"` · `lastCrawlTime: None` · `verdict: NEUTRAL`
  4) ตรวจฝั่งเว็บว่าไม่มีอะไรบล็อกการเก็บ (คำสั่ง: `curl -s <site>/robots.txt`, `curl -s <site>/sitemap.xml`, `curl -s <site>/ | grep -i canonical`):
     - `robots.txt`: `User-agent: *` → `Allow: /` · `Disallow: /admin` · ต้อนรับ GPTBot/AI crawlers ชัดเจน
     - `sitemap.xml` = **10 URL** (GSC ยังนับ 8 = สแนปช็อตล่าช้า)
     - หน้าแรก: `<meta name="robots" content="index, follow, …">` + canonical ถูกต้อง
  5) **สัญญาณคืบหน้า (จาก log จริงหลังเปิด Traefik log):** Googlebot เข้าเก็บ **3 หน้า** = `/` · `/quote` · `/portfolio` (หน้า `/portfolio` เก็บได้หลังเปิด log ถาวร ⇒ ตัวเก็บใหม่ทำงานจริง)
  6) `bash bin/knight_crawler_report.sh` → รายงานรันครบทั้งสองส่วน (บอท + GSC) โดยไม่พัง
  7) บันทึกหลักฐานเข้า repo: `git add qa/job-269-addendum-gsc-api-connected.md KANBAN.md && git commit -m '...'` แล้วเปิด PR เข้า main
  8) **baseline:** ก่อนเชื่อม GSC = ไม่มีตัวเลขชั้นธุรกิจเลย · หลังเชื่อม = คลิก 0 / แสดงผล 0 / index 0/8 (ตัวเลขจริง ไม่ใช่การประมาณ)

OUTPUT:
  - รายงานประจำวัน 09:00 ไทย มีทั้งสถิติบอท (จาก log ถาวร) และตัวชี้วัดธุรกิจ (GSC: คลิก/แสดงผล/index)
  - ข้อมูลจริงสำหรับตัดสินใจว่าควรเดินหน้า SEO/GEO ต่อหรือแก้ที่ต้นเหตุ (index)

STOP:
  - เมื่อดึงข้อมูล GSC ได้จริง · รายงานรวมสองส่วนทำงาน · ตัวเลขถูกบันทึกเป็นหลักฐาน
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | อ่าน GSC + ตัวชี้วัดธุรกิจ + ใส่รายงาน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์สคริปต์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | read-only · ห้ามพิมพ์คีย์ · ห้ามเดาตัวเลข |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ผล API จริง + คำสั่ง curl + baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | รายงานมีสองส่วน |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/bin/... |
| 8 | ระบุคำสั่งบอส | ผ่าน | “ผ่าน GSC API บอสอนุมัติ” |
| 9 | ระบุขั้นที่บอสทำ vs เดวิดทำ | ผ่าน | บอสเปิด API + เพิ่มผู้ใช้ · เดวิดดึง/รายงาน |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → บอส] |
| 11 | ระบุความโปร่งใส | ผ่าน | อ่านอย่างเดียว · ไม่มีผู้ตรวจที่สอง |
| 12 | ระบุวันเวลาไทย | ผ่าน | 5 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → บอส] ข้อ 3 (GSC API) เชื่อมสำเร็จแล้วครับ — ตัวเลขชั้นธุรกิจออกจริงแล้ว
อ่านได้: property https://knightbasins.srv1964473.hstgr.cloud/
ตัวเลขจริง (7 วัน · 2026-09-26 → 10-03): คลิกจาก Google 0 · การแสดงผล 0
sitemap: ส่ง 8 URL → ถูก index 0 URL · ตรวจ 4 หน้า (/ , /stone, /quote, /portfolio) = Google ยังไม่รู้จักทั้ง 4 หน้า ("URL is unknown to Google")
สัญญาณคืบหน้า: Googlebot เข้าเก็บ 3 หน้าแล้ว (/ · /quote · /portfolio) — หน้า /portfolio เก็บได้หลังเปิด log ถาวร
ตรวจฝั่งเว็บไม่พบตัวบล็อก: robots.txt Allow / + ต้อนรับ AI crawlers · sitemap.xml 10 URL · meta robots = index,follow · canonical ถูกต้อง
สรุป: บอทเข้ามาแล้ว แต่ยังไม่ถูก index ⇒ ยังไม่มีคนเห็น/คลิกจาก Google (ยังไม่ใช่ผลลัพธ์ทางธุรกิจ)
รายงาน 09:00 ไทย จะมีตัวเลขนี้ทุกวัน (index/แสดงผล/คลิก + สถิติบอท จาก log ถาวรที่ไม่หายเมื่อ deploy)
next: ถ้าบอสต้องการ ผมเสนอ (1) กด Request indexing ใน GSC สำหรับหน้าสำคัญ (2) พิจารณาโดเมนของตัวเองแทน *.hstgr.cloud เพื่อ SEO ระยะยาว
```


---

## ภาคผนวก ข — ลบ sitemap ที่ไม่ถูกต้องออกจาก GSC (บอสอนุมัติ 5 ต.ค. 69: “ลบเลย”)

**ผู้ทำ:** เดวิด (บอสสั่งให้ลบ) · **วิธี:** Search Console API (`DELETE /webmasters/v3/sites/{site}/sitemaps/{feedpath}`) ด้วยสิทธิ์เขียนของ service account (SA เป็น **Full user** ใน property นี้)

**ก่อนลบ (11 รายการ):** `/sitemap.xml` (type=sitemap · errors=0 · ส่ง 8 · index 0) · `/sitemap_index.xml` (errors=0) · และ **9 รายการที่ไม่ใช่ sitemap จริง** (`/updates` `/readme` `/studio-guide` `/site-prep` `/sketch` `/studio` `/quote` `/stone` `/portfolio` — errors=1 ทุกรายการ)

**หลังลบ (2 รายการ — ยืนยันด้วยการดึงรายการใหม่):**
```
/sitemap.xml        | type=sitemap | errors=0 | ส่ง 8 · index 0
/sitemap_index.xml  | type=          | errors=0 | ส่ง 0 · index 0
```

**คำสั่งที่ใช้:** `uv run --with google-auth --with requests --quiet python bin/gsc_sitemap_fix.py --list` → ตรวจรายการ · `--clean` → ลบ (ผล: `DELETE … → HTTP 204` ทั้ง 9 รายการ) · แล้ว `--list` ซ้ำเพื่อยืนยัน
**ข้อยกเว้นที่บันทึกไว้:** ใบนี้เดิมกำหนดให้ GSC เป็น read-only — ครั้งนี้ **บอสสั่งให้ลบโดยตรง** จึงใช้สิทธิ์เขียนเฉพาะการลบ sitemap ที่ผิดรูปแบบเท่านั้น (ไม่แตะข้อมูลอื่น/ไม่ส่ง sitemap ใหม่/ไม่กด request indexing แทนบอส)
**หมายเหตุ:** sitemap ที่ผิดเหล่านี้ไม่กระทบการจัดอันดับ/index — ลบเพื่อให้หน้าจอสะอาด · เพิ่มกลับได้ตลอด
