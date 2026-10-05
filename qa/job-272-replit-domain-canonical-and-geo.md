# ใบงาน 272-R (รีพิต) — ย้ายโดเมนหลักเป็น `knightbasins.com` + ยกระดับ GEO/SEO

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/replit-domain-canonical-and-geo`
**ที่มา (บอสสั่ง 5 ต.ค. 69):** “เดินหน้าต่อ 3 ข้อ บอสอนุมัติ” — เป้าหมายคือ **SEO / GEO**
**เริ่มได้เมื่อ:** (1) ใบ 270-fix merge + deploy เขียว (2) ใบ 271 merge — เพราะ 271 กับ 272 แก้ `public/sitemap.xml` ไฟล์เดียวกัน (ห้ามแก้ทับกัน)

**สภาพที่พร้อมแล้ว (เดวิดตรวจเอง 5 ต.ค. 69):**
```
https://knightbasins.com/            → 200 · title = "Knight Furnich | อ่างล้างหน้า & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ"
https://www.knightbasins.com/        → 200
ใบรับรอง HTTPS (Let's Encrypt) SAN = knightbasins.com · www.knightbasins.com · knightbasins.srv1964473.hstgr.cloud
  อายุ 5 ต.ค. 2569 → 3 ม.ค. 2570 · Traefik rule + nginx server_name มีโดเมนใหม่ครบ 3 โฮสต์แล้ว · host เดิมยัง 200
```
**ปัญหาที่ยังเหลือ (ตรวจจากของจริง 5 ต.ค. 69):**
```
public/sitemap.xml  → <loc> ยังเป็น https://knightbasins.srv1964473.hstgr.cloud ทุกบรรทัด
public/robots.txt   → ไม่มีบรรทัด "Sitemap:" เลย (มีแค่ Allow/Disallow)
GSC (property เดิม)  → ส่ง 10 URL · index 0 · คลิก/impression = 0 (7 วัน)
JSON-LD (ของจริง)    → sameAs มีแค่ knightfurnich.com + LINE · ขาด FB/IG/TikTok/YouTube และเว็บในเครือ
                     → ยังไม่มี openingHoursSpecification · geo · hasMap · logo/image
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. ทำให้ **โดเมนเดียวคือ `https://knightbasins.com`** เป็นแหล่งอ้างอิงของทุกอย่างที่ crawler อ่าน:
     canonical · sitemap · robots · llms.txt/llms-full.txt · JSON-LD · og:url
     (ปัจจุบันทุกไฟล์ชี้ host เก่า `knightbasins.srv1964473.hstgr.cloud` ซึ่งจะกลายเป็นโดเมนที่ถูก 301)
  2. ตั้ง **301 redirect** จาก host เก่า → `https://knightbasins.com` (ทุกพาธ) โดย **504 ห้ามเกิด** และ **ห้ามวนลูป**
     — host ใหม่ต้องไม่ 301 ตัวเอง · `/api/*` · `/kb/*` · `/assets/*` ต้องไม่ถูก 301
  3. เพิ่ม **`Sitemap: https://knightbasins.com/sitemap.xml`** ใน `robots.txt` (ปัจจุบันไม่มีบรรทัดนี้)
  4. **IndexNow:** สร้างไฟล์ key ที่ `public/<key>.txt` (hex 32 ตัว) แล้วบอกเดวิดเพื่อยิง `api.indexnow.org` เอง (Bing/Yandex)
  5. **ยกระดับ GEO** ใน JSON-LD: `sameAs` ครบ (Facebook/Instagram/TikTok/YouTube @knightfurnich + 2 เว็บในเครือ) ·
     `openingHoursSpecification` · `geo` (พิกัด) · `hasMap` · `image`/`logo` · **BreadcrumbList ต่อหน้า** ·
     Service/Product schema สำหรับ `/stone` และ `/quote` (**ห้ามใส่ราคาที่ไม่มาจาก KB/DB**)
     ⚠️ NAP: **ยังห้ามเดา** — รอเดวิดยืนยันโชว์รูม `35/633` vs โรงงาน `35/170, 35/267` ก่อนแก้ที่อยู่
  6. **กันหลุดในอนาคต:** เทสต์ที่ยืนยันว่า (ก) ไม่มี host เก่าหลงเหลือในไฟล์สาธารณะยกเว้นบล็อก 301
     (ข) canonical/sitemap/llms ใช้โดเมนใหม่ (ค) sitemap มีครบ 11 URL (หลังใบ 271) (ง) robots มีบรรทัด Sitemap:
  7. prerender (ใบ 270) ต้องครอบหน้าใหม่ `/network` ของใบ 271 โดยอัตโนมัติ (อ่านจาก `public/sitemap.xml`)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/sitemap.xml          (เปลี่ยน host ทุก <loc>)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/sitemap_index.xml    (ชี้ sitemap ใต้โดเมนใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/robots.txt           (เพิ่มบรรทัด Sitemap:)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt             (URL ภายใน → โดเมนใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt        (URL ภายใน → โดเมนใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html                  (canonical · og:url · JSON-LD url/@id)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts (URL + เติม sameAs/openingHours/geo/hasMap/logo)
  - /opt/data/cache/kbsrc/deploy/hostinger/nginx.conf                         (บล็อก 301 จาก host เก่า — เดวิดเอาไป apply บน VPS เอง)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/domain-canonical.test.ts (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/<key>.txt            (ใหม่)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · ห้ามแตะ `artifacts/api-server/**`
  - ห้ามแตะ `src/data/stone-catalog*`, `pricing.json`, ราคา/แคตตาล็อกใด ๆ และ **ห้ามเดา NAP/ราคา** — รอเดวิดยืนยัน
  - **ห้ามลบ host เดิม** จาก Traefik/nginx (กันเว็บล่ม) — ให้ตั้ง **301** อย่างเดียว และห้ามตั้ง 301 บน `/api/*` `/kb/*` `/assets/*`
  - ห้าม push ตรงเข้า `main` · ห้าม deploy เอง · ห้ามแก้ `deploy/hostinger/nginx.conf` แล้วคิดว่าขึ้นเอง (ไฟล์นี้ไม่ถูก deploy อัตโนมัติ)

EVIDENCE:
  1) `cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit` → 0 errors · `pnpm run build` → ผ่าน + prerender ครบ 11 หน้า
  2) `grep -rn "srv1964473" artifacts/knight-basins/public artifacts/knight-basins/index.html artifacts/knight-basins/src deploy/hostinger/nginx.conf`
     → **เหลือเฉพาะบรรทัด 301** (และต้องแนบผลจริง ไม่ใช่คำรับรอง)
  3) `curl -s https://knightbasins.srv1964473.hstgr.cloud/stone -o /dev/null -w "%{http_code} %{redirect_url}"` → **301 → https://knightbasins.com/stone**
  4) `node --experimental-strip-types --test test/domain-canonical.test.ts` → ผ่าน · **พิสูจน์ว่าจับได้:** ใส่ host เก่ากลับ 1 จุด → เทสต์ต้องตก
  5) เทสต์ชุด knight-basins แบบ CI: `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ตก 0**
     (baseline ที่เดวิดวัดบน main 5 ต.ค. 69: **1112 tests / 1103 pass / 0 fail / 9 skip** · ตัวเลขอ้างอิงชุด studio+sketch 515/513/0/2 · sitemap=10 URL ก่อนใบ 271)
  6) `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0** · `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE
  7) หลัง deploy (เดวิดทำ): ยิง `curl -A Googlebot` และ `curl -A GPTBot` ทุก URL → เนื้อหาใน body > 0 คำ · canonical = โดเมนใหม่ ·
     `curl -sI https://knightbasins.srv1964473.hstgr.cloud/` → 301 · robots มีบรรทัด Sitemap: · sitemap 11 URL โดเมนใหม่
  8) แนบผลรันจริงเป็นตัวเลขทั้งหมด (ห้ามคำรับรองลอย ๆ)

OUTPUT:
  - โดเมน `https://knightbasins.com` เป็น canonical เดียวทั้งระบบ · 301 จาก host เก่าทำงาน · robots/sitemap/llms/JSON-LD ตรงโดเมนใหม่ ·
    JSON-LD ครบสำหรับ GEO · IndexNow key อยู่ที่ root
  - PR เดียว แจ้งเดวิด (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ) → เดวิด deploy + apply nginx บน VPS + ยิงยืนยัน + รายงานบอส

STOP:
  - เมื่อ tsc 0 · build ผ่าน 11 หน้า · เทสต์ใหม่ผ่าน + พิสูจน์จับได้ · ชุด CI ตก 0 · index.css 0 diff · grep ไม่เหลือ host เก่า (ยกเว้น 301) · เปิด PR แจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (ห้ามทำต่อจนผลลัพธ์หาย)
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | SCOPE | แก้เฉพาะ 10 ไฟล์ใน SCOPE (9 เดิม + 1 ไฟล์ IndexNow ใหม่) |
| 2 | canonical | `index.html` canonical + og:url = `https://knightbasins.com/…` |
| 3 | sitemap | `sitemap.xml` 11 URL โดเมนใหม่ · `sitemap_index.xml` ชี้ถูก |
| 4 | robots | มี `Sitemap: https://knightbasins.com/sitemap.xml` · คง Allow AI crawlers เดิม |
| 5 | llms | `llms.txt` + `llms-full.txt` ไม่มี host เก่า |
| 6 | JSON-LD URL | WebSite / SiteNavigationElement / HomeAndConstructionBusiness = โดเมนใหม่ |
| 7 | GEO ข้อมูล | sameAs ครบ · openingHoursSpecification · geo · hasMap · logo/image |
| 8 | NAP | ไม่แก้ที่อยู่เอง (รอเดวิดยืนยัน) — ถ้ายังไม่ยืนยันให้คงเดิมและระบุใน PR |
| 9 | 301 | `nginx.conf` มี 301 จาก host เก่า · ไม่ 301 `/api` `/kb` `/assets` · ไม่วนลูป |
| 10 | เทสต์ | `domain-canonical.test.ts` ผ่าน + พิสูจน์ว่าจับบั๊กได้ (ใส่ host เก่ากลับ → ตก) |
| 11 | index.css | `git diff origin/main...HEAD -- src/index.css | wc -l` = 0 |
| 12 | รายงาน | แนบตัวเลขจริงทั้งหมด (เทสต์/tsc/grep/curl) ไม่มีคำรับรองลอย ๆ |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → รีพีต] ใบ 272 — ย้ายโดเมนหลักเป็น knightbasins.com + ยกระดับ GEO/SEO
เริ่มได้เมื่อ: (1) ใบ 270-fix merge + deploy เขียว (2) ใบ 271 merge — เพราะ 271 กับ 272 แก้ public/sitemap.xml ไฟล์เดียวกัน ห้ามแก้ทับกัน
สภาพพร้อมแล้ว: https://knightbasins.com + www = 200 · cert Let's Encrypt ครอบ 3 โฮสต์ (ถึง 3 ม.ค. 2570) · host เดิมยัง 200
สิ่งที่ต้องแก้: sitemap.xml · sitemap_index.xml · robots.txt (เพิ่มบรรทัด Sitemap: — ตอนนี้ยังไม่มี!) · llms.txt · llms-full.txt · index.html · src/data/structured-data.ts · deploy/hostinger/nginx.conf (301) + เทสต์ใหม่
ไฟล์ใหม่: IndexNow key ที่ public/<key>.txt (แจ้งเดวิดเพื่อยิง API)
GEO: sameAs ให้ครบ (FB/IG/TikTok/YouTube + 2 เว็บในเครือ) · openingHoursSpecification · geo · hasMap · logo/image · BreadcrumbList · Service/Product schema (ห้ามใส่ราคาที่ไม่มาจาก KB/DB) · ยืนยันว่า prerender ครอบหน้า /network
ข้อห้าม: ห้ามแตะ index.css / api-server · ห้ามลบ host เดิม (ตั้ง 301 เท่านั้น) · ห้ามเดา NAP/ราคา · ห้าม push main
หลักฐานใน PR: grep ไม่เหลือ host เก่า (ยกเว้นบล็อก 301) · sitemap 11 URL โดเมนใหม่ · robots มี Sitemap: · เทสต์พิสูจน์จับบั๊กได้ · index.css 0 diff · tsc + ชุดเทสต์ตก 0
รายละเอียดเต็ม: qa/job-272-replit-domain-canonical-and-geo.md
```
