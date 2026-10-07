# ใบงาน 290-C (ชัย) — รูปสินค้า/อ่างต้องเลิกชี้โฮสต์เก่า (`*.srv1964473.hstgr.cloud`) → ออกเป็นโดเมนเดียว `knightbasins.com`

**วันที่:** 8 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด
**ที่มา:** เดวิดตรวจพบเองหลัง merge ชุด SEO ของ Qwen · **บอสอนุมัติ 8 ต.ค. 69** ให้ทำแบบ "แปลงที่โค้ดตอนเสิร์ฟ ไม่แตะข้อมูล prod" (ทางเลือก ข)
**ผลตรวจจริงของเดวิดบน production (8 ต.ค. 69 หลัง deploy #936):**
```
GET /api/catalog  → URL รูป/วิดีโอ ที่ยังชี้โฮสต์เก่า = 748 จุด (545 × knightbasins.srv1964473.hstgr.cloud · 203 × api.srv1964473.hstgr.cloud)
                    ทุกใบยังตอบ 200 (cert เดิมครอบถึง 3 ม.ค. 2570) — ยังไม่พัง แต่ผิดหลัก "โดเมนเดียว" ของใบ 272
                    และทำให้ AI/โซเชียล/og เห็นรูปจากโดเมนเดิม
ต้นเหตุในโค้ด (เดวิดอ่านแล้ว):
  ① lib/catalog-media.ts:1   CENTRAL_MEDIA_ORIGIN = "https://api.srv1964473.hstgr.cloud/kb/images"  (ใช้ทำ basinImageUrl/basinVideoUrl/slabImageUrl เป็นค่าตั้งต้น)
  ② lib/stone-matcher.ts:29  SLAB_IMAGE_ORIGIN   = "https://api.srv1964473.hstgr.cloud"
  ③ แถวใน DB (image_url / quote_image_url / slab_image_url / video_url / gallery_image_urls) เก็บ URL เต็มที่ฝังโฮสต์เก่าไว้
เป้าหมายของใบนี้ = ให้ "ขาออก" ของ API เป็นโดเมนใหม่เสมอ โดยไม่แก้แถวในฐานข้อมูลเลย
ยืนยันแล้วว่าแพลตฟอร์มรองรับปลายทางใหม่: https://knightbasins.com/kb/images/slab/BW010.png = 200 · .../basin-hd/KF002.jpg = 200 · .../basin-videos/KF024.mp4 = 200 · .../api/uploads/... = 200
```
**Branch:** `infra/chai-canonical-media-urls`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 8 ต.ค. 69 · เดวิด

GOAL:
  A. **ตัวช่วยกลาง 1 ตัว** — สร้าง `lib/canonical-media-url.ts` (หรือใส่ใน `lib/catalog-media.ts` ถ้าสั้นกว่า) ฟังก์ชัน `canonicalMediaUrl(url)`
     กติกา (ห้ามเดา ห้ามกว้างเกิน):
       1. ค่าว่าง / `null` / `undefined` → คืนค่าเดิม
       2. path สัมพัทธ์ (เช่น `/api/uploads/...`, `/kb/images/...`) → คืนค่าเดิม **ห้ามเติมโดเมน**
       3. URL เต็มที่โฮสต์ลงท้าย `.srv1964473.hstgr.cloud` (ทั้ง `knightbasins.` และ `api.`) → เปลี่ยนเป็น
          `https://knightbasins.com` + **path เดิม + query เดิม** (ต้องคง `?v=…` และ hash ถ้ามี)
       4. โฮสต์อื่นทั้งหมด (ภายนอกจริง) → คืนค่าเดิม **ห้ามแก้**
  B. **ใช้ตัวช่วยนี้ที่จุดส่งออกทั้งหมด** (ไม่ใช่แก้ที่ข้อมูล):
       • `lib/catalog-media.ts` — `withBasinMedia` / `withStoneMedia` (ครอบทุกฟิลด์รูป/วิดีโอ + `galleryImageUrls[]`) และเลิกฝัง `CENTRAL_MEDIA_ORIGIN` ที่เป็นโฮสต์เก่า (ให้ประกอบจากค่าคงที่ตัวเดียวที่ชี้โดเมนใหม่)
       • `lib/stone-matcher.ts` — `SLAB_IMAGE_ORIGIN` (โค้ดพัก แต่ห้ามเหลือสตริงโฮสต์เก่า)
       • `routes/catalog.ts` — `/site-photos/showcase` (mapper ที่คืน `imageUrl`)
       • `routes/leads.ts` — 2 mapper ที่คืน `imageUrl` ของ site photos (บรรทัด ~842 / ~869)
     เป้าหมาย: **`git grep srv1964473 artifacts/api-server/src` เหลือเฉพาะ 2 จุดที่เป็นเรื่องอื่นโดยเจตนา** (`lib/line-config.ts` = โฮสต์ของ LINE integration · `admin-router.ts` ข้อความ log) — **ห้ามแตะ 2 จุดนั้นในใบนี้**
  C. **เทสต์ใหม่ ≥6 เคส** (`test/canonical-media-url.test.ts`): โฮสต์เก่าทั้ง 2 แบบ → โดเมนใหม่ · คง `?v=` · ค่าที่เป็นโดเมนใหม่อยู่แล้ว → ไม่เปลี่ยน · path สัมพัทธ์ → ไม่เปลี่ยน · โฮสต์ภายนอก → ไม่เปลี่ยน · ค่าว่าง/null → คืนเดิม
     + **เคสยิงผ่าน payload จริง 1 เคส:** ประกอบผลลัพธ์แบบ `/api/catalog` ด้วยแถว fixture (รวม `galleryImageUrls` หลายรูป + `videoUrl`) แล้วยืนยันว่า **ไม่มีสตริง `srv1964473` เหลือใน JSON ที่ส่งออก** และรูปที่ชี้โดเมนใหม่มีจำนวนเท่าเดิม
  D. **ห้ามแตะข้อมูล/ราคา/สถานะ:** ไม่มี SQL, ไม่มี migration, ไม่แก้ราคา/ชื่อ/รหัสสี/`active`, ไม่แก้ env (เดวิดจะแก้ `PUBLIC_UPLOAD_ORIGIN` เองในรอบ ops แยก)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/canonical-media-url.ts        (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/catalog-media.ts              (ใช้ตัวช่วย + เลิก hardcode โฮสต์เก่า)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/stone-matcher.ts              (ค่าคงที่รูป slab)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/catalog.ts                 (/site-photos/showcase)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts                   (2 mapper รูป site photos)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/canonical-media-url.test.ts      (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-290-chai-canonical-media-urls.md                    อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแก้แถวในฐานข้อมูล/เขียน SQL/migration · ห้ามแก้ `.env` หรือค่าตั้งระบบใด ๆ · ห้ามแตะ `line-config.ts` และข้อความ log ใน `admin-router.ts`
  - ห้ามแตะ `artifacts/knight-basins/**` (ฝั่งเว็บ) · `src/index.css` · `public/sitemap.xml` · lockfile
  - ห้ามเปลี่ยนราคา/ชื่อ/รหัสสี/การซ่อนสี · ห้ามเปลี่ยนรูปแบบ response ฟิลด์อื่น (ชื่อฟิลด์/จำนวนแถวต้องเท่าเดิม)
  - ห้ามอ่าน/พิมพ์ `.env`/คีย์ · ห้ามแตะ production/DB · ห้าม push ตรงเข้า `main` · ห้าม merge เอง

EVIDENCE:
  1) `git grep -n "srv1964473" artifacts/api-server/src` → เหลือ **2 จุด** ที่ระบุเหตุผล (line-config / log message) — แนบผลก่อน/หลัง
  2) เทสต์ใหม่ผ่านทุกเคส + **พิสูจน์ว่าจับบั๊กได้**: ปิดการเรียก `canonicalMediaUrl` ในจุดหนึ่ง (ชั่วคราว) → เทสต์ต้อง fail → คืน → ผ่าน (แนบสองผล)
  3) ชุดเทสต์ api-server ทั้งชุด ตก **0** — คำสั่ง `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)`
     baseline ที่เดวิดวัดล่าสุด (main 8 ต.ค. 69) = **1183 tests / 1183 pass / 0 fail** · ถ้าตัวเลขของคุณต่าง ให้ระบุ commit + จำนวนจริง
  4) `pnpm exec tsc --noEmit` ใน artifacts/api-server → **0 errors**
  5) `git diff --stat origin/main...HEAD` → แตะไม่เกิน **6 ไฟล์** · ไม่มีไฟล์ใน `artifacts/knight-basins/**` · ไม่มี lockfile/index.css/sitemap
  6) ระบุ commit SHA ของสาขาในรายงาน

OUTPUT:
  - ตัวช่วย `canonicalMediaUrl` + จุดส่งออกทั้งหมดของ api-server ที่คืนโดเมนใหม่ (path/query เดิมครบ)
  - เทสต์ ≥6 เคส + เคสยิง payload + หลักฐานสองทาง
  - รายงาน: จำนวนจุดที่แก้ · ผล grep ก่อน/หลัง · ตัวเลขชุดเทสต์ · ไฟล์ที่แตะ

STOP:
  - เมื่อ `git grep srv1964473` ใน `artifacts/api-server/src` เหลือ 2 จุดที่ระบุเหตุผล · เทสต์ใหม่ผ่านและพิสูจน์ว่าจับบั๊กได้ · ชุดเทสต์ตก **0** · tsc **0 error** · แตะไม่เกิน **6 ไฟล์** · ไม่มีการแก้ข้อมูล/env
  - หรือเมื่อทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR/รายงาน)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | `canonicalMediaUrl` | ครอบ 4 กติกา (ว่าง/relative/โฮสต์เก่า/โฮสต์อื่น) |
| 2 | คง path + query | `?v=…` ไม่หาย (เทสต์ยืนยัน) |
| 3 | `catalog-media` ใช้ตัวช่วย | ทั้งรูปเดี่ยวและ `galleryImageUrls[]` |
| 4 | ไม่เหลือ hardcode โฮสต์เก่า | ในไฟล์สื่อ (เหลือ 2 จุดเรื่องอื่นโดยเจตนา + ระบุเหตุผล) |
| 5 | site photos 2 ทาง | `/site-photos/showcase` + `leads.ts` ทั้ง 2 mapper |
| 6 | payload จริง | ไม่มี `srv1964473` ใน JSON ที่ประกอบ |
| 7 | เทสต์ใหม่ | ≥ 6 เคส · ผ่าน |
| 8 | พิสูจน์จับบั๊ก | ปิดตัวช่วยจุดหนึ่ง → fail → คืน → ผ่าน |
| 9 | ชุดเทสต์ api-server | ตก 0 (ระบุ commit + ตัวเลข) |
| 10 | Typecheck | api-server 0 errors |
| 11 | ขอบเขตไฟล์ | ≤ 6 ไฟล์ · ไม่แตะเว็บ/index.css/sitemap/lockfile |
| 12 | ไม่แตะข้อมูล | ไม่มี SQL/migration/env · ราคา/รหัสสี/จำนวนแถวเท่าเดิม |

## รายงานผลท้ายใบ (ให้ชัยตอบในคอมเมนต์ PR)

| # | หัวข้อ | ต้องระบุ |
|---|---|---|
| 1 | จุดที่แก้ | ไฟล์:บรรทัด + ฟิลด์ที่ผ่านตัวช่วย |
| 2 | กติกาที่ใช้ | โฮสต์ไหนแปลง/โฮสต์ไหนไม่แปลง (พร้อมเหตุผล) |
| 3 | หลักฐานสองทาง | ผลก่อนแก้ (fail) + หลังแก้ (pass) |
| 4 | payload | วิธีประกอบ + ผลนับสตริงโฮสต์เก่า (ต้อง 0) |
| 5 | เทสต์/ไฟล์ | ตัวเลขชุดเทสต์ · tsc · ไฟล์ที่แตะ · commit SHA |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → ชัย] ใบ 290-C ครับ — งาน backend เล็ก (≤6 ไฟล์ · STOP 12 turns) ต่อจากที่บอสอนุมัติแนวทาง
เรื่อง: /api/catalog บน production ยังคืน URL รูป/วิดีโอ 748 จุดที่ชี้โฮสต์เก่า *.srv1964473.hstgr.cloud (ทุกใบ 200 แต่ผิดหลักโดเมนเดียวของใบ 272 และ AI/og เห็นโดเมนเดิม)
ทำ:
A. สร้าง lib/canonical-media-url.ts → canonicalMediaUrl(url): ค่าว่าง/relative คืนเดิม · โฮสต์ที่ลงท้าย .srv1964473.hstgr.cloud → https://knightbasins.com + path/query เดิม (ต้องคง ?v=) · โฮสต์อื่นคืนเดิม
B. ใช้ที่ lib/catalog-media.ts (withBasinMedia/withStoneMedia + galleryImageUrls) · lib/stone-matcher.ts (SLAB_IMAGE_ORIGIN) · routes/catalog.ts (/site-photos/showcase) · routes/leads.ts (2 mapper รูป site photos)
C. เทสต์ใหม่ ≥6 เคส + เคสยิง payload ที่ยืนยันว่าไม่มีสตริง srv1964473 เหลือ + พิสูจน์ว่าจับบั๊กได้ (ปิดตัวช่วยจุดหนึ่ง → fail → คืน → ผ่าน)
D. ห้ามแตะข้อมูล/DB/env/ราคา/รหัสสี · ห้ามแตะ line-config.ts และข้อความ log ใน admin-router.ts (2 จุดที่เหลือโดยเจตนา)
ห้าม: แตะ artifacts/knight-basins/** · index.css · sitemap · lockfile · push main · merge เอง
ตัวเลข: ชุดเทสต์ api-server ตก 0 (baseline ล่าสุด 1183/1183/0 — ระบุ commit ของคุณด้วย) · tsc 0 error · แตะ ≤ 6 ไฟล์
สาขา: infra/chai-canonical-media-urls → ส่ง branch + PR แล้วส่งลิงก์มาให้เดวิดตรวจ+merge
```
