# ใบงาน 268 (ภาคผนวก) — ตัดคำโฆษณา feature “จับคู่สีหินจากภาพ” ออกจากหน้าสาธารณะ

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **เดวิด** (บอสอนุมัติ 4 ต.ค. 69: “บอสอนุมัติทำได้เลย”) · **ผู้ตรวจรับ:** เดวิด (ไม่มีผู้ตรวจที่สอง — แจ้งความโปร่งใส)
**Branch:** `fix/david-updates-remove-stone-match-mention` · **PR #351** merged `b7a1929`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. หลังใบ 268 ถอด feature ออกจากแอปแล้ว พบว่า **ยังมีคำโฆษณา feature นี้ในหน้าสาธารณะ** (ลูกค้า/IP ของบอสเห็นได้) ⇒ ตัดออกให้หมดเพื่อไม่ให้เข้าใจผิดว่ามีระบบนี้อยู่
     - `artifacts/knight-basins/src/pages/UpdatesPage.tsx` (หน้า /updates): ลบ highlight “AI Visual Matcher (Gemini)” ออกจากบันทึก v1.2.0 · ปรับ `badge` และ `title` ของ v1.2.0 ไม่ให้กล่าวถึง AI Matcher
     - `artifacts/knight-basins/public/llms.txt` และ `public/llms-full.txt`: ตัดข้อความ “AI Visual Matcher จับคู่สีหินจากภาพ…” ออกจากบรรทัดบันทึก v1.2.0
  2. ปรับเทสต์ที่ล็อกเนื้อหาเดิมให้ตรงกับเจตนาใหม่ (ไม่ใช่เพื่อให้ผ่าน):
     - `artifacts/knight-basins/test/release-v120.test.ts`: metadata ของ v1.2.0 ไม่มี AI Matcher · เปลี่ยนชื่อเทสต์ “records all four … highlights” → “all three” และลบ 3 ข้อความที่คาดหวังของ AI Matcher
  3. **ไม่แตะ:** เวอร์ชัน v1.2.0 ยังอยู่ · รายการของเวอร์ชันอื่นคงเดิม · `src/index.css` (0 diff) · แอป/หน้าลูกค้าอื่น · เครื่องยนต์ `lib/stone-matcher.ts` (โค้ดพักตามใบ 268)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/release-v120.test.ts

FORBIDDEN:
  - ห้ามลบบันทึกเวอร์ชัน v1.2.0 หรือเวอร์ชันอื่น · ห้ามแก้ข้อความของ feature ที่ยังใช้งานอยู่ (Full Slab & Studio Viewer · Formal Quotation Stone Thumbnails · Automated Studio Sales Alert)
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · `artifacts/api-server/**` · `artifacts/api-server/src/lib/stone-matcher.ts` · หน้าลูกค้า (`StudioPage.tsx` · `stone` · `studio`)
  - ห้ามลบ/แก้ `qa/**` · `KANBAN.md` · `docs/**` · ห้าม push ตรงเข้า `main` · ห้าม deploy เองนอกขั้นตอนปกติ

EVIDENCE:
  1) `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` → **0 error**
  2) `node --experimental-strip-types --test test/release-v120.test.ts test/llms-txt-content-integrity.test.ts` → **19/19 ผ่าน**
  3) knight-basins ชุด CI เต็ม (`node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)`) → **1112 tests / 1103 pass / 0 fail / 9 skip** (เท่าเดิมกับหลังใบ 268)
  4) `grep -rn 'จับคู่สีหิน\|AI Visual Matcher\|AI Matcher' artifacts/knight-basins/src artifacts/knight-basins/public` → **ไม่เหลือ** (ยกเว้นเครื่องยนต์ที่พักไว้นอกหน้าสาธารณะ)
  5) **ยืนยันบน production หลัง deploy (b7a1929):** บันเดิลเว็บ `index-BsJyV5KB.js` → `AI Visual Matcher` = 0 · `จับคู่สีหินจากภาพ` = 0 · `stone-match` = 0 · `/updates` = 200 · `/admin` = 200 · `/llms.txt` และ `/llms-full.txt` = 0 ครั้ง

OUTPUT:
  - หน้าสาธารณะ `/updates` + `llms.txt`/`llms-full.txt` ไม่มีคำโฆษณา feature ที่ถูกถอดอีก · PR merged + deploy สำเร็จ

STOP:
  - เมื่อ tsc 0 · เทสต์ผ่าน · grep ไม่เหลือ · deploy สำเร็จ และยิงยืนยันบน production ครบ
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ตัดคำโฆษณา 3 ไฟล์ + ปรับเทสต์ 1 |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบเวอร์ชัน/แตะ index.css/api/หน้าลูกค้า |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์ · grep · ยิงยืนยันบน prod |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | หน้าสาธารณะสะอาด + deploy |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุผู้ทำ/ผู้อนุมัติ | ผ่าน | เดวิดทำเอง · บอสอนุมัติ |
| 9 | ระบุความโปร่งใส (ไม่มีผู้ตรวจที่สอง) | ผ่าน | ระบุในหัวใบงาน |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → บอส] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 4 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → บอส] ใบ 268 (ภาคผนวก) — ตัดคำโฆษณา feature "จับคู่สีหินจากภาพ" ออกจากหน้าสาธารณะ เสร็จแล้ว
แก้ 4 ไฟล์: UpdatesPage.tsx (ลบ highlight AI Visual Matcher ออกจาก v1.2.0 + badge/title) · public/llms.txt · public/llms-full.txt · test/release-v120.test.ts (ปรับการล็อก 4→3 highlights)
หลักฐาน: tsc 0 · release-v120 + llms tests 19/19 · knight-basins ชุดเต็ม 1112/1103/0/9 · grep ใน src/public = ไม่เหลือ · PR #351 merged b7a1929 · Deploy success
ยืนยันบน production: bundle index-BsJyV5KB.js → "AI Visual Matcher" 0 · "จับคู่สีหินจากภาพ" 0 · "stone-match" 0 · /updates 200 · /admin 200 · /llms.txt + /llms-full.txt = 0 ครั้ง
หมายเหตุ: งานนี้เดวิดเขียนเอง+ตรวจเอง (ไม่มีผู้ตรวจที่สอง ตามที่บอสอนุมัติ) — ชดเชยด้วยหลักฐานดิบทุกข้อ + CI 2 ด่าน + ยิงจริงบน production
```
