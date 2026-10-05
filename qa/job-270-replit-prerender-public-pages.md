# ใบงาน 270-R (รีพิต) — ทำให้หน้าสาธารณะมีเนื้อหาใน HTML จริง (prerender) เพื่อให้ Google + AI crawlers เห็นเนื้อหา

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/replit-prerender-public-pages`
**ที่มา (บอสอนุมัติ 5 ต.ค. 69):** “บอส อนุมัติ และให้ รีพิต ทำ” (หลังเดวิดทบทวน SEO/GEO)

**ต้นเหตุที่ตรวจพบ (หลักฐานจริง 5 ต.ค. 69):**
```
UA = Googlebot → 21,266 bytes · md5 eb44aacf · ข้อความใน <body> = 0 คำ
UA = GPTBot    → 21,266 bytes · md5 eb44aacf · 0 คำ
UA = เบราว์เซอร์ → 21,266 bytes · md5 eb44aacf   ← เหมือนกันเป๊ะทุก UA
/ และ /stone → HTML เหมือนกันเป๊ะ · ไม่มี <noscript> · ไม่มี prerender/SSR ใน config
```
⇒ เว็บเป็น SPA ที่เรนเดอร์ด้วย JS ทั้งหมด · บอทเห็น “หน้าเปล่า” (มีแค่ JSON-LD) ⇒ Google ไม่ index (สคริปต์ส่ง 8 URL · **index 0** · ตรวจ 4 หน้า = “URL is unknown to Google”) และ **AI crawlers (GPTBot/ClaudeBot/Perplexity) ไม่รัน JS ⇒ อ่านเนื้อหาเราไม่ได้** (แม้จะมี `llms.txt` ที่อ่านได้ก็ตาม)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. **ทำให้ HTML ที่ส่งให้ crawler มีเนื้อหาจริงของแต่ละหน้า (prerender ตอน build)**
     - สร้างสคริปต์ prerender ใน `artifacts/knight-basins` (เช่น `scripts/prerender.mjs`) ที่.build เสร็จแล้ว render หน้าสาธารณะด้วย headless Chromium (puppeteer) แล้วเขียนไฟล์ `dist/public/<route>/index.html`
     - หน้าที่ต้อง prerender (ตรงกับ `public/sitemap.xml` 10 URL): `/` · `/portfolio` · `/stone` · `/site-prep` · `/studio-guide` · `/quote` · `/studio` · `/sketch` · `/readme` · `/updates`
  2. **แต่ละไฟล์ที่ได้ต้องมี:** `<title>` เฉพาะหน้า · `<meta name="description">` เฉพาะหน้า · `<link rel="canonical">` เฉพาะหน้า (ปัจจุบันทุกหน้าใช้ค่าเดียวกันจาก index.html) · **ข้อความใน `<body>` มากกว่า 0 คำ** (nav/footer/h1/เนื้อหาหลัก) · JSON-LD เดิมคงอยู่
  3. **ให้ crawler ที่ไม่รัน JS เห็นเนื้อหา:** ทดสอบด้วย `curl -A "Googlebot/..."` และ `curl -A "Mozilla/5.0 (compatible; GPTBot/1.2)"` → ต้องได้ HTML ที่ **มีข้อความ** และ **ต่างกันตามหน้า** (md5 ต่างกัน) — ห้ามพึ่ง JS
  4. **nginx ต้องเสิร์ฟไฟล์ prerender แทน SPA fallback สำหรับเส้นทางนั้น** โดย **URL ต้องไม่มี redirect เพิ่ม** (ไม่เพิ่ม trailing slash):
     - แก้ `deploy/hostinger/nginx.conf` เฉพาะบรรทัด `try_files` ให้ลองไฟล์ prerender ก่อน SPA fallback (เช่น `try_files $uri $uri/index.html $uri/ /index.html;` หรือเทียบเท่า) — **ห้ามกระทบ `location /assets/` · `/kb/` · `/api/` และห้ามแตะ header/security block เดิม**
  5. **ห้ามกระทบผู้ใช้จริง:** แอปต้อง hydrate ต่อได้ปกติ (ไม่จอขาว/ไม่ error) · หน้าแอดมิน (`/admin*`) **ห้าม prerender** (ต้องคงเป็น client-rendered + มีระบบสิทธิ์เหมือนเดิม และห้ามเนื้อหาแอดมินหลุดไปอยู่ในไฟล์ static)
  6. **กันหลุดในอนาคต:** เพิ่มเทสต์ที่ยืนยันว่า (ก) มีไฟล์ prerender ครบทุก URL ใน sitemap (ข) ไฟล์นั้นมี `<title>` ของตัวเองและ **ไม่ซ้ำกันทุกหน้า** (ค) ยังมี JSON-LD
  7. ถ้าติดตั้ง Chromium ใน CI ไม่ได้จริง ให้ถอยไปทำ **แบบ static SEO shell** (สร้าง HTML ต่อหน้าจาก shell + แผนที่ meta/เนื้อหาย่อหน้าละหน้า โดยไม่ใช้ browser) แล้ว **รายงานเหตุผล + แนบหลักฐานแบบเดียวกัน** (ห้ามเงียบ)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/scripts/prerender.mjs            (ไฟล์ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/package.json                     (เพิ่มสคริปต์ build + dependency ที่จำเป็น)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.logic.ts (ใช้ของเดิมเป็นแหล่ง meta — แก้ได้ถ้าจำเป็น)
  - /opt/data/cache/kbsrc/deploy/hostinger/nginx.conf                              (เฉพาะ try_files)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/prerender-output.test.ts    (ไฟล์เทสต์ใหม่)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) และห้ามเปลี่ยนดีไซน์/ข้อความ UI ที่ผู้ใช้เห็น
  - ห้ามแตะ `artifacts/api-server/**` (งานนี้เป็นฝั่งเว็บ static ล้วน) · ห้ามแตะ `routes/*` · ห้ามแตะราคา/แคตตาล็อก (`src/data/**`)
  - **ห้าม prerender `/admin*` หรือหน้าลูกค้าที่มีข้อมูลส่วนตัว** (ห้ามเนื้อหาแอดมิน/ข้อมูลลูกค้าหลุดเป็นไฟล์ static สาธารณะ)
  - ห้ามฝังคีย์/ค่า env/ชื่อโมเดลลงในไฟล์ HTML ที่ prerender
  - ห้ามเปลี่ยน URL/โครงสร้าง sitemap ให้ผิดจากที่ GSC ส่งไว้ (10 URL เดิม) · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` → 0 errors · `npx tsc --build` (ราก repo) สำหรับ libs
  2) รัน build จริง: `cd artifacts/knight-basins && pnpm run build` (หรือคำสั่ง build ที่ repo ใช้) → **ต้องมีไฟล์ `dist/public/<route>/index.html` ครบ 10 เส้นทาง** (แนบ `ls` + ขนาดไฟล์)
  3) เทสต์ใหม่: `node --experimental-strip-types --test test/prerender-output.test.ts` → ผ่าน · **พิสูจน์ว่าจับได้:** ลบไฟล์ prerender ของหน้า `/stone` แล้วเทสต์ต้องตก
  4) เทสต์ชุดเดิมของ knight-basins (แบบ CI): `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ตก 0** (baseline ที่เดวิดวัดเอง 5 ต.ค. 69: **1112 tests / 1103 pass / 0 fail / 9 skip** · ตัวเลขอ้างอิงชุด studio+sketch 515/513/0/2) — ตัวเลขจะเพิ่มตามเทสต์ใหม่
  5) `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0** · `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE
  6) **ยิงจริงหลัง deploy (เดวิดทำ):** `curl -s -A "Googlebot/2.1" <url>` ของทั้ง 10 หน้า → ต้องได้ข้อความใน body > 0 คำ · md5 ต่างกันตามหน้า · title/description/canonical ตรงกับหน้า · และหน้า `/admin` ต้องยังต้องล็อกอินเหมือนเดิม
  7) แนบผลรันจริงเป็นตัวเลขทั้งหมด (ห้ามคำรับรองลอย ๆ)

OUTPUT:
  - หน้าสาธารณะ 10 หน้าถูก prerender เป็น HTML ที่มีเนื้อหา+meta เฉพาะหน้า · nginx เสิร์ฟไฟล์เหล่านั้น · แอปผู้ใช้ยังทำงานปกติ · เทสต์กันหลุด
  - PR เดียว แจ้งเดวิดเมื่อพร้อม (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ) แล้วเดวิด deploy + ยิงยืนยันด้วย UA ของ Googlebot/GPTBot

STOP:
  - เมื่อ tsc 0 · build สร้างไฟล์ครบ 10 หน้า · เทสต์ใหม่ผ่าน + พิสูจน์จับได้ · ชุด CI ตก 0 · index.css 0 diff · เปิด PR และแจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | prerender 10 หน้า + meta เฉพาะหน้า + nginx + ห้ามแตะแอดมิน |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 5 ไฟล์ (รวมไฟล์ใหม่ 2) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff · ห้ามแตะ api · ห้าม prerender admin |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | build จริง · curl 2 UA · เทสต์+พิสูจน์จับได้ · ตัวเลขฐาน |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ prerender + nginx + PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุคำสั่งบอส | ผ่าน | “อนุมัติ และให้ รีพิต ทำ” |
| 9 | มีทางถอยถ้าติดข้อจำกัด | ผ่าน | static SEO shell + รายงานเหตุผล |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → รีพิต] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 5 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → รีพิต] ใบงาน 270 — qa/job-270-replit-prerender-public-pages.md · สาขา fix/replit-prerender-public-pages
บอสสั่ง: ทำให้ Google + AI crawlers เห็นเนื้อหาหน้าจริง (ตอนนี้เว็บเป็น SPA → บอทเห็น HTML เปล่า)
หลักฐานต้นเหตุ (เดวิดยิงจริง): UA Googlebot / GPTBot / เบราว์เซอร์ ได้ HTML เดียวกันเป๊ะ 21,266 bytes (md5 eb44aacf) และข้อความใน body = 0 คำ · / กับ /stone เหมือนกัน · ไม่มี prerender/SSR
งาน: ทำ prerender ตอน build (headless Chromium) ให้ 10 หน้าตาม sitemap → dist/public/<route>/index.html ที่มี title/description/canonical เฉพาะหน้า + เนื้อหาจริง · แก้ nginx.conf เฉพาะ try_files ให้เสิร์ฟไฟล์นั้น (ไม่เพิ่ม redirect/trailing slash)
ห้าม: แตะ src/index.css (0 diff) · api-server · src/data/** · prerender /admin* · ฝังคีย์/env · เปลี่ยน URL ใน sitemap
ต้องมีเทสต์กันหลุด: ไฟล์ครบ 10 หน้า · title ไม่ซ้ำกันทุกหน้า · JSON-LD ยังอยู่ · ลบไฟล์หน้าใดหน้าหนึ่งแล้วเทสต์ต้องตก
หลักฐาน: tsc 0 · pnpm run build สร้างไฟล์ครบ (แนบ ls+ขนาด) · เทสต์ใหม่ผ่าน · ชุด CI ตก 0 (ฐาน 1112/1103/0/9) · index.css 0 diff
ถ้าติดตั้ง Chromium ใน CI ไม่ได้จริง → ทำแบบ static SEO shell แทน แล้วรายงานเหตุผลพร้อมหลักฐานแบบเดียวกัน (ห้ามเงียบ)
หลัง merge เดวิดจะ deploy + ยิงยืนยันด้วย UA Googlebot/GPTBot ทุกหน้า
```
