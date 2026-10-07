# ใบงาน 282-Q (Qwen) — เติม llms.txt ให้ครบทุกหน้าจริง + ล็อกกันหลุด (ต่อจากวิเคราะห์ SEO/AEO/GEO)

**วันที่:** 7 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **Qwen** · **ผู้ตรวจรับ:** เดวิด
**ที่มา:** Qwen วิเคราะห์ SEO/AEO/GEO ของ knightbasins.com แล้วรายงานช่องว่าง — **เดวิดตรวจซ้ำแล้วยืนยันได้ 1 จุดที่เป็นของจริงและแก้ได้ทันที**
**ผลตรวจจริงของเดวิด (7 ต.ค. 69):**
```
/llms.txt       ราคา 200 · 16,769 ไบต์ · price-guide = 0 ❌ · โดเมนเก่า srv1964473 = 0 ✅
/llms-full.txt  ราคา 200 · 38,967 ไบต์ · price-guide = 0 ❌ · โดเมนเก่า = 0 ✅
sitemap.xml     12 URL (มี /price-guide ✅)
URL ที่อยู่ใน sitemap แต่ "ไม่มี" ใน llms.txt = /network · /price-guide  ← ของจริง ต้องแก้
/price-guide + UA บอท (Googlebot/GPTBot/ClaudeBot) = 200 · JSON-LD 3 บล็อก ⇒ "crawler access" ใช้ได้อยู่แล้ว
```
**Branch:** `seo/qwen-llms-parity`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 7 ต.ค. 69 · เดวิด

GOAL:
  A. **`public/llms.txt` — เติมลิงก์ที่ขาดให้ครบทุกหน้าจริง**
     เพิ่ม 2 รายการในทำนองเดียวกับบรรทัดที่มีอยู่ (ชื่อไทย + คำอธิบายสั้น + URL โดเมน knightbasins.com):
       • `/price-guide` — “คู่มือราคาและวิธีเลือกหินสังเคราะห์ (เรตติดตั้ง · วิธีวัด · วิธีดูแล · FAQ)”
       • `/network` — “เครือข่ายและช่องทางติดต่อ (เว็บเครือ · LINE · Facebook)”
     เป้าหมาย: **ทุก URL ใน `public/sitemap.xml` ต้องปรากฏใน `public/llms.txt` ครบ**
  B. **`public/llms-full.txt` — ให้ข้อมูลหน้าใหม่ครบสำหรับ AI crawler**
     เพิ่มท่อนของ `/price-guide`: เรตพร้อมติดตั้ง **4 เรต (7,500 · 8,500 · 9,500 · 12,000 บาท/ตร.ม.)** · เงื่อนไขงานเล็ก · ค่าดำเนินการติดตั้งอ่าง · VAT 7%
     ⚠️ **ตัวเลขทุกตัวต้องดึงจากค่าคงที่ในแอป** (`STONE_INSTALLED_*` · `VAT_RATE` ฯลฯ) — **ห้ามพิมพ์มือ ห้ามเดา** และห้ามใส่ราคาลง JSON-LD ใด ๆ
     และอ้าง `/network` + `/price-guide` ในสารบัญ/ท้ายไฟล์
  C. **ล็อกกันหลุด (เทสต์ใหม่ 1 ไฟล์)** — สร้างเทสต์ที่อ่าน `public/sitemap.xml` + `public/llms.txt` แล้วยืนยันว่า **ทุก URL ใน sitemap มีใน llms.txt** และ llms.txt ไม่มี URL ปลอม (ที่ไม่มีใน sitemap)
     **พิสูจน์ว่าจับบั๊กได้**: ตัดบรรทัด `/price-guide` ออกจาก llms.txt ชั่วคราว → เทสต์ต้อง **fail** → คืน → ผ่าน (แนบทั้งสองผล)
  D. **รายงาน (ห้ามแก้ในใบนี้)**: ในรายงานของคุณมีข้อ “ชื่อ/คำล้าสมัย 6–14 จุด” — ให้ **ยกตัวอย่างพร้อมเลขบรรทัด** ของ llms.txt/llms-full.txt ที่คุณเห็น (เดวิดตรวจแล้วไม่พบโดเมนเก่า `srv1964473` เลย ⇒ ถ้าเป็นเรื่องอื่น เช่น ชื่อห้าง/ชื่อรุ่น/จำนวนภาพ ให้ระบุชัด เพื่อให้ตรวจต่อได้)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt              (เพิ่ม 2 ลิงก์ + แก้ให้ตรงจริง)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt         (เพิ่มท่อน /price-guide + อ้าง 2 หน้า)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/                        (ใหม่) ไฟล์เทสต์ใหม่ 1 ไฟล์สำหรับข้อ C
  - /opt/data/cache/kbsrc/qa/job-282-qwen-llms-parity.md                       อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแตะ `public/sitemap.xml` (12 URL ถูกต้องแล้ว) · ห้ามแตะราคา/รหัสสี/อ่าง/`src/data/**` · `src/index.css` · `artifacts/api-server/**` · `src/admin/**`
  - ห้ามพิมพ์ตัวเลขราคาเองในไฟล์ — ต้องมาจากค่าคงที่ของแอปเท่านั้น · ห้ามใส่ราคาใน JSON-LD
  - ห้ามอ่าน/พิมพ์ `.env`/คีย์ · ห้ามแตะ production/DB · ห้าม push ตรงเข้า `main` · ห้าม merge เอง

EVIDENCE:
  1) `grep -c 'price-guide' public/llms.txt public/llms-full.txt` → ต้องได้ **≥1 ทั้งคู่** (ก่อนแก้ = 0/0 — แนบผลก่อน/หลัง)
  2) ตรวจครบทุกหน้า: รันคำสั่งเทียบ sitemap ↔ llms.txt แล้วแนบผล (ต้องไม่มีบรรทัด “ขาด” เหลือ)
     `comm -23 <(curl -s https://knightbasins.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//;s|https://knightbasins.com||' | sort) <(grep -o 'https://knightbasins.com[a-zA-Z0-9/_-]*' public/llms.txt | sed 's|https://knightbasins.com||' | sort -u)` → ต้องว่าง
  3) เทสต์ใหม่ผ่าน + พิสูจน์ว่าจับบั๊กได้ (ตัด /price-guide → fail → คืน → ผ่าน) แนบสองผล
  4) ชุดเทสต์เว็บทั้งชุด: ตก **0** · baseline main 7 ต.ค. 69 = **1176 tests / 1167 pass / 0 fail / 9 skip**
     คำสั่ง: `files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort); node --experimental-strip-types --test $files`
  5) `pnpm run typecheck:libs` (root) ก่อน แล้ว `pnpm exec tsc --noEmit` ใน artifacts/knight-basins → **0 errors**
  6) `git diff --stat` → แตะไม่เกิน 3 ไฟล์ · `src/index.css` 0 diff · lockfile 0 diff
  7) รายงานข้อ D พร้อมเลขบรรทัดของคำที่ล้าสมัย (ถ้ามี)

OUTPUT:
  - llms.txt/llms-full.txt ที่อ้างครบ 12 หน้า + ท่อน /price-guide ที่ตัวเลขมาจากค่าคงที่ของแอป + เทสต์กันหลุด
  - รายงาน: ตัวเลขก่อน/หลัง · ผลตรวจ parity · รายการคำล้าสมัยพร้อมบรรทัด

STOP:
  - เมื่อ llms.txt อ้างครบทุก URL ใน sitemap (ตรวจแล้วเหลือ 0) · llms-full.txt มีท่อน /price-guide ที่ตัวเลขตรงค่าคงที่แอป · เทสต์ใหม่ผ่านและพิสูจน์ว่าจับบั๊กได้ · ชุดเทสต์ตก **0** · tsc **0 error** · แตะไม่เกิน **3 ไฟล์**
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
```

## ช่องว่างที่ Qwen รายงาน vs ที่เดวิดตรวจได้ (ใช้เป็นกรอบงาน)

| ข้อที่ Qwen เสนอ | เดวิดตรวจแล้ว | สถานะ |
|---|---|---|
| `llms.txt`/`llms-full.txt` ไม่มี `/price-guide` | **จริง** (price-guide = 0 ทั้งสองไฟล์) + ยังขาด `/network` ด้วย | **แก้ในใบนี้** (A · B · C) |
| “ส่วนท้ายยังมีชื่อห้างเก่า 6 จุด · llms-full 14 จุด” | ตรวจ **โดเมนเก่า** `srv1964473` = **0** ทั้งสองไฟล์ ⇒ ต้องดูว่าเป็นคำ/ชื่ออะไร | **รอตัวอย่าง + เลขบรรทัด** (D) |
| `/price-guide` crawler access = 0 | ตรวจ UA บอท 3 ตัว = **200** ทุกตัว · JSON-LD 3 บล็อก ⇒ เข้าถึงได้ | **ไม่ตรง — ใช้ได้อยู่แล้ว** |
| เรตบนหน้า /price-guide | หน้าเว็บมี **4 เรต** แล้ว (7,500 · 8,500 · 9,500 · 12,000) หลังแก้รอบ 384/386 | ✅ |
| citation readiness ต่ำ (FAQ/definition block/โครงสร้าง) | ยังไม่ได้ตรวจเชิงลึก — เป็นงานเนื้อหารอบถัดไปได้ | **รอคิว** |

## เช็คลิสต์ 12 ข้อ (ติ๊กใน PR/รายงาน)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | เพิ่ม 2 ลิงก์ใน llms.txt | `/price-guide` + `/network` มีอยู่จริง |
| 2 | parity sitemap ↔ llms.txt | เหลือ 0 URL ที่ขาด |
| 3 | llms-full.txt มีท่อน /price-guide | 4 เรต + เงื่อนไขงานเล็ก + VAT (จากค่าคงที่แอป) |
| 4 | ไม่มีราคาใน JSON-LD | ตรวจแล้ว 0 |
| 5 | เทสต์ใหม่ | ผ่าน + ครอบ parity |
| 6 | พิสูจน์เทสต์จับบั๊ก | ตัด → fail → คืน → ผ่าน (แนบ 2 ผล) |
| 7 | ชุดเทสต์เว็บ | ตก 0 · เทียบ 1176/1167/0/9 + ระบุ commit |
| 8 | Typecheck | libs ก่อน แล้ว 0 errors |
| 9 | ขอบเขตไฟล์ | ≤ 3 ไฟล์ · index.css/lockfile/sitemap 0 diff |
| 10 | ไม่แตะข้อมูล | ไม่มี SQL · ไม่แก้ราคา/สี/อ่าง |
| 11 | รายงานข้อ D | ยกตัวอย่างคำล้าสมัย + เลขบรรทัด |
| 12 | หลักฐานดิบ | คำสั่ง + ตัวเลขจริงทุกข้อ |

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → Qwen] ใบ 282-Q ครับ — ต่อจากวิเคราะห์ SEO/AEO/GEO ของคุณ เดวิดตรวจซ้ำแล้ว: จุดที่ "จริง" คือ llms.txt/llms-full.txt ไม่มี /price-guide (และยังขาด /network ด้วย) เดวิดเช็คแล้วว่า crawler เข้า /price-guide ได้ 200 ปกติ และไม่พบโดเมนเก่าในไฟล์ทั้งสอง
ทำ 3 อย่าง:
A. public/llms.txt — เพิ่ม /price-guide และ /network (ให้ครบทุก URL ใน sitemap)
B. public/llms-full.txt — เพิ่มท่อน /price-guide (เรตติดตั้ง 4 เรต · เงื่อนไขงานเล็ก · ค่าดำเนินการติดตั้งอ่าง · VAT 7%) โดยดึงตัวเลขจากค่าคงที่ของแอปเท่านั้น ห้ามพิมพ์มือ ห้ามใส่ราคาใน JSON-LD
C. เทสต์กันหลุด 1 ไฟล์: ทุก URL ใน sitemap ต้องมีใน llms.txt + พิสูจน์ว่าจับบั๊กได้ (ตัด /price-guide ชั่วคราว → fail → คืน → ผ่าน)
D. รายงาน (ห้ามแก้): อ้างบรรทัดของ "คำล้าสมัย 6-14 จุด" ที่คุณเห็น (เดวิดไม่พบโดเมนเก่าเลย ⇒ ถ้าเป็นชื่อห้าง/ชื่อรุ่น/จำนวนภาพ ให้ระบุให้ชัด)
ห้าม: แตะ sitemap (12 URL ถูกแล้ว) · ราคา/สี/อ่าง/src/data · index.css/api-server/admin · push main
ตัวเลข: ชุดเทสต์ตก 0 (baseline main = 1176/1167/0/9 — ระบุ commit + คำสั่งทุกครั้ง) · tsc 0 error · แตะ ≤ 3 ไฟล์
เมื่อเชื่อม GitHub ได้แล้ว ส่งเป็น branch + PR ได้เลย แล้วส่งลิงก์มาให้เดวิดตรวจ+merge
```