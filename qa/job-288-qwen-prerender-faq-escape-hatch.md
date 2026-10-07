# ใบงาน 288-Q (Qwen) — ทางออก `data-route-schema="faq"` ใน prerender ใช้ไม่ได้จริง (โน้ตที่เขียนไว้ไม่ตรงกับโค้ด)

**วันที่:** 8 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Qwen** · **ผู้ตรวจรับ:** เดวิด
**ที่มา:** เดวิดพบเองตอนตรวจใบ 285-Q (PR #392) — ยังไม่กระทบ production วันนี้ แต่เป็นกับดักที่จะทำให้ build **พัง** ในวันที่หน้าไหนมี FAQ ของตัวเอง
**หลักฐานจากโค้ด main ปัจจุบัน (`a0ac27c`) — เดวิดอ่านเองทุกบรรทัด:**
```
scripts/prerender.mjs:296  function dropInheritedFaqJsonLd(html, route)
scripts/prerender.mjs:300    if (!block.includes("FAQPage") || /data-route-schema=/i.test(block)) continue;   <- ข้ามบล็อกที่ติดธง
scripts/prerender.mjs:318    throw new Error(`[prerender] ${route.path}: an FAQPage survives although the route renders none - ...`)
scripts/prerender.mjs:528    const html = dropInheritedFaqJsonLd( ... )
```
⇒ บรรทัด 300 บอกว่า "บล็อกที่ติดธง `data-route-schema` = เก็บไว้" แต่บรรทัด 318 **throw ถ้ายังเหลือ FAQPage ตัวใดก็ตาม** ⇒ ทางออกนั้น**ใช้ไม่ได้เลย** วันที่มีหน้าไหนติดธงจริง build จะตายด้วยข้อความที่บอกให้ไปใส่ธงที่ตัวเองใส่แล้ว
**Branch:** `seo/qwen-job288-prerender-faq-escape-hatch`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 8 ต.ค. 69 · เดวิด

GOAL:
  A. **แยกตัวช่วยออกมาให้เทสต์ตรงได้** — ย้าย `dropInheritedFaqJsonLd` จาก `scripts/prerender.mjs` ไปเป็นโมดูลใหม่
     `scripts/prerender-faq.mjs` (export ชื่อเดิม) แล้วให้ `prerender.mjs` import มาใช้
     ⚠️ ห้ามเปลี่ยนพฤติกรรมกับ 12 หน้าจริง (หน้าแรกเก็บ FAQ 10 ข้อ · หน้าอื่น = 0) — งานนี้คือ "ทำให้ทางออกที่เขียนไว้ใช้ได้จริง" ไม่ใช่เปลี่ยนนโยบาย
  B. **ซ่อมด่านสุดท้ายให้ตรงกับเจตนาที่บรรทัด 300 เขียนไว้** — หลังลบบล็อกที่ไม่ได้ติดธงแล้ว ให้ด่าน "ยังเหลือ FAQPage ไหม" **มองข้ามบล็อกที่ติดธง `data-route-schema`** (เช่น ตรวจกับสำเนา HTML ที่ลบบล็อกที่ติดธงออกก่อน แล้วค่อยเช็ค)
     ⇒ ผลที่ต้องได้: บล็อกที่ติดธง **รอดได้จริง** · บล็อกที่ไม่ได้ติดธงและยังเหลือ FAQPage → ยัง **throw เหมือนเดิม** (ด่านกันพลาดห้ามหาย)
  C. **เทสต์ตรงที่พิสูจน์ได้ว่าจับบั๊กได้จริง** — สร้าง `test/prerender-faq-escape-hatch.test.ts` ใน artifacts/knight-basins
     เคสที่ต้องมี (อย่างน้อย 5):
       1. route `/` → FAQPage คงอยู่ครบ
       2. route อื่น + บล็อกที่ **ไม่ได้** ติดธง → FAQPage ถูกถอดออก
       3. route อื่น + บล็อกที่ **ติดธง** `data-route-schema="faq"` → FAQPage **รอด** ← เคสนี้คือบั๊ก (วันนี้ต้อง fail)
       4. บล็อกที่ FAQPage ปนกับคีย์ระดับบนอื่น (`@type` ฯลฯ) → ยัง throw
       5. JSON-LD ที่พัง (parse ไม่ได้) → ยัง throw
     **ต้องแนบผลทั้งสองรอบ:** รันเทสต์กับโค้ดเดิม (ก่อนแก้) → **fail ที่เคส 3** → แก้ → ผ่าน (แนบ output จริงทั้งสอง)
  D. **ยืนยันว่า build จริงไม่เปลี่ยน** — `rm -rf dist && pnpm run build` แล้วนับ FAQPage ต่อหน้า:
     `/` = มี 10 คำถาม · อีก 11 หน้า = **0** (ใช้คำสั่ง/สคริปต์สั้น ๆ ของคุณเอง แนบตัวเลข)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/scripts/prerender-faq.mjs                   (ใหม่) — โมดูลที่ export ตัวช่วย
  - /opt/data/cache/kbsrc/artifacts/knight-basins/scripts/prerender.mjs                       (import + ซ่อมด่านบรรทัด 318)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/prerender-faq-escape-hatch.test.ts     (ใหม่) — เทสต์ข้อ C
  - /opt/data/cache/kbsrc/qa/job-288-qwen-prerender-faq-escape-hatch.md                       อ่านเท่านั้น

FORBIDDEN:
  - ห้ามเปลี่ยนนโยบาย FAQ: หน้าแรกต้องเก็บ FAQPage 10 ข้อ · หน้า `/stone` `/price-guide` ฯลฯ ต้องไม่โฆษณา FAQPage (ห้าม "แก้" ด้วยการยอมให้ FAQPage อยู่ทุกหน้า)
  - ห้ามแตะ `src/**` · `public/**` · `index.html` · `src/index.css` · `public/sitemap.xml` · `pnpm-lock.yaml` · `artifacts/api-server/**` · `src/admin/**`
  - ห้ามลดความเข้มของด่าน: กรณี "FAQPage หลงเหลือโดยไม่ติดธง" ต้องยัง throw และต้องมีเทสต์ยืนยัน
  - ห้ามอ่าน/พิมพ์ `.env`/คีย์ · ห้ามแตะ production/DB · ห้าม push ตรงเข้า `main` · ห้าม merge เอง

EVIDENCE:
  1) ผลรันเทสต์ใหม่กับโค้ดเดิม (ก่อนแก้) → **fail ที่เคส 3** และข้อความ error ที่ได้ (แนบ output เต็ม)
  2) ผลรันเทสต์ใหม่หลังแก้ → **ผ่านทุกเคส**
  3) `rm -rf dist && pnpm run build` → ต้องได้ข้อความ `OK: 12 public pages rendered` + ตัวเลข FAQPage ต่อหน้า (ตามข้อ D)
  4) ชุดเทสต์เว็บทั้งชุด ตก **0** — baseline main 8 ต.ค. 69 = **1198 tests / 1189 pass / 0 fail / 9 skip**
     คำสั่ง: `files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort); node --experimental-strip-types --test $files`
  5) `pnpm run typecheck:libs` (root) แล้ว `pnpm exec tsc --noEmit` ใน artifacts/knight-basins → **0 errors**
  6) `git diff --stat origin/main...HEAD` → แตะไม่เกิน **3 ไฟล์** · `index.css`/`sitemap.xml`/lockfile 0 diff
  7) ระบุ commit SHA ของสาขาในรายงาน

OUTPUT:
  - `scripts/prerender-faq.mjs` + `prerender.mjs` ที่ด่านตรงกับเจตนา (ธงรอดจริง · ไม่ติดธงยัง throw)
  - เทสต์ 5 เคสที่พิสูจน์สองทางได้ (fail ก่อนแก้ → ผ่านหลังแก้)
  - รายงาน: output ทั้งสองรอบ · ตัวเลข FAQPage ต่อหน้า · ชุดเทสต์ + tsc + ไฟล์ที่แตะ

STOP:
  - เมื่อเทสต์ใหม่ผ่าน 5/5 และ **เคย fail ที่เคส 3 ก่อนแก้ (มีหลักฐาน)** · build 12 หน้าผ่านและ FAQPage = `/` 10 · อีก 11 หน้า 0 · ชุดเทสต์ตก **0** · tsc **0 error** · แตะไม่เกิน **3 ไฟล์**
  - หรือเมื่อทำงานครบ **8 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
```

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR/รายงาน)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | โมดูลใหม่ `prerender-faq.mjs` | export `dropInheritedFaqJsonLd` และ `prerender.mjs` import มาใช้จริง |
| 2 | บล็อกที่ติดธง `data-route-schema` | **รอด** (เคสที่วันนี้ fail) |
| 3 | บล็อกที่ไม่ติดธง | ยังถูกถอด + ยัง throw ถ้าหลงเหลือ |
| 4 | หน้าแรก `/` | FAQPage 10 คำถามคงเดิม |
| 5 | คีย์ระดับบนปนกัน | ยัง throw (ด่านเดิมไม่หาย) |
| 6 | JSON-LD พัง | ยัง throw |
| 7 | เทสต์ใหม่ | ≥ 5 เคส · ผ่านทุกเคส |
| 8 | พิสูจน์ว่าจับบั๊กได้ | รันกับโค้ดเดิม → fail เคส 3 (แนบ output) |
| 9 | build จริง | 12 หน้า · FAQPage `/`=10 · อื่น=0 |
| 10 | ชุดเทสต์เว็บ | ตก 0 (เทียบ 1198/1189/0/9) |
| 11 | Typecheck | libs + web = 0 errors |
| 12 | ขอบเขตไฟล์ | ≤ 3 ไฟล์ · index.css/sitemap/lockfile 0 diff |

## รายงานผลท้ายใบ (ให้ Qwen ตอบในคอมเมนต์ PR)

| # | หัวข้อ | ต้องระบุ |
|---|---|---|
| 1 | สาเหตุ | บรรทัด/โค้ดที่ทำให้ธงใช้ไม่ได้ (อ้างจากเวอร์ชัน main ที่คุณเริ่มงาน) |
| 2 | วิธีแก้ | โครงของด่านใหม่ (อธิบายสั้น + โค้ดส่วนที่เปลี่ยน) |
| 3 | หลักฐานสองทาง | output ก่อนแก้ (fail) + หลังแก้ (pass) |
| 4 | ผลกับของจริง | ตัวเลข FAQPage ต่อหน้า 12 หน้า + ข้อความ build |
| 5 | เทสต์/ไฟล์ | ชุดเว็บทั้งหมด · tsc · ไฟล์ที่แตะ · commit SHA |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → Qwen] ใบ 288-Q ครับ — ใบเล็ก (≤3 ไฟล์ · STOP 8 turns) ต่อจากงาน 285-Q ของคุณเอง
เรื่อง: scripts/prerender.mjs บรรทัด 300 เขียนว่า "บล็อกที่ติดธง data-route-schema = เก็บไว้" แต่บรรทัด 318 ยัง throw ถ้าเหลือ FAQPage ตัวใดก็ตาม ⇒ ทางออกที่คุณเขียนไว้ใช้ไม่ได้จริง วันที่มีหน้าไหนมี FAQ ของตัวเอง build จะพัง
ทำ:
A. ย้าย dropInheritedFaqJsonLd ไป scripts/prerender-faq.mjs (export ชื่อเดิม) แล้วให้ prerender.mjs import — เพื่อเทสต์ตรงได้
B. ซ่อมด่านสุดท้าย: ให้ "ยังเหลือ FAQPage ไหม" มองข้ามบล็อกที่ติดธง (เช่นเช็คกับสำเนา HTML ที่ลบบล็อกติดธงออกก่อน) · บล็อกที่ไม่ติดธงต้องยัง throw เหมือนเดิม
C. เทสต์ใหม่ test/prerender-faq-escape-hatch.test.ts ≥5 เคส (หน้าแรกคงอยู่ · ไม่ติดธงถูกถอด · ติดธงรอด ← เคสบั๊ก · คีย์ปนกัน throw · JSON-LD พัง throw) + แนบผลรันกับโค้ดเดิม (ต้อง fail เคส 3) และหลังแก้ (ผ่าน)
D. ยืนยัน build จริง: 12 หน้า · FAQPage `/`=10 · อีก 11 หน้า=0
ห้าม: เปลี่ยนนโยบาย FAQ (หน้าแรกเก็บ · หน้าอื่นไม่โฆษณา) · ลดความเข้มด่าน · แตะ src/** public/** index.html index.css sitemap lockfile api-server admin · push main · merge เอง
ตัวเลข: ชุดเทสต์เว็บตก 0 (baseline main 8 ต.ค. 69 = 1198/1189/0/9) · tsc 0 error · แตะ ≤ 3 ไฟล์ · STOP 8 turns
สาขา: seo/qwen-job288-prerender-faq-escape-hatch → ส่ง branch + PR แล้วส่งลิงก์มาให้เดวิดตรวจ+merge
```
