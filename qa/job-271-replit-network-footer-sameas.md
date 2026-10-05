# ใบงาน 271-R (รีพิต) — “โครงข่ายเว็บในเครือ”: footer + หน้า /network + `sameAs` + ลิงก์ออกไป 2 เว็บของบอส

**วันที่:** 5 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/replit-network-footer-sameas` — **แตกจาก main ล่าสุด** (ใบ 270 + 270-fix + 272 merge หมดแล้ว → **เริ่มได้เลย**)
**บริบทโดเมน (สำคัญ):** ใบ 272 เปลี่ยน canonical/robots/sitemap/llms ทั้งชุดเป็น **`https://knightbasins.com`** แล้ว (merge `149fba7` · deploy success · ยืนยันสด) ⇒ งานนี้ **ต้องไม่ทำ URL โดเมนใหม่หลุด/กลับไปใช้ host เก่า** `knightbasins.srv1964473.hstgr.cloud`
**ที่มา (บอสอนุมัติ 5 ต.ค. 69):** “ยืนยัน ข้อ 1” = อนุมัติเฟส 3 (GEO/เครือข่าย) ต่อจากใบ 270
**บริบท:** บอสเสนอเองว่า “เอาเว็บเหล่านั้นมาใส่ใน Knight Basins webapp ของเราก่อน” — เดวิดออกแบบเป็นโครงข่าย 3 ส่วน + ขยายต่อ 1 ส่วน
**ข้อเท็จจริงที่ตรวจแล้ว:** footer เดิมมีลิงก์ภายในอยู่แล้ว (`/portfolio` · `/site-prep` · `/updates` ที่ `src/App.tsx` ~บรรทัด 281-285) · **ยังไม่มี `sameAs`** ใน JSON-LD Organization · ทั้ง 2 เว็บเป็น WordPress และ **ยังไม่มีลิงก์ไปแอปเรา**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 5 ต.ค. 69 · เดวิด

GOAL:
  1. **Footer ทุกหน้าสาธารณะ — เพิ่มบล็อก “เครือ Knight Furnich” 2 ลิงก์ (ไม่ลบลิงก์เดิม)**
     - `Knight Furnich — เว็บบริษัท (ประสบการณ์ 20 ปี)` → `https://www.knightfurnich.com/`
     - `ความรู้เรื่องหินสังเคราะห์` → `https://www.หินสังเคราะห์.com/` (ใน `href` ใช้ punycode `https://xn--42cf7czb6aef3bfnp2mrg.com/` เพื่อความเข้มงวด)
     - ต้องมี `rel="noopener"` (**ห้ามใส่ `nofollow`**) · เปิดแท็บใหม่ได้ (`target="_blank"`) · มี `data-testid` ให้เทสต์ตรวจ (เช่น `link-footer-knightfurnich`, `link-footer-hinsangkhro`)
  1.1 **(ข้อยกเว้นที่บอสอนุมัติ 5 ต.ค. 69) ที่อยู่ใน footer** — บอสยืนยัน "ใช้ที่อยู่โชว์รูม `35/633 ซอยร่วมสุข 8/1 ต.บ้านใหม่ อำเภอเมือง ปทุมธานี 12000` เป็นที่อยู่หลักในเว็บ"
     ⇒ เปลี่ยนข้อความที่อยู่ติดต่อใน footer จากที่อยู่โรงงาน (`35/170, 35/267 …`) เป็น **ที่อยู่โชว์รูม** และถ้ารักษาบรรทัดโรงงานไว้ ให้ติดป้ายชัดว่า "โรงงานผลิต" (ห้ามลบข้อมูลโรงงานทิ้งถ้าดีไซน์ยังมีที่) · บรรทัดนี้เป็น **ข้อยกเว้นเดียว** ที่อนุญาตให้แก้ข้อความเดิมของ footer
  2. **หน้าใหม่ `/network` — “เครือข่ายของเรา” (หน้าสาธารณะ)**
     - การ์ด 3 ใบ: **Knight Furnich** (บริษัทแม่ · หินสังเคราะห์ 20 ปี) · **Knight Basins** (แอปนี้: คลังหิน + อ่าง + ใบเสนอราคา) · **หินสังเคราะห์.com** (ศูนย์ความรู้)
     - ลิงก์ออกไป 2 เว็บ (แบบเดียวกับ footer: follow + noopener) + **ลิงก์ภายใน** ไป `/stone` · `/portfolio` · `/quote`
     - **เพิ่มช่องทางของร้าน (บอสยืนยัน 5 ต.ค. 69):** **LINE OA** `https://line.me/R/ti/p/@789gcnhq` และ **Facebook** `https://www.facebook.com/knightfurnich`
       (ทำเป็นลิงก์/ปุ่มการ์ดในหน้า · `rel="noopener"` · ห้าม nofollow)
     - ⚠️ **YouTube: ห้ามใส่** — บอสสั่ง "ข้ามไปก่อน เอาที่มี ที่ได้" เพราะ `https://www.youtube.com/@knightfurnich` = **HTTP 404** (ห้ามใส่ลิงก์ที่เปิดไม่เจอ)
     - มี `<h1>` + ข้อความอธิบายภาษาไทยจริง (ไม่ใช่การ์ดเปล่า) · ใช้ดีไซน์/คอมโพเนนต์เดิมของเว็บ · **ห้ามใช้ `<iframe>`**
     - ลงทะเบียนเส้นทางใน `src/App.tsx` (สาธารณะ ไม่ต้องล็อกอิน)
  3. ~~**`sameAs` ใน JSON-LD**~~ — **เดวิดทำเสร็จแล้ว (5 ต.ค. 69)** ใน `index.html` (ที่เดียวกับที่ node Organization อยู่จริง ไม่ใช่ `structured-data.ts`)
     ⇒ **ไม่ต้องทำในใบนี้** · `sameAs` ตอนนี้มี 6 รายการ: Facebook · Instagram · TikTok · knightfurnich.com · หินสังเคราะห์.com (punycode) · LINE @789gcnhq
     ⚠️ แก้ความเข้าใจผิดในใบเดิม: Organization/HomeAndConstructionBusiness อยู่ใน `index.html` ไม่ใช่ `src/data/structured-data.ts`
  4. **`public/sitemap.xml`** — เพิ่ม URL ของหน้า `/network` (จาก 10 → 11 URL) **โดยไม่แก้/ลบ URL เดิม**
  5. **ให้ prerender (ใบ 270) ครอบคลุม `/network` ด้วย** — ถ้าสคริปต์ prerender อ่านเส้นทางจาก `sitemap.xml` อัตโนมัติ ก็ตรวจว่าได้ครบ; ถ้าใช้รายการคงที่ ให้เพิ่ม `/network` ในรายการนั้น
  6. **เทสต์กันหลุด (ใหม่ 1 ไฟล์):** (ก) มีลิงก์ footer ทั้ง 2 จุดพร้อม `noopener` และ **ไม่มี `nofollow`** (ข) `/network` มี `<h1>` + ลิงก์ออก 2 เว็บ + ลิงก์ภายใน 3 หน้า (ค) JSON-LD มี `sameAs` ที่มีทั้ง 2 URL (ง) `sitemap.xml` มี `/network`

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx                        (footer + เส้นทาง /network)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/NetworkPage.tsx          (ไฟล์ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/sitemap.xml                 (เพิ่ม /network)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/network-links.test.ts         (ไฟล์ใหม่)

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · ห้ามเปลี่ยนดีไซน์/ข้อความเดิมของหน้าเว็บ หรือลบลิงก์ footer เดิม (3 ลิงก์)
  - ห้ามแตะ `artifacts/api-server/**` · `src/data/catalog*` · `studio-model.ts` · `sketch-order.ts` (ราคา/แคตตาล็อก)
  - ห้ามแก้ URL เดิมใน `sitemap.xml` (เพิ่มได้อย่างเดียว) · ห้าม prerender `/admin*`
  - **ห้ามใช้ `<iframe>`** ฝังเว็บภายนอก · ห้ามใส่ `nofollow` ให้ลิงก์ของเรา · ห้ามใส่ลิงก์แบบซ้ำ ๆ/สแปม (รวมทั้งคู่ไม่เกิน 4 ลิงก์ออก)
  - ห้ามฝังคีย์/env/ชื่อโมเดล · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง
  - **ห้ามเริ่มงานก่อนใบ 270 merge** (กันไฟล์/สาขาทับกัน) — เริ่มจาก main ล่าสุดหลัง 270

EVIDENCE:
  1) `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` → 0 errors (หลัง `npx tsc --build` ที่ราก repo)
  2) เทสต์ใหม่: `node --experimental-strip-types --test test/network-links.test.ts` → ผ่าน · **พิสูจน์ว่าจับได้:** ลบ `sameAs` ออกจาก JSON-LD → เทสต์ต้องตก (แนบข้อความ)
  3) ชุด CI ของ knight-basins (คำสั่งเดียวกับ CI): `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ตก 0**
     · baseline ล่าสุดที่เดวิดวัดบน main หลังใบ 272 (merge `149fba7`): **1120 tests / 1110 pass / 0 fail / 10 skip**
       (ก่อนใบ 271 — ตัวเลขจะขยับตามเทสต์ใหม่ ให้ยึด “**ตก 0**” เป็นเกณฑ์ผ่าน)
  3.1) **ห้ามทำให้เทสต์ใหม่ของใบ 270/272 ตก:** `test/domain-canonical.test.ts` (6 เคส) ต้องยังผ่าน — เพิ่ม `/network` ใน `sitemap.xml` แล้วURL ต้องอยู่บน `https://knightbasins.com` เท่านั้น
  4) `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0** · `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE
  5) ตรวจลิงก์ด้วยคำสั่งจริง: `grep -c 'nofollow' dist/public/index.html` → 0 · และ `grep -c 'knightfurnich.com' dist/public/index.html` → ≥1 (หลัง build/prerender)
  6) **เดวิดจะยิงจริงหลัง deploy:** `curl -s <หน้าแรก>` → ต้องมีลิงก์ 2 เว็บใน HTML จริง + ไม่มี `nofollow` · `/network` = 200 + มี h1 + ลิงก์ครบ · JSON-LD มี `sameAs` 2 URL · `sitemap.xml` = 11 URL (เดิม 10 ไม่หาย)

OUTPUT:
  - footer + หน้า `/network` + `sameAs` + sitemap 11 URL · ผ่านการ prerender (บอทเห็นลิงก์จริง) · เทสต์กันหลุด · PR เดียว
  - แจ้งเดวิดเมื่อพร้อม (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ) → เดวิด deploy + ยิงยืนยัน

STOP:
  - เมื่อ tsc 0 · เทสต์ใหม่ผ่าน + พิสูจน์จับได้ · ชุด CI ตก 0 · index.css 0 diff · เปิด PR และแจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | footer + /network + sameAs + sitemap + prerender + เทสต์ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ (ใหม่ 2) — ตัด structured-data.ts ออกเพราะ sameAs อยู่ใน index.html และเดวิดทำแล้ว |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 · ห้าม iframe/nofollow · ห้ามเริ่มก่อน 270 |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์+พิสูจน์จับได้ · grep จริง · ยิงหลัง deploy |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | หน้า/ลิงก์/sameAs + PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุคำสั่งบอส | ผ่าน | “ยืนยัน ข้อ 1” |
| 9 | ลำดับงานชัด (หลัง 270) | ผ่าน | ระบุห้ามเริ่มก่อน 270 merge |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → รีพิต] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 5 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → รีพิต] ใบงาน 271 — qa/job-271-replit-network-footer-sameas.md · สาขา fix/replit-network-footer-sameas
⚠️ เริ่มได้หลังใบ 270 (prerender) merge แล้วเท่านั้น เพื่อไม่ให้แก้ไฟล์ทับกัน
บอสอนุมัติเฟส 3: ทำ "โครงข่ายเว็บในเครือ"
1) footer ทุกหน้า เพิ่มบล็อก "เครือ Knight Furnich" 2 ลิงก์: https://www.knightfurnich.com/ และ https://xn--42cf7czb6aef3bfnp2mrg.com/ (หินสังเคราะห์.com) · ต้องมี rel="noopener" · ห้าม nofollow · มี data-testid
2) หน้าใหม่ /network (สาธารณะ) — การ์ด 3 ใบ (Knight Furnich · Knight Basins · หินสังเคราะห์.com) + ลิงก์ออก 2 เว็บ + ลิงก์ภายใน /stone /portfolio /quote + h1 + ข้อความจริง · ห้าม iframe
3) เพิ่ม sameAs ใน JSON-LD Organization (structured-data.ts) = 2 URL นั้น
4) sitemap.xml เพิ่ม /network (10 → 11 URL) ห้ามแก้ URL เดิม
5) ให้ prerender ครอบคลุม /network ด้วย (ถ้าสคริปต์อ่าน sitemap อัตโนมัติ ก็ตรวจว่าได้)
6) เทสต์ใหม่ test/network-links.test.ts: ลิงก์ footer/noopener/ไม่มี nofollow · /network มี h1+ลิงก์ครบ · JSON-LD มี sameAs · sitemap มี /network · พิสูจน์จับได้: ลบ sameAs แล้วต้องตก

เพิ่มจากคำสั่งบอส 5 ต.ค. 69:
• หน้า /network ให้ใส่ LINE https://line.me/R/ti/p/@789gcnhq และ Facebook https://www.facebook.com/knightfurnich (rel=noopener · ห้าม nofollow)
• YouTube: ห้ามใส่ (@knightfurnich = 404 · บอส: "ข้ามไปก่อน เอาที่มี ที่ได้")
• เพิ่ม /network ใน sitemap ให้ URL เป็นโดเมนใหม่ (https://knightbasins.com/network)
ห้าม: src/index.css (0 diff) · api-server · src/data (ราคา/แคตตาล็อก) · iframe · nofollow · ลบลิงก์ footer เดิม · ลบ/แก้ URL ใน sitemap
หลักฐาน: tsc 0 · เทสต์ใหม่ผ่าน+จับได้ · ชุด CI ตก 0 (baseline ล่าสุด 1120/1110/0/10) · เทสต์ domain-canonical ต้องยังผ่าน · grep nofollow=0 · index.css 0 diff · แนบผล build/prerender
หลัง merge เดวิด deploy + ยิงยืนยัน (ลิงก์ใน HTML จริง · /network 200 · sameAs 2 URL · sitemap 11 URL)
```
